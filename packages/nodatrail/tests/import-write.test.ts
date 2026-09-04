/**
 * What an approved import actually writes.
 *
 * The split header is the part worth pinning. The legs replace one side of the
 * posting, and which side depends on whether the money left the account or
 * arrived in it. Getting that backwards produces a journal that parses cleanly
 * and describes the opposite of what happened.
 */
import { describe, expect, it } from 'vitest';
import { parseJournal, type Posting } from 'trail-core';
import { linesFor } from '../src/ledger/import-write';

function posting(overrides: Partial<Posting>): Posting {
  return {
    date: '2026-07-27',
    debit: null,
    credit: 1011,
    amount: 3518.96,
    currency: 'CHF',
    text: 'Zahlungsauftrag',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 1,
    // The line the entry's header is on. A posting without one belongs to no
    // entry, which is a shape the journal parser cannot produce -- and
    // grouping by anything else is the bug `entryLine` was added for.
    entryLine: 1,
    splitOf: null,
    importKey: 'ref:1557536916',
    ...overrides,
  };
}

describe('a simple posting', () => {
  it('is one line, and reads back as what went in', () => {
    const lines = linesFor({
      posting: posting({ debit: 4031, credit: 1011, amount: 750.95, text: 'Aquilana' }),
      legs: [],
    });
    expect(lines).toHaveLength(1);

    const read = parseJournal(lines.join('\n')).postings[0];
    expect(read).toMatchObject({
      date: '2026-07-27',
      debit: 4031,
      credit: 1011,
      amount: 750.95,
      importKey: 'ref:1557536916',
    });
  });

  it('carries the import key even with no bill behind it', () => {
    // The key sits in the seventh field, so the empty sixth has to be written
    // or it would be read as the reference.
    const line = linesFor({ posting: posting({ debit: 4031, credit: 1011 }), legs: [] })[0] ?? '';
    expect(line.split('|')).toHaveLength(7);
    expect(parseJournal(line).postings[0]?.reference).toBeNull();
  });
});

describe('a split', () => {
  const lines = linesFor({
    posting: posting({}),
    legs: [
      { account: 4031, amount: 750.95, text: 'Aquilana' },
      { account: 4034, amount: 31.8, text: 'Swisscom' },
      { account: 4003, amount: 2736.21, text: 'Rest' },
    ],
  });

  it('is a header and one indented line per leg', () => {
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('    4031 | 750.95 | Aquilana');
  });

  it('leaves the unknown side of the header blank', () => {
    expect(lines[0]).toContain('2026-07-27 |  | 1011 |');
  });

  it('reads back as one posting per leg, all against the account that paid', () => {
    const { postings, problems } = parseJournal(lines.join('\n'));
    expect(problems).toEqual([]);
    expect(postings.map((p) => [p.debit, p.credit, p.amount])).toEqual([
      [4031, 1011, 750.95],
      [4034, 1011, 31.8],
      [4003, 1011, 2736.21],
    ]);
  });

  it('turns round for money arriving', () => {
    const inward = linesFor({
      posting: posting({ debit: 1011, credit: null, amount: 300, text: 'Eingang' }),
      legs: [
        { account: 3010, amount: 250, text: 'Lohn' },
        { account: 3060, amount: 50, text: 'Rest' },
      ],
    });
    const { postings } = parseJournal(inward.join('\n'));
    expect(postings.map((p) => [p.debit, p.credit])).toEqual([
      [1011, 3010],
      [1011, 3060],
    ]);
  });

  it('is refused by the parser when the legs do not sum', () => {
    // The same refusal the journal applies to anything hand written. The split
    // editor will not let it get this far, but nothing relies on that.
    const wrong = linesFor({
      posting: posting({}),
      legs: [{ account: 4031, amount: 10, text: 'zu wenig' }],
    });
    const { postings, problems } = parseJournal(wrong.join('\n'));
    expect(postings).toEqual([]);
    expect(problems[0]?.reason).toBe('split-does-not-sum');
  });
});
