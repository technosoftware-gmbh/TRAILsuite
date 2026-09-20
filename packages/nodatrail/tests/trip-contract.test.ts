/**
 * NODAtrail's half of the trip contract.
 *
 * APERtrail writes the trip note and this plugin reads it, to seed a day's
 * entries from an itinerary. Fifteen defaults have to match or a fresh vault
 * ends up with one plugin writing `place:` on a stop and the other looking for
 * `ort:`. The failure mode is an entry written without the place it happened
 * at, never an error.
 *
 * The values themselves are asserted in trail-core's own suite. This asserts
 * only that this plugin still agrees with them.
 */
import { describe, expect, it } from 'vitest';
import {
  TRIP_CONTRACT,
  tripContractMismatches,
  describeTripContractMismatches,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

describe('the trip contract', () => {
  it('is what DEFAULT_SETTINGS ships', () => {
    const mismatches = tripContractMismatches(DEFAULT_SETTINGS);
    expect(describeTripContractMismatches(mismatches)).toBe('');
  });

  it('shares one type property with the CRM contract', () => {
    // Two contracts naming one property is fine; two naming it differently
    // would mean a vault could satisfy one and not the other.
    expect(DEFAULT_SETTINGS.typePropertyName).toBe(TRIP_CONTRACT.typePropertyName);
  });
});
