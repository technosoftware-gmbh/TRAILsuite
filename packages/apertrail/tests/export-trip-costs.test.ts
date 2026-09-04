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
