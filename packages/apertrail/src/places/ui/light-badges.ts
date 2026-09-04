/**
 * A motif's light, as badges: which window it wants and what that is in
 * clock time on a given date, and where the sun stands relative to the lens.
 *
 * Shared by the two surfaces that answer the same question about the same
 * motif. The photo spot block draws them per motif while you plan the spot;
 * the itinerary draws them on a stop while you plan the day. They were the
 * block's private helpers until the second caller appeared, and two copies
 * would have drifted in wording before they drifted in colour.
 */
import { GeoPoint, lightRelation, sunPosition } from 'trail-core';
import { formatClockIn } from '../../shared/clock';
import { t } from '../../lang/I18nManager';
import { ParsedPhotoSpotMotif, PhotoSpotLightWindow } from '../photo-spot-note';
import { lightWindowRange } from '../solar';

/**
 * What a light window needs to become a clock time: which day, and which
 * zone to render in. Null when the sun calculation is switched off, in
 * which case a chip renders as a bare name.
 */
export interface SunContext {
  date: Date;
  timeZone: string | undefined;
  /** The reader's clock convention, resolved from settings by whoever built this. Undefined means the locale decides. */
  hour12: boolean | undefined;
}

/**
 * Which of the three colours a window reads in. Keyed off the fixed
 * vocabulary rather than matched by substring, so it cannot drift out of
 * step with the values a note may carry: a tenth window would not compile
 * without an entry here.
 *
 * The three neutral ones are sky conditions rather than slices of the
 * horizon, which is exactly why they have no colour of their own.
 */
const LIGHT_FAMILY: Record<PhotoSpotLightWindow, 'blue' | 'gold' | 'neutral'> = {
  'blue-hour-morning': 'blue',
  sunrise: 'gold',
  'golden-hour-morning': 'gold',
  day: 'neutral',
  overcast: 'neutral',
  'golden-hour-evening': 'gold',
  sunset: 'gold',
  'blue-hour-evening': 'blue',
  night: 'neutral',
};

/**
 * One light window as a chip: its name, its colour, and the clock range it
 * resolves to at this point on this date.
 *
 * No icon. Nine identical suns down a card is noise, and the colour is what
 * the eye reads first anyway. The time is its own element so it can be set
 * in tabular figures without dragging the label along with it.
 */
export function renderLightChip(
  container: HTMLElement,
  window: PhotoSpotLightWindow,
  point: GeoPoint | null,
  sun: SunContext | null
): void {
  const range = sun && point ? lightWindowRange(window, sun.date, point.lat, point.lon) : null;

  // An instant (sunrise, sunset) renders as one time, a span as two, a
  // window with no end on this date as "from HH:MM" rather than as an
  // instant it is not, and a window the sun never reaches as just its name
  // -- the honest answer above the Arctic Circle in June.
  const clock = (moment: Date): string => formatClockIn(moment, sun?.timeZone, sun?.hour12);
  const time = !range
    ? null
    : !range.end
      ? t('photoSpot.lightFrom', { time: clock(range.start) })
      : range.end.valueOf() === range.start.valueOf()
        ? clock(range.start)
        : `${clock(range.start)} - ${clock(range.end)}`;

  const chip = container.createSpan({
    cls: `apt-chip apt-photo-spot-light-chip is-${LIGHT_FAMILY[window]}`,
  });
  chip.createSpan({ text: t(`photoSpot.light.${window}`) });
  if (time) chip.createSpan({ cls: 'apt-photo-spot-light-time', text: time });
}

/**
 * Where the sun stands relative to the lens, at the middle of the first
 * light window the motif asks for.
 *
 * One badge per motif rather than one per chip: the relation barely moves
 * inside a window, and four badges saying the same thing would be noise.
 * Nothing is drawn for a motif with no shooting direction, since without a
 * bearing there is no relation to state.
 */
export function renderRelationBadge(
  container: HTMLElement,
  motif: ParsedPhotoSpotMotif,
  point: GeoPoint | null,
  sun: SunContext | null
): void {
  if (!sun || !point || motif.direction === null || motif.light.length === 0) return;

  const first = lightWindowRange(motif.light[0], sun.date, point.lat, point.lon);
  if (!first) return;

  const middle = new Date((first.start.valueOf() + (first.end ?? first.start).valueOf()) / 2);
  const relation = lightRelation(
    sunPosition(middle, point.lat, point.lon).azimuth,
    motif.direction
  );
  container.createSpan({
    cls: `apt-photo-spot-relation is-${relation}`,
    text: t(`photoSpot.relation.${relation}`),
  });
}
