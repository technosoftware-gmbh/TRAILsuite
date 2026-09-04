/**
 * The orders view's search field, its two view controls, and the two things it
 * can create.
 *
 * Every part of it comes from `ui/toolbar.ts`, which is also what the gallery
 * is built from: an order list and a meal library are both "everything of one
 * kind, narrowed", and two arrangements for that would be two things to learn
 * and two places for a button to end up the wrong size. What is left here is
 * the part that is about orders: which fields can be sorted on and which
 * filters exist.
 *
 * Stateless: handed the current state, calls back with the next one. The view
 * owns persistence and re-rendering.
 */
import { Menu } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { OrdersSavedState } from '../../settings/types';
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
  CLEARED_ORDER_FILTERS,
  distinctCompanies,
  distinctYears,
  hasActiveOrderFilters,
} from '../view-model/orders-filter';
import {
  ORDER_SORT_FIELDS,
  ORDER_SORT_ICONS,
  orderSortFieldLabel,
} from '../view-model/orders-sort';
import type { OrderRecord } from '../types';

export interface OrdersToolbarOptions {
  /** Every order, unfiltered: the dropdowns offer what exists rather than what survived. */
  orders: readonly OrderRecord[];
  state: OrdersSavedState;
  filterPanelOpen: boolean;
  onChange: (next: OrdersSavedState) => void;
  onToggleFilterPanel: () => void;
  onAddOrder: () => void;
  onAddDelivery: () => void;
}

function openSortMenu(event: MouseEvent, options: OrdersToolbarOptions): void {
  const { state, onChange } = options;
  const menu = new Menu();

  for (const field of ORDER_SORT_FIELDS) {
    menu.addItem((item) =>
      item
        .setTitle(orderSortFieldLabel(field))
        .setIcon(ORDER_SORT_ICONS[field])
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

function renderFilterPanel(container: HTMLElement, options: OrdersToolbarOptions): void {
  const { orders, state, onChange } = options;
  const panel = toolbarPanel(container);

  toolbarSelect(panel, {
    allLabel: t('orders.filters.allCompanies'),
    values: distinctCompanies(orders),
    selected: state.company,
    onPick: (value) => onChange({ ...state, company: value }),
  });

  toolbarSelect(panel, {
    allLabel: t('orders.filters.allYears'),
    values: distinctYears(orders),
    selected: state.year,
    onPick: (value) => onChange({ ...state, year: value }),
  });

  toolbarToggle(panel, t('orders.filters.withoutDelivery'), state.withoutDelivery, (value) =>
    onChange({ ...state, withoutDelivery: value })
  );

  const footer = toolbarPanelFooter(panel);

  // Search survives a clear, exactly as it does in the gallery: it has its own
  // visible field, and wiping what somebody typed while they are looking at it
  // is a surprise.
  toolbarPanelButton(footer, {
    icon: 'eraser',
    label: t('meals.gallery.filters.clear'),
    onClick: () => onChange({ ...state, ...CLEARED_ORDER_FILTERS }),
  });

  toolbarPanelButton(footer, {
    icon: 'x',
    ariaLabel: t('meals.gallery.filters.hide'),
    onClick: options.onToggleFilterPanel,
  });
}

export function renderOrdersToolbar(container: HTMLElement, options: OrdersToolbarOptions): void {
  const { state, onChange } = options;
  const bar = toolbarRow(container);

  toolbarSearch(bar, {
    placeholder: t('orders.searchPlaceholder'),
    value: state.search,
    onChange: (value) => onChange({ ...state, search: value }),
  });

  const actions = toolbarActions(bar);

  toolbarIconButton(actions, {
    icon: 'filter',
    label: t('meals.gallery.filters.title'),
    active: options.filterPanelOpen,
    marked: hasActiveOrderFilters(state),
    onClick: options.onToggleFilterPanel,
  });

  toolbarIconButton(actions, {
    icon: 'arrow-up-down',
    label: t('orders.sort.title'),
    onClick: (event) => openSortMenu(event, options),
  });

  toolbarButton(actions, {
    icon: 'plus',
    label: t('orders.newOrder'),
    onClick: options.onAddOrder,
  });

  toolbarButton(actions, {
    icon: 'package',
    label: t('deliveries.new'),
    onClick: options.onAddDelivery,
  });

  if (options.filterPanelOpen) renderFilterPanel(container, options);
}
