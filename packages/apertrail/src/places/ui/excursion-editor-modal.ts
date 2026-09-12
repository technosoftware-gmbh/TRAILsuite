/**
 * Create-or-edit modal for an excursion: a guided tour, a safari, a bus to
 * the Nordkap.
 *
 * One class for both flows, the shape every editor in this package now has.
 * Creation asks for the three things it always asked for -- who runs it, how
 * long it takes, where it is offered -- and editing adds the website; see
 * `excursion-editor-fields.ts` for why the description and the country are on
 * neither form.
 *
 * **There is no price field here, and there is not one on the note either.**
 * The same tour costs one thing on a Christmas sailing and another in May, so
 * the figure belongs to the stop that books it. A box for it here would
 * invite somebody to type the first price they saw and then wonder, a year
 * later, which sailing it was for.
 *
 * The writer this saves through was written with the excursion itself and had
 * no caller until now: `updateExcursionNote()` has been sitting in
 * `write-excursion.ts`, exercised only by its tests, since the day the entity
 * type arrived.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { linkRow, textRow } from '../../ui/components/form-rows';
import { coverFields } from '../../ui/components/cover-fields';
import { loadSummaryInto, saveNoteSummary } from '../../ui/components/summary-field';
import { CoverInput } from '../../vault/write-cover';
import { createExcursionNote } from '../../vault/create-entities';
import { readCrmBoard } from '../../crm/read-crm';
import { readTravelBoard } from '../../vault/read-entities';
import { ExcursionInput } from '../excursion-note';
import { updateExcursionNote } from '../write-excursion';
import { ExcursionEditorField, excursionEditorFields } from '../excursion-editor-fields';
import { RegionEditorModal } from './region-editor-modal';

/** The note being edited: the file to write, the title to show, the values to prefill. */
export interface ExcursionEdit {
  file: TFile;
  title: string;
  input: ExcursionInput;
  /** What the note looks like: the line under its title, its picture, its gallery. */
  cover: CoverInput;
}

/** A created note's title, which is its filename. */
function titleOfPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function emptyInput(): ExcursionInput {
  return {
    description: null,
    operatorTitle: null,
    duration: null,
    countryTitle: null,
    cityTitle: null,
    website: null,
  };
}

export class ExcursionEditorModal extends BaseModal {
  private readonly editMode: boolean;
  private readonly input: ExcursionInput;
  private operators: string[];
  /** City title to the country it sits in, so choosing the town fills the country in too. */
  private countryOfCity: Map<string, string>;
  /** The note's cover, when there is a note. */
  private readonly cover: CoverInput | null;
  private bodyEl!: HTMLElement;
  /** The title being typed, in create mode. */
  private title = '';
  /** The note's summary callout, read off disk after the form has drawn. */
  private summary = '';

  constructor(
    app: App,
    private readonly settings: APERtrailSettings,
    private readonly onSaved?: (path: string) => void,
    private readonly existing?: ExcursionEdit
  ) {
    super(app);
    this.editMode = existing !== undefined;
    this.input = existing ? { ...existing.input } : emptyInput();
    this.cover = existing?.cover ?? null;
    // Offered from the Company notes the vault already has, rather than typed:
    // the operator is a link, and a link somebody typed a second spelling of
    // resolves to nothing.
    this.operators = readCrmBoard(app, settings).companies.map((company) => company.title);
    this.countryOfCity = cityCountries(app, settings);
  }

  getTitle(): string {
    return this.editMode
      ? t('modals.common.editTitle', { title: this.existing?.title ?? '' })
      : t('modals.newExcursionModal.title');
  }

  getIcon(): string {
    return 'compass';
  }

  renderBody(bodyEl: HTMLElement): void {
    this.bodyEl = bodyEl;
    this.draw();

    const file = this.existing?.file;
    if (this.editMode && file) {
      loadSummaryInto(this.app, file, (summary) => {
        this.summary = summary;
        this.draw();
      });
    }
  }

  /** Redrawn rather than built once: the cover's picture and gallery rows change what they show when a picker answers. */
  private draw(): void {
    this.bodyEl.empty();
    for (const field of excursionEditorFields(this.editMode)) {
      this.renderField(this.bodyEl, field);
    }
    if (this.editMode && this.cover) {
      coverFields(this.bodyEl, {
        app: this.app,
        value: this.cover,
        notePath: () => this.existing?.file.path ?? '',
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

  private renderField(fields: HTMLElement, field: ExcursionEditorField): void {
    switch (field) {
      case 'title':
        this.renderTitleField(fields);
        return;
      case 'city':
        linkRow(fields, {
          label: t('modals.common.cityField'),
          titles: [...this.countryOfCity.keys()],
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
                this.countryOfCity = cityCountries(this.app, this.settings);
                adopt(titleOfPath(path));
              },
              undefined,
              { openAfterCreate: false }
            ).open();
          },
        });
        return;
      case 'operator':
        // No way to create a Company from here, deliberately: those notes are
        // written by three plugins to one contract, and this phase does not
        // make APERtrail an author of them.
        linkRow(fields, {
          label: t('modals.newVehicleModal.operatorField'),
          titles: this.operators,
          value: this.input.operatorTitle ?? '',
          noneLabel: t('modals.common.noneOption'),
          onChange: (title) => {
            this.input.operatorTitle = title || null;
          },
        });
        return;
      case 'duration':
        this.textField(
          fields,
          t('fieldNames.duration'),
          this.input.duration ?? '',
          (value) => {
            this.input.duration = value.trim() ? value : null;
          },
          t('modals.newExcursionModal.durationPlaceholder')
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

  /** The country follows the city on every save, so a tour moved to another town does not keep the old country. */
  private withCountry(): ExcursionInput {
    const city = this.input.cityTitle;
    return {
      ...this.input,
      countryTitle: city ? (this.countryOfCity.get(city) ?? null) : null,
    };
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
    try {
      const file = await createExcursionNote(this.app, this.settings, title, this.withCountry());
      new Notice(t('modals.newExcursionModal.created', { title }));
      this.onSaved?.(file.path);
      this.close();
      await this.app.workspace.getLeaf('tab').openFile(file);
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }

  private async save(): Promise<void> {
    const existing = this.existing;
    if (!existing) return;
    try {
      await updateExcursionNote(
        this.app,
        this.settings,
        existing.file,
        this.withCountry(),
        this.cover ?? undefined
      );
      // Inside the same try, for the place editor's reason: properties saved
      // and text not is a half-saved note.
      await saveNoteSummary(this.app, existing.file, this.summary);
      new Notice(t('modals.common.saved', { title: existing.title }));
      this.onSaved?.(existing.file.path);
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.saveFailed'));
    }
  }
}

/** Every city in the vault, mapped to the country it sits in. */
function cityCountries(app: App, settings: APERtrailSettings): Map<string, string> {
  const board = readTravelBoard(app, settings);
  return new Map(
    board.cities.map((city) => [city.title, city.country?.title ?? city.countryTitle ?? ''])
  );
}
