/**
 * Renders a duration in minutes the way a meal states one.
 *
 * "1 h 15 min", not "75 min" and not "1.25 h". Both of those are correct and
 * neither is what a cook reads.
 */
import { t } from '../../lang/I18nManager';

const MINUTES_PER_HOUR = 60;

/**
 * @param minutes
 *   A number of minutes. Anything null, negative or non-finite yields '',
 *   because a badge with no value renders as nothing rather than as "0 min",
 *   which would appear on every meal that says nothing about time.
 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '';

  // Rounded, because a scaled or computed total can carry a fraction and
  // "1 h 14.999 min" helps nobody.
  const total = Math.round(minutes);
  if (total === 0) return '';

  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const remainder = total % MINUTES_PER_HOUR;

  if (hours === 0) return t('meals.time.minutes', { m: remainder });
  if (remainder === 0) return t('meals.time.hours', { h: hours });
  return t('meals.time.hoursMinutes', { h: hours, m: remainder });
}
