/**
 * Turning a trip's itinerary into day entries somebody can approve.
 *
 * **Nothing here writes**, the same way the calendar and statement plans do
 * not: a proposal per stop with a status attached, so a preview can show what
 * would happen before it happens.
 *
 * **The same derived key, on purpose.** A stop becomes the line a person would
 * have typed, and it is identified by the day, the start time and the text --
 * `meetingKey`, the core's, the one the calendar import already uses. That is
 * what makes running this twice safe, and it is the same guarantee section D of
 * `calendar-import.md` argued for: nothing is written into a note to mark it as
 * seeded, so a note that has never been seeded is indistinguishable from one
 * that has.
 *
 * **And no archive, which is the one place this is simpler than the two it
 * copies.** The calendar import keeps its `.ics` so a later run can replay what
 * an earlier export offered; a trip note is still in the vault and still says
 * what it said, so the replay is a re-read. Nothing here should grow an archive
 * out of symmetry.
 *
 * **It never removes a line.** A stop dropped from a trip leaves whatever was
 * written for it, exactly as a meeting gone from an export does. Somebody
 * deletes it, having looked.
 *
 * App-free and clock-free.
 */
import { meetingKey, type ExistingEntry } from '@technosoftware/trail-core';
import type { TripItinerary, TripStop } from './read-trip-itinerary';

export type TripProposalStatus =
  /** Not in the note. Would be written. */
  | 'new'
  /** A line on that day already says this. Nothing to do. */
  | 'already-present'
  /** An earlier stop of this same trip would write the identical line. */
  | 'duplicate-in-file'
  /** `optional: true` without `chosen: true`. An offer is not a plan. */
  | 'not-chosen'
  /** Neither a date nor a day number the trip's departure could resolve. */
  | 'undated';

/** The statuses that would put a line in a note. Everything else is shown and skipped. */
const WRITES = new Set<TripProposalStatus>(['new']);

export interface TripProposal {
  /** The trip note's title, which becomes the line's context link. */
  trip: string;
  /** ISO day, or empty for a stop nothing can place. */
  day: string;
  from: string;
  to: string;
  text: string;
  /** Carried for the preview, and for the child lines section D.5 will add. Not on the line yet. */
  place: string;
  excursion: string;
  persons: readonly string[];
  /** Empty for a proposal with no day, which has nothing to be identified by. */
  key: string;
  status: TripProposalStatus;
  /** True for the statuses that would write. Derived from `status`, for a view that filters. */
  writes: boolean;
}

export interface TripImportPlan {
  proposals: TripProposal[];
  /**
   * Every day a write would touch, sorted.
   *
   * What would actually be touched rather than the trip's own span: a trip may
   * hold stops on three of its twelve days, and a preview naming the span would
   * be overstating what it is about to do.
   */
  days: string[];
  toWrite: number;
  alreadyPresent: number;
  /** Proposals a person should look at: offered but not taken, undated, or said twice. */
  skipped: number;
}

export interface TripImportOptions {
  trip: TripItinerary;
  /** Every line the vault holds on the days this could touch. */
  existing: readonly ExistingEntry[];
}

function statusOf(
  stop: TripStop,
  key: string,
  present: ReadonlySet<string>,
  proposed: ReadonlySet<string>
): TripProposalStatus {
  // The order is the design, and it is the calendar plan's: a rule that cannot
  // be honoured stops first, then a line already saying it, then a duplicate
  // within this run, then new. An undated stop is checked before the optional
  // one on purpose -- a stop that is both is reported as the thing that no
  // setting can fix.
  if (!stop.day) return 'undated';
  if (stop.offered) return 'not-chosen';
  if (present.has(key)) return 'already-present';
  if (proposed.has(key)) return 'duplicate-in-file';
  return 'new';
}

/**
 * What seeding this trip would do.
 *
 * `existing` is every line the caller found on the days in question, reduced to
 * the three things a key is derived from. Deliberately less than the reader
 * that produces it knows, so no part of the entry model has to be restated here
 * to be compared.
 */
export function planTripImport(options: TripImportOptions): TripImportPlan {
  const present = new Set(
    options.existing.map((entry) => meetingKey(entry.day, entry.from, entry.text))
  );
  const proposed = new Set<string>();
  const proposals: TripProposal[] = [];

  for (const stop of options.trip.stops) {
    const key = stop.day ? meetingKey(stop.day, stop.from, stop.text) : '';
    const status = statusOf(stop, key, present, proposed);
    if (status === 'new') proposed.add(key);

    proposals.push({
      trip: options.trip.title,
      day: stop.day ?? '',
      from: stop.from,
      to: stop.to,
      text: stop.text,
      place: stop.place,
      excursion: stop.excursion,
      // The trip's travellers where the stop names nobody, because a stop that
      // says nothing about who goes is one everybody goes on.
      persons: stop.persons.length > 0 ? stop.persons : options.trip.persons,
      key,
      status,
      writes: WRITES.has(status),
    });
  }

  const days = [...new Set(proposals.filter((one) => one.writes).map((one) => one.day))].sort();

  return {
    proposals,
    days,
    toWrite: proposals.filter((one) => one.writes).length,
    alreadyPresent: proposals.filter((one) => one.status === 'already-present').length,
    skipped: proposals.filter((one) => !one.writes && one.status !== 'already-present').length,
  };
}
