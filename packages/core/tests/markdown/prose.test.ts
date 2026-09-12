/**
 * A note's own words as the blocks something that is not Obsidian has to
 * print.
 *
 * Written against a real failure rather than in advance: the first prospect
 * anybody printed came out with `[[Stavanger]]` in brackets and a list of
 * highlights as a run of lines each opening with a hyphen. The renderer was
 * handing a callout's raw text to a `<p>`, which is right for the one shape it
 * was built for and wrong for everything a person actually writes in one.
 *
 * The suite is about the shapes, not about markdown. What is deliberately
 * absent is as much of the point as what is here: `**bold**` comes out as
 * `**bold**`, and adding emphasis is a change to make when a note needs it.
 */
import { describe, expect, it } from 'vitest';
import { listIsOrdered, proseBlocks } from '../../src/markdown/prose.js';

describe('paragraphs', () => {
  it('splits on a blank line, which is what a blank line does everywhere else in a note', () => {
    expect(proseBlocks('One.\n\nTwo.')).toEqual([
      { kind: 'paragraph', text: 'One.' },
      { kind: 'paragraph', text: 'Two.' },
    ]);
  });

  /** Somebody who pressed return inside a sentence meant the break to be there. */
  it('keeps the line breaks inside one paragraph', () => {
    expect(proseBlocks('One.\nStill one.')).toEqual([
      { kind: 'paragraph', text: 'One.\nStill one.' },
    ]);
  });

  /** Empty rather than one empty block, which is what lets a sheet omit the section by asking for the length. */
  it('gives a note with no summary nothing to print', () => {
    expect(proseBlocks('')).toEqual([]);
    expect(proseBlocks('\n\n   \n\n')).toEqual([]);
  });
});

describe('lists', () => {
  it('reads a run of bullets as one list', () => {
    expect(proseBlocks('- Nordkap\n- Hammerfest')).toEqual([
      {
        kind: 'list',
        items: [
          { text: 'Nordkap', ordered: false, items: [] },
          { text: 'Hammerfest', ordered: false, items: [] },
        ],
      },
    ]);
  });

  it('takes *, - and + alike, because a note written by hand uses all three', () => {
    for (const marker of ['-', '*', '+']) {
      expect(proseBlocks(`${marker} Nordkap`), marker).toEqual([
        { kind: 'list', items: [{ text: 'Nordkap', ordered: false, items: [] }] },
      ]);
    }
  });

  it('makes an indented bullet a child of the one above it', () => {
    expect(proseBlocks('- Wichtig:\n  - Sprachen\n  - Rollstuhlgerecht?')).toEqual([
      {
        kind: 'list',
        items: [
          {
            text: 'Wichtig:',
            ordered: false,
            items: [
              { text: 'Sprachen', ordered: false, items: [] },
              { text: 'Rollstuhlgerecht?', ordered: false, items: [] },
            ],
          },
        ],
      },
    ]);
  });

  it('closes as many levels as an outdent asks for', () => {
    const [list] = proseBlocks('- a\n  - b\n    - c\n- d');

    expect(list).toEqual({
      kind: 'list',
      items: [
        {
          text: 'a',
          ordered: false,
          items: [{ text: 'b', ordered: false, items: [{ text: 'c', ordered: false, items: [] }] }],
        },
        { text: 'd', ordered: false, items: [] },
      ],
    });
  });

  /** A note indented with tabs in one place and spaces in another is still one list to whoever wrote it. */
  it('counts a tab as four columns', () => {
    const [list] = proseBlocks('- a\n\t- b');

    expect(list).toEqual({
      kind: 'list',
      items: [{ text: 'a', ordered: false, items: [{ text: 'b', ordered: false, items: [] }] }],
    });
  });

  it('reads a numbered list as numbered', () => {
    const [list] = proseBlocks('1. Erst\n2) Dann');

    expect(list?.kind === 'list' && listIsOrdered(list.items)).toBe(true);
  });

  /** The levels of one list are not obliged to agree, which is why the marker is on the item. */
  it('lets a numbered sub-list sit under a bullet', () => {
    const [list] = proseBlocks('- Ablauf\n  1. Erst\n  2. Dann');

    expect(list?.kind === 'list' && listIsOrdered(list.items)).toBe(false);
    expect(list?.kind === 'list' && listIsOrdered(list.items[0]?.items ?? [])).toBe(true);
  });

  /** The one in the Wikinger note, left after a highlight somebody deleted. */
  it('drops an empty bullet rather than printing a hyphen alone', () => {
    expect(proseBlocks('- Nordkap\n-\n- Hammerfest')).toEqual([
      {
        kind: 'list',
        items: [
          { text: 'Nordkap', ordered: false, items: [] },
          { text: 'Hammerfest', ordered: false, items: [] },
        ],
      },
    ]);
  });

  /** Re-parenting them onto the grandparent would rearrange somebody's list. */
  it('drops what was indented under an empty bullet with it', () => {
    expect(proseBlocks('- a\n-\n  - orphan\n- b')).toEqual([
      {
        kind: 'list',
        items: [
          { text: 'a', ordered: false, items: [] },
          { text: 'b', ordered: false, items: [] },
        ],
      },
    ]);
  });

  it('lets a paragraph follow a list and a list follow a paragraph', () => {
    expect(proseBlocks('Vorab.\n\n- a\n\nDanach.')).toEqual([
      { kind: 'paragraph', text: 'Vorab.' },
      { kind: 'list', items: [{ text: 'a', ordered: false, items: [] }] },
      { kind: 'paragraph', text: 'Danach.' },
    ]);
  });

  /**
   * A blank line ends whatever is open. Markdown would keep the list running;
   * doing that here would mean a blank line sometimes separates and sometimes
   * does not, and nobody can see which from the note.
   */
  it('reads two runs split by a blank line as two lists', () => {
    expect(proseBlocks('- a\n\n- b')).toHaveLength(2);
  });

  it('ends a list at the first line that is not an item', () => {
    expect(proseBlocks('- a\nDanach.')).toEqual([
      { kind: 'list', items: [{ text: 'a', ordered: false, items: [] }] },
      { kind: 'paragraph', text: 'Danach.' },
    ]);
  });

  /** A rule under the summary is prose, not a bullet with two hyphens after it. */
  it('does not read a horizontal rule as a list', () => {
    expect(proseBlocks('---')).toEqual([{ kind: 'paragraph', text: '---' }]);
  });
});

describe('wikilinks in what gets printed', () => {
  it('prints a link as the note it names', () => {
    expect(proseBlocks('Ab [[Stavanger]].')).toEqual([
      { kind: 'paragraph', text: 'Ab Stavanger.' },
    ]);
  });

  it('prints an alias, because that is what somebody wrote it for', () => {
    expect(proseBlocks('Ab [[Stavanger|die Stadt]].')).toEqual([
      { kind: 'paragraph', text: 'Ab die Stadt.' },
    ]);
  });

  it('resolves them inside a list item too', () => {
    const [list] = proseBlocks('- Besuch in [[Stavanger]]');

    expect(list).toEqual({
      kind: 'list',
      items: [{ text: 'Besuch in Stavanger', ordered: false, items: [] }],
    });
  });
});

describe('listIsOrdered', () => {
  it('is false for a level with nothing in it', () => {
    expect(listIsOrdered([])).toBe(false);
  });

  /** A level whose items disagree is one thing or the other, and the first is what the writer started with. */
  it('follows the first item when a level is mixed', () => {
    expect(
      listIsOrdered([
        { text: 'a', ordered: true, items: [] },
        { text: 'b', ordered: false, items: [] },
      ])
    ).toBe(true);
  });
});
