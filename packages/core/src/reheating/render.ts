/**
 * Writing a reheating section into a note.
 *
 * The parser is next door and this is deliberately beside it: a format with a
 * reader and no writer drifts the moment somebody types the section by hand, and
 * a writer that lives away from its reader drifts the moment either is edited.
 * `tests/reheating/render.test.ts` round-trips every case, which is the only way
 * that claim stays true.
 *
 * **The section is replaced whole, and nothing else in the note is touched.**
 * A reheating section is short, entirely structured, and rebuilt from entries
 * the caller already holds; the rest of a meal note is prose somebody wrote
 * and is none of this function's business.
 */
import { DEFAULT_REHEAT_FIELDS, type ReheatFieldNames } from './parse-entries.js';
import type { ApplianceEntry } from './types.js';

export interface RenderReheatOptions {
  /** The section heading, as this vault spells it. `Reheating` by default. */
  heading?: string;
  /**
   * What heading level to write, when the note has no such section yet.
   *
   * One by default, which is what the notes this was built against use. An
   * existing section keeps whatever level it already has, so this only decides
   * the first time.
   */
  level?: number;
  fields?: ReheatFieldNames;
}

const DEFAULT_HEADING = 'Reheating';

/** The `[temp:: 95 °C] [time:: 25 min]` line, or '' when the entry states neither. */
export function renderFieldLine(
  entry: Pick<ApplianceEntry, 'temp' | 'time'>,
  fields: ReheatFieldNames = DEFAULT_REHEAT_FIELDS
): string {
  return [
    entry.temp ? `[${fields.temp}:: ${entry.temp}]` : '',
    entry.time ? `[${fields.time}:: ${entry.time}]` : '',
  ]
    .filter((part) => part)
    .join(' ');
}

/**
 * One appliance, as the lines that go under its heading.
 *
 * The numbers lead, then the prose. That is the order a note written by hand
 * puts them in, and it is the order the parser finds either way, so the choice
 * is only about what a person reading the raw markdown sees first.
 */
export function renderApplianceBlock(
  entry: ApplianceEntry,
  options: RenderReheatOptions = {}
): string[] {
  const fields = options.fields ?? DEFAULT_REHEAT_FIELDS;
  const lines: string[] = [];

  const numbers = renderFieldLine(entry, fields);
  if (numbers) lines.push(numbers);
  for (const step of entry.steps) lines.push(step);

  return lines;
}

/**
 * The whole section, heading included, or '' when there is nothing to write.
 *
 * An entry saying nothing is skipped rather than written as a bare heading, so
 * what this produces is what the parser would give back.
 */
export function renderReheatSection(
  entries: readonly ApplianceEntry[],
  options: RenderReheatOptions = {}
): string {
  const heading = (options.heading ?? DEFAULT_HEADING).trim() || DEFAULT_HEADING;
  const level = Math.min(Math.max(options.level ?? 1, 1), 5);

  const blocks: string[] = [];
  for (const entry of entries) {
    const lines = renderApplianceBlock(entry, options);
    if (lines.length === 0) continue;
    blocks.push([`${'#'.repeat(level + 1)} ${entry.label}`, ...lines].join('\n'));
  }

  if (blocks.length === 0) return '';
  return [`${'#'.repeat(level)} ${heading}`, '', blocks.join('\n\n'), ''].join('\n');
}

const HEADING_LINE = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;

/** Where a named section starts and ends in a body, or null when it has none. */
export function findSection(
  body: string,
  heading: string
): { start: number; end: number; level: number } | null {
  const lines = body.split('\n');
  const wanted = heading.trim().toLowerCase();
  if (!wanted) return null;

  for (let index = 0; index < lines.length; index++) {
    const match = HEADING_LINE.exec(lines[index] ?? '');
    if (!match || (match[2] ?? '').trim().toLowerCase() !== wanted) continue;

    const level = (match[1] ?? '#').length;

    // Runs to the next heading at the same level or shallower. A deeper one is
    // an appliance inside this section, which is the whole point of the format.
    let end = lines.length;
    for (let after = index + 1; after < lines.length; after++) {
      const next = HEADING_LINE.exec(lines[after] ?? '');
      if (next && (next[1] ?? '').length <= level) {
        end = after;
        break;
      }
    }

    return { start: index, end, level };
  }

  return null;
}

/**
 * A body with its reheating section replaced, added, or removed.
 *
 * Added at the end when the note has none, because a section appended to a
 * meal note is where a reader expects a late addition and because guessing a
 * position among sections somebody arranged would be presumptuous.
 *
 * **No entries removes the section rather than writing an empty one.** That is
 * how somebody takes the numbers back off a dish, and an empty `# Reheating`
 * heading left behind would read to the parser and to a person as a section that
 * failed rather than as one that is not there.
 */
export function upsertReheatSection(
  body: string,
  entries: readonly ApplianceEntry[],
  options: RenderReheatOptions = {}
): string {
  const heading = (options.heading ?? DEFAULT_HEADING).trim() || DEFAULT_HEADING;
  const found = findSection(body, heading);
  const section = renderReheatSection(entries, {
    ...options,
    heading,
    level: found?.level ?? options.level ?? 1,
  });

  if (!found) {
    if (!section) return body;
    const before = body.replace(/\s*$/, '');
    return before ? `${before}\n\n${section}` : section;
  }

  const lines = body.split('\n');
  const after = lines.slice(found.end);
  const before = lines.slice(0, found.start);

  const rebuilt = [...before, ...(section ? section.split('\n') : []), ...after].join('\n');

  // One blank line between sections, however many the edit happened to leave.
  return rebuilt.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}
