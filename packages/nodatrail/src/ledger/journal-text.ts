/**
 * Putting a posting into a journal note's text.
 *
 * Pure string work, kept out of the writer so it can be tested without a vault.
 * The rule it exists to enforce: a posting is inserted in date order inside the
 * block, and everything else in the note is left exactly as it was. A note
 * somebody has written prose in, or has two blocks in, must come back with the
 * prose and both blocks intact.
 */
import { JOURNAL_LANGUAGE } from '@technosoftware/trail-core';

/** A journal note with nothing in it yet. */
export function emptyJournalBody(heading: string): string {
  return `# ${heading}\n\n\`\`\`${JOURNAL_LANGUAGE}\n\`\`\`\n`;
}

/**
 * `markdown` with `line` inserted into its first journal block, in date order.
 *
 * When the note has no block, one is appended rather than the posting being
 * dropped. A note that swallowed a posting because somebody deleted its fence
 * would be the worst possible failure here.
 */
export function insertPosting(markdown: string, line: string): string {
  return insertPostingBlock(markdown, [line]);
}

/**
 * The same, for a posting written as several lines.
 *
 * A split is a header and its indented legs, and they have to arrive together
 * and stay together. Inserting them one at a time would put the legs of one
 * split around the header of another the moment two splits shared a date.
 */
export function insertPostingBlock(markdown: string, block: readonly string[]): string {
  if (block.length === 0) return markdown;
  const line = block[0] ?? '';
  const lines = markdown.split(/\r?\n/);
  const open = lines.findIndex((text) => isFenceFor(text, JOURNAL_LANGUAGE));

  if (open === -1) {
    const separator = markdown.endsWith('\n') || markdown === '' ? '' : '\n';
    return `${markdown}${separator}\n\`\`\`${JOURNAL_LANGUAGE}\n${block.join('\n')}\n\`\`\`\n`;
  }

  let close = lines.length;
  for (let index = open + 1; index < lines.length; index += 1) {
    if (/^\s*(`{3,}|~{3,})\s*$/.test(lines[index] ?? '')) {
      close = index;
      break;
    }
  }

  const date = leadingDate(line);
  let at = close;
  if (date) {
    for (let index = open + 1; index < close; index += 1) {
      const existing = leadingDate(lines[index] ?? '');
      // Only a header line carries a date, so continuation lines of a split are
      // skipped over rather than being inserted between.
      if (existing && existing > date) {
        at = index;
        break;
      }
    }
  }

  return [...lines.slice(0, at), ...block, ...lines.slice(at)].join('\n');
}

function isFenceFor(text: string, language: string): boolean {
  const match = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/.exec(text);
  return match?.[2]?.toLowerCase() === language.toLowerCase();
}

function leadingDate(text: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})\s*\|/.exec(text.trim());
  return match?.[1] ?? null;
}

/**
 * The span of lines one posting occupies, found from any line of it.
 *
 * A simple posting is one line. A split is a header and the indented legs under
 * it, and they are one posting however many lines they take: correcting a leg
 * means rewriting the whole thing, because the header states the total the legs
 * have to sum to.
 *
 * **Any line of the posting finds it**, which matters because a view lists a
 * split as one row per leg, and the row somebody clicks is a leg rather than
 * the header. Walking up from an indented line is what makes clicking either
 * one do the same thing.
 *
 * Lines are one-based and the range is inclusive, matching what a posting
 * reports as its own line.
 */
export function postingBlockAt(
  markdown: string,
  line: number
): { from: number; to: number } | null {
  const lines = markdown.split(/\r?\n/);
  const index = line - 1;
  if (index < 0 || index >= lines.length) return null;

  let from = index;
  while (from > 0 && isContinuation(lines[from])) from -= 1;
  // Walked past the top of the block, or onto a fence: the line given was an
  // orphan continuation, and there is no posting to point at.
  if (isContinuation(lines[from]) || !lines[from]?.trim()) return null;

  let to = from;
  while (to + 1 < lines.length && isContinuation(lines[to + 1])) to += 1;

  return { from: from + 1, to: to + 1 };
}

/** Replaces the posting at `line` with new lines. The rest of the note is untouched. */
export function replacePostingBlock(
  markdown: string,
  line: number,
  block: readonly string[]
): string | null {
  const span = postingBlockAt(markdown, line);
  if (!span) return null;

  const lines = markdown.split(/\r?\n/);
  return [...lines.slice(0, span.from - 1), ...block, ...lines.slice(span.to)].join('\n');
}

/** Takes the posting at `line` out. Returns null when there is nothing there. */
export function removePostingBlock(markdown: string, line: number): string | null {
  return replacePostingBlock(markdown, line, []);
}

/**
 * True for a leg: indented, and not a fence.
 *
 * The fence check matters because a closing fence indented by a formatter would
 * otherwise read as a leg and get swallowed with the posting above it.
 */
function isContinuation(text: string | undefined): boolean {
  if (text === undefined) return false;
  if (/^\s*(`{3,}|~{3,})/.test(text)) return false;
  return /^\s+\S/.test(text);
}
