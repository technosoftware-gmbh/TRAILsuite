/**
 * Small, single-item editors for one itinerary stop, one accommodation
 * stay, or one transport leg -- opened from the itinerary block's own
 * per-row buttons rather than from the trip editor.
 *
 * These exist because the trip editor didn't scale. It rendered every
 * stop, night and leg as a run of Setting rows in one scrolling dialog
 * that re-rendered wholesale on each change, so a ten-stop trip meant
 * roughly fifty form rows and a modal taller than the screen. Reported
 * from real use.
 *
 * The fix is to edit one item at a time, from the itinerary you're
 * already looking at: each of these modals is four or five fields and a
 * fixed height no matter how long the trip is. The trip editor keeps only
 * what belongs to the trip as a whole (basics and participants).
 *
 * Each takes a value and hands back an edited copy; none of them touch
 * the vault. The caller owns the write, so one save path stays
 * responsible for the whole note -- see trips/ui/itinerary-block.ts.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import {
  TripDayInput,
  TripLegInput,
  TripNightInput,
  TripStopInput,
  TRIP_LEG_MODES,
} from '../trip-note';
import { CostUnit, costUnitsFor } from '../costs/line-cost';
import { currencyChoices } from '../costs/currency-options';
import {
  renderDateField,
  renderDateTimeField,
  renderDayField,
  renderRatingField,
  renderTimeField,
} from '../../ui/components/date-time-field';
import { clockTime, dateOfDay } from '../relative-days';
import { TravelPlacePickerModal } from '../../places/ui/place-picker-modal';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelPlace } from '../../vault/types';
import { goldenHourPrefill, StopTimeSuggestion } from '../trip-light';
import { formatDateTimeStamp, parseDayTitle } from 'trail-core';
import { formatMediumDate } from '../../shared/display';

/**
 * When the place picked for a stop is a photo spot, fill the stop's times
 * from the first light window of the motif it is for, on that day.
 *
 * Only when the stop carries no clock time yet. A stop added from a day
 * header arrives with a bare date and nothing else, which is exactly the
 * case worth helping with; one you already timed is left alone, because a
 * suggestion that overwrites an answer is not a suggestion. See
 * docs/design/photo-spots.md §6.2.
 *
 * Returns what it applied so the editor can say where the times came from.
 * A time that appears by itself and happens to be wrong is worse than no
 * time; the same time with its window named is a suggestion the reader can
 * disagree with.
 */
function applyGoldenHourPrefill(
  app: App,
  settings: APERtrailSettings,
  stop: TripStopInput,
  title: string
): StopTimeSuggestion | null {
  const hasClockTime = !!stop.from && stop.from.includes('T');
  if (hasClockTime) return null;

  const place = photoSpotByTitle(app, settings, title);
  if (!place) return null;

  const day = parseDayTitle((stop.from ?? '').slice(0, 10)) ?? new Date();
  const suggestion = goldenHourPrefill(place, day, stop.motifName);
  if (!suggestion) return null;

  stop.from = formatDateTimeStamp(suggestion.from);
  stop.to = suggestion.to ? formatDateTimeStamp(suggestion.to) : stop.to;
  return suggestion;
}

/** The photo spot a stop points at, or null for a stop at anything else. Every caller here wants the spot rather than the place. */
function photoSpotByTitle(
  app: App,
  settings: APERtrailSettings,
  title: string
): TravelPlace | null {
  const board = readTravelBoard(app, settings);
  const place = board.places.find((candidate) => candidate.title === title);
  return place && place.kind === 'photospot' && place.photoSpot ? place : null;
}

/**
 * An amount, its currency, and what the amount is per.
 *
 * The three a line carries while a trip is still being planned: what it is
 * expected to cost, before there is anything to book. Empty is not zero,
 * which is why the amount is read as null rather than coerced: a flight
 * nobody has priced and a flight on points are different facts.
 *
 * The unit is the answer to "two people means two tickets": an airline
 * quotes per passenger and a hotel quotes a room per night, so the figure
 * alone cannot say what it means. The dropdown opens on whichever unit that
 * kind of line is normally quoted in, which is why `kind` is here.
 */
