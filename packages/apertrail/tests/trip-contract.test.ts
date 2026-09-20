/**
 * APERtrail's half of the trip contract.
 *
 * This plugin writes the trip note and NODAtrail reads it, to seed a day's
 * entries from an itinerary. Fourteen defaults have to match or a fresh vault
 * ends up with one plugin writing `place:` on a stop and the other looking for
 * `ort:`. The failure mode is an entry written without the place it happened
 * at, never an error, so it is checked here rather than noticed in a note six
 * weeks later.
 *
 * The values themselves are asserted in trail-core's own suite. This asserts
 * only that this plugin still agrees with them, which is the part a change here
 * could break.
 */
import { describe, expect, it } from 'vitest';
import {
  TRIP_CONTRACT,
  tripContractMismatches,
  describeTripContractMismatches,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';

describe('the trip contract', () => {
  it('is what DEFAULT_SETTINGS ships', () => {
    const mismatches = tripContractMismatches(DEFAULT_SETTINGS);
    expect(describeTripContractMismatches(mismatches)).toBe('');
  });

  it('survives mergeSettings given nothing', () => {
    // The defaults object is one thing; what a fresh install actually persists
    // is another, and it is the persisted values the other plugin reads.
    const mismatches = tripContractMismatches(mergeSettings(null));
    expect(describeTripContractMismatches(mismatches)).toBe('');
  });

  it('still lets a vault rename any of it', () => {
    // The contract is about defaults, not about locking a vault out of its own
    // spelling. A configured value has to win, and a German vault renames the
    // trips folder on its first run.
    const settings = mergeSettings({ stopPlaceField: 'ort' });
    expect(settings.stopPlaceField).toBe('ort');
    expect(TRIP_CONTRACT.stopPlaceField).toBe('place');
  });
});
