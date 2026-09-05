/**
 * Finding headings in a note body, and reading the sections they delimit.
 *
 * The read half only. Writing a section back needs an Obsidian `App` and
 * belongs with the writers, so it lands with the area that first edits a
 * note.
 *
 * A section here runs from its heading to the next heading **of any level**,
 * including a deeper one. That is the right rule for a flat section such as
 * Notes or Eating History, and the wrong one for Ingredients and Instructions,
 * where a `###` sub-heading is part of the section rather than the end of it.
 * Those two are read by ingredient-groups.ts and instruction-groups.ts, which
 * compare heading depth instead. Reaching for `extractSection()` on them
 * returns whatever sits above the first sub-heading, usually nothing.
 *
 * App-free.
 */
import { splitFrontmatterBlock } from '@technosoftware/trail-core';

/** A heading of any level, tolerating the closing hashes some editors add. */
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;

/** The looser form, for merely detecting that a line is a heading. */
const ANY_HEADING = /^(#{1,6})\s+(.+)/;

export interface HeadingLocation {
  /** Line index, or -1 when the heading is absent. */
  index: number;
  /** Number of hashes, so callers can find where the section ends. */
  level: number;
}

const NOT_FOUND: HeadingLocation = { index: -1, level: 0 };

/**
 * Finds a heading by name, case-insensitively and at any level.
 *
 * Any level on purpose: whether a vault writes `# Ingredients` or
 * `## Ingredients` is a formatting preference, and requiring one would mean
 * half the notes in a vault silently failing to parse.
 */
export function findHeading(lines: string[], headingName: string): HeadingLocation {
  const target = headingName.trim().toLowerCase();
  if (!target) return NOT_FOUND;

  for (let i = 0; i < lines.length; i++) {
    const match = HEADING_PATTERN.exec(lines[i]);
    if (match && match[2].trim().toLowerCase() === target) {
      return { index: i, level: match[1].length };
    }
  }

  return NOT_FOUND;
}

export interface BodySection {
  exists: boolean;
  /**
   * The content between the heading and the next heading of any level,
   * trimmed. Empty when the heading is absent, and also empty when the
   * section opens directly with a sub-heading, which is why grouped sections
   * use their own splitters rather than this.
   */
  content: string;
}

export function extractSection(lines: string[], headingName: string): BodySection {
  const { index } = findHeading(lines, headingName);
  if (index < 0) return { exists: false, content: '' };

  let end = index + 1;
  while (end < lines.length && !ANY_HEADING.test(lines[end])) end++;

  return {
    exists: true,
    content: lines
      .slice(index + 1, end)
      .join('\n')
      .trim(),
  };
}

/**
 * The free text before the first heading of any level.
 *
 * A meal's description sits here, between the frontmatter and the first
 * section, with no heading of its own to anchor on. A note with no headings
 * at all is therefore entirely description, which is the right answer for a
 * meal somebody has started but not structured yet.
 */
export function extractLeadingText(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    if (ANY_HEADING.test(lines[i])) return lines.slice(0, i).join('\n').trim();
  }
  return lines.join('\n').trim();
}

/**
 * Removes the YAML frontmatter block, returning the body.
 *
 * A note with no frontmatter, or with an unterminated block, is returned
 * unchanged rather than truncated. An unterminated block is a note somebody
 * is midway through editing, and eating the rest of the file would look like
 * the plugin had lost it.
 */
export function stripFrontmatter(contents: string): string {
  return splitFrontmatterBlock(contents).body;
}
