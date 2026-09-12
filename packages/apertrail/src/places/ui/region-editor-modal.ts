/**
 * Create-or-edit modal for the three notes that hold the geographic
 * hierarchy together: a Country, a State and a City.
 *
 * One parameterized class replacing three near-identical files, the shape
 * `PlaceEditorModal` took for its five kinds, and one class for both flows
 * rather than two, the shape `TripEditorModal` argued for first. The three it
 * replaces differed in a title, an icon and which creation function they
 * called; everything else was the same form typed out three times.
 *
 * **It opens itself.** A city's country dropdown offers to create a country,
 * and that opens this class again with `kind: 'country'`. The ladder has a
 * top -- a country names nothing above it -- so the cascade terminates by
 * construction rather than by a depth guard.
 *
 * **The capital is the one link that points down.** A country and a state
 * name a City, and that is safe where a list would not be: it is a single
 * note rather than the child list this plugin deliberately never writes. See
 * places/write-region.ts.
 */
import { App, Notice, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { addFooterButtons, BaseModal } from '../../ui/components/modal-shell';
import { linkRow, textRow } from '../../ui/components/form-rows';
import { coverFields, coverInputOf } from '../../ui/components/cover-fields';
import { ensureRelatedTripsBlock } from '../../vault/related-trips-body';
import { loadSummaryInto, saveNoteSummary } from '../../ui/components/summary-field';
import { CoverInput } from '../../vault/write-cover';
import { formatCoordinatePair, parseCoordinatePair } from '../../ui/components/coordinate-field';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelBoard, TravelCountry, TravelState } from '../../vault/types';
import { EditableRegion } from '../../vault/editable';
import { createCityNote, createCountryNote, createStateNote } from '../../vault/create-entities';
import {
  cityToInput,
  countryToInput,
  RegionInput,
  RegionKind,
  stateToInput,
  updateRegionNote,
} from '../write-region';
import { RegionEditorField, regionEditorFields } from '../region-editor-fields';

const TITLE_KEY: Record<RegionKind, string> = {
  country: 'modals.newCountryModal.title',
  state: 'modals.newStateModal.title',
  city: 'modals.newCityModal.title',
};

const CREATED_KEY: Record<RegionKind, string> = {
  country: 'modals.newCountryModal.created',
  state: 'modals.newStateModal.created',
  city: 'modals.newCityModal.created',
};

const ICON: Record<RegionKind, string> = {
  country: 'flag',
  state: 'map',
  city: 'building-2',
};

/** The note being edited, in the shape this modal needs: the file to write, the title to show, the values to prefill. */
export interface RegionEdit {
  file: TFile;
  title: string;
  input: RegionInput;
  /** What the note looks like: the line under its title, its picture, its gallery. */
  cover: CoverInput;
}

/** A board record, ready to hand to the modal. Here rather than at each call site, so three callers cannot disagree about how a city is prefilled. */
export function regionEdit(subject: EditableRegion): RegionEdit {
  const cover = coverInputOf(subject.record);
  if (subject.kind === 'country') {
    return {
      file: subject.record.file,
      title: subject.record.title,
      input: countryToInput(subject.record),
      cover,
    };
  }
  if (subject.kind === 'state') {
    return {
      file: subject.record.file,
      title: subject.record.title,
      input: stateToInput(subject.record),
      cover,
    };
  }
  return {
    file: subject.record.file,
    title: subject.record.title,
    input: cityToInput(subject.record),
    cover,
  };
}

/** A created note's title, which is its filename. */
function titleOfPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function emptyInput(): RegionInput {
  return {
    countryTitle: null,
    stateTitle: null,
    capitalTitle: null,
    geoLocation: null,
    tags: [],
  };
}

