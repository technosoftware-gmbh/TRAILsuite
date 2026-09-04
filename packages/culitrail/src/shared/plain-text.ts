/**
 * Markdown reduced to the words in it.
 *
 * For places that need a one-line preview rather than rendered output: the
 * mobile description snippet, and later the gallery card and the exporters.
 * Deliberately crude. It removes the markup that reads as noise in a snippet
 * and leaves everything else alone, because a snippet that quietly drops half
 * a sentence is worse than one carrying a stray asterisk.
 *
 * App-free.
 */

/** An image, in either syntax. Dropped entirely: a snippet has nowhere to put a picture. */
const IMAGE = /!\[[^\]]*\]\([^)]*\)|!\[\[[^\]]*\]\]/g;

/** A wikilink, capturing target and optional alias separately. */
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Replacements that keep their inner text. Applied after the two above. */
const INLINE: Array<[RegExp, string]> = [
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'], // Markdown link, keeping the text
  [/^\s*#{1,6}\s+/gm, ''], // Heading hashes
  [/\*\*(.+?)\*\*/g, '$1'],
  [/\*(.+?)\*/g, '$1'],
  [/`(.+?)`/g, '$1'],
];

export function toPlainText(markdown: string): string {
  // Images first: an image is a link with a `!` in front, so removing links
  // first would leave the exclamation mark and the alt text behind.
  let text = markdown.replace(IMAGE, '');

  // The alias when there is one, since that is what a reader was meant to
  // see, and the target otherwise.
  text = text.replace(WIKILINK, (_match, target: string, alias?: string) =>
    (alias ?? target).split('#')[0].trim()
  );

  for (const [pattern, replacement] of INLINE) text = text.replace(pattern, replacement);

  // Every newline becomes a space: this is for a single-line preview, and a
  // paragraph break rendered as a line break would make the snippet taller
  // than the space reserved for it.
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
