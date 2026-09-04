/**
 * A project as a folder rather than a file.
 *
 * A project here collects documents over weeks: a hundred a year, most of them
 * a few weeks long, several running at once. Giving each one a folder puts its
 * note, its papers and its picture in one place -- and means archiving it can
 * move all three together instead of leaving the papers behind.
 *
 * **Ownership is read off the vault, not out of a setting.** A project owns its
 * folder when the folder carries the note's own name. That is what lets a
 * grouping folder keep working unchanged: `3 Projekte/Fotografie/` holds two
 * projects and is named after neither, so neither owns it and archiving one
 * moves that note alone, exactly as it did before any of this.
 *
 * The rule has one failure mode worth knowing rather than guarding against.
 * Renaming a project note in Obsidian renames the note and not its folder, so
 * the project stops owning it and archiving would leave its documents behind.
 * `ownsFolder` simply reports the truth afterwards; nothing here tries to
 * repair a rename it did not see, because a folder rename is Obsidian's own
 * operation and second-guessing it is how links get broken.
 */
import { TFile, type TFolder } from 'obsidian';
import { joinFolder } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { folderFor } from '../vault/entity-types';

/**
 * Where a new project's note goes: a folder of its own under the projects root.
 *
 * Off by a setting, for a vault whose projects are one file each and want to
 * stay that way.
 */
export function newProjectFolder(settings: NODAtrailSettings, title: string): string {
  const root = folderFor(settings, 'project');
  if (!settings.projectFolderPerNote) return root;

  const name = title.trim();
  return name ? joinFolder(root, name) : root;
}

/**
 * The rule itself, over what a folder holds rather than over Obsidian's objects.
 *
 * Separated so it can be tested: the wrapper below has to narrow with
 * `instanceof TFile`, which needs the real class and so cannot be exercised
 * with a stub. Everything that decides anything is here.
 *
 * Two conditions, and the second is the one worth having. The folder must carry
 * the note's name, **and** it must hold no other note -- a folder that shares a
 * name with one of the two notes in it is a grouping folder, and moving it
 * would take the other note along.
 */
export function ownsFolderNamed(
  noteBasename: string,
  folderName: string,
  markdownNames: readonly string[]
): boolean {
  if (folderName !== noteBasename) return false;
  return markdownNames.length === 1;
}

/** The folder a note owns, or null when it merely sits in one. */
export function ownedFolder(file: TFile): TFolder | null {
  const parent = file.parent;
  if (!parent) return null;

  const notes = parent.children.filter(
    (child) => child instanceof TFile && child.extension === 'md'
  );
  return ownsFolderNamed(
    file.basename,
    parent.name,
    notes.map((note) => note.name)
  )
    ? parent
    : null;
}
