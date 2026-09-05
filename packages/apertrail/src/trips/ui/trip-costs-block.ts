/**
 * A trip's money, inside the trip note, as an `apt-trip-costs` fenced block.
 *
 * What keeps a dozen booking notes from feeling like a dozen booking notes:
 * one place that says what the trip is going to cost, what it has cost so
 * far, how that compares to the plan, and who owes whom. Every figure is
 * derived from the bookings on each render and written nowhere, which is the
 * answer to the objection the Trip redesign raised against money.
 *
 * A MarkdownRenderChild rather than a render function, for the reason the
 * itinerary block already is one: it writes (budget lines, rates), and a
 * redraw fired from its own write reads frontmatter as it was before the
 * edit. It also watches the booking notes it is showing, since ticking a
 * status over there has to move a total over here.
 *
 * See docs/design/trip-budget-and-bookings.md §7.2.
 */
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, Notice, setIcon } from 'obsidian';
import { renderInvoice } from '@technosoftware/trail-core/obsidian';
import { parseDayTitle } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelBooking, TravelTrip } from '../../vault/types';
import { TripInput, tripToInput, updateTripNote } from '../write-trip';
import { estimateLabels } from '../costs/estimate-labels';
import { estimateLines } from '../costs/estimates';
import { tripInvoice } from '../costs/invoice-model';
import { tripSettlement } from '../costs/split';
import { tripCostTotals, TripCostTotals } from '../costs/totals';
import { APT_TRIP_COSTS_BLOCK_LANG } from '../costs/trip-costs-block-lang';
import { NewBookingModal } from './new-booking-modal';
import { BudgetEditorModal, RateEditorModal } from './budget-editor-modals';
import { exportTripCostSheet } from './export-trip-costs';
import { formatMediumDate, formatMoney } from '../../shared/display';

export { APT_TRIP_COSTS_BLOCK_LANG };

export interface TripCostsBlockDeps {
  getSettings: () => APERtrailSettings;
  openFile: (path: string) => void;
}

class TripCostsRenderer extends MarkdownRenderChild {
  /** The booking notes this block is currently showing, so a status changed over there redraws the totals here. */
  private shownBookingPaths = new Set<string>();

  constructor(
    private readonly app: App,
    private readonly el: HTMLElement,
    private readonly sourcePath: string,
    private readonly deps: TripCostsBlockDeps
  ) {
    super(el);
  }

