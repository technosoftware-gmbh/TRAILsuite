/**
 * Retiring a trip, and what a retired trip still is.
 *
 * The behaviour worth pinning down is not the move. It is what survives the
 * move: this feature exists because five finished trips were dragged into an
 * archive folder by hand and APERtrail, which read only its live folder, then
 * reported five cities as never visited. The evidence of a real journey is not
 * something a filing decision may delete, so the first suite here is about the
 * board and only the second is about the file.
 *
 * The guards are the ones NODAtrail's `para/archive.ts` arrived at, tested for
 * the same reasons: a trip already in the archive is a no-op rather than a
 * restamp, and a destination that is occupied throws rather than clobbering a
 * note somebody else's trip shares a title with.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  archiveTrip,
  ArchiveNotConfiguredError,
  DestinationExistsError,
  NotATripError,
  unarchiveTrip,
} from '../src/trips/archive-trip';
import { readTravelBoard } from '../src/vault/read-entities';
import { makeFakeVault, FakeNote } from './fake-vault';

const settings = DEFAULT_SETTINGS;
const ARCHIVE = '6 Archive/Trips';

/** A city, and a finished trip that stopped there. The city carries no visit of its own, which is the case that matters. */
function vaultWithTripAt(tripPath: string): FakeNote[] {
  return [
    { path: `${settings.citiesFolder}/Basel.md`, frontmatter: { type: 'city', visited: false } },
    {
      path: tripPath,
      frontmatter: {
        type: 'trip',
        cities: ['[[Basel]]'],
        // A stop and not just the `cities:` scope: a visit is derived from
        // where a trip STOPPED, which is the evidence archiving used to throw
        // away. See vault/visit-derivation.ts.
        stops: [{ place: '[[Basel]]', from: '2026-02-26T09:30' }],
        departure: '2026-02-26T08:30',
        return: '2026-02-26T14:30',
        travelStatus: 'Over',
      },
    },
  ];
}

describe('an archived trip on the board', () => {
  it('is read, and says it is archived', () => {
    const { app } = makeFakeVault(vaultWithTripAt(`${ARCHIVE}/Kurztrip nach Basel.md`));
    const board = readTravelBoard(app, settings, '2026-09-19');

    expect(board.trips).toHaveLength(1);
    expect(board.trips[0].archived).toBe(true);
  });

  /**
   * The whole reason the archive is read rather than skipped. A city says
   * `visited: false` and the trip is the only evidence otherwise; dropping the
   * trip would quietly un-visit a place somebody has been to.
   */
  it('still counts as a visit to the cities it went to', () => {
    const { app } = makeFakeVault(vaultWithTripAt(`${ARCHIVE}/Kurztrip nach Basel.md`));
    const basel = readTravelBoard(app, settings, '2026-09-19').cities[0];

    expect(basel.visited).toBe(true);
    expect(basel.visitedFromTrips).toBe(true);
  });

  it('carries the stamp when it has one, and is archived without it', () => {
    const notes = vaultWithTripAt(`${ARCHIVE}/Kurztrip nach Basel.md`);
    const { app } = makeFakeVault(notes);
    expect(readTravelBoard(app, settings, '2026-09-19').trips[0].archivedOn).toBeNull();

    notes[1].frontmatter.archived = '2026-09-19';
    const stamped = makeFakeVault(notes);
    const trip = readTravelBoard(stamped.app, settings, '2026-09-19').trips[0];
    expect(trip.archived).toBe(true);
    expect(trip.archivedOn).toBe('2026-09-19');
  });

  it('is an ordinary live trip while it sits in the trips folder', () => {
    const { app } = makeFakeVault(
      vaultWithTripAt(`${settings.tripsFolder}/Kurztrip nach Basel.md`)
    );
    expect(readTravelBoard(app, settings, '2026-09-19').trips[0].archived).toBe(false);
  });
});