function renderCostField(
  containerEl: HTMLElement,
  label: string,
  value: { cost: number | null; currency: string | null; costUnit: CostUnit },
  settings: APERtrailSettings,
  kind: 'stop' | 'night' | 'leg'
): void {
  const setting = new Setting(containerEl)
    .setName(label)
    .setDesc(t('modals.tripEditor.costDesc'))
    .addText((text) =>
      text
        .setPlaceholder(t('modals.tripEditor.costPlaceholder'))
        .setValue(value.cost === null ? '' : String(value.cost))
        .onChange((raw) => {
          const trimmed = raw.trim().replace(',', '.');
          const parsed = Number(trimmed);
          value.cost = trimmed === '' || !Number.isFinite(parsed) ? null : parsed;
        })
    )
    .addDropdown((dd) => {
      // Empty first, and it means the trip's own currency rather than
      // nothing: a single-currency trip should never pick a currency at all.
      dd.addOption('', t('costs.currencyFromTrip'));
      for (const code of currencyChoices({
        configured: settings.currencyOptions,
        homeCurrency: settings.homeCurrency,
        current: value.currency,
      })) {
        dd.addOption(code, code);
      }
      dd.setValue(value.currency ?? '').onChange((raw) => {
        value.currency = raw === '' ? null : raw;
      });
    })
    .addDropdown((dd) => {
      for (const unit of costUnitsFor(kind)) dd.addOption(unit, t(`costs.unit.${unit}`));
      dd.setValue(value.costUnit).onChange((raw) => {
        value.costUnit = raw as CostUnit;
      });
    });

  // Three controls in one row squeeze the label column to a word per line
  // unless the row is allowed to wrap; see the rule in styles.css.
  setting.settingEl.addClass('apt-cost-field');
}

/**
 * Who on the trip this line is for.
 *
 * Drawn only for a trip with more than one participant: on a solo trip
 * there is no question to ask, and a form row that always answers itself is
 * a row worth not having.
 *
 * Ticking everybody writes NOTHING, because an empty list already means
 * everybody. That keeps a note minimal, and it means a fourth person joining
 * the trip later joins every line that never disagreed with it, rather than
 * quietly missing from the flights.
 */
function renderTravellersField(
  containerEl: HTMLElement,
  value: { persons: string[] },
  participants: string[]
): void {
  if (participants.length < 2) return;

  new Setting(containerEl)
    .setName(t('modals.tripEditor.travellers'))
    .setDesc(t('modals.tripEditor.travellersDesc'))
    .setHeading();

  const list = containerEl.createDiv({ cls: 'apt-traveller-picker' });
  const chosen = new Set(value.persons.length > 0 ? value.persons : participants);

  const commit = (): void => {
    const picked = participants.filter((person) => chosen.has(person));
    value.persons = picked.length === participants.length ? [] : picked;
  };

  for (const person of participants) {
    const row = list.createEl('label', { cls: 'apt-traveller-option' });
    const box = row.createEl('input', { attr: { type: 'checkbox' } });
    box.checked = chosen.has(person);
    row.createSpan({ text: person });
    box.addEventListener('change', () => {
      if (box.checked) chosen.add(person);
      else chosen.delete(person);
      commit();
    });
  }
}

/** Shared chrome: title, body, then Cancel / Save. Keeps the three editors below identical in shape without a base class none of them would otherwise need. */
/**
 * When an item happens: a day of the trip, or a date of its own.
 *
 * The two states an itinerary can be in, and the form shows one of them at a
 * time. Type a day number and the date inputs give way to bare clock times,
 * because the date is then what the day number says and a date input beside it
 * would be a control whose value is ignored -- the shape of defect this
 * repository keeps finding under the name "correct code standing where it can
 * never run".
 *
 * **Switching converts rather than clears, in the direction that can be
 * converted.** Going relative keeps the clock time and drops the date, which
 * the day number now supplies. Coming back needs a date to put the time on,
 * and takes it from the day number through the trip's departure; a trip with
 * no departure has none to give, so the time goes and the field is empty
 * rather than holding a bare time an absolute reader would discard on the way
 * back in.
 */