  onload(): void {
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file.path === this.sourcePath || this.shownBookingPaths.has(file.path)) this.render();
      })
    );
    this.render();
  }

  private async save(trip: TravelTrip, mutate: (input: TripInput) => void): Promise<void> {
    const input = tripToInput(trip);
    mutate(input);
    try {
      await updateTripNote(this.app, this.deps.getSettings(), trip.file, input);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('costs.saveFailed'));
    }
  }

  private render(): void {
    const { el } = this;
    el.empty();
    el.addClass('apt-trip-costs');

    const settings = this.deps.getSettings();
    const board = readTravelBoard(this.app, settings);
    const trip = board.trips.find((candidate) => candidate.file.path === this.sourcePath);

    if (!trip) {
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('costs.notATrip') });
      return;
    }

    // The master switch, honoured here rather than at registration: a block
    // that vanished from a note would look like a broken fence, and one that
    // says it is switched off can be switched back on.
    if (!settings.budgetEnabled) {
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('costs.switchedOff') });
      return;
    }

    const bookings = board.bookings.filter((booking) => booking.tripTitle === trip.title);
    this.shownBookingPaths = new Set(bookings.map((booking) => booking.file.path));

    const currency = trip.currency ?? settings.homeCurrency;
    const budget = trip.budget
      .filter((line) => line.amount !== null)
      .map((line) => ({ category: line.category as never, amount: line.amount }));
    const rates = trip.rates
      .filter((rate) => rate.rate !== null)
      .map((rate) => ({ currency: rate.currency, rate: rate.rate }));

    // What the itinerary itself says a leg or a night will cost, minus every
    // line a booking has already taken over. Counted as committed, because a
    // budget that only counts what is booked reads as comfortable right up
    // to the moment it is not.
    const estimates = estimateLines(trip, bookings, trip.title, estimateLabels());
    const priced = [...bookings, ...estimates];

    const totals = tripCostTotals({ bookings: priced, budget, rates, currency });
    // Real bookings only: an estimate is not money anybody has spent, so it
    // has no payer to be owed and nobody to owe it.
    const settlement = tripSettlement({
      bookings,
      participants: trip.personTitles,
      currency,
      rates,
    });

    this.renderActions(el, trip);
    this.renderSummary(el, totals);

    if (priced.length === 0) {
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('costs.noBookings') });
      return;
    }

    renderInvoice(
      el,
      tripInvoice({
        tripTitle: trip.title,
        rows: [
          ...bookings.map((booking) => ({
            title: booking.title,
            linkTarget: booking.title,
            booking,
          })),
          ...estimates.map((estimate) => ({
            title: estimate.title,
            // Nothing to open: the figure lives in the trip's own
            // frontmatter, which is the note the reader is already in.
            linkTarget: null,
            booking: estimate,
          })),
        ],
        totals,
        settlement,
        dateRange: dateRange(trip),
      }),
      (title) => this.openByTitle(title, bookings)
    );

    // One payer needs a sentence rather than a table, and the invoice's
    // footer stays out of the way for exactly that case.
    if (settlement.payerCount === 1) {
      const payer = settlement.balances.find((balance) => balance.paid > 0);
      const owed = settlement.transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
      if (payer && owed > 0) {
        el.createDiv({
          cls: 'apt-trip-costs-note',
          text: t('costs.onePayer', {
            person: payer.person,
            amount: formatMoney(Math.round(owed * 100) / 100, totals.currency),
          }),
        });
      }
    }

    if (settlement.unconvertedCurrencies.length > 0) {
      el.createDiv({
        cls: 'apt-trip-costs-note',
        text: t('costs.settlementIncomplete', {
          currencies: settlement.unconvertedCurrencies.join(', '),
        }),
      });
    }
  }

  /** Follows a row to the note behind it, by title rather than by path, the way every wikilink here is followed. */
  private openByTitle(title: string, bookings: TravelBooking[]): void {
    const booking = bookings.find((candidate) => candidate.title === title);
    if (booking) {
      this.deps.openFile(booking.file.path);
      return;
    }
    // A settlement row links a person, whose note this block does not read.
    const person = this.app.metadataCache.getFirstLinkpathDest(title, this.sourcePath);
    if (person) this.deps.openFile(person.path);
  }

  /**
   * The heading, then the four things you can do to a trip's money.
   *
   * On its own line rather than beside them: a word sitting to the left of a
   * row of buttons reads as a label FOR those buttons, when it is the
   * heading of everything below. And four buttons beside a heading do not
   * fit a phone, so the last one ran off the side of the screen.
   */
  private renderActions(container: HTMLElement, trip: TravelTrip): void {
    container.createDiv({ cls: 'apt-photo-spot-heading', text: t('costs.heading') });
    const actions = container.createDiv({ cls: 'apt-trip-costs-actions' });

    const add = (label: string, icon: string, onClick: () => void): void => {
      const btn = actions.createEl('button', { cls: 'apt-photo-spot-add-btn' });
      setIcon(btn.createSpan({ cls: 'apt-chip-icon' }), icon);
      btn.createSpan({ text: label });
      btn.addEventListener('click', () => onClick());
    };

    add(t('costs.addBooking'), 'plus', () => {
      new NewBookingModal(this.app, this.deps.getSettings(), { tripTitle: trip.title }).open();
    });
    add(t('costs.editBudget'), 'target', () => {
      new BudgetEditorModal(this.app, trip, this.deps.getSettings(), (budget, currency) => {
        void this.save(trip, (input) => {
          input.budget = budget;
          input.currency = currency;
        });
      }).open();
    });
    add(t('costs.exportSheet'), 'printer', () => {
      const board = readTravelBoard(this.app, this.deps.getSettings());
      void exportTripCostSheet(
        this.app,
        this.deps.getSettings(),
        trip,
        board.bookings.filter((booking) => booking.tripTitle === trip.title)
      );
    });
    add(t('costs.editRates'), 'arrow-left-right', () => {
      new RateEditorModal(this.app, trip, this.deps.getSettings(), (rates) => {
        void this.save(trip, (input) => {
          input.rates = rates;
        });
      }).open();
    });
  }

  /**
   * Planned, committed and paid, side by side, and one line per currency
   * that is not the trip's.
   *
   * The per-currency lines are not decoration: they are the reason the
   * converted total can be trusted. A reader who can see "EUR 220 at 0.94"
   * knows exactly which figure is somebody's own arithmetic.
   */
  private renderSummary(container: HTMLElement, totals: TripCostTotals): void {
    const strip = container.createDiv({ cls: 'apt-trip-costs-summary' });

    const tile = (label: string, value: string | null, cls = ''): void => {
      const cell = strip.createDiv({
        cls: cls ? `apt-trip-costs-tile ${cls}` : 'apt-trip-costs-tile',
      });
      cell.createDiv({ cls: 'apt-trip-costs-tile-label', text: label });
      cell.createDiv({ cls: 'apt-trip-costs-tile-value', text: value ?? t('costs.nothingYet') });
    };

    tile(
      t('costs.planned'),
      totals.plannedTotal === null ? null : formatMoney(totals.plannedTotal, totals.currency)
    );
    tile(
      t('costs.committed'),
      totals.committedConverted === null
        ? null
        : formatMoney(totals.committedConverted, totals.currency)
    );
    tile(
      t('costs.paid'),
      totals.paidConverted === null ? null : formatMoney(totals.paidConverted, totals.currency)
    );

    if (totals.plannedTotal !== null && totals.committedConverted !== null) {
      const variance = Math.round((totals.plannedTotal - totals.committedConverted) * 100) / 100;
      tile(
        variance >= 0 ? t('costs.left') : t('costs.over'),
        formatMoney(Math.abs(variance), totals.currency),
        variance >= 0 ? 'is-under' : 'is-over'
      );
    }

    const foreign = totals.byCurrency.filter((entry) => entry.currency !== totals.currency);
    if (foreign.length === 0) return;

    const lines = container.createDiv();
    for (const entry of foreign) {
      lines.createDiv({
        cls: 'apt-trip-costs-currency',
        text:
          entry.rate === null
            ? t('costs.currencyNoRate', {
                amount: formatMoney(entry.committed, entry.currency),
              })
            : t('costs.currencyAtRate', {
                amount: formatMoney(entry.committed, entry.currency),
                rate: String(entry.rate),
                converted: formatMoney(entry.convertedCommitted ?? 0, totals.currency),
              }),
      });
    }
  }
}

/** The trip's own dates, for the document's facts row. Absent dates print nothing rather than a half range. */
function dateRange(trip: TravelTrip): string | null {
  const from = parseDayTitle((trip.departure ?? '').slice(0, 10));
  const to = parseDayTitle((trip.return ?? '').slice(0, 10));
  if (!from && !to) return null;
  if (from && to) return `${formatMediumDate(from)} - ${formatMediumDate(to)}`;
  return formatMediumDate(from ?? to);
}

export function registerTripCostsBlock(
  app: App,
  deps: TripCostsBlockDeps,
  register: (
    lang: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
  ) => void
): void {
  register(APT_TRIP_COSTS_BLOCK_LANG, (_source, el, ctx) => {
    ctx.addChild(new TripCostsRenderer(app, el, ctx.sourcePath, deps));
  });
}
