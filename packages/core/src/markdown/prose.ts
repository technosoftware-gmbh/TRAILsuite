/**
 * A block of a note's own words, as something that is not Obsidian has to
 * print it: paragraphs, and lists that keep their nesting.
 *
 * The summary callout is where these vaults keep what a note is about, and it
 * is written in the vault's own markdown -- `- ` bullets, wikilinks, blank
 * lines between paragraphs. Everything that renders it inside Obsidian gets
 * that for free. Everything that renders it anywhere else was passing the text
 * through as-is, so a brochure printed `[[Stavanger]]` with the brackets and a
 * list of highlights as a run of lines each opening with a hyphen.
 *
 * **It is here because the callout's contents are a note format**, the same
 * argument that put the block itself in `summary-block.ts`: what a `- ` line
 * means is a statement about the file, the notes outlive every sheet built
 * over them, and the two exports that print one were about to answer the
 * question twice.
 *
 * **A model, not markup.** What comes back says "this is a list of three
 * items, one of them with two children"; turning that into HTML, into a PDF or
 * into anything else is the caller's, and it has to be, because a sheet
 * escapes what it prints and a parser that emitted markup would be handing it
 * a string it could no longer escape.
 *
 * Deliberately not a markdown implementation. It reads the shapes these
 * callouts are actually written in and leaves the rest of the language alone:
 * `**bold**` prints as `**bold**` today, and adding emphasis is a change to
 * make when a note needs it rather than in advance.
 *
 * App-free and pure.
 */
import { displayWikilinks } from '../links/wikilink.js';

/** One item of a list, and whatever is indented under it. */
export interface ProseListItem {
  text: string;
  /**
   * How this item's own marker was written: `1.` against `-`.
   *
   * On the item rather than on the list because the levels of one list are
   * not obliged to agree, and a numbered sub-list under a bullet is a thing
   * people write. `listIsOrdered` is how a renderer asks the question for a
   * level.
   */
  ordered: boolean;
  /** Empty for an item with nothing under it, which is most of them. */
  items: ProseListItem[];
}

/**
 * Whether a level of a list is numbered, which its first item decides.
 *
 * A level whose items disagree has to be rendered as one thing or the other,
 * and the first is the one the writer started with.
 */
export function listIsOrdered(items: readonly ProseListItem[]): boolean {
  return items[0]?.ordered ?? false;
}

/**
 * One block of a summary: a run of prose, or a list.
 *
 * A paragraph keeps its own line breaks. Somebody who pressed return inside a
 * sentence meant the break to be there, and a sheet that reflowed it would be
 * disagreeing with the note.
 */
export type ProseBlock =
  { kind: 'paragraph'; text: string } | { kind: 'list'; items: ProseListItem[] };

/** `- item`, `* item`, `+ item`. The indent is captured because it is what says whose child an item is. */
const BULLET = /^(\s*)[-*+](?:\s+(.*))?$/;
/** `1. item`, `2) item`. */
const NUMBERED = /^(\s*)\d+[.)](?:\s+(.*))?$/;

interface ListLine {
  indent: number;
  ordered: boolean;
  text: string;
}

/**
 * A summary's text as the blocks that print it.
 *
 * **A blank line ends whatever is open**, list or paragraph, which is the rule
 * the paragraph split already used and the one these callouts are written to.
 * Markdown would keep a list running across a blank line; doing that here
 * would mean a blank line sometimes separates and sometimes does not, and a
 * person cannot see which from the note.
 *
 * A line that is not a list item ends a list and opens a paragraph. So does a
 * wrapped bullet, which is the known cost of the previous paragraph and the
 * reason to keep one item on one line.
 *
 * **An empty bullet is dropped.** `- ` with nothing after it is what a list
 * somebody was still writing looks like, and a hyphen alone on a brochure
 * reads as a mistake in the brochure. It is dropped rather than kept empty for
 * the same reason `bulletItems` drops it.
 */
export function proseBlocks(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let paragraph: string[] = [];
  let list: ListLine[] = [];

  const closeParagraph = (): void => {
    const joined = paragraph.join('\n').trim();
    if (joined !== '') blocks.push({ kind: 'paragraph', text: displayWikilinks(joined) });
    paragraph = [];
  };

  const closeList = (): void => {
    // The whole run may have been empty bullets, which leaves no list at all.
    const items = nest(list);
    if (items.length > 0) blocks.push({ kind: 'list', items });
    list = [];
  };

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      closeParagraph();
      closeList();
      continue;
    }

    const item = listLine(line);
    if (item) {
      closeParagraph();
      list.push(item);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  closeParagraph();
  closeList();
  return blocks;
}

/** A line as a list item, or null. A numbered list is checked first: `1. ` is not a bullet. */
function listLine(line: string): ListLine | null {
  const numbered = NUMBERED.exec(line);
  const match = numbered ?? BULLET.exec(line);
  if (!match) return null;

  return {
    indent: indentWidth(match[1] ?? ''),
    ordered: numbered !== null,
    text: (match[2] ?? '').trim(),
  };
}

/** A tab counts as four columns, which is what Obsidian's own indent is set to out of the box. */
function indentWidth(leading: string): number {
  return [...leading].reduce((width, char) => width + (char === '\t' ? 4 : 1), 0);
}

/**
 * The flat lines as a tree.
 *
 * An item deeper than the one above it becomes its child; an item shallower
 * than its parent closes as many levels as it has to. The comparison is
 * against the levels actually open rather than against a fixed step, because
 * a note indented with two spaces in one place and a tab in another is still
 * one list to the person who wrote it.
 *
 * An item with no text is dropped, and its children with it: they were
 * indented under something that says nothing, and re-parenting them onto its
 * grandparent would rearrange somebody's list.
 */
function nest(lines: readonly ListLine[]): ProseListItem[] {
  const root: ProseListItem[] = [];
  const open: { indent: number; items: ProseListItem[] }[] = [{ indent: -1, items: root }];
  /** The indent under which everything is being dropped, or null. */
  let skipping: number | null = null;

  for (const line of lines) {
    if (skipping !== null) {
      if (line.indent > skipping) continue;
      skipping = null;
    }

    while (open.length > 1 && line.indent <= (open[open.length - 1]?.indent ?? -1)) open.pop();

    if (line.text === '') {
      skipping = line.indent;
      continue;
    }

    const item: ProseListItem = {
      text: displayWikilinks(line.text),
      ordered: line.ordered,
      items: [],
    };
    open[open.length - 1]?.items.push(item);
    open.push({ indent: line.indent, items: item.items });
  }

  return root;
}
