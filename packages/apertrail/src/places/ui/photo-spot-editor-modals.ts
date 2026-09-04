/**
 * Single-item editors for one motif and one sample frame, opened from the
 * photo spot block's own per-row buttons.
 *
 * Same shape and same reasoning as item-editor-modals.ts: each takes a
 * value and hands back an edited copy, and none of them touch the vault.
 * The caller owns the write, so one save path stays responsible for the
 * whole note (see places/ui/photo-spot-block.ts).
 *
 * A motif has twelve fields, which is more than a stop and would make a
 * plain run of Setting rows read as a wall. The three that are really
 * choices rather than text -- light windows, months, role -- are rendered
 * as toggle chips instead, which also removes the parsing that a
 * comma-separated text field would have needed.
 */
import { App, Modal, Notice, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import {
  parsePhotoSpotDirection,
  PhotoSpotMotifInput,
  PhotoSpotSampleInput,
  PHOTO_SPOT_LIGHT_WINDOWS,
  PhotoSpotLightWindow,
} from '../photo-spot-note';
import { formatMonthName } from '../../shared/display';

/** Shared chrome: title, fields, then Cancel / Save. Mirrors item-editor-modals.ts's own base. */
abstract class PhotoSpotItemModal<T> extends Modal {
  protected value: T;

  constructor(
    app: App,
    initial: T,
    private readonly onSave: (value: T) => void
  ) {
    super(app);
    this.value = { ...initial };
  }

  protected abstract getTitle(): string;
  protected abstract renderFields(container: HTMLElement): void;
  protected validate(): string | null {
    return null;
  }

  onOpen(): void {
    this.render();
  }

  /** Redraw from the current value. Only a control that changes a field OTHER than its own needs it -- a text box repaints itself. */
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

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * A row of chips that toggle membership in a list.
 *
 * Order follows click order rather than the vocabulary's own, because a
 * motif's `light` is explicitly best-first: a spot that works at sunrise
 * and, at a pinch, in the evening should keep that ranking rather than
 * have it sorted away.
 */
/**
 * The four named seasons, as the months they cover on the northern
 * hemisphere, plus the button that clears them.
 *
 * Northern, and the labels say so rather than the code pretending
 * otherwise: a preset is a shortcut for the months somebody would have
 * clicked anyway, and the months are still there to adjust afterwards.
 */
const SEASON_PRESETS: { key: string; months: number[] }[] = [
  { key: 'spring', months: [3, 4, 5] },
  { key: 'summer', months: [6, 7, 8] },
  { key: 'autumn', months: [9, 10, 11] },
  { key: 'winter', months: [12, 1, 2] },
  { key: 'allYear', months: [] },
];

function renderSeasonPresets(field: HTMLElement, onPick: (months: number[]) => void): void {
  const row = field.createDiv({ cls: 'apt-chips apt-season-presets' });
  for (const preset of SEASON_PRESETS) {
    const btn = row.createEl('button', {
      cls: 'apt-chip apt-chip-preset',
      text: t(`modals.motifEditor.seasonPreset.${preset.key}`),
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onPick([...preset.months].sort((a, b) => a - b));
    });
  }
}

function renderToggleChips<T extends string | number>(
  container: HTMLElement,
  label: string,
  options: { value: T; label: string }[],
  selected: T[],
  onChange: (next: T[]) => void
): HTMLElement {
  const field = container.createDiv({ cls: 'apt-modal-field' });
  field.createEl('label', { cls: 'apt-modal-field-label', text: label });
  const chips = field.createDiv({ cls: 'apt-chips' });

  const current = [...selected];
  for (const option of options) {
    const chip = chips.createEl('button', {
      cls: 'apt-chip apt-chip-toggle',
      text: option.label,
    });
    const paint = (): void => chip.toggleClass('is-on', current.includes(option.value));
    paint();
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const at = current.indexOf(option.value);
      if (at >= 0) current.splice(at, 1);
      else current.push(option.value);
      paint();
      onChange([...current]);
    });
  }

  return field;
}

