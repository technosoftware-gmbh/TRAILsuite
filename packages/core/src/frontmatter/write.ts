/**
 * Setting one property in a frontmatter block, leaving the rest byte for byte.
 *
 * **This is not a serializer, and the distinction is the whole point.**
 * `block.ts` says serialization is the host's job, and it still is: a writer
 * that re-emitted a whole block would reorder keys somebody arranged, drop
 * comments, requote strings and change the shape of every note it touched.
 * What is here instead is the surgical version, which is what an editor
 * actually needs: find the span one key occupies, replace exactly that, and
 * leave every other line alone.
 *
 * It lives beside the reader for the reason the plan renderer lives beside
 * its parser: a format with a reader and no writer drifts the moment something
 * writes it anyway. Obsidian hosts have `processFrontMatter()` and need none of
 * this; a host that only has a file does.
 *
 * **What it deliberately does not do:** nested maps, flow sequences, anchors,
 * multi-document files, or anything else YAML can express and these notes never
 * contain. A value it cannot write is a value it refuses to touch.
 */

/**
 * What a property can be set to.
 *
 * **`null` and `undefined` are different answers**, and the difference is one
 * these notes make constantly: `prep:` with nothing after it is a property the
 * template wrote and nobody has filled in, and no `prep:` at all is a property
 * this note does not have. YAML says the first is a key whose value is null, so
 * that is what `null` writes; `undefined` removes the key.
 *
 * Getting this wrong deletes an empty property on every save, which across a
 * library is a hundred notes quietly reshaped.
 */
export type FrontmatterValue = string | number | boolean | readonly string[] | null | undefined;

/** A top-level key line: no indentation, a name, a colon. */
const KEY_LINE = /^([A-Za-z_][\w -]*):(.*)$/;

/**
 * A double-quoted scalar.
 *
 * Double quotes because that is what these vaults' notes already use, and a
 * writer producing a different quoting style for the same value makes every
 * note it touches look edited.
 */
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * A `YYYY-MM-DDTHH:mm` value, which has to survive a host that reads YAML 1.1.
 *
 * **This is quoted and a date-only value is not, and the asymmetry is the whole
 * point.** YAML 1.1 has a timestamp type, so an unquoted datetime is parsed to
 * a `Date` and Obsidian then writes it back with the time gone. A date-only
 * value survives that round trip, and it is what Obsidian's own property editor
 * produces, so quoting it would make every note this touches look edited.
 *
 * A trip's `departure` is the value this was found on. APERtrail had always
 * quoted such a value by hand on its way through Obsidian's
 * `processFrontMatter`, which held only for as long as every call site
 * remembered to; a writer working on the file itself has no such hand. So the
 * rule had to become one the writer knows rather than one a caller remembers.
 */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/;

/**
 * Whether a string has to be quoted to survive being read back.
 *
 * Erring towards quoting is safe and erring away from it is not, but quoting
 * everything would requote the hundred plain values a note already holds. So:
 * anything that starts with a character YAML gives a meaning, anything holding
 * a colon-space or a trailing hash, anything that would otherwise read back as
 * a number or a boolean rather than as the word somebody typed, and a datetime.
 */
