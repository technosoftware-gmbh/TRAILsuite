/**
 * A note that is about more than one piece of paper.
 *
 * An invoice arrives as a covering letter and a payment slip; a two-page
 * invoice gets scanned in two goes. `document` therefore holds one path or
 * several, and the round trip is what this pins: a shape written here has to be
 * one that reads back the same, or somebody's second document disappears the
 * next time the note is edited.
 *
 * The rule that costs the most to get wrong is the last one. A note with one
 * document keeps a bare string, so no note that predates this is rewritten just
 * for being read.
 */
import { describe, expect, it } from 'vitest';
import { readPathList } from '../../src/frontmatter/read';
import { buildBillFrontmatter, parseBill, type BillProperties } from '../../src/expense/bill';

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

const EMPTY_BILL = {
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

describe('reading the document property', () => {
  it('takes a single path', () => {
    expect(readPathList('Finanzen/x/re.pdf')).toEqual(['Finanzen/x/re.pdf']);
  });

  it("takes a list, in the note's own order", () => {
    // Order is the only thing that says which one is the invoice.
    expect(readPathList(['a/invoice.pdf', 'a/qr-slip.pdf'])).toEqual([
      'a/invoice.pdf',
      'a/qr-slip.pdf',
    ]);
  });

  it('never splits a path on a comma', () => {
    // `readStringList` would return two entries here, neither of which names a
    // file. That is the whole reason this is a separate reader: a comma is a
    // separator in `diet: vegetarian, gluten-free` and a character in a
    // filename.
    expect(readPathList('Finanzen/Rechnung, Mahnung.pdf')).toEqual([
      'Finanzen/Rechnung, Mahnung.pdf',
    ]);
    expect(readPathList(['a/Rechnung, Mahnung.pdf', 'b/qr.pdf'])).toHaveLength(2);
  });

  it('answers nothing for a note that has no document', () => {
    expect(readPathList(undefined)).toEqual([]);
    expect(readPathList(null)).toEqual([]);
    expect(readPathList('')).toEqual([]);
    expect(readPathList('   ')).toEqual([]);
    expect(readPathList([])).toEqual([]);
  });

  it('drops the blanks a hand-edited list grows', () => {
    expect(readPathList(['a.pdf', '', '  ', 'b.pdf'])).toEqual(['a.pdf', 'b.pdf']);
  });

  it('ignores entries that are not strings', () => {
    expect(readPathList(['a.pdf', 42, null, { path: 'b.pdf' }])).toEqual(['a.pdf']);
  });
});

describe('writing the document property back', () => {
  // Through the real writer, because what matters is the shape that lands in a
  // note rather than what a helper returns.
  function written(paths: string[]): unknown {
    return buildBillFrontmatter(P, { ...EMPTY_BILL, documentPaths: paths })[P.documentProperty];
  }

  it('writes one as a bare string', () => {
    // A list of one would rewrite the frontmatter of every note that has ever
    // had a document, to say exactly what it said before.
    expect(written(['a/invoice.pdf'])).toBe('a/invoice.pdf');
  });

  it('writes several as a list', () => {
    expect(written(['a/invoice.pdf', 'a/qr-slip.pdf'])).toEqual(['a/invoice.pdf', 'a/qr-slip.pdf']);
  });

  it('writes no property at all when there is none', () => {
    expect(written([])).toBeUndefined();
  });

  it('round-trips both shapes', () => {
    for (const paths of [['a/one.pdf'], ['a/one.pdf', 'b/two.pdf']]) {
      const back = parseBill(buildBillFrontmatter(P, { ...EMPTY_BILL, documentPaths: paths }), P);
      expect(back.documentPaths).toEqual(paths);
    }
  });
});
