/**
 * The week's meal plan, seven columns wide.
 *
 * Reads the same `settings.state.mealPlan` mirror the meal-plan view reads,
 * after the same week sync, so the two can never disagree about what is
 * planned. Nothing here writes except which person is being shown.
 *
 * A full week rather than today alone: the question worth answering at a glance
 * is what still needs deciding, and an empty Thursday three days out is the
 * answer. A thumbnail per entry is what makes the row scannable, since a meal
 * is recognised by its picture long before its name is read.
 */
import { App, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { mealSlotLabel, weekdayLabel, WEEKDAY_KEYS, type WeekdayKey } from '../../lang/vocabulary';
import { readEligiblePersons, resolveActivePerson } from '../../crm/persons';
import { entriesInScope } from '../../planning/meal-plan/entries';
import { mealRank } from '../../planning/view-model/day-agenda';
import { defaultMealImageValue, frontmatterImageValue } from '../../meals/view-model/hero-image';
import { frontmatterOf } from '../../shared/vault-scan';
import type { CULItrailSettings, MealPlanEntry } from '../../settings/types';
import { resolveImagePath, usableImageValue } from '../images';
import { renderWeekNav } from '../week-nav';
import { cardHeader, dashboardCard, headerButton, renderEmpty } from './section';
import type { DashboardViewDeps } from './deps';

/** How many entries a day column shows before the rest become a count. */
const VISIBLE_PER_DAY = 3;

export interface TodayOptions {
  app: App;
  deps: DashboardViewDeps;
  week: string;
  /** Called when the reader picks a different person, so the view can persist and repaint. */
  onPersonChange: (person: string) => void;
}

function entryTitle(entry: MealPlanEntry): string {
  if (!entry.mealPath) return entry.label ?? t('dashboard.today.customMeal');
  return entry.mealPath.split('/').pop()?.replace(/\.md$/, '') ?? '';
}

/**
 * The thumbnail for one entry.
 *
 * Frontmatter only, with no lazy pass over note bodies. This is a 2rem square
 * in one of twenty-one slots, and reading twenty-one note bodies to fill them
 * would cost more than the pictures are worth here.
 */
function thumbnailSrc(
  app: App,
  entry: MealPlanEntry,
  settings: CULItrailSettings,
  fallback: string | null
): string | null {
  if (!entry.mealPath) return null;
  const file = app.vault.getFileByPath(entry.mealPath);
  if (!file) return null;

  const stated = usableImageValue(
    app,
    frontmatterImageValue(frontmatterOf(app, file) ?? {}, settings)
  );
  return stated ? resolveImagePath(app, stated) : fallback;
}

function renderEntry(
  list: HTMLElement,
  app: App,
  entry: MealPlanEntry,
  settings: CULItrailSettings,
  fallback: string | null,
  deps: DashboardViewDeps
): void {
  const title = entryTitle(entry);
  const row = list.createDiv({
    cls: 'culi-dashboard-mpg-entry',
    attr: { title, role: 'button', tabindex: '0' },
  });

  const thumb = row.createDiv({ cls: 'culi-dashboard-mpg-entry-thumb' });
  const src = thumbnailSrc(app, entry, settings, fallback);
  if (src) {
    thumb.createEl('img', { attr: { src, loading: 'lazy' } });
  } else {
    thumb.addClass('culi-dashboard-mpg-entry-thumb--empty');
    // Crossed cutlery for a meal that names no meal, so leftovers and eating
    // out read as different from a meal whose picture is simply missing.
    setIcon(thumb, entry.mealPath ? 'utensils' : 'utensils-crossed');
  }

  const text = row.createDiv({ cls: 'culi-dashboard-mpg-entry-text' });
  text.createDiv({ cls: 'culi-dashboard-mpg-entry-title', text: title });
  if (entry.meal) {
    text.createDiv({ cls: 'culi-dashboard-mpg-entry-meal', text: mealSlotLabel(entry.meal) });
  }

  const open = (): void => {
    // An entry naming no meal has nothing to open, so it goes to the plan,
    // which is the only place it can be edited.
    if (entry.mealPath) deps.openMeal(entry.mealPath);
    else deps.openMealPlan();
  };

  row.addEventListener('click', (event) => {
    event.stopPropagation();
    open();
  });
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    open();
  });
}

