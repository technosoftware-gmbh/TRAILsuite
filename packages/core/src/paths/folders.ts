/**
 * Vault paths as strings: normalising them, asking whether one is under
 * another, and turning a note title into a filename.
 *
 * A path here is always the forward-slash, no-leading-slash form a vault uses
 * internally. `normalizePath` is this package's own rather than the host's,
 * which is what lets everything above it stay host-free for the sake of one
 * five-line function.
 *
 * App-free.
 */

/** A vault-internal path: forward slashes, no leading, trailing or repeated separators. */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
}

/**
 * Joins a folder onto a parent, tolerating a blank either side.
 *
 * A blank parent means the vault root, which is the shape a plugin ships in when
 * its root folder setting is empty, so joining must not produce a leading slash.
 */
export function joinFolder(parent: string, child: string): string {
  const left = normalizePath(parent);
  const right = normalizePath(child);
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
}

/**
 * True when a file sits inside a folder, at any depth.
 *
 * A blank folder means the vault root, and everything is under that. The
 * separator in the comparison is what stops `Meals` from matching
 * `Meals Archive/x.md`, which is the bug this shape exists to avoid.
 */
export function isUnderFolder(filePath: string, folderPath: string): boolean {
  const folder = normalizePath(folderPath);
  if (!folder) return true;

  const file = normalizePath(filePath);
  return file === folder || file.startsWith(`${folder}/`);
}

/**
 * True when a file sits under any of several folders.
 *
 * An empty list means no folder was configured, which is "nowhere" rather than
 * "everywhere": a feature with no folder set should find nothing, not the whole
 * vault. That asymmetry with `isUnderFolder`'s blank-means-root is deliberate
 * and is the case worth reading twice.
 */
export function isUnderAnyFolder(filePath: string, folderPaths: readonly string[]): boolean {
  const folders = folderPaths.map(normalizePath).filter((folder) => folder !== '');
  return folders.some((folder) => isUnderFolder(filePath, folder));
}

/** The folder part of a path, or '' for a file at the vault root. */
export function folderOfPath(path: string): string {
  const normalized = normalizePath(path);
  const cut = normalized.lastIndexOf('/');
  return cut === -1 ? '' : normalized.slice(0, cut);
}

/**
 * A file's containing folder relative to a root, for showing which subfolder a
 * note came from without hardcoding any naming convention.
 *
 * A file at `Travel/Cities/Europe/Basel.md` with root `Travel/Cities` gives
 * `Europe`; one directly in the root gives ''. A file outside the root gives its
 * own folder unchanged, rather than a path with `..` in it that means nothing to
 * a vault.
 */
export function relativeFolderPath(filePath: string, rootFolder: string): string {
  const folder = folderOfPath(filePath);
  const root = normalizePath(rootFolder);
  if (!root) return folder;
  if (folder === root) return '';

  return folder.startsWith(`${root}/`) ? folder.slice(root.length + 1) : folder;
}

/**
 * A note title as a filename.
 *
 * Only `/` is replaced. A vault allows most punctuation in a filename, and only
 * the separator would be read back as a path, so replacing more than that would
 * quietly rename notes people deliberately called what they called them.
 */
export function sanitizeTitle(title: string): string {
  return title.trim().replace(/\//g, '-');
}