function renderWhen(
  containerEl: HTMLElement,
  labels: { day: string; from: string; to: string },
  point: { day: number | null; from: string | null; to: string | null },
  departure: string | null,
  redraw: () => void
): void {
  const resolved = point.day === null ? null : dateOfDay(departure, point.day);
  renderDayField(
    containerEl,
    labels.day,
    resolved
      ? formatMediumDate(parseDayTitle(resolved) ?? new Date())
      : t('modals.tripEditor.dayDesc'),
    point.day,
    (day) => {
      const wasRelative = point.day !== null;
      point.day = day;

      if (day !== null && !wasRelative) {
        point.from = clockTime(point.from);
        point.to = clockTime(point.to);
      } else if (day === null && wasRelative) {
        const date = dateOfDay(departure, point.day ?? 0);
        point.from = absolute(date, point.from);
        point.to = absolute(date, point.to);
      }
      redraw();
    }
  );

  if (point.day === null) {
    renderDateTimeField(containerEl, labels.from, point.from, (value) => {
      point.from = value;
    });
    renderDateTimeField(containerEl, labels.to, point.to, (value) => {
      point.to = value;
    });
    return;
  }

  renderTimeField(containerEl, labels.from, clockTime(point.from), (value) => {
    point.from = value;
  });
  renderTimeField(containerEl, labels.to, clockTime(point.to), (value) => {
    point.to = value;
  });
}

/** What a day number resolves to, for the field's own description. */
function arrivalHint(departure: string | null, day: number | null): string {
  const date = day === null ? null : dateOfDay(departure, day);
  const parsed = date ? parseDayTitle(date) : null;
  return parsed ? formatMediumDate(parsed) : t('modals.tripEditor.dayDesc');
}

/** A bare time put back on a date, or nothing when there is no date to put it on. */
function absolute(date: string | null, time: string | null): string | null {
  const clock = clockTime(time);
  if (!date) return null;
  return clock ? `${date}T${clock}` : date;
}

abstract class ItemEditorModal<T> extends Modal {
  protected value: T;

  constructor(
    app: App,
    protected readonly settings: APERtrailSettings,
    initial: T,
    private readonly onSave: (value: T) => void,
    /** The trip's own participants, offered as the people this line can be for. You cannot be on a leg of a trip you are not on. */
    protected readonly participants: string[] = [],
    /** The trip's departure, so a day number can show the date it resolves to. Null for a trip that has none yet, which is the case the day numbers exist for. */
    protected readonly departure: string | null = null
  ) {
    super(app);
    this.value = { ...initial };
  }

  protected abstract getTitle(): string;
  protected abstract renderFields(container: HTMLElement): void;
  /** Return an error message to block the save, or null to allow it. */
  protected validate(): string | null {
    return null;
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** Re-rendered only when a picker changes something the header displays -- field edits write straight into `value` without a redraw, unlike the old all-in-one editor. */
  protected render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-item-editor');
    contentEl.createEl('h2', { text: this.getTitle() });
    this.renderFields(contentEl);

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText(t('modals.tripEditor.cancel')).onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText(t('modals.tripEditor.save'))
          .setCta()
          .onClick(() => {
            const error = this.validate();
            if (error) {
              new Notice(error);
              return;
            }
            this.onSave(this.value);
            this.close();
          })
      );
  }
}

export class StopEditorModal extends ItemEditorModal<TripStopInput> {
  /** What the last prefill applied, so the form can say so. Cleared by nothing: it describes an edit the reader can still see in the fields above it. */
  private prefilled: StopTimeSuggestion | null = null;

  protected getTitle(): string {
    return t('modals.stopEditor.title');
  }

  protected validate(): string | null {
    // A place OR a note. A brochure line is a time and a sentence and names
    // nowhere; an entry that is only a time still says nothing, which is the
    // half of the old rule worth keeping.
    const saysSomething =
      this.value.placeTitle.trim() !== '' || (this.value.note ?? '').trim() !== '';
    return saysSomething ? null : t('modals.stopEditor.placeOrNoteRequired');
  }

