/**
 * Removing from the rendered body what the meal view already shows above it.
 *
 * The view draws the title and the hero image itself, so a note that also
 * writes them into its body would show both twice. Only the body *as
 * rendered* is trimmed; the note on disk is untouched, which is why this is a
 * pure string function and not a writer.
 *
 * App-free.
 */
import { findHeading } from './body-sections';
import { resolveImageTarget } from './body-images';

export interface BodyCleanOptions {
  /** The setting. False leaves the body exactly as written. */
  cleanNoteBody: boolean;
  /** The note title, removed only when it appears as a top-level `#` heading. */
  title?: string;
  /**
   * The hero image value, removed wherever the body embeds it.
   *
   * Pass only a value the note actually refers to. The configured default
   * image belongs to no note, so passing it would delete an unrelated line
   * that happened to embed the same file.
   */
  imageValue?: string;
}

/** Collapses the gaps left behind by removed lines. */
const EXCESS_BLANK_LINES = /\n{3,}/g;

/** Escapes a string for use inside a RegExp, since an image path can contain any of these. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripRedundantBodyContent(body: string, options: BodyCleanOptions): string {
  let lines = body.split('\n');

  if (options.cleanNoteBody && options.title) {
    const { index } = findHeading(lines, options.title);
    // Only a `# ` heading. A note whose title also appears as a `##`
    // sub-heading is using it as a real section, not repeating its own name.
    if (index >= 0 && lines[index].startsWith('# ')) lines.splice(index, 1);
  }

  if (options.cleanNoteBody && options.imageValue) {
    const target = escapeForRegExp(resolveImageTarget(options.imageValue));
    const embed = new RegExp(`^!\\[\\[${target}(?:[|#][^\\]]*)?\\]\\]$`);
    const markdown = new RegExp(`^!\\[[^\\]]*\\]\\(${target}(?:\\s+"[^"]*")?\\)$`);
    // Whole-line matches only. An image mentioned mid-sentence is part of the
    // prose, and removing the line around it would take the sentence with it.
    lines = lines.filter((line) => !embed.test(line.trim()) && !markdown.test(line.trim()));
  }

  return lines.join('\n').replace(EXCESS_BLANK_LINES, '\n\n').trimStart();
}
