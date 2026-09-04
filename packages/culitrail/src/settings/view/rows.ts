/**
 * The row shapes the settings tab is built from.
 *
 * Thin wrappers over Obsidian's `Setting`, and deliberately so: they exist to
 * make the eight tab modules read as a list of what each setting *is* rather
 * than as a wall of builder chains, not to reinvent the widget.
 *
 * Every one of them saves on change. There is no Apply button anywhere in
 * this plugin, so a row that only wrote to the settings object would look
 * like it worked and be gone on reload.
 */
import { Setting, setIcon } from 'obsidian';

export interface RowContext {
  save: () => Promise<void>;
  /** Rebuilds the tab. For a setting whose value changes which other rows exist. */
  refresh: () => void;
}

export interface RowOptions {
  name: string;
  desc?: string;
  placeholder?: string;
}

/** A section heading inside a tab, with an optional paragraph under it. */
export function section(container: HTMLElement, title: string, description?: string): void {
  new Setting(container).setName(title).setHeading();
  if (description) {
    container.createEl('p', { cls: 'culi-settings-note', text: description });
  }
}

export function textRow(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  get: () => string,
  set: (value: string) => void
): Setting {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addText((text) => {
    if (options.placeholder) text.setPlaceholder(options.placeholder);
    text.setValue(get()).onChange((value) => {
      set(value);
      void context.save();
    });
  });

  return setting;
}

/**
 * A multi-line field.
 *
 * Used for the two settings whose value is a list a person edits as text: the
 * GI dictionary and the extra meal folders. A row per entry would be a
 * better editor for three entries and a much worse one for forty.
 */
export function textAreaRow(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  get: () => string,
  set: (value: string) => void
): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addTextArea((area) => {
    area.inputEl.addClass('culi-settings-textarea');
    area.inputEl.rows = 6;
    area.setValue(get()).onChange((value) => {
      set(value);
      void context.save();
    });
  });
}

/** A list of strings, edited one per line. Blank lines are dropped on the way in. */
export function linesRow(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  get: () => string[],
  set: (value: string[]) => void
): void {
  textAreaRow(
    container,
    context,
    options,
    () => get().join('\n'),
    (value) =>
      set(
        value
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '')
      )
  );
}

export function toggleRow(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions & { refreshOnChange?: boolean },
  get: () => boolean,
  set: (value: boolean) => void
): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addToggle((toggle) =>
    toggle.setValue(get()).onChange((value) => {
      set(value);
      void context.save();
      // Only where a toggle decides whether other rows exist. Repainting on
      // every toggle would move the scroll position under the cursor.
      if (options.refreshOnChange) context.refresh();
    })
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export function dropdownRow<T extends string>(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  choices: Choice<T>[],
  get: () => T,
  set: (value: T) => void
): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addDropdown((dropdown) => {
    for (const choice of choices) dropdown.addOption(choice.value, choice.label);
    dropdown.setValue(get()).onChange((value) => {
      set(value as T);
      void context.save();
    });
  });
}

/**
 * A number chosen from a fixed set.
 *
 * A dropdown rather than a slider even for the numeric ones, because the
 * allowed values are a list rather than a range: the activity range is 1, 2,
 * 4, 8 or 12 weeks, and a slider would offer 3, 5, 6 and 7 as well.
 */
export function numberChoiceRow<T extends number>(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  values: readonly T[],
  format: (value: T) => string,
  get: () => T,
  set: (value: T) => void
): void {
  dropdownRow(
    container,
    context,
    options,
    values.map((value) => ({ value: String(value), label: format(value) })),
    () => String(get()),
    (value) => set(Number(value) as T)
  );
}

/** A ratio between two bounds, shown as a percentage. */
export function sliderRow(
  container: HTMLElement,
  context: RowContext,
  options: RowOptions,
  bounds: { min: number; max: number; step: number },
  get: () => number,
  set: (value: number) => void
): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  // No `setDynamicTooltip()`: Obsidian shows the value inline beside the
  // slider now, and asking for the tooltip as well is deprecated.
  setting.addSlider((slider) =>
    slider
      .setLimits(bounds.min, bounds.max, bounds.step)
      .setValue(get())
      .onChange((value) => {
        set(value);
        void context.save();
      })
  );
}

