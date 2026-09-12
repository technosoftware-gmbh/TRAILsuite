/**
 * The journal, which is typed by hand and therefore full of mistakes.
 *
 * The rule under test everywhere here: a bad line is reported and the good ones
 * still come back. A parser that threw would lose a month of somebody's money
 * to one mistyped date.
 */
import { describe, expect, it } from 'vitest';
import {
  extractJournalBlocks,
  formatPosting,
  parseAmount,
  parseJournal,
} from '../../src/ledger/journal.js';

describe('parseAmount', () => {
  it('reads a plain figure', () => {
    expect(parseAmount('128.45')?.amount).toBe(128.45);
  });

  it('reads a currency on either side', () => {
    expect(parseAmount('CHF 128.45')).toMatchObject({ amount: 128.45, currency: 'CHF' });
    expect(parseAmount('128.45 chf')).toMatchObject({ amount: 128.45, currency: 'CHF' });
  });

  it('reads the Swiss, English and German ways of writing a thousand', () => {
    expect(parseAmount("1'234.50")?.amount).toBe(1234.5);
    expect(parseAmount('1,234.50')?.amount).toBe(1234.5);
    expect(parseAmount('1.234,50')?.amount).toBe(1234.5);
    expect(parseAmount('1234,50')?.amount).toBe(1234.5);
  });

  it('reads a conversion with the rate that was actually used', () => {
    expect(parseAmount('EUR 200.00 = CHF 189.60')).toEqual({
      amount: 200,
      currency: 'EUR',
      counterAmount: 189.6,
      counterCurrency: 'CHF',
    });
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('einige')).toBeNull();
    expect(parseAmount('12.34.56')).toBeNull();
  });
});

describe('the simple form', () => {
  const { postings, problems } = parseJournal(
    [
      '2026-08-04 | 4001 | 1005 | 128.45 | IBB Strom August | [[IBB 2026-08]]',
      '',
      '# a comment, and the blank line above',
      '2026-08-25 | 1005 | 3010 | 7412.00 | Lohn August',
    ].join('\n')
  );

  it('reads both lines and nothing else', () => {
    expect(problems).toEqual([]);
    expect(postings).toHaveLength(2);
  });

  it('puts the debit first, as the printed chart is read', () => {
    expect(postings[0]).toMatchObject({
      date: '2026-08-04',
      debit: 4001,
      credit: 1005,
      amount: 128.45,
      text: 'IBB Strom August',
      reference: '[[IBB 2026-08]]',
    });
  });

  it('reports the line a posting came from, for pointing at it later', () => {
    expect(postings[0]?.line).toBe(1);
    expect(postings[1]?.line).toBe(4);
  });
});

describe('the split form', () => {
  const source = [
    '2026-08-04 | | 1005 | 250.00 | Migros August',
    '    4000 | 180.00 | Lebensmittel',
    '    4004 | 70.00 | Katzenfutter',
  ].join('\n');

  it('expands into one posting per leg, sharing the account that paid', () => {
    const { postings, problems } = parseJournal(source);
    expect(problems).toEqual([]);
    expect(postings).toHaveLength(2);
    expect(postings.map((p) => [p.debit, p.credit, p.amount])).toEqual([
      [4000, 1005, 180],
      [4004, 1005, 70],
    ]);
  });

  it('keeps the description of the whole on every leg', () => {
    const { postings } = parseJournal(source);
    expect(postings[0]?.splitOf).toBe('Migros August');
    expect(postings[0]?.text).toBe('Lebensmittel');
  });

  it('refuses a split that does not sum, and says what it is out by', () => {
    const { postings, problems } = parseJournal(
      ['2026-08-04 | | 1005 | 250.00 | Migros', '    4000 | 180.00', '    4004 | 60.00'].join('\n')
    );
    // Dropped rather than posted: a mistyped figure is far easier to find in a
    // journal than in a balance.
    expect(postings).toEqual([]);
    expect(problems[0]).toMatchObject({ reason: 'split-does-not-sum', difference: 10 });
  });

  it('splits an income the same way round', () => {
    const { postings } = parseJournal(
      ['2026-08-25 | 1005 | | 8000.00 | Lohn', '    3010 | 7412.00', '    3060 | 588.00'].join('\n')
    );
    expect(postings.map((p) => [p.debit, p.credit])).toEqual([
      [1005, 3010],
      [1005, 3060],
    ]);
  });
});

