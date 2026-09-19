/**
 * Retiring a trip, and taking it back out again.
 *
 * **Archiving is a move, not a property.** The note goes into
 * `<archiveFolder>/<tripsArchiveFolder>/`, gets an `archived:` stamp, and its
 * `type: trip` does not change. NODAtrail reached this answer first for PARA
 * notes (`para/archive.ts`) and the reasoning carries over: the folder is what
 * every reader already matches on, so no reader needs a special case and no
 * view can forget to apply one.
 *
 * **Where this deliberately parts company with NODAtrail:** an archived trip is
 * still read. There, the live readers stop seeing an archived note and each
 * view opts back in. Here `tripReadFolders()` reads both folders in one pass,
 * because a city's `visited` and `lastVisit` are derived from the trips that
 * stopped there. A trip dropped from the board would take the evidence of a
 * real journey with it, and the vault this was built for lost five cities that
 * way before anybody noticed. The trip comes back carrying `archived`, and the
 * surfaces that should not show it filter on that.
 *
 * **The stamp is written, unlike every other derived value in this plugin.** It
 * is not derived: the folder says *that* the trip was retired and the stamp
 * says *when*, and the when is recoverable from nowhere else once the move has
 * happened. A blank `archivedProperty` skips it, and a trip in the archive is
 * archived without it.
 *
 * Both directions are a command somebody runs, on one trip, having looked at
 * it. Nothing here moves a file on a schedule or in bulk.
 */
import { App, TAbstractFile, TFile } from 'obsidian';
import { formatDayTitle, joinFolder, matchesType } from '@technosoftware/trail-core';
import { ensureFolder } from '../shared/note-creation';
import { frontmatterOf, hostFor } from '../shared/vault-host';
import type { APERtrailSettings } from '../settings/types';
import { isArchivedTripPath, ownedTripFolder, tripArchiveFolderOn } from './trip-folder';

/** True when the note is one APERtrail would read as a trip. */
export function isTripNote(app: App, settings: APERtrailSettings, file: TFile): boolean {
  const frontmatter = frontmatterOf(app, file);
  if (!frontmatter) return false;
  return matchesType(frontmatter, settings.typePropertyName.trim() || 'type', 'trip');
}

export interface ArchiveOutcome {
  /** Where the note ended up, so a caller can still open it after its folder moved under it. */
  path: string;
  /** False when the call was a no-op because the trip was already where it was being sent. */
  moved: boolean;
}

interface MovingEntry {
  /** What is handed to `renameFile`: the folder when the trip owns one, the note otherwise. */
  entry: TAbstractFile;
  path: string;
  name: string;
  /** True when a folder is moving, which is what decides whether the note's own path changes under it. */
  owned: boolean;
}

/**
 * The folder a trip travels as, or the note alone.
 *
 * A trip that owns its folder moves as that folder, so its bookings, its
 * pictures and its exported sheets go with it -- which is the whole point of
 * `trip-folder.ts`. A trip still flat in `Trips/` owns nothing and moves as one
 * note.
 *
 * **`file.parent` rather than a path lookup.** `ownedTripFolder()` is app-free
 * by design and answers in strings, and asking the vault to turn that string
 * back into something renameable is a second question that can fail for
 * reasons this code would then have to invent an error for. The parent is the
 * folder, already in hand.
 */
function movingEntry(file: TFile): MovingEntry {
  const owned = ownedTripFolder(file.path, file.basename);
  const parent = file.parent;
  if (!owned || !parent) return { entry: file, path: file.path, name: file.name, owned: false };
  return { entry: parent, path: parent.path, name: parent.name, owned: true };
}

/**
 * Moves a trip into the archive and stamps the day.
 *
 * Throws rather than overwriting when something already sits at the
 * destination: two trips sharing a title is a thing a vault has, and a silent
 * clobber of one of them is not a failure mode worth having. The caller
 * translates.
 */
