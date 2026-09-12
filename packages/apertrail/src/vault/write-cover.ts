/**
 * Vault-write side of what a note presents: the line under its title, the
 * picture that stands for it, its highlights and its gallery. Reading is
 * `vault/read-cover.ts`.
 *
 * Still called the cover, and the name is now the smaller half of what it
 * holds. Kept because these are the keys `updateNoteCover` has always owned
 * and renaming them here would rename a settings group, a command id and a
 * test suite to describe the same four properties.
 *
 * **These keys were read by everything and owned by nothing.** The
 * vehicle editor deliberately excluded `image` and `gallery` from its managed
 * keys, with the right reason: an editor that cleared what it did not put
 * there would delete a picture nobody asked it to touch. That argument ends
 * where an editor exists whose whole job is those keys, and this is it -- so
 * it owns all three and clears them before it writes, which is what makes
 * removing the last gallery row remove the property rather than leave an empty
 * list behind.
 *
 * It owns nothing else. A ship's cabins, a place's rating, anything
 * hand-added: untouched, because `processFrontMatter` is given three keys and
 * this builder emits only those.
 *
 * `description` is also written by the ship's cabins dialog. Two editors
 * writing one property is fine where they write the same thing; it would not
 * be if either derived it.
 */
import { App, TFile } from 'obsidian';
import { formatDateTimeStamp } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';
import { GalleryRow } from '../ui/components/gallery-field';

export interface CoverInput {
  description: string | null;
  image: string | null;
  gallery: GalleryRow[];
  /** One line each, in the order they should read. Empty is how a note says it has none. */
  highlights: string[];
}

/** Every key this owns, cleared before a rewrite. */
export function coverManagedKeys(settings: APERtrailSettings): string[] {
  return [
    settings.descriptionProperty,
    settings.imageProperty,
    settings.tripGalleryProperty,
    settings.tripHighlightsProperty,
  ];
}

/**
 * The frontmatter a cover writes, and only what the note actually says.
 *
 * Absent rather than empty, the rule every builder here follows: a note that
 * says nothing about its picture says nothing, rather than saying it has none.
 * A gallery row with no picture is dropped -- it is a caption pointing at
 * nothing, which nothing could ever render.
 */
export function buildCoverFrontmatter(
  input: CoverInput,
  settings: APERtrailSettings
): Record<string, unknown> {
  const yaml: Record<string, unknown> = {};

  const description = input.description?.trim();
  if (description) yaml[settings.descriptionProperty] = description;

  const image = input.image?.trim();
  if (image) yaml[settings.imageProperty] = image;

  // A blank line in the box is somebody pressing return, not a highlight.
  const highlights = input.highlights.map((line) => line.trim()).filter((line) => line !== '');
  if (highlights.length > 0) yaml[settings.tripHighlightsProperty] = highlights;

  const gallery = input.gallery
    .filter((picture) => picture.image.trim() !== '')
    .map((picture) => {
      const entry: Record<string, unknown> = { [settings.galleryImageField]: picture.image.trim() };
      const caption = picture.caption?.trim();
      if (caption) entry[settings.galleryCaptionField] = caption;
      return entry;
    });
  if (gallery.length > 0) yaml[settings.tripGalleryProperty] = gallery;

  return yaml;
}

/** Updates the note in place through `processFrontMatter()`, so the body survives untouched. */
export async function updateNoteCover(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  input: CoverInput,
  now: Date = new Date()
): Promise<void> {
  const yaml = buildCoverFrontmatter(input, settings);
  const managed = coverManagedKeys(settings);

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, yaml);
    // Stamped in the same pass rather than through a second write, the way
    // write-vehicle.ts does it. A blank setting means "skip that stamp".
    if (settings.modifiedProperty) {
      record[settings.modifiedProperty] = formatDateTimeStamp(now);
    }
  });
}
