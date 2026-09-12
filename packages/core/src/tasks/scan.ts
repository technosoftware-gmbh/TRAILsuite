/**
 * Finding the checkbox lines in a note's text, and putting one back.
 *
 * Line-based rather than parsed as a document, deliberately: a task line is
 * defined by what it looks like at the start of a line, and a Markdown parse
 * would buy nothing except disagreements with whatever renders the note.
 *
 * **Fenced code blocks are skipped.** A shell transcript or a YAML sample
 * inside a fence is not a to-do list, and a scan that claimed those lines
 * would put somebody's example code on their agenda.
 *
 * App-free.
 */
import { parseTaskLine } from './line.js';
import type { LocatedTask } from './types.js';

/** ``` or ~~~ at the start of a line, opening or closing a fence. */
const FENCE = /^\s*(```|~~~)/;

/** Every checkbox line in a note, with the line number it sits on. */
export function scanTasks(text: string): LocatedTask[] {
  const lines = text.split('\n');
  const found: LocatedTask[] = [];

  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const task = parseTaskLine(line);
    if (task) found.push({ ...task, line: index });
  }

  return found;
}

/**
 * A note's text with one line replaced.
 *
 * By line number rather than by matching the old text, because two identical
 * task lines in one note are a thing people write, and a replace-by-content
 * would tick both.
 *
 * The text is handed back unchanged when the line number is out of range or
 * the line there is not the one the caller thinks it is. That guard is not
 * theoretical: a view holds a task it scanned a moment ago, and the note may
 * have been edited in another tab since.
 */
export function replaceTaskLine(text: string, task: LocatedTask, replacement: string): string {
  const lines = text.split('\n');
  if (lines[task.line] !== task.raw) return text;

  lines[task.line] = replacement;
  return lines.join('\n');
}