  protected renderFields(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.stopEditor.placeField'))
      .setDesc(this.value.placeTitle || t('modals.tripEditor.pickPlace'))
      .addButton((btn) =>
        btn
          .setIcon('search')
          .setTooltip(t('modals.tripEditor.pickPlace'))
          .onClick(() =>
            new TravelPlacePickerModal(this.app, this.settings, (option) => {
              this.value.placeTitle = option.title;
              // A different place means a different motif list, so a motif
              // named for the old one cannot survive the change.
              this.value.motifName = null;
              this.prefilled = applyGoldenHourPrefill(
                this.app,
                this.settings,
                this.value,
                option.title
              );
              this.render();
            }).open()
          )
      )
      // Clearing is its own button rather than a blank option in the picker:
      // the picker is a search over every place in the vault, and "none of
      // them" is not something you search for. Only offered once there is
      // something to clear.
      .addExtraButton((btn) =>
        btn
          .setIcon('x')
          .setTooltip(t('modals.stopEditor.clearPlace'))
          .setDisabled(this.value.placeTitle.trim() === '')
          .onClick(() => {
            this.value.placeTitle = '';
            this.value.motifName = null;
            this.render();
          })
      );

    this.renderMotifField(containerEl);

    renderWhen(
      containerEl,
      {
        day: t('modals.tripEditor.stopDay'),
        from: t('modals.tripEditor.stopFrom'),
        to: t('modals.tripEditor.stopTo'),
      },
      this.value,
      this.departure,
      () => this.render()
    );
    new Setting(containerEl).setName(t('modals.tripEditor.stopNote')).addText((text) =>
      text.setValue(this.value.note ?? '').onChange((raw) => {
        this.value.note = raw.trim() === '' ? null : raw;
      })
    );
    renderRatingField(
      containerEl,
      t('modals.tripEditor.stopRating'),
      t('modals.common.noneOption'),
      this.value.rating,
      (value) => {
        this.value.rating = value;
      }
    );

    // The museum entry, the guide, the cable car: the third kind of
    // estimate, and the one that previously had nowhere to live but a
    // booking note of its own.
    renderCostField(
      containerEl,
      t('modals.tripEditor.stopCost'),
      this.value,
      this.settings,
      'stop'
    );
    renderTravellersField(containerEl, this.value, this.participants);
  }

  /**
   * Which motif this stop is for, offered only when the place is a photo
   * spot and only from the motifs that spot actually has.
   *
   * A dropdown rather than a text field: the name is the link, and a typed
   * one that does not match anything is a link to nothing. A name already
   * in the note that the spot no longer has is kept as an option of its
   * own rather than silently reset, which is the same courtesy an
   * unresolved place link gets.
   */
  private renderMotifField(containerEl: HTMLElement): void {
    if (!this.value.placeTitle.trim()) return;
    const place = photoSpotByTitle(this.app, this.settings, this.value.placeTitle);
    const motifs = place?.photoSpot?.motifs ?? [];
    const names = motifs
      .map((motif) => motif.name)
      .filter((name): name is string => !!name && name.trim() !== '');
    const current = this.value.motifName;
    if (current && !names.includes(current)) names.push(current);
    if (names.length === 0) return;

    new Setting(containerEl).setName(t('modals.stopEditor.motifField')).addDropdown((dropdown) => {
      dropdown.addOption('', t('modals.stopEditor.motifAny'));
      for (const name of names) dropdown.addOption(name, name);
      dropdown.setValue(current ?? '');
      dropdown.onChange((value) => {
        this.value.motifName = value === '' ? null : value;
        // The times were suggested for the motif that was selected a
        // moment ago, so choosing another one re-suggests them -- and only
        // if the reader has not typed a time of their own since.
        this.prefilled = applyGoldenHourPrefill(
          this.app,
          this.settings,
          this.value,
          this.value.placeTitle
        );
        this.render();
      });
    });

    if (this.prefilled) {
      new Setting(containerEl)
        .setName(t('modals.stopEditor.prefilledName'))
        .setDesc(
          t('modals.stopEditor.prefilled', {
            light: t(`photoSpot.light.${this.prefilled.light}`),
          })
        )
        .setClass('apt-stop-prefill-note');
    }
  }
}

