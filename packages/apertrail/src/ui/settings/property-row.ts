/**
 * The rows that name something inside a note, and the switch that guards them.
 *
 * A folder row and a property row are the same `Setting` with the same text
 * box, and the difference only shows up afterwards. Repointing a folder moves
 * where the plugin looks, and every note is found again the moment it points
 * somewhere real. Renaming a property changes what the plugin asks each note
 * for, and every note carrying the old name stops answering: a trip loses its
 * dates, a place loses its coordinates, with no error anywhere, because a
 * property no note has is not an error. Nothing is migrated, because a
 * settings row cannot tell a corrected typo from a vault it is being aimed at.
 *
 * They stay settings -- both plugins share the CRM notes and have to agree on
 * what the type property is called, and a vault that had travel notes before
 * APERtrail existed has its own spelling -- but they are read-only until
 * somebody turns the switch on, which is the difference between a change you
 * chose and a change you made while looking at something else.
 *
 * Every such row on the page goes through here, so the guard sits in one place
 * rather than in fifty. `tests/property-name-lock.test.ts` enforces that.
 */
import { Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';

/**
 * The switch, at the top of the property-keys page and nowhere else.
 *
 * It used to sit on the page that held the folders as well, where it was a
 * mode an unrelated page was in. Now the rows it governs are all on one page,
 * so it can be the first thing on that page and mean exactly what it says.
 */
export function renderPropertyLockRow(
  containerEl: HTMLElement,
  settings: APERtrailSettings,
  save: () => Promise<void>,
  refresh: () => void
): void {
  new Setting(containerEl)
    .setName(t('settings.properties.unlock.name'))
    .setDesc(t('settings.properties.unlock.desc'))
    .addToggle((toggle) =>
      toggle.setValue(settings.unlockPropertyNames).onChange(async (value) => {
        settings.unlockPropertyNames = value;
        await save();
        // Repainting is what makes the rows it just unlocked editable without
        // a further click; the page is one pass over a settings object, so
        // redrawing it costs nothing worth saving.
        refresh();
      })
    );
}

/**
 * A row naming a frontmatter property, a field inside one, or a type value.
 *
 * Unlocked it is an ordinary text row. Locked it still shows the value,
 * because "which property does this read?" is the question these rows answer
 * most often, and hiding the answer to protect it would be a poor trade. The
 * input is disabled rather than replaced by text so the row keeps its shape,
 * and the hint is on the field rather than in a sentence under every one of
 * the fifty-odd rows, which would have turned the page into a warning label.
 *
 * An emptied field falls back to its previous value rather than saving blank:
 * a property with no name is not a setting anybody meant to make.
 */
export function renderPropertyRow(
  containerEl: HTMLElement,
  settings: APERtrailSettings,
  name: string,
  desc: string,
  value: string,
  onChange: (value: string) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addText((text) => {
      text.setValue(value).onChange(async (raw) => {
        await onChange(raw.trim() || value);
      });
      if (!settings.unlockPropertyNames) {
        text.setDisabled(true);
        text.inputEl.setAttr('title', t('settings.properties.unlock.locked'));
        text.inputEl.setAttr('aria-label', t('settings.properties.unlock.locked'));
      }
    });
}
