/**
 * Which date a status is about, and what changing the status does to it.
 *
 * Five dates are worth keeping on a piece of work: when it was **created**,
 * when it is **due**, when the work was **done**, when it was **closed**, and
 * when it was **archived**. Three of those are the record of a moment, and the
 * plugin knows the moment: it is the day somebody moved the status.
 *
 * **So the status fills the date, and the form shows it.** Filled rather than
 * written behind somebody's back -- the field is right there on the same form,
 * pre-filled with today, and the save is what commits it. That matters because
 * the day of the action and the day of the record routinely differ: a project
 * finished on Friday gets its status moved on Monday, and Monday is the wrong
 * answer.
 *
 * **Moving away from a status clears the date it filled.** A project pulled
 * back from Erledigt to Laufend is not a project that was finished on a day; it
 * is one that is not finished. Leaving the date would leave the note asserting
 * two contradictory things, and the contradiction would outlive anybody's
 * memory of the correction.
 *
 * `archived` is not here: archiving is a move rather than a status, and the
 * stamp goes on in `archive.ts` where the move happens.
 *
 * Pure.
 */
import type { ParaStatus } from './types';

/** The date field a status is the record of, or null for a status that records nothing. */
export function dateFieldFor(status: ParaStatus): 'done' | 'closed' | null {
  if (status === 'done') return 'done';
  if (status === 'closed') return 'closed';
  return null;
}

export interface StatusDates {
  /** `completed` on a project, `achieved` on a goal. Both mean: the work is finished. */
  done: string | null;
  closed: string | null;
}

/**
 * The dates after a status has moved from `before` to `after`.
 *
 * `today` is only used for a field the move fills. A date already set is left
 * exactly as it is -- somebody who corrected one and then reopened and
 * re-closed a project should not have their correction quietly replaced with
 * today's date.
 */
export function datesAfterStatus(
  dates: StatusDates,
  before: ParaStatus,
  after: ParaStatus,
  today: string
): StatusDates {
  if (before === after) return dates;

  const next: StatusDates = { ...dates };

  // Cleared first, so a move from `done` straight to `closed` gives up the done
  // date rather than keeping a claim the new status has superseded... except it
  // has not: closing something does not unfinish it. Only leaving both.
  const leaving = dateFieldFor(before);
  if (leaving && !isStillTrue(leaving, after)) next[leaving] = null;

  const arriving = dateFieldFor(after);
  if (arriving && next[arriving] === null) next[arriving] = today;

  return next;
}

/**
 * Whether a date filled by an earlier status still says something true.
 *
 * A closed project is still a project whose work was done, so moving from
 * `done` to `closed` keeps the done date. Moving back to `ongoing` does not:
 * nothing is finished any more.
 */
function isStillTrue(field: 'done' | 'closed', after: ParaStatus): boolean {
  if (field === 'done') return after === 'closed' || after === 'review';
  return false;
}