const LIGHT_OPTIONS = (): { value: PhotoSpotLightWindow; label: string }[] =>
  PHOTO_SPOT_LIGHT_WINDOWS.map((window) => ({
    value: window,
    label: t(`photoSpot.light.${window}`),
  }));

const MONTH_OPTIONS = (): { value: number; label: string }[] =>
  Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: formatMonthName(i + 1) }));

/** "46.9895, 6.9243" as pasted from a map view. Two fields would be more precise and nobody pastes in two halves. */
function formatCoordinatePair(pair: [string, string] | null): string {
  return pair ? `${pair[0]}, ${pair[1]}` : '';
}

function parseCoordinatePair(raw: string): [string, string] | null {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length !== 2) return null;
  if (!Number.isFinite(Number(parts[0])) || !Number.isFinite(Number(parts[1]))) return null;
  return [parts[0], parts[1]];
}

export class MotifEditorModal extends PhotoSpotItemModal<PhotoSpotMotifInput> {
  protected getTitle(): string {
    return t('modals.motifEditor.title');
  }

  protected validate(): string | null {
    return this.value.name.trim() === '' ? t('modals.motifEditor.nameRequired') : null;
  }

  protected renderFields(container: HTMLElement): void {
    new Setting(container).setName(t('modals.motifEditor.name')).addText((text) =>
      text.setValue(this.value.name).onChange((raw) => {
        this.value.name = raw;
      })
    );

    new Setting(container)
      .setName(t('modals.motifEditor.role'))
      .setDesc(t('modals.motifEditor.roleDesc'))
      .addDropdown((drop) =>
        drop
          .addOption('main', t('photoSpot.role.main'))
          .addOption('secondary', t('photoSpot.role.secondary'))
          .setValue(this.value.role)
          .onChange((raw) => {
            this.value.role = raw === 'main' ? 'main' : 'secondary';
          })
      );

    new Setting(container)
      .setName(t('modals.motifEditor.geoLocation'))
      .setDesc(t('modals.motifEditor.geoLocationDesc'))
      .addText((text) =>
        text
          .setPlaceholder('46.9895, 6.9243')
          .setValue(formatCoordinatePair(this.value.geoLocation))
          .onChange((raw) => {
            // An unparseable pair clears the override rather than being
            // kept half-written: the motif then inherits the note's own
            // coordinates, which is the honest fallback.
            this.value.geoLocation = raw.trim() === '' ? null : parseCoordinatePair(raw);
          })
      );

    new Setting(container)
      .setName(t('modals.motifEditor.direction'))
      .setDesc(t('modals.motifEditor.directionDesc'))
      .addText((text) =>
        text
          .setPlaceholder('215')
          .setValue(this.value.direction === null ? '' : String(this.value.direction))
          .onChange((raw) => {
            // Normalized on the way in, so a note that said "SW" is stored
            // as 225 the next time it is saved. See photo-spot-note.ts.
            this.value.direction = parsePhotoSpotDirection(raw);
          })
      );

    renderToggleChips(
      container,
      t('modals.motifEditor.light'),
      LIGHT_OPTIONS(),
      this.value.light,
      (next) => {
        this.value.light = next;
      }
    );

    const seasonField = renderToggleChips(
      container,
      t('modals.motifEditor.season'),
      MONTH_OPTIONS(),
      this.value.season,
      (next) => {
        this.value.season = next.sort((a, b) => a - b);
      }
    );

    // Months are what the note stores, and named seasons are what a
    // photographer says. This closes open question 1 of the design without
    // touching a single stored value: the buttons WRITE months, so a note
    // stays readable in either hemisphere and sorts.
    renderSeasonPresets(seasonField, (months) => {
      this.value.season = months;
      this.render();
    });

    new Setting(container).setName(t('modals.motifEditor.lens')).addText((text) =>
      text
        .setPlaceholder('70-200')
        .setValue(this.value.lens ?? '')
        .onChange((raw) => {
          this.value.lens = raw.trim() || null;
        })
    );

    new Setting(container)
      .setName(t('modals.motifEditor.gear'))
      .setDesc(t('modals.motifEditor.gearDesc'))
      .addText((text) =>
        text.setValue(this.value.gear.join(', ')).onChange((raw) => {
          this.value.gear = raw
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
        })
      );

    new Setting(container)
      .setName(t('modals.motifEditor.note'))
      .setDesc(t('modals.motifEditor.noteDesc'))
      .addTextArea((area) =>
        area.setValue(this.value.note ?? '').onChange((raw) => {
          this.value.note = raw.trim() || null;
        })
      );

    new Setting(container)
      .setName(t('modals.motifEditor.technique'))
      .setDesc(t('modals.motifEditor.techniqueDesc'))
      .addTextArea((area) =>
        area.setValue(this.value.technique ?? '').onChange((raw) => {
          this.value.technique = raw.trim() || null;
        })
      );
  }
}

