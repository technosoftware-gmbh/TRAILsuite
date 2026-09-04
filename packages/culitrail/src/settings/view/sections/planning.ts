/**
 * The meal plan and the eating history it feeds.
 *
 * The plan's own property names, and the nine sub-keys inside one plan entry,
 * are on the property-keys page. What is here is the behaviour: whether the
 * history is written at all, and what its heading says.
 */
import { t } from '../../../lang/I18nManager';
import { sectionCard, textRow, toggleRow } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

export function renderPlanningSection(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const history = sectionCard(
    container,
    t('settings.planning.eatingHistory'),
    t('settings.planning.eatingHistoryNote')
  );

  toggleRow(
    history,
    context,
    { name: t('settings.planning.eatingHistoryEnabled'), refreshOnChange: true },
    () => settings.eatingHistoryEnabled,
    (value) => (settings.eatingHistoryEnabled = value)
  );

  if (settings.eatingHistoryEnabled) {
    textRow(
      history,
      context,
      { name: t('settings.planning.eatingHistoryHeading') },
      () => settings.eatingHistoryHeading,
      (value) => (settings.eatingHistoryHeading = value)
    );
  }
}
