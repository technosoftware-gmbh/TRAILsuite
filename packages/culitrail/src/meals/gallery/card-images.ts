/**
 * Finding a picture for each card, in two phases.
 *
 * Phase one reads frontmatter only, which Obsidian already has in memory, so
 * the grid appears immediately. Phase two reads note bodies for the cards
 * phase one left empty, one at a time.
 *
 * One at a time matters. `Promise.all()` over a few hundred meals fires a
 * few hundred file reads in the same tick, which on a synced vault on a phone
 * is the difference between a gallery that opens and one that stalls.
 */
import type { App, TFile } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { resolveImagePath, usableImageValue } from '../../ui/images';
import { findFirstImageInBody } from '../parser/body-images';
import { stripFrontmatter } from '../parser/body-sections';
import { frontmatterImageValue } from '../view-model/hero-image';
import type { GalleryEntry } from '../view-model/gallery-entry';

/** Phase one: what the frontmatter names, resolved, without reading the file. */
export function frontmatterImageSrc(
  app: App,
  entry: GalleryEntry,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings
): string | null {
  const usable = usableImageValue(app, frontmatterImageValue(frontmatter, settings));
  return usable ? resolveImagePath(app, usable) : null;
}

async function bodyImageSrc(
  app: App,
  file: TFile,
  settings: CULItrailSettings
): Promise<string | null> {
  if (!settings.useFirstBodyImageWhenFrontmatterEmpty) return null;

  const body = stripFrontmatter(await app.vault.cachedRead(file));
  const usable = usableImageValue(app, findFirstImageInBody(body));
  return usable ? resolveImagePath(app, usable) : null;
}

/**
 * Phase two, over the files that still have no picture.
 *
 * `isCancelled` is checked before each read and again before each callback,
 * so a gallery that was closed or re-rendered mid-pass stops touching the
 * vault instead of writing into DOM that is no longer on screen.
 */
export async function runLazyImagePass(
  app: App,
  files: TFile[],
  settings: CULItrailSettings,
  onResolved: (file: TFile, src: string | null) => void,
  isCancelled: () => boolean
): Promise<void> {
  for (const file of files) {
    if (isCancelled()) return;
    const src = await bodyImageSrc(app, file, settings);
    if (isCancelled()) return;
    onResolved(file, src);
  }
}
