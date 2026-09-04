/**
 * Archiving a note, and taking it back out again.
 *
 * **Archiving is a move, not a property.** The note goes into
 * `<archiveFolder>/<Category>/` and gets an `archived:` stamp; its `type` does
 * not change, which is what keeps an archived project a project and readable by
 * every parser above this line. The active readers stop seeing it because
 * `readNotesOfType()` matches on folder AND type together, so no reader needs a
 * special case and no view can forget to apply one.
 *
 * **The stamp is written, unlike every other derived value in this plugin.** It
 * is not derived: the folder says *that* the note was archived and the stamp
 * says *when*, and the when is not recoverable from anywhere else.
 *
 * Both directions are a command somebody runs, on one note, having looked at
 * it. Nothing here moves a file on a schedule or in bulk.
 */
import { App, TFile } from 'obsidian';
import { formatDayTitle, joinFolder } from 'trail-core';
import { ensureFolder } from '../shared/note-creation';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import {
  archiveFolderFor,
  archiveFolderOn,
  folderFor,
  PARA_TYPES,
  typeValueFor,
  type ParaType,
} from '../vault/entity-types';
import { isArchivedPath } from '../vault/read-notes';
import { ownedFolder } from './project-folder';

/** Which PARA kind a file is, or null when NODAtrail does not claim it. */
export function paraTypeOf(app: App, settings: NODAtrailSettings, file: TFile): ParaType | null {
  const frontmatter = hostFor(app).metadata.frontmatterOf(file) ?? {};
  const stated = frontmatter[settings.typePropertyName];
  const value = typeof stated === 'string' ? stated.trim() : null;
  if (!value) return null;

  return PARA_TYPES.find((type) => typeValueFor(settings, type) === value) ?? null;
}

export interface ArchiveOutcome {
  /** Where the note ended up. */
  path: string;
  type: ParaType;
}

/**
 * Moves a note into the archive and stamps the day.
 *
 * Throws rather than overwriting when something already sits at the
 * destination: two notes sharing a title is a thing a vault has, and a silent
 * clobber of one of them is not a failure mode worth having. The caller
 * translates.
 */
export async function archiveNote(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  today: Date
): Promise<ArchiveOutcome> {
  const type = paraTypeOf(app, settings, file);
  if (!type) throw new NotArchivableError(file.path);

  const destinationFolder = archiveFolderOn(settings, type, today);
  if (!destinationFolder) throw new NotArchivableError(file.path);

  // **Asked of the category folder, not the year one.** A note already filed
  // under `Projects/2025` is archived, and testing it against this year's
  // folder would say otherwise and drag it forward into 2026 -- restamping and
  // moving something that was already where it belonged.
  const archiveRoot = archiveFolderFor(settings, type);
  if (archiveRoot && isArchivedPath(file.path, archiveRoot)) {
    return { path: file.path, type };
  }

  // **A project that owns its folder travels as that folder**, so its documents
  // and its picture go with it. Anything else moves as one note, which is what
  // a grouping folder like `3 Projekte/Fotografie/` needs: it holds two
  // projects and is named after neither, so neither owns it.
  const owned = ownedFolder(file);
  const moving = owned ?? file;
  const target = joinFolder(destinationFolder, moving.name);
  if (app.vault.getAbstractFileByPath(target)) throw new DestinationExistsError(target);

  await ensureFolder(app, destinationFolder);
  // The stamp goes on before the move, so a failure to move leaves a note that
  // is not stamped rather than one that claims to be archived and is not.
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    const key = settings.archivedProperty.trim();
    if (key) frontmatter[key] = formatDayTitle(today);
  });
  const from = moving.path;
  await app.fileManager.renameFile(moving, target);

  // The note's own path when a folder moved, so a caller can still open it.
  const notePath = owned ? `${target}/${file.name}` : target;
  if (owned) await retargetImage(app, settings, file, from, target);
  return { path: notePath, type };
}

/** Moves a note back to its live folder and takes the stamp off. */
export async function unarchiveNote(
  app: App,
  settings: NODAtrailSettings,
  file: TFile
): Promise<ArchiveOutcome> {
  const type = paraTypeOf(app, settings, file);
  if (!type) throw new NotArchivableError(file.path);

  const destinationFolder = folderFor(settings, type);
  if (!destinationFolder) throw new NotArchivableError(file.path);

  // Symmetrical with archiving: a project that owns its folder comes back as
  // that folder, so the documents that went in with it come back too.
  const owned = ownedFolder(file);
  const moving = owned ?? file;
  const target = joinFolder(destinationFolder, moving.name);
  if (target !== moving.path && app.vault.getAbstractFileByPath(target)) {
    throw new DestinationExistsError(target);
  }

  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    const key = settings.archivedProperty.trim();
    if (key) delete frontmatter[key];
  });
  const from = moving.path;
  if (target !== moving.path) {
    await ensureFolder(app, destinationFolder);
    await app.fileManager.renameFile(moving, target);
    if (owned) await retargetImage(app, settings, file, from, target);
  }

  return { path: owned ? `${target}/${file.name}` : target, type };
}

/**
 * Repoints a note's `image:` after its folder moved under it.
 *
 * **Obsidian does not do this for us, and that is the whole reason it exists.**
 * `image:` holds a plain path rather than a wikilink, so a folder rename that
 * updates every link in the vault leaves this one string saying where the
 * picture used to be -- and the picture is gone from the note while the file
 * itself is sitting, intact, in the folder that just moved.
 *
 * Only a path *inside* the folder that moved is touched. An image somewhere
 * else in the vault is left alone: it did not move, and rewriting it would
 * point the note at a file that was never there.
 *
 * A bare name rather than a path is left alone too. `resolveImageFile` resolves
 * those by search, so they survive a move without help.
 */
async function retargetImage(
  app: App,
  settings: NODAtrailSettings,
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

/** The note is not one NODAtrail archives. Typed so the caller can translate; no user-facing string is thrown from here. */
export class NotArchivableError extends Error {
  constructor(readonly path: string) {
    super(`Not an archivable note: ${path}`);
    this.name = 'NotArchivableError';
  }
}

export class DestinationExistsError extends Error {
  constructor(readonly path: string) {
    super(`A note already exists at ${path}`);
    this.name = 'DestinationExistsError';
  }
}
