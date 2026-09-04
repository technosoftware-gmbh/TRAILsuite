/**
 * Which way an invoice points, and the one answer that must never change.
 *
 * A Debitorenrechnung is a Kreditorenrechnung read from the other end, so the
 * two share a note type and differ by a value. The value is optional, and what
 * an absent one means is the whole of the migration story: every invoice that
 * existed before this property did is one the household owes.
 *
 * Get that wrong and the day this ships is the day every invoice in a vault
 * moves to the other side of the income statement.
 */
import { describe, expect, it } from 'vitest';
import {
  buildBillFrontmatter,
  parseBill,
  readBillDirection,
  type BillProperties,
} from '../../src/expense/bill';

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

const EMPTY = {
  companyTitle: null,
  areaTitle: null,
  category: null,
  amount: null,
  currency: null,
  issueDate: null,
  dueDate: null,
  paidDate: null,
  reference: null,
  documentPaths: [],
  direction: 'incoming' as const,
  recurringTitle: null,
  purchaseTitle: null,
  account: null,
  paidFrom: null,
  lines: [],
  statedStatus: null,
};

describe('reading the direction', () => {
  it('reads an invoice the household sent', () => {
    expect(readBillDirection('outgoing')).toBe('outgoing');
  });

  it('reads an invoice the household owes', () => {
    expect(readBillDirection('incoming')).toBe('incoming');
  });

  it('answers incoming for a note that does not say', () => {
    // The whole migration, in one assertion. Every invoice written before this
    // property existed is one the household owes.
    expect(readBillDirection(undefined)).toBe('incoming');
    expect(readBillDirection(null)).toBe('incoming');
    expect(readBillDirection('')).toBe('incoming');
  });

  it('answers incoming for anything it does not recognise', () => {
    // A typo in a hand-edited note should leave the invoice where it was,
    // not move it to the other side of the income statement.
    expect(readBillDirection('ausgehend')).toBe('incoming');
    expect(readBillDirection('OUTGOING')).toBe('incoming');
    expect(readBillDirection(42)).toBe('incoming');
    expect(readBillDirection(['outgoing'])).toBe('incoming');
  });
});

describe('a parsed bill', () => {
  it('is incoming when the note is silent', () => {
    expect(parseBill({ amount: 10 }, P).direction).toBe('incoming');
  });

  it('is outgoing when the note says so', () => {
    expect(parseBill({ amount: 10, direction: 'outgoing' }, P).direction).toBe('outgoing');
  });
});

describe('writing the direction back', () => {
  it('writes nothing for an incoming invoice', () => {
    // Otherwise every invoice in the vault gains a property to say what every
    // reader already assumes, and the diff is sixty notes saying nothing.
    expect(buildBillFrontmatter(P, EMPTY)).not.toHaveProperty('direction');
  });

  it('writes it for an outgoing one', () => {
    expect(buildBillFrontmatter(P, { ...EMPTY, direction: 'outgoing' }).direction).toBe('outgoing');
  });

  it('round-trips both ways', () => {
    for (const direction of ['incoming', 'outgoing'] as const) {
      const back = parseBill(buildBillFrontmatter(P, { ...EMPTY, direction }), P);
      expect(back.direction).toBe(direction);
    }
  });
});
