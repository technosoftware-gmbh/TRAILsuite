/**
 * The join between what a ledger already holds and what a statement is about
 * to add.
 *
 * Every statement states the balance it starts from; the ledger knows what it
 * thinks the account held the day before. Comparing the two is the cheapest
 * check available and the only one that catches a whole month having been
 * skipped, which no amount of within-file arithmetic can notice.
 *
 * The comparison itself is three lines in the import screen. What is tested
 * here is the arithmetic it rests on, against the shapes a real first import
 * takes.
 */
import { describe, expect, it } from 'vitest';
import {
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  addDays,
  balanceAt,
  formatDayTitle,
  parseAccount,
  parseDayTitle,
  parseJournal,
  parseStatement,
  reconcileStatement,
  type Account,
  type AccountProperties,
} from '@technosoftware/trail-core';

const P: AccountProperties = {
  numberProperty: 'number',
  kindProperty: 'kind',
  groupProperty: 'group',
  currencyProperty: 'currency',
  openingProperty: 'opening',
  openingDateProperty: 'openingDate',
  closedProperty: 'closed',
  ibanProperty: 'iban',
  bankAccountProperty: 'bankAccount',
  personProperty: 'person',
};

function account(opening: number): Account {
  const parsed = parseAccount(
    { number: 1011, currency: 'CHF', opening, openingDate: '2026-01-01' },
    '1011 Personal account',
    P
  );
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

/** A January statement whose first row leaves the account at -1500.04. */
const JANUARY = [
  'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
  '20.01.2026;20.01.2026;" Belastung e-banking / Ref.-Nr. 2 SWISSCOM ";29.10;;-1529.14;',
  '05.01.2026;05.01.2026;" Belastung e-banking / Ref.-Nr. 1 IBB ";130.00;;-1500.04;',
  '',
].join('\n');

/** What the import screen computes, written out so the test is about the rule. */
function handover(acc: Account, file: string, postings = parseJournal('').postings) {
  const rows = acceptedRows(parseStatement(file, SWISS_EBANKING_PROFILE), SWISS_EBANKING_PROFILE);
  const statement = reconcileStatement(rows, false).opening;
  const first = rows[0] ? parseDayTitle(rows[0].date) : null;
  if (statement === null || !first) return null;

  const ledger = balanceAt(postings, acc, formatDayTitle(addDays(first, -1)));
  return { ledger, statement, agree: Math.abs(ledger - statement) < 0.005 };
}

describe('a first import, against the opening balance', () => {
  it('agrees when the opening balance is the one the statement starts from', () => {
    // The whole point of importing January first: it butts straight up against
    // the figure somebody typed into the account note, so the two can be
    // checked against each other before anything is written.
    expect(handover(account(-1370.04), JANUARY)).toMatchObject({
      ledger: -1370.04,
      statement: -1370.04,
      agree: true,
    });
  });

  it('says how far out it is when they disagree', () => {
    const result = handover(account(-1000), JANUARY);
    expect(result?.agree).toBe(false);
    expect(result && result.statement - result.ledger).toBeCloseTo(-370.04, 2);
  });
});

describe('a later import, against what is already booked', () => {
  it('counts the postings already in the ledger, not just the opening balance', () => {
    // February against a January that has been imported: the handover figure is
    // the opening plus everything January did, which is what makes this check
    // work for every month rather than only the first.
    const january = parseJournal(
      [
        '2026-01-05 | 4001 | 1011 | 130.00 | IBB',
        '2026-01-20 | 4034 | 1011 | 29.10 | Swisscom',
      ].join('\n')
    ).postings;

    const february = [
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
      '10.02.2026;10.02.2026;" Belastung e-banking / Ref.-Nr. 3 MIETE ";100.00;;-1629.14;',
      '',
    ].join('\n');

    expect(handover(account(-1370.04), february, january)).toMatchObject({
      ledger: -1529.14,
      statement: -1529.14,
      agree: true,
    });
  });

  it('catches a month that was never imported', () => {
    // The failure no within-file arithmetic can see: every row of February adds
    // up perfectly and January is simply absent.
    const february = [
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
      '10.02.2026;10.02.2026;" Belastung e-banking / Ref.-Nr. 3 MIETE ";100.00;;-1629.14;',
      '',
    ].join('\n');

    const result = handover(account(-1370.04), february);
    expect(result?.agree).toBe(false);
    expect(result?.ledger).toBe(-1370.04);
    expect(result?.statement).toBe(-1529.14);
  });
});

describe('when there is nothing to compare', () => {
  it('says nothing rather than guessing, for a file with no running balance', () => {
    const noBalance = [
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
      '05.01.2026;05.01.2026;" Belastung e-banking / Ref.-Nr. 1 IBB ";130.00;;;',
      '',
    ].join('\n');
    expect(handover(account(-1370.04), noBalance)).toBeNull();
  });
});
