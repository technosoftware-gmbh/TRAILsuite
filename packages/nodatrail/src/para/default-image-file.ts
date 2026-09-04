/**
 * The fallback pictures a vault actually holds, read once per render.
 *
 * `defaultImageStem` decides which name a project should take;
 * this finds the files and hands back a lookup. Built once and reused for every
 * card, because the alternative is listing a folder a hundred times to answer a
 * hundred projects.
 *
 * The folder is the projects folder's own image subfolder -- `3 Projekte/_resources`
 * on the vault this was written for -- which is where a picture shared by a
 * family of projects already belongs. It is not a setting of its own: it is the
 * two settings that already say where projects live and what an image folder is
 * called, put together.
 */
import { App, TFile } from 'obsidian';
import type { NODAtrailSettings } from '../settings/types';
import { folderFor } from '../vault/entity-types';
import { defaultImageStem } from './default-image';
import { isImageFile } from './image-file';

/** Answers "what picture should this project show" for a title with no image of its own. */
export type DefaultImages = (title: string) => string | null;

/** A lookup that finds nothing, for a vault with no such folder and for the feature switched off. */
const NONE: DefaultImages = () => null;

/**
 * The fallback lookup for this vault, or one that always answers null.
 *
 * Reads the folder once. A vault with no `_resources` beside its projects, or
 * with the convention's word left blank, gets `NONE` and pays nothing.
 */
export function projectDefaultImages(app: App, settings: NODAtrailSettings): DefaultImages {
  const word = settings.projectDefaultImageName.trim();
  if (!word) return NONE;

  const projects = folderFor(settings, 'project');
  const subfolder = settings.imageSubfolder.trim();
  if (!projects || !subfolder) return NONE;

  const folder = `${projects}/${subfolder}`;
  const files = app.vault
    .getFiles()
    .filter((file) => file.parent?.path === folder && isImageFile(file))
    // Sorted so a tie between two extensions of the same stem is decided the
    // same way on every machine, rather than by the order a filesystem happens
    // to list them in.
    .sort((a, b) => a.name.localeCompare(b.name));
  if (files.length === 0) return NONE;

  const byStem = new Map<string, TFile>();
  for (const file of files) if (!byStem.has(file.basename)) byStem.set(file.basename, file);
  const stems = [...byStem.keys()];

  return (title) => {
    const stem = defaultImageStem(title, stems, word);
    return stem ? (byStem.get(stem)?.path ?? null) : null;
  };
}
