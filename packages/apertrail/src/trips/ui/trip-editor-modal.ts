/**
 * Create-or-edit modal for a Trip's own fields: title, country, cities,
 * dates, type/status/review/rating, and who came along. See
 * docs/design/trip-model-redesign.md §4.
 *
 * It deliberately does NOT edit stops, nights or transport legs. It used
 * to, and that made it unusable: every item rendered as a run of Setting
 * rows in one dialog that re-rendered wholesale on each change, so a
 * ten-stop trip meant roughly fifty rows and a modal taller than the
 * screen. Those are now edited one at a time from the itinerary block in
 * the note itself (ui/itinerary-block.ts), which keeps every dialog to a
 * fixed size no matter how long the trip is. What stays here is what
 * belongs to the trip as a whole rather than to one moment in it.
 *
 * One class serves both flows (pass an `existingTrip` for edit mode),
 * because the field rendering and validation are identical either way and
 * two classes would drift. Edit mode pre-fills from the parsed record,
 * saves through updateTripNote() (which preserves the note body), and never
 * renames the file -- retitling a trip is a file rename, deliberately not
 * part of this surface.
 *
 * Uses a plain Modal rather than the BaseModal shell
 * (ui/components/modal-shell.ts): this is a long, section-heavy form, not
 * the short header/body/footer shape that shell is built for.
 *
 * A trip's existing stops, nights and transport legs are carried through a
 * save untouched (see currentInput() below) rather than dropped, because
 * the writer replaces the note's whole managed frontmatter -- otherwise
 * editing a title here would quietly wipe the itinerary.
 */
import { App, Modal, Notice, Setting, TFile, normalizePath } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { getEligiblePersonTitles } from '../../crm/persons';
import { renderDateTimeField, renderRatingField } from '../../ui/components/date-time-field';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelTrip } from '../../vault/types';
import {
  isTravelStatusValue,
  TRAVEL_STATUS_VALUES,
  TravelStatusValue,
  type TripGalleryInput,
} from '../trip-note';
import { imageField } from '../../ui/components/image-field';
import {
  galleryRows,
  GalleryFieldOptions,
  uploadIntoGallery,
} from '../../ui/components/gallery-field';
import { newTripFolder } from '../trip-folder';
import { loadNoteSummary } from '../../shared/note-summary';
import { saveNoteSummary, summaryField } from '../../ui/components/summary-field';
import { createTripNote, TripInput, tripToInput, updateTripNote } from '../write-trip';
import { TravelPlacePickerModal } from '../../places/ui/place-picker-modal';

/** The Travel Type values the editor offers. Free text on the note, so a vault can write its own; these are just the suggestions. */
const TRAVEL_TYPE_SUGGESTIONS = [
  'Business',
  'Private - Alone',
  'Private - Couple',
  'Private - Family',
  'Private - Friends',
];

const REVIEW_STATUS_SUGGESTIONS = ['Missing', 'In Progress', 'Done', 'Not needed'];

export class TripEditorModal extends Modal {
  private title: string;
  private countryTitle: string;
  private cityTitles: string[];
  /** The trip this one follows on from, as a title. Empty for a trip that stands alone. */
  private extendsTitle: string;
  private departure: string | null;
  private returnDate: string | null;
  private travelType: string;
  private travelStatus: TravelStatusValue | '';
  private reviewStatus: string;
  private rating: number | null;
  private subtitle: string;
  private image: string;
  /** One highlight per line, which is how ten of them are actually typed. */
  private highlightLines: string;
  private gallery: TripGalleryInput[];
  /** The overview, read out of the note's body when the form opens. */
  private summary = '';
  private readonly includedPersons: Set<string>;