export class SampleEditorModal extends PhotoSpotItemModal<PhotoSpotSampleInput> {
  constructor(
    app: App,
    initial: PhotoSpotSampleInput,
    onSave: (value: PhotoSpotSampleInput) => void,
    private readonly motifNames: string[] = []
  ) {
    super(app, initial, onSave);
  }

  protected getTitle(): string {
    return t('modals.sampleEditor.title');
  }

  protected validate(): string | null {
    return this.value.image.trim() === '' ? t('modals.sampleEditor.imageRequired') : null;
  }

  protected renderFields(container: HTMLElement): void {
    new Setting(container)
      .setName(t('modals.sampleEditor.image'))
      .setDesc(t('modals.sampleEditor.imageDesc'))
      .addText((text) =>
        text.setValue(this.value.image).onChange((raw) => {
          this.value.image = raw;
        })
      );

    // A dropdown built from the motifs this note actually has, so the
    // back-reference cannot be misspelled into a loose sample. A note with
    // no motifs yet still gets the "unassigned" option.
    new Setting(container).setName(t('modals.sampleEditor.motif')).addDropdown((drop) => {
      drop.addOption('', t('modals.common.noneOption'));
      for (const name of this.motifNames) drop.addOption(name, name);
      drop.setValue(
        this.motifNames.includes(this.value.motifName ?? '') ? this.value.motifName : ''
      );
      drop.onChange((raw) => {
        this.value.motifName = raw || null;
      });
    });

    new Setting(container).setName(t('modals.sampleEditor.light')).addDropdown((drop) => {
      drop.addOption('', t('modals.common.noneOption'));
      for (const window of PHOTO_SPOT_LIGHT_WINDOWS) {
        drop.addOption(window, t(`photoSpot.light.${window}`));
      }
      drop.setValue(this.value.light ?? '');
      drop.onChange((raw) => {
        this.value.light = raw === '' ? null : (raw as PhotoSpotLightWindow);
      });
    });

    new Setting(container)
      .setName(t('modals.sampleEditor.exposure'))
      .setDesc(t('modals.sampleEditor.exposureDesc'))
      .addText((text) =>
        text.setValue(this.value.exposure ?? '').onChange((raw) => {
          this.value.exposure = raw.trim() || null;
        })
      );

    new Setting(container).setName(t('modals.sampleEditor.credit')).addText((text) =>
      text.setValue(this.value.credit ?? '').onChange((raw) => {
        this.value.credit = raw.trim() || null;
      })
    );
  }
}

/** A blank motif, so "add" and "edit" are the same modal with different starting values. */
export function emptyMotif(): PhotoSpotMotifInput {
  return {
    name: '',
    role: 'secondary',
    geoLocation: null,
    direction: null,
    light: [],
    season: [],
    lens: null,
    gear: [],
    technique: null,
    note: null,
    captured: false,
    capturedOn: null,
  };
}

export function emptySample(): PhotoSpotSampleInput {
  return { image: '', motifName: null, light: null, exposure: null, credit: null };
}
