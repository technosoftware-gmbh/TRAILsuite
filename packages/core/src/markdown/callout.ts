/**
 * Obsidian callouts in a note body: finding one, and composing one.
 *
 * A callout is a blockquote whose first line names a kind, and it is how these
 * vaults carry the standing text of a note -- a project's summary, a place's
 * overview -- as against the running text somebody adds underneath. That makes
 * it a note format rather than one plugin's model, which is why it is here:
 * the arrangement is a statement about the file, and a reader written against
 * the renderer would drift the day the renderer changed.
 *
 * Deliberately domain-free, exactly as `sections.ts` beside it. It knows about
 * `> [!KIND]` and quoted lines; that SUMMARY is where a project keeps its
 * summary is the caller's vocabulary.
 *
 * **Positions are returned rather than a rebuilt body.** A caller replacing a
 * callout in a note somebody has been typing in has to leave every other line
 * exactly as it was, and the only way to promise that is to hand back the span
 * and splice it.
 *
 * App-free.
 */

/** How a callout folds: `+` starts open, `-` starts collapsed, '' does not fold. */
export type CalloutFold = '' | '+' | '-';

export interface Callout {
  /** The word between the brackets, as it was written. */
  kind: string;
  fold: CalloutFold;
  /** The heading after the bracket, empty when the callout carries only its kind. */
  title: string;
  /** The quoted lines under the opener, markers stripped. */
  lines: string[];
  /** The opener's index in the lines it was found in. */
  from: number;
  /** One past the last quoted line. */
  to: number;
}

const OPENER = /^>\s*\[!([A-Za-z0-9_-]+)\]([+-]?)\s*(.*)$/;
const QUOTED = /^>\s?(.*)$/;

/**
 * The first callout of a given kind, or null.
 *
 * The kind is matched without regard to case, because Obsidian matches it that
 * way and a note written by hand says `[!summary]` about as often as
 * `[!SUMMARY]`. What is written back is the caller's spelling; what is found is
 * either.
 *
 * The block ends at the first line that is not quoted. A blank line ends it
 * even though the text continues below, which is what Obsidian renders, so a
 * paragraph somebody added under the summary is not swallowed into it.
 */
export function findCallout(lines: readonly string[], kind: string): Callout | null {
  const wanted = kind.trim().toLowerCase();

  for (let index = 0; index < lines.length; index++) {
    const found = calloutAt(lines, index, wanted);
    if (found) return found;
  }

  return null;
}

/**
 * Every callout of a kind, in the order they were written.
 *
 * `findCallout` answers "which one am I editing"; this answers "is there more
 * than one", which is a different question and the only one that can tell
 * somebody the second summary they wrote is never going to be read. A caller
 * that only wants the first should still ask for the first: the edit is
 * defined as the first one, not as the only one.
 *
 * Scanning resumes past a callout's own quoted lines rather than one line in,
 * so a callout somebody nested inside another is part of the outer one's text
 * and not a second find.
 */
export function findCallouts(lines: readonly string[], kind: string): Callout[] {
  const wanted = kind.trim().toLowerCase();
  const found: Callout[] = [];

  for (let index = 0; index < lines.length; index++) {
    const callout = calloutAt(lines, index, wanted);
    if (!callout) continue;

    found.push(callout);
    // `to` is one past the last quoted line, and the loop adds one more.
    index = callout.to - 1;
  }

  return found;
}

/** The callout opening at `index`, or null when that line does not open one of `wanted`. */
function calloutAt(lines: readonly string[], index: number, wanted: string): Callout | null {
  const opener = OPENER.exec(lines[index] ?? '');
  if (!opener || (opener[1] ?? '').toLowerCase() !== wanted) return null;

  const body: string[] = [];
  let end = index + 1;
  for (; end < lines.length; end++) {
    const quoted = QUOTED.exec(lines[end] ?? '');
    if (!quoted) break;
    body.push((quoted[1] ?? '').trimEnd());
  }

  return {
    kind: opener[1] ?? '',
    fold: (opener[2] ?? '') as CalloutFold,
    title: (opener[3] ?? '').trim(),
    lines: body,
    from: index,
    to: end,
  };
}

/**
 * A callout as the lines that make it.
 *
 * A blank line inside the text is written as a bare `>`, because a truly empty
 * line would end the blockquote and split one callout into two.
 */
export function calloutLines(
  kind: string,
  fold: CalloutFold,
  title: string,
  text: string
): string[] {
  const heading = title.trim();
  const opener = `> [!${kind}]${fold}${heading ? ` ${heading}` : ''}`;
  return [opener, ...text.split('\n').map((line) => `> ${line}`.trimEnd())];
}

/** The text of a callout as somebody would type it back into a box. */
export function calloutText(callout: Callout): string {
  return callout.lines.join('\n').trim();
}
