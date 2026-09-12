/**
 * The small set of elements every NODAtrail surface is built from.
 *
 * Deliberately small. A UI kit that grows a component per screen is a kit
 * nobody reads twice, and the four views here want the same six shapes: a
 * section, a stat, a row, a chip, an empty state and a link to a note.
 *
 * **No `innerHTML`, and no inline styles.** Everything is built with
 * `createEl`/`createDiv`, and every visual state is a class toggled on, which is
 * what keeps `styles.css` the one place the look is decided.
 */
import { setIcon } from 'obsidian';
import { isIconName } from './note-icon';

/**
 * Puts an icon in a slot, whatever kind of icon it turns out to be.
 *
 * `setIcon()` knows Lucide names and silently draws nothing for anything
 * else, which is how a note carrying an emoji ends up with an empty square
 * where its icon should be. Anything that is not shaped like a Lucide name is
 * therefore written as text instead -- one line, and it is the whole reason a
 * note can name its own icon at all. See note-icon.ts.
 */
function drawIcon(slot: HTMLElement, icon: string): void {
  if (isIconName(icon)) {
    setIcon(slot, icon);
    return;
  }
  slot.addClass('nod-icon-text');
  slot.setText(icon);
}

/**
 * A titled block, with an optional action on the right of its header.
 *
 * `iconOnly` drops the word and keeps the meaning: the label becomes the
 * tooltip and the accessible name, exactly as it does for `rowIconAction`. It
 * is for a header that repeats -- PARA draws one per area, so "Edit" appears
 * five or ten times down a screen whose rows say everything else in icons. A
 * section that appears once in a view keeps its word, which is why this is a
 * flag rather than the new behaviour.
 */
export function section(
  parent: HTMLElement,
  title: string,
  action?: { label: string; icon?: string; iconOnly?: boolean; onClick: () => void }
): HTMLElement {
  const wrapper = parent.createDiv({ cls: 'nod-section' });
  const header = wrapper.createDiv({ cls: 'nod-section-header' });
  header.createEl('h3', { cls: 'nod-section-title', text: title });

  if (action) {
    // Only when there is an icon to stand in for it: a button with neither a
    // word nor a picture would be an invisible target.
    const bare = action.iconOnly === true && action.icon !== undefined;
    const button = header.createEl('button', {
      cls: bare ? 'nod-section-action nod-section-action-icon' : 'nod-section-action',
      attr: bare ? { 'aria-label': action.label, title: action.label } : {},
    });
    if (action.icon) setIcon(button.createSpan({ cls: 'nod-icon' }), action.icon);
    if (!bare) button.createSpan({ text: action.label });
    button.addEventListener('click', () => action.onClick());
  }

  return wrapper.createDiv({ cls: 'nod-section-body' });
}

/** One figure with its label. The value is a string because a view has already decided how to render it. */
export function stat(
  parent: HTMLElement,
  label: string,
  value: string,
  tone?: 'warn' | 'good'
): HTMLElement {
  const card = parent.createDiv({ cls: 'nod-stat' });
  card.toggleClass('nod-stat-warn', tone === 'warn');
  card.toggleClass('nod-stat-good', tone === 'good');
  card.createDiv({ cls: 'nod-stat-value', text: value });
  card.createDiv({ cls: 'nod-stat-label', text: label });
  return card;
}

export function statRow(parent: HTMLElement): HTMLElement {
  return parent.createDiv({ cls: 'nod-stat-row' });
}

export interface RowOptions {
  title: string;
  /** The muted line under the title. */
  subtitle?: string;
  /** The right-hand figure or status. */
  trailing?: string;
  trailingTone?: 'warn' | 'good' | 'muted';
  icon?: string;
  onClick?: () => void;
}

/** A clickable line in a list. The whole row is the target, which is what a list of notes should be. */
export function row(parent: HTMLElement, options: RowOptions): HTMLElement {
  const element = parent.createDiv({ cls: 'nod-row' });

  if (options.icon) drawIcon(element.createSpan({ cls: 'nod-row-icon' }), options.icon);

  const text = element.createDiv({ cls: 'nod-row-text' });
  text.createDiv({ cls: 'nod-row-title', text: options.title });
  if (options.subtitle) text.createDiv({ cls: 'nod-row-subtitle', text: options.subtitle });

  if (options.trailing) {
    const trailing = element.createSpan({ cls: 'nod-row-trailing', text: options.trailing });
    trailing.toggleClass('nod-tone-warn', options.trailingTone === 'warn');
    trailing.toggleClass('nod-tone-good', options.trailingTone === 'good');
    trailing.toggleClass('nod-tone-muted', options.trailingTone === 'muted');
  }

  if (options.onClick) {
    element.addClass('nod-row-clickable');
    element.setAttr('role', 'button');
    element.setAttr('tabindex', '0');
    element.addEventListener('click', () => options.onClick?.());
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      options.onClick?.();
    });
  }

  return element;
}

/**
 * A small button at the end of a row.
 *
 * Its click is stopped from reaching the row, which would otherwise open the
 * note instead of doing what the button says.
 */