/**
 * A titled group of rows.
 *
 * Returns the element the rows go into rather than taking them as an argument,
 * so a section can put a paragraph, a card and a second card under one heading
 * without this helper knowing about any of it.
 */
export function sectionCard(
  container: HTMLElement,
  title?: string,
  description?: string
): HTMLElement {
  if (title) new Setting(container).setName(title).setHeading();
  if (description) container.createEl('p', { cls: 'culi-settings-note', text: description });
  return container.createDiv({ cls: 'culi-settings-card' });
}

export interface NavRowOptions {
  name: string;
  desc?: string;
  /** The right-hand summary, e.g. "83 keys". What is in there, before you go. */
  value?: string;
  open: () => void;
}

/**
 * A row that opens a sub-page.
 *
 * The whole row is the target rather than a button at the end of it: a row
 * with a chevron reads as a place to go, and gets clicked anywhere along its
 * width. Keyboard users get the same through `role="button"` and the two keys
 * a button answers to.
 */
export function navRow(container: HTMLElement, options: NavRowOptions): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.settingEl.addClass('culi-settings-nav-row');
  setting.settingEl.setAttr('role', 'button');
  setting.settingEl.setAttr('tabindex', '0');

  if (options.value) {
    setting.controlEl.createSpan({ cls: 'culi-settings-nav-value', text: options.value });
  }
  setIcon(setting.controlEl.createSpan({ cls: 'culi-settings-nav-chevron' }), 'chevron-right');

  setting.settingEl.addEventListener('click', () => options.open());
  setting.settingEl.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    options.open();
  });
}

export interface RowLink {
  label: string;
  href: string;
  /** A lucide icon name, drawn before the label. */
  icon?: string;
}

/**
 * A row whose controls are links out of Obsidian.
 *
 * Anchors dressed as buttons rather than buttons that open a window: an anchor
 * is what a link is, it says where it goes on hover, and it can be opened
 * however the reader prefers.
 */
export function linkRow(container: HTMLElement, options: RowOptions, links: RowLink[]): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  for (const link of links) {
    const anchor = setting.controlEl.createEl('a', {
      cls: 'culi-settings-link-button',
      href: link.href,
      attr: { target: '_blank', rel: 'noopener' },
    });
    if (link.icon) setIcon(anchor.createSpan({ cls: 'culi-settings-link-icon' }), link.icon);
    anchor.createSpan({ text: link.label });
  }
}

/** A row whose control is a button that does something inside Obsidian. */
export function buttonRow(
  container: HTMLElement,
  options: RowOptions & { button: string; onClick: () => void }
): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);
  setting.addButton((button) => button.setButtonText(options.button).onClick(options.onClick));
}

/**
 * A filter box over rows that have already been drawn.
 *
 * It searches the page rather than the settings object, which is why it can be
 * one helper rather than a field in every catalogue: a `Setting` puts its name
 * in a known element, so matching is a walk over what is on screen. A card
 * whose rows all hide hides too, or the page would be a column of headings
 * with nothing under them.
 */
export function filterRow(container: HTMLElement, options: RowOptions, scope: HTMLElement): void {
  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addText((text) => {
    if (options.placeholder) text.setPlaceholder(options.placeholder);
    text.onChange((value) => applyFilter(scope, value));
    text.inputEl.addClass('culi-settings-filter');
  });
}

function applyFilter(scope: HTMLElement, query: string): void {
  const needle = query.trim().toLowerCase();

  for (const group of Array.from(scope.querySelectorAll<HTMLElement>('.culi-settings-group'))) {
    let shown = 0;

    for (const row of Array.from(group.querySelectorAll<HTMLElement>('.setting-item'))) {
      const name = row.querySelector('.setting-item-name')?.textContent ?? '';
      const value = row.querySelector('input')?.value ?? '';
      const hit =
        needle === '' ||
        name.toLowerCase().includes(needle) ||
        value.toLowerCase().includes(needle);
      row.toggleClass('culi-is-hidden', !hit);
      if (hit) shown += 1;
    }

    group.toggleClass('culi-is-hidden', shown === 0);
  }
}
