/**
 * The twelve travel type values, and the five of them that are places.
 *
 * Asserted literally, for the reason the three settings contracts are: a list
 * compared against itself passes whatever is in it, and these are compared
 * against what is on disk in somebody's vault. A value edited here is a value
 * that stops matching notes written before the edit, silently, because the
 * failure mode of a type value that does not match is an empty list.
 *
 * The counts are asserted too. Every error the project bundle's own audit found
 * was a number written out in prose beside a list the code owns, and these two
 * numbers are quoted in five documents.
 */
import { describe, expect, it } from 'vitest';
import {
  TRAVEL_ENTITY_TYPES,
  TRAVEL_PLACE_TYPES,
  isTravelEntityType,
  isTravelPlaceType,
} from '../src/travel/entity-types';

describe('TRAVEL_ENTITY_TYPES', () => {
  it('is the twelve, in order', () => {
    expect([...TRAVEL_ENTITY_TYPES]).toEqual([
      'trip',
      'booking',
      'country',
      'state',
      'city',
      'accommodation',
      'fnb',
      'landmark',
      'location',
      'photospot',
      'vehicle',
      'excursion',
    ]);
    expect(TRAVEL_ENTITY_TYPES).toHaveLength(12);
  });

  it('holds no duplicates', () => {
    expect(new Set(TRAVEL_ENTITY_TYPES).size).toBe(TRAVEL_ENTITY_TYPES.length);
  });

  it('does not claim a person or a company, which are configurable rather than fixed', () => {
    expect(isTravelEntityType('person')).toBe(false);
    expect(isTravelEntityType('company')).toBe(false);
  });

  it('is exact about case, because a note is compared literally', () => {
    expect(isTravelEntityType('fnb')).toBe(true);
    expect(isTravelEntityType('FnB')).toBe(false);
  });
});

describe('TRAVEL_PLACE_TYPES', () => {
  it('is the five that share the place shape', () => {
    expect([...TRAVEL_PLACE_TYPES]).toEqual([
      'accommodation',
      'fnb',
      'landmark',
      'location',
      'photospot',
    ]);
    expect(TRAVEL_PLACE_TYPES).toHaveLength(5);
  });

  it('is a subset of the twelve', () => {
    for (const type of TRAVEL_PLACE_TYPES) expect(isTravelEntityType(type)).toBe(true);
  });

  it('leaves out the three that are not places, each for its own reason', () => {
    // A booking is a purchase, a vehicle is what you travel on, and an
    // excursion is run rather than gone to. None has coordinates and none is
    // ever an itinerary stop.
    for (const type of ['booking', 'vehicle', 'excursion']) {
      expect(isTravelPlaceType(type)).toBe(false);
    }
  });

  it('leaves out the three containers, which are places but not of this shape', () => {
    for (const type of ['country', 'state', 'city']) expect(isTravelPlaceType(type)).toBe(false);
  });
});