export function rowAction(parent: HTMLElement, label: string, onClick: () => void): HTMLElement {
  const button = parent.createEl('button', { cls: 'nod-row-action', text: label });
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/**
 * A row action shown as an icon rather than a word.
 *
 * For the actions that repeat on every row of a list -- edit, archive, move,
 * close -- where four words beside every project or task is more text than the
 * project or task itself. The label does not disappear: it becomes the tooltip
 * and the accessible name, so a screen reader and a hover both still say what
 * the button does. That is the whole difference from `rowAction`, which is kept
 * for the actions that appear once or twice in a view and read better as words.
 *
 * **The icon goes in a span inside the button, never on the button.**
 * `setIcon()` aimed at a button element draws nothing at all on an iPad in some
 * contexts, which `tests/icon-slot.test.ts` exists to refuse. The rule there is
 * the shape rather than an explanation, because the mechanism was never pinned
 * down and a child element has never failed.
 */
export function rowIconAction(
  parent: HTMLElement,
  icon: string,
  label: string,
  onClick: () => void
): HTMLElement {
  const button = parent.createEl('button', {
    cls: 'nod-row-action nod-row-action-icon',
    attr: { 'aria-label': label, title: label },
  });
  setIcon(button.createSpan({ cls: 'nod-icon' }), icon);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/** A small labelled pill, for a status or a category. */
export function chip(
  parent: HTMLElement,
  text: string,
  tone?: 'warn' | 'good' | 'muted'
): HTMLElement {
  const element = parent.createSpan({ cls: 'nod-chip', text });
  element.toggleClass('nod-tone-warn', tone === 'warn');
  element.toggleClass('nod-tone-good', tone === 'good');
  element.toggleClass('nod-tone-muted', tone === 'muted');
  return element;
}

/**
 * What a list says when it has nothing to show.
 *
 * Always a sentence rather than a blank space: an empty list and a broken
 * plugin look identical otherwise, which is the single most common reason
 * somebody files a bug against a plugin that is working.
 */
export function emptyState(parent: HTMLElement, text: string): HTMLElement {
  return parent.createDiv({ cls: 'nod-empty', text });
}

/** A checkbox that reports a change. Used by the task rows and nowhere else. */
export function checkbox(
  parent: HTMLElement,
  checked: boolean,
  onChange: (next: boolean) => void
): HTMLInputElement {
  const input = parent.createEl('input', { cls: 'nod-checkbox', type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

/** A row of buttons across the top of a view. */
export function toolbar(parent: HTMLElement): HTMLElement {
  return parent.createDiv({ cls: 'nod-toolbar' });
}

export function toolbarButton(
  parent: HTMLElement,
  label: string,
  icon: string,
  onClick: () => void
): HTMLElement {
  const button = parent.createEl('button', { cls: 'nod-toolbar-button' });
  setIcon(button.createSpan({ cls: 'nod-icon' }), icon);
  button.createSpan({ text: label });
  button.addEventListener('click', () => onClick());
  return button;
}

/** A set of tabs. Returns the body element the active tab renders into. */
export function tabs(
  parent: HTMLElement,
  labels: readonly string[],
  active: number,
  onSelect: (index: number) => void
): HTMLElement {
  const strip = parent.createDiv({ cls: 'nod-tabs' });

  labels.forEach((label, index) => {
    const tab = strip.createEl('button', { cls: 'nod-tab', text: label });
    tab.toggleClass('nod-tab-active', index === active);
    tab.addEventListener('click', () => onSelect(index));
  });

  return parent.createDiv({ cls: 'nod-tab-body' });
}

export interface CardField {
  label: string;
  value: string;
  icon?: string;
  tone?: 'warn' | 'good' | 'muted';
}

export interface CardAction {
  icon: string;
  /** Named as well as drawn. An icon button with no label is a button nothing can read out. */
  label: string;
  /**
   * The event is passed on because an action may open a menu, and a menu has to
   * appear where the finger was rather than at the corner of the screen.
   */
  onClick: (event: MouseEvent) => void;
}

export interface CardOptions {
  /** Drawn before the name. Optional: a card without one simply opens with its name, as they all did. */
  icon?: string;
  /** The thing this record is about: a company, a counterparty, a description. */
  name: string;
  /** The muted identifier beside it: an invoice reference, a payment reference. */
  id?: string | null;
  fields: readonly CardField[];
  chips?: readonly { text: string; tone?: 'warn' | 'good' | 'muted' }[];
  actions?: readonly CardAction[];
  onClick?: () => void;
}

/**
 * A record as a card: what it is about, then its figures as labelled fields.
 *
 * The shape `row()` could not carry. A row has one title, one subtitle and one
 * trailing figure, so anything with four or five figures had to pack them into
 * a subtitle joined by dashes, and the reader had to know by position which
 * dash-separated date was the due one. Here each figure says what it is.
 *
 * Wraps rather than truncates: on a narrow screen the fields flow onto a second
 * line and stay readable, where a row's packed subtitle would be cut off in the
 * middle of whichever figure happened to be last.
 */
export function card(parent: HTMLElement, options: CardOptions): HTMLElement {
  const element = parent.createDiv({ cls: 'nod-card' });

  const head = element.createDiv({ cls: 'nod-card-head' });
  if (options.icon) drawIcon(head.createSpan({ cls: 'nod-card-icon' }), options.icon);
  head.createSpan({ cls: 'nod-card-name', text: options.name });
  if (options.id) head.createSpan({ cls: 'nod-card-id', text: `#${options.id}` });

  if (options.actions?.length) {
    const actions = head.createDiv({ cls: 'nod-card-actions' });
    for (const action of options.actions) {
      const button = actions.createEl('button', { cls: 'nod-card-action' });
      setIcon(button.createSpan({ cls: 'nod-icon' }), action.icon);
      // Both, because the two are read in different places: Obsidian draws its
      // own tooltip from `aria-label`, and a screen reader announces it.
      button.setAttr('aria-label', action.label);
      button.setAttr('title', action.label);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        action.onClick(event);
      });
    }
  }

  const meta = element.createDiv({ cls: 'nod-card-meta' });
  for (const field of options.fields) {
    const group = meta.createSpan({ cls: 'nod-card-field' });
    if (field.icon) setIcon(group.createSpan({ cls: 'nod-icon' }), field.icon);
    group.createSpan({ cls: 'nod-card-label', text: field.label });
    const value = group.createSpan({ cls: 'nod-card-value', text: field.value });
    value.toggleClass('nod-tone-warn', field.tone === 'warn');
    value.toggleClass('nod-tone-good', field.tone === 'good');
    value.toggleClass('nod-tone-muted', field.tone === 'muted');
  }
  for (const pill of options.chips ?? []) chip(meta, pill.text, pill.tone);

  if (options.onClick) {
    element.addClass('nod-card-clickable');
    element.setAttr('role', 'button');
    element.setAttr('tabindex', '0');
    element.addEventListener('click', () => options.onClick?.());
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      options.onClick?.();
    });
  }

  return element;
}

/** What a foldable group's header says and does. */
export interface FoldOptions {
  /** The heading, on the left. */
  name: string;
  /**
   * What the group comes to, on the right.
   *
   * Drawn whether the group is open or shut, which is the whole point of
   * folding one: a report read at group level, or a status read as a count,
   * still answers its question with everything under it put away.
   */
  trailing: string;
  folded: boolean;
  onToggle: () => void;
}

/**
 * A group that folds away, and the element its contents go into.
 *
 * The header is the control. A separate chevron button would be a second thing
 * to hit on a tablet, and the row is already the width of the view.
 *
 * The caller decides what folding means for its own contents: this draws the
 * header unconditionally and hands back the wrapper, and the caller guards
 * whatever it puts inside. Nothing is remembered here, because what is folded
 * is the view's state and every view keys it differently.
 */
export function foldableGroup(parent: HTMLElement, options: FoldOptions): HTMLElement {
  const wrapper = parent.createDiv({ cls: 'nod-fold' });

  const header = wrapper.createEl('button', { cls: 'nod-fold-header' });
  header.setAttr('type', 'button');
  header.setAttr('aria-expanded', String(!options.folded));
  setIcon(
    header.createSpan({ cls: 'nod-fold-chevron' }),
    options.folded ? 'chevron-right' : 'chevron-down'
  );
  header.createSpan({ cls: 'nod-fold-name', text: options.name });
  header.createSpan({ cls: 'nod-fold-trailing', text: options.trailing });
  header.addEventListener('click', options.onToggle);

  return wrapper;
}

/** A row of controls that narrow what is below it. */
export function filterBar(parent: HTMLElement): HTMLElement {
  return parent.createDiv({ cls: 'nod-filter-bar' });
}

/**
 * A labelled dropdown in a filter bar.
 *
 * The label sits above rather than beside, so a row of four does not become a
 * row of eight competing widths, and every option is a `[value, label]` pair so
 * the value stays the vocabulary and the label stays translated.
 */
export function filterSelect(
  bar: HTMLElement,
  name: string,
  choices: readonly [string, string][],
  value: string,
  onChange: (value: string) => void
): void {
  const field = bar.createDiv({ cls: 'nod-filter-field' });
  field.createDiv({ cls: 'nod-filter-label', text: name });
  const select = field.createEl('select', { cls: 'nod-filter-control' });
  for (const [option, label] of choices) select.createEl('option', { value: option, text: label });
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
}

/**
 * The search box.
 *
 * **It reports on every keystroke and the caller redraws below it**, which is
 * why the input is handed back: a view that rebuilt this element would take the
 * cursor with it after the first letter. The same reason `followedText` exists
 * on the forms.
 */
export function filterSearch(
  bar: HTMLElement,
  name: string,
  placeholder: string,
  value: string,
  onChange: (value: string) => void
): HTMLInputElement {
  const field = bar.createDiv({ cls: 'nod-filter-field nod-filter-field-wide' });
  field.createDiv({ cls: 'nod-filter-label', text: name });
  const input = field.createEl('input', { cls: 'nod-filter-control', type: 'search' });
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  return input;
}
