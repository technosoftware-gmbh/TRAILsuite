/**
 * A distance as the reader measures things.
 *
 * `trail-core`'s formatDistance() is metric, and its own comment says a
 * caller with another convention should format the kilometres itself. This
 * is that caller. "8.9 km SSW of the anchor" is an instant answer in most
 * of the world and a small arithmetic problem in the United States, on a
 * card whose whole point is that it answers without one.
 *
 * The shape of the answer is the same in both systems: the smaller unit
 * below the point where it stops being useful, one decimal in the middle,
 * whole units above. Precision follows what the input can support, which is
 * a coordinate pair somebody pasted off a map.
 */
import { formatDistance } from '@technosoftware/trail-core';

export type UnitSystem = 'metric' | 'imperial';

export const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'imperial'];

const KM_PER_MILE = 1.609344;
const FEET_PER_MILE = 5280;

export function formatDistanceIn(km: number, units: UnitSystem): string {
  if (units !== 'imperial') return formatDistance(km);

  const miles = km / KM_PER_MILE;
  // Below a tenth of a mile, feet: "0.1 mi" and "0.0 mi" are both answers
  // nobody can use on the ground.
  if (miles < 0.1) return `${Math.round((miles * FEET_PER_MILE) / 10) * 10} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
