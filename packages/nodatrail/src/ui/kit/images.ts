/**
 * Turning an `image:` property into something a browser will draw.
 *
 * Three layers, and the middle one is where the bugs live: which property
 * (`imageProperty`, a setting, read by the PARA parser), which value (a
 * wikilink, an embed, a vault path or an absolute URL), and which URL.
 *
 * **`app.vault.getResourcePath()` is the API**, not `vault.adapter`. A vault
 * lives in iCloud on this user's machine and on an iPad through a container the
 * adapter's own paths do not survive; `getResourcePath` is what Obsidian
 * resolves against its own filesystem on every platform it runs on.
 *
 * **A value that resolves to nothing is null rather than a broken `<img>`.**
 * The caller then draws its placeholder, which is the same size as the picture
 * would have been, so a row does not reflow around a missing attachment. A
 * broken image icon in a strip of cards reads as a bug in the plugin; a plain
 * panel reads as a note without a picture yet, which is what it is.
 *
 * This is a reimplementation of a shape CULItrail arrived at first, not a copy:
 * that package is GPL and this one is PolyForm, and
 * `tests/package-boundary.test.ts` fails the build on a file that crossed.
 */
import { TFile, type App } from 'obsidian';
import { stripWikilink } from 'trail-core';

/**
 * A value that is already a URL and names no file in the vault.
 *
 * `app:` and `capacitor:` are Obsidian's own schemes on desktop and on iOS: a
 * value that already carries one came from `getResourcePath` earlier and must
 * be handed back untouched rather than looked up as a path.
 */
const ABSOLUTE_URL = /^(?:https?|data|app|capacitor):\/\//i;

/**
 * The file an image value names, or null.
 *
 * `getFirstLinkpathDest` first, because it understands a shortened link that
 * names only a filename -- which is how Obsidian writes one when the attachment
 * is unambiguous. `getFileByPath` after it, for a value written as a full vault
 * path that was never a link, which is the shape the health check reports and
 * the shape a hand-edited note usually carries.
 */
export function resolveImageFile(app: App, value: string): TFile | null {
  if (ABSOLUTE_URL.test(value)) return null;

  const bare = stripWikilink(value);
  if (!bare) return null;

  const linked = app.metadataCache.getFirstLinkpathDest(bare, '');
  if (linked instanceof TFile) return linked;

  const byPath = app.vault.getFileByPath(bare);
  return byPath instanceof TFile ? byPath : null;
}

/** The value as a `src`, or null when it names nothing this vault holds. */
export function resolveImagePath(app: App, value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ABSOLUTE_URL.test(trimmed)) return trimmed;

  const file = resolveImageFile(app, trimmed);
  return file ? app.vault.getResourcePath(file) : null;
}
