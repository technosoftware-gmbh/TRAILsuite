/**
 * Putting a posting into a note that already has things in it.
 *
 * The rule under test: everything that was in the note is still in the note.
 * A writer that reformatted somebody's journal, or dropped their prose, would
 * be a writer they stop letting near the folder.
 */
import { describe, expect, it } from 'vitest';
import {
  emptyJournalBody,
  insertPosting,
  postingBlockAt,
  removePostingBlock,
  replacePostingBlock,
} from '../src/ledger/journal-text';

const NOTE = [
  '# August 2026',
  '',
  'Bargeld noch nachtragen.',
  '',
  '```noda-journal',
  '2026-08-04 | 4001 | 1005 | 128.45 | IBB',
  '2026-08-20 | 4003 | 1005 | 79.00 | Swisscom',
  '```',
  '',
  'Ende.',
].join('\n');

function blockOf(markdown: string): string[] {
  const lines = markdown.split('\n');
  const open = lines.findIndex((line) => line.startsWith('```noda-journal'));
  const close = lines.findIndex((line, index) => index > open && line.trim() === '```');
  return lines.slice(open + 1, close);
}

describe('insertPosting', () => {
  it('puts a posting in date order inside the block', () => {
    const written = insertPosting(NOTE, '2026-08-11 | 4004 | 1005 | 220.00 | Katzen');
    expect(blockOf(written).map((line) => line.slice(0, 10))).toEqual([
      '2026-08-04',
      '2026-08-11',
      '2026-08-20',
    ]);
  });

  it('appends one dated after everything already there', () => {
    const written = insertPosting(NOTE, '2026-08-31 | 4004 | 1005 | 10.00 | spaet');
    expect(blockOf(written).at(-1)).toContain('spaet');
  });

  it('leaves the prose on both sides alone', () => {
    const written = insertPosting(NOTE, '2026-08-11 | 4004 | 1005 | 220.00 | Katzen');
    expect(written).toContain('Bargeld noch nachtragen.');
    expect(written.trimEnd().endsWith('Ende.')).toBe(true);
  });

  it('makes a block rather than dropping the posting, when the note has none', () => {
    const written = insertPosting(
      '# August 2026\n\nNur Text.\n',
      '2026-08-04 | 4001 | 1005 | 1.00 | x'
    );
    expect(written).toContain('```noda-journal');
    expect(blockOf(written)).toEqual(['2026-08-04 | 4001 | 1005 | 1.00 | x']);
    expect(written).toContain('Nur Text.');
  });

  it('writes into an empty block without leaving a blank line in it', () => {
    const written = insertPosting(
      emptyJournalBody('2026-08'),
      '2026-08-04 | 4001 | 1005 | 1.00 | x'
    );
    expect(blockOf(written)).toEqual(['2026-08-04 | 4001 | 1005 | 1.00 | x']);
  });

  it('steps over the continuation lines of a split rather than landing inside one', () => {
    const split = [
      '```noda-journal',
      '2026-08-04 | | 1005 | 250.00 | Migros',
      '    4000 | 180.00',
      '    4004 | 70.00',
      '2026-08-20 | 4003 | 1005 | 79.00 | Swisscom',
      '```',
    ].join('\n');
    const written = insertPosting(split, '2026-08-11 | 4004 | 1005 | 12.00 | Zwischendurch');
    expect(blockOf(written)).toEqual([
      '2026-08-04 | | 1005 | 250.00 | Migros',
      '    4000 | 180.00',
      '    4004 | 70.00',
      '2026-08-11 | 4004 | 1005 | 12.00 | Zwischendurch',
      '2026-08-20 | 4003 | 1005 | 79.00 | Swisscom',
    ]);
  });

  it('touches only the first block when a note has two', () => {
    const two = `${NOTE}\n\n\`\`\`noda-journal\n2026-08-28 | 4000 | 1005 | 5.00 | zweiter Block\n\`\`\`\n`;
    const written = insertPosting(two, '2026-08-05 | 4004 | 1005 | 1.00 | neu');
    expect(written).toContain('zweiter Block');
    expect(written.match(/noda-journal/g)).toHaveLength(2);
  });
});

