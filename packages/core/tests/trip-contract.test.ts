/**
 * The contract itself, and the helper each side's own suite calls.
 *
 * The values are asserted literally rather than against the constant: a test
 * reading `TRIP_CONTRACT.stopPlaceField` and comparing it to
 * `TRIP_CONTRACT.stopPlaceField` passes whatever the value is, which is the one
 * thing this file exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  TRIP_CONTRACT,
  TRIP_CONTRACT_KEYS,
  tripContractMismatches,
  describeTripContractMismatches,
  type TripContract,
} from '../src/settings/trip-contract';

describe('TRIP_CONTRACT', () => {
  it('holds the agreed values', () => {
    expect(TRIP_CONTRACT).toEqual({
      typePropertyName: 'type',
      tripsFolder: 'Trips',
      travelStatusProperty: 'travelStatus',
      departureProperty: 'departure',
      returnProperty: 'return',
      personsProperty: 'persons',
      stopsProperty: 'stops',
      stopPlaceField: 'place',
      stopDayField: 'day',
      stopFromField: 'from',
      stopToField: 'to',
      stopExcursionField: 'excursion',
      stopPersonsField: 'persons',
      stopOptionalField: 'optional',
      stopChosenField: 'chosen',
    });
  });

  it('agrees with the CRM contract about where a note says what it is', () => {
    // Two contracts naming one property is fine; two contracts naming it
    // differently would mean a vault could satisfy one and not the other.
    expect(TRIP_CONTRACT.typePropertyName).toBe('type');
  });

  it('cannot be edited by a plugin that spreads it', () => {
    expect(Object.isFrozen(TRIP_CONTRACT)).toBe(true);
  });

  it('lists every key exactly once', () => {
    expect([...TRIP_CONTRACT_KEYS].sort()).toEqual(Object.keys(TRIP_CONTRACT).sort());
    expect(new Set(TRIP_CONTRACT_KEYS).size).toBe(TRIP_CONTRACT_KEYS.length);
  });
});

describe('tripContractMismatches', () => {
  it('is empty for defaults that agree', () => {
    expect(tripContractMismatches({ ...TRIP_CONTRACT })).toEqual([]);
  });

  it('reports the one field that drifted, and only that one', () => {
    const drifted: TripContract = { ...TRIP_CONTRACT, stopPlaceField: 'ort' };
    expect(tripContractMismatches(drifted)).toEqual([
      { key: 'stopPlaceField', expected: 'place', actual: 'ort' },
    ]);
  });

  it('reports a key nobody wrote rather than passing over it', () => {
    // The mistake hardest to see is the key that is simply absent: a fresh
    // install then ships nothing where the agreed value was needed.
    const { stopsProperty: _omitted, ...missing } = { ...TRIP_CONTRACT };
    expect(tripContractMismatches(missing)).toEqual([
      { key: 'stopsProperty', expected: 'stops', actual: undefined },
    ]);
  });

  it('describes what disagrees in one line', () => {
    const mismatches = tripContractMismatches({ ...TRIP_CONTRACT, stopFromField: 'von' });
    expect(describeTripContractMismatches(mismatches)).toBe(
      'stopFromField: expected "from", got "von"'
    );
  });
});
