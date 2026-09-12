/**
 * Creating a booking: title, which trip, what kind, and what it costs.
 *
 * Five fields and no more. Everything else a booking can carry (supplier,
 * reference, payer, who it is for, the document) is a property row away in
 * Obsidian's own editor, and a creation dialog that asked for all twelve
 * would be a form nobody fills in twice. The same minimal-frontmatter
 * bargain every other creator here makes.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { readTravelBoard } from '../../vault/read-entities';
import { currencyChoices } from '../costs/currency-options';
import { createBookingNote } from '../../vault/create-entities';
import { TravelTrip } from '../../vault/types';
import {
  BOOKING_CATEGORIES,
  BOOKING_STATUSES,
  BookingCategory,
  BookingStatus,
} from '../costs/booking-note';

/**
 * What an itinerary line knows about the booking it is about to become.
 *
 * The reference and the place are the two fields that make a booking
 * supersede an estimate, so a booking created from a leg or a night carries
 * them without anybody retyping what the trip already says.
 */
export interface BookingPreset {
  tripTitle?: string | null;
  title?: string | null;
  category?: BookingCategory;
  amount?: number | null;
  currency?: string | null;
  reference?: string | null;
  placeTitle?: string | null;
  /** Who the booking is for, which is what the split divides between. Taken off the line, so nobody retypes what the trip already says. */
  forTitles?: string[];
}

export class NewBookingModal extends BaseModal {
  private titleInput!: HTMLInputElement;
  private amountInput!: HTMLInputElement;
  private currency = '';
  private tripTitle: string;
  private category: BookingCategory;
  private status: BookingStatus = 'booked';
  private readonly trips: TravelTrip[];

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    /** What the dialog was opened from: a trip's costs block, or one line of its itinerary. Empty when opened from the command palette. */
    private readonly preset: BookingPreset = {},
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    this.trips = readTravelBoard(app, settings).trips;
    this.tripTitle = preset.tripTitle ?? '';
    this.category = preset.category ?? 'transport';
  }

  getTitle(): string {
    return t('modals.newBookingModal.title');
  }
  getIcon(): string {
    return 'receipt';
  }
  renderBody(bodyEl: HTMLElement): void {
    // Said out loud rather than carried invisibly: the reference and the
    // place travel with the preset, and they are what stops the itinerary
    // counting its estimate twice, so the person signing this off should be
    // able to see which line they are replacing.
    const replaces = this.preset.reference ?? this.preset.placeTitle;
    if (replaces) {
      bodyEl.createDiv({
        cls: 'setting-item-description',
        text: t('modals.newBookingModal.replacesEstimate', {
          item: this.preset.title ?? replaces,
        }),
      });
    }

    const fields = bodyEl.createDiv({ cls: 'apt-modal-fields' });

    this.titleInput = this.textField(fields, t('modals.common.titleField'));
    this.titleInput.value = this.preset.title ?? '';
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });
    window.setTimeout(() => this.titleInput.focus(), 0);

    const tripField = fields.createDiv({ cls: 'apt-modal-field' });
    tripField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.newBookingModal.tripField'),
    });
    const tripSelect = tripField.createEl('select', { cls: 'apt-modal-select' });
    tripSelect.createEl('option', { attr: { value: '' }, text: t('modals.common.noneOption') });
    for (const trip of this.trips) {
      tripSelect.createEl('option', { attr: { value: trip.title }, text: trip.title });
    }
    tripSelect.value = this.tripTitle;
    tripSelect.addEventListener('change', () => {
      this.tripTitle = tripSelect.value;
    });

    const categoryField = fields.createDiv({ cls: 'apt-modal-field' });
    categoryField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.newBookingModal.categoryField'),
    });
    const categorySelect = categoryField.createEl('select', { cls: 'apt-modal-select' });
    for (const category of BOOKING_CATEGORIES) {
      categorySelect.createEl('option', {
        attr: { value: category },
        text: t(`booking.category.${category}`),
      });
    }
    categorySelect.value = this.category;
    categorySelect.addEventListener('change', () => {
      this.category = categorySelect.value as BookingCategory;
    });

    const statusField = fields.createDiv({ cls: 'apt-modal-field' });
    statusField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.newBookingModal.statusField'),
    });
    const statusSelect = statusField.createEl('select', { cls: 'apt-modal-select' });
    for (const status of BOOKING_STATUSES) {
      statusSelect.createEl('option', {
        attr: { value: status },
        text: t(`booking.status.${status}`),
      });
    }
    statusSelect.value = this.status;
    statusSelect.addEventListener('change', () => {
      this.status = statusSelect.value as BookingStatus;
    });

    this.amountInput = this.textField(fields, t('modals.newBookingModal.amountField'));
    this.amountInput.type = 'number';
    this.amountInput.step = '0.01';
    // The estimate, offered as the starting figure. It is what the trip
    // currently believes this costs, and the booking is the moment that
    // belief is either confirmed or corrected.
    if (this.preset.amount !== null && this.preset.amount !== undefined) {
      this.amountInput.value = String(this.preset.amount);
    }

    // The line's own currency, then the trip's, then the setting: a
    // single-currency vault picks a currency exactly zero times.
    this.currency =
      this.preset.currency ??
      this.trips.find((trip) => trip.title === this.tripTitle)?.currency ??
      this.settings.homeCurrency;

    const currencyField = fields.createDiv({ cls: 'apt-modal-field' });
    currencyField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.newBookingModal.currencyField'),
    });
    const currencySelect = currencyField.createEl('select', { cls: 'apt-modal-select' });
    for (const code of currencyChoices({
      configured: this.settings.currencyOptions,
      homeCurrency: this.settings.homeCurrency,
      current: this.currency,
    })) {
      currencySelect.createEl('option', { attr: { value: code }, text: code });
    }
    currencySelect.value = this.currency;
    currencySelect.addEventListener('change', () => {
      this.currency = currencySelect.value;
    });
  }

  private textField(container: HTMLElement, label: string): HTMLInputElement {
    const field = container.createDiv({ cls: 'apt-modal-field' });
    field.createEl('label', { cls: 'apt-modal-field-label', text: label });
    return field.createEl('input', { cls: 'apt-modal-input', attr: { type: 'text' } });
  }

  renderFooter(footerEl: HTMLElement): void {
    addFooterButtons(footerEl, {
      confirmLabel: t('modals.common.create'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
  }

  private async submit(): Promise<void> {
    const title = this.titleInput.value.trim();
    if (!title) {
      new Notice(t('modals.common.titleRequired'));
      return;
    }

    // An empty amount is not zero: a booking nobody has priced yet is an
    // ordinary state, and writing a 0 would put it in the totals as free.
    const raw = this.amountInput.value.trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount !== null && !Number.isFinite(amount)) {
      new Notice(t('modals.newBookingModal.amountInvalid'));
      return;
    }

    try {
      const file = await createBookingNote(this.app, this.settings, title, {
        tripTitle: this.tripTitle || null,
        category: this.category,
        status: this.status,
        amount,
        currency: this.currency.trim().toUpperCase() || null,
        reference: this.preset.reference ?? null,
        placeTitle: this.preset.placeTitle ?? null,
        forTitles: this.preset.forTitles ?? [],
      });
      new Notice(t('modals.newBookingModal.created', { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
