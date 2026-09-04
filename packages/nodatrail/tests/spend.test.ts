/**
 * Turning three kinds of note into the one shape a budget measures.
 *
 * The decisions checked here are all about *which date places an item*, which
 * is the part of a household budget that is wrong most often.
 */
import { describe, expect, it } from 'vitest';
import {
  billItems,
  purchaseAmount,
  purchaseItems,
  recurringItems,
  settledOccurrences,
  spendInPeriod,
} from '../src/finance/spend';
import type { BillRecord, PurchaseRecord, RecurringRecord } from 'trail-core';

const TODAY = new Date(2026, 7, 22);
const AUGUST = { from: '2026-08-01', to: '2026-08-31' };

function purchase(over: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    file: {},
    title: '2026-08-10-82455495',
    reference: '82455495',
    companyTitle: 'Galaxus',
    areaTitle: 'Haus & Wohnen',
    projectTitle: null,
    category: 'household',
    status: 'delivered',
    date: '2026-08-10',
    deliveryDate: null,
    deliveries: [],
    amount: 189.4,
    currency: 'CHF',
    discount: null,
    shipping: null,
    vatRate: null,
    vatAmount: null,
    items: [],
    documentPaths: [],
    billTitle: null,
    ...over,
  };
}

function bill(over: Partial<BillRecord> = {}): BillRecord {
  return {
    file: {},
    title: 'Baloise Hausrat 2026-08',
    companyTitle: 'Baloise',
    areaTitle: 'Finanzen',
    category: 'insurance',
    amount: 412.5,
    currency: 'CHF',
    issueDate: '2026-07-01',
    dueDate: '2026-08-31',
    paidDate: null,
    reference: null,
    documentPaths: [],
    recurringTitle: null,
    purchaseTitle: null,
    statedStatus: null,
    // The ledger fields a bill has carried since it could be booked. The
    // fixtures predate them, so every test here has been running against a
    // bill shape no note can have.
    account: null,
    paidFrom: null,
    lines: [],
    // The parser always states one, defaulting to incoming, so a bill
    // without a direction is a shape a note cannot have.
    direction: 'incoming',
    ...over,
  };
}

function recurring(over: Partial<RecurringRecord> = {}): RecurringRecord {
  return {
    file: {},
    title: 'Swisscom Abo',
    companyTitle: 'Swisscom',
    areaTitle: 'Finanzen',
    category: 'utilities',
    amount: 89.5,
    currency: 'CHF',
    cadence: 'monthly',
    interval: 1,
    startDate: '2026-01-15',
    endDate: null,
    status: 'active',
    documentPaths: [],
    account: null,
    // A recurring cost's own reference, which is not a bill's: it names the
    // agreement rather than one invoice.
    reference: null,
    ...over,
  };
}

describe('purchases', () => {
  it('is placed by its order date', () => {
    expect(purchaseItems([purchase()], AUGUST.from, AUGUST.to)).toHaveLength(1);
    expect(purchaseItems([purchase({ date: '2026-07-31' })], AUGUST.from, AUGUST.to)).toHaveLength(
      0
    );
  });

  it('drops a cancelled or returned purchase', () => {
    expect(purchaseItems([purchase({ status: 'cancelled' })], AUGUST.from, AUGUST.to)).toEqual([]);
    expect(purchaseItems([purchase({ status: 'returned' })], AUGUST.from, AUGUST.to)).toEqual([]);
  });

  it('spends the stated total rather than a recomputation of it', () => {
    // The note is the record of what was charged. A figure derived from the
    // lines is an opinion about that record, and it is what the health check
    // compares, not what a budget spends.
    const disagreeing = purchase({
      amount: 189.4,
      items: [{ name: 'x', price: 1, quantity: 1, discount: null, note: null }],
    });
    expect(purchaseAmount(disagreeing)).toBe(189.4);
  });

  it('falls back to the lines when the note states no total', () => {
    const unstated = purchase({
      amount: null,
      items: [{ name: 'x', price: 12.5, quantity: 2, discount: null, note: null }],
    });
    expect(purchaseAmount(unstated)).toBe(25);
  });
});

describe('bills', () => {
  it('is placed by the day it was due, not the day it was paid', () => {
    // Paid in September, owed in August. It belongs to the month somebody
    // budgeted it in.
    const late = bill({ dueDate: '2026-08-31', paidDate: '2026-09-04' });
    expect(billItems([late], AUGUST.from, AUGUST.to, TODAY, 7)).toHaveLength(1);
  });

  it('falls back to the issue date when there is no due date', () => {
    const undated = bill({ dueDate: null, issueDate: '2026-08-05' });
    expect(billItems([undated], AUGUST.from, AUGUST.to, TODAY, 7)).toHaveLength(1);
  });

  it('drops a cancelled bill', () => {
    expect(
      billItems([bill({ statedStatus: 'cancelled' })], AUGUST.from, AUGUST.to, TODAY, 7)
    ).toEqual([]);
  });

  it('drops a bill with no date at all, rather than placing it arbitrarily', () => {
    const nowhere = bill({ dueDate: null, issueDate: null });
    expect(billItems([nowhere], AUGUST.from, AUGUST.to, TODAY, 7)).toEqual([]);
  });
});

describe('recurring costs', () => {
  it('projects the occurrences that fall in the period', () => {
    const items = recurringItems([recurring()], AUGUST.from, AUGUST.to);
    expect(items).toHaveLength(1);
    expect(items[0]?.date).toBe('2026-08-15');
    expect(items[0]?.amount).toBe(89.5);
  });

  it('drops an occurrence a bill note already accounts for', () => {
    const settled = settledOccurrences([
      bill({ recurringTitle: 'Swisscom Abo', dueDate: '2026-08-15' }),
    ]);
    expect(recurringItems([recurring()], AUGUST.from, AUGUST.to, settled)).toEqual([]);
  });

  it('matches a settled occurrence on the exact day rather than the month', () => {
    // A weekly cost falls four times in August; one bill must not cancel all
    // four.
    const weekly = recurring({ cadence: 'weekly', startDate: '2026-08-03' });
    const settled = settledOccurrences([
      bill({ recurringTitle: 'Swisscom Abo', dueDate: '2026-08-10' }),
    ]);
    const days = recurringItems([weekly], AUGUST.from, AUGUST.to, settled).map((i) => i.date);
    expect(days).toEqual(['2026-08-03', '2026-08-17', '2026-08-24', '2026-08-31']);
  });
});

describe('spendInPeriod', () => {
  it('gathers all three and sorts by day', () => {
    const items = spendInPeriod({
      purchases: [purchase()],
      bills: [bill()],
      recurring: [recurring()],
      from: AUGUST.from,
      to: AUGUST.to,
      today: TODAY,
      dueSoonDays: 7,
    });

    expect(items.map((item) => item.kind)).toEqual(['purchase', 'recurring', 'bill']);
    expect(items.map((item) => item.date)).toEqual(['2026-08-10', '2026-08-15', '2026-08-31']);
  });

  it('counts a recurring cost once when its bill exists, not twice', () => {
    const items = spendInPeriod({
      purchases: [],
      bills: [bill({ recurringTitle: 'Swisscom Abo', dueDate: '2026-08-15', amount: 89.5 })],
      recurring: [recurring()],
      from: AUGUST.from,
      to: AUGUST.to,
      today: TODAY,
      dueSoonDays: 7,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('bill');
  });
});
