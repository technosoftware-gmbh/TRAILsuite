/**
 * A leg of a batched payment settling the invoice it paid.
 *
 * The real case: the bank posts one debit of 547.47 covering two payments, and
 * the detail behind it is 500.00 to Cornercard and 47.47 to HeyLight. The
 * second is an invoice the vault holds.
 *
 * Without a leg naming that invoice, the split books both amounts to the right
 * accounts and the invoice stays open. Marking it paid afterwards writes a
 * second posting for the same 47.47 -- money counted twice, from a batch row
 * nothing would ever flag.
 *
 * The rules under test are the two that keep that honest: choosing an invoice
 * takes its figure and its account, and editing the figure away from the
 * invoice's takes the claim back rather than marking a bill paid for the wrong
 * money.
 */
import { describe, expect, it } from 'vitest';
import { roundCents } from 'trail-core';
import type { SplitLeg } from '../src/ledger/import-write';

interface BillChoice {
  title: string;
  amount: number;
  account: number | null;
}

const HEYLIGHT: BillChoice = { title: 'HEYLIGHT_H-EWUBVI', amount: 47.47, account: 4034 };

/** What the picker does when an invoice is chosen. */
function choose(leg: SplitLeg, bill: BillChoice): SplitLeg {
  return {
    ...leg,
    settles: bill.title,
    amount: bill.amount,
    account: bill.account ?? leg.account,
  };
}

/** What typing in the amount box does to a leg that names an invoice. */
function retype(leg: SplitLeg, amount: number, bills: readonly BillChoice[]): SplitLeg {
  const next = { ...leg, amount: roundCents(amount) };
  const bill = bills.find((entry) => entry.title === next.settles);
  if (bill && roundCents(bill.amount) !== next.amount) next.settles = null;
  return next;
}

describe('a leg that pays an invoice', () => {
  const blank: SplitLeg = { account: 0, amount: 0, text: '', settles: null };

  it('takes the invoice figure and account', () => {
    const leg = choose(blank, HEYLIGHT);
    expect(leg).toMatchObject({ account: 4034, amount: 47.47, settles: 'HEYLIGHT_H-EWUBVI' });
  });

  it('lets the rest of the batch be booked by account alone', () => {
    // The Cornercard 500.00 has no invoice and never will: it is a payment
    // against a card balance, not against a bill.
    const card: SplitLeg = { account: 2010, amount: 500, text: 'Cornercard', settles: null };
    const heylight = choose(blank, HEYLIGHT);
    expect(roundCents(card.amount + heylight.amount)).toBe(547.47);
    expect(card.settles).toBeNull();
  });

  it('gives up the invoice when the figure is typed away from it', () => {
    const leg = retype(choose(blank, HEYLIGHT), 40, [HEYLIGHT]);
    expect(leg.settles).toBeNull();
    expect(leg.amount).toBe(40);
  });

  it('keeps the invoice when the figure is retyped to the same thing', () => {
    const leg = retype(choose(blank, HEYLIGHT), 47.47, [HEYLIGHT]);
    expect(leg.settles).toBe('HEYLIGHT_H-EWUBVI');
  });

  it('leaves a leg that names no invoice alone whatever is typed', () => {
    const leg = retype({ ...blank, account: 2010 }, 500, [HEYLIGHT]);
    expect(leg.settles).toBeNull();
  });

  it('still keeps the invoice account when the invoice has none of its own', () => {
    const unclassified = { ...HEYLIGHT, account: null };
    const leg = choose({ ...blank, account: 4036 }, unclassified);
    expect(leg.account).toBe(4036);
    expect(leg.settles).toBe('HEYLIGHT_H-EWUBVI');
  });
});
