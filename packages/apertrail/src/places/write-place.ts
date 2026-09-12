/**
 * Vault-write side of a place note's own fields: the head all five kinds
 * share, plus the two subtype fields that belong to exactly one of them.
 *
 * Its own file for the reason `write-photo-spot.ts` and `write-excursion.ts`
 * are theirs. Creating a place writes a note once, through
 * create-entities.ts, and editing one happens afterwards, as the address, the
 * coordinates and the rating arrive. The edit path brings a requirement plain
 * creation does not: never clobber the note body, which for a real place is
 * where somebody's own notes live.
 *
 * **What this schema owns is narrower than what a place note holds**, and
 * each exclusion is a decision rather than an omission:
 *
 * - `visited` and `lastVisit` are not written here at all. A finished trip
 *   that stops somewhere already contributes them (vault/visit-derivation.ts),
 *   so an editor writing them back would give one answer two sources. The
 *   photo spot writer draws the same line for the same reason.
 * - `image`, `gallery` and `description` belong to the note cover and are
 *   edited in its own dialog, which is the one surface that can edit a list
 *   of maps.
 * - `created` is stamped once, at creation, and never rewritten.
 */
import { App, TFile } from 'obsidian';
import { formatDateTimeStamp, toWikilink } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';
import { TravelPlaceType } from '../vault/entity-types';
import { TravelPlace } from '../vault/types';
import { buildCoverFrontmatter, coverManagedKeys, CoverInput } from '../vault/write-cover';

export interface PlaceInput {
  countryTitle: string | null;
  cityTitle: string | null;
  /** [latitude, longitude], as pasted from a map view. */
  geoLocation: [string, string] | null;
  address: string | null;
  website: string | null;
  /** 1-5, or null for unrated. */
  rating: number | null;
  tags: string[];
  /** Accommodation only. Carried for every kind and written for one. */
  accommodationType: string | null;
  accommodationStatus: string | null;
  /** Food & Beverages only, on the same terms. */
  fnbType: string | null;
}

/**
 * The property names this schema reads and writes, resolved from settings
 * once so the builder below takes names rather than a settings object. The
 * shape `excursionProperties()` and `photoSpotPropertyNames()` already use.
 */
export interface PlacePropertyNames {
  countryProperty: string;
  cityProperty: string;
  geoLocationProperty: string;
  addressProperty: string;
  websiteProperty: string;
  ratingProperty: string;
  tagsProperty: string;
  accommodationTypeProperty: string;
  accommodationStatusProperty: string;
  fnbTypeProperty: string;
}

export function placePropertyNames(settings: APERtrailSettings): PlacePropertyNames {
  return {
    countryProperty: settings.countryProperty,
    cityProperty: settings.cityProperty,
    geoLocationProperty: settings.geoLocationProperty,
    addressProperty: settings.addressProperty,
    websiteProperty: settings.websiteProperty,
    ratingProperty: settings.ratingProperty,
    tagsProperty: settings.tagsProperty,
    accommodationTypeProperty: settings.accommodationTypeProperty,
    accommodationStatusProperty: settings.accommodationStatusProperty,
    fnbTypeProperty: settings.fnbTypeProperty,
  };
}

/** A place read back from the vault, in the shape the writer takes, so an edit round-trips every field it does not change. */
export function placeToInput(place: TravelPlace): PlaceInput {
  return {
    countryTitle: place.countryTitle,
    cityTitle: place.cityTitle,
    geoLocation: place.geoLocation ? [...place.geoLocation] : null,
    address: place.address,
    website: place.website,
    rating: place.rating,
    tags: [...place.tags],
    accommodationType: place.accommodationType,
    accommodationStatus: place.accommodationStatus,
    fnbType: place.fnbType,
  };
}

/**
 * The frontmatter a place note carries, for the kind it is.
 *
 * Optional fields are omitted rather than written empty, the rule every
 * builder here follows: a note that says nothing about its address says
 * nothing, rather than saying it has none.
 *
 * A half-typed coordinate is not written at all. One number without the
 * other is not a position, and a pair with a blank in it reads back as null
 * anyway, so writing it would leave a key that says nothing.
 */
