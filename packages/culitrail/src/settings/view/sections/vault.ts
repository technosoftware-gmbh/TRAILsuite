/**
 * The Vault setup section: where the notes are, what their fields are called,
 * and whether any of that is currently working.
 *
 * Three rows and a diagnostic block. The two long lists are pages of their
 * own; what stays here is the count of what each setting currently matches,
 * because a vault whose folders or type values do not line up sees an empty
 * gallery, an empty dashboard and an empty suggester, all without an error.
 */
import { t } from '../../../lang/I18nManager';
import { FOLDER_COUNT } from '../pages/folders';
import { PROPERTY_KEY_COUNT } from '../pages/property-keys';
import { navRow, sectionCard } from '../rows';
import { renderAdoptionRow, renderStatusRows, statusFor } from '../status-row';
import type { SettingsTabContext } from '../settings-tab';

/** The sub-page ids this section drills into. Shared with `settings-tab.ts`. */
export const FOLDERS_PAGE_ID = 'folders';
export const PROPERTY_KEYS_PAGE_ID = 'property-keys';

export function renderVaultSection(
  container: HTMLElement,
  context: SettingsTabContext,
  open: (pageId: string) => void
): void {
  const { app, settings } = context;

  const card = sectionCard(container, t('settings.vault.title'), t('settings.vault.intro'));

  navRow(card, {
    name: t('settings.vault.folders.name'),
    desc: t('settings.vault.folders.desc'),
    value: t('settings.vault.folders.value', { count: FOLDER_COUNT }),
    open: () => open(FOLDERS_PAGE_ID),
  });

  navRow(card, {
    name: t('settings.vault.properties.name'),
    desc: t('settings.vault.properties.desc'),
    // Whether the names can be typed into is the one thing about that page
    // worth knowing before opening it: it is why a field there refuses input.
    value: settings.unlockPropertyNames
      ? t('settings.vault.properties.valueUnlocked', { count: PROPERTY_KEY_COUNT })
      : t('settings.vault.properties.valueLocked', { count: PROPERTY_KEY_COUNT }),
    open: () => open(PROPERTY_KEYS_PAGE_ID),
  });

  const status = sectionCard(container, t('settings.status.title'), t('settings.status.note'));
  renderStatusRows(status, [
    statusFor(app, settings, 'meal', t('settings.status.meals')),
    statusFor(app, settings, 'mealPlan', t('settings.status.mealPlans')),
    statusFor(app, settings, 'order', t('settings.status.orders')),
    statusFor(app, settings, 'delivery', t('settings.status.deliveries')),
    statusFor(app, settings, 'person', t('settings.status.people')),
    statusFor(app, settings, 'company', t('settings.status.companies')),
  ]);
  renderAdoptionRow(status, context.foreignImport);
}
