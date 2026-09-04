/**
 * The mobile layout: a header, then the tabs a meal actually has.
 *
 * Not a narrower desktop layout. A phone held in one hand while the other is
 * busy needs one thing filling the screen rather than several competing for
 * it, so what a meal has swipes between tabs rather than stacking into columns.
 *
 * **The tab list is built from the note, not fixed.** A meal whose company
 * states no reheating gets one tab rather than an empty one. Info is always
 * present, so there is never a strip with nothing in it.
 */
import { t } from '../../../lang/I18nManager';
import { toPlainText } from '../../../shared/plain-text';
import { createTabStrip } from '../../../ui/tab-strip';
import { isMobileHandledElsewhere } from '../../view-model/time-badges';
import { renderBadgeChips, renderTagRow } from '../badge-row';
import { renderPriceLine } from '../price-line';
import { formatPrice } from '../../view-model/format-price';
import { badgeCells, planBadges } from '../../view-model/badge-display';
import { nutritionRow } from '../../view-model/nutrition-row';
import { renderStatStrip } from '../../../ui/stat-strip';
import { renderBreakdownSection } from '../breakdown-section';
import { nutritionBreakdown } from '../../view-model/nutrition-breakdown';
import { renderReheatingSection } from '../reheating-section';
import { renderEatingHistoryButton } from '../eating-history-button';
import { renderTrailingSectionButtons } from '../trailing-sections';
import { renderWarnings } from '../../safety/view/warning-row';
import { buildWarnings } from '../../safety/warnings';
import type { MealLayoutArgs, MealLayoutRenderer } from './types';
import { renderMobileInfoPanel } from '../mobile/info-panel';
import { renderMobileMealCard } from '../mobile/meal-card';
import { renderMobileActionRow } from '../mobile/action-row';
import { renderMobileStatRow } from '../mobile/stat-row';

/**
 * One tab, and what fills it.
 *
 * A list rather than a call per tab, because the description's "more" link
 * jumps to Info by index and that index depends on which tabs a meal has.
 */
interface TabPlan {
  label: string;
  render: (panel: HTMLElement) => Promise<void>;
}

/**
 * The description snippet above the tabs.
 *
 * Clamped to a couple of lines by CSS, with a link into the Info tab where
 * the whole thing is rendered properly. The link is hidden when the text was
 * not actually clipped, which can only be known after layout.
 */
function renderDescription(args: MealLayoutArgs, onMore: () => void): void {
  const text = toPlainText(args.context.description);
  if (!text) return;

  const block = args.container.createDiv({ cls: 'culi-mobile-desc' });
  block.createSpan({ cls: 'culi-mobile-desc-text', text });

  const more = block.createEl('a', {
    cls: 'culi-mobile-desc-more',
    text: t('meals.mobile.more'),
  });
  more.addEventListener('click', onMore);

  // After the browser has laid the block out: if it did not overflow, there
  // is nothing more to show and the link would be a promise of nothing.
  // Scheduled on the element's own window rather than the global one, so a
  // popped-out pane measures against the window it is actually in.
  block.ownerDocument.defaultView?.requestAnimationFrame(() => {
    if (block.scrollHeight <= block.clientHeight + 2) more.hide();
  });
}

export const renderMobileTabsLayout: MealLayoutRenderer = async (args) => {
  const { container, app, component, deps, context } = args;
  const { file, settings, meta } = context;

  let jumpToInfo = (): void => {
    // Replaced once the tab strip exists. The description is rendered first
    // because it sits above the tabs, so its link is wired before its target
    // is built.
  };
  renderDescription(args, () => jumpToInfo());

  renderMobileMealCard(container, app, meta, context.imageValue);
  renderWarnings(container, buildWarnings(meta.allergens, settings));

  renderTagRow(container, meta.tags, settings);

  // Planned once and rendered in three places, in the order a shop states a
  // dish: what it is, what is in it, then how long it takes.
  //
  // The three time badges and last-made are skipped here. Last-made is on the
  // card above, and the times get a strip of their own rather than joining
  // nutrition, which is where this deliberately differs from the desktop header.
  // Desktop merges them into one row because it has the width for eight columns;
  // seven boxed columns at phone width is 55px each, which wraps a German label
  // to three lines. One classifier decides it, so the strips cannot disagree
  // about which badge is which.
  const badges = planBadges(
    context.frontmatter,
    settings,
    (badge) => isMobileHandledElsewhere(badge, settings),
    new Date(),
    context.eatingHistory
  );
  renderBadgeChips(container, badges);

  const nutrition = nutritionRow(meta, settings);
  if (nutrition) {
    renderStatStrip(
      container,
      nutrition.cells.map((cell) => ({ label: cell.label, value: cell.text })),
      { variant: 'boxed', caption: nutrition.caption }
    );
  }

  renderPriceLine(
    container,
    formatPrice(meta.price, settings.orderDefaultCurrency),
    'culi-header-price'
  );

  renderMobileStatRow(container, meta, settings);
  renderStatStrip(container, badgeCells(badges.cells), { variant: 'boxed' });

  renderMobileActionRow(container, app, file, meta, settings, {
    planMeal: deps.planMeal,
    markEaten: deps.markEaten,
    editMeal: deps.editMeal,
    openPlan: deps.openMealPlan,
    plannedThisWeek: deps.isPlanned(file),
  });
  renderEatingHistoryButton(container, app, context.eatingHistory, settings.eatingHistoryEnabled);
  renderTrailingSectionButtons(container, app, component, file, context.trailingSections);

  // Only the tabs this meal has anything for.
  const plans: TabPlan[] = [];

  if (context.reheating.length > 0) {
    plans.push({
      label: t('meals.mobile.tabs.reheating'),
      render: (panel) =>
        renderReheatingSection(panel, app, component, file.path, context.reheating, settings),
    });
  }

  // A tab of its own rather than a card under the strips, because that is what
  // this layout does with anything long: the header above the tabs is already
  // eight boxed figures, a price and an action row, and a twenty-row
  // declaration table under all of it would put the Info tab below the fold on
  // every meal that has one. Asked here rather than inside the renderer,
  // because a tab whose panel turns out to be empty is a control that cannot
  // be used, which is the same rule that collapses a single tab below.
  if (nutritionBreakdown(meta.per100g).length > 0) {
    plans.push({
      label: t('meals.mobile.tabs.nutrition'),
      render: (panel) => {
        renderBreakdownSection(panel, meta.per100g);
        return Promise.resolve();
      },
    });
  }

  plans.push({
    label: t('meals.mobile.tabs.info'),
    render: (panel) =>
      renderMobileInfoPanel(panel, app, component, file, meta, [context.description]),
  });

  // **One tab is no tabs.** Most meals state no reheating of their own, and a
  // strip offering the single choice already on screen is a control that
  // cannot be used. The panel is rendered on its own instead, and the
  // description's "more" link scrolls to it rather than activating it.
  if (plans.length === 1) {
    const panel = container.createDiv({ cls: 'culi-lone-panel' });
    jumpToInfo = () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await plans[0].render(panel);
    return;
  }

  const strip = createTabStrip(
    container,
    component,
    plans.map((plan) => ({ label: plan.label }))
  );

  // Info is last by construction, and derived rather than counted so the link
  // cannot point at the wrong panel for a meal with fewer tabs.
  const infoTab = plans.length - 1;
  jumpToInfo = () => {
    strip.activate(infoTab);
    strip.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  for (const [index, plan] of plans.entries()) {
    await plan.render(strip.panels[index]);
  }
};
