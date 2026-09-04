/**
 * A note's frontmatter block as lines, for the two scripts that edit one.
 *
 * The migration inserts four keys above the closing `---` and the verifier
 * takes them back out again to compare what is left, and both need the same
 * three things: where the block ends, what its YAML says, and what the body
 * under it is. `splitFrontmatterBlock` in `trail-core` answers the last two but
 * not the first, because nothing in the plugin edits a block by line: Obsidian's
 * `processFrontMatter` hands the editor an object and serialises the result
 * itself.
 *
 * **A script has no Obsidian, and that is why this is line-oriented.** Parsing a
 * block and writing it back out reformats every key in it, which turns a
 * four-key addition into a diff nobody can read and quietly overrules every
 * quoting and ordering decision the vault made. `strip-meal-rating.ts` next door
 * takes a key out the same way and for the same reason.
 *
 * Nothing here interprets a nutrient, a heading or a setting. It is the block
 * and the body, and nobody's opinion about either.
 */
import { parse as parseYaml } from 'yaml';

export interface FrontmatterBlock {
  /** Every line of the note, split on `\n`, so a CRLF note keeps its `\r`. */
  lines: string[];
  /** The index of the closing `---`, which is where a new key goes. */
  close: number;
  /** The block's own text, fences excluded, ready for a YAML parser. */
  yaml: string;
  /** The lines under the block, which is what the section readers want. */
  body: string[];
}

/**
 * The block, or null for a note that has none.
 *
 * Split on `\n` alone and never on `\r\n`, so joining the lines back with `\n`
 * reproduces the file byte for byte whichever ending it uses. A line inserted
 * into a CRLF note has to carry its own `\r`; see `carriageReturn`.
 */
export function frontmatterOf(text: string): FrontmatterBlock | null {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return null;

  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close === -1) return null;

  return {
    lines,
    close,
    yaml: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1),
  };
}

/** True when the note's lines end `\r\n`, which a line added to it must too. */
export function carriageReturn(text: string): boolean {
  return text.includes('\r\n');
}

/**
 * The frontmatter as an object, or null when it does not parse.
 *
 * Null rather than an empty object, because the two are different notes and
 * only one of them is safe to write to: frontmatter nothing can read is
 * frontmatter nothing should touch.
 */
export function parseFrontmatter(yaml: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
  } catch {
    return null;
  }

  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

/**
 * The top-level keys the block's text states, in order, duplicates and all.
 *
 * Read off the lines rather than off the parsed object on purpose. A duplicate
 * key is the failure an object cannot show: some parsers tolerate one and hand
 * back the last, this one refuses the whole block, and Obsidian drops the note
 * out of every view. Off the lines, the duplicate can be named, which is the
 * difference between a report somebody can act on and "it does not parse".
 */
export function headerKeys(yaml: string): string[] {
  const keys: string[] = [];
  for (const line of yaml.split('\n')) {
    const match = /^([^\s#][^:]*):/.exec(line);
    if (match) keys.push(match[1].trim());
  }
  return keys;
}