export class RegionEditorModal extends BaseModal {
  private readonly editMode: boolean;
  private readonly input: RegionInput;
  /** What was typed into the coordinate box, kept as typed so a save can refuse a typo rather than silently dropping it. */
  private geoRaw: string;
  private board: TravelBoard;
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
    private readonly kind: RegionKind,
    private readonly onSaved?: (path: string) => void,
    private readonly existing?: RegionEdit,
    /** Opened from inside another form, this dialog must not take the workspace with it. */
    private readonly opts: { openAfterCreate?: boolean } = {}
  ) {
    super(app);
    this.editMode = existing !== undefined;
    this.input = existing ? { ...existing.input, tags: [...existing.input.tags] } : emptyInput();
    this.geoRaw = formatCoordinatePair(this.input.geoLocation);
    this.cover = existing?.cover ?? null;
    this.board = readTravelBoard(app, settings);
  }

  getTitle(): string {
    return this.editMode
      ? t('modals.common.editTitle', { title: this.existing?.title ?? '' })
      : t(TITLE_KEY[this.kind]);
  }

  getIcon(): string {
    return ICON[this.kind];
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
    for (const field of regionEditorFields(this.kind, this.editMode)) {
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

  private renderField(fields: HTMLElement, field: RegionEditorField): void {
    switch (field) {
      case 'title':
        this.renderTitleField(fields);
        return;
      case 'country':
        this.renderLink(fields, {
          label: t('modals.common.countryField'),
          titles: this.board.countries.map((country) => country.title),
          value: this.input.countryTitle ?? '',
          onPick: (title) => {
            this.input.countryTitle = title || null;
          },
          childKind: 'country',
        });
        return;
      case 'state':
        this.renderLink(fields, {
          label: t('modals.common.stateField'),
          titles: this.board.states.map((state) => state.title),
          value: this.input.stateTitle ?? '',
          onPick: (title) => {
            this.input.stateTitle = title || null;
          },
          childKind: 'state',
        });
        return;
      case 'capital':
        this.renderLink(fields, {
          label: t('modals.common.capitalField'),
          titles: this.board.cities.map((city) => city.title),
          value: this.input.capitalTitle ?? '',
          onPick: (title) => {
            this.input.capitalTitle = title || null;
          },
          childKind: 'city',
        });
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

  /** One dropdown naming another note, with this same dialog behind its "create one" entry. */
  private renderLink(
    fields: HTMLElement,
    options: {
      label: string;
      titles: string[];
      value: string;
      onPick: (title: string) => void;
      childKind: RegionKind;
    }
  ): void {
    linkRow(fields, {
      label: options.label,
      titles: options.titles,
      value: options.value,
      noneLabel: t('modals.common.noneOption'),
      onChange: options.onPick,
      createLabel: t('modals.common.createNewOption'),
      onCreateNew: (adopt) => {
        new RegionEditorModal(
          this.app,
          this.settings,
          options.childKind,
          (path) => {
            this.board = readTravelBoard(this.app, this.settings);
            adopt(titleOfPath(path));
          },
          undefined,
          { openAfterCreate: false }
        ).open();
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
    const country = this.board.countries.find((c) => c.title === this.input.countryTitle) ?? null;
    const state = this.board.states.find((s) => s.title === this.input.stateTitle) ?? null;

    try {
      const file = await this.createNote(title, country, state);
      new Notice(t(CREATED_KEY[this.kind], { title }));
      this.onSaved?.(file.path);
      this.close();
      if (this.opts.openAfterCreate !== false) {
        await this.app.workspace.getLeaf('tab').openFile(file);
      }
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
    }
  }

  /** The three creation functions take different arguments, which is the one place this class still branches on kind. */
  private createNote(
    title: string,
    country: TravelCountry | null,
    state: TravelState | null
  ): Promise<TFile> {
    if (this.kind === 'country') return createCountryNote(this.app, this.settings, title);
    if (this.kind === 'state') return createStateNote(this.app, this.settings, title, country);
    return createCityNote(this.app, this.settings, title, country, state);
  }

  private async save(): Promise<void> {
    const existing = this.existing;
    if (!existing) return;

    // A typo is refused rather than dropped: unlike a motif, a city has no
    // coordinates to fall back on, so discarding what somebody typed would
    // lose the intent as well as the value.
    const geoRaw = this.geoRaw.trim();
    const geoLocation = geoRaw === '' ? null : parseCoordinatePair(geoRaw);
    if (geoRaw !== '' && geoLocation === null) {
      new Notice(t('modals.common.geoLocationInvalid'));
      return;
    }
    this.input.geoLocation = geoLocation;

    try {
      await updateRegionNote(
        this.app,
        this.settings,
        existing.file,
        this.kind,
        this.input,
        this.cover ?? undefined
      );
      // Inside the same try, for the place editor's reason: properties saved
      // and text not is a half-saved note.
      await saveNoteSummary(this.app, existing.file, this.summary);
      // A country or a state written before they carried one has no
      // related-trips fence, so its own buttons would never appear. Added
      // here, where the note was being saved anyway, rather than by a
      // migration that rewrites notes nobody asked it to touch. A note that
      // already has the block is not written at all.
      await ensureRelatedTripsBlock(this.app, this.settings, existing.file);
      new Notice(t('modals.common.saved', { title: existing.title }));
      this.onSaved?.(existing.file.path);
      this.close();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : t('modals.common.saveFailed'));
    }
  }
}
