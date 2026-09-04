/**
 * A trip is a folder, and its bookings live inside it.
 *
 * A trip accumulates a hero picture, a gallery, the supplier PDFs its bookings
 * point at, and an exported sheet. Flat in `Trips/`, those land wherever they
 * happen to. So a new trip note gets a folder named after it and everything
 * belonging to that trip goes beside it.
 *
 * **Nothing moves.** A trip already flat goes on working exactly where it is,
 * because folder matching recurses. That is what makes this a change to where
 * new notes are written and to nothing else -- and it is why the reader has to
 * look in two places rather than one.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  bookingFolderFor,
  bookingReadFolders,
  isInTripBookingsFolder,
  newTripFolder,
  ownedTripFolder,
  tripExportFolder,
} from '../src/trips/trip-folder';

const settings = { ...DEFAULT_SETTINGS };

describe('where a new trip goes', () => {
  it('is a folder of its own, named after the trip', () => {
    expect(newTripFolder(settings, 'Shongololo Express')).toBe('Trips/Shongololo Express');
  });

  it('falls back to the trips folder when the title is blank', () => {
    expect(newTripFolder(settings, '   ')).toBe('Trips');
  });

  /** A blank folder setting must not produce a path rooted at the vault. */
  it('produces nothing rooted at the vault when the trips folder is unset', () => {
    expect(newTripFolder({ ...settings, tripsFolder: '' }, 'Shongololo')).toBe('');
  });
});

describe('which folder a trip owns', () => {
  it('owns the folder named after it', () => {
    expect(ownedTripFolder('Trips/Shongololo/Shongololo.md', 'Shongololo')).toBe(
      'Trips/Shongololo'
    );
  });

  it('owns nothing when it is still flat', () => {
    expect(ownedTripFolder('Trips/Shongololo.md', 'Shongololo')).toBeNull();
  });

  /** A grouping folder belongs to whoever made it, not to the note inside it. */
  it('owns nothing when its folder is named something else', () => {
    expect(ownedTripFolder('Trips/2026/Shongololo.md', 'Shongololo')).toBeNull();
  });
});

describe('where a booking goes', () => {
  const trip = { path: 'Trips/Shongololo/Shongololo.md', basename: 'Shongololo' };

  it('goes inside its trip’s folder', () => {
    expect(bookingFolderFor(settings, trip)).toBe('Trips/Shongololo/Bookings');
  });

  it('goes to the flat folder for a trip that has none of its own', () => {
    const flat = { path: 'Trips/Shongololo.md', basename: 'Shongololo' };

    expect(bookingFolderFor(settings, flat)).toBe('Trips/Bookings');
  });

  it('goes to the flat folder when no trip could be resolved', () => {
    expect(bookingFolderFor(settings, null)).toBe('Trips/Bookings');
  });

  it('goes to the flat folder when the subfolder setting is cleared', () => {
    expect(bookingFolderFor({ ...settings, tripBookingsSubfolder: '' }, trip)).toBe(
      'Trips/Bookings'
    );
  });
});

describe('where bookings are read from', () => {
  /**
   * Both, or half of them vanish: one booking is inside its trip's folder and
   * an older one is in the flat folder.
   */
  it('is the trips folder and the bookings folder', () => {
    expect(bookingReadFolders(settings)).toEqual(['Trips', 'Trips/Bookings']);
  });

  it('drops a blank folder rather than matching everything', () => {
    expect(bookingReadFolders({ ...settings, bookingsFolder: '   ' })).toEqual(['Trips']);
  });

  it('does not list the same folder twice', () => {
    expect(bookingReadFolders({ ...settings, bookingsFolder: 'Trips' })).toEqual(['Trips']);
  });
});

/**
 * The trap this change would otherwise have sprung.
 *
 * The vault check judges a note by the longest configured folder it falls
 * under. A booking at `Trips/Shongololo/Bookings/X.md` falls under the trips
 * folder and under no bookings folder at all, because the configured one is a
 * fixed path that does not contain it. Every nested booking would have been
 * reported as a trip note carrying the wrong type, on the first run after this
 * shipped.
 */
describe('a booking nested inside a trip', () => {
  it('is recognised by the folder it sits in', () => {
    expect(isInTripBookingsFolder('Trips/Shongololo/Bookings/Rovos.md', settings)).toBe(true);
  });

  it('is not confused with the trip note beside it', () => {
    expect(isInTripBookingsFolder('Trips/Shongololo/Shongololo.md', settings)).toBe(false);
  });

  it('is not claimed when the subfolder setting is cleared', () => {
    const off = { ...settings, tripBookingsSubfolder: '' };

    expect(isInTripBookingsFolder('Trips/Shongololo/Bookings/Rovos.md', off)).toBe(false);
  });
});

/**
 * Where a rendering of a trip lands.
 *
 * Apart from the notes, because everything in the exports folder can be
 * deleted and made again from the note and nothing else in a trip's folder
 * can. Both sheets go through this, so a trip's renderings are one place
 * rather than two.
 */
describe('where a trip sheet lands', () => {
  const foldered = { path: 'Trips/Shongololo/Shongololo.md', basename: 'Shongololo' };

  it('is a subfolder of the trip folder', () => {
    expect(tripExportFolder(settings, foldered)).toBe('Trips/Shongololo/Exports');
  });

  /** A flat trip owns no folder, so a sheet stays exactly where it always went. */
  it('is beside the note for a trip that is still flat', () => {
    expect(
      tripExportFolder(settings, { path: 'Trips/Shongololo.md', basename: 'Shongololo' })
    ).toBe('Trips');
  });

  it('is beside the note when the subfolder setting is cleared', () => {
    expect(tripExportFolder({ ...settings, tripExportsSubfolder: '' }, foldered)).toBe(
      'Trips/Shongololo'
    );
  });

  /** A trip note at the vault root has no folder to be beside, and says so rather than producing '/'. */
  it('is the vault root for a note with no folder above it', () => {
    expect(tripExportFolder(settings, { path: 'Shongololo.md', basename: 'Shongololo' })).toBe('');
  });
});
