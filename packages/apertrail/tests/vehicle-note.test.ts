/**
 * The ship, the named train: the thing you travel on rather than to.
 *
 * Two rules carry the weight here. **The cabins are a catalogue, not prices**
 * -- a cabin costs one thing at Christmas and another in May, so the figure
 * lives on the sailing and only the description lives here. And **a leg's
 * variant borrows that description at render time**, so correcting the ship's
 * note corrects every trip that ever sailed on it, without a write.
 */
import { describe, expect, it } from 'vitest';
import {
  buildVehicleFrontmatter,
  cabinDescription,
  parseVehicle,
  vehicleManagedKeys,
  vehicleToInput,
  VehiclePropertyNames,
} from '../src/places/vehicle-note';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { aVehicle } from './fixtures';

const P: VehiclePropertyNames = {
  modeProperty: DEFAULT_SETTINGS.vehicleModeProperty,
  operatorProperty: DEFAULT_SETTINGS.vehicleOperatorProperty,
  builtProperty: DEFAULT_SETTINGS.vehicleBuiltProperty,
  refurbishedProperty: DEFAULT_SETTINGS.vehicleRefurbishedProperty,
  capacityProperty: DEFAULT_SETTINGS.vehicleCapacityProperty,
  lengthProperty: DEFAULT_SETTINGS.vehicleLengthProperty,
  tonnageProperty: DEFAULT_SETTINGS.vehicleTonnageProperty,
  websiteProperty: DEFAULT_SETTINGS.websiteProperty,
  imageProperty: DEFAULT_SETTINGS.imageProperty,
  galleryProperty: DEFAULT_SETTINGS.tripGalleryProperty,
  galleryImageField: DEFAULT_SETTINGS.galleryImageField,
  galleryCaptionField: DEFAULT_SETTINGS.galleryCaptionField,
  cabinsProperty: DEFAULT_SETTINGS.vehicleCabinsProperty,
  cabinNameField: DEFAULT_SETTINGS.cabinNameField,
  cabinDescriptionField: DEFAULT_SETTINGS.cabinDescriptionField,
};

const INPUT = {
  mode: 'boat',
  operatorTitle: 'Hurtigruten',
  built: '2002',
  refurbished: '2023',
  capacity: 500,
  length: '135 m',
  tonnage: '16151',
  website: 'https://example.invalid',
  cabins: [
    { name: 'Polar Aussenkabine', description: 'Outside cabin with a window.' },
    { name: 'Arktis Superior', description: null },
  ],
};

describe('what a vehicle note carries', () => {
  it('round-trips through its own writer and reader', () => {
    const parsed = parseVehicle(buildVehicleFrontmatter(INPUT, P), P);

    expect(parsed).toMatchObject({
      mode: 'boat',
      operatorTitle: 'Hurtigruten',
      built: '2002',
      capacity: 500,
      cabins: INPUT.cabins,
    });
  });

  /** The operator is a real link, so Obsidian backlinks and graphs it without this plugin resolving anything. */
  it('writes the operator as a wikilink', () => {
    expect(buildVehicleFrontmatter(INPUT, P).operator).toBe('[[Hurtigruten]]');
  });

  it('omits what the note says nothing about, rather than writing it empty', () => {
    const yaml = buildVehicleFrontmatter({ ...INPUT, tonnage: null, cabins: [] }, P);

    expect(yaml).not.toHaveProperty('tonnage');
    expect(yaml).not.toHaveProperty('cabins');
  });

  /** The name is what a trip's variant matches on, so a nameless row could never be referred to. */
  it('drops a cabin with no name, on the way out and on the way back', () => {
    const yaml = buildVehicleFrontmatter(
      { ...INPUT, cabins: [{ name: '   ', description: 'nothing to point at' }] },
      P
    );
    expect(yaml).not.toHaveProperty('cabins');

    const parsed = parseVehicle({ cabins: [{ description: 'orphan' }] }, P);
    expect(parsed.cabins).toEqual([]);
  });

  it('reads a note that says nothing at all as unset rather than as an error', () => {
    expect(parseVehicle({}, P)).toEqual({
      mode: null,
      operatorTitle: null,
      built: null,
      refurbished: null,
      capacity: null,
      length: null,
      tonnage: null,
      website: null,
      image: null,
      gallery: [],
      cabins: [],
    });
  });

  /**
   * `image` and `gallery` are read here and owned by nobody here: an edit that
   * cleared them would delete a picture nothing asked it to touch.
   */
  it('does not manage the picture keys it reads', () => {
    const managed = vehicleManagedKeys(P);

    expect(managed).toContain(DEFAULT_SETTINGS.vehicleCabinsProperty);
    expect(managed).not.toContain(DEFAULT_SETTINGS.imageProperty);
    expect(managed).not.toContain(DEFAULT_SETTINGS.tripGalleryProperty);
  });

  it('hands an editor back everything it did not come to change', () => {
    const parsed = parseVehicle(buildVehicleFrontmatter(INPUT, P), P);

    expect(vehicleToInput(parsed)).toEqual(INPUT);
  });
});

describe('what a cabin includes', () => {
  const ship = aVehicle('MS Trollfjord', {
    cabins: [{ name: 'Polar Aussenkabine', description: 'Outside cabin with a window.' }],
  });

  it('is the ship own words, matched by name', () => {
    expect(cabinDescription(ship, 'Polar Aussenkabine')).toBe('Outside cabin with a window.');
  });

  /** The name is typed twice, once in the catalogue and once on the leg that books it. */
  it('matches whatever the case and spacing', () => {
    expect(cabinDescription(ship, '  polar aussenkabine ')).toBe('Outside cabin with a window.');
  });

  it('says nothing about a cabin the ship does not list', () => {
    expect(cabinDescription(ship, 'Suite')).toBeNull();
  });

  /** The ordinary leg: no vehicle, nothing to borrow. */
  it('says nothing when there is no ship', () => {
    expect(cabinDescription(null, 'Polar Aussenkabine')).toBeNull();
    expect(cabinDescription(ship, null)).toBeNull();
  });
});
