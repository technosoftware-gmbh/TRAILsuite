/**
 * Create-or-edit modal for the five place types: Accommodation, Food &
 * Beverages, Landmark, Location and Photo spot.
 *
 * One parameterized class rather than five files, mirroring
 * create-entities.ts's own createPlaceNote()-plus-wrappers shape, and one
 * class for both flows rather than two, for the reason `TripEditorModal`
 * gives: the field rendering and the validation are identical either way and
 * two classes would drift.
 *
 * **Creation still collects only what identifies a place**: a title, a
 * country, a city. The address, the coordinates, the rating and the subtype
 * fields appear when the note is edited. That is not a smaller version of the
 * form, it is the argument `createPhotoSpotNote()` already makes in its own
 * docstring: a place you just heard about is worth a note before you know
 * anything else about it, and a dialog that asks for ten fields at that
 * moment is a dialog somebody closes.
 *
 * **Edit mode never renames the file.** Retitling a place is an Obsidian
 * rename, which updates every wikilink pointing at it; a title box here would
 * either break those links or duplicate a feature the app does better. Same
 * rule the trip editor states.
 *
 * What it does not touch: `visited`/`lastVisit`, which a finished trip can
 * contribute. See places/write-place.ts.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { linkRow, textRow } from '../../ui/components/form-rows';
import { renderRatingField } from '../../ui/components/date-time-field';
import { coverFields, coverInputOf } from '../../ui/components/cover-fields';
import { loadSummaryInto, saveNoteSummary } from '../../ui/components/summary-field';
import { CoverInput } from '../../vault/write-cover';
import { formatCoordinatePair, parseCoordinatePair } from '../../ui/components/coordinate-field';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelCity, TravelCountry, TravelPlace } from '../../vault/types';
import { TravelPlaceType } from '../../vault/entity-types';
import {
  createAccommodationNote,
  createFnbNote,
  createLandmarkNote,
  createLocationNote,
  createPhotoSpotNote,
} from '../../vault/create-entities';
import { PlaceInput, placeToInput, updatePlaceNote } from '../write-place';
import { PlaceEditorField, placeEditorFields } from '../place-editor-fields';
import { RegionEditorModal } from './region-editor-modal';

const CREATE_FN: Record<TravelPlaceType, typeof createAccommodationNote> = {
  accommodation: createAccommodationNote,
  fnb: createFnbNote,
  landmark: createLandmarkNote,
  location: createLocationNote,
  photospot: createPhotoSpotNote,
};

const TITLE_KEY: Record<TravelPlaceType, string> = {
  accommodation: 'modals.newAccommodationModal.title',
  fnb: 'modals.newFnbModal.title',
  landmark: 'modals.newLandmarkModal.title',
  location: 'modals.newLocationModal.title',
  photospot: 'modals.newPhotoSpotModal.title',
};

const CREATED_KEY: Record<TravelPlaceType, string> = {
  accommodation: 'modals.newAccommodationModal.created',
  fnb: 'modals.newFnbModal.created',
  landmark: 'modals.newLandmarkModal.created',
  location: 'modals.newLocationModal.created',
  photospot: 'modals.newPhotoSpotModal.created',
};

const ICON: Record<TravelPlaceType, string> = {
  accommodation: 'bed',
  fnb: 'utensils',
  landmark: 'landmark',
  location: 'map-pin',
  photospot: 'camera',
};

/** A created note's title, which is its filename: the one place a title is derived rather than read. */
function titleOfPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function emptyInput(): PlaceInput {
  return {
    countryTitle: null,
    cityTitle: null,
    geoLocation: null,
    address: null,
    website: null,
    rating: null,
    tags: [],
    accommodationType: null,
    accommodationStatus: null,
    fnbType: null,
  };
}

