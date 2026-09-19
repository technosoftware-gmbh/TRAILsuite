/**
 * A trip is a folder.
 *
 * A trip accumulates more than a note: a hero picture, a gallery, the supplier
 * PDFs its bookings point at, and -- once it exists -- an exported sheet. Flat
 * in `Trips/`, those land wherever they happen to, and the connection between a
 * trip and its things is only the links inside the note.
 *
 * So a new trip note lives in a folder named after it, and everything belonging
 * to that trip lives beside it. NODAtrail answered the same question for
 * projects in August and this is the same answer, reached separately: the
 * licence boundary means two PolyForm packages may not share a file any more
 * than either may share one with the GPL package.
 *
 * **Nothing moves.** A trip already flat in `Trips/` goes on working exactly
 * where it is, because folder matching recurses: a reader given `Trips` finds a
 * note one level down and a note three levels down alike. That is what makes
 * this a change to where new notes are *written* and to nothing else.
 *
 * App-free: it computes paths and touches no vault.
 */
import type { APERtrailSettings } from '../settings/types';

/** Where a new trip note goes: a folder of its own, named after the trip. */
export function newTripFolder(settings: APERtrailSettings, title: string): string {
  const trips = settings.tripsFolder.trim();
  const name = title.trim();
  if (!trips || !name) return trips;
  return `${trips}/${name}`;
}

/**
 * The folder a note owns, or null.
 *
 * A trip owns the folder it sits in when that folder is named after it. A trip
 * still flat in `Trips/` owns nothing, and neither does one somebody filed into
 * a grouping folder of their own -- `Trips/2026/Shongololo.md` is in a folder
 * called `2026`, which belongs to the year rather than to the trip.
 */
export function ownedTripFolder(notePath: string, noteBasename: string): string | null {
  const cut = notePath.lastIndexOf('/');
  if (cut === -1) return null;

  const folder = notePath.slice(0, cut);
  const folderName = folder.slice(folder.lastIndexOf('/') + 1);
  return folderName === noteBasename.trim() ? folder : null;
}

/**
 * Where a booking for this trip belongs.
 *
 * Inside the trip's own folder when it has one, so everything about a trip is
 * in one place, which is the whole point of the folder. A trip that is still
 * flat has nowhere of its own to put one, so its bookings go to the configured
 * bookings folder exactly as they always did.
 *
 * **Both are read**, so neither answer strands a note: see
 * `bookingReadFolders`.
 */
export function bookingFolderFor(
  settings: APERtrailSettings,
  trip: { path: string; basename: string } | null
): string {
  const subfolder = settings.tripBookingsSubfolder.trim();
  const owned = trip ? ownedTripFolder(trip.path, trip.basename) : null;
  if (!owned || !subfolder) return settings.bookingsFolder;
  return `${owned}/${subfolder}`;
}

/**
 * Every folder a booking might be in.
 *
 * The trips folder covers every booking under every trip's own folder, and the
 * configured bookings folder covers the flat ones -- including a vault that
 * moved that folder outside `Trips/` entirely, which the trips folder alone
 * would miss. Blank entries are dropped rather than matching everything, which
 * is the direction every unconfigured folder here fails in.
 *
 * **The archive is the third**, because a trip that owns its folder travels as
 * that folder and its bookings go with it. Reading only the two live folders
 * would leave a retired trip on the board with its costs quietly gone.
 */
export function bookingReadFolders(settings: APERtrailSettings): string[] {
  const folders = [
    settings.tripsFolder.trim(),
    settings.bookingsFolder.trim(),
    tripArchiveFolder(settings) ?? '',
  ];
  return [...new Set(folders.filter((folder) => folder !== ''))];
}

/**
 * True when a path sits in a folder named as the bookings subfolder.
 *
 * The health check judges a note by the longest configured folder it falls
 * under, and a booking at `Trips/Shongololo/Bookings/X.md` falls under the
 * trips folder and under no bookings folder at all -- so without this it would
 * be reported as a trip note carrying the wrong type. Every one of them, on the
 * first run after this shipped.
 *
 * **A cleared subfolder needs no guard of its own.** It leaves the comparison
 * asking whether a parent folder is named '', which no real folder is. An
 * explicit early return read like the one in `bookingFolderFor` above, where it
 * does decide something, and passed with it deleted -- so it is not here.
 */
export function isInTripBookingsFolder(path: string, settings: APERtrailSettings): boolean {
  const subfolder = settings.tripBookingsSubfolder.trim();
  const cut = path.lastIndexOf('/');
  if (cut === -1) return false;

  const folder = path.slice(0, cut);
  return folder.slice(folder.lastIndexOf('/') + 1) === subfolder;
}

/**
 * Where archived trips live, or null when the archive is switched off.
 *
 * Null rather than a blank string, which is the answer `archiveFolderFor()`
 * gives in NODAtrail and for the same reason: a blank folder read as the vault
 * root would claim every note there is, so an archive nobody configured has to
 * be absent rather than empty.
 */
export function tripArchiveFolder(settings: APERtrailSettings): string | null {
  const root = settings.archiveFolder.trim();
  const category = settings.tripsArchiveFolder.trim();
  if (!root || !category) return null;
  return `${root}/${category}`;
}

/**
 * Where a trip archived today goes: the category folder, then a year when the
 * vault asked for one.
 *
 * **The year is when it was archived**, not when the trip ran. This is the
 * shelf a thing is put on, and the day it was put there is the one fact the
 * move itself knows. NODAtrail reached the same answer for projects.
 */
export function tripArchiveFolderOn(settings: APERtrailSettings, today: Date): string | null {
  const base = tripArchiveFolder(settings);
  if (!base || !settings.archiveYearFolders) return base;
  return `${base}/${today.getFullYear()}`;
}

/**
 * Every folder a trip might be in.
 *
 * **Both, in one read**, where NODAtrail keeps its live and archived queries
 * apart and lets each view choose. The difference is deliberate and it is about
 * visits: a city's `visited` and `lastVisit` are derived from the trips that
 * stopped there, so an archived trip dropped from the board would take the
 * evidence of a real journey with it and quietly un-visit the places it went
 * to. A retired trip is still a trip that happened. It comes back marked, and
 * the surfaces that should not show it filter on that mark.
 */
export function tripReadFolders(settings: APERtrailSettings): string[] {
  const folders = [settings.tripsFolder.trim(), tripArchiveFolder(settings) ?? ''];
  return [...new Set(folders.filter((folder) => folder !== ''))];
}

/**
 * True when a path sits inside the trip archive.
 *
 * Asked of the category folder rather than of this year's, so a trip already
 * filed under `6 Archive/Trips/2025` reads as archived instead of being dragged
 * forward into the current year and restamped.
 */
export function isArchivedTripPath(path: string, settings: APERtrailSettings): boolean {
  const archive = tripArchiveFolder(settings);
  if (!archive) return false;
  return path === archive || path.startsWith(`${archive}/`);
}
