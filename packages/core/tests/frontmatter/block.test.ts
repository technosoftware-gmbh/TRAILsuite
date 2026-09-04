/**
 * Splitting a frontmatter block off, and building the object that goes into one.
 *
 * The split exists because rebuilding a note from its parsed sections starts at
 * the first heading, and without it that rebuild drops the note's own
 * properties. It did, on every grocery-list edit, until it was found.
 */
import { describe, expect, it } from 'vitest';
import { frontmatterObject, splitFrontmatterBlock } from '../../src/frontmatter/block';
import { createdEntry } from '../../src/frontmatter/stamps';

const PROPERTIES = { createdProperty: 'created', modifiedProperty: 'modified' };
const NOW = new Date(2026, 7, 4, 16, 33);

describe('splitFrontmatterBlock', () => {
  it('separates the block, fence included, from the body', () => {
    const note = '---\ntype: recipe\ncreated: 2026-08-04T16:33\n---\n# Title\n\nBody.';
    const { header, body } = splitFrontmatterBlock(note);

    expect(header).toBe('---\ntype: recipe\ncreated: 2026-08-04T16:33\n---\n');
    expect(body).toBe('# Title\n\nBody.');
    expect(header + body).toBe(note);
  });

  it('puts a note back together byte for byte', () => {
    for (const note of ['---\na: 1\n---\nbody', 'no frontmatter at all', '---\na: 1\n---\n', '']) {
      const { header, body } = splitFrontmatterBlock(note);
      expect(header + body).toBe(note);
    }
  });

  it('treats a note with no block as all body', () => {
    expect(splitFrontmatterBlock('# Title')).toEqual({ header: '', body: '# Title' });
  });

  it('treats an unterminated block as all body, not as a truncated note', () => {
    // Somebody is midway through typing. Reading this as a block would swallow
    // the rest of the note.
    const note = '---\ntype: recipe\n# Title';
    expect(splitFrontmatterBlock(note)).toEqual({ header: '', body: note });
  });

  it('only reads a block at the very top', () => {
    const note = 'A line first.\n---\nnot frontmatter\n---\n';
    expect(splitFrontmatterBlock(note).header).toBe('');
  });

  it('keeps a horizontal rule further down in the body', () => {
    const note = '---\na: 1\n---\nBefore\n\n---\n\nAfter';
    const { header, body } = splitFrontmatterBlock(note);
    expect(header).toBe('---\na: 1\n---\n');
    expect(body).toBe('Before\n\n---\n\nAfter');
  });
});

describe('frontmatterObject', () => {
  it('orders the keys type, created, then the rest', () => {
    const object = frontmatterObject('type', 'recipe', createdEntry(PROPERTIES, NOW), {
      servings: 4,
      country: '[[Switzerland]]',
    });

    expect(Object.keys(object)).toEqual(['type', 'created', 'servings', 'country']);
    expect(object.created).toBe('2026-08-04T16:33');
  });

  it('leaves no gap when the stamp is switched off', () => {
    const blank = { createdProperty: '', modifiedProperty: '' };
    const object = frontmatterObject('type', 'recipe', createdEntry(blank, NOW), { servings: 4 });

    expect(Object.keys(object)).toEqual(['type', 'servings']);
  });

  it('honours a renamed type property', () => {
    const object = frontmatterObject('kind', 'recipe', {}, {});
    expect(object).toEqual({ kind: 'recipe' });
  });

  it('lets the rest override nothing it should not', () => {
    // `rest` spreads last, so a caller that passes its own `type` wins. That is
    // the documented order and worth pinning: a builder assembling a large
    // schema puts type first itself.
    const object = frontmatterObject('type', 'recipe', {}, { type: 'order' });
    expect(object.type).toBe('order');
    expect(Object.keys(object)).toEqual(['type']);
  });
});
