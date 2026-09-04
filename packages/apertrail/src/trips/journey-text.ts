/**
 * How a leg reads: like a flight card, because that is what everybody has
 * already learnt to read.
 *
 * `20:30 - 10:00 +1` says the overnight in the one glyph an airline, a
 * railway and a booking confirmation all use for it. The alternative this
 * replaced named both ends -- "Tag 0 -> Tag 1" -- which is the same fact
 * spelled out twice and in a vocabulary nobody uses outside this plugin.
 *
 * **A stay keeps the span**, and is not built here. "Tag 1 -> Tag 3" is what
 * a hotel confirmation says, because a stay IS the two dates; a flight is a
 * departure with an arrival hanging off it.
 *
 * Translated but App-free, the same arrangement `places/photo-spot-text.ts`
 * has. Two consumers -- the itinerary block and the trip document -- which is
 * why it is a module rather than a helper inside one of them.
 */
import { parseDayTitle } from 'trail-core';
import { t } from '../lang/I18nManager';
import { clockTime, dayOffset, endpointDate, RelativeEndpoint } from './relative-days';
import { formatMediumDate } from '../shared/display';

/** The two endpoints of a leg, as this module wants them. */
export interface LegSpan {
  day: number | null;
  toDay: number | null;
  from: string | null;
  to: string | null;
}

function ends(leg: LegSpan): { from: RelativeEndpoint; to: RelativeEndpoint } {
  return { from: { day: leg.day, value: leg.from }, to: { day: leg.toDay, value: leg.to } };
}

/**
 * "20:30 - 10:00 +1", or as much of it as the leg says.
 *
 * The marker is only added when the arrival is genuinely on a later day, so
 * its presence means something wherever it appears. A leg with no times at
 * all comes back null rather than as a bare "+1" attached to nothing.
 */
export function legClock(leg: LegSpan, departure: string | null): string | null {
  const from = clockTime(leg.from);
  const to = clockTime(leg.to);
  if (!from && !to) return null;

  const offset = dayOffset(ends(leg).from, ends(leg).to, departure);
  // A numeral convention rather than a phrase, which is why it is not a
  // translated string: `+1` is `+1` in every language a timetable is printed
  // in.
  const marker = to && offset !== null && offset > 0 ? ` +${offset}` : '';

  if (from && to) return `${from} - ${to}${marker}`;
  if (from) return t('itinerary.fromTime', { time: from });
  return t('itinerary.untilTime', { time: to ?? '' });
}

/**
 * Which day the leg leaves on: the date once the trip has one, the day number
 * before that.
 *
 * The departure only. The arrival is what `+1` above is for, and saying both
 * was the thing that read like nothing anybody prints.
 */
export function legWhen(leg: LegSpan, departure: string | null): string | null {
  const date = endpointDate(ends(leg).from, departure);
  if (date) {
    const parsed = parseDayTitle(date);
    return parsed ? formatMediumDate(parsed) : null;
  }
  return leg.day === null ? null : t('itinerary.dayNumber', { number: leg.day });
}
