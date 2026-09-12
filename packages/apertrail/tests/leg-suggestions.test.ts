/**
 * What the leg editor offers as you fill it in.
 *
 * The narrowing is the feature -- choose the operator and the ship list is
 * theirs -- and the refusal to narrow is the part that needs a test: a filter
 * that empties a list is worse than no filter, and somebody who typed an
 * airline their CRM has never heard of must still see every ship they own.
 */
import { describe, expect, it } from 'vitest';
import {
  cabinsForVehicle,
  SuggestableVehicle,
  vehiclesForCarrier,
} from '../src/trips/leg-suggestions';

const SHIPS: SuggestableVehicle[] = [
  {
    title: 'MS Trollfjord',
    operatorTitle: 'Hurtigruten',
    cabins: [{ name: 'Polar Aussenkabine' }, { name: 'Arktis Superior' }],
  },
  { title: 'MS Nordlys', operatorTitle: 'Hurtigruten', cabins: [{ name: 'Innenkabine' }] },
  { title: 'Pride of Africa', operatorTitle: 'Rovos Rail Charters', cabins: [] },
];

describe('which ships to offer', () => {
  it('offers that operator ships once one is named', () => {
    expect(vehiclesForCarrier(SHIPS, 'Hurtigruten').map((ship) => ship.title)).toEqual([
      'MS Trollfjord',
      'MS Nordlys',
    ]);
  });

  it('offers all of them before a carrier is named', () => {
    expect(vehiclesForCarrier(SHIPS, null)).toHaveLength(3);
    expect(vehiclesForCarrier(SHIPS, '   ')).toHaveLength(3);
  });

  /**
   * The rule worth keeping. Most airlines will never be a Company note, and a
   * list emptied by a carrier nobody wrote down would hide every ship the
   * vault has at the moment somebody is trying to pick one.
   */
  it('offers all of them for a carrier that matches no operator', () => {
    expect(vehiclesForCarrier(SHIPS, 'Helvetic Airs')).toHaveLength(3);
  });

  it('matches whatever the case and spacing', () => {
    expect(vehiclesForCarrier(SHIPS, '  hurtigruten ')).toHaveLength(2);
  });
});

describe('which cabins to offer', () => {
  it('offers that ship cabins', () => {
    expect(cabinsForVehicle(SHIPS, 'MS Trollfjord')).toEqual([
      'Polar Aussenkabine',
      'Arktis Superior',
    ]);
  });

  /**
   * The one place an empty list is right: a cabin belongs to a ship, and every
   * cabin in the vault would be other ships' rooms.
   */
  it('offers none before a ship is named', () => {
    expect(cabinsForVehicle(SHIPS, null)).toEqual([]);
  });

  it('offers none for a ship the vault has no note for', () => {
    expect(cabinsForVehicle(SHIPS, 'MS Nordkapp')).toEqual([]);
  });

  it('offers none for a ship that lists no cabins', () => {
    expect(cabinsForVehicle(SHIPS, 'Pride of Africa')).toEqual([]);
  });
});
