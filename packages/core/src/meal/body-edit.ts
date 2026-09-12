/**
 * Replacing one part of a note's text, leaving everything else byte for byte.
 *
 * The editor never rewrites a whole note. A meal carries sections no editor has
 * a feature for, plus whatever formatting its owner chose, and a save that
 * regenerated the file would quietly launder both. The note is the record and a
 * form is a window onto the part of it somebody built fields for, so each
 * function here rewrites exactly the span it is named for and leaves the rest of
 * the file where it found it.
 *
 * String-to-string transforms, so whichever host hands them a file's contents
 * gets the same answer.
 */

/** Any heading, which is what ends a section. */
const HEADING = /^(#{1,6})\s+(.+)/;

/** Where the frontmatter ends, or 0 when the note has none. */
function bodyStart(contents: string): number {
  if (!contents.startsWith('---')) return 0;

  const closing = contents.indexOf('\n---', 3);
  if (closing < 0) return 0;

  // Past the closing `---` and its newline.
  return closing + 4;
}

function headingName(heading: string): string {
  return heading.replace(/^#+\s*/, '').trim();
}

function findHeadingLine(lines: string[], name: string): number {
  const target = name.trim().toLowerCase();
  if (!target) return -1;

  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i] ?? '');
    if (
      match &&
      (match[2] ?? '')
        .replace(/\s+#+$/, '')
        .trim()
        .toLowerCase() === target
    )
      return i;
  }
  return -1;
}

/**
 * A section's own source text, sub-headings and all.
 *
 * The reading half of `replaceSection`, and it belongs beside it: what an editor
 * puts in front of somebody has to be exactly what a save will put back, or the
 * first save after opening a note quietly rewrites it.
 *
 * Runs to the next heading of the **same level or shallower**, which is the
 * difference from a flat section reader: a Reheating section whose first line
 * is `## For the sauce` would otherwise come back empty, and saving would then
 * delete the group heading somebody typed.
 */
export function sectionSource(contents: string, heading: string): string {
  const target = heading.trim().toLowerCase();
  if (!target) return '';

  const lines = contents.slice(bodyStart(contents)).split('\n');

  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i] ?? '');
    if (
      match &&
      (match[2] ?? '')
        .replace(/\s+#+$/, '')
        .trim()
        .toLowerCase() === target
    ) {
      start = i;
      level = (match[1] ?? '').length;
      break;
    }
  }
  if (start < 0) return '';

  let end = start + 1;
  while (end < lines.length) {
    const match = HEADING.exec(lines[end] ?? '');
    if (match && (match[1] ?? '').length <= level) break;
    end++;
  }

  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
}

/**
 * Replaces the free text between the frontmatter and the first heading.
 *
 * A blank description removes the block rather than leaving an empty line
 * where it was, so clearing the field and saving twice does not accumulate
 * whitespace at the top of the note.
 */
export function replaceDescription(contents: string, description: string): string {
  const start = bodyStart(contents);
  const lines = contents.slice(start).split('\n');

  let firstHeading = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (HEADING.test(lines[i] ?? '')) {
      firstHeading = i;
      break;
    }
  }

  const rest = lines.slice(firstHeading);
  const text = description.trim();

  // A note that had no description and still has none is left exactly as it
  // was. Without this, the tidy form below normalises whatever blank run sat
  // under the frontmatter, so opening and saving a hundred notes that never had
  // a description produces a hundred whitespace diffs. Clearing a description
  // that *was* there still tidies up, which is what the next line does.
  if (!text && lines.slice(0, firstHeading).every((line) => line.trim() === '')) {
    return contents;
  }

  // A blank line after the closing `---`, which is what a note written by
  // hand has. Skipped entirely when there is no frontmatter, where it would
  // push the first line of the file down instead. Both branches reproduce
  // their own output exactly, so saving twice without editing changes nothing.
  const gap = start > 0 ? ['', ''] : [];
  const replaced = text ? [...gap, text, '', ...rest] : [...gap, ...rest];

  return contents.slice(0, start) + replaced.join('\n');
}

/**
 * Deletes a section: its heading, everything under it, and nothing else.
 *
 * The counterpart of `replaceSection` for a section that should stop existing.
 * A meal whose per-100 g figures have moved into frontmatter would otherwise
 * carry the same numbers twice, in two places that drift apart the first time
 * somebody edits one of them, and the note would be lying about half its label
 * with nothing to say which half.
 *
 * Runs to the next heading of the **same level or shallower**, the rule
 * `sectionSource` reads by and `replaceSection` writes by, so a section with
 * group headings inside it goes as a whole rather than leaving its groups
 * orphaned under whatever heading follows.
 *
 * **A heading the note has not got is not an error.** Most saves are of a note
 * that has already been converted, and returning the contents untouched is what
 * makes this safe to run on every save rather than only on the one that
 * converts.
 *
 * Only the heading line and its content go. The blank line that sat above the
 * heading stays, because it belongs to whatever came before, and this function
 * leaves everything outside its own span byte for byte. Searching starts after
 * the frontmatter, as `sectionSource` does: a `#` at the start of a line inside
 * the block is a YAML comment, and deleting from one would take the rest of the
 * note with it.
 */
export function removeSection(contents: string, heading: string): string {
  const start = bodyStart(contents);
  const lines = contents.slice(start).split('\n');

  const index = findHeadingLine(lines, headingName(heading));
  if (index < 0) return contents;

  const level = (HEADING.exec(lines[index] ?? '')?.[1] ?? '#').length;

  let end = index + 1;
  while (end < lines.length) {
    const match = HEADING.exec(lines[end] ?? '');
    if (match && (match[1] ?? '').length <= level) break;
    end++;
  }

  return contents.slice(0, start) + [...lines.slice(0, index), ...lines.slice(end)].join('\n');
}

/**
 * Replaces a section's content, adding the section when it is absent.
 *
 * `before` names the headings this section has to precede, in order. It is
 * what keeps a note's shape stable: an Instructions section added to a note
 * that already has a nutrition table belongs above the table, and appending
 * it at the end would leave a meal whose steps come after its footnotes.
 * With no match among them the section goes at the end, which is the only
 * remaining honest answer.
 */
export function replaceSection(
  contents: string,
  heading: string,
  content: string,
  before: string[] = []
): string {
  const lines = contents.split('\n');
  const body = content.trim();
  const block = body ? ['', ...body.split('\n'), ''] : [''];

  const index = findHeadingLine(lines, headingName(heading));
  if (index >= 0) {
    // To the next heading of the **same level or shallower**, which is the rule
    // `sectionSource` reads by. Stopping at the next heading of any level looks
    // right until a section has group headings in it: `# Reheating` with a
    // `## Teig` under it would then be replaced down to `## Teig` only, and the
    // new content – which contains that heading – would be inserted above the
    // old groups rather than instead of them. It duplicated them.
    const level = (HEADING.exec(lines[index] ?? '')?.[1] ?? '#').length;

    let end = index + 1;
    while (end < lines.length) {
      const match = HEADING.exec(lines[end] ?? '');
      if (match && (match[1] ?? '').length <= level) break;
      end++;
    }

    return [...lines.slice(0, index + 1), ...block, ...lines.slice(end)].join('\n');
  }

  for (const name of before) {
    const at = findHeadingLine(lines, name);
    if (at >= 0) {
      return [...lines.slice(0, at), heading, ...block, ...lines.slice(at)].join('\n');
    }
  }

  return [...contents.trimEnd().split('\n'), '', heading, ...block].join('\n');
}
