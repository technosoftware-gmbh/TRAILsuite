/**
 * The settlement posting, both ways round.
 *
 * A Debitorenrechnung settles as the mirror of a Kreditorenrechnung: money in
 * rather than out, an income account rather than an expense one. The whole of
 * the difference is which side of the posting each account lands on, which is
 * why the dialog has one conditional and not a second implementation.
 *
 * A source test, and worth saying so: the posting is built inside a modal that
 * needs an App, so what is pinned here is the conditional's shape. The check
 * that the figures are right was doing it against a real ledger.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(__dirname, '..', 'src', 'ui', 'modals', 'mark-paid-modal.ts'),
  'utf8'
);

describe('the settlement posting', () => {
  it('decides its sides from the invoice direction', () => {
    expect(source).toContain("const outgoing = this.bill.direction === 'outgoing';");
  });

  it('debits the account the money landed in when the invoice was sent', () => {
    // Soll Bank, Haben Ertrag.
    expect(source).toContain('debit: outgoing ? this.paidFrom : booked,');
  });

  it('credits the paying account when the invoice was received', () => {
    // Soll Aufwand, Haben Bank -- which is what it did before any of this.
    expect(source).toContain('credit: outgoing ? booked : this.paidFrom,');
  });

  it('says where the money went in the words for that direction', () => {
    expect(source).toContain("this.bill.direction === 'outgoing' ? t('ledger.paidInto')");
  });
});
