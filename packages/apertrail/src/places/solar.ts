/**
 * APERtrail's light windows, as clock ranges.
 *
 * **What is left here after the sun arithmetic moved to `trail-core`, and the
 * split is the point.** `sunTimes` answers a question about the sun: when does
 * it cross minus six degrees at this place on this date. That is a fact, it is
 * the same fact whatever is being planned against it, and it is in the core
 * because nothing about it is this plugin's to decide.
 *
 * This answers a different question: what does *this plugin* mean by "blue
 * hour, morning". The nine names come from the photo spot schema, they are what
 * a person may write in `light:`, and a schema is product logic. The core's own
 * rule says so, and this file is where that line falls: the boundaries are
 * there, the names for the spans between them are here.
 */
import { sunTimes } from 'trail-core';
import { PhotoSpotLightWindow } from './photo-spot-note';

export interface LightWindowRange {
  start: Date;
  /**
   * Null means the window has no end on this date -- only `night`, which
   * runs until the next morning's blue hour. Rendering that as a range
   * ending before it starts is the alternative, and it looks like a bug.
   */
  end: Date | null;
}

/**
 * The clock range a motif's preferred light corresponds to on a given date.
 *
 * `sunrise` and `sunset` come back as instants (start === end): they are
 * moments, not hours, and padding them by some invented number of minutes
 * would be the plugin making up a fact. `overcast` has no window at all by
 * design -- it is a sky condition, not a time of day -- and returns null,
 * which the caller renders as a chip with no time rather than as an error.
 */
export function lightWindowRange(
  window: PhotoSpotLightWindow,
  date: Date,
  lat: number,
  lon: number
): LightWindowRange | null {
  const times = sunTimes(date, lat, lon);
  const range = (start: Date | null, end: Date | null): LightWindowRange | null =>
    start && end ? { start, end } : null;

  switch (window) {
    case 'blue-hour-morning':
      return range(times.nightEnd, times.goldenHourMorningStart);
    case 'golden-hour-morning':
      return range(times.goldenHourMorningStart, times.dayStart);
    case 'sunrise':
      return times.sunrise ? { start: times.sunrise, end: times.sunrise } : null;
    case 'day':
      return range(times.dayStart, times.goldenHourEveningStart);
    case 'golden-hour-evening':
      return range(times.goldenHourEveningStart, times.blueHourEveningStart);
    case 'sunset':
      return times.sunset ? { start: times.sunset, end: times.sunset } : null;
    case 'blue-hour-evening':
      return range(times.blueHourEveningStart, times.nightStart);
    case 'night':
      return times.nightStart ? { start: times.nightStart, end: null } : null;
    case 'overcast':
      return null;
  }
}
