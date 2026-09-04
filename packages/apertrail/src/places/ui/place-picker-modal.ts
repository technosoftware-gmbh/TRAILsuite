/**
 * Fuzzy picker for an itinerary stop's target -- searches Cities and all
 * four place types at once, grouped by kind. A small plain Modal opened
 * from a chip row inside a bigger modal.
 *
 * Cities and places share one list because an itinerary genuinely mixes
 * them -- "arrived in Basel, then ate at the Gifthuettli" -- see
 * docs/design/trip-model-redesign.md §2.4. The kind is shown on every row
 * so the two are still distinguishable at a glance, which matters most
 * for the same-title case the resolver has to tie-break.
 *
 * Can also be restricted to Accommodation only, for the nights section --
 * one picker with a filter rather than a second near-identical modal.
 */
import { App, Modal, prepareFuzzySearch, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { readTravelBoard } from '../../vault/read-entities';
import { TravelStopTargetKind } from '../../vault/types';

export interface TravelPickerOption {
  title: string;
  kind: TravelStopTargetKind;
  /** "Maienfeld, Switzerland" -- enough to tell two same-named places apart. */
  context: string | null;
}

const KIND_ICONS: Record<TravelStopTargetKind, string> = {
  city: 'building-2',
  accommodation: 'bed',
  fnb: 'utensils',
  landmark: 'landmark',
  location: 'map-pin',
  photospot: 'camera',
};

const KIND_LABEL_KEYS: Record<TravelStopTargetKind, string> = {
  city: 'galleryView.filters.city',
  accommodation: 'galleryView.filters.accommodation',
  fnb: 'galleryView.filters.fnb',
  landmark: 'galleryView.filters.landmark',
  location: 'galleryView.filters.location',
  photospot: 'galleryView.filters.photospot',
};

/** Every City and place in the vault, as pickable options -- exported so the modal can also use it to render an already-picked stop's kind icon without re-reading the board. */
export function travelPickerOptions(
  app: App,
  settings: APERtrailSettings,
  onlyKinds?: TravelStopTargetKind[]
): TravelPickerOption[] {
  const board = readTravelBoard(app, settings);
  const options: TravelPickerOption[] = [
    ...board.cities.map((city) => ({
      title: city.title,
      kind: 'city' as const,
      context: city.country?.title ?? null,
    })),
    ...board.places.map((place) => ({
      title: place.title,
      kind: place.kind,
      context: [place.city?.title, place.country?.title].filter(Boolean).join(', ') || null,
    })),
  ];
  const filtered = onlyKinds ? options.filter((o) => onlyKinds.includes(o.kind)) : options;
  return filtered.sort((a, b) => a.title.localeCompare(b.title));
}

export class TravelPlacePickerModal extends Modal {
  private readonly options: TravelPickerOption[];

  constructor(
    app: App,
    settings: APERtrailSettings,
    private readonly onPick: (option: TravelPickerOption) => void,
    onlyKinds?: TravelStopTargetKind[]
  ) {
    super(app);
    this.options = travelPickerOptions(app, settings, onlyKinds);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('modals.placePicker.title') });

    const input = contentEl.createEl('input', {
      cls: 'apt-recipe-picker-input',
      attr: { type: 'text', placeholder: t('modals.placePicker.searchPlaceholder') },
    });
    const resultsEl = contentEl.createDiv({ cls: 'apt-recipe-picker-results' });

    const renderResults = (query: string): void => {
      resultsEl.empty();
      const trimmed = query.trim();
      const fuzzy = trimmed ? prepareFuzzySearch(trimmed) : null;
      const matches = fuzzy
        ? this.options.filter((option) => fuzzy(option.title) !== null)
        : this.options;

      if (matches.length === 0) {
        resultsEl.createEl('p', {
          text: t('modals.placePicker.noMatches'),
          cls: 'setting-item-description',
        });
        return;
      }

      for (const option of matches.slice(0, 50)) {
        const row = resultsEl.createDiv({
          cls: 'apt-place-picker-row',
          attr: { role: 'button', tabindex: '0' },
        });
        setIcon(row.createSpan({ cls: 'apt-place-picker-icon' }), KIND_ICONS[option.kind]);
        const text = row.createDiv();
        text.createDiv({ cls: 'apt-place-picker-title', text: option.title });
        const meta = [t(KIND_LABEL_KEYS[option.kind]), option.context].filter(Boolean).join(' - ');
        text.createDiv({ cls: 'apt-place-picker-meta', text: meta });
        const pick = (): void => {
          this.onPick(option);
          this.close();
        };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
      }
    };

    input.addEventListener('input', () => renderResults(input.value));
    renderResults('');
    window.setTimeout(() => input.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
