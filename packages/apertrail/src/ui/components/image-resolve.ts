/**
 * Resolves a note's image value (URL, wikilink, or vault path) to a
 * displayable resource URL and renders it inside a card element.
 */
import { App, TFile } from 'obsidian';
import { makeLightboxable } from './lightbox';
import { ABSOLUTE_URL_RE, resolveVaultFile } from '../../shared/vault-file';

export function resolveImagePath(app: App, imageValue: string): string | null {
  if (ABSOLUTE_URL_RE.test(imageValue)) return imageValue;

  const resolved = resolveImageFile(app, imageValue);
  return resolved ? app.vault.getResourcePath(resolved) : null;
}

// Same resolution as resolveImagePath, but returns the TFile itself rather than
// a display URL -- a caller that needs the real bytes can pass this to
// app.vault.readBinary(). Returns null for external URLs, which have no TFile.
//
// The lookup itself is shared/vault-file.ts: a deck plan is resolved the same
// way and is not a picture, so the resolution stopped being an image concern.
// What stays here is the one rule that is: an external URL is a picture a card
// can show and not a file anything can read.
export function resolveImageFile(app: App, imageValue: string): TFile | null {
  if (ABSOLUTE_URL_RE.test(imageValue)) return null;
  return resolveVaultFile(app, imageValue);
}

export function renderImageCard(container: HTMLElement, app: App, imageValue: string): void {
  const src = resolveImagePath(app, imageValue);
  const card = container.createDiv({ cls: 'apt-image-card' });
  if (!src) {
    card.createDiv({ cls: 'apt-image-placeholder' });
    return;
  }
  const img = card.createEl('img', { cls: 'apt-entity-image', attr: { src } });
  makeLightboxable(img);
  img.onerror = () => {
    img.remove();
    card.createDiv({ cls: 'apt-image-placeholder' });
  };
}

// A frontmatter/body image reference that doesn't actually resolve to a real
// file (deleted attachment, stale import, typo'd wikilink) is treated the
// same as no reference at all -- callers fall through to their next source
// instead of showing a broken value's placeholder. Takes and returns the raw
// value, not a resolved src, so a caller that only needs a yes/no plus the
// original value doesn't pay for a resolution it is about to redo; a caller
// that wants the src can still call resolveImagePath itself afterward.
export function usableImageValue(app: App, value: string | null): string | null {
  if (!value) return null;
  return resolveImagePath(app, value) ? value : null;
}