/**
 * What a day of the trip is called, and the paragraph it carries.
 *
 * The one editor here that edits no item. A day is derived from the stops on
 * it, so there is nothing to open but the header itself -- which is where the
 * pencil is, and where you are already looking when you decide a day wants a
 * name.
 *
 * Clearing both fields removes the day's entry from the note rather than
 * writing an empty one: the list is sparse on purpose, and a day with a blank
 * title is a day that says nothing, which is the state every day starts in.
 */
export class DayEditorModal extends ItemEditorModal<TripDayInput> {
  protected getTitle(): string {
    return t('modals.dayEditor.title', { number: this.value.day });
  }

  protected renderFields(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.dayEditor.titleField'))
      .setDesc(t('modals.dayEditor.titleDesc'))
      .addText((text) =>
        text
          .setPlaceholder(t('modals.dayEditor.titlePlaceholder'))
          .setValue(this.value.title ?? '')
          .onChange((raw) => {
            this.value.title = raw.trim() === '' ? null : raw;
          })
      );

    new Setting(containerEl)
      .setName(t('modals.dayEditor.noteField'))
      .setDesc(t('modals.dayEditor.noteDesc'))
      .addTextArea((text) =>
        text.setValue(this.value.note ?? '').onChange((raw) => {
          this.value.note = raw.trim() === '' ? null : raw;
        })
      );
  }
}

export class NightEditorModal extends ItemEditorModal<TripNightInput> {
  protected getTitle(): string {
    return t('modals.nightEditor.title');
  }

  protected validate(): string | null {
    return this.value.accommodationTitle.trim() === ''
      ? t('modals.nightEditor.accommodationRequired')
      : null;
  }

  protected renderFields(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.tripEditor.pickAccommodation'))
      .setDesc(this.value.accommodationTitle || t('modals.tripEditor.pickAccommodation'))
      .addButton((btn) =>
        btn
          .setIcon('search')
          .setTooltip(t('modals.tripEditor.pickAccommodation'))
          .onClick(() =>
            new TravelPlacePickerModal(
              this.app,
              this.settings,
              (option) => {
                this.value.accommodationTitle = option.title;
                this.render();
              },
              ['accommodation']
            ).open()
          )
      );

    // A stay is the one item with no clock at all -- nobody records a
    // check-in time -- so it is two day numbers or two dates, and never a
    // mixture of the halves.
    const relative = this.value.checkInDay !== null || this.value.checkOutDay !== null;
    renderDayField(
      containerEl,
      t('modals.tripEditor.checkInDay'),
      arrivalHint(this.departure, this.value.checkInDay),
      this.value.checkInDay,
      (day) => {
        this.value.checkInDay = day;
        if (day !== null) this.value.checkIn = null;
        this.render();
      }
    );
    if (relative) {
      renderDayField(
        containerEl,
        t('modals.tripEditor.checkOutDay'),
        arrivalHint(this.departure, this.value.checkOutDay),
        this.value.checkOutDay,
        (day) => {
          this.value.checkOutDay = day;
          if (day !== null) this.value.checkOut = null;
          this.render();
        }
      );
    } else {
      renderDateField(containerEl, t('modals.tripEditor.checkIn'), this.value.checkIn, (value) => {
        this.value.checkIn = value;
      });
      renderDateField(
        containerEl,
        t('modals.tripEditor.checkOut'),
        this.value.checkOut,
        (value) => {
          this.value.checkOut = value;
        }
      );
    }

    renderCostField(
      containerEl,
      t('modals.tripEditor.nightCost'),
      this.value,
      this.settings,
      'night'
    );
    renderTravellersField(containerEl, this.value, this.participants);
  }
}

export class LegEditorModal extends ItemEditorModal<TripLegInput> {
  protected getTitle(): string {
    return t('modals.legEditor.title');
  }

