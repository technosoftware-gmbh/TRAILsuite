/**
 * The trip's own money, edited from the costs block: the plan per category,
 * and the rates the trip converts foreign bookings at.
 *
 * Two small dialogs rather than property rows, because both are lists of
 * maps and Obsidian's property editor refuses those. That is the same reason
 * the itinerary's stops are edited from a block, and the reason a booking
 * needs no dialog at all: everything on a booking is a scalar.
 *
 * Neither writes anything itself. Both hand a whole list back to the block,
 * which writes the trip through the one save path, so a half-edited budget
 * can never reach a note.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip } from '../../vault/types';
import { currencyChoices } from '../costs/currency-options';
import { BOOKING_CATEGORIES, BookingCategory } from '../costs/booking-note';
import { TripBudgetInput, TripRateInput } from '../trip-note';

/** A number a person typed: empty means "no line", not zero. */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export class BudgetEditorModal extends Modal {
  private readonly amounts = new Map<BookingCategory, string>();
  private currency: string;

  constructor(
    app: App,
    trip: TravelTrip,
    private readonly settings: APERtrailSettings,
    private readonly onSave: (budget: TripBudgetInput[], currency: string | null) => void
  ) {
    super(app);
    this.currency = trip.currency ?? '';
    for (const line of trip.budget) {
      if (line.amount !== null) {
        this.amounts.set(line.category as BookingCategory, String(line.amount));
      }
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-item-editor');
    contentEl.createEl('h2', { text: t('modals.budgetEditor.title') });
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('modals.budgetEditor.intro'),
    });

    new Setting(contentEl)
      .setName(t('modals.budgetEditor.currency'))
      .setDesc(t('modals.budgetEditor.currencyDesc'))
      .addDropdown((dd) => {
        // Empty means the home currency, which is what an unset trip already
        // falls back to. Naming it here rather than leaving a blank line.
        dd.addOption('', t('costs.currencyFromHome', { currency: this.settings.homeCurrency }));
        for (const code of currencyChoices({
          configured: this.settings.currencyOptions,
          homeCurrency: this.settings.homeCurrency,
          current: this.currency,
        })) {
          dd.addOption(code, code);
        }
        dd.setValue(this.currency).onChange((value) => {
          this.currency = value;
        });
      });

    // Every category gets a row, including the ones with no line yet: a
    // budget is a decision about all of them, and an empty row is how you
    // say "this one is not budgeted".
    for (const category of BOOKING_CATEGORIES) {
      new Setting(contentEl).setName(t(`booking.category.${category}`)).addText((text) =>
        text
          .setPlaceholder(t('modals.budgetEditor.noCeiling'))
          .setValue(this.amounts.get(category) ?? '')
          .onChange((value) => this.amounts.set(category, value))
      );
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText(t('modals.tripEditor.cancel')).onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText(t('modals.tripEditor.save'))
          .setCta()
          .onClick(() => {
            const budget: TripBudgetInput[] = [];
            for (const category of BOOKING_CATEGORIES) {
              const raw = this.amounts.get(category) ?? '';
              if (raw.trim() === '') continue;
              const amount = parseAmount(raw);
              if (amount === null) {
                new Notice(t('modals.budgetEditor.invalid', { category }));
                return;
              }
              budget.push({ category, amount });
            }
            this.onSave(budget, this.currency || null);
            this.close();
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * The rates, one row per currency the trip already has bookings in, plus a
 * blank row for one it does not yet.
 *
 * Offering exactly the currencies in play is what keeps this from being a
 * currency table: a rate is only ever needed for money this trip actually
 * spent.
 */
export class RateEditorModal extends Modal {
  private readonly rates: { currency: string; raw: string }[];

  constructor(
    app: App,
    trip: TravelTrip,
    private readonly settings: APERtrailSettings,
    private readonly onSave: (rates: TripRateInput[]) => void
  ) {
    super(app);
    this.rates = trip.rates.map((rate) => ({
      currency: rate.currency,
      raw: rate.rate === null ? '' : String(rate.rate),
    }));
    // One blank row so a rate can be added without a second button.
    this.rates.push({ currency: '', raw: '' });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-item-editor');
    contentEl.createEl('h2', { text: t('modals.rateEditor.title') });
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('modals.rateEditor.intro'),
    });

    this.rates.forEach((rate, index) => {
      new Setting(contentEl)
        .setName(t('modals.rateEditor.row', { index: index + 1 }))
        .addDropdown((dd) => {
          dd.addOption('', t('modals.rateEditor.currencyPlaceholder'));
          for (const code of currencyChoices({
            configured: this.settings.currencyOptions,
            homeCurrency: this.settings.homeCurrency,
            current: rate.currency,
          })) {
            dd.addOption(code, code);
          }
          dd.setValue(rate.currency).onChange((value) => {
            rate.currency = value;
          });
        })
        .addText((text) =>
          text
            .setPlaceholder(t('modals.rateEditor.ratePlaceholder'))
            .setValue(rate.raw)
            .onChange((value) => {
              rate.raw = value;
            })
        );
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText(t('modals.tripEditor.cancel')).onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText(t('modals.tripEditor.save'))
          .setCta()
          .onClick(() => {
            const kept: TripRateInput[] = [];
            for (const rate of this.rates) {
              if (!rate.currency && rate.raw.trim() === '') continue;
              const value = parseAmount(rate.raw);
              if (!rate.currency || value === null || value <= 0) {
                new Notice(t('modals.rateEditor.invalid'));
                return;
              }
              kept.push({ currency: rate.currency, rate: value });
            }
            this.onSave(kept);
            this.close();
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
