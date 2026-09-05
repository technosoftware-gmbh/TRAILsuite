/**
 * Writes a trip's cost sheet beside its note.
 *
 * The App-bound half: it reads the trip and its bookings, formats every
 * figure through the same helpers the block draws with, and hands the result
 * to the pure builder. Same arrangement, and the same two decisions, as the
 * photo spot field sheet: written into the vault rather than offered as a
 * download, and overwritten without asking, because it is a rendering of
 * notes rather than a document anybody edits.
 */
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { parseDayTitle, sanitizeTitle } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { ensureParentFolders } from '../../shared/note-creation';
import { TravelBooking, TravelTrip } from '../../vault/types';
import { buildCostSheetHtml, CostSheet, CostSheetTotalRow } from '../costs/export-trip-costs';
import { estimateLabels } from '../costs/estimate-labels';
import { estimateLines } from '../costs/estimates';
import { tripSettlement } from '../costs/split';
import { lineCurrency, tripCostTotals } from '../costs/totals';
import { tripExportFolder } from '../trip-folder';
import { formatMediumDate, formatMoney, formatMoneyOrNull } from '../../shared/display';

function formatDay(value: string | null): string | null {
  const parsed = parseDayTitle((value ?? '').slice(0, 10));
  return parsed ? formatMediumDate(parsed) : null;
}

/** The trip's own dates. Absent dates print nothing rather than half a range. */
function dateRange(trip: TravelTrip): string | null {
  const from = formatDay(trip.departure);
  const to = formatDay(trip.return);
  if (from && to) return `${from} - ${to}`;
  return from ?? to;
}

