/**
 * The row shapes every editor in this plugin uses, in one place.
 *
 * Obsidian's `Setting` is the idiom the trip editor, the ship's editor and
 * the photo spot editors were built in, and the note cover's dialog with
 * them. The three editors that grew out of creation dialogs built their
 * fields by hand instead, which was fine while those dialogs were three
 * fields long and stopped being fine the moment the cover's own rows had to
 * sit beside them: one dialog cannot hold two idioms without looking like a
 * mistake.
 *
 * So these are thin: a `Setting`, a control, a callback. They exist to keep
 * five editors saying the same thing the same way rather than to abstract
 * anything.
 */
import { Setting } from 'obsidian';
import { LinkSelectOptions, renderLinkSelect } from './link-select';

export function textRow(
  container: HTMLElement,
  options: {
    label: string;
    description?: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  }
): void {
  const setting = new Setting(container).setName(options.label);
  if (options.description) setting.setDesc(options.description);
  setting.addText((input) => {
    if (options.placeholder) input.setPlaceholder(options.placeholder);
    input.setValue(options.value).onChange(options.onChange);
  });
}

/** A row whose control names another note, with the way out when that note does not exist yet. */
export function linkRow(
  container: HTMLElement,
  options: LinkSelectOptions & { label: string; description?: string }
): void {
  const setting = new Setting(container).setName(options.label);
  if (options.description) setting.setDesc(options.description);
  renderLinkSelect(setting.controlEl, options);
}
