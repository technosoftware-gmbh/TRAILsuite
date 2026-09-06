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
 * **A leg that runs for days is the stay's case, not the flight's.** A
 * fifteen-day voyage is not a departure with an arrival hanging off it; it is
 * the trip. `+1` beside a clock is the timetable's word for one night and
 * nothing prints "+14", so past one night, or where there is no clock to hang
 * a marker on, the leg states both ends and how long it runs instead. This
 * was reported from a real note: a leg from day 1 to day 15 said "Day 1" and
 * nothing else, so the longest thing on the trip looked like its shortest.
 *
 * Translated but App-free, the same arrangement `places/photo-spot-text.ts`
 * has. Two consumers -- the itinerary block and the trip document -- which is
 * why it is a module rather than a helper inside one of them.
 */
import { parseDayTitle } from '@technosoftware/trail-core';
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

/** One end of a leg, said the way the reader can place it: a date once the trip has one, a day number before that. */
function endpointLabel(point: RelativeEndpoint, departure: string | null): string | null {
  const date = endpointDate(point, departure);
  if (date) {
    const parsed = parseDayTitle(date);
    return parsed ? formatMediumDate(parsed) : null;
  }
  return point.day === null || point.day === undefined
    ? null
    : t('itinerary.dayNumber', { number: point.day });
}

/**
 * Whether the leg should say where it ends rather than leave it to the clock.
 *
 * One night with a clock beside it is a flight card and reads as one: the
 * `+1` on the arrival time says it in the vocabulary every timetable uses.
 * Two nights is no longer that shape, and a leg with no arrival time has no
 * marker anywhere -- which is how a fifteen-day voyage came to say only "Day
 * 1".
 */
function statesItsSpan(leg: LegSpan, offset: number | null): boolean {
  if (offset === null || offset < 1) return false;
  return offset > 1 || clockTime(leg.to) === null;
}

/**
 * How long a leg runs, in nights, or null when it does not run overnight.
 *
 * Nights rather than days, because it is the unquestionable count: day 1 to
 * day 15 is fourteen nights however each end is spent, where "fifteen days"
 * is the operator's way of counting and "fourteen days" is somebody else's.
 */
export function legNights(leg: LegSpan, departure: string | null): number | null {
  const offset = dayOffset(ends(leg).from, ends(leg).to, departure);
  return offset !== null && offset > 0 ? offset : null;
}

/**
 * When the leg happens: the day it leaves, and where it ends when that is not
 * the same day.
 *
 * The departure alone for an ordinary leg, which is what the `+1` on the
 * clock above is for. Both ends and the night count for one that runs for
 * days -- see `statesItsSpan` for where the line falls and why.
 */
export function legWhen(leg: LegSpan, departure: string | null): string | null {
  const { from, to } = ends(leg);
  const start = endpointLabel(from, departure);
  const offset = dayOffset(from, to, departure);
  if (!statesItsSpan(leg, offset)) return start;

  const end = endpointLabel(to, departure);
  const span = start && end ? `${start} \u2192 ${end}` : (start ?? end);
  if (!span) return null;
  return offset === null ? span : `${span} \u00b7 ${t('itinerary.legNights', { count: offset })}`;
}
