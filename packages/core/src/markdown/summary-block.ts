/**
 * The summary block a note opens with: a rule, then a `SUMMARY` callout.
 *
 * The shape is the one already in these vaults, written by hand before any
 * plugin offered it: a `---` rule under the frontmatter, a blank line, then a
 * `> [!SUMMARY]+` callout holding a sentence or two saying what the note is
 * about. Reproduced rather than improved on, so a note a plugin makes and a
 * note somebody made read the same.
 *
 * **It is here because it is a note format**, which this repository promotes
 * whatever the number of readers: a format is a statement about a file, and the
 * notes outlive every view built over them. It was written down twice, in
 * NODAtrail's PARA notes and in APERtrail's trips, and one vault holds both --
 * a summary that looked different depending on which plugin wrote the note
 * would have been two conventions for one idea.
 *
 * **The block is the rule and the callout together.** Treating them as one span
 * is what lets a summary be removed without leaving an orphan rule behind, and
 * the rule is only taken as part of the block when it is the note's own opening
 * rule -- a `---` further down is a separator between two pieces of somebody's
 * text and is none of this file's business.
 *
 * **An unchanged summary writes nothing**, and that is decided by the caller,
 * which compares the body this produces against the body it was given. It is
 * not decided here as well: a second guard would be unobservable, since the
 * splice reproduces the same string, and a check that cannot fail is a check
 * nobody can trust. A note is somebody's record, and saving a form after
 * changing only the priority must not touch a line of it.
 *
 * Pure, and free of any host: the reading and writing of files stays in the
 * plugins, which is where an `App` exists.
 */
import { calloutLines, calloutText, findCallout } from './callout.js';

/**
 * The callout kind.
 *
 * Not a setting and not translated: `SUMMARY` is one of Obsidian's own callout
 * keywords, and a German note carrying `[!ZUSAMMENFASSUNG]` would render as an
 * unknown callout rather than as a summary. The label on a form is what gets
 * translated.
 */
export const SUMMARY_CALLOUT = 'SUMMARY';

/** Where a note's summary block sits, rule included. */
export interface SummaryBlock {
  from: number;
  /** One past the last line of the block. */
  to: number;
  text: string;
}

/** The lines of a summary block, as a note that has one opens. */
export function summaryBlockLines(text: string): string[] {
  return ['---', '', ...calloutLines(SUMMARY_CALLOUT, '+', '', text.trim())];
}

/** The block for a new note's body, or '' when nothing was typed. */
export function summaryBody(text: string): string {
  return text.trim() === '' ? '' : summaryBlockLines(text).join('\n');
}

/**
 * The summary block in a body, or null.
 *
 * The rule is claimed only when nothing but blank lines stands between it and
 * the callout, and nothing but blank lines stands above it. Anything else and
 * the block is the callout alone, which leaves a rule somebody put there for
 * their own reasons exactly where they put it.
 */
export function findSummaryBlock(lines: readonly string[]): SummaryBlock | null {
  const callout = findCallout(lines, SUMMARY_CALLOUT);
  if (!callout) return null;

  let above = callout.from - 1;
  while (above >= 0 && (lines[above] ?? '').trim() === '') above--;

  const opensTheNote =
    above >= 0 &&
    (lines[above] ?? '').trim() === '---' &&
    lines.slice(0, above).every((line) => line.trim() === '');

  return {
    from: opensTheNote ? above : callout.from,
    to: callout.to,
    text: calloutText(callout),
  };
}

/**
 * What an edit form shows for a note, which is '' for a note that has none.
 *
 * **The callout's own marker is not part of the text.** `findCallout` returns
 * the quoted lines under the opener, so `[!SUMMARY]+` never reaches a form, an
 * export or anything else that asks a note what it is about. Worth stating
 * because it is invisible until it is wrong, and a reader written by hand
 * against the same note will get it wrong the first time.
 */
export function readSummary(body: string): string {
  return findSummaryBlock(body.split('\n'))?.text ?? '';
}

/**
 * The body with the summary set to `text`, or the same body back when it
 * already says that.
 *
 * A note with no summary gets one above whatever it already holds, because the
 * summary is what the note is about and everything under it accumulated later.
 * Clearing the box takes the block out and closes the gap, rather than leaving
 * an empty callout that reads as a summary somebody forgot to write.
 */
export function withSummary(body: string, text: string): string {
  const lines = body.split('\n');
  const found = findSummaryBlock(lines);

  if (text.trim() === '') {
    if (!found) return body;
    return openWithOneBlank([...lines.slice(0, found.from), ...lines.slice(found.to)]).join('\n');
  }

  const composed = summaryBlockLines(text);

  if (found) {
    return [...lines.slice(0, found.from), ...composed, ...lines.slice(found.to)].join('\n');
  }

  const rest = lines.findIndex((line) => line.trim() !== '');
  const after = rest === -1 ? [] : lines.slice(rest);
  return ['', ...composed, ...(after.length ? ['', ...after] : [''])].join('\n');
}

/** A body still starts with the one blank line that separates it from the frontmatter. */
function openWithOneBlank(lines: readonly string[]): string[] {
  const rest = lines.findIndex((line) => line.trim() !== '');
  return rest === -1 ? [''] : ['', ...lines.slice(rest)];
}
