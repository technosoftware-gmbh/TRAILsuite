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
import { App, Modal, Notice, Setting, TFile, normalizePath, setIcon } from 'obsidian';
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
import { imageField, VaultImageSuggest } from '../../ui/components/image-field';
import { chooseImageFiles, uploadPictures } from '../../ui/components/image-upload';
import { renderImageCard } from '../../ui/components/image-resolve';
import { moveInList } from '../../shared/reorder';
import { newTripFolder } from '../trip-folder';
import { loadTripSummary, writeTripSummary } from '../write-trip-summary';
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
    this.allCityTitles = board.cities.map((c) => c.title);
    this.personTitles = getEligiblePersonTitles(app, settings);

    this.title = existingTrip?.title ?? '';
    this.countryTitle = existingTrip?.countryTitle ?? '';
    this.cityTitles = [...(existingTrip?.cityTitles ?? [])];
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
      void loadTripSummary(this.app, file).then((summary) => {
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
      .setName(t('modals.tripEditor.subtitleField'))
      .setDesc(t('modals.tripEditor.subtitleHint'))
      .addText((text) =>
        text.setValue(this.subtitle).onChange((value) => {
          this.subtitle = value;
        })
      );

    imageField(containerEl, {
      app: this.app,
      label: t('modals.tripEditor.imageField'),
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
      .setName(t('modals.tripEditor.highlightsField'))
      .setDesc(t('modals.tripEditor.highlightsHint'))
      .addTextArea((area) => {
        area.inputEl.rows = 8;
        area.inputEl.addClass('apt-trip-highlights');
        area.setValue(this.highlightLines).onChange((value) => {
          this.highlightLines = value;
        });
      });

    // Last of the four, because it is the longest to write and the one
    // somebody comes back to.
    new Setting(containerEl)
      .setName(t('modals.tripEditor.summaryField'))
      .setDesc(t('modals.tripEditor.summaryHint'))
      .addTextArea((area) => {
        area.inputEl.rows = 6;
        area.inputEl.addClass('apt-trip-summary');
        area.setValue(this.summary).onChange((value) => {
          this.summary = value;
        });
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

  /**
   * The gallery: one row per picture, showing the picture.
   *
   * **It used to be two text boxes a row**, a path and a caption, which made
   * every question somebody actually has about a gallery unanswerable. Which of
   * these is the dining car? Is this the one I meant? And above all: reordering
   * a list of filenames you cannot see is barely better than editing the YAML,
   * which is what the reorder buttons would otherwise have been.
   *
   * So the path is a thumbnail. The box holding it is gone rather than hidden:
   * a value that is not a picture shows as an empty frame, which is what a
   * broken path looks like everywhere else in this plugin, and the picker and
   * the upload button both replace it. The one thing lost is typing a path by
   * hand, and that is what the note's own frontmatter is for.
   *
   * Up and down rather than dragging. It matches the itinerary's rows, and
   * dragging is worse with a finger -- this plugin has already shipped one
   * input that did not work on the iPad.
   */
  private renderGallery(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(t('modals.tripEditor.galleryField'))
      .setDesc(t('modals.tripEditor.galleryHint'))
      .addExtraButton((button) =>
        button
          .setIcon('upload')
          .setTooltip(t('modals.common.imageUploadButton'))
          .onClick(() => void this.uploadIntoGallery())
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

    if (this.gallery.length === 0) {
      containerEl.createEl('p', {
        text: t('modals.tripEditor.galleryEmpty'),
        cls: 'setting-item-description',
      });
      return;
    }

    const list = containerEl.createDiv({ cls: 'apt-gallery' });

    this.gallery.forEach((picture, index) => {
      const row = list.createDiv({ cls: 'apt-gallery-row' });

      const thumb = row.createDiv({ cls: 'apt-gallery-thumb' });
      renderImageCard(thumb, this.app, picture.image);

      const caption = row.createDiv({ cls: 'apt-gallery-caption' });
      const input = caption.createEl('input', {
        cls: 'apt-modal-input',
        attr: { type: 'text', placeholder: t('modals.tripEditor.galleryCaption') },
      });
      input.value = picture.caption ?? '';
      input.addEventListener('input', () => {
        picture.caption = input.value.trim() || null;
      });

      const actions = row.createDiv({ cls: 'apt-gallery-actions' });
      this.galleryAction(actions, 'image', t('modals.common.imagePickerButton'), () => {
        new VaultImageSuggest(this.app, (path) => {
          picture.image = path;
          this.render();
        }).open();
      });
      this.galleryAction(
        actions,
        'arrow-up',
        t('modals.tripEditor.moveUp'),
        () => this.moveGalleryRow(index, -1),
        index === 0
      );
      this.galleryAction(
        actions,
        'arrow-down',
        t('modals.tripEditor.moveDown'),
        () => this.moveGalleryRow(index, 1),
        index === this.gallery.length - 1
      );
      this.galleryAction(actions, 'trash-2', t('modals.tripEditor.galleryRemove'), () => {
        this.gallery.splice(index, 1);
        this.render();
      });
    });
  }

  /**
   * One icon action on a gallery row.
   *
   * A div with `role="button"` rather than a `<button>`, because `setIcon()`
   * aimed at a button element is the iPad defect `tests/icon-slot.test.ts`
   * exists to refuse. Same shape as the itinerary's own row actions.
   */
  private galleryAction(
    container: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
    disabled = false
  ): void {
    const btn = container.createDiv({
      cls: 'apt-gallery-action',
      attr: { role: 'button', tabindex: '0', 'aria-label': label, title: label },
    });
    setIcon(btn, icon);
    btn.toggleClass('is-disabled', disabled);
    if (disabled) return;
    btn.addEventListener('click', onClick);
  }

  /** A swap, and only a redraw when something actually moved. */
  private moveGalleryRow(index: number, delta: number): void {
    if (moveInList(this.gallery, index, delta)) this.render();
  }

  /**
   * Adds every picture the file dialog returned, in the order they were chosen.
   *
   * **Appended rather than replacing anything**, because a gallery is built up
   * over several sittings and an upload is somebody adding to it. The new rows
   * carry no caption: a filename is not a caption, and prefilling one would
   * mean somebody has to delete `IMG_4821` from fourteen boxes.
   *
   * The note's own path is what decides where they land, which is how a vault
   * set to `./_resources` files them inside this trip's folder without this
   * modal knowing anything about folders.
   */
  private async uploadIntoGallery(): Promise<void> {
    const files = await chooseImageFiles();
    if (files.length === 0) return;

    const { written, failed } = await uploadPictures(this.app, files, this.notePath());
    for (const picture of written) this.gallery.push({ image: picture.path, caption: null });

    if (failed.length > 0)
      new Notice(t('modals.common.imageUploadFailed', { names: failed.join(', ') }));
    this.render();
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
      // `writeTripSummary`'s own rule.
      await writeTripSummary(this.app, file, this.summary);
      this.onSaved?.(file.path);
      this.close();
      if (!this.editMode) await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
