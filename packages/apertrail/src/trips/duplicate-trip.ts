/**
 * A trip, copied so the copy can be cut down.
 *
 * The same journey often exists twice: a twelve-day version and a shorter one
 * over the same ground. Retyping forty stops to delete eight of them is the
 * kind of work a plugin should not ask for, and `removeDay()` already makes the
 * cutting down cheap. This is the other half.
 *
 * **The copy is a plan, not a record.** The route comes across whole -- days,
 * stops, stays, transport, the budget, the highlights and the overview. The
 * dates, the status, the rating and the review do not, and that is the decision
 * this file exists to hold rather than a convenience.
 *
 * The reason is what a trip means to everything else in the vault. A trip's
 * stops derive visits on the places they name, so a duplicate carrying
 * `travelStatus: Over` and last month's dates would silently claim you had been
 * to Kimberley twice, and would move the last-visit date on every place on it.
 * A copy is a thing somebody is about to plan; it has not happened, and saying
 * otherwise is a bad write into notes that are somebody's records.
 *
 * Nothing here decides where the copy is stored or copies a single byte. It
 * takes the input shape the writer already understands and returns another one.
 * `ui/duplicate-trip.ts` does the vault.
 */
import type { TripInput } from './write-trip';

/** Where the original's own folder is, and where the copy's is, so pictures can follow. */
export interface TripRehome {
  /** The original trip's owned folder, or null when it is still flat in `Trips/`. */
  from: string | null;
  /** The copy's folder. Null when the copy has none of its own either. */
  to: string | null;
}

/**
 * A picture path, moved to the copy's folder when it belonged to the original's.
 *
 * **Only a path under `from/` is rewritten.** Anything else is left exactly as
 * written: an external URL has no folder, and a picture the vault keeps
 * somewhere shared is deliberately shared -- rewriting it would point the copy
 * at a file that was never created. The test for "belonged to the original" is
 * the same `folder + '/'` prefix the readers use, so a sibling folder whose
 * name merely starts the same way is not caught by it.
 *
 * A trip still flat in `Trips/` owns no folder, so nothing of its is rewritten
 * and both trips go on naming the same files. That is the honest answer for a
 * trip that never had a folder to keep them in.
 */
export function rehomePicture(value: string, rehome: TripRehome): string {
  const { from, to } = rehome;
  if (!from || !to) return value;

  const prefix = `${from}/`;
  return value.startsWith(prefix) ? `${to}/${value.slice(prefix.length)}` : value;
}

/** Every picture the trip names that lives in its own folder, as paths relative to it. */
export function ownedPictures(input: TripInput, from: string | null): string[] {
  if (!from) return [];

  const prefix = `${from}/`;
  const named = [input.image, ...input.gallery.map((picture) => picture.image)];
  const owned = named
    .filter((value): value is string => typeof value === 'string' && value.startsWith(prefix))
    .map((value) => value.slice(prefix.length));

  // A gallery may name one file twice, and copying it twice is a wasted read
  // and a race with itself.
  return [...new Set(owned)];
}

/**
 * The copy, as the writer's input shape.
 *
 * What is cleared is the whole of the decision here, so it is listed rather
 * than spread over: **departure, return, travelStatus, reviewStatus, rating**.
 *
 * They are set to null rather than to a value. An absent `travelStatus` is not
 * a missing one: `effectiveTravelStatus()` reads a trip with no status and no
 * dates as Planned, which is exactly what the copy is, and writing `Planned`
 * into the note would be storing something the note can already derive. Nothing
 * derived is written back, here as everywhere else.
 *
 * Day numbers survive untouched, which is the point of them. The copy is a
 * twelve-day itinerary with no calendar against it; give it a departure and the
 * whole thing resolves at once, and `removeDay()` renumbers what is left.
 */
export function duplicateTripInput(input: TripInput, rehome: TripRehome): TripInput {
  return {
    ...input,
    departure: null,
    return: null,
    travelStatus: null,
    reviewStatus: null,
    rating: null,
    image: input.image === null ? null : rehomePicture(input.image, rehome),
    gallery: input.gallery.map((picture) => ({
      ...picture,
      image: rehomePicture(picture.image, rehome),
    })),
    // Deep-copied so the two inputs cannot share an array. The caller reads the
    // original from the vault and could go on using it.
    highlights: [...input.highlights],
    cityTitles: [...input.cityTitles],
    personTitles: [...input.personTitles],
    days: input.days.map((day) => ({ ...day })),
    stops: input.stops.map((stop) => ({ ...stop, persons: [...stop.persons] })),
    nights: input.nights.map((night) => ({ ...night, persons: [...night.persons] })),
    transport: input.transport.map((leg) => ({ ...leg, persons: [...leg.persons] })),
    budget: input.budget.map((line) => ({ ...line })),
    rates: input.rates.map((rate) => ({ ...rate })),
  };
}

/**
 * A name for the copy that does not collide, as a starting point somebody edits.
 *
 * `Trip (2)`, then `(3)`, counting past whatever exists. Deliberately not a
 * word: the suffix is shown in a text box the user is expected to replace with
 * the real name of the shorter version, and a number says "this is a placeholder"
 * in every language the plugin ships.
 */
export function duplicateTitle(title: string, taken: readonly string[]): string {
  const base = title.trim();
  if (!base) return base;

  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
