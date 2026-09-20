/**
 * The chips a day entry's links become.
 *
 * Kept apart from the resolving in `vault/link-kind.ts` for the split every
 * other pair here makes: what the vault says is testable without a language,
 * and what a person reads is testable without a vault.
 *
 * **A kind this cannot name is drawn as the bare title, not as a guess and not
 * as nothing.** The link is in the note and the reader should see it; what is
 * missing is only the word in front of it. That is the same fallback an
 * unresolved link lands on, and deliberately so: to somebody looking at the
 * day, "we have no label for this" and "that note does not exist yet" are the
 * same amount of information.
 */
import { t } from '../../lang/I18nManager';
import type { LinkedNote } from '../../vault/link-kind';

/** `Projekt: Q3 Finanzen`, or `Gifthüttli` when nothing names the kind. */
export function linkChipLabel(note: LinkedNote): string {
  if (!note.kind) return note.title;
  return `${t(`day.linkKind.${note.kind}`)}: ${note.title}`;
}

/** The labels for a line's links, in the order the line spells them. */
export function linkChipLabels(notes: readonly LinkedNote[]): string[] {
  return notes.map(linkChipLabel);
}
