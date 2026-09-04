/**
 * Shared creation modal for Accommodation/FnB/Landmark/Location -- the four
 * place types share an identical creation shape (title + optional Country +
 * optional City), differing only in which create-entities.ts function they
 * call and what title/icon/copy to show. One parameterized modal class
 * rather than four near-identical files, mirroring create-entities.ts's own
 * createPlaceNote() internal-plus-four-wrappers shape for these same four
 * types.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelCity, TravelCountry } from '../../vault/types';
import { TravelPlaceType } from '../../vault/entity-types';
import {
  createAccommodationNote,
  createFnbNote,
  createLandmarkNote,
  createLocationNote,
  createPhotoSpotNote,
} from '../../vault/create-entities';

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

export class NewPlaceModal extends BaseModal {
  private countryTitle = '';
  private cityTitle = '';
  private readonly countries: TravelCountry[];
  private readonly cities: TravelCity[];
  private titleInput!: HTMLInputElement;

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly kind: TravelPlaceType,
    private readonly onCreated?: (path: string) => void
  ) {
    super(app);
    const board = readTravelBoard(app, settings);
    this.countries = board.countries;
    this.cities = board.cities;
  }

  getTitle(): string {
    return t(TITLE_KEY[this.kind]);
  }
  getIcon(): string {
    return ICON[this.kind];
  }
  renderBody(bodyEl: HTMLElement): void {
    const fields = bodyEl.createDiv({ cls: 'apt-modal-fields' });

    const titleField = fields.createDiv({ cls: 'apt-modal-field' });
    titleField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.titleField'),
    });
    this.titleInput = titleField.createEl('input', {
      cls: 'apt-modal-input',
      attr: { type: 'text' },
    });
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });
    window.setTimeout(() => this.titleInput.focus(), 0);

    const countryField = fields.createDiv({ cls: 'apt-modal-field' });
    countryField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.countryField'),
    });
    const countrySelect = countryField.createEl('select', { cls: 'apt-modal-select' });
    countrySelect.createEl('option', {
      attr: { value: '' },
      text: t('modals.common.noneOption'),
    });
    for (const country of this.countries) {
      countrySelect.createEl('option', { attr: { value: country.title }, text: country.title });
    }
    countrySelect.addEventListener('change', () => {
      this.countryTitle = countrySelect.value;
    });

    const cityField = fields.createDiv({ cls: 'apt-modal-field' });
    cityField.createEl('label', {
      cls: 'apt-modal-field-label',
      text: t('modals.common.cityField'),
    });
    const citySelect = cityField.createEl('select', { cls: 'apt-modal-select' });
    citySelect.createEl('option', {
      attr: { value: '' },
      text: t('modals.common.noneOption'),
    });
    for (const city of this.cities) {
      citySelect.createEl('option', { attr: { value: city.title }, text: city.title });
    }
    citySelect.addEventListener('change', () => {
      this.cityTitle = citySelect.value;
    });
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
    const country = this.countries.find((c) => c.title === this.countryTitle) ?? null;
    const city = this.cities.find((c) => c.title === this.cityTitle) ?? null;
    try {
      const file = await CREATE_FN[this.kind](this.app, this.settings, title, country, city);
      new Notice(t(CREATED_KEY[this.kind], { title }));
      this.onCreated?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }
}