export class PlaceEditorModal extends BaseModal {
  private readonly editMode: boolean;
  private readonly input: PlaceInput;
  /** The note's cover, when there is a note. Edited here now that it has nowhere else to be edited from. */
  private readonly cover: CoverInput | null;
  private bodyEl!: HTMLElement;
  /** The title being typed, in create mode. */
  private title = '';
  /** The note's summary callout, read off disk after the form has drawn. */
  private summary = '';
  /** What was typed into the coordinate box, kept as typed so a save can refuse a typo rather than silently dropping it. */
  private geoRaw: string;
  private countries: TravelCountry[];
  private cities: TravelCity[];

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly kind: TravelPlaceType,
    private readonly onSaved?: (path: string) => void,
    private readonly existingPlace?: TravelPlace
  ) {
    super(app);
    this.editMode = existingPlace !== undefined;
    this.input = existingPlace ? placeToInput(existingPlace) : emptyInput();
    this.cover = existingPlace ? coverInputOf(existingPlace) : null;
    this.geoRaw = formatCoordinatePair(this.input.geoLocation);

    const board = readTravelBoard(app, settings);
    this.countries = board.countries;
    this.cities = board.cities;
  }

  getTitle(): string {
    return this.editMode
      ? t('modals.common.editTitle', { title: this.existingPlace?.title ?? '' })
      : t(TITLE_KEY[this.kind]);
  }

  getIcon(): string {
    return ICON[this.kind];
  }

  renderBody(bodyEl: HTMLElement): void {
    this.bodyEl = bodyEl;
    this.draw();

    const file = this.existingPlace?.file;
    if (this.editMode && file) {
      loadSummaryInto(this.app, file, (summary) => {
        this.summary = summary;
        this.draw();
      });
    }
  }

  /**
   * Redrawn rather than built once, because the cover's picture and gallery
   * rows change what they show when a picker or an upload answers.
   */
  private draw(): void {
    this.bodyEl.empty();
    for (const field of placeEditorFields(this.kind, this.editMode)) {
      this.renderField(this.bodyEl, field);
    }
    // Only once the note exists: an upload has to land beside a note, and a
    // note being created has no path yet.
    if (this.editMode && this.cover) {
      coverFields(this.bodyEl, {
        app: this.app,
        value: this.cover,
        notePath: () => this.existingPlace?.file.path ?? '',
        refresh: () => this.draw(),
        summary: {
          value: this.summary,
          onChange: (value) => {
            this.summary = value;
          },
        },
      });
    }
  }

  /** One field, drawn. Which fields, and in what order, is place-editor-fields.ts's answer rather than this method's. */
  private renderField(fields: HTMLElement, field: PlaceEditorField): void {
    switch (field) {
      case 'title':
        this.renderTitleField(fields);
        return;
      case 'country':
        this.renderCountryField(fields);
        return;
      case 'city':
        this.renderCityField(fields);
        return;
      case 'geoLocation':
        this.textField(
          fields,
          t('modals.common.geoLocation'),
          this.geoRaw,
          (value) => {
            this.geoRaw = value;
          },
          '46.9895, 6.9243'
        );
        return;
      case 'address':
        this.textField(
          fields,
          t('modals.placeEditor.address'),
          this.input.address ?? '',
          (value) => {
            this.input.address = value.trim() ? value : null;
          }
        );
        return;
      case 'website':
        this.textField(
          fields,
          t('modals.placeEditor.website'),
          this.input.website ?? '',
          (value) => {
            this.input.website = value.trim() ? value : null;
          }
        );
        return;
      case 'rating':
        this.renderRatingField(fields);
        return;
      case 'tags':
        this.textField(
          fields,
          t('modals.common.tags'),
          this.input.tags.join(', '),
          (value) => {
            this.input.tags = value
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag !== '');
          },
          t('modals.common.tagsPlaceholder')
        );
        return;
      case 'accommodationType':
        this.textField(
          fields,
          t('modals.placeEditor.accommodationType'),
          this.input.accommodationType ?? '',
          (value) => {
            this.input.accommodationType = value.trim() ? value : null;
          }
        );
        return;
      case 'accommodationStatus':
        this.textField(
          fields,
          t('modals.placeEditor.accommodationStatus'),
          this.input.accommodationStatus ?? '',
          (value) => {
            this.input.accommodationStatus = value.trim() ? value : null;
          }
        );
        return;
      case 'fnbType':
        this.textField(
          fields,
          t('modals.placeEditor.fnbType'),
          this.input.fnbType ?? '',
          (value) => {
            this.input.fnbType = value.trim() ? value : null;
          }
        );
        return;
    }
  }

  private renderTitleField(fields: HTMLElement): void {
    textRow(fields, {
      label: t('modals.common.titleField'),
      value: this.title,
      onChange: (value) => {
        this.title = value;
      },
    });
  }

  private renderCountryField(fields: HTMLElement): void {
    linkRow(fields, {
      label: t('modals.common.countryField'),
      titles: this.countries.map((country) => country.title),
      value: this.input.countryTitle ?? '',
      noneLabel: t('modals.common.noneOption'),
      onChange: (title) => {
        this.input.countryTitle = title || null;
      },
      createLabel: t('modals.common.createNewOption'),
      onCreateNew: (adopt) => {
        new RegionEditorModal(
          this.app,
          this.settings,
          'country',
          (path) => {
            this.countries = readTravelBoard(this.app, this.settings).countries;
            adopt(titleOfPath(path));
          },
          undefined,
          { openAfterCreate: false }
        ).open();
      },
    });
  }

  private renderCityField(fields: HTMLElement): void {
    linkRow(fields, {
      label: t('modals.common.cityField'),
      titles: this.cities.map((city) => city.title),
      value: this.input.cityTitle ?? '',
      noneLabel: t('modals.common.noneOption'),
      onChange: (title) => {
        this.input.cityTitle = title || null;
      },
      createLabel: t('modals.common.createNewOption'),
      onCreateNew: (adopt) => {
        new RegionEditorModal(
          this.app,
          this.settings,
          'city',
          (path) => {
            this.cities = readTravelBoard(this.app, this.settings).cities;
            adopt(titleOfPath(path));
          },
          undefined,
          { openAfterCreate: false }
        ).open();
      },
    });
  }

  private renderRatingField(fields: HTMLElement): void {
    renderRatingField(
      fields,
      t('modals.placeEditor.rating'),
      t('modals.common.noneOption'),
      this.input.rating,
      (value) => {
        this.input.rating = value;
      }
    );
  }

  private textField(
    fields: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string
  ): void {
    textRow(fields, { label, value, placeholder, onChange });
  }

  renderFooter(footerEl: HTMLElement): void {
    addFooterButtons(footerEl, {
      confirmLabel: this.editMode ? t('modals.common.save') : t('modals.common.create'),
      onCancel: () => this.close(),
      onConfirm: () => void this.submit(),
    });
  }

  private async submit(): Promise<void> {
    if (this.editMode) {
      await this.save();
      return;
    }
    await this.create();
  }

  private async create(): Promise<void> {
    const title = this.title.trim();
    if (!title) {
      new Notice(t('modals.common.titleRequired'));
      return;
    }
    const country = this.countries.find((c) => c.title === this.input.countryTitle) ?? null;
    const city = this.cities.find((c) => c.title === this.input.cityTitle) ?? null;
    try {
      const file = await CREATE_FN[this.kind](this.app, this.settings, title, country, city);
      new Notice(t(CREATED_KEY[this.kind], { title }));
      this.onSaved?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }

  private async save(): Promise<void> {
    const file = this.existingPlace?.file;
    if (!file) return;

    // A typo is refused rather than dropped. The motif editor clears an
    // unparseable pair on purpose, because a motif with no coordinates falls
    // back to the note's own; a place has nothing to fall back to, so
    // silently discarding what somebody typed would lose the intent as well
    // as the value.
    const geoRaw = this.geoRaw.trim();
    const geoLocation = geoRaw === '' ? null : parseCoordinatePair(geoRaw);
    if (geoRaw !== '' && geoLocation === null) {
      new Notice(t('modals.common.geoLocationInvalid'));
      return;
    }
    this.input.geoLocation = geoLocation;

    try {
      await updatePlaceNote(
        this.app,
        this.settings,
        file,
        this.kind,
        this.input,
        this.cover ?? undefined
      );
      // Inside the same try: the summary is a second write to the same note,
      // and a note whose properties were saved and whose text was not is a
      // half-saved note. Reported as a failed save rather than silently.
      await saveNoteSummary(this.app, file, this.summary);
      new Notice(t('modals.common.saved', { title: this.existingPlace?.title ?? '' }));
      this.onSaved?.(file.path);
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.saveFailed'));
    }
  }
}
