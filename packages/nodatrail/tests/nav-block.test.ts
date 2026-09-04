/**
 * Taking the navigation block off a period note.
 *
 * The block is gone as a feature: the plan view is how you move between
 * periods now. What survives is the finder, and the finder is what was hard --
 * recognising a block by its shape at the top of a body, in a vault whose notes
 * spell it two ways.
 *
 * **The fixtures are real.** Both spacings below were copied out of the
 * Stefan-Life vault: the day notes have no space around the arrows and the
 * week, month and year notes have one. A stripper that only knew one shape
 * would have left 60 week notes carrying a block while reporting success.
 *
 * The rule this file exists to hold is the one about the `---`. The migrated
 * week notes put a horizontal rule on the line after the block, and it belongs
 * to the content. Taking it would be taking somebody's formatting while
 * claiming to remove navigation, and it is exactly the kind of thing that is
 * noticed months later in a note nobody has opened since.
 */
import { describe, expect, it } from 'vitest';
import { hasNavigationBlock, stripNavigationBlock } from '../src/plan/nav-block';

/** A day note's block: no space around the arrows. */
const TIGHT = [
  '⏮️[[2026|Yearly]] > [[2026-Q3|Quarterly]] > [[2026-07|Monthly]] > [[2026-W30|Weekly]]⏭️',
  '',
  '⬅️[[2026-07-20|Juli 20, 2026]] < Juli 21, 2026 > [[2026-07-22|Juli 22, 2026]]➡️',
].join('\n');

/** A week note's block: a space around the arrows, and a chain one level shorter. */
const LOOSE = [
  '⏮️ [[2026|Yearly]] > [[2026-Q3|Quarterly]] > [[2026-07|Monthly]] ⏭️',
  '',
  '⬅️ [[2026-W27|Week 27]] < Week 28 > [[2026-W29|Week 29]] ➡️',
].join('\n');

describe('finding a block', () => {
  it('recognises both spellings the vault holds', () => {
    expect(hasNavigationBlock(`${TIGHT}\n\ntext`)).toBe(true);
    expect(hasNavigationBlock(`${LOOSE}\n\ntext`)).toBe(true);
  });

  it('says no to a body that has none', () => {
    expect(hasNavigationBlock('\n\n# Heading')).toBe(false);
    expect(hasNavigationBlock('')).toBe(false);
  });

  it('looks only at the top, so an arrow further down is somebody writing', () => {
    // A line about a move, in a diary. It is not navigation and must not make
    // the note look like it carries a block.
    expect(hasNavigationBlock('# Umzug\n\n⬅️ zurück nach Zürich')).toBe(false);
  });
});

describe('stripping it', () => {
  it('takes the block and leaves the content', () => {
    expect(stripNavigationBlock(`${TIGHT}\n\n# Gedanken\n\n- Erika angerufen.`)).toBe(
      '# Gedanken\n\n- Erika angerufen.'
    );
  });

  it('leaves the horizontal rule the week notes carry under the block', () => {
    // The one that matters. That `---` is migrated formatting, not ours.
    const body = `${LOOSE}\n\n---\n\n**Week 28, Juli 2026**\n`;
    expect(stripNavigationBlock(body)).toBe('---\n\n**Week 28, Juli 2026**\n');
  });

  it('is idempotent, because the second run finds nothing to do', () => {
    const once = stripNavigationBlock(`${TIGHT}\n\ntext`);
    expect(stripNavigationBlock(once)).toBe(once);
  });

  it('returns a body with no block byte for byte, blank lines included', () => {
    // Not trimming somebody's file is the point: the only reason the old writer
    // touched leading blanks was that it had a block to put in their place.
    const body = '\n\n# Heading\n\ntext';
    expect(stripNavigationBlock(body)).toBe(body);
    expect(stripNavigationBlock('')).toBe('');
  });

  it('empties a note that was nothing but a block', () => {
    // 22 of the vault's plan notes are this: frontmatter, a block, and no
    // content at all.
    expect(stripNavigationBlock(`${TIGHT}\n`)).toBe('');
  });

  it('stops at the first line that is neither nav nor blank', () => {
    // A heading immediately under the block, with no blank line between them.
    expect(stripNavigationBlock(`${TIGHT}\n# Heading`)).toBe('# Heading');
  });
});
