/**
 * The rows that name something in the vault, and the switch that guards them.
 *
 * A folder setting and a property setting look identical on the page and are
 * not remotely the same thing to get wrong. Repointing `mealsFolder` moves
 * where the plugin looks, and the notes are still there when it looks in the
 * right place again. Renaming `dietProperty` changes what the plugin asks each
 * note for, and every note that carries the old name stops answering: the diet
 * filter offers nothing, the gallery empties, and nothing anywhere reports an
 * error, because a property no note has is not an error. Nothing is migrated,
 * because a settings row cannot know whether the name it was handed is a
 * correction of a typo or a vault it is being pointed at.
 *
 * They stay editable - both plugins share the CRM notes and have to agree on
 * what the type property is called, and a vault that had meal notes before
 * CULItrail existed has its own spelling - but they are read-only until
 * somebody turns the switch on, which is the difference between a change you
 * chose and a change you made while looking at something else.
 */
import { Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { textRow, toggleRow, type RowOptions } from './rows';
import type { SettingsTabContext } from './settings-tab';

/**
 * The switch, at the top of each tab that has any of these rows.
 *
 * One setting shown in four places rather than four settings: the rows it
 * governs are spread over four tabs, and a switch reachable only from the
 * Library tab would mean leaving the row you are trying to edit to find it.
 * Flipping it anywhere repaints that tab, so the fields it just unlocked are
 * editable without a further click.
 */
export function propertyNameLockRow(container: HTMLElement, context: SettingsTabContext): void {
  toggleRow(
    container,
    context,
    {
      name: t('settings.propertyNames.unlock'),
      desc: t('settings.propertyNames.unlockDesc'),
      refreshOnChange: true,
    },
    () => context.settings.unlockPropertyNames,
    (value) => (context.settings.unlockPropertyNames = value)
  );
}

/**
 * A row naming a frontmatter property, a field inside one, or a type value.
 *
 * Unlocked it is an ordinary text row. Locked it still shows the value, because
 * "which property does this read?" is the question these rows answer most
 * often, and hiding the answer to protect it would be a poor trade. The input
 * is disabled rather than replaced by text so the row keeps its shape, and the
 * hint is on the field rather than in a sentence under every one of the
 * seventy-odd rows, which would have turned four tabs into a warning label.
 */
export function identifierRow(
  container: HTMLElement,
  context: SettingsTabContext,
  options: RowOptions,
  get: () => string,
  set: (value: string) => void
): Setting {
  if (context.settings.unlockPropertyNames) {
    return textRow(container, context, options, get, set);
  }

  const setting = new Setting(container).setName(options.name);
  if (options.desc) setting.setDesc(options.desc);

  setting.addText((text) => {
    text.setValue(get());
    text.setDisabled(true);
    text.inputEl.setAttr('title', t('settings.propertyNames.locked'));
    text.inputEl.setAttr('aria-label', t('settings.propertyNames.locked'));
  });

  return setting;
}
