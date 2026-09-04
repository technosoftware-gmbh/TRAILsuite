/**
 * The one toolbar every view that lists something is built from.
 *
 * There were four of these, written one after another and drifting apart as
 * they went: the gallery's, the orders view's, the meal-plan header's and the
 * dashboard's top row. They looked the same on a desktop and did not on an
 * iPad, because each declared its own padding in a single-class rule and
 * Obsidian's mobile stylesheet targets `button` with an attribute-or-class
 * selector that outranks one class. A row of four buttons ended up four
 * different heights, and the icon-only ones lost their icons.
 *
 * So there is one row, one search field and two kinds of button here, and
 * every view uses them. The sizes come from two custom properties set on the
 * row (`--culi-toolbar-height`, `--culi-toolbar-icon`), which is what lets the
 * mobile override be two declarations rather than a copy of every rule, and
 * the selectors that use them are two classes deep on purpose: that is the
 * specificity it takes to beat the app's own button styling.
 *
 * Stateless, like the toolbars it replaced: it is handed the current state and
 * calls back with what was pressed.
 */
import { setIcon } from 'obsidian';
import { debounce } from '../shared/debounce';

/** How long after the last keystroke a search calls back. */
const SEARCH_DELAY_MS = 200;

/** The row itself. Search on the left, actions on the right. */
export function toolbarRow(container: HTMLElement, extra?: string[]): HTMLElement {
  return container.createDiv({ cls: ['culi-toolbar', ...(extra ?? [])] });
}

/** The right-hand group. Its own element so the buttons stay together when the row wraps. */
export function toolbarActions(bar: HTMLElement): HTMLElement {
  return bar.createDiv({ cls: 'culi-toolbar-actions' });
}