function renderDay(
  grid: HTMLElement,
  app: App,
  day: WeekdayKey,
  entries: MealPlanEntry[],
  settings: CULItrailSettings,
  fallback: string | null,
  deps: DashboardViewDeps
): void {
  const column = grid.createDiv({ cls: 'culi-dashboard-mpg-col' });
  // Three letters rather than the full name: seven weekday names do not fit
  // seven columns at this width in either language.
  column.createDiv({ cls: 'culi-dashboard-mpg-day', text: weekdayLabel(day).slice(0, 3) });

  if (entries.length === 0) {
    column.addClass('culi-dashboard-mpg-col--empty');
    column.setAttrs({ role: 'button', tabindex: '0' });
    column.createDiv({ cls: 'culi-dashboard-mpg-empty', text: '–' });
    // An empty day is an invitation, so clicking one opens the picker rather
    // than a plan that has nothing on that day either.
    column.addEventListener('click', () => deps.planAnyMeal());
    return;
  }

  const list = column.createDiv({ cls: 'culi-dashboard-mpg-list' });
  const ordered = [...entries].sort((a, b) => mealRank(a.meal) - mealRank(b.meal));

  for (const entry of ordered.slice(0, VISIBLE_PER_DAY)) {
    renderEntry(list, app, entry, settings, fallback, deps);
  }

  if (ordered.length > VISIBLE_PER_DAY) {
    list.createDiv({
      cls: 'culi-dashboard-mpg-more',
      text: t('dashboard.today.more').replace('{count}', String(ordered.length - VISIBLE_PER_DAY)),
    });
  }
}

export function renderTodaySection(grid: HTMLElement, options: TodayOptions): void {
  const { app, deps } = options;
  const settings = deps.getSettings();

  const persons = readEligiblePersons(app, settings);
  const person = resolveActivePerson(persons, settings.state.mealPlanActivePerson);

  const card = dashboardCard(grid, 12);
  const header = cardHeader(card, { label: t('dashboard.today.title') });

  // Only when there is a choice to make. A one-person household should not be
  // asked which person every time it opens the dashboard.
  if (persons.length > 1) {
    const picker = header.createEl('select', { cls: 'culi-dashboard-person' });
    for (const candidate of persons) {
      picker.createEl('option', { value: candidate.title, text: candidate.title });
    }
    picker.value = person;
    picker.addEventListener('change', () => options.onPersonChange(picker.value));
  }

  // Both actions sit in the title row, beside the week nav, rather than on
  // rows of their own underneath. This card is already seven days tall, and on
  // a span-12 header the space to the right of the title is otherwise empty.
  headerButton(header, t('dashboard.today.planAMeal'), () => deps.planAnyMeal());
  headerButton(header, t('dashboard.today.openPlan'), () => deps.openMealPlan());

  renderWeekNav(header, {
    week: options.week,
    onChange: (week) => deps.setViewedMealPlanWeek(week),
  });

  const scoped = entriesInScope(settings.state.mealPlan, { week: options.week, person });

  const defaultValue = defaultMealImageValue(settings);
  const fallback = defaultValue ? resolveImagePath(app, defaultValue) : null;

  const days = card.createDiv({ cls: 'culi-dashboard-mpg' });
  for (const day of WEEKDAY_KEYS) {
    renderDay(
      days,
      app,
      day,
      scoped.filter((entry) => entry.day === day),
      settings,
      fallback,
      deps
    );
  }

  // Still said, rather than left to seven columns of dashes. But said as one
  // plain line now that the button it used to carry is in the title row.
  if (scoped.length === 0) renderEmpty(card, t('dashboard.today.nothingPlanned'));
}
