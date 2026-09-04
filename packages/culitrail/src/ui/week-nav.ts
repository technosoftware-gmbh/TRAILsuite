/**
 * Previous week, this week, next week.
 *
 * A pure rendering helper that reads and writes the week through callbacks
 * rather than owning it. The meal plan and the grocery list each browse their
 * own week, and moving one must not move the other, so neither can be allowed
 * to reach into shared state from here.
 */
import { Platform, setIcon } from 'obsidian';
import { currentWeekTitle, shiftWeekTitle, startOfWeekTitle } from 'trail-core';
import { t } from '../lang/I18nManager';
import { activeDisplayLocale } from '../shared/display';

export interface WeekNavOptions {
  week: string;
  onChange: (week: string) => void;
}

/** The Monday of a week, as a short local date. */
function shortDate(week: string): string {
  const monday = startOfWeekTitle(week);
  // The week title itself is a reasonable fallback for something unparseable:
  // this only renders a label, and a broken title should show as itself rather
  // than take the view down.
  return monday
    ? monday.toLocaleDateString(activeDisplayLocale(), { day: 'numeric', month: 'short' })
    : week;
}

export function renderWeekNav(container: HTMLElement, options: WeekNavOptions): void {
  const nav = container.createDiv({ cls: 'culi-week-nav' });
  const isCurrent = options.week === currentWeekTitle();

  const step = (offset: number, icon: string, label: string) => {
    const button = nav.createEl('button', {
      cls: 'culi-week-nav-step',
      attr: { 'aria-label': label },
    });
    // In a span rather than straight into the button: see `ui/toolbar.ts`.
    setIcon(button.createSpan({ cls: 'culi-icon-slot' }), icon);
    button.addEventListener('click', () => {
      const next = shiftWeekTitle(options.week, offset);
      if (next) options.onChange(next);
    });
  };

  step(-1, 'chevron-left', t('planning.weekNav.previous'));

  const label = nav.createEl('button', { cls: 'culi-week-nav-label' });
  label.setText(
    isCurrent
      ? t('planning.weekNav.thisWeek')
      : // The "Week of" prefix plus a date overlaps the next-week arrow on a
        // phone, and the bare date is unambiguous enough once the label is no
        // longer saying "this week".
        Platform.isMobile
        ? shortDate(options.week)
        : t('planning.weekNav.weekOf', { date: shortDate(options.week) })
  );

  if (isCurrent) {
    label.addClass('culi-week-nav-label-current');
  } else {
    // Doubles as "jump back to today", and only advertises itself as
    // clickable when there is somewhere to jump back to.
    label.setAttribute('aria-label', t('planning.weekNav.jumpToThisWeek'));
    label.addEventListener('click', () => options.onChange(currentWeekTitle()));
  }

  step(1, 'chevron-right', t('planning.weekNav.next'));
}