export async function archiveTrip(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  today: Date = new Date()
): Promise<ArchiveOutcome> {
  if (!isTripNote(app, settings, file)) throw new NotATripError(file.path);

  const destinationFolder = tripArchiveFolderOn(settings, today);
  if (!destinationFolder) throw new ArchiveNotConfiguredError();

  // Asked of the category folder, not this year's: a trip already filed under
  // `6 Archive/Trips/2025` is archived, and testing it against the current year
  // would say otherwise and drag it forward, restamping and moving something
  // that was already where it belonged.
  if (isArchivedTripPath(file.path, settings)) return { path: file.path, moved: false };

  return moveTrip(app, settings, file, destinationFolder, formatDayTitle(today));
}

/** Moves a trip back to the live trips folder and takes the stamp off. */
export async function unarchiveTrip(
  app: App,
  settings: APERtrailSettings,
  file: TFile
): Promise<ArchiveOutcome> {
  if (!isTripNote(app, settings, file)) throw new NotATripError(file.path);
  if (!isArchivedTripPath(file.path, settings)) return { path: file.path, moved: false };

  const destinationFolder = settings.tripsFolder.trim();
  if (!destinationFolder) throw new ArchiveNotConfiguredError();

  return moveTrip(app, settings, file, destinationFolder, null);
}

/**
 * The half both directions share: stamp, then move, then repoint the picture.
 *
 * **The stamp goes on before the move**, so a failure to move leaves a trip
 * that is not stamped rather than one claiming to be archived and sitting in
 * the live folder.
 */
async function moveTrip(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  destinationFolder: string,
  stamp: string | null
): Promise<ArchiveOutcome> {
  const moving = movingEntry(file);
  const target = joinFolder(destinationFolder, moving.name);
  if (target !== moving.path && app.vault.getAbstractFileByPath(target)) {
    throw new DestinationExistsError(target);
  }

  const key = settings.archivedProperty.trim();
  if (key) {
    await hostFor(app).frontmatter.process(file, (frontmatter) => {
      if (stamp) frontmatter[key] = stamp;
      else delete frontmatter[key];
    });
  }

  if (target === moving.path) return { path: file.path, moved: false };

  const from = moving.path;
  await ensureFolder(app, destinationFolder);
  await app.fileManager.renameFile(moving.entry, target);

  if (moving.owned) await retargetImage(app, settings, file, from, target);
  return { path: moving.owned ? `${target}/${file.name}` : target, moved: true };
}

/**
 * Repoints a trip's `image:` after its folder moved under it.
 *
 * **Obsidian does not do this for us, and that is the whole reason it exists.**
 * `image:` holds a plain path rather than a wikilink, so a folder rename that
 * updates every link in the vault leaves this one string saying where the
 * picture used to be -- and the picture is gone from the note while the file
 * itself sits, intact, in the folder that just moved. NODAtrail carries the
 * same function for the same reason; the licence boundary is why it is written
 * twice rather than shared.
 *
 * Only a path *inside* the folder that moved is touched. An image somewhere
 * else in the vault did not move, and rewriting it would point the note at a
 * file that was never there. A bare name is left alone too, because those
 * resolve by search and survive a move without help.
 */
async function retargetImage(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  from: string,
  to: string
): Promise<void> {
  const key = settings.imageProperty.trim();
  if (!key || from === to) return;

  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    const value = frontmatter[key];
    if (typeof value !== 'string') return;

    const prefix = `${from}/`;
    if (!value.startsWith(prefix)) return;
    frontmatter[key] = `${to}/${value.slice(prefix.length)}`;
  });
}

/** The note is not a trip. Typed so the caller can translate; no user-facing string is thrown from here. */
export class NotATripError extends Error {
  constructor(readonly path: string) {
    super(`Not a trip note: ${path}`);
    this.name = 'NotATripError';
  }
}

/** The archive folder or its trips sub-folder is blank, so there is nowhere to send it. */
export class ArchiveNotConfiguredError extends Error {
  constructor() {
    super('No trip archive folder is configured');
    this.name = 'ArchiveNotConfiguredError';
  }
}

export class DestinationExistsError extends Error {
  constructor(readonly path: string) {
    super(`A note already exists at ${path}`);
    this.name = 'DestinationExistsError';
  }
}
