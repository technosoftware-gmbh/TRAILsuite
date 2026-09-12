/**
 * The rows that name something inside a note, and the switch that guards them.
 *
 * A folder row and a property row are the same `Setting` with the same text
 * box, and the difference only shows up afterwards. Repointing a folder moves
 * where the plugin looks, and every note is found again the moment it points
 * somewhere real. Renaming a property changes what the plugin asks each note
 * for, and every note carrying the old name stops answering, with no error
 * anywhere, because a property no note has is not an error. Nothing is
 * migrated, because a settings row cannot tell a corrected typo from a vault it
 * is being aimed at.
 *
 * They stay settings, because three plugins share the CRM notes and have to
 * agree what the type property is called, and because this vault had areas and
 * projects long before NODAtrail existed and spells them its own way. But they
 * are read only until somebody turns the switch on, which is the difference
 * between a change you chose and a change you made while looking at something
 * else.
 *
 * **Every such row goes through here**, so the guard is in one place rather
 * than in a hundred. `tests/property-name-lock.test.ts` enforces that by the
 * shape of the setting's name rather than by a list, so the next one somebody
 * adds inline is caught without anybody remembering.
 */
import { Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { NODAtrailSettings } from '../../settings/types';

/** The switch, at the top of the property-keys page and nowhere else. */
export function renderPropertyLockRow(
  containerEl: HTMLElement,
  settings: NODAtrailSettings,
  save: () => Promise<void>,
  refresh: () => void
): void {
  new Setting(containerEl)
    .setName(t('settings.properties.unlock'))
    .setDesc(t('settings.properties.unlockDesc'))
    .addToggle((toggle) =>
      toggle.setValue(settings.unlockPropertyNames).onChange(async (value) => {
        settings.unlockPropertyNames = value;
        await save();
        // Repainting is what makes the rows it just unlocked editable without a
        // further click. The page is one pass over a settings object, so
        // redrawing it costs nothing worth saving.
        refresh();
      })
    );
}

/**
 * A row naming a frontmatter property, a field inside one, or a type value.
 *
 * Locked it still shows the value, because "which property does this read?" is
 * the question these rows answer most often and hiding the answer to protect it
 * would be a poor trade. The input is disabled rather than replaced by text so
 * the row keeps its shape, and the hint is on the field rather than in a
 * sentence under every one of a hundred rows, which would turn the page into a
 * warning label.
 *
 * An emptied field falls back to its previous value rather than saving blank: a
 * property with no name is not a setting anybody meant to make. The two stamp
 * properties are the deliberate exception and are edited through
 * `renderClearablePropertyRow` below.
 */
export function renderPropertyRow(
  containerEl: HTMLElement,
  settings: NODAtrailSettings,
  name: string,
  desc: string,
  value: string,
  onChange: (value: string) => Promise<void>
): void {
  renderRow(containerEl, settings, name, desc, value, onChange, false);
}

/**
 * The same, for a property whose blank value means something.
 *
 * `createdProperty` and `modifiedProperty` cleared mean "do not write that
 * stamp", which is a setting somebody can genuinely want, so an emptied field
 * here saves the blank rather than snapping back.
 */
export function renderClearablePropertyRow(
  containerEl: HTMLElement,
  settings: NODAtrailSettings,
  name: string,
  desc: string,
  value: string,
  onChange: (value: string) => Promise<void>
): void {
  renderRow(containerEl, settings, name, desc, value, onChange, true);
}

function renderRow(
  containerEl: HTMLElement,
  settings: NODAtrailSettings,
  name: string,
  desc: string,
  value: string,
  onChange: (value: string) => Promise<void>,
  allowBlank: boolean
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addText((text) => {
      text.setValue(value).onChange(async (raw) => {
        const trimmed = raw.trim();
        await onChange(allowBlank ? trimmed : trimmed || value);
      });

      if (!settings.unlockPropertyNames) {
        text.setDisabled(true);
        text.inputEl.setAttr('title', t('settings.properties.lockedNotice'));
        text.inputEl.setAttr('aria-label', t('settings.properties.lockedNotice'));
      }
    });
}