export interface ToolbarSearchOptions {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * A search field with the magnifier inside it.
 *
 * `type: 'search'` for the clear button the platform draws, and the padding
 * that keeps the text off the icon lives in the stylesheet rather than here,
 * where the two-class selector can outrank the app's own input styling.
 */
export function toolbarSearch(bar: HTMLElement, options: ToolbarSearchOptions): HTMLInputElement {
  const wrap = bar.createDiv({ cls: 'culi-toolbar-search-wrap' });
  setIcon(wrap.createSpan({ cls: 'culi-toolbar-search-icon' }), 'search');

  const input = wrap.createEl('input', {
    cls: 'culi-toolbar-search',
    attr: { type: 'search', placeholder: options.placeholder },
  });
  input.value = options.value;
  input.addEventListener(
    'input',
    debounce(() => options.onChange(input.value), SEARCH_DELAY_MS)
  );

  return input;
}

/** Where a caller finds its own search field again after a repaint. */
export const TOOLBAR_SEARCH_SELECTOR = '.culi-toolbar-search';

export interface ToolbarIconButtonOptions {
  icon: string;
  /** Read out instead of a label, since the button carries none. */
  label: string;
  /** The control is open, e.g. a filter panel below it. */
  active?: boolean;
  /** The control is doing something, e.g. filters are set while the panel is shut. */
  marked?: boolean;
  onClick: (event: MouseEvent) => void;
}

/**
 * A square button that is only an icon: a view control rather than an action.
 *
 * The icon goes in a span rather than straight into the button, which looks
 * like a wasted element and is not: `setIcon()` on the button itself renders
 * nothing on iOS, while the same call on a child span renders everywhere. The
 * labelled button below has always wrapped its icon and has always drawn it,
 * on every platform; this is the same shape for the same reason.
 */
export function toolbarIconButton(
  actions: HTMLElement,
  options: ToolbarIconButtonOptions
): HTMLButtonElement {
  const button = actions.createEl('button', {
    cls: 'culi-toolbar-icon-btn',
    attr: { 'aria-label': options.label },
  });
  button.toggleClass('culi-is-active', options.active === true);
  // A separate class from "open": a collapsed panel still has to advertise
  // that what is in front of somebody is not everything.
  button.toggleClass('culi-has-active-filters', options.marked === true);

  setIcon(button.createSpan({ cls: 'culi-icon-slot' }), options.icon);
  button.addEventListener('click', options.onClick);

  return button;
}

export interface ToolbarButtonOptions {
  icon: string;
  label: string;
  onClick: () => void;
}

/**
 * A labelled button: something that writes a note rather than changing what is
 * on screen.
 *
 * Labelled where the icon-only ones are not, and that difference is the point:
 * a row where every control looked alike would give the same weight to "sort
 * this list" and "create an order".
 */
export function toolbarButton(
  actions: HTMLElement,
  options: ToolbarButtonOptions
): HTMLButtonElement {
  const button = actions.createEl('button', { cls: 'culi-toolbar-btn' });
  setIcon(button.createSpan({ cls: 'culi-icon-slot' }), options.icon);
  button.createSpan({ text: options.label });
  button.addEventListener('click', options.onClick);

  return button;
}

/** The panel a filter button opens, under the row rather than inside it. */
export function toolbarPanel(container: HTMLElement): HTMLElement {
  return container.createDiv({ cls: 'culi-toolbar-panel' });
}

/**
 * One dropdown, or nothing at all when it has nothing to distinguish.
 *
 * **A control that cannot change the list is worse than an absent one**: it
 * reads as broken rather than as empty, and no state of the data makes it
 * work. A dropdown earns its place when picking one of its options would leave
 * something out, which is true in exactly two cases: there is more than one
 * option, or there is one and some rows state none.
 *
 * The exception is a filter that is currently set. Hiding that one would leave
 * the list narrowed with no way to widen it again, which is the failure this
 * rule exists to prevent rather than to cause.
 */
export function toolbarSelect(
  panel: HTMLElement,
  options: {
    allLabel: string;
    values: string[];
    /** True when some row states none of these, which is what makes one option enough. */
    someStateNone?: boolean;
    selected: string | null;
    onPick: (value: string | null) => void;
  }
): void {
  const { allLabel, values, selected, onPick } = options;

  // A value the data no longer offers, but the state still holds, is added back
  // rather than dropped: otherwise the dropdown reads "All" while the list is
  // in fact narrowed to an empty one.
  const choices = selected && !values.includes(selected) ? [...values, selected] : values;
  if (choices.length === 0) return;
  if (choices.length === 1 && options.someStateNone !== true && !selected) return;

  const select = panel.createEl('select', { cls: 'culi-toolbar-select' });
  for (const entry of [
    { value: '', label: allLabel },
    ...choices.map((value) => ({ value, label: value })),
  ]) {
    const option = select.createEl('option', { value: entry.value, text: entry.label });
    if (entry.value === (selected ?? '')) option.selected = true;
  }
  select.addEventListener('change', () => onPick(select.value || null));
}

export function toolbarToggle(
  panel: HTMLElement,
  label: string,
  checked: boolean,
  onToggle: (value: boolean) => void
): void {
  const wrapper = panel.createEl('label', { cls: 'culi-toolbar-toggle' });
  const input = wrapper.createEl('input', { attr: { type: 'checkbox' } });
  input.checked = checked;
  wrapper.createSpan({ text: label });
  input.addEventListener('change', () => onToggle(input.checked));
}

/** The panel's own footer: clear the filters, or put the panel away. */
export function toolbarPanelFooter(panel: HTMLElement): HTMLElement {
  return panel.createDiv({ cls: 'culi-toolbar-panel-footer' });
}

export function toolbarPanelButton(
  footer: HTMLElement,
  options: { icon: string; label?: string; ariaLabel?: string; onClick: () => void }
): void {
  const button = footer.createEl('button', {
    cls: 'culi-toolbar-panel-btn',
    attr: options.ariaLabel ? { 'aria-label': options.ariaLabel } : {},
  });
  setIcon(button.createSpan(), options.icon);
  if (options.label) button.createSpan({ text: options.label });
  button.addEventListener('click', options.onClick);
}
