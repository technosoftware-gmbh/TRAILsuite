/**
 * A note under a task, for why it was closed the way it was.
 *
 * "Done" says nothing about what actually happened, and the tasks somebody
 * wonders about six months later are exactly the ones where it mattered: the
 * quote that came back at three times the estimate, the thing that turned out
 * to be somebody else's job.
 *
 * **The task line itself is never touched.** The comment is one or more lines
 * indented underneath it, which is ordinary Markdown and which the Tasks
 * plugin, Dataview and every other reader of the same vault ignore completely.
 * That is the whole reason for this shape: the checkbox line is not a format
 * this codebase owns, and appending a field of our own invention to somebody
 * else's format would show up as part of the task's description in every other
 * view in the vault.
 *
 * The cost is stated rather than hidden: a comment written this way is prose
 * under a bullet and is not queryable as a field. Anything that wants to find
 * these has to scan for them, which is what `taskComment()` is.
 *
 * App-free.
 */
import { parseTaskLine } from './line.js';
import type { LocatedTask } from './types.js';

/** How far a comment is indented past the task's own bullet. Two spaces reads as a continuation in every renderer. */
const STEP = '  ';

/**
 * How deep a line is indented, in spaces, counting a tab as four.
 *
 * Four because that is what Obsidian's editor inserts, and because the only
 * thing this number is used for is comparing one line against another in the
 * same file, where being consistent matters and being exactly right does not.
 */
function depth(line: string): number {
  const leading = /^[ \t]*/.exec(line)?.[0] ?? '';
  return [...leading].reduce((total, char) => total + (char === '\t' ? 4 : 1), 0);
}

/**
 * The lines belonging to a task's comment: the run directly under it, indented
 * deeper, that are not themselves checkbox lines.
 *
 * **A nested task ends the run rather than joining it.** A sub-task is a task,
 * and swallowing one into its parent's comment would mean a later write put it
 * back as prose -- silently turning somebody's checkbox into a sentence.
 *
 * A blank line ends it too. Inside a list item a blank line is legal Markdown,
 * but it is also how somebody separates a task from whatever comes next, and
 * reading past one risks claiming a paragraph that was never about this task.
 */
export function taskCommentRange(
  lines: readonly string[],
  task: LocatedTask
): { from: number; to: number } {
  const base = depth(task.raw);
  const from = task.line + 1;

  let to = from;
  while (to < lines.length) {
    const line = lines[to] ?? '';
    if (line.trim() === '') break;
    if (depth(line) <= base) break;
    if (parseTaskLine(line)) break;
    to += 1;
  }

  return { from, to };
}

/** The comment as it reads, with its indentation removed, or null when there is none. */
export function taskComment(text: string, task: LocatedTask): string | null {
  const lines = text.split('\n');
  const { from, to } = taskCommentRange(lines, task);
  if (to === from) return null;

  return lines
    .slice(from, to)
    .map((line) => line.trim())
    .join('\n');
}

/**
 * The note's text with this task's comment set, replaced, or removed.
 *
 * Replaced rather than appended: a comment is the current answer to "why did
 * this end like that", and a task closed twice should not accumulate two of
 * them. Passing an empty comment removes the block, which is how one is
 * cleared.
 *
 * **A blank line inside a comment is dropped rather than kept.** Keeping one
 * would mean writing a line of nothing but indentation, and an editor set to
 * trim trailing whitespace turns that into a truly empty line -- which ends the
 * block on the next read and orphans everything under it. A comment survives
 * that editor as several consecutive lines and does not survive it as
 * paragraphs, so it is several consecutive lines. Somebody who wants a
 * paragraph break has the note itself.
 */
export function withTaskComment(text: string, task: LocatedTask, comment: string): string {
  const lines = text.split('\n');
  const { from, to } = taskCommentRange(lines, task);
  const body = comment.trim();

  const written = body
    ? body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => `${task.indent}${STEP}${line}`)
    : [];

  return [...lines.slice(0, from), ...written, ...lines.slice(to)].join('\n');
}
