import { describe, expect, it } from 'vitest';
import {
  financeNoteStem,
  billLineTotal,
  billPeriodDate,
  billPostingLines,
  billStatus,
  buildBillFrontmatter,
  isOutstanding,
  parseBill,
  type BillProperties,
} from '../../src/expense/bill.js';

const P: BillProperties = {
  typePropertyName: 'type',
  typeValue: 'bill',
  companyProperty: 'company',
  areaProperty: 'area',
  categoryProperty: 'category',
  amountProperty: 'amount',
  currencyProperty: 'currency',
  issueDateProperty: 'issueDate',
  dueDateProperty: 'dueDate',
  paidDateProperty: 'paidDate',
  referenceProperty: 'reference',
  documentProperty: 'document',
  directionProperty: 'direction',
  recurringProperty: 'recurring',
  purchaseProperty: 'purchase',
  statusProperty: 'status',
  accountProperty: 'account',
  paidFromProperty: 'paidFrom',
  linesProperty: 'lines',
  lineAccountField: 'account',
  lineAmountField: 'amount',
  lineNoteField: 'note',
};

const TODAY = new Date(2026, 7, 22);

describe('parseBill', () => {
  it('reads a real bill', () => {
    const bill = parseBill(
      {
        company: '[[Baloise]]',
        area: '[[Finanzen]]',
        category: 'insurance',
        amount: 412.5,
        currency: 'chf',
        issueDate: '2026-07-01',
        dueDate: '2026-08-31',
        reference: '1040269824',
        document: '1 Areas/6 Finanzen/Rechnungen/Prämienrechnung_1040269824_01072026.pdf',
      },
      P
    );

    expect(bill.companyTitle).toBe('Baloise');
    expect(bill.currency).toBe('CHF');
    expect(bill.dueDate).toBe('2026-08-31');
    expect(bill.paidDate).toBeNull();
    expect(bill.statedStatus).toBeNull();
  });

  it('keeps a stated status only when it is one of the five', () => {
    expect(parseBill({ status: 'cancelled' }, P).statedStatus).toBe('cancelled');
    expect(parseBill({ status: 'wat' }, P).statedStatus).toBeNull();
  });
});

describe('billStatus', () => {
  it('reads a paid date as paid, whatever else the note says', () => {
    expect(
      billStatus({ paidDate: '2026-08-01', dueDate: '2026-07-01', statedStatus: 'open' }, TODAY)
    ).toBe('paid');
  });

  it('lets a stated status beat the dates, which is how cancelled works at all', () => {
    expect(
      billStatus({ paidDate: null, dueDate: '2026-01-01', statedStatus: 'cancelled' }, TODAY)
    ).toBe('cancelled');
  });

  it('calls a passed due date overdue', () => {
    expect(billStatus({ paidDate: null, dueDate: '2026-08-21', statedStatus: null }, TODAY)).toBe(
      'overdue'
    );
  });

  it('calls today due rather than overdue', () => {
    expect(billStatus({ paidDate: null, dueDate: '2026-08-22', statedStatus: null }, TODAY)).toBe(
      'due'
    );
  });

  it('calls the next week due and anything beyond it open', () => {
    expect(billStatus({ paidDate: null, dueDate: '2026-08-29', statedStatus: null }, TODAY)).toBe(
      'due'
    );
    expect(billStatus({ paidDate: null, dueDate: '2026-08-30', statedStatus: null }, TODAY)).toBe(
      'open'
    );
  });

  it('honours a different window', () => {
    expect(
      billStatus({ paidDate: null, dueDate: '2026-09-15', statedStatus: null }, TODAY, 30)
    ).toBe('due');
  });

  it('leaves a bill with no due date open forever, rather than inventing a deadline', () => {
    expect(billStatus({ paidDate: null, dueDate: null, statedStatus: null }, TODAY)).toBe('open');
  });

  it('knows which states are still owed', () => {
    expect(isOutstanding('open')).toBe(true);
    expect(isOutstanding('due')).toBe(true);
    expect(isOutstanding('overdue')).toBe(true);
    expect(isOutstanding('paid')).toBe(false);
    expect(isOutstanding('cancelled')).toBe(false);
  });
});

describe('billPeriodDate', () => {
  it('places the money in the month it was due, not the month it was paid', () => {
    expect(billPeriodDate({ dueDate: '2026-08-31', issueDate: '2026-07-01' })).toBe('2026-08-31');
  });

  it('falls back to the issue date', () => {
    expect(billPeriodDate({ dueDate: null, issueDate: '2026-07-01' })).toBe('2026-07-01');
    expect(billPeriodDate({ dueDate: null, issueDate: null })).toBeNull();
  });
});

