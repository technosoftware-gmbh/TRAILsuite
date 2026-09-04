/**
 * The gallery's search field, its two view controls, its Add meal button, and
 * the filter panel.
 *
 * Every part of it comes from `ui/toolbar.ts`, which is also what the orders
 * view is built from. What is left here is the part that is about meals: which
 * fields can be sorted on, and which filters a library of meals has.
 *
 * Stateless: it is handed the current state and calls back with the next one.
 * The view owns persistence and re-rendering, which is what keeps the two from
 * disagreeing about what is currently applied.
 *
 * Sort is a native Obsidian menu because it is one choice and closing after it
 * is right. Filters are a panel because they are several independent controls
 * somebody combines, and a menu closes after any one click.
 */
import { Menu } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { GallerySavedState } from '../../settings/types';
import {
  toolbarActions,
  toolbarButton,
  toolbarIconButton,
  toolbarPanel,
  toolbarPanelButton,
  toolbarPanelFooter,
  toolbarRow,
  toolbarSearch,
  toolbarSelect,
  toolbarToggle,
} from '../../ui/toolbar';
import {
  CLEARED_FILTERS,
  distinctDiets,
  distinctFolders,
  distinctTags,
  hasActiveFilters,
} from '../view-model/gallery-filter';
import type { GalleryEntry } from '../view-model/gallery-entry';
import { SORT_FIELD_ICONS, SORT_FIELDS, sortFieldLabel } from './sort-labels';

export interface ToolbarOptions {
  entries: GalleryEntry[];
  state: GallerySavedState;
  /** Hides the allergen filter when the reader has not listed any. */
  hasAllergenList: boolean;
  filterPanelOpen: boolean;
  onChange: (next: GallerySavedState) => void;
  onToggleFilterPanel: () => void;
  onAddMeal: () => void;
}

function openSortMenu(event: MouseEvent, options: ToolbarOptions): void {
  const { state, onChange } = options;
  const menu = new Menu();

  for (const field of SORT_FIELDS) {
    menu.addItem((item) =>
      item
        .setTitle(sortFieldLabel(field))
        .setIcon(SORT_FIELD_ICONS[field])
        .setChecked(state.sortField === field)
        .onClick(() => onChange({ ...state, sortField: field }))
    );
  }

  menu.addSeparator();

  menu.addItem((item) =>
    item
      .setTitle(t('meals.gallery.sort.ascending'))
      .setIcon('arrow-up-narrow-wide')
      .setChecked(state.sortDirection === 'asc')
      .onClick(() => onChange({ ...state, sortDirection: 'asc' }))
  );
  menu.addItem((item) =>
    item
      .setTitle(t('meals.gallery.sort.descending'))
      .setIcon('arrow-down-wide-narrow')
      .setChecked(state.sortDirection === 'desc')
      .onClick(() => onChange({ ...state, sortDirection: 'desc' }))
  );

  menu.showAtMouseEvent(event);
}

function renderFilterPanel(container: HTMLElement, options: ToolbarOptions): void {
  const { entries, state, onChange } = options;
  const panel = toolbarPanel(container);

  toolbarSelect(panel, {
    allLabel: t('meals.gallery.filters.allFolders'),
    values: distinctFolders(entries),
    someStateNone: entries.some((entry) => !entry.folder),
    selected: state.folder,
    onPick: (value) => onChange({ ...state, folder: value }),
  });

  // Ahead of tags, because in a library of ready meals this is the filter
  // somebody actually reaches for: every note declares a diet, and few carry a
  // tag.
  toolbarSelect(panel, {
    allLabel: t('meals.gallery.filters.allDiets'),
    values: distinctDiets(entries),
    someStateNone: entries.some((entry) => entry.meta.diet.length === 0),
    selected: state.diet,
    onPick: (value) => onChange({ ...state, diet: value }),
  });

  toolbarSelect(panel, {
    allLabel: t('meals.gallery.filters.allTags'),
    values: distinctTags(entries),
    someStateNone: entries.some((entry) => entry.tags.length === 0),
    selected: state.tag,
    onPick: (value) => onChange({ ...state, tag: value }),
  });

  // Only where something is a favourite, on the same terms as the dropdowns
  // above: a box that can only ever empty the grid is not a filter. It appears
  // the moment a meal is favourited from its own view.
  if (state.favoriteOnly || entries.some((entry) => entry.meta.favorite)) {
    toolbarToggle(panel, t('meals.gallery.filters.favoritesOnly'), state.favoriteOnly, (value) =>
      onChange({ ...state, favoriteOnly: value })
    );
  }

  toolbarToggle(panel, t('meals.gallery.filters.neverEaten'), state.neverEaten, (value) =>
    onChange({ ...state, neverEaten: value })
  );

  // Only when there is a list to exclude against. A checkbox that can only
  // ever do nothing is worse than no checkbox.
  if (options.hasAllergenList) {
    toolbarToggle(
      panel,
      t('meals.gallery.filters.excludeAllergens'),
      state.excludeAllergens,
      (value) => onChange({ ...state, excludeAllergens: value })
    );
  }

  const footer = toolbarPanelFooter(panel);

  // Search survives a clear: it has its own visible field, and wiping what
  // somebody typed while they were looking at it is a surprise.
  toolbarPanelButton(footer, {
    icon: 'eraser',
    label: t('meals.gallery.filters.clear'),
    onClick: () => onChange({ ...state, ...CLEARED_FILTERS }),
  });

  toolbarPanelButton(footer, {
    icon: 'x',
    ariaLabel: t('meals.gallery.filters.hide'),
    onClick: options.onToggleFilterPanel,
  });
}

export function renderGalleryToolbar(container: HTMLElement, options: ToolbarOptions): void {
  const { state, onChange } = options;
  const bar = toolbarRow(container);

  toolbarSearch(bar, {
    placeholder: t('meals.gallery.searchPlaceholder'),
    value: state.search,
    onChange: (value) => onChange({ ...state, search: value }),
  });

  const actions = toolbarActions(bar);

  toolbarIconButton(actions, {
    icon: 'filter',
    label: t('meals.gallery.filters.title'),
    active: options.filterPanelOpen,
    marked: hasActiveFilters(state),
    onClick: options.onToggleFilterPanel,
  });

  toolbarIconButton(actions, {
    icon: 'arrow-up-down',
    label: t('meals.gallery.sort.title'),
    onClick: (event) => openSortMenu(event, options),
  });

  // Last, and labelled where the other two are icons only: the two before it
  // change what is on screen, this one adds to the library.
  toolbarButton(actions, {
    icon: 'plus',
    label: t('meals.gallery.addMeal'),
    onClick: options.onAddMeal,
  });

  if (options.filterPanelOpen) renderFilterPanel(container, options);
}
