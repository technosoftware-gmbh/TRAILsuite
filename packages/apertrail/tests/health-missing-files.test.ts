/**
 * The two warnings added after a folder name with one letter too many hid a
 * ship's picture, both of her cabin photographs and every image on an
 * exported brochure, in silence (note 40).
 *
 * The rule halves only, which is the boundary every other check in
 * `vault/health/` draws: what a scan finds in a real vault is App-bound work
 * with its own failure modes, and what the rule decides is the part that can
 * be wrong quietly.
 */
import { describe, expect, it } from 'vitest';
import { missingReferences, ReferenceKind } from '../src/vault/health/missing-file-issues';
import { variantCabinWarnings } from '../src/vault/health/variant-cabin-issues';
import { aLeg, aTrip, aVehicle } from './fixtures';
import { TravelVehicle } from '../src/vault/types';
import { ParsedTripVariant } from '../src/trips/trip-note';

/** Anything under `Vault/` is a file that exists; an http value is a URL; everything else is missing. */
const resolve = (value: string): ReferenceKind => {
  if (/^https?:\/\//i.test(value)) return 'url';
  return value.startsWith('Vault/') ? 'file' : 'missing';
};

function reference(value: string, property = 'image', detail: string | null = null) {
  return { property, value, detail };
}

function variant(over: Partial<ParsedTripVariant> = {}): ParsedTripVariant {
  return {
    name: null,
    description: null,
    cost: null,
    currency: null,
    costUnit: 'total',
    chosen: false,
    ...over,
  };
}

function fleet(...vehicles: TravelVehicle[]): Map<string, TravelVehicle> {
  return new Map(vehicles.map((vehicle) => [vehicle.title, vehicle]));
}

const TROLLFJORD = aVehicle('MS Trollfjord', {
  cabins: [
    { name: 'Polar Aussenkabine', description: 'Outside, lower deck.', image: null },
    { name: 'Arktis Aussenkabine Superior', description: null, image: null },
  ],
});

describe('references to files the vault does not have', () => {
  it('reports the one that points at nothing', () => {
    const missing = missingReferences(
      [reference('Vault/here.png'), reference('Gone/away.png')],
      resolve
    );

    expect(missing.map((r) => r.value)).toEqual(['Gone/away.png']);
  });

  /** The exact shape of the bug that prompted this: one letter, one folder, three broken references. */
  it('catches a misspelled folder', () => {
    const missing = missingReferences(
      [
        reference('Vault/_ressources/ship.jpg'),
        reference('Vault/_ressources/polar.webp', 'cabins', 'Polar Aussenkabine'),
      ],
      (value) => (value.includes('_ressources') ? 'missing' : 'file')
    );

    expect(missing).toHaveLength(2);
    expect(missing[1].detail).toBe('Polar Aussenkabine');
  });

  /** A picture on the web is a picture, and a deck plan on the web is a deck plan. Neither is a file, and neither is a mistake. */
  it('says nothing about a value pointing out of the vault', () => {
    expect(missingReferences([reference('https://example.invalid/ship.jpg')], resolve)).toEqual([]);
  });

  /** An absent reference is the ordinary state of most notes, and reporting it would be reporting the vault. */
  it('says nothing about an empty value', () => {
    expect(missingReferences([reference(''), reference('   ')], resolve)).toEqual([]);
  });
});

describe('a variant naming a cabin the ship does not list', () => {
  it('reports the misspelling', () => {
    const trip = aTrip('Nordkap', {
      transport: [
        aLeg({
          vehicleTitle: 'MS Trollfjord',
          from: 'Oslo',
          to: 'Kirkenes',
          variants: [variant({ name: 'Polar Aussenkabinen' })],
        }),
      ],
    });

    const warnings = variantCabinWarnings(trip, fleet(TROLLFJORD));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      variantName: 'Polar Aussenkabinen',
      vehicleTitle: 'MS Trollfjord',
      legLabel: 'Oslo - Kirkenes',
    });
  });

  it('matches the way the itinerary does, so a difference of case or spacing is not a warning', () => {
    const trip = aTrip('Nordkap', {
      transport: [
        aLeg({
          vehicleTitle: 'MS Trollfjord',
          variants: [variant({ name: '  polar aussenkabine ' })],
        }),
      ],
    });

    expect(variantCabinWarnings(trip, fleet(TROLLFJORD))).toEqual([]);
  });

  /**
   * The whole point of the rule. Borrowing a description is what the match is
   * for, so a variant with one of its own loses nothing by not matching, and
   * a leg priced for something the ship does not sell is a normal note.
   */
  it('says nothing about a variant that describes itself', () => {
    const trip = aTrip('Nordkap', {
      transport: [
        aLeg({
          vehicleTitle: 'MS Trollfjord',
          variants: [variant({ name: 'Suite via an agent', description: 'Booked outside.' })],
        }),
      ],
    });

    expect(variantCabinWarnings(trip, fleet(TROLLFJORD))).toEqual([]);
  });

  /** A ship whose catalogue nobody has typed yet lends nothing to anybody, and warning there would report every variant on every leg. */
  it('says nothing when the ship lists no cabins at all', () => {
    const trip = aTrip('Nordkap', {
      transport: [aLeg({ vehicleTitle: 'MS Nordlys', variants: [variant({ name: 'Anything' })] })],
    });

    expect(variantCabinWarnings(trip, fleet(aVehicle('MS Nordlys')))).toEqual([]);
  });

  /** A leg naming a ship the vault has no note for is a leg with a typed-in name, which is allowed and says nothing about cabins. */
  it('says nothing about a leg whose ship has no note', () => {
    const trip = aTrip('Nordkap', {
      transport: [aLeg({ vehicleTitle: 'MS Unknown', variants: [variant({ name: 'Anything' })] })],
    });

    expect(variantCabinWarnings(trip, fleet(TROLLFJORD))).toEqual([]);
  });

  /** An unnamed variant is a price with no label, which the itinerary already draws as such. */
  it('says nothing about a variant with no name', () => {
    const trip = aTrip('Nordkap', {
      transport: [aLeg({ vehicleTitle: 'MS Trollfjord', variants: [variant({ cost: 100 })] })],
    });

    expect(variantCabinWarnings(trip, fleet(TROLLFJORD))).toEqual([]);
  });

  it('falls back to the carrier, then to the position, for a leg with no route', () => {
    const trip = aTrip('Nordkap', {
      transport: [
        aLeg({
          vehicleTitle: 'MS Trollfjord',
          carrier: 'Hurtigruten',
          variants: [variant({ name: 'Nope' })],
        }),
        aLeg({ vehicleTitle: 'MS Trollfjord', variants: [variant({ name: 'Also nope' })] }),
      ],
    });

    expect(variantCabinWarnings(trip, fleet(TROLLFJORD)).map((w) => w.legLabel)).toEqual([
      'Hurtigruten',
      '#2',
    ]);
  });
});
