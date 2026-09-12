/**
 * The `---` fenced block at the top of a note: splitting one off, and building
 * the object that goes into one.
 *
 * **Serialization is not here.** Turning the object into YAML text is the host's
 * job, because the host also owns the other direction: Obsidian's
 * `processFrontMatter()` re-serialises a whole block with its own writer, and a
 * plugin that wrote with a different one would produce a note that changes shape
 * the first time anything edits it. Each plugin keeps a three-line
 * `renderFrontmatterBlock` around its own serializer until the vault adapter
 * lands and can own that.
 *
 * App-free.
 */

/** A note split into its frontmatter block, fence included, and everything after it. */
export interface FrontmatterBlock {
  /** The `---\n...\n---\n` block, or '' when the note has none. */
  header: string;
  /** Everything after the block. The whole note when there is no block. */
  body: string;
}

/**
 * Splits a note's frontmatter block off its body.
 *
 * An unterminated block counts as no block: a note somebody is midway through
 * editing should be read as body rather than truncated to nothing.
 *
 * This exists because rebuilding a note from its parsed sections starts at the
 * first heading, and without splitting the block off first that rebuild drops
 * the note's own properties. It did, for a while, on every meal-plan edit.
 */
export function splitFrontmatterBlock(text: string): FrontmatterBlock {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { header: '', body: text };

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      return {
        header: `${lines.slice(0, i + 1).join('\n')}\n`,
        body: lines.slice(i + 1).join('\n'),
      };
    }
  }

  return { header: '', body: text };
}

/**
 * The frontmatter object for a new note, in the order its keys should appear.
 *
 * `type` first, then the creation stamp, then everything else. A note opened raw
 * reads its own kind first, then when it started, then what it says, and that
 * order matches every hand-authored template in these vaults.
 *
 * `stamps` is the record from `createdEntry()`. It is passed in rather than
 * produced here so this stays a pure ordering concern with no opinion about
 * clocks or settings.
 */
export function frontmatterObject(
  typePropertyName: string,
  typeValue: string,
  stamps: Record<string, unknown> = {},
  rest: Record<string, unknown> = {}
): Record<string, unknown> {
  return { [typePropertyName]: typeValue, ...stamps, ...rest };
}
