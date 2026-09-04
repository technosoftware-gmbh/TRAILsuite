/**
 * Renders the dashboard's time-of-day greeting heading. Sits above the grid
 * with generous surrounding space so the view opens with some breathing room
 * instead of jumping straight into dense cards.
 */
import { t } from '../../lang/I18nManager';
import { formatMediumDate } from '../../shared/display';

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return t('dashboard.greeting.evening');
  if (hour < 12) return t('dashboard.greeting.morning');
  if (hour < 17) return t('dashboard.greeting.afternoon');
  return t('dashboard.greeting.evening');
}

/**
 * "Good morning. 2 September 2026", on one line.
 *
 * The date is not decoration: a dashboard is the thing somebody opens first,
 * and every plugin's greeting now says which day it is, because that is the one
 * piece of context all of them have and none of them had. Formatted through
 * `shared/display.ts` like every other date here, so it follows the vault's
 * convention rather than the machine's.
 */
export function renderGreeting(container: HTMLElement, today: Date = new Date()): void {
  const header = container.createDiv({ cls: 'apt-dashboard-greeting' });
  header.createEl('h1', {
    cls: 'apt-dashboard-greeting-text',
    text: `${timeOfDayGreeting()}. ${formatMediumDate(today)}`,
  });
}
