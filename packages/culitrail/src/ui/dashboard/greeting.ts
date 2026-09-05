/**
 * The dashboard's time-of-day greeting.
 *
 * Above the grid rather than inside it, with room around it, so the view opens
 * with some air instead of straight into dense cards.
 */
import { formatMediumDate } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { activeDisplayLocale } from '../../shared/display';

/**
 * Which greeting the clock calls for.
 *
 * The small hours read as evening rather than morning: somebody looking at a
 * meal at two in the morning has not started their day early.
 */
function greetingText(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return t('dashboard.greeting.evening');
  if (hour < 12) return t('dashboard.greeting.morning');
  if (hour < 17) return t('dashboard.greeting.afternoon');
  return t('dashboard.greeting.evening');
}

/**
 * "Good morning. 2 September 2026", on one line.
 *
 * The date joins it because a dashboard is what somebody opens first and the
 * day is the one piece of context all three plugins' dashboards have. Through
 * `shared/display.ts` like every other date here, so it reads in the vault's
 * convention rather than the machine's.
 */
export function renderGreeting(container: HTMLElement, now: Date = new Date()): void {
  const header = container.createDiv({ cls: 'culi-dashboard-greeting' });
  header.createEl('h1', {
    cls: 'culi-dashboard-greeting-text',
    text: `${greetingText(now)}. ${formatMediumDate(now, activeDisplayLocale())}`,
  });
}
