/**
 * Where a sheet rendered from a note goes: a subfolder of the folder the note
 * is in, named by `exportsSubfolder`.
 *
 * One rule with no exceptions, which is the point. It is the relationship
 * `_resources` and `_documents` already have to the notes beside them, so a
 * vault that keeps its pictures a level down keeps its renderings a level down
 * in the same way, and nobody has to remember a second arrangement for one
 * note type.
 *
 * **Renderings are kept apart from notes**, which is why it is a subfolder at
 * all rather than the note's own folder. Everything in it can be deleted and
 * made again from the note; nothing else beside the note can. A folder mixing
 * the two is a folder where that stops being obvious.
 *
 * **Notes in one folder share one exports folder.** Five flat trips in
 * `Trips/` render into `Trips/_exports/`, exactly as they share
 * `Trips/_resources/` for pictures. Every sheet's name already carries its
 * note's title and a suffix, so they cannot collide.
 *
 * This used to be `tripExportFolder()`, which put a trip's sheets inside the
 * folder the trip owned and fell back to beside the note for a flat one. The
 * owned-folder half was one rule more than the idea needs, and it left a flat
 * trip's sheets loose among notes. `ownedTripFolder()` still decides where a
 * booking goes: a booking belongs IN a trip's folder rather than under it.
 *
 * App-free: it computes a path and touches no vault.
 */
import type { APERtrailSettings } from '../settings/types';

/** Blank puts sheets beside the note, for a vault that would rather not have the extra level. */
export function exportFolder(settings: APERtrailSettings, notePath: string): string {
  const beside = notePath.slice(0, Math.max(0, notePath.lastIndexOf('/')));
  const subfolder = settings.exportsSubfolder.trim();
  if (!subfolder) return beside;
  return beside ? `${beside}/${subfolder}` : subfolder;
}

/** The full path a sheet lands at, from its folder and its already-sanitized file name. */
export function exportPath(settings: APERtrailSettings, notePath: string, name: string): string {
  const folder = exportFolder(settings, notePath);
  return folder ? `${folder}/${name}.html` : `${name}.html`;
}
