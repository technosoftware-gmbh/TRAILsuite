/**
 * What a money note is called.
 *
 * A purchase, an invoice and a recurring cost all arrive already identified: a
 * day, a company, and a number one of them gave it. Asking somebody to invent a
 * title on top of that is asking them to name a thing that has a name, and
 * forty notes later the folder sorts by whatever mood each title was typed in.
 * So the name is derived, in one shape for all three:
 * `20260604_baloise_1000000001`.
 *
 * The three differ only in which day they are about, and each form supplies its
 * own: an invoice its issue date, a purchase its order date, a recurring cost
 * the day the arrangement starts.
 *
 * **A typed title still wins.** Derivation is the default, not the rule: a
 * document with two references, or none, or a name somebody wants to recognise
 * at a glance, is exactly the case a form must not argue with. Emptying the
 * field hands the derivation back, which is why "typed" is stored as the text
 * itself rather than as a flag that would have to be cleared separately.
 *
 * Pure, so the rule can be tested without an Obsidian dialog around it.
 */
import { financeNoteStem } from '@technosoftware/trail-core';
import { dateOf } from './paths';

/** The facts a money note's name is derived from. */
export interface NoteNaming {
  /** The day the note is about. Which day that is, is the form's business. */
  date: string | null;
  company: string;
  reference: string;
}

export function derivedNoteTitle(facts: NoteNaming): string {
  return financeNoteStem(dateOf(facts.date), facts.company, facts.reference);
}

/**
 * The title to use: what somebody typed, or the derived name when they typed
 * nothing.
 *
 * Empty when neither exists, which is a note with no date, no company and no
 * reference. The form refuses to save that, because a note called nothing is
 * one nobody finds again.
 */
export function noteTitle(typed: string, facts: NoteNaming): string {
  return typed.trim() || derivedNoteTitle(facts);
}
