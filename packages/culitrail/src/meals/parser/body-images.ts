/**
 * Finding image references in a note body.
 *
 * Two syntaxes, because Obsidian accepts both: its own `![[embed]]` and
 * CommonMark's `![alt](target)`. An imported meal usually carries the
 * second, a hand-written one the first, and a vault ends up with both.
 *
 * App-free.
 */

/** Matches either image syntax, capturing the embed target in group 1 and the Markdown target in group 2. */
const IMAGE_TOKEN = /!\[\[([^\]\n]+)\]\]|!\[[^\]\n]*\]\(([^)\n]+)\)/g;

/**
 * The bare target of an image reference: `![[photo.jpg|thumb]]` becomes
 * `photo.jpg`.
 *
 * An alias and an anchor are both dropped, because what the caller wants is
 * the thing to resolve, not how the note chose to display it.
 */
export function resolveImageTarget(value: string): string {
  const embed = /^!?\[\[([^\]#|]+)/.exec(value);
  return embed ? embed[1].trim() : value.trim();
}

/**
 * The destination of a Markdown image, minus the parts that are not the path.
 *
 * CommonMark allows both an angle-bracketed destination and a trailing quoted
 * title, and a meal scraped off a website tends to carry the title.
 */
function markdownImageTarget(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    if (end > 1) return trimmed.slice(1, end).trim() || null;
  }

  return trimmed.split(/\s+/)[0]?.trim() || null;
}

/** The first image referenced in the body, in reading order, or null. */
export function findFirstImageInBody(body: string): string | null {
  // The regex is module-level and global, so its lastIndex survives between
  // calls. Resetting it here is what stops the second meal rendered in a
  // session from starting its search halfway down the note.
  IMAGE_TOKEN.lastIndex = 0;

  const match = IMAGE_TOKEN.exec(body);
  if (!match) return null;
  if (match[1]) return resolveImageTarget(`![[${match[1]}]]`) || null;
  if (match[2]) return markdownImageTarget(match[2]);
  return null;
}
