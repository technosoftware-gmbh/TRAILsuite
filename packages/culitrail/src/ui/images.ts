/**
 * Turning a meal's image value into something the screen can show.
 *
 * A note can name its image three ways: an external URL, a wikilink embed, or
 * a plain vault path. All three arrive here as one string and leave as a
 * resource URL, a TFile, or null.
 */
import { App, TFile } from 'obsidian';
import { stripWikilink } from '@technosoftware/trail-core';
import { makeLightboxable } from './lightbox';

/** Schemes that are already displayable as-is. `app:` and `capacitor:` are Obsidian's own on desktop and mobile. */
const ABSOLUTE_URL = /^(?:https?|data|app|capacitor):\/\//i;

/** A displayable URL for an image value, or null when it names nothing that exists. */
export function resolveImagePath(app: App, value: string): string | null {
  if (ABSOLUTE_URL.test(value)) return value;

  const file = resolveImageFile(app, value);
  return file ? app.vault.getResourcePath(file) : null;
}

/**
 * The same resolution, but returning the file itself.
 *
 * For callers that need the actual bytes rather than a URL, such as an export
 * that bundles the picture. Returns null for an external URL, which has no
 * file behind it.
 */
export function resolveImageFile(app: App, value: string): TFile | null {
  if (ABSOLUTE_URL.test(value)) return null;

  const bare = stripWikilink(value);

  // Obsidian's own link resolution first, because it understands a shortened
  // wikilink that names only the filename. The direct path lookup after it
  // catches a value that was written as a full vault path and never was a
  // link at all.
  const linked = app.metadataCache.getFirstLinkpathDest(bare, '');
  if (linked instanceof TFile) return linked;

  const byPath = app.vault.getFileByPath(bare);
  return byPath instanceof TFile ? byPath : null;
}

/**
 * An image value that actually resolves, or null.
 *
 * A deleted attachment, a stale import or a typo'd wikilink is treated the
 * same as no image at all, so the caller falls through to its next source
 * rather than rendering a placeholder for a value that merely looks set.
 *
 * Takes and returns the raw value rather than a resolved URL, because the
 * caller that wants the URL is about to build the image element and would
 * resolve it again anyway.
 */
export function usableImageValue(app: App, value: string | null): string | null {
  if (!value) return null;
  return resolveImagePath(app, value) ? value : null;
}

/** Renders an image, or the placeholder that keeps the layout from jumping when there is none. */
export function renderImageCard(container: HTMLElement, app: App, value: string): void {
  const source = resolveImagePath(app, value);
  const card = container.createDiv({ cls: 'culi-image-card' });

  if (!source) {
    card.createDiv({ cls: 'culi-image-placeholder' });
    return;
  }

  const image = card.createEl('img', { cls: 'culi-meal-image', attr: { src: source } });
  makeLightboxable(image);

  // A path can resolve and the file still fail to decode, which is what a
  // half-synced attachment looks like. Falling back to the placeholder keeps
  // the card the same size instead of collapsing the row around a broken icon.
  image.onerror = () => {
    image.remove();
    card.createDiv({ cls: 'culi-image-placeholder' });
  };
}
