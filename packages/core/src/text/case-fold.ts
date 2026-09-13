/**
 * One spelling of a name, so that two of them can be compared.
 *
 * macOS writes an umlaut two ways. A file name typed into Finder or into
 * Obsidian's rename box tends to carry a decomposed letter, an "a" followed by
 * a combining diaeresis; text pasted from a browser, an invoice or an operator's
 * brochure carries the single composed character. The two are the same word to
 * a reader and the same note to Obsidian, and two different strings to `===`.
 *
 * **This is why the fold is one function rather than a habit.** In a vault of
 * 1866 notes, 40 had a decomposed file name, all of them meals, and every plan
 * entry naming one of them resolved to nothing: the index was keyed on the
 * file's basename and looked up with the text out of somebody's frontmatter. The
 * symptom is a row with no picture and no nutrients, which looks exactly like a
 * meal note that was never written. Nothing in three packages normalized, and
 * 65 places trimmed and lower-cased on their own.
 *
 * **Compose first, then lower.** One composed letter goes in and one comes out,
 * where lowering a decomposed pair would leave the combining mark behind to be
 * compared against a letter that no longer has one.
 *
 * Fold anything a person typed and a person is going to type again somewhere
 * else: a note title, a link target, a heading, a cabin category, a tag, a
 * property name, a search query. On an ASCII value it is `trim().toLowerCase()`
 * exactly, because composing leaves ASCII alone, and that is what makes it safe
 * to reach for everywhere instead of only where an umlaut is expected. A nullish
 * value folds to the empty string, so a caller comparing two optional names does
 * not have to decide first whether absent equals absent.
 */
export function caseFold(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFC').trim().toLowerCase();
}