  private readonly countryTitles: string[];
  /** Every other trip in the vault. Every OTHER: a trip cannot follow on from itself. */
  private readonly otherTripTitles: string[];
  private readonly allCityTitles: string[];
  private readonly personTitles: string[];
  private readonly editMode: boolean;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onSaved?: (path: string) => void,
    private readonly existingTrip?: TravelTrip
  ) {
    super(app);
    this.editMode = existingTrip !== undefined;

    const board = readTravelBoard(app, settings);
    this.countryTitles = board.countries.map((c) => c.title);
    // The trip being edited is left out of its own list rather than filtered
    // at save time: a control that offers an answer the reader then refuses
    // is a control that lies. The reader refuses it too, for the note
    // somebody hand-edits.
    this.otherTripTitles = board.trips
      .filter((trip) => trip.title !== (existingTrip?.title ?? ''))
      .map((trip) => trip.title);
    this.allCityTitles = board.cities.map((c) => c.title);
    this.personTitles = getEligiblePersonTitles(app, settings);

    this.title = existingTrip?.title ?? '';
    this.countryTitle = existingTrip?.countryTitle ?? '';
    this.cityTitles = [...(existingTrip?.cityTitles ?? [])];
    this.extendsTitle = existingTrip?.extendsTitle ?? '';
    this.departure = existingTrip?.departure ?? null;
    this.returnDate = existingTrip?.return ?? null;
    this.travelType = existingTrip?.travelType ?? '';
    // The raw status, not effectiveStatus -- a derived status must not get
    // written into the note just because someone opened and saved it. If
    // the field was empty it stays empty, and the reader keeps deriving.
    this.travelStatus = existingTrip?.travelStatus ?? '';
    this.reviewStatus = existingTrip?.reviewStatus ?? '';
    this.rating = existingTrip?.rating ?? null;
    this.subtitle = existingTrip?.subtitle ?? '';
    this.image = existingTrip?.image ?? '';
    this.highlightLines = (existingTrip?.highlights ?? []).join('\n');
    this.gallery = (existingTrip?.gallery ?? []).map((picture) => ({ ...picture }));
    this.includedPersons = new Set(existingTrip?.personTitles ?? []);
  }

  onOpen(): void {
    this.render();

    // The summary lives in the note's body, so reading it means going to disk
    // and a constructor cannot await. The form draws without it and redraws
    // once it arrives, rather than making somebody wait for a file read before
    // they can type a title. A trip being created has no body to read.
    if (this.editMode && this.existingTrip) {
      const file = this.existingTrip.file;
      void loadNoteSummary(this.app, file).then((summary) => {
        this.summary = summary;
        this.render();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', {
      text: this.editMode
        ? t('modals.tripEditor.editTitle', { title: this.title })
        : t('modals.tripEditor.createTitle'),
    });

    this.renderBasics(contentEl);
    this.renderPresentation(contentEl);
    this.renderPersons(contentEl);
    this.renderItineraryHint(contentEl);
    this.renderFooter(contentEl);
  }

  private renderBasics(containerEl: HTMLElement): void {
    if (!this.editMode) {
      new Setting(containerEl).setName(t('modals.common.titleField')).addText((text) =>
        text.setValue(this.title).onChange((value) => {
          this.title = value;
        })
      );
    }

    new Setting(containerEl).setName(t('modals.common.countryField')).addDropdown((dd) => {
      dd.addOption('', t('modals.common.noneOption'));
      for (const title of this.countryTitles) dd.addOption(title, title);
      dd.setValue(this.countryTitle).onChange((value) => {
        this.countryTitle = value;
      });
    });

    this.renderChipList(
      containerEl,
      t('modals.tripEditor.citiesField'),
      this.cityTitles,
      // Only Cities here, unlike the itinerary picker -- this field is the
      // trip's geographic scope, and a restaurant is not a scope.
      () =>
        new TravelPlacePickerModal(
          this.app,
          this.settings,
          (option) => {
            if (!this.cityTitles.includes(option.title)) {
              this.cityTitles.push(option.title);
              this.render();
            }
          },
          ['city']
        ).open(),
      (title) => {
        this.cityTitles = this.cityTitles.filter((c) => c !== title);
        this.render();
      },
      this.allCityTitles.length === 0 ? t('modals.tripEditor.noCitiesYet') : null
    );

    // What this trip follows on from -- the three days in Kopenhagen after
    // the ship docks. On this note and not on the one it names, so adding an
    // extension never reopens the trip it extends.
    new Setting(containerEl)
      .setName(t('modals.tripEditor.extendsField'))
      .setDesc(t('modals.tripEditor.extendsHint'))
      .addDropdown((dd) => {
        dd.addOption('', t('modals.common.noneOption'));
        for (const title of this.otherTripTitles) dd.addOption(title, title);
        dd.setValue(this.extendsTitle).onChange((value) => {
          this.extendsTitle = value;
        });
      });

    renderDateTimeField(
      containerEl,
      t('modals.newTripModal.departureField'),
      this.departure,
      (value) => {
        this.departure = value;
      }
    );
    renderDateTimeField(
      containerEl,
      t('modals.newTripModal.returnField'),
      this.returnDate,
      (value) => {
        this.returnDate = value;
      }
    );

    new Setting(containerEl).setName(t('modals.tripEditor.travelTypeField')).addText((text) => {
      text.setValue(this.travelType).onChange((value) => {
        this.travelType = value;
      });
      // A datalist keeps the drafted vocabulary discoverable without
      // making it enforced -- travelType is free text on the note.
      const listId = 'apt-travel-type-suggestions';
      const datalist = text.inputEl.parentElement?.createEl('datalist', {
        attr: { id: listId },
      });
      for (const suggestion of TRAVEL_TYPE_SUGGESTIONS) {
        datalist?.createEl('option', { attr: { value: suggestion } });
      }
      text.inputEl.setAttr('list', listId);
    });

    new Setting(containerEl)
      .setName(t('modals.tripEditor.travelStatusField'))
      .setDesc(t('modals.tripEditor.travelStatusDesc'))
      .addDropdown((dd) => {
        dd.addOption('', t('modals.tripEditor.statusAutoOption'));
        for (const status of TRAVEL_STATUS_VALUES) {
          dd.addOption(status, t(`dashboard.stats.status${status}`));
        }
        dd.setValue(this.travelStatus).onChange((value) => {
          this.travelStatus = isTravelStatusValue(value) ? value : '';
        });
      });

    new Setting(containerEl).setName(t('modals.tripEditor.reviewStatusField')).addDropdown((dd) => {
      dd.addOption('', t('modals.common.noneOption'));
      for (const status of REVIEW_STATUS_SUGGESTIONS) dd.addOption(status, status);
      if (this.reviewStatus && !REVIEW_STATUS_SUGGESTIONS.includes(this.reviewStatus)) {
        // Round-trip a value the vault already uses rather than blanking
        // it on save -- same posture as NewOrderModal's company dropdown.
        dd.addOption(this.reviewStatus, this.reviewStatus);
      }
      dd.setValue(this.reviewStatus).onChange((value) => {
        this.reviewStatus = value;
      });
    });

    renderRatingField(
      containerEl,
      t('modals.tripEditor.ratingField'),
      t('modals.common.noneOption'),
      this.rating,
      (value) => {
        this.rating = value;
      }
    );
  }

  /**
   * What the trip says about itself: the line under its name, its picture, its
   * highlights and its gallery.
   *
   * Grouped away from the facts above rather than mixed into them. Everything
   * in `renderBasics` is something that happened -- where, when, with whom.
   * Everything here is something somebody chose to say, and it is what a
   * printed sheet is made of.
   */
  private renderPresentation(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t('modals.tripEditor.presentationHeading')).setHeading();

    new Setting(containerEl)
      .setName(t('modals.noteCover.description'))
      .setDesc(t('modals.noteCover.descriptionHint'))
      .addText((text) =>
        text.setValue(this.subtitle).onChange((value) => {
          this.subtitle = value;
        })
      );

    imageField(containerEl, {
      app: this.app,
      label: t('modals.noteCover.image'),
      get: () => this.image,
      set: (value) => {
        this.image = value;
      },
      refresh: () => this.render(),
      notePath: () => this.notePath(),
    });

    // A box of lines rather than a row editor. Ten highlights typed as ten
    // rows is ten clicks nobody wants, and the property is a list of plain
    // strings, so a line and an entry are the same thing.
    new Setting(containerEl)
      .setName(t('modals.noteCover.highlights'))
      .setClass('apt-form-multiline')
      .setDesc(t('modals.noteCover.highlightsHint'))
      .addTextArea((area) => {
        area.inputEl.rows = 8;
        area.inputEl.addClass('apt-trip-highlights');
        area.setValue(this.highlightLines).onChange((value) => {
          this.highlightLines = value;
        });
      });

    // Last of the four, because it is the longest to write and the one
    // somebody comes back to. The row itself is shared now: this editor had
    // it first, and it turned out to be every note's rather than a trip's.
    summaryField(containerEl, {
      value: this.summary,
      onChange: (value) => {
        this.summary = value;
      },
    });

    this.renderGallery(containerEl);
  }

  /**
   * The note an uploaded picture belongs to, which is what decides where it
   * lands: `getAvailablePathForAttachment` resolves a setting like
   * `./_resources` against it.
   *
   * A trip being created has no note yet, so the path it is *about* to have is
   * used. That is the same folder `createTripNote()` will write into moments
   * later, so a picture uploaded before the first save is not orphaned in the
   * vault root -- which is the failure a caller passing `''` would produce, and
   * would only notice on a trip whose first picture went in before its name.
   */
  private notePath(): string {
    if (this.existingTrip) return this.existingTrip.file.path;

    const title = this.title.trim();
    if (!title) return '';

    const folder = newTripFolder(this.settings, title);
    return normalizePath(folder ? `${folder}/${title}.md` : `${title}.md`);
  }

  /** The header row and the picture rows, both from the shared field this and the cover dialog share. */
  private renderGallery(containerEl: HTMLElement): void {
    const options = this.galleryOptions();

    new Setting(containerEl)
      .setName(t('modals.noteCover.gallery'))
      .setDesc(t('modals.noteCover.galleryHint'))
      .addExtraButton((button) =>
        button
          .setIcon('upload')
          .setTooltip(t('modals.common.imageUploadButton'))
          .onClick(() => void uploadIntoGallery(options))
      )
      .addButton((button) =>
        button
          .setIcon('plus')
          .setTooltip(t('modals.tripEditor.galleryAdd'))
          .onClick(() => {
            this.gallery.push({ image: '', caption: null });
            this.render();
          })
      );

    galleryRows(containerEl, options);
  }

  private galleryOptions(): GalleryFieldOptions {
    return {
      app: this.app,
      gallery: this.gallery,
      notePath: () => this.notePath(),
      refresh: () => this.render(),
      labels: {
        field: t('modals.noteCover.gallery'),
        hint: t('modals.noteCover.galleryHint'),
        add: t('modals.tripEditor.galleryAdd'),
        empty: t('modals.tripEditor.galleryEmpty'),
        caption: t('modals.tripEditor.galleryCaption'),
        remove: t('modals.tripEditor.galleryRemove'),
        moveUp: t('modals.tripEditor.moveUp'),
        moveDown: t('modals.tripEditor.moveDown'),
      },
    };
  }

  private renderPersons(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t('modals.tripEditor.personsHeading')).setHeading();
    if (this.personTitles.length === 0) {
      containerEl.createEl('p', {
        text: t('modals.tripEditor.noPersonsYet'),
        cls: 'setting-item-description',
      });
      return;
    }
    for (const personTitle of this.personTitles) {
      new Setting(containerEl).setName(personTitle).addToggle((toggle) =>
        toggle.setValue(this.includedPersons.has(personTitle)).onChange((value) => {
          if (value) this.includedPersons.add(personTitle);
          else this.includedPersons.delete(personTitle);
        })
      );
    }
  }

  /** A removable-chip row plus a "+" that opens a picker -- how this form edits a list-valued field. */
  private renderChipList(
    containerEl: HTMLElement,
    label: string,
    titles: string[],
    openPicker: () => void,
    onRemove: (title: string) => void,
    emptyHint: string | null
  ): void {
    const setting = new Setting(containerEl).setName(label);
    if (emptyHint) setting.setDesc(emptyHint);
    const chips = setting.controlEl.createDiv({ cls: 'apt-chips' });
    for (const title of titles) {
      const chip = chips.createDiv({ cls: 'apt-chip' });
      chip.createSpan({ text: title });
      const remove = chip.createSpan({
        cls: 'apt-chip-remove',
        text: '×',
        attr: { 'aria-label': t('modals.tripEditor.remove', { item: title }) },
      });
      remove.addEventListener('click', () => onRemove(title));
    }
    const add = chips.createEl('button', {
      cls: 'apt-chip-add',
      text: '+',
      attr: { 'aria-label': label },
    });
    add.addEventListener('click', openPicker);
  }

  /** Points at where the itinerary is actually edited, so its absence here reads as a deliberate split rather than a missing feature. */
  private renderItineraryHint(containerEl: HTMLElement): void {
    new Setting(containerEl).setName(t('modals.tripEditor.itineraryHeading')).setHeading();
    containerEl.createEl('p', {
      text: t('modals.tripEditor.itineraryMovedHint'),
      cls: 'setting-item-description',
    });
  }

  private renderFooter(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .addButton((btn) =>
        btn.setButtonText(t('modals.tripEditor.cancel')).onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText(this.editMode ? t('modals.tripEditor.save') : t('modals.common.create'))
          .setCta()
          .onClick(() => void this.submit())
      );
  }

  private currentInput(): TripInput {
    const existing = this.existingTrip ? tripToInput(this.existingTrip) : null;
    return {
      // Day titles are edited from the day's own header in the itinerary
      // block, like every other item on it, so this dialog carries them
      // through untouched rather than offering them.
      days: existing?.days ?? [],
      subtitle: this.subtitle.trim() || null,
      image: this.image.trim() || null,
      // Split on newlines and drop the blanks: a trailing return in the box is
      // not an eleventh highlight.
      highlights: this.highlightLines
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
      gallery: this.gallery.filter((picture) => picture.image.trim() !== ''),
      countryTitle: this.countryTitle || null,
      cityTitles: this.cityTitles,
      extendsTitle: this.extendsTitle || null,
      // The trip's money is edited from the costs block, not here. Carried
      // through untouched so saving the trip's own fields never drops a
      // budget line somebody entered somewhere else.
      currency: existing?.currency ?? null,
      budget: existing?.budget ?? [],
      rates: existing?.rates ?? [],
      departure: this.departure,
      return: this.returnDate,
      travelType: this.travelType || null,
      travelStatus: this.travelStatus === '' ? null : this.travelStatus,
      reviewStatus: this.reviewStatus || null,
      rating: this.rating,
      personTitles: [...this.includedPersons],
      // Round-tripped untouched: this modal doesn't edit them, but the
      // writer replaces the note's whole managed frontmatter, so they
      // have to be carried through or saving the basics would wipe the
      // itinerary. A brand-new trip starts with all three empty.
      stops: existing?.stops ?? [],
      nights: existing?.nights ?? [],
      transport: existing?.transport ?? [],
    };
  }

  private async submit(): Promise<void> {
    const input = this.currentInput();
    try {
      let file: TFile;
      if (this.editMode && this.existingTrip) {
        file = await updateTripNote(this.app, this.settings, this.existingTrip.file, input);
      } else {
        const title = this.title.trim();
        if (!title) {
          new Notice(t('modals.common.titleRequired'));
          return;
        }
        file = await createTripNote(this.app, this.settings, title, input);
      }
      new Notice(
        this.editMode
          ? t('modals.tripEditor.saved', { title: file.basename })
          : t('modals.newTripModal.created', { title: file.basename })
      );
      // After the frontmatter write, and only for a note that exists: the
      // summary is body text and `createTripNote` has just written the body it
      // wants. Writing nothing when the text has not changed is
      // `writeNoteSummary`'s own rule.
      await saveNoteSummary(this.app, file, this.summary);
      this.onSaved?.(file.path);
      this.close();
      if (!this.editMode) await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
