/**
 * The weight of one serving, however a note happens to spell it.
 *
 * `440g`, `440 g` and `440` all mean the same weight, and a note gets to keep
 * whichever of the three somebody typed. Reading them as one is the rule, and
 * it lives in its own module for the same reason `per100g.ts` next door does:
 * two callers need the same answer to the same question and have no business
 * answering it twice. The editor is one of them, and the other is
 * `scripts/strip-default-serving-size.ts`, which has to decide whether two
 * spellings of a weight are the same weight before it deletes one of them.
 *
 * **Nothing here reaches Obsidian**, which is what makes it importable from a
 * script at all. The reader used to sit inside `editor/read-draft.ts`, and that
 * file pulls in the vault host, so a script importing it got a module resolution
 * failure rather than a parser. A second implementation in the script would
 * have started out agreeing with this one and would have gone on to disagree,
 * and the disagreement would have shown up as somebody's only serving weight
 * going missing.
 */
import { readNumberLike, readString } from 'trail-core';

/** `440g`, `440 g` and `440` all mean the same weight. */
export function readGrams(value: unknown): number | null {
  const text = readString(value);
  if (text === null) return readNumberLike(value);

  const match = /(-?[\d.]+)/.exec(text);
  return match ? readNumberLike(match[1]) : null;
}
