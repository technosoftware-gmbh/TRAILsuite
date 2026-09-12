/**
 * The cost sheet's markup.
 *
 * Same two rules the field sheet's suite pins down, for the same reasons:
 * everything that reaches the page is escaped, because a booking title is
 * user input, and a sheet with parts missing prints without those parts
 * rather than with empty ones.
 */
import { describe, expect, it } from 'vitest';
import { buildCostSheetHtml, CostSheet } from '../src/trips/costs/export-trip-costs';

function sheet(overrides: Partial<CostSheet> = {}): CostSheet {
  return {
    title: 'Costs: Jura im Juni',
    subtitle: 'Switzerland',
    dateRange: '14 June 2026 - 16 June 2026',
    currencyLines: ['EUR 220.00 at 0.94 = CHF 206.80'],
    summary: [
      { label: 'Planned', value: 'CHF 1,000.00' },
      { label: 'Committed', value: 'CHF 1,046.80' },
    ],
    rows: [
      {
        label: 'SBB Zurich - Neuchâtel',
        category: 'Transport',
        status: 'Booked',
        amount: 'CHF 187.40',
        date: '14 June 2026',
        reference: 'XK7F2Q',
        documentName: 'SBB 2026-06-14.pdf',
      },
    ],
    totals: [
      {
        label: 'Transport',
        amount: 'CHF 187.40',
        note: 'of CHF 400.00 planned',
        emphasis: 'subtotal',
      },
      { label: 'Committed', amount: 'CHF 1,046.80', note: null, emphasis: 'total' },
      { label: 'Budget', amount: 'CHF 1,000.00', note: null, emphasis: 'plan' },
    ],
    optional: null,
    balances: ['Stefan: paid CHF 800.00, used CHF 523.40, balance CHF 276.60'],
    transfers: ['Erika pays Stefan CHF 276.60'],
    labels: {
      bookings: 'Costs',
      settlement: 'Settling up',
      booking: 'Booking',
      category: 'Category',
      status: 'Status',
      amount: 'Amount',
      date: 'Date',
      reference: 'Reference',
    },
    caveat: 'Figures as the notes state them.',
    footer: 'Generated on 21 August 2026.',
    ...overrides,
  };
}

describe('escaping', () => {
  it('renders a booking title as text rather than as markup', () => {
    const html = buildCostSheetHtml(
      sheet({ rows: [{ ...sheet().rows[0], label: '<script>alert(1)</script>' }] })
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // Ampersands are ordinary in a supplier name.
  it('escapes an ampersand in a row', () => {
    const html = buildCostSheetHtml(
      sheet({ rows: [{ ...sheet().rows[0], label: 'Bed & Breakfast' }] })
    );
    expect(html).toContain('Bed &amp; Breakfast');
  });
});

describe('a sheet with parts missing', () => {
  it('prints no table for a trip with no bookings', () => {
    expect(buildCostSheetHtml(sheet({ rows: [] }))).not.toContain('<table>');
  });

  // One payer needs a sentence in the block, not a table on paper.
  it('prints no settlement when there is nothing to settle', () => {
    const html = buildCostSheetHtml(sheet({ balances: [], transfers: [] }));
    expect(html).not.toContain('Settling up');
  });

  it('prints no rate line for a single-currency trip', () => {
    expect(buildCostSheetHtml(sheet({ currencyLines: [] }))).not.toContain('at 0.94');
  });
});

describe('the whole sheet', () => {
  it('is one self-contained document with nothing to fetch', () => {
    const html = buildCostSheetHtml(sheet());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/<link/);
    expect(html).not.toContain('<script');
  });

  // The budget is beside the computed figure, never instead of it: the
  // interesting case is that they disagree.
  it('prints the plan as its own row under the total', () => {
    const html = buildCostSheetHtml(sheet());
    expect(html).toContain('class="row total"');
    expect(html).toContain('class="row plan"');
  });

  // A reference and a confirmation are things you read once at a desk; the
  // amount is the column that must not be squeezed.
  it('keeps the reference and the document name under the label rather than in columns', () => {
    const html = buildCostSheetHtml(sheet());
    expect(html).toContain('XK7F2Q &middot; SBB 2026-06-14.pdf');
  });
});

/**
 * What the printer does to this sheet.
 *
 * The last of the four to take `section()`. Its bookings heading sits above a
 * table that grows with the trip, which is the shape most likely to leave a
 * heading behind at a fold.
 */
describe('the cost sheet on paper', () => {
  it('binds both headings to a block, and the page style carries the rule', () => {
    const html = buildCostSheetHtml(sheet());
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const headings = html.match(/<h2>/g) ?? [];

    expect(headings).toHaveLength(2);
    expect(html.match(/<div class="section-head"><h2>/g) ?? []).toHaveLength(2);
    expect(css).toMatch(/\.section-head\s*\{[^}]*break-inside:\s*avoid/);
  });

  /** The table joins the heading; the totals under it are free to move. */
  it('glues the table to the bookings heading and leaves the totals outside', () => {
    const html = buildCostSheetHtml(sheet());

    expect(html).toContain('<div class="section-head"><h2>Costs</h2><table>');
    expect(html).toMatch(/<\/table><\/div><div class="totals">/);
  });

  /**
   * A trip with nothing booked yet prints no bookings heading. This sheet was
   * the last one that printed an empty one, and the other three have always
   * left out a section they have nothing to put under.
   */
  it('leaves out the bookings section when there is nothing in it', () => {
    const html = buildCostSheetHtml(sheet({ rows: [], totals: [] }));

    expect(html).not.toContain('Costs</h2>');
    expect(html).toContain('Settling up');
  });
});

/**
 * The extras nobody has taken, under the table rather than in it.
 *
 * The summary cell above says what all of them together would add. That is a
 * ceiling: two excursions offered on one day are a choice between them, so the
 * rows are what somebody decides from. They stay out of the bookings table
 * because that table is what the totals and the settlement are computed from,
 * and an untaken extra in it would be money somebody is owed.
 */
describe('the extras on offer', () => {
  const optional = {
    label: 'Optional on top',
    lines: [
      { label: 'Tromsø', amount: 'CHF 440.00' },
      { label: 'Rørvik', amount: 'EUR 95.00' },
    ],
  };

  it('prints a row per extra, in the currency each one states', () => {
    const html = buildCostSheetHtml(sheet({ optional }));

    expect(html).toContain('<section class="extras">');
    expect(html.match(/<li><span>/g) ?? []).toHaveLength(2);
    expect(html).toContain('EUR 95.00');
  });

  it('keeps them out of the bookings table, which the totals are read from', () => {
    const html = buildCostSheetHtml(sheet({ optional }));
    const table = /<table>([\s\S]*?)<\/table>/.exec(html)?.[1] ?? '';

    expect(table).not.toContain('Tromsø');
  });

  it('prints no section for a trip that offers none', () => {
    expect(buildCostSheetHtml(sheet())).not.toContain('class="extras"');
  });
});
