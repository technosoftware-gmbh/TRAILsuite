/**
 * Putting a line into a day note, under the heading it belongs to.
 *
 * **No note is ever seeded with headings.** `write-period.ts` creates a period
 * note with frontmatter and nothing else, on the grounds that a plugin seeding
 * a template is seeding it into 365 notes a year that somebody then deletes.
 * That rule stands, so a heading is created by the first entry that needs one:
 * a day where you only wrote down two ideas has one heading, and a day you
 * never opened has none.
 *
 * **It inserts and never reorders.** 105 of the plan notes in the vault this
 * was built for carry migrated content, most of it research written before any
 * of this existed. A function that tidied a note while adding a line to it
 * would be rewriting somebody's records in passing, and the rewrite would be
 * discovered months later.
 *
 * Pure, and text in text out. It knows nothing about days, entries or Obsidian;
 * `add-to-day-modal.ts` decides which heading a kind belongs under and this
 * decides where in the file that is.
 */

/** The `#` count that opens a heading line, or 0 for a line that is not one. */
function headingLevel(line: string): number {
  const match = /^(#{1,6})\s/.exec(line);
  return match ? (match[1] ?? '').length : 0;
}

/** Compared with the whitespace off both ends, so a heading somebody padded still matches. */
function isHeading(line: string, heading: string): boolean {
  return line.trim() === heading.trim();
}

/**
 * The index one past the last line of the section opened at `start`.
 *
 * The section ends at the next heading of the same level or shallower. A
 * deeper one belongs to this section: `### Vormittag` under `## Termine` is
 * part of Termine, and a new meeting goes after it rather than in front of it.
 */
function sectionEnd(lines: readonly string[], start: number): number {
  const level = headingLevel(lines[start] ?? '');
  let index = start + 1;
  while (index < lines.length) {
    const next = headingLevel(lines[index] ?? '');
    if (next > 0 && next <= level) break;
    index += 1;
  }
  return index;
}

/** Trailing blank lines are the section's padding, not its content. */
function withoutTrailingBlanks(lines: readonly string[], end: number, start: number): number {
  let index = end;
  while (index > start + 1 && (lines[index - 1] ?? '').trim() === '') index -= 1;
  return index;
}

/**
 * The lines under the first of `headings` the body carries, or none.
 *
 * The heading line itself is not among them, and neither is anything under a
 * later heading of the same level. This exists so that "is that already written
 * down here" can be asked of one section rather than of a whole note, which is
 * the difference between a task about a meeting and the meeting itself.
 *
 * `read-day.ts` walks the same sections with a parser attached, because it
 * needs the position of every line it returns. This returns text and nothing
 * else, and the two are not worth folding into one.
 */
export function sectionOf(body: string, headings: readonly string[]): string[] {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => headings.some((heading) => isHeading(line, heading)));
  if (start === -1) return [];

  return lines.slice(start + 1, sectionEnd(lines, start));
}

/**
 * The body with `lines` added under `heading`, which is created if it is absent.
 *
 * Added at the **end** of the section rather than the top: a day note is read
 * downwards and an entry added at four in the afternoon belongs after the one
 * added at nine, whatever kind either of them is.
 *
 * `headings` is best-first: the first is written when none is there, and any of
 * them is accepted when one is. A body that had no such heading gains the first
 * at the end of the note, under whatever was already there. That is what makes the first capture of the day
 * cheap and the note it writes into unremarkable.
 */
export function appendUnderHeading(
  body: string,
  headings: readonly string[],
  lines: readonly string[]
): string {
  const wanted = lines.filter((line) => line.trim() !== '');
  const heading = headings[0];
  if (wanted.length === 0 || heading === undefined) return body;

  const existing = body.split('\n');
  // Any spelling the note may already carry, not only the one we would write.
  // See `headingsFor`: a vault that switched language must not gain a second
  // heading beside the one its notes already have.
  const at = existing.findIndex((line) => headings.some((candidate) => isHeading(line, candidate)));

  if (at === -1) {
    // A blank line before the new heading, and none after: the heading and its
    // first entry read as one thing, which is what they are.
    const before = body.trimEnd();
    const gap = before === '' ? '' : '\n\n';
    return `${before}${gap}${heading.trim()}\n\n${wanted.join('\n')}\n`;
  }

  const end = withoutTrailingBlanks(existing, sectionEnd(existing, at), at);
  const next = [...existing.slice(0, end), ...wanted, ...existing.slice(end)];
  return next.join('\n');
}

/**
 * The body with `lines` inserted before the line at `at`.
 *
 * The other half of a move: `replaceLines` with an empty list lifts an entry
 * out, and this puts it down again somewhere else in the same section. Kept
 * separate rather than folded into one `moveLines`, because the caller has to
 * re-read the entry positions in between -- lifting one out moves everything
 * below it -- and a single function taking both ends would be measuring the
 * destination against a body that no longer exists.
 *
 * An `at` outside the body appends, which is what the end of a section is.
 */
export function insertLines(body: string, at: number, lines: readonly string[]): string {
  const existing = body.split('\n');
  const where = Math.max(0, Math.min(at, existing.length));
  return [...existing.slice(0, where), ...lines, ...existing.slice(where)].join('\n');
}

/**
 * The body with the lines `from` up to but not including `to` replaced.
 *
 * The one write that touches something already in a note, so the bounds matter:
 * they come from the reader that found the entry, in the same render, off the
 * same text. Anything outside them is untouched, including the blank lines
 * around the entry.
 *
 * An empty `lines` deletes the span, which is how an entry is removed. The
 * blank line that followed it goes with it, because a deletion that left one
 * behind would open a gap that grows every time something is deleted.
 */
export function replaceLines(
  body: string,
  from: number,
  to: number,
  lines: readonly string[]
): string {
  const existing = body.split('\n');
  if (from < 0 || to > existing.length || from >= to) return body;

  const wanted = lines.filter((line) => line.trim() !== '');
  let end = to;
  if (wanted.length === 0) {
    // The blank lines that followed the entry go with it. Leaving them behind
    // opens a gap that grows every time something is deleted, and the blank
    // before the next heading is put back by the slice rather than kept here:
    // what remains after the cut still begins with whatever separated the
    // sections.
    while (end < existing.length && (existing[end] ?? '').trim() === '') end += 1;
  }

  return [...existing.slice(0, from), ...wanted, ...existing.slice(end)].join('\n');
}