export function buildPlaceFrontmatter(
  input: PlaceInput,
  kind: TravelPlaceType,
  p: PlacePropertyNames
): Record<string, unknown> {
  const yaml: Record<string, unknown> = {};
  const write = (key: string, value: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) yaml[key] = trimmed;
  };
  const link = (key: string, value: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) yaml[key] = toWikilink(trimmed);
  };

  link(p.countryProperty, input.countryTitle);
  link(p.cityProperty, input.cityTitle);

  const lat = input.geoLocation?.[0]?.trim();
  const lng = input.geoLocation?.[1]?.trim();
  if (lat && lng) yaml[p.geoLocationProperty] = [lat, lng];

  write(p.addressProperty, input.address);
  write(p.websiteProperty, input.website);

  if (input.rating !== null) yaml[p.ratingProperty] = input.rating;

  const tags = input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  if (tags.length > 0) yaml[p.tagsProperty] = tags;

  if (kind === 'accommodation') {
    write(p.accommodationTypeProperty, input.accommodationType);
    write(p.accommodationStatusProperty, input.accommodationStatus);
  }
  if (kind === 'fnb') write(p.fnbTypeProperty, input.fnbType);

  return yaml;
}

/**
 * Every frontmatter key this schema owns for this kind, cleared before a
 * rewrite so a field emptied during an edit does not linger from before it.
 *
 * **The subtype keys are owned by their own kind and by nobody else.** A
 * landmark note that carries a hand-added `accommodationType:` is carrying
 * something this plugin never reads for a landmark, and clearing it would
 * delete a value on the strength of a field the note was not being asked
 * about. Same instinct as `image` and `gallery`: read is not own.
 */
export function placeManagedKeys(kind: TravelPlaceType, p: PlacePropertyNames): string[] {
  const keys = [
    p.countryProperty,
    p.cityProperty,
    p.geoLocationProperty,
    p.addressProperty,
    p.websiteProperty,
    p.ratingProperty,
    p.tagsProperty,
  ];
  if (kind === 'accommodation')
    keys.push(p.accommodationTypeProperty, p.accommodationStatusProperty);
  if (kind === 'fnb') keys.push(p.fnbTypeProperty);
  return keys;
}

/**
 * Updates an existing place note in place through `processFrontMatter()`, so
 * the body survives an edit untouched.
 *
 * Stale keys are cleared before the new values are applied rather than
 * assigned over the top, because the builder only ever emits the keys that
 * SHOULD be present: a rating removed during this edit would otherwise
 * linger from before it.
 */
export async function updatePlaceNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  kind: TravelPlaceType,
  input: PlaceInput,
  /**
   * The note's cover, written in the same pass when the caller has one.
   *
   * Two passes over one file are two vault writes and two cache
   * invalidations for one logical edit, which is the reason `modified` is
   * stamped inline here rather than through `touchModified()`. Now that one
   * dialog edits both, the same argument applies to the cover.
   *
   * The cover's keys are cleared with this schema's own, and its values are
   * assigned FIRST, so a key both schemas write -- `description` on a
   * vehicle -- ends up saying what the note's own schema says.
   */
  cover?: CoverInput,
  now: Date = new Date()
): Promise<TFile> {
  const p = placePropertyNames(settings);
  const yaml = buildPlaceFrontmatter(input, kind, p);
  const managed = [...(cover ? coverManagedKeys(settings) : []), ...placeManagedKeys(kind, p)];
  const coverYaml = cover ? buildCoverFrontmatter(cover, settings) : {};

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, coverYaml, yaml);
    // Stamped inside the same pass rather than through touchModified(): two
    // passes over one file are two vault writes and two cache invalidations
    // for one logical edit. A blank setting means "skip that stamp", never a
    // hardcoded fallback.
    if (settings.modifiedProperty) {
      record[settings.modifiedProperty] = formatDateTimeStamp(now);
    }
  });

  return file;
}
