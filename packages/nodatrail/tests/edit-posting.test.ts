/**
 * Which postings were written as one entry.
 *
 * A split's header is not a posting; only its legs are. So correcting a split
 * means finding its siblings from one of them, and the first attempt at that
 * grouped them by the header's description.
 *
 * **That was wrong, and a real vault proved it.** A split is allowed to have no
 * description, and three of the five in the vault this was tested against had
 * none. Every leg of those then looked like a posting of its own, and rewriting
 * one would have replaced the whole split with that single leg -- losing the
 * other legs and the total they had to sum to, silently, in a file the person
 * had just committed as safe.
 *
 * Grouping is by `entryLine`, which every leg carries and which no description
 * can be missing.
 */
import { describe, expect, it } from 'vitest';
import { extractJournalBlocks, parseJournal, type Posting } from '@technosoftware/trail-core';
import { entryPostings } from '../src/ledger/edit-posting';
import { postingBlockAt, replacePostingBlock } from '../src/ledger/journal-text';

/** The real shape: a described split, an undescribed split, and a plain posting. */
const NOTE = [
  '```noda-journal',
  '2026-01-01 |  | 2022 | CHF 3838.40 |  | Prov. Steuern 2025',
  '    5001 | 6574.05 | Veranlagung 2025',
  '    5001 | -2735.65 | Umbuchung 2024',
  '2026-01-01 | 4039 | 2011 | CHF 2670.40 | SONY Alpha Kamera | 130843226',
  '2026-01-12 |  | 2010 | CHF 1875.20 |  | 2112644264',
  '    4000 | 155.70 | Tomtasty Bestellung #21383',
  '    4000 | 121.60 | Tomtasty Bestellung #21739',
  '    4000 | 92.15 | Tomtasty Bestellung #22008',
  '    4036 | 1505.75 | Diverses',
  '```',
].join('\n');

function read(): Posting[] {
  const out: Posting[] = [];
  for (const block of extractJournalBlocks(NOTE)) {
    out.push(...parseJournal(block.source, block.fenceLine + 1).postings);
  }
  return out;
}

describe('grouping the legs of a split that has no description', () => {
  const postings = read();

  it('reads them as postings carrying no splitOf at all', () => {
    // The premise. If this ever changes, the bug this guards against is gone.
    const taxLegs = postings.filter((p) => p.text.startsWith('Veranlagung'));
    expect(taxLegs[0]?.splitOf).toBeNull();
  });

  it('still gathers both legs of the undescribed tax split', () => {
    const leg = postings.find((p) => p.text === 'Umbuchung 2024');
    expect(leg).toBeDefined();
    expect(entryPostings(postings, leg)).toHaveLength(2);
  });

  it('gathers all four legs of the undescribed card split', () => {
    const leg = postings.find((p) => p.text === 'Diverses');
    expect(entryPostings(postings, leg)).toHaveLength(4);
  });

  it('does not mix the two undescribed splits together', () => {
    const tax = postings.find((p) => p.text === 'Umbuchung 2024');
    const card = postings.find((p) => p.text === 'Diverses');
    expect(entryPostings(postings, tax)).not.toContain(card);
  });

  it('leaves a plain posting alone', () => {
    const plain = postings.find((p) => p.text === 'SONY Alpha Kamera');
    expect(entryPostings(postings, plain)).toEqual([plain]);
  });

  it('points every leg at the line its entry starts on', () => {
    const card = postings.filter((p) => p.text.startsWith('Tomtasty'));
    for (const leg of card) expect(leg.entryLine).toBe(6);
  });
});

describe('what the old grouping would have destroyed', () => {
  it('rewrites the whole split, not one leg of it', () => {
    const postings = read();
    const leg = postings.find((p) => p.text === 'Diverses');
    const entry = entryPostings(postings, leg);

    // The editor opens on the entry's first line, which is the header.
    const span = postingBlockAt(NOTE, entry[0]?.entryLine ?? 0);
    expect(span).toEqual({ from: 6, to: 10 });

    const after = replacePostingBlock(NOTE, entry[0]?.entryLine ?? 0, [
      '2026-01-12 | 4000 | 2010 | CHF 1875.20 | Cornercard',
    ]);
    // The other three legs go with it, rather than being orphaned under a
    // header that no longer exists.
    expect(after).not.toContain('Tomtasty Bestellung #21383');
    expect(after).not.toContain('Diverses');
    // And nothing outside the entry is touched.
    expect(after).toContain('Veranlagung 2025');
    expect(after).toContain('SONY Alpha Kamera');
  });
});
