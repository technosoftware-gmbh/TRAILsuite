/**
 * The bridge from Obsidian's `App` to trail-core's vault ports.
 *
 * The core implements every note helper against `VaultHost` rather than
 * against an `App`, so each App-bound module here keeps its existing
 * `(app, ...)` signature and reduces its body to one delegation through
 * `hostFor()`. That was a deliberate choice over threading a host down
 * through every call site: the duplicated implementations are what this
 * removes, and the callers are unaffected by where the implementation now
 * lives.
 *
 * Memoised per `App`, because the ports are three small closure objects
 * built on every call otherwise, and the reading paths call this once per
 * note. A WeakMap rather than a module-level singleton so a second vault in
 * the same process (which is what a test suite is) gets its own host and
 * nothing outlives the App it was built for.
 */
import { App, TFile } from 'obsidian';
import { obsidianHost, type ObsidianHost } from 'trail-core/obsidian';

const hosts = new WeakMap<App, ObsidianHost>();

/** The core's vault ports over one `App`, built once per `App`. */
export function hostFor(app: App): ObsidianHost {
  const existing = hosts.get(app);
  if (existing) return existing;

  const host = obsidianHost(app);
  hosts.set(app, host);
  return host;
}

/**
 * The file's frontmatter as a plain record, or null when the note has none.
 *
 * Obsidian's own FrontMatterCache type is effectively `any`, and the cast
 * that fixes that lives in the core's adapter rather than at any call site
 * here. Kept as a named helper rather than spelled out at each reader,
 * because `frontmatterOf(app, file)` is what every call site already says.
 */
export function frontmatterOf(app: App, file: TFile): Record<string, unknown> | null {
  return hostFor(app).metadata.frontmatterOf(file);
}
