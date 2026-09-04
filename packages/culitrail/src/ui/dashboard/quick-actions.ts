/**
 * The dashboard's top bar: a meal search on the left, the two views it is
 * worth leaving for on the right.
 *
 * It used to hold the create actions instead, on the argument that every card
 * below already links to the view it summarizes. That stopped being true when
 * the orders card went: nothing on the dashboard reaches the orders view any
 * more, and creating a meal belongs where a library is browsed rather than
 * where it is summarized. So the row navigates, and the gallery carries the
 * button that adds.
 *
 * Built from `ui/toolbar.ts`, like the gallery's row and the orders view's, so
 * a button here is the same size as a button there.
 *
 * The search hands its query to the gallery's own filter state rather than
 * matching anything here, so one set of rules decides what a search means.
 */
import { t } from '../../lang/I18nManager';
import { toolbarActions, toolbarButton, toolbarRow, toolbarSearch } from '../toolbar';
import type { DashboardViewDeps } from './deps';

/**
 * Drawn above the greeting now, and in two rows rather than one.
 *
 * All three plugins lead with what you can do, then what you can find, then
 * who you are and what day it is -- the order the Life OS dashboard had first.
 * This one greeted before it offered anything, and shared a row between the
 * search and the two buttons, so on a narrow window the search wrapped to a
 * stub. A row of its own is a row it cannot lose.
 *
 * It takes a container rather than the grid, because it is no longer in the
 * grid: the header sits above it.
 */
export function renderQuickActions(container: HTMLElement, deps: DashboardViewDeps): void {
  const row = container.createDiv({ cls: 'culi-dashboard-quick-actions' });
  const bar = toolbarRow(row);
  const actions = toolbarActions(bar);

  toolbarButton(actions, {
    icon: 'layout-grid',
    label: t('dashboard.actions.viewMeals'),
    onClick: () => deps.openGallery(),
  });

  toolbarButton(actions, {
    icon: 'receipt',
    label: t('dashboard.actions.viewOrders'),
    onClick: () => deps.openOrders(),
  });

  const searchBar = toolbarRow(container.createDiv({ cls: 'culi-dashboard-search-row' }));

  // Unlike the gallery's and the orders view's, this field does not narrow
  // anything on the screen it is on: it opens the gallery filtered to what was
  // typed. So it acts on Enter rather than as you type, because a debounced
  // keystroke that navigated away would take the rest of the word with it.
  const search = toolbarSearch(searchBar, {
    placeholder: t('dashboard.actions.searchPlaceholder'),
    value: '',
    onChange: () => undefined,
  });

  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const query = search.value.trim();
    // An empty box opening an unfiltered gallery would look like the search
    // had failed rather than like nothing was asked.
    if (query) deps.searchMeals(query);
  });
}