describe('buildBillFrontmatter', () => {
  it('writes no status when the note has nothing the dates cannot say', () => {
    const frontmatter = buildBillFrontmatter(P, {
      companyTitle: 'Baloise',
      areaTitle: null,
      category: 'insurance',
      amount: 412.5,
      currency: 'CHF',
      issueDate: '2026-07-01',
      dueDate: '2026-08-31',
      paidDate: null,
      reference: '1040269824',
      documentPaths: [],
      direction: 'incoming' as const,
      recurringTitle: null,
      purchaseTitle: null,
      account: null,
      paidFrom: null,
      lines: [],
      statedStatus: null,
    });

    // A derived status written into the note would be stale by morning.
    expect(frontmatter).not.toHaveProperty('status');
    expect(frontmatter.company).toBe('[[Baloise]]');
    expect(frontmatter).not.toHaveProperty('paidDate');
  });

  it('round-trips', () => {
    const content = {
      companyTitle: 'Baloise',
      areaTitle: 'Finanzen',
      category: 'insurance',
      amount: 412.5,
      currency: 'CHF',
      issueDate: '2026-07-01',
      dueDate: '2026-08-31',
      paidDate: '2026-08-20',
      reference: '1040269824',
      documentPaths: ['Rechnungen/x.pdf'],
      direction: 'incoming' as const,
      recurringTitle: 'Baloise Hausrat',
      purchaseTitle: null,
      account: 4005,
      paidFrom: 1011,
      lines: [],
      statedStatus: null,
    };
    expect(parseBill(buildBillFrontmatter(P, content), P)).toEqual(content);
  });
});

describe('financeNoteStem', () => {
  const day = (iso: string): Date => new Date(`${iso}T12:00:00`);

  it('stamps the day without separators, so the underscores only separate parts', () => {
    expect(financeNoteStem(day('2026-06-04'), 'baloise', '1040269824')).toBe(
      '20260604_baloise_1040269824'
    );
  });

  it('drops a missing part along with its separator', () => {
    expect(financeNoteStem(day('2026-06-04'), 'baloise', '')).toBe('20260604_baloise');
    expect(financeNoteStem(day('2026-06-04'), '', '1040269824')).toBe('20260604_1040269824');
    expect(financeNoteStem(null, 'baloise', '')).toBe('baloise');
  });

  it('is empty when nothing identifies the bill yet', () => {
    expect(financeNoteStem(null, '', '')).toBe('');
    expect(financeNoteStem(null, '   ', '  ')).toBe('');
  });

  it('keeps the company name a company is called, collapsing runs of space only', () => {
    expect(financeNoteStem(day('2026-01-22'), '  Baloise   Versicherung ', 'AG-9')).toBe(
      '20260122_Baloise Versicherung_AG-9'
    );
  });
});

const EMPTY_BILL = {
  companyTitle: null,
  areaTitle: null,
  category: null,
  amount: null as number | null,
  currency: null,
  issueDate: null,
  dueDate: null,
  paidDate: null,
  reference: null,
  documentPaths: [],
  direction: 'incoming' as const,
  recurringTitle: null,
  purchaseTitle: null,
  account: null as number | null,
  paidFrom: null,
  lines: [] as { account: number; amount: number; note: string }[],
  statedStatus: null,
};

describe('an invoice that divides across accounts', () => {
  const sunrise = {
    ...EMPTY_BILL,
    amount: 122.7,
    account: 4034,
    lines: [
      { account: 4034, amount: -4, note: 'Gutschrift' },
      { account: 4003, amount: 126.7, note: '' },
    ],
  };

  it('reads the lines back as written, negatives included', () => {
    // A real telephone invoice: a credit line and a charge line, on one paper.
    const parsed = parseBill(buildBillFrontmatter(P, sunrise), P);
    expect(parsed.lines).toEqual(sunrise.lines);
  });

  it('adds up to the invoice total', () => {
    expect(billLineTotal(sunrise.lines)).toBe(122.7);
  });

  it('posts by its lines, not by the single account', () => {
    // Both would be two claims about where the same money goes.
    expect(billPostingLines(sunrise)).toEqual(sunrise.lines);
  });

  it('posts an ordinary invoice as one line for its whole amount', () => {
    expect(billPostingLines({ ...EMPTY_BILL, amount: 750.95, account: 4031 })).toEqual([
      { account: 4031, amount: 750.95, note: '' },
    ]);
  });

  it('posts nothing at all when nobody has said where it belongs', () => {
    expect(billPostingLines({ ...EMPTY_BILL, amount: 750.95 })).toEqual([]);
  });

  it('drops a line naming no account and keeps the rest', () => {
    const parsed = parseBill({ lines: [{ amount: 10 }, { account: 4003, amount: 126.7 }] }, P);
    expect(parsed.lines).toEqual([{ account: 4003, amount: 126.7, note: '' }]);
  });

  it('writes no lines property for an invoice that does not divide', () => {
    expect(buildBillFrontmatter(P, { ...EMPTY_BILL, account: 4031 })).not.toHaveProperty('lines');
  });
});
