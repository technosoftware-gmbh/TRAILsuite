import { describe, expect, it } from 'vitest';
import {
  buildRecurringFrontmatter,
  occurrencesBetween,
  parseRecurring,
  projectedTotal,
  type RecurringProperties,
} from '../../src/expense/recurring.js';

const P: RecurringProperties = {
  typePropertyName: 'type',
  typeValue: 'recurring',
  companyProperty: 'company',
  areaProperty: 'area',
  categoryProperty: 'category',
  amountProperty: 'amount',
  currencyProperty: 'currency',
  cadenceProperty: 'cadence',
  intervalProperty: 'interval',
  startDateProperty: 'startDate',
  endDateProperty: 'endDate',
  statusProperty: 'status',
  documentProperty: 'document',
  referenceProperty: 'reference',
  accountProperty: 'account',
};

const MONTHLY = {
  cadence: 'monthly' as const,
  interval: 1,
  startDate: '2026-01-15',
  endDate: null,
  status: 'active' as const,
  amount: 89.5,
  currency: 'CHF',
};

describe('parseRecurring', () => {
  it('reads a standing charge', () => {
    const cost = parseRecurring(
      {
        company: '[[Swisscom]]',
        category: 'utilities',
        amount: 89.5,
        currency: 'chf',
        cadence: 'monthly',
        startDate: '2026-01-15',
      },
      P
    );

    expect(cost.companyTitle).toBe('Swisscom');
    expect(cost.cadence).toBe('monthly');
    expect(cost.interval).toBe(1);
    expect(cost.status).toBe('active');
  });

  it('reads an unknown cadence as monthly and an unknown status as active', () => {
    // Both readings keep the charge visible. A cost that vanished from every
    // projection because of a typo is the failure this avoids.
    const cost = parseRecurring({ cadence: 'fortnightly', status: 'wat' }, P);
    expect(cost.cadence).toBe('monthly');
    expect(cost.status).toBe('active');
  });

  it('floors the interval at one, because zero would project an infinite series', () => {
    expect(parseRecurring({ interval: 0 }, P).interval).toBe(1);
  });
});

describe('occurrencesBetween', () => {
  it('projects a monthly charge across a year', () => {
    const days = occurrencesBetween(MONTHLY, '2026-01-01', '2026-12-31').map((o) => o.date);
    expect(days).toHaveLength(12);
    expect(days[0]).toBe('2026-01-15');
    expect(days[11]).toBe('2026-12-15');
  });

  it('projects only inside the range asked for', () => {
    const days = occurrencesBetween(MONTHLY, '2026-08-01', '2026-08-31').map((o) => o.date);
    expect(days).toEqual(['2026-08-15']);
  });

  it('honours an interval of more than one', () => {
    const days = occurrencesBetween({ ...MONTHLY, interval: 2 }, '2026-01-01', '2026-12-31').map(
      (o) => o.date
    );
    expect(days).toEqual([
      '2026-01-15',
      '2026-03-15',
      '2026-05-15',
      '2026-07-15',
      '2026-09-15',
      '2026-11-15',
    ]);
  });

  it('handles the coarser cadences', () => {
    expect(
      occurrencesBetween({ ...MONTHLY, cadence: 'quarterly' }, '2026-01-01', '2026-12-31')
    ).toHaveLength(4);
    expect(
      occurrencesBetween({ ...MONTHLY, cadence: 'semiannual' }, '2026-01-01', '2026-12-31')
    ).toHaveLength(2);
    expect(
      occurrencesBetween({ ...MONTHLY, cadence: 'annual' }, '2026-01-01', '2027-12-31')
    ).toHaveLength(2);
  });

  it('steps a weekly charge by seven days', () => {
    const days = occurrencesBetween(
      { ...MONTHLY, cadence: 'weekly', startDate: '2026-08-03' },
      '2026-08-01',
      '2026-08-31'
    ).map((o) => o.date);
    expect(days).toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']);
  });

  it('yields a once charge exactly once, and only in its own range', () => {
    const cost = { ...MONTHLY, cadence: 'once' as const };
    expect(occurrencesBetween(cost, '2026-01-01', '2026-12-31')).toHaveLength(1);
    expect(occurrencesBetween(cost, '2026-02-01', '2026-12-31')).toHaveLength(0);
  });

  it('stops at the end date', () => {
    const days = occurrencesBetween(
      { ...MONTHLY, endDate: '2026-04-01' },
      '2026-01-01',
      '2026-12-31'
    ).map((o) => o.date);
    expect(days).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('projects nothing for a paused or ended cost', () => {
    expect(
      occurrencesBetween({ ...MONTHLY, status: 'paused' }, '2026-01-01', '2026-12-31')
    ).toEqual([]);
    expect(occurrencesBetween({ ...MONTHLY, status: 'ended' }, '2026-01-01', '2026-12-31')).toEqual(
      []
    );
  });

  it('clamps a charge anchored on the 31st into a short month', () => {
    const days = occurrencesBetween(
      { ...MONTHLY, startDate: '2026-01-31' },
      '2026-01-01',
      '2026-04-30'
    ).map((o) => o.date);

    // February gets the 28th, and March goes back to the 31st rather than
    // staying on the 28th for the rest of the series.
    expect(days).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('projects nothing without a start date, rather than guessing one', () => {
    expect(occurrencesBetween({ ...MONTHLY, startDate: null }, '2026-01-01', '2026-12-31')).toEqual(
      []
    );
  });
});

describe('projectedTotal', () => {
  it('multiplies the amount by the count', () => {
    expect(projectedTotal(MONTHLY, '2026-01-01', '2026-12-31')).toEqual({
      amount: 1074,
      count: 12,
    });
  });

  it('still counts an unpriced charge, because it still falls due', () => {
    expect(projectedTotal({ ...MONTHLY, amount: null }, '2026-01-01', '2026-03-31')).toEqual({
      amount: null,
      count: 3,
    });
  });

  it('reports nothing where nothing falls in the range', () => {
    expect(projectedTotal({ ...MONTHLY, status: 'paused' }, '2026-01-01', '2026-12-31')).toEqual({
      amount: null,
      count: 0,
    });
  });
});

describe('buildRecurringFrontmatter', () => {
  it('round-trips, and leaves an interval of one off', () => {
    const content = {
      companyTitle: 'Swisscom',
      areaTitle: 'Finanzen',
      category: 'utilities',
      amount: 89.5,
      currency: 'CHF',
      cadence: 'monthly' as const,
      interval: 1,
      startDate: '2026-01-15',
      endDate: null,
      status: 'active' as const,
      documentPaths: [],
      account: 4031,
      reference: 'POL-4471',
    };

    const frontmatter = buildRecurringFrontmatter(P, content);
    expect(frontmatter).not.toHaveProperty('interval');
    expect(parseRecurring(frontmatter, P)).toEqual(content);
  });
});