describe('archiveTrip', () => {
  it('moves the note and stamps the day', async () => {
    const live = `${settings.tripsFolder}/Kurztrip nach Basel.md`;
    const { app, moved, frontmatterAt } = makeFakeVault(vaultWithTripAt(live));
    const file = app.vault.getMarkdownFiles().find((f) => f.path === live);

    const outcome = await archiveTrip(app, settings, file, new Date('2026-09-19T10:00:00Z'));

    expect(outcome.moved).toBe(true);
    expect(outcome.path).toBe(`${ARCHIVE}/Kurztrip nach Basel.md`);
    expect(moved).toEqual([{ from: live, to: `${ARCHIVE}/Kurztrip nach Basel.md` }]);
    expect(frontmatterAt(`${ARCHIVE}/Kurztrip nach Basel.md`)?.archived).toBe('2026-09-19');
  });

  /**
   * A trip owns the folder it sits in when that folder is named after it, and
   * archiving it moves the folder so its bookings and its pictures go too.
   */
  it('takes the trip folder with it, bookings and all', async () => {
    const { app, moved } = makeFakeVault([
      {
        path: `${settings.tripsFolder}/Shongololo/Shongololo.md`,
        frontmatter: { type: 'trip' },
      },
      {
        path: `${settings.tripsFolder}/Shongololo/Bookings/Rovos.md`,
        frontmatter: { type: 'booking' },
      },
    ]);
    const file = app.vault
      .getMarkdownFiles()
      .find((f) => f.path.endsWith('Shongololo/Shongololo.md'));

    const outcome = await archiveTrip(app, settings, file, new Date('2026-09-19T10:00:00Z'));

    expect(moved).toEqual([
      { from: `${settings.tripsFolder}/Shongololo`, to: `${ARCHIVE}/Shongololo` },
    ]);
    // The note's own path, not the folder's, so the caller can still open it.
    expect(outcome.path).toBe(`${ARCHIVE}/Shongololo/Shongololo.md`);

    const board = readTravelBoard(app, settings, '2026-09-19');
    expect(board.trips[0].archived).toBe(true);
    expect(board.bookings).toHaveLength(1);
  });

  /**
   * Asked of the category folder, not of this year's. A trip already filed
   * under `6 Archive/Trips/2025` is archived; testing it against the current
   * year would drag it forward and restamp something already where it belonged.
   */
  it('does nothing to a trip already in the archive', async () => {
    const path = `${ARCHIVE}/2025/Kurztrip nach Basel.md`;
    const { app, moved } = makeFakeVault(vaultWithTripAt(path));
    const file = app.vault.getMarkdownFiles().find((f) => f.path === path);

    const outcome = await archiveTrip(
      app,
      { ...settings, archiveYearFolders: true },
      file,
      new Date('2026-09-19T10:00:00Z')
    );

    expect(outcome.moved).toBe(false);
    expect(moved).toEqual([]);
  });

  it('files under a year when the vault asked for one', async () => {
    const live = `${settings.tripsFolder}/Kurztrip nach Basel.md`;
    const { app, moved } = makeFakeVault(vaultWithTripAt(live));
    const file = app.vault.getMarkdownFiles().find((f) => f.path === live);

    await archiveTrip(
      app,
      { ...settings, archiveYearFolders: true },
      file,
      new Date('2026-09-19T10:00:00Z')
    );

    expect(moved[0].to).toBe(`${ARCHIVE}/2026/Kurztrip nach Basel.md`);
  });

  /** Two trips sharing a title is a thing a vault has; a silent clobber of one of them is not a failure mode worth having. */
  it('refuses rather than overwriting what is already there', async () => {
    const live = `${settings.tripsFolder}/Kurztrip nach Basel.md`;
    const { app, moved } = makeFakeVault([
      ...vaultWithTripAt(live),
      { path: `${ARCHIVE}/Kurztrip nach Basel.md`, frontmatter: { type: 'trip' } },
    ]);
    const file = app.vault.getMarkdownFiles().find((f) => f.path === live);

    await expect(archiveTrip(app, settings, file, new Date())).rejects.toThrow(
      DestinationExistsError
    );
    expect(moved).toEqual([]);
  });

  it('refuses a note that is not a trip', async () => {
    const { app } = makeFakeVault(vaultWithTripAt(`${settings.tripsFolder}/T.md`));
    const city = app.vault.getMarkdownFiles().find((f) => f.path.endsWith('Basel.md'));

    await expect(archiveTrip(app, settings, city, new Date())).rejects.toThrow(NotATripError);
  });

  /** A blank folder read as the vault root would claim every note there is, so an archive nobody configured has to be absent rather than empty. */
  it('refuses when no archive folder is configured', async () => {
    const live = `${settings.tripsFolder}/Kurztrip nach Basel.md`;
    const { app } = makeFakeVault(vaultWithTripAt(live));
    const file = app.vault.getMarkdownFiles().find((f) => f.path === live);

    await expect(
      archiveTrip(app, { ...settings, archiveFolder: '  ' }, file, new Date())
    ).rejects.toThrow(ArchiveNotConfiguredError);
  });
});

describe('unarchiveTrip', () => {
  it('moves the note back and takes the stamp off', async () => {
    const archived = `${ARCHIVE}/Kurztrip nach Basel.md`;
    const notes = vaultWithTripAt(archived);
    notes[1].frontmatter.archived = '2026-09-19';
    const { app, moved, frontmatterAt } = makeFakeVault(notes);
    const file = app.vault.getMarkdownFiles().find((f) => f.path === archived);

    const outcome = await unarchiveTrip(app, settings, file);

    expect(outcome.path).toBe(`${settings.tripsFolder}/Kurztrip nach Basel.md`);
    expect(moved).toEqual([
      { from: archived, to: `${settings.tripsFolder}/Kurztrip nach Basel.md` },
    ]);
    expect(frontmatterAt(`${settings.tripsFolder}/Kurztrip nach Basel.md`)).not.toHaveProperty(
      'archived'
    );
  });

  it('does nothing to a trip that is not in the archive', async () => {
    const live = `${settings.tripsFolder}/Kurztrip nach Basel.md`;
    const { app, moved } = makeFakeVault(vaultWithTripAt(live));
    const file = app.vault.getMarkdownFiles().find((f) => f.path === live);

    expect((await unarchiveTrip(app, settings, file)).moved).toBe(false);
    expect(moved).toEqual([]);
  });
});
