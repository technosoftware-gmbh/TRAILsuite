/**
 * The thing you travel on, as a note of its own: MS Trollfjord, the Rovos
 * Rail, a riverboat.
 *
 * **Why it is not a place.** A place is somewhere you went, and it has
 * coordinates, a country and a city; a vehicle has none of those and is never
 * an itinerary stop. It is not a member of `TRAVEL_PLACE_TYPES` for the same
 * reason a booking is not, and the argument is the one photo spots had to
 * answer in the other direction: a photo spot needed every field of the place
 * shape, and this needs none of them.
 *
 * **Why it is not the carrier either.** A leg's `carrier` is who runs it --
 * Hurtigruten, Swiss, Rovos Rail -- and the vehicle is which of their ships or
 * trains you are actually on. The old field was documented as "the airline,
 * the railway, or the train's own name", and that "or" was two facts wearing
 * one field.
 *
 * **The cabins here are a catalogue, not prices.** A ship's cabin categories
 * are a fact about the ship and outlive every sailing; what one costs is a
 * fact about the sailing and lives on the leg, in its variants. So a variant
 * naming a cabin takes its description from here at render time and its price
 * from the note it is written in. Nothing is copied and nothing is written
 * back, which is what makes correcting a description here correct it on every
 * trip that ever sailed.
 *
 * Pure: no Obsidian import, no clock. The shape mirrors `photo-spot-note.ts`,
 * which is the other entity format that carries a list of maps.
 */
import { readNumberLike, readString, toWikilink, wikilinkTarget } from '@technosoftware/trail-core';

/** Every property name a vehicle note touches, resolved from settings by the caller. */
export interface VehiclePropertyNames {
  modeProperty: string;
  operatorProperty: string;
  builtProperty: string;
  refurbishedProperty: string;
  capacityProperty: string;
  lengthProperty: string;
  tonnageProperty: string;
  websiteProperty: string;
  imageProperty: string;
  galleryProperty: string;
  galleryImageField: string;
  galleryCaptionField: string;
  cabinsProperty: string;
  cabinNameField: string;
  cabinDescriptionField: string;
}

/**
 * One cabin category the vehicle is sold in.
 *
 * A name and what you get for it, and deliberately no price: the same cabin
 * costs one thing at Christmas and another in May, so the figure belongs to
 * the sailing. See `trips/costs/line-variants.ts` for the other half.
 */
export interface ParsedVehicleCabin {
  name: string;
  description: string | null;
}

/** One picture, the same shape a trip's gallery entry has. */
export interface ParsedVehiclePicture {
  image: string;
  caption: string | null;
}

export interface ParsedVehicle {
  /** `boat`, `train`, ... from the same vocabulary a leg's mode uses. Free text on read, so a hand-written note may carry anything. */
  mode: string | null;
  /** Who runs it, as written: a wikilink read down to its target. A fact about the ship; nothing links a trip to a company through it. */
  operatorTitle: string | null;
  built: string | null;
  refurbished: string | null;
  /** How many it carries. Number-like, because it is the one fact here that is always a count. */
  capacity: number | null;
  length: string | null;
  tonnage: string | null;
  website: string | null;
  image: string | null;
  gallery: ParsedVehiclePicture[];
  cabins: ParsedVehicleCabin[];
}

/**
 * A vehicle note's frontmatter, read defensively.
 *
 * A cabin with no name is dropped: the name is what a leg's variant matches
 * on, so a nameless one is a row nothing could ever refer to. Everything else
 * absent reads as unset rather than as an error, which is the rule every
 * reader here follows.
 */
export function parseVehicle(
  frontmatter: Record<string, unknown>,
  p: VehiclePropertyNames
): ParsedVehicle {
  const fm = frontmatter;
  return {
    mode: readString(fm[p.modeProperty]),
    operatorTitle: wikilinkTarget(fm[p.operatorProperty]) ?? readString(fm[p.operatorProperty]),
    built: readString(fm[p.builtProperty]),
    refurbished: readString(fm[p.refurbishedProperty]),
    capacity: readNumberLike(fm[p.capacityProperty]),
    length: readString(fm[p.lengthProperty]),
    tonnage: readString(fm[p.tonnageProperty]),
    website: readString(fm[p.websiteProperty]),
    image: readString(fm[p.imageProperty]),
    gallery: objectEntries(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    cabins: objectEntries(fm[p.cabinsProperty]).flatMap((entry) => {
      const name = readString(entry[p.cabinNameField]);
      return name === null
        ? []
        : [{ name, description: readString(entry[p.cabinDescriptionField]) }];
    }),
  };
}

function objectEntries(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
  );
}

