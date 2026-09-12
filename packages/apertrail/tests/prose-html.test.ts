/**
 * A note's own words on paper.
 *
 * The prospect and the trip document both print the summary callout, and both
 * were printing it as raw text: a list of highlights came out as a run of
 * lines each opening with a hyphen, and `[[Stavanger]]` came out with its
 * brackets. Reported off a real Wikinger prospect.
 *
 * The core reads the callout into blocks and this turns blocks into markup,
 * and the split is the one `print-sheet.ts` exists for: everything that
 * reaches paper is escaped here. A parser that returned markup would have
 * handed this function a string it could no longer escape, and a note is user
 * input.
 */
import { describe, expect, it } from 'vitest';
import { proseBlocks } from '@technosoftware/trail-core';
import { pageText, proseHtml, proseSections } from '../src/shared/print-sheet';

/** What a sheet actually does: the callout's text in, markup out. */
const printed = (summary: string): string => proseHtml(proseBlocks(summary));

describe('what a summary prints as', () => {
  it('sets a paragraph as a paragraph', () => {
    expect(printed('Ein Tag an Land.')).toBe('<p>Ein Tag an Land.</p>');
  });

  it('sets a run of bullets as a list rather than as hyphens', () => {
    expect(printed('- Nordkap\n- Hammerfest')).toBe('<ul><li>Nordkap</li><li>Hammerfest</li></ul>');
  });

  it('keeps a sub-list inside the item it belongs to', () => {
    expect(printed('- Wichtig:\n  - Sprachen')).toBe(
      '<ul><li>Wichtig:<ul><li>Sprachen</li></ul></li></ul>'
    );
  });

  it('numbers a numbered list', () => {
    expect(printed('1. Erst\n2. Dann')).toBe('<ol><li>Erst</li><li>Dann</li></ol>');
  });

  it('lets a level carry its own marker', () => {
    expect(printed('- Ablauf\n  1. Erst')).toBe('<ul><li>Ablauf<ol><li>Erst</li></ol></li></ul>');
  });

  it('prints a link as the word a reader sees', () => {
    expect(printed('Ab [[Stavanger|der Stadt]].')).toBe('<p>Ab der Stadt.</p>');
  });

  it('prints a paragraph and a list in the order they were written', () => {
    expect(printed('Vorab.\n\n- a')).toBe('<p>Vorab.</p><ul><li>a</li></ul>');
  });
});

/**
 * There is no branch that skips the escape, which is why this is asserted at
 * every level rather than once: a note is somebody's own typing, and a
 * highlight called `<script>` has to arrive as text.
 */
describe('nothing reaches the page unescaped', () => {
  it('escapes a paragraph', () => {
    expect(printed('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes a list item', () => {
    expect(printed('- <script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes a nested list item', () => {
    expect(printed('- a\n  - <script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes an ampersand in a place name', () => {
    expect(printed('- Fish & Chips')).toContain('Fish &amp; Chips');
  });
});

describe('what a note with no summary prints', () => {
  it('prints nothing at all, so a sheet can leave the section out', () => {
    expect(proseBlocks('')).toEqual([]);
    expect(proseHtml([])).toBe('');
  });
});

/**
 * The funnel itself.
 *
 * A summary reached paper with its links resolved because the core resolved
 * them while parsing, and a day note did not, because nothing on that path
 * ever asked. Escaping was the rule every sheet went through and resolving was
 * not, so the two now sit in one function and every sheet takes that one.
 */
describe("what a sheet does to a note's words", () => {
  it('prints a link as the word a reader wants, not as its target', () => {
    expect(pageText('Ankunft in [[Stavanger]].')).toBe('Ankunft in Stavanger.');
  });

  it('prefers the alias, which is the whole point of writing one', () => {
    expect(pageText('Weiter nach [[Stavanger|der Stadt]].')).toBe('Weiter nach der Stadt.');
  });

  it('still escapes, because resolving a link does not make a note safe', () => {
    expect(pageText('<script>[[Stavanger]]</script>')).toBe(
      '&lt;script&gt;Stavanger&lt;/script&gt;'
    );
  });

  it('leaves a path alone, so a src or an href can go through it too', () => {
    expect(pageText('Trips/Nordkap/bild.jpg')).toBe('Trips/Nordkap/bild.jpg');
  });
});

/**
 * How a summary is handed to a section.
 *
 * One paragraph goes with the heading and the rest goes after it, so the
 * heading is protected and the prose is free to break. A summary of one block
 * is one box, because a second empty one would print a gap under it.
 */
describe('a summary as section blocks', () => {
  const para = (text: string) => ({ kind: 'paragraph' as const, text });

  it('has nothing to say about a note with no summary', () => {
    expect(proseSections([])).toEqual([]);
  });

  it('puts a single block in one box', () => {
    expect(proseSections([para('Ein Satz.')])).toEqual([
      '<div class="overview prose"><p>Ein Satz.</p></div>',
    ]);
  });

  it('splits the first block off from the rest', () => {
    expect(proseSections([para('Eins.'), para('Zwei.'), para('Drei.')])).toEqual([
      '<div class="overview prose"><p>Eins.</p></div>',
      '<div class="overview prose"><p>Zwei.</p><p>Drei.</p></div>',
    ]);
  });
});