describe('emptyJournalBody', () => {
  it('is a heading and an empty block', () => {
    expect(emptyJournalBody('2026-08')).toBe('# 2026-08\n\n```noda-journal\n```\n');
  });
});

describe('finding the posting a line belongs to', () => {
  const note = [
    '# 2026-01',
    '',
    '```noda-journal',
    '2026-01-01 | 4031 | 1011 | CHF 30.35 | Musterversicherung',
    '2026-01-05 |  | 2022 | CHF 3838.40 | Prov. Steuern 2025',
    '    5001 | 6574.05 | Veranlagung 2025',
    '    5001 | -2735.65 | Umbuchung 2024',
    '2026-01-09 | 4034 | 1011 | CHF 29.10 | Swisscom',
    '```',
    '',
  ].join('\n');

  it('finds a simple posting as one line', () => {
    expect(postingBlockAt(note, 4)).toEqual({ from: 4, to: 4 });
  });

  it('finds a split from its header', () => {
    expect(postingBlockAt(note, 5)).toEqual({ from: 5, to: 7 });
  });

  it('finds the same split from either of its legs', () => {
    // A view lists a split as one row per leg, so the row somebody clicks is a
    // leg. Both must reach the whole posting.
    expect(postingBlockAt(note, 6)).toEqual({ from: 5, to: 7 });
    expect(postingBlockAt(note, 7)).toEqual({ from: 5, to: 7 });
  });

  it('does not swallow the posting after a split', () => {
    expect(postingBlockAt(note, 8)).toEqual({ from: 8, to: 8 });
  });

  it('is null for a line outside the note', () => {
    expect(postingBlockAt(note, 0)).toBeNull();
    expect(postingBlockAt(note, 99)).toBeNull();
  });
});

describe('rewriting a posting in place', () => {
  const note = [
    '```noda-journal',
    '2026-01-01 | 4031 | 1011 | CHF 30.35 | Musterversicherung',
    '2026-01-05 |  | 2022 | CHF 3838.40 | Prov. Steuern 2025',
    '    5001 | 6574.05 | Veranlagung 2025',
    '    5001 | -2735.65 | Umbuchung 2024',
    '```',
  ].join('\n');

  it('replaces a simple posting and leaves the rest alone', () => {
    const after = replacePostingBlock(note, 2, [
      '2026-01-01 | 4031 | 1011 | CHF 30.40 | Musterversicherung',
    ]);
    expect(after).toContain('CHF 30.40');
    expect(after).toContain('Prov. Steuern 2025');
    expect(after?.split('\n')).toHaveLength(6);
  });

  it('replaces a whole split, legs and all, from a leg', () => {
    const after = replacePostingBlock(note, 4, [
      '2026-01-05 | 5001 | 2022 | CHF 3838.40 | Steuern',
    ]);
    expect(after).not.toContain('Veranlagung 2025');
    expect(after).not.toContain('Umbuchung 2024');
    expect(after).toContain('2026-01-05 | 5001 | 2022 | CHF 3838.40 | Steuern');
    expect(after).toContain('Musterversicherung');
  });

  it('removes a posting entirely, which is what a duplicate needs', () => {
    const after = removePostingBlock(note, 3);
    expect(after).not.toContain('Prov. Steuern');
    expect(after).not.toContain('Veranlagung 2025');
    expect(after).toContain('Musterversicherung');
    // The fence survives: a note that lost its block would lose every posting.
    expect(after).toContain('```noda-journal');
  });

  it('keeps the closing fence when the last posting goes', () => {
    const after = removePostingBlock(note, 3);
    expect(after?.trimEnd().endsWith('```')).toBe(true);
  });

  it('is null when the line names no posting', () => {
    expect(replacePostingBlock(note, 99, ['x'])).toBeNull();
  });
});