export function buildCostSheet(
  trip: TravelTrip,
  bookings: TravelBooking[],
  settings: APERtrailSettings,
  today: Date = new Date()
): CostSheet {
  const currency = trip.currency ?? settings.homeCurrency;
  const budget = trip.budget
    .filter((line) => line.amount !== null)
    .map((line) => ({ category: line.category as never, amount: line.amount }));
  const rates = trip.rates
    .filter((rate) => rate.rate !== null)
    .map((rate) => ({ currency: rate.currency, rate: rate.rate }));

  // The same two lists the costs block builds, for the same reason: a sheet
  // that left the itinerary's own estimates out would print a smaller trip
  // than the screen shows.
  const priced = [...bookings, ...estimateLines(trip, bookings, trip.title, estimateLabels())];

  const totals = tripCostTotals({ bookings: priced, budget, rates, currency });
  const settlement = tripSettlement({
    bookings,
    participants: trip.personTitles,
    currency,
    rates,
  });

  const summary: { label: string; value: string }[] = [];
  if (totals.plannedTotal !== null) {
    summary.push({
      label: t('costs.planned'),
      value: formatMoney(totals.plannedTotal, currency),
    });
  }
  if (totals.committedConverted !== null) {
    summary.push({
      label: t('costs.committed'),
      value: formatMoney(totals.committedConverted, currency),
    });
  }
  if (totals.paidConverted !== null) {
    summary.push({ label: t('costs.paid'), value: formatMoney(totals.paidConverted, currency) });
  }

  // Every currency the trip spends in, with the rate where it has one. On
  // paper this is what makes a converted total readable rather than merely
  // present: a reader can see exactly which figure is somebody's own
  // arithmetic.
  const currencyLines = totals.byCurrency
    .filter((entry) => entry.currency !== currency)
    .map((entry) =>
      entry.rate === null
        ? t('costs.currencyNoRate', { amount: formatMoney(entry.committed, entry.currency) })
        : t('costs.currencyAtRate', {
            amount: formatMoney(entry.committed, entry.currency),
            rate: String(entry.rate),
            converted: formatMoney(entry.convertedCommitted ?? 0, currency),
          })
    );

  const totalRows: CostSheetTotalRow[] = [];
  for (const category of totals.byCategory) {
    if (category.committed === null && category.planned === null) continue;
    totalRows.push({
      label: t(`booking.category.${category.category}`),
      amount: formatMoneyOrNull(category.committed, currency) ?? '',
      note:
        category.planned === null
          ? t('costs.unbudgeted')
          : t('costs.ofPlanned', { planned: formatMoney(category.planned, currency) }),
      emphasis: 'subtotal',
    });
  }
  if (totals.committedConverted !== null) {
    totalRows.push({
      label: t('costs.committed'),
      amount: formatMoney(totals.committedConverted, currency),
      note: totals.unconvertedCurrencies.length > 0 ? t('costs.excludesUnconverted') : null,
      emphasis: 'total',
    });
  }
  if (totals.plannedTotal !== null) {
    totalRows.push({
      label: t('costs.budget'),
      amount: formatMoney(totals.plannedTotal, currency),
      note: null,
      emphasis: 'plan',
    });
  }

  const money = (amount: number): string => formatMoney(amount, currency);

  return {
    title: t('costs.sheetTitle', { trip: trip.title }),
    subtitle: trip.country?.title ?? trip.countryTitle,
    dateRange: dateRange(trip),
    currencyLines,
    summary,
    rows: [...priced]
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (a.date ?? '').localeCompare(b.date ?? '');
      })
      .map((booking) => ({
        label: booking.title,
        category: t(`booking.category.${booking.category}`),
        status: t(`booking.status.${booking.status}`),
        amount:
          booking.status === 'cancelled'
            ? null
            : formatMoneyOrNull(booking.amount, lineCurrency(booking, currency)),
        date: formatDay(booking.date),
        reference: booking.reference,
        // The name only: the file itself stays in the vault, and a sheet is
        // evidence that a confirmation exists rather than a copy of it.
        documentName: booking.documentPath ?? null,
      })),
    totals: totalRows,
    balances:
      settlement.payerCount < 2
        ? []
        : settlement.balances.map((balance) =>
            t('costs.balanceLine', {
              person: balance.person,
              paid: money(balance.paid),
              owed: money(balance.owed),
              balance: money(balance.balance),
            })
          ),
    transfers:
      settlement.payerCount < 2
        ? []
        : settlement.transfers.map((transfer) =>
            t('costs.transferLine', {
              from: transfer.from,
              to: transfer.to,
              amount: money(transfer.amount),
            })
          ),
    labels: {
      bookings: t('costs.heading'),
      settlement: t('costs.settlement'),
      booking: t('costs.invoice.booking'),
      category: t('costs.invoice.category'),
      status: t('costs.invoice.status'),
      amount: t('costs.invoice.amount'),
      date: t('costs.dates'),
      reference: t('costs.reference'),
    },
    caveat: t('costs.sheetCaveat'),
    footer: t('costs.sheetFooter', { date: formatMediumDate(today) }),
  };
}

export async function exportTripCostSheet(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip,
  bookings: TravelBooking[]
): Promise<void> {
  const sheet = buildCostSheet(trip, bookings, settings);
  // The same folder the trip document lands in, so a trip's renderings are one
  // place rather than two. A flat trip owns no folder, so this is still beside
  // the note for every trip that has not been given one.
  const folder = tripExportFolder(settings, {
    path: trip.file.path,
    basename: trip.file.basename,
  });
  const name = sanitizeTitle(`${trip.title} ${t('costs.sheetFileSuffix')}`);
  const path = normalizePath(folder ? `${folder}/${name}.html` : `${name}.html`);

  try {
    await ensureParentFolders(app, path);
    const existing = app.vault.getFileByPath(path);
    const html = buildCostSheetHtml(sheet);
    if (existing instanceof TFile) await app.vault.modify(existing, html);
    else await app.vault.create(path, html);
    new Notice(t('costs.sheetWritten', { path }));
  } catch (err) {
    new Notice(err instanceof Error ? err.message : t('costs.sheetFailed'));
  }
}
