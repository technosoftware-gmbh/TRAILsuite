/**
 * What opens, and when.
 *
 * The dashboard, the ribbon icons and the three views that can open
 * themselves. They were spread over three tabs, one auto-open row per tab,
 * each one filed under the feature it opens rather than under the thing they
 * all are: a preference about what Obsidian does when you click something.
 */
import { t } from '../../../lang/I18nManager';
import type { DashboardActivityRangeWeeks } from '../../types';
import { numberChoiceRow, sectionCard, toggleRow } from '../rows';
import type { SettingsTabContext } from '../settings-tab';

const ACTIVITY_RANGES: readonly DashboardActivityRangeWeeks[] = [1, 2, 4, 8, 12];

export function renderBrowsingSection(container: HTMLElement, context: SettingsTabContext): void {
  const { settings } = context;

  const dashboard = sectionCard(container, t('settings.library.browsing'));

  toggleRow(
    dashboard,
    context,
    {
      name: t('settings.library.enableDashboard'),
      desc: t('settings.library.enableDashboardDesc'),
    },
    () => settings.enableDashboard,
    (value) => (settings.enableDashboard = value)
  );
  toggleRow(
    dashboard,
    context,
    { name: t('settings.library.showRibbonIcons') },
    () => settings.showRibbonIcons,
    (value) => (settings.showRibbonIcons = value)
  );
  numberChoiceRow(
    dashboard,
    context,
    {
      name: t('settings.library.dashboardActivityRange'),
      desc: t('settings.library.dashboardActivityRangeDesc'),
    },
    ACTIVITY_RANGES,
    (value) => t('settings.library.weeks').replace('{count}', String(value)),
    () => settings.dashboardActivityRangeWeeks,
    (value) => (settings.dashboardActivityRangeWeeks = value)
  );
  toggleRow(
    dashboard,
    context,
    {
      name: t('settings.library.openGalleryOnFolderClick'),
      desc: t('settings.library.openGalleryOnFolderClickDesc'),
      // The subfolder row only means anything when this is on.
      refreshOnChange: true,
    },
    () => settings.openGalleryOnFolderClick,
    (value) => (settings.openGalleryOnFolderClick = value)
  );
  if (settings.openGalleryOnFolderClick) {
    toggleRow(
      dashboard,
      context,
      {
        name: t('settings.library.openGalleryOnFolderClickSubfolders'),
        desc: t('settings.library.openGalleryOnFolderClickSubfoldersDesc'),
      },
      () => settings.openGalleryOnFolderClickSubfolders,
      (value) => (settings.openGalleryOnFolderClickSubfolders = value)
    );
  }

  const views = sectionCard(container, t('settings.views.title'), t('settings.views.intro'));

  toggleRow(
    views,
    context,
    {
      name: t('settings.library.autoOpenMealView'),
      desc: t('settings.library.autoOpenMealViewDesc'),
    },
    () => settings.autoOpenMealView,
    (value) => (settings.autoOpenMealView = value)
  );
  toggleRow(
    views,
    context,
    { name: t('settings.planning.autoOpenMealPlanView') },
    () => settings.autoOpenMealPlanView,
    (value) => (settings.autoOpenMealPlanView = value)
  );
  toggleRow(
    views,
    context,
    {
      name: t('settings.orders.autoOpenOrderView'),
      desc: t('settings.orders.autoOpenOrderViewDesc'),
    },
    () => settings.autoOpenOrderView,
    (value) => (settings.autoOpenOrderView = value)
  );
  toggleRow(
    views,
    context,
    {
      name: t('settings.orders.autoOpenDeliveryView'),
      desc: t('settings.orders.autoOpenDeliveryViewDesc'),
    },
    () => settings.autoOpenDeliveryView,
    (value) => (settings.autoOpenDeliveryView = value)
  );
}
