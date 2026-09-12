/**
 * The row shapes the settings page is built from.
 *
 * Thin wrappers over Obsidian's `Setting`, so a section module reads as a
 * list of what each row *is* rather than as a wall of builder chains. The
 * two that are not just a wrapper are `navRow()`, which is the whole
 * drill-down mechanic, and `linkRow()`, whose buttons are anchors rather
 * than buttons because they leave Obsidian.
 */
import { Setting, setIcon } from 'obsidian';

/**
 * A titled group of rows.
 *
 * Returns the element the rows go into rather than taking them as an
 * argument, so a section can put a paragraph, a card and a second card under
 * one heading without the helper having to know about any of that.
 */
export function sectionCard(containerEl: HTMLElement, title?: string, intro?: string): HTMLElement {
  if (title) new Setting(containerEl).setName(title).setHeading();
  if (intro) {
    containerEl.createEl('p', { cls: 'apt-settings-intro', text: intro });
  }
  return containerEl.createDiv({ cls: 'apt-settings-card' });
}

/** A paragraph inside a card, for the sentence a row cannot say on its own. */
export function noteLine(containerEl: HTMLElement, text: string): void {
  containerEl.createEl('p', { cls: 'apt-settings-note', text });
}

export interface NavRowOptions {
  name: string;
  desc?: string;
  /** The right-hand summary, e.g. "13 folders". What is in there, before you go. */
  value?: string;
  open: () => void;
}

/**
 * A row that opens a sub-page.
 *
 * The whole row is the target rather than a button at the end of it, because
 * a row with a chevron reads as a place to go and gets clicked anywhere along
 * its width. Keyboard users get the same thing through `role="button"` and
 * the two keys a button answers to.
 */
export function navRow(containerEl: HTMLElement, options: NavRowOptions): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.settingEl.addClass('apt-settings-nav-row');
  setting.settingEl.setAttr('role', 'button');
  setting.settingEl.setAttr('tabindex', '0');

  if (options.value) {
    setting.controlEl.createSpan({ cls: 'apt-settings-nav-value', text: options.value });
  }
  setIcon(setting.controlEl.createSpan({ cls: 'apt-settings-nav-chevron' }), 'chevron-right');

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
  /** Accent styling, for the one link in a row that is the point of it. */
  cta?: boolean;
}

/**
 * A row whose controls are links out of Obsidian.
 *
 * Anchors styled as buttons rather than buttons that open a window: an anchor
 * is what a link is, it says where it goes on hover, and it can be opened in
 * whatever way the reader prefers.
 */
export function linkRow(
  containerEl: HTMLElement,
  options: { name: string; desc?: string },
  links: RowLink[]
): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  for (const link of links) {
    const anchor = setting.controlEl.createEl('a', {
      cls: 'apt-settings-link-button',
      href: link.href,
      attr: { target: '_blank', rel: 'noopener' },
    });
    anchor.toggleClass('mod-cta', link.cta === true);
    if (link.icon) setIcon(anchor.createSpan({ cls: 'apt-settings-link-icon' }), link.icon);
    anchor.createSpan({ text: link.label });
  }
}

/** A row whose control is a single button that does something inside Obsidian. */
export function buttonRow(
  containerEl: HTMLElement,
  options: { name: string; desc?: string; button: string; onClick: () => void }
): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);
  setting.addButton((button) => button.setButtonText(options.button).onClick(options.onClick));
}

/** A switch. */
export function toggleRow(
  containerEl: HTMLElement,
  options: { name: string; desc?: string },
  get: () => boolean,
  set: (value: boolean) => Promise<void>
): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);
  setting.addToggle((toggle) => toggle.setValue(get()).onChange((value) => void set(value)));
}

/**
 * A row whose value comes from a fixed vocabulary.
 *
 * Options arrive as [value, label] pairs rather than as a record, because
 * the ORDER is part of the design here: "follow Obsidian" and "auto" belong
 * first, where a reader looking for the default finds it.
 */
export function dropdownRow(
  containerEl: HTMLElement,
  options: { name: string; desc?: string },
  choices: [string, string][],
  get: () => string,
  set: (value: string) => Promise<void>
): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addDropdown((dropdown) => {
    for (const [value, label] of choices) dropdown.addOption(value, label);
    dropdown.setValue(get()).onChange((value) => void set(value));
  });
}

/** A free-text row for a value that is neither a folder nor a property name. */
export function textRow(
  containerEl: HTMLElement,
  options: { name: string; desc?: string; placeholder?: string },
  get: () => string,
  set: (value: string) => Promise<void>
): void {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addText((text) => {
    if (options.placeholder) text.setPlaceholder(options.placeholder);
    text.setValue(get()).onChange((value) => void set(value.trim()));
  });
}
