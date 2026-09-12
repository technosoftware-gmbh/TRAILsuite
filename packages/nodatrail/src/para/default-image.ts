/**
 * The picture a project falls back to when it has none of its own.
 *
 * A convention rather than a setting per family: an image in the projects
 * folder's own `_resources` named `Default` is the fallback for every project,
 * and one named `CN-Default` is the fallback for every project whose title
 * starts with `CN-`. The prefix is whatever stands before the word.
 *
 * It exists because the work arrives in families. Fifteen company projects, all
 * titled `CN-...`, all wanting the same picture, is fifteen notes to edit by
 * hand and a sixteenth to forget. Naming one file is the whole of it.
 *
 * **Longest prefix wins.** With `Default` and `CN-Default` both present, a
 * project called `CN-1097838` takes the second: the more specific claim is the
 * one somebody made on purpose, and the general one is what is left over.
 *
 * **Nothing is written into the note.** The fallback is resolved every time a
 * card is drawn, so renaming the file re-points every project at once and a note
 * that never mentioned a picture still does not. Writing it back would turn a
 * convention into fifteen copies of an answer, which is the problem it exists to
 * solve.
 *
 * **A broken `image:` does not fall back.** A project that names a picture the
 * vault cannot find has a fault worth seeing, and quietly showing the family
 * default instead would hide it forever. The fallback is for a note with no
 * image at all.
 *
 * App-free: it is given the names it may choose from.
 */

/**
 * The stem of the file a project should fall back to, or null.
 *
 * `stems` are filenames without their extension, as the folder holds them.
 * `word` is the convention's own word -- `Default` by default, a setting,
 * because it is a name in somebody's vault. A blank word switches the whole
 * convention off, which is the same fail-safe direction every unconfigured
 * setting here takes.
 *
 * Matching ignores case, because a folder on macOS does and a vault that says
 * `cn-default` means the same thing as one that says `CN-Default`.
 */
export function defaultImageStem(
  title: string,
  stems: readonly string[],
  word: string
): string | null {
  const suffix = word.trim().toLowerCase();
  if (!suffix) return null;

  const name = title.trim().toLowerCase();
  if (!name) return null;

  let best: string | null = null;
  let bestPrefix = -1;

  for (const stem of stems) {
    const lower = stem.trim().toLowerCase();
    if (!lower.endsWith(suffix)) continue;

    const prefix = lower.slice(0, lower.length - suffix.length);
    // A project must not answer to its own family's default only by accident:
    // `Default` claims everything, `CN-Default` claims what starts with `CN-`.
    if (prefix && !name.startsWith(prefix)) continue;

    // Ties go to whichever the folder listed first, which is stable because the
    // caller sorts. A tie here means two files with the same stem in different
    // extensions, and either is as right as the other.
    if (prefix.length > bestPrefix) {
      best = stem;
      bestPrefix = prefix.length;
    }
  }

  return best;
}
