/**
 * The Vault setup section: the three things a fresh install has to get right,
 * and nothing else.
 *
 * Both of the long lists this used to hold inline -- thirteen folders and
 * forty-one property names -- are sub-pages now, behind a row that says how
 * many are in there. What is left is a section somebody can read in one
 * glance and leave alone for years, which is what these settings actually
 * are: set when a vault is adopted, then never touched again.
 *
 * The file keeps its name because the health check at the bottom, the folders
 * and the property keys are one subject -- where the notes are and what they
 * are called -- and splitting them across three files would only mean three
 * places to look for the same section.
 */
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { FOLDER_COUNT } from './page-folders';
import { PROPERTY_KEY_COUNT } from './page-property-keys';
import { buttonRow, navRow, sectionCard } from './rows';

/** The sub-page ids this section drills into. Shared with `settings-tab.ts`. */
export const FOLDERS_PAGE_ID = 'folders';
export const PROPERTY_KEYS_PAGE_ID = 'property-keys';

export function renderSectionVault(
  containerEl: HTMLElement,
  settings: APERtrailSettings,
  navigate: (pageId: string) => void,
  actions: { openEntityTypeCheck: () => void }
): void {
  const card = sectionCard(containerEl, t('settings.vault.title'), t('settings.vault.intro'));

  navRow(card, {
    name: t('settings.vault.folders.name'),
    desc: t('settings.vault.folders.desc'),
    value: t('settings.vault.folders.value', { count: FOLDER_COUNT }),
    open: () => navigate(FOLDERS_PAGE_ID),
  });

  navRow(card, {
    name: t('settings.vault.properties.name'),
    desc: t('settings.vault.properties.desc'),
    // Whether the names can be typed into is the one thing about that page
    // worth knowing before opening it: it is why a field there refuses input.
    value: settings.unlockPropertyNames
      ? t('settings.vault.properties.valueUnlocked', { count: PROPERTY_KEY_COUNT })
      : t('settings.vault.properties.valueLocked', { count: PROPERTY_KEY_COUNT }),
    open: () => navigate(PROPERTY_KEYS_PAGE_ID),
  });

  buttonRow(card, {
    name: t('health.entityTypeCheck.settingName'),
    desc: t('health.entityTypeCheck.settingDesc'),
    button: t('health.entityTypeCheck.settingButton'),
    onClick: () => actions.openEntityTypeCheck(),
  });
}
