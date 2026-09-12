/**
 * A trip's costs, expressed as `trail-core`'s format-agnostic invoice model.
 *
 * The one place APERtrail's money vocabulary meets that model, and the
 * second consumer the model's own header says it was moved to the core for.
 * Every figure comes out of `totals.ts` and `split.ts`, so the summary strip
 * above the document and the document itself cannot disagree: they are two
 * renderings of one calculation, the same arrangement CULItrail's order card
 * and order invoice have.
 *
 * App-free, so it can be tested without a vault.
 */
import type {
  InvoiceColumns,
  InvoiceFact,
  InvoiceFooter,
  InvoiceLine,
  InvoiceModel,
  InvoiceTotal,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { BookingCategory, ParsedBooking } from './booking-note';
import { Settlement } from './split';
import { lineCurrency, TripCostTotals } from './totals';
import { formatMoney, formatMoneyOrNull } from '../../shared/display';

/** A booking plus the note title it came from, which is what the table's rows link to. */
export interface CostRow {
  title: string;
  /** The note this row opens. Null for a row with no note behind it, which is exactly what an itinerary estimate is. */
  linkTarget: string | null;
  booking: ParsedBooking;
}

export interface TripInvoiceInput {
  tripTitle: string;
  rows: CostRow[];
  totals: TripCostTotals;
  settlement: Settlement;
  /** Trip dates, already formatted, for the facts row. Null where the trip states none. */
  dateRange: string | null;
}

/**
 * The figure a row shows.
 *
 * A cancelled booking prints its amount struck through in words rather than
 * in styling the model cannot express: the label carries the status, and the
 * amount column stays empty. A reader scanning the numbers should not add up
 * something the trip is not paying.
 */
function rowAmount(booking: ParsedBooking, tripCurrency: string): string | null {
  if (booking.status === 'cancelled') return null;
  return formatMoneyOrNull(booking.amount, lineCurrency(booking, tripCurrency));
}

function categoryLabel(category: BookingCategory): string {
  return t(`booking.category.${category}`);
}

/**
 * One row per booking, grouped by category and sorted by date inside it.
 *
 * The category is in the row's own label rather than in a separate column,
 * because on a phone a fourth column is what pushes the amount off the
 * screen, and the amount is the reason the table exists.
 */
function linesFor(input: TripInvoiceInput): InvoiceLine[] {
  const byCategory = [...input.rows].sort((a, b) => {
    if (a.booking.category !== b.booking.category) {
      return a.booking.category.localeCompare(b.booking.category);
    }
    return (a.booking.date ?? '').localeCompare(b.booking.date ?? '');
  });

  return byCategory.map((row) => ({
    label: row.title,
    // By title, never by path: that is how every wikilink in this plugin is
    // followed, and a booking whose note has moved still opens.
    linkTarget: row.linkTarget,
    quantity: categoryLabel(row.booking.category),
    unitPrice: t(`booking.status.${row.booking.status}`),
    lineTotal: rowAmount(row.booking, input.totals.currency),
  }));
}

function columns(): InvoiceColumns {
  return {
    label: t('costs.invoice.booking'),
    quantity: t('costs.invoice.category'),
    unitPrice: t('costs.invoice.status'),
    lineTotal: t('costs.invoice.amount'),
  };
}

/**
 * The margin of the document: when the trip is, what is still only estimated,
 * and every currency it could not convert.
 *
 * The unconverted currencies are a fact rather than a footnote, because a
 * total that quietly excludes a third of the spending is the one way this
 * document could mislead.
 */
function factsFor(input: TripInvoiceInput): InvoiceFact[] {
  const facts: InvoiceFact[] = [];
  const { totals } = input;

  if (input.dateRange) {
    facts.push({ label: t('costs.dates'), value: input.dateRange, icon: 'calendar' });
  }

  const estimates = totals.statusCounts.estimate ?? 0;
  if (estimates > 0) {
    facts.push({
      label: t('costs.stillEstimated'),
      value: String(estimates),
      icon: 'circle-dashed',
    });
  }

  if (totals.paidConverted !== null) {
    facts.push({
      label: t('costs.paid'),
      value: formatMoney(totals.paidConverted, totals.currency),
      icon: 'wallet',
    });
  }

  for (const code of totals.unconvertedCurrencies) {
    const entry = totals.byCurrency.find((currency) => currency.currency === code);
    facts.push({
      label: t('costs.noRate', { currency: code }),
      value: entry ? formatMoney(entry.committed, code) : code,
      icon: 'triangle-alert',
    });
  }

  return facts;
}

/**
 * Subtotals per category, the trip total, and the budget beside it.
 *
 * The budget is the model's `stated` kind, which exists for exactly this:
 * a figure the source document claims, shown next to the computed one so the
 * interesting case, that they disagree, is visible rather than resolved.
 */
function totalsFor(totals: TripCostTotals): InvoiceTotal[] {
  const rows: InvoiceTotal[] = [];

  for (const category of totals.byCategory) {
    if (category.committed === null && category.planned === null) continue;
    rows.push({
      label: categoryLabel(category.category),
      amount: formatMoneyOrNull(category.committed, totals.currency) ?? '',
      kind: 'subtotal',
      // A category nobody budgeted says so rather than showing a variance
      // against zero: unbudgeted and over-by-everything are different facts.
      note:
        category.planned === null
          ? t('costs.unbudgeted')
          : t('costs.ofPlanned', {
              planned: formatMoney(category.planned, totals.currency),
            }),
    });
  }

  if (totals.committedConverted !== null) {
    rows.push({
      label: t('costs.committed'),
      amount: formatMoney(totals.committedConverted, totals.currency),
      kind: 'total',
      note: totals.unconvertedCurrencies.length > 0 ? t('costs.excludesUnconverted') : null,
    });
  }

  if (totals.plannedTotal !== null) {
    const variance =
      totals.committedConverted === null
        ? null
        : Math.round((totals.plannedTotal - totals.committedConverted) * 100) / 100;
    rows.push({
      label: t('costs.budget'),
      amount: formatMoney(totals.plannedTotal, totals.currency),
      kind: 'stated',
      note:
        variance === null
          ? null
          : variance >= 0
            ? t('costs.underBy', { amount: formatMoney(variance, totals.currency) })
            : t('costs.overBy', { amount: formatMoney(-variance, totals.currency) }),
    });
  }

  return rows;
}

/**
 * Who paid, who owes, and the transfers that clear it.
 *
 * Rendered only when more than one person paid for something: a trip where
 * one person paid for everything needs a sentence, not a table, and the block
 * writes that sentence itself.
 */
function footerFor(input: TripInvoiceInput): InvoiceFooter | null {
  const { settlement, totals } = input;
  if (settlement.payerCount < 2) return null;

  const money = (amount: number): string => formatMoney(amount, totals.currency);

  return {
    heading: t('costs.settlement'),
    groups: [
      {
        label: t('costs.balances'),
        entries: settlement.balances.map((balance) => ({
          label: t('costs.balanceLine', {
            person: balance.person,
            paid: money(balance.paid),
            owed: money(balance.owed),
            balance: money(balance.balance),
          }),
          linkTarget: balance.person,
        })),
      },
      {
        label: t('costs.transfers'),
        entries:
          settlement.transfers.length === 0
            ? [{ label: t('costs.alreadySquare') }]
            : settlement.transfers.map((transfer) => ({
                label: t('costs.transferLine', {
                  from: transfer.from,
                  to: transfer.to,
                  amount: money(transfer.amount),
                }),
              })),
      },
    ],
  };
}

export function tripInvoice(input: TripInvoiceInput): InvoiceModel {
  return {
    documentLabel: t('costs.documentLabel'),
    reference: input.tripTitle,
    counterparty: null,
    facts: factsFor(input),
    currency: input.totals.currency,
    columns: columns(),
    lines: linesFor(input),
    totals: totalsFor(input.totals),
    footer: footerFor(input),
  };
}
