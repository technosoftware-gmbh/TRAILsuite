/**
 * The desktop layout: the controls, the description, and the buttons that open
 * the rest of the note.
 *
 * **It renders no picture.** That moved up beside the title, where it sits with
 * the nutrition figures and the price rather than below the controls: a
 * picture of a meal is one of the facts about it, not part of the body. See
 * `meal-view.ts`.
 *
 * What is left is a stack, which is the honest shape now. The layout used to
 * put the picture and the section buttons in a 200px column beside an
 * ingredients list; with nothing to sit beside, a column was a narrow strip of
 * truncated pills against an empty half-screen.
 */
import { MarkdownRenderer } from 'obsidian';
import { renderBreakdownSection } from '../breakdown-section';
import { renderReheatingSection } from '../reheating-section';
import { renderMetaBanner } from '../meta-banner';
import { renderEatingHistoryButton } from '../eating-history-button';
import { renderTrailingSectionButtons } from '../trailing-sections';
import { renderWarnings } from '../../safety/view/warning-row';
import { buildWarnings } from '../../safety/warnings';
import type { MealLayoutRenderer } from './types';

export const renderDesktopClassicLayout: MealLayoutRenderer = async ({
  container,
  app,
  component,
  deps,
  context,
}) => {
  const { file, settings, meta } = context;

  renderMetaBanner(container, app, file, meta, settings, {
    planMeal: deps.planMeal,
    markEaten: deps.markEaten,
    editMeal: deps.editMeal,
    openPlan: deps.openMealPlan,
    plannedThisWeek: deps.isPlanned(file),
  });

  renderWarnings(container, buildWarnings(meta.allergens, settings));

  if (context.description.trim()) {
    await MarkdownRenderer.render(app, context.description, container, file.path, component);
  }

  // Created here rather than left to the two renderers below, so the row
  // modifier is on the bar before either of them fills it. `sectionBar()`
  // reuses whatever it finds, which is what puts both in one row.
  if (settings.eatingHistoryEnabled || context.trailingSections.length > 0) {
    container.createDiv({ cls: 'culi-section-sidebar culi-section-sidebar--row' });
  }

  // Before the trailing sections, so the log leads the row: it is the one chip
  // that is about this meal rather than about the note.
  renderEatingHistoryButton(container, app, context.eatingHistory, settings.eatingHistoryEnabled);
  renderTrailingSectionButtons(container, app, component, file, context.trailingSections);

  // Before the reheating card, because the two cards answer questions in that
  // order: what this dish is, then what to do with it. Both are cards of the
  // same kind, so nothing about the stack changes for a meal that has only one.
  renderBreakdownSection(container, meta.per100g);

  await renderReheatingSection(container, app, component, file.path, context.reheating, settings);
};
