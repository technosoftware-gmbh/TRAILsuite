/**
 * The home view's top action bar: one button per thing this plugin can
 * create, a refresh at the end, and a search box on its own row beneath.
 *
 * The button list belongs to the caller rather than to this file. The
 * ordering carries meaning (roughly how often you reach for it, which is why
 * State and Country sit last rather than first) that only the caller knows,
 * and labels arrive already translated for the same reason: the bar has no
 * opinion about what it is drawing for.
 */
import { setIcon } from 'obsidian';

export interface DashboardActionButton {
  icon: string;
  label: string;
  onClick: () => void;
}

export interface DashboardActionBarOptions {
  searchPlaceholder: string;
  /** The current query, so a redraw does not empty the box the user is typing in. */
  searchValue: string;
  /** Called on every keystroke: the grid below filters as you type. */
  onSearch: (query: string) => void;
  buttons: DashboardActionButton[];
  refreshLabel: string;
  onRefresh: () => void;
}

function renderSearchBox(row: HTMLElement, options: DashboardActionBarOptions): HTMLInputElement {
  const box = row.createDiv({ cls: 'apt-dashboard-search' });
  setIcon(box.createSpan({ cls: 'apt-dashboard-search-icon' }), 'search');
  const input = box.createEl('input', {
    cls: 'apt-dashboard-search-input',
    attr: { type: 'search', placeholder: options.searchPlaceholder },
  });
  input.value = options.searchValue;
  input.addEventListener('input', () => options.onSearch(input.value));
  return input;
}

function renderActionButton(row: HTMLElement, button: DashboardActionButton): void {
  const btn = row.createEl('button', { cls: 'apt-dashboard-quick-action-btn' });
  setIcon(btn.createSpan({ cls: 'apt-dashboard-quick-action-icon' }), button.icon);
  btn.createSpan({ text: button.label });
  btn.addEventListener('click', button.onClick);
}

/**
 * The buttons on one row, the search on its own beneath them.
 *
 * **Two rows rather than one, and above the greeting rather than below it.**
 * All three plugins put a view's actions in the first thing you see, and they
 * had each answered "where" differently: this one led with the greeting and
 * shared a row between the search and the buttons, which on a narrow window
 * wrapped and left the search a stub. The order is the Life OS dashboard's,
 * which had it right first: what you can do, what you can find, then who you
 * are and what day it is.
 *
 * The search keeps a row to itself because it is the control that wants width
 * -- a list of trips or of places is searched by typing several words -- and a
 * row it shares is a row it loses.
 *
 * Returns the input so the caller can put the caret back after a redraw. It
 * cannot restore focus itself: whether the box had focus is a fact about the
 * document before the redraw, which only the caller was there for.
 */
export function renderDashboardActionBar(
  container: HTMLElement,
  options: DashboardActionBarOptions
): HTMLInputElement {
  const row = container.createDiv({ cls: 'apt-dashboard-quick-actions' });

  const buttons = row.createDiv({ cls: 'apt-dashboard-quick-action-buttons' });
  for (const button of options.buttons) renderActionButton(buttons, button);
  // Refresh is appended here rather than left to the caller's list so it is
  // always last and always present: the view reads the vault on render and
  // does not subscribe to changes.
  renderActionButton(buttons, {
    icon: 'refresh-cw',
    label: options.refreshLabel,
    onClick: options.onRefresh,
  });

  return renderSearchBox(container.createDiv({ cls: 'apt-dashboard-search-row' }), options);
}