describe('what it refuses', () => {
  it('reports a line with no readable date', () => {
    const { problems } = parseJournal('4. August | 4001 | 1005 | 12.00 | x');
    expect(problems[0]?.reason).toBe('no-date');
  });

  it('reports a date that looks right and is not a day', () => {
    const { problems } = parseJournal('2026-02-31 | 4001 | 1005 | 12.00 | x');
    expect(problems[0]?.reason).toBe('no-date');
  });

  it('reports a line with no amount', () => {
    const { problems } = parseJournal('2026-08-04 | 4001 | 1005 | | x');
    expect(problems[0]?.reason).toBe('no-amount');
  });

  it('reports a half-written split rather than posting half of it', () => {
    const { postings, problems } = parseJournal('2026-08-04 | | 1005 | 250.00 | started');
    expect(postings).toEqual([]);
    expect(problems[0]?.reason).toBe('no-accounts');
  });

  it('reports a continuation with no header above it', () => {
    const { problems } = parseJournal('    4000 | 180.00 | orphan');
    expect(problems[0]?.reason).toBe('orphan-continuation');
  });

  it('keeps the good lines when one is bad', () => {
    const { postings, problems } = parseJournal(
      [
        '2026-08-04 | 4001 | 1005 | 128.45 | fine',
        'rubbish',
        '2026-08-05 | 4004 | 1005 | 20.00 | also fine',
      ].join('\n')
    );
    expect(postings).toHaveLength(2);
    expect(problems).toHaveLength(1);
  });
});

describe('finding the blocks in a note', () => {
  const note = [
    '# August 2026',
    '',
    'Some prose.',
    '',
    '```noda-journal',
    '2026-08-04 | 4001 | 1005 | 128.45 | IBB',
    '```',
    '',
    'More prose.',
    '',
    '```noda-journal',
    '2026-08-05 | 4004 | 1005 | 20.00 | Katzen',
    '```',
  ].join('\n');

  it('finds every block and where it started', () => {
    const blocks = extractJournalBlocks(note);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.fenceLine).toBe(4);
    expect(blocks[1]?.source).toContain('Katzen');
  });

  it('ignores a fence of another language', () => {
    expect(extractJournalBlocks('```dataview\nx\n```')).toEqual([]);
  });

  it('keeps an unterminated block, rather than losing what is in it', () => {
    const blocks = extractJournalBlocks('```noda-journal\n2026-08-04 | 4001 | 1005 | 1.00 | x');
    expect(parseJournal(blocks[0]?.source ?? '').postings).toHaveLength(1);
  });

  it('offsets the reported lines to where they are in the note', () => {
    const blocks = extractJournalBlocks(note);
    const { postings } = parseJournal(blocks[0]?.source ?? '', (blocks[0]?.fenceLine ?? 0) + 1);
    expect(postings[0]?.line).toBe(6);
  });
});

describe('writing a posting back', () => {
  it('round trips the simple form', () => {
    const line = '2026-08-04 | 4001 | 1005 | CHF 128.45 | IBB Strom August | [[IBB 2026-08]]';
    const { postings } = parseJournal(line);
    expect(postings[0] && formatPosting(postings[0])).toBe(line);
  });

  it('round trips a conversion', () => {
    const line = '2026-07-11 | 1001 | 1005 | EUR 200.00 = CHF 189.60 | Bargeld Ferien';
    const { postings } = parseJournal(line);
    expect(postings[0] && formatPosting(postings[0])).toBe(line);
  });
});

describe('a posting written and read back', () => {
  const base = {
    date: '2026-01-12',
    debit: 4036,
    credit: 1011,
    amount: 40.5,
    currency: 'CHF',
    counterAmount: null,
    counterCurrency: null,
    line: 0,
    entryLine: 0,
    splitOf: null,
  };

  it('keeps an import key that has no bank reference behind it', () => {
    // The whole point of the key: written, read back, and still equal, or the
    // row it came from is offered for import all over again.
    const posting = {
      ...base,
      text: 'TWINT-Zahlung FREITAG LAB. AG, ZURICH',
      reference: null,
      importKey: '2026-01-12~-40.50~bal:367.67',
    };
    const back = parseJournal(formatPosting(posting));
    expect(back.postings[0]?.importKey).toBe(posting.importKey);
  });

  it('survives a description carrying the field separator', () => {
    // A bar in free text used to shift every field after it, turning a
    // reference into an import key and an import key into a fragment.
    const posting = {
      ...base,
      text: 'SHOP A | BRANCH B',
      reference: 'inv|7',
      importKey: 'ref:123',
    };
    const back = parseJournal(formatPosting(posting));
    const read = back.postings[0];

    expect(back.problems).toEqual([]);
    expect(read?.debit).toBe(4036);
    expect(read?.credit).toBe(1011);
    expect(read?.amount).toBe(40.5);
    expect(read?.importKey).toBe('ref:123');
  });
});
