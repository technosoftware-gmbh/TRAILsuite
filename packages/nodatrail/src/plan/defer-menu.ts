/**
 * The menu that moves a task to another day.
 *
 * **Every entry is a concrete date, not a phrase.** "Next week" is worked out
 * here and shown with the day it means, so nothing is deferred to a date
 * somebody has to guess at -- and so a Monday and a Sunday do not disagree
 * about what "next week" was.
 *
 * The seven days of a week are offered only from the week level, which is what
 * a weekly review is: reading what the week holds and putting each thing on a
 * day. From a day, the two forward steps are enough.
 */
import { Menu, type App } from 'obsidian';
import {
  endOfPeriod,
  formatDayTitle,
  shiftPeriod,
  startOfPeriod,
  type PeriodLevel,
} from 'trail-core';
import { t } from '../lang/I18nManager';
import { activeDisplayLocale } from '../ui/kit/format';
import type { NODAtrailSettings } from '../settings/types';
import { deferToPeriod, planTask } from '../tasks/write-tasks';
import type { VaultTask } from '../tasks/read-tasks';

/** A day, spelled the way the menu shows it: `Fr, 04.09.` */
function label(date: Date): string {
  return t('plan.deferOn', {
    weekday: date.toLocaleDateString(activeDisplayLocale(), { weekday: 'short' }),
    date: dayLabel(date),
  });
}

/** `04.09.`, the short form both the day entries and the period ones end in. */
function dayLabel(date: Date): string {
  return date.toLocaleDateString(activeDisplayLocale(), { day: '2-digit', month: '2-digit' });
}

/**
 * The days offered, in the order they are shown.
 *
 * Today is never among them: planning something for the day it is already on is
 * not a thing anybody means, and offering it would make a slip into a no-op
 * that looks like a failure.
 */
export function deferTargets(level: PeriodLevel, anchor: Date, today: Date): Date[] {
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const nextWeek = startOfPeriod('week', shiftPeriod('week', today, 1));

  const targets = [tomorrow, nextWeek];

  if (level === 'week') {
    // The week on screen rather than the week containing today: a review of
    // next week is done from next week, and its days are what it should offer.
    const monday = startOfPeriod('week', anchor);
    for (let index = 0; index < 7; index += 1) {
      targets.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
    }
  }

  const seen = new Set([formatDayTitle(today)]);
  const out: Date[] = [];
  for (const date of targets) {
    const key = formatDayTitle(date);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(date);
  }
  return out;
}

/**
 * The periods offered, which set a deadline rather than a plan.
 *
 * This week and this month are offered as well as the next ones, because
 * "not today, but still this week" is the commonest thing a morning produces.
 * A period already past is not offered: pushing a task into last week is not a
 * plan, it is a typo.
 */
export function periodTargets(today: Date): { level: PeriodLevel; date: Date }[] {
  const out: { level: PeriodLevel; date: Date }[] = [];
  for (const level of ['week', 'month'] as const) {
    for (const step of [0, 1]) {
      const date = step === 0 ? today : shiftPeriod(level, today, 1);
      // This week ends today when today is a Sunday, and a deadline of today
      // is what somebody was moving away from.
      if (endOfPeriod(level, date) > today) out.push({ level, date });
    }
  }
  return out;
}

export interface DeferDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  today: () => Date;
  onChanged: () => void;
}

/**
 * Opens the menu at the pointer.
 *
 * **A day sets the plan and a period sets the deadline**, which is the whole
 * distinction the two dates exist for: choosing Tuesday says when you will do
 * it, and choosing next week says when it must be done by and that no day has
 * been picked yet.
 */
export function openDeferMenu(
  event: MouseEvent,
  deps: DeferDeps,
  task: VaultTask,
  level: PeriodLevel,
  anchor: Date
): void {
  const menu = new Menu();
  const today = deps.today();
  const settings = deps.getSettings();

  for (const date of deferTargets(level, anchor, today)) {
    menu.addItem((item) =>
      item.setTitle(label(date)).onClick(() => {
        void planTask(deps.app, settings, task, date).then(() => deps.onChanged());
      })
    );
  }

  menu.addSeparator();

  for (const target of periodTargets(today)) {
    menu.addItem((item) =>
      item
        .setTitle(
          t(`plan.until.${target.level}`, {
            date: dayLabel(endOfPeriod(target.level, target.date)),
          })
        )
        .onClick(() => {
          void deferToPeriod(deps.app, settings, task, target.level, target.date).then(() =>
            deps.onChanged()
          );
        })
    );
  }

  menu.showAtMouseEvent(event);
}