/** What a creation form hands the writer. */
export interface VehicleInput {
  mode: string | null;
  operatorTitle: string | null;
  built: string | null;
  refurbished: string | null;
  capacity: number | null;
  length: string | null;
  tonnage: string | null;
  website: string | null;
  cabins: ParsedVehicleCabin[];
}

/**
 * The frontmatter a new vehicle note carries.
 *
 * Optional fields are omitted rather than written empty, the rule every
 * creator here follows: a note that says nothing about tonnage says nothing,
 * rather than saying it has none.
 */
export function buildVehicleFrontmatter(
  input: VehicleInput,
  p: VehiclePropertyNames
): Record<string, unknown> {
  const yaml: Record<string, unknown> = {};
  const write = (key: string, value: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) yaml[key] = trimmed;
  };

  write(p.modeProperty, input.mode);
  const operator = input.operatorTitle?.trim();
  if (operator) yaml[p.operatorProperty] = toWikilink(operator);
  write(p.builtProperty, input.built);
  write(p.refurbishedProperty, input.refurbished);
  if (input.capacity !== null) yaml[p.capacityProperty] = input.capacity;
  write(p.lengthProperty, input.length);
  write(p.tonnageProperty, input.tonnage);
  write(p.websiteProperty, input.website);

  const cabins = input.cabins
    .filter((cabin) => cabin.name.trim() !== '')
    .map((cabin) => {
      const entry: Record<string, unknown> = { [p.cabinNameField]: cabin.name.trim() };
      const description = cabin.description?.trim();
      if (description) entry[p.cabinDescriptionField] = description;
      return entry;
    });
  if (cabins.length > 0) yaml[p.cabinsProperty] = cabins;

  return yaml;
}

/**
 * Every frontmatter key this schema owns, cleared before a rewrite.
 *
 * The same boundary the photo spot draws, and for the same reason: an edit
 * clears what it owns and then writes what it means, so a cabin list emptied
 * during an edit does not linger from before it. Everything else on the note
 * -- `created`, `image`, `gallery`, the icon, anything hand-added -- is left
 * exactly as it was. `image` and `gallery` are read by this schema and NOT
 * owned by it: they are written by hand or by the image field, and an editor
 * that cleared them would delete a picture nobody asked it to touch.
 */
export function vehicleManagedKeys(p: VehiclePropertyNames): string[] {
  return [
    p.modeProperty,
    p.operatorProperty,
    p.builtProperty,
    p.refurbishedProperty,
    p.capacityProperty,
    p.lengthProperty,
    p.tonnageProperty,
    p.websiteProperty,
    p.cabinsProperty,
  ];
}

/** A vehicle read back from the vault, in the shape the writer takes, so an edit round-trips everything it does not change. */
export function vehicleToInput(vehicle: ParsedVehicle): VehicleInput {
  return {
    mode: vehicle.mode,
    operatorTitle: vehicle.operatorTitle,
    built: vehicle.built,
    refurbished: vehicle.refurbished,
    capacity: vehicle.capacity,
    length: vehicle.length,
    tonnage: vehicle.tonnage,
    website: vehicle.website,
    cabins: vehicle.cabins.map((cabin) => ({ ...cabin })),
  };
}

/**
 * What a cabin of this name includes, according to the vehicle.
 *
 * Matched on the name after trimming and case-folding, because the name is
 * typed twice -- once in the ship's catalogue and once on the leg that books
 * it -- and "Polar Aussenkabine" and "polar aussenkabine" are the same cabin
 * to everybody except a comparison. Null when the vehicle says nothing about
 * it, which includes the ordinary case of a leg with no vehicle at all.
 */
export function cabinDescription(
  vehicle: Pick<ParsedVehicle, 'cabins'> | null,
  name: string | null
): string | null {
  const wanted = name?.trim().toLowerCase();
  if (!vehicle || !wanted) return null;
  return (
    vehicle.cabins.find((cabin) => cabin.name.trim().toLowerCase() === wanted)?.description ?? null
  );
}