  protected renderFields(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t('modals.legEditor.directionField')).addDropdown((dd) => {
      dd.addOption('outbound', t('modals.tripEditor.outbound'));
      dd.addOption('inbound', t('modals.tripEditor.inbound'));
      dd.setValue(this.value.direction).onChange((raw) => {
        this.value.direction = raw === 'inbound' ? 'inbound' : 'outbound';
      });
    });

    new Setting(containerEl).setName(t('modals.tripEditor.legMode')).addDropdown((dd) => {
      dd.addOption('', t('modals.common.noneOption'));
      for (const mode of TRIP_LEG_MODES) {
        dd.addOption(mode, t(`modals.tripEditor.mode.${mode}`));
      }
      // Round-trip a hand-written mode this dropdown doesn't offer, rather
      // than silently blanking it on save.
      if (this.value.mode && !(TRIP_LEG_MODES as readonly string[]).includes(this.value.mode)) {
        dd.addOption(this.value.mode, this.value.mode);
      }
      dd.setValue(this.value.mode ?? '').onChange((raw) => {
        this.value.mode = raw || null;
      });
    });

    // Where the leg starts and ends, above its times: a flight is "Zurich to
    // Pretoria" before it is "10:15 to 07:30", and the times mean little
    // without it. Free text or a wikilink, because most airports will never
    // be a note in anybody's vault.
    new Setting(containerEl)
      .setName(t('modals.tripEditor.legOrigin'))
      .setDesc(t('modals.tripEditor.legPlaceDesc'))
      .addText((text) =>
        text
          .setPlaceholder(t('modals.tripEditor.legOriginPlaceholder'))
          .setValue(this.value.origin ?? '')
          .onChange((raw) => {
            this.value.origin = raw.trim() === '' ? null : raw;
          })
      );
    new Setting(containerEl).setName(t('modals.tripEditor.legDestination')).addText((text) =>
      text
        .setPlaceholder(t('modals.tripEditor.legDestinationPlaceholder'))
        .setValue(this.value.destination ?? '')
        .onChange((raw) => {
          this.value.destination = raw.trim() === '' ? null : raw;
        })
    );

    renderWhen(
      containerEl,
      {
        day: t('modals.tripEditor.legDay'),
        from: t('modals.tripEditor.legFrom'),
        to: t('modals.tripEditor.legTo'),
      },
      this.value,
      this.departure,
      () => this.render()
    );
    // The arrival day, and only once the leg is relative at all: an overnight
    // flight leaves on day 0 and lands on day 1, and a leg that says nothing
    // about days has no second one to say anything about either.
    if (this.value.day !== null) {
      renderDayField(
        containerEl,
        t('modals.tripEditor.legToDay'),
        arrivalHint(this.departure, this.value.toDay ?? this.value.day),
        this.value.toDay,
        (day) => {
          this.value.toDay = day;
          this.render();
        }
      );
    }
    // Above the reference, because who flies it is the thing somebody knows
    // first: an airline is chosen with the leg, and a booking number arrives
    // weeks later.
    new Setting(containerEl)
      .setName(t('modals.tripEditor.legCarrier'))
      .setDesc(t('modals.tripEditor.legCarrierDesc'))
      .addText((text) =>
        text
          .setPlaceholder(t('modals.tripEditor.legCarrierPlaceholder'))
          .setValue(this.value.carrier ?? '')
          .onChange((raw) => {
            this.value.carrier = raw.trim() === '' ? null : raw;
          })
      );
    new Setting(containerEl)
      .setName(t('modals.tripEditor.legReference'))
      .setDesc(t('modals.tripEditor.legReferenceDesc'))
      .addText((text) =>
        text.setValue(this.value.reference ?? '').onChange((raw) => {
          this.value.reference = raw.trim() === '' ? null : raw;
        })
      );

    renderCostField(containerEl, t('modals.tripEditor.legCost'), this.value, this.settings, 'leg');
    renderTravellersField(containerEl, this.value, this.participants);
  }
}
