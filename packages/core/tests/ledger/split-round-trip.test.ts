/**
 * A split survives being opened in an editor and saved again.
 *
 * The parser fills a split header's blank side from each leg, so every leg
 * comes back naming both accounts and nothing on any one posting says which
 * side was blank. The edit form read `first.debit === null` to find out, found
 * that it never is, concluded the legs had filled the credit, and showed all
 * thirteen legs of a card statement as the card itself. Saving that wrote a
 * header naming both sides, and the parser then ignores leg accounts entirely:
 * a statement split across household, photography and sundries collapsed onto
 * one expense account.
 *
 * Nothing caught it because every layer was individually right. The parser is
 * allowed to fill both sides, the writer is allowed to name both sides, and
 * only the round trip through them is wrong. So the round trip is what this
 * tests: parse, read back, write, parse again, and compare the postings.
 */
import { describe, expect, it } from 'vitest';
import { formatPosting, parseJournal, readSplit, type Posting } from '../../src/index.js';

/** The lines a split becomes, which is what the plugin's writer produces. */
function write(entry: NonNullable<ReturnType<typeof readSplit>>, from: Posting): string[] {
  const header = formatPosting({
    ...from,
    debit: entry.debit,
    credit: entry.credit,
    amount: entry.amount,
    text: from.splitOf ?? '',
  });
  return [
    header,
    ...entry.legs.map(
      (leg) => `    ${leg.account} | ${leg.amount.toFixed(2)}${leg.text ? ` | ${leg.text}` : ''}`
    ),
  ];
}

/** What a reader cares about. Line numbers a rewrite is allowed to change. */
function shape(postings: readonly Posting[]) {
  return postings.map((posting) => ({
    date: posting.date,
    debit: posting.debit,
    credit: posting.credit,
    amount: posting.amount,
    text: posting.text,
  }));
}

const CARD = [
  '2026-01-01 |  | 2010 | CHF 5683.55 | Cornercard | 202601-00039',
  '    4000 | 135.90 | Tomtasty Bestellung #19440',
  '    4036 | 520.00 | RB Wuerenlingen',
  '    4039 | 69.83 | FS *LUMINAR',
  '    4036 | 2672.19 | Diverses',
  '    4000 | 153.90 | Tomtasty Bestellung #20201',
  '    4036 | 1305.25 | Diverses',
  '    4000 | 826.48 | Tomtasty, the rest',
].join('\n');

const RECEIPTS = [
  '2026-01-15 | 1011 |  | CHF 300.00 | Two refunds',
  '    4032 | 120.00 | Zahnarzt',
  '    4031 | 180.00 | Krankenkasse',
].join('\n');

describe('a card statement opened and saved again', () => {
  const parsed = parseJournal(CARD);

  it('parses into legs that all name the card, which is what hid the bug', () => {
    expect(parsed.problems).toEqual([]);
    // Every leg comes back with both sides filled. This is the fact the edit
    // form could not see past.
    expect(parsed.postings.every((posting) => posting.credit === 2010)).toBe(true);
    expect(parsed.postings.every((posting) => posting.debit !== null)).toBe(true);
  });

  it('is read back as a header naming only the card', () => {
    const entry = readSplit(parsed.postings);
    expect(entry?.debit).toBeNull();
    expect(entry?.credit).toBe(2010);
    expect(entry?.amount).toBe(5683.55);
    expect(entry?.legs.map((leg) => leg.account)).toEqual([
      4000, 4036, 4039, 4036, 4000, 4036, 4000,
    ]);
  });

  it('comes back through a save unchanged', () => {
    const entry = readSplit(parsed.postings);
    if (!entry || !parsed.postings[0]) throw new Error('unreadable');
    const again = parseJournal(write(entry, parsed.postings[0]).join('\n'));
    expect(again.problems).toEqual([]);
    expect(shape(again.postings)).toEqual(shape(parsed.postings));
  });

  it('does not collapse onto one account, which is what went wrong', () => {
    const entry = readSplit(parsed.postings);
    if (!entry || !parsed.postings[0]) throw new Error('unreadable');
    const again = parseJournal(write(entry, parsed.postings[0]).join('\n'));
    expect(new Set(again.postings.map((posting) => posting.debit))).toEqual(
      new Set([4000, 4036, 4039])
    );
  });
});

describe('a split the other way round, where the legs are the credits', () => {
  const parsed = parseJournal(RECEIPTS);

  it('keeps the header on the debit side', () => {
    const entry = readSplit(parsed.postings);
    expect(entry?.debit).toBe(1011);
    expect(entry?.credit).toBeNull();
    expect(entry?.legs.map((leg) => leg.account)).toEqual([4032, 4031]);
  });

  it('comes back through a save unchanged', () => {
    const entry = readSplit(parsed.postings);
    if (!entry || !parsed.postings[0]) throw new Error('unreadable');
    const again = parseJournal(write(entry, parsed.postings[0]).join('\n'));
    expect(shape(again.postings)).toEqual(shape(parsed.postings));
  });
});

describe('the awkward cases', () => {
  it('reads a simple posting as itself, with no legs', () => {
    const one = parseJournal('2026-01-05 | 4031 | 1011 | CHF 750.95 | Aquilana');
    const entry = readSplit(one.postings);
    expect(entry).toEqual({ debit: 4031, credit: 1011, legs: [], amount: 750.95 });
  });

  it('normalises a header that named both sides, without changing what it means', () => {
    // Written by hand with both sides named, so the leg accounts were ignored
    // on the way in. Either reading round-trips; this pins that one does.
    const both = parseJournal(
      [
        '2026-01-01 | 4036 | 2011 | CHF 592.60 | coop',
        '    2011 | 204.00 | coop',
        '    2011 | 388.60 | Zinsen',
      ].join('\n')
    );
    const entry = readSplit(both.postings);
    if (!entry || !both.postings[0]) throw new Error('unreadable');
    const again = parseJournal(write(entry, both.postings[0]).join('\n'));
    expect(shape(again.postings)).toEqual(shape(both.postings));
  });

  it('refuses a set that cannot have been one entry', () => {
    // Two unrelated postings sharing nothing. A form that guessed here would
    // write a header over lines it does not describe.
    const loose = parseJournal(
      [
        '2026-01-05 | 4031 | 1011 | CHF 750.95 | one',
        '2026-01-06 | 4003 | 1005 | CHF 126.70 | two',
      ].join('\n')
    );
    expect(readSplit(loose.postings)).toBeNull();
  });

  it('says nothing about an empty set rather than inventing an entry', () => {
    expect(readSplit([])).toBeNull();
  });
});