function needsQuoting(value: string): boolean {
  if (value === '') return true;
  if (value !== value.trim()) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return true;
  if (/:\s|\s#/.test(value)) return true;
  // A quote inside a plain scalar is legal YAML and reads back intact, but it
  // is the one value where a later editor's requoting could change meaning, so
  // it is written unambiguously.
  if (value.includes('"')) return true;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
  if (DATE_TIME.test(value)) return true;
  return /^-?\d+(\.\d+)?$/.test(value);
}

function scalar(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  return needsQuoting(value) ? quoted(value) : value;
}

/** The lines one property occupies: its key line plus anything indented under it. */
function spanOf(lines: string[], key: string): { start: number; end: number } | null {
  const wanted = key.trim();

  for (let index = 0; index < lines.length; index++) {
    const match = KEY_LINE.exec(lines[index] ?? '');
    if (!match || match[1] !== wanted) continue;

    let end = index + 1;
    while (end < lines.length) {
      const line = lines[end] ?? '';
      // A blank line inside a block value belongs to it; a new top-level key
      // ends it. Anything indented is the value continuing.
      if (line.trim() === '' || /^\s/.test(line)) {
        end++;
        continue;
      }
      break;
    }

    return { start: index, end };
  }

  return null;
}

function isStringList(value: Exclude<FrontmatterValue, undefined>): value is readonly string[] {
  return Array.isArray(value);
}

/** The lines a value is written as, key line included. */
function render(key: string, value: Exclude<FrontmatterValue, undefined>): string[] {
  // A key with nothing after it, which is what a note's template writes for a
  // field nobody has filled in yet.
  if (value === null) return [`${key}:`];

  // `Array.isArray` narrows to `any[]`, which loses everything the union
  // already knew. The type guard says what the union says instead.
  if (isStringList(value)) {
    const items = value.filter((entry) => entry.trim());
    // An empty list is written as an empty key rather than as `[]`, which is
    // what these notes carry for a property that exists and says nothing.
    return items.length === 0
      ? [`${key}:`]
      : [`${key}:`, ...items.map((entry) => `  - ${scalar(entry)}`)];
  }

  return [`${key}: ${scalar(value)}`];
}

/**
 * A frontmatter block with one property set, added or removed.
 *
 * Takes and returns the block **with its fences**, which is what
 * `splitFrontmatterBlock` hands back, so the two compose without either
 * knowing about the other's edges.
 *
 * A note with no block gets one when something is being set, and is left alone
 * when something is being removed: there is nothing to remove it from, and
 * inventing an empty block to say so would be worse than doing nothing.
 */
export function setFrontmatterValue(header: string, key: string, value: FrontmatterValue): string {
  const name = key.trim();
  if (!name) return header;

  if (!header.trim()) {
    if (value === undefined) return header;
    return ['---', ...render(name, value), '---', ''].join('\n');
  }

  const lines = header.split('\n');
  // The fences are the first line and the last non-empty one. Everything
  // between them is the block.
  const closing = lines.lastIndexOf('---');
  if (lines[0]?.trim() !== '---' || closing <= 0) return header;

  const inside = lines.slice(1, closing);
  const span = spanOf(inside, name);

  const replacement = value === undefined ? [] : render(name, value);
  const next =
    span === null
      ? // Appended rather than inserted at the top: a new property belongs
        // after the ones somebody arranged, not in front of them.
        [...inside, ...replacement]
      : [...inside.slice(0, span.start), ...replacement, ...inside.slice(span.end)];

  return [lines[0], ...next, ...lines.slice(closing)].join('\n');
}

/**
 * A property whose value is lines the caller has already written.
 *
 * The escape hatch for the one shape `setFrontmatterValue` refuses: a nested
 * structure. An order's `selections:` is a list of maps each holding a list of
 * maps, and a general YAML writer for that is exactly the serializer this file
 * exists not to be. So the caller, which understands its own shape, hands over
 * the lines and this places them.
 *
 * The lines are written as given, indentation included. Nothing here checks
 * that they are valid YAML, because nothing here knows what they mean.
 */
export function setFrontmatterBlock(header: string, key: string, lines: readonly string[]): string {
  const name = key.trim();
  if (!name) return header;
  if (lines.length === 0) return setFrontmatterValue(header, name, undefined);

  const block = [`${name}:`, ...lines];

  if (!header.trim()) return ['---', ...block, '---', ''].join('\n');

  const all = header.split('\n');
  const closing = all.lastIndexOf('---');
  if (all[0]?.trim() !== '---' || closing <= 0) return header;

  const inside = all.slice(1, closing);
  const span = spanOf(inside, name);
  const next =
    span === null
      ? [...inside, ...block]
      : [...inside.slice(0, span.start), ...block, ...inside.slice(span.end)];

  return [all[0], ...next, ...all.slice(closing)].join('\n');
}

/** Several properties in one pass, applied in the order given. */
export function setFrontmatterValues(
  header: string,
  values: Readonly<Record<string, FrontmatterValue>>
): string {
  let next = header;
  for (const [key, value] of Object.entries(values)) {
    next = setFrontmatterValue(next, key, value);
  }
  return next;
}
