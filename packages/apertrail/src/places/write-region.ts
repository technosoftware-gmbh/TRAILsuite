/**
 * Vault-write side of a Country, a State and a City: the three notes that
 * hold the geographic hierarchy together.
 *
 * One writer for the three rather than three files, the shape
 * `write-place.ts` uses for its five kinds. What each of them owns is a
 * subset of the same five fields, and the subsets are the interesting part:
 *
 * - a **city** names its country and its state, and carries coordinates and
 *   tags;
 * - a **state** names its country and its capital;
 * - a **country** names its capital.
 *
 * **Only upwards.** A country's `states:` and a state's `cities:` are read
 * and never written here, and that is a decision rather than an omission: a
 * city already names its state, so maintaining the list on the other side
 * would make one fact writable from two places that can then disagree. A
 * vault that keeps those lists keeps them by hand.
 *
 * `visited` and `lastVisit` are not written either, for the reason
 * `write-place.ts` gives: a finished trip that stops in a city contributes
 * them, and a dialog writing them back would give one answer two sources.
 * `image`, `gallery` and `description` belong to the note cover's own
 * dialog, and `created` is stamped once.
 */
import { App, TFile } from 'obsidian';
import { formatDateTimeStamp, toWikilink } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';
import { TravelCity, TravelCountry, TravelState } from '../vault/types';
import { buildCoverFrontmatter, coverManagedKeys, CoverInput } from '../vault/write-cover';

/** The three notes this writer serves. Not an entity-types export: those three sit among twelve, and these are the three that form a hierarchy. */
export type RegionKind = 'country' | 'state' | 'city';

export interface RegionInput {
  /** City and State. A country is at the top and names none. */
  countryTitle: string | null;
  /** City only. */
  stateTitle: string | null;
  /** State and Country. */
  capitalTitle: string | null;
  /** City only. [latitude, longitude], as pasted from a map view. */
  geoLocation: [string, string] | null;
  /** City only. */
  tags: string[];
}

export interface RegionPropertyNames {
  countryProperty: string;
  stateProperty: string;
  capitalProperty: string;
  geoLocationProperty: string;
  tagsProperty: string;
}

export function regionPropertyNames(settings: APERtrailSettings): RegionPropertyNames {
  return {
    countryProperty: settings.countryProperty,
    stateProperty: settings.stateProperty,
    capitalProperty: settings.capitalProperty,
    geoLocationProperty: settings.geoLocationProperty,
    tagsProperty: settings.tagsProperty,
  };
}

function emptyRegionInput(): RegionInput {
  return {
    countryTitle: null,
    stateTitle: null,
    capitalTitle: null,
    geoLocation: null,
    tags: [],
  };
}

/** A country read back from the vault, in the shape the writer takes. */
export function countryToInput(country: TravelCountry): RegionInput {
  return { ...emptyRegionInput(), capitalTitle: country.capitalTitle };
}

/** A state read back from the vault. Its `cities:` list is deliberately not carried: nothing writes it. */
export function stateToInput(state: TravelState): RegionInput {
  return {
    ...emptyRegionInput(),
    countryTitle: state.countryTitle,
    capitalTitle: state.capitalTitle,
  };
}

/** A city read back from the vault. */
export function cityToInput(city: TravelCity): RegionInput {
  return {
    ...emptyRegionInput(),
    countryTitle: city.countryTitle,
    stateTitle: city.stateTitle,
    geoLocation: city.geoLocation ? [...city.geoLocation] : null,
    tags: [...city.tags],
  };
}

/**
 * The frontmatter one of the three carries.
 *
 * A field belonging to another kind is dropped rather than written: a
 * country handed a state title is a country somebody built wrong, and
 * writing it would put a `state:` on a note nothing reads one from.
 *
 * A half-typed coordinate is not written at all, the rule `write-place.ts`
 * follows: one number without the other is not a position.
 */
export function buildRegionFrontmatter(
  input: RegionInput,
  kind: RegionKind,
  p: RegionPropertyNames
): Record<string, unknown> {
  const yaml: Record<string, unknown> = {};
  const link = (key: string, value: string | null): void => {
    const trimmed = value?.trim();
    if (trimmed) yaml[key] = toWikilink(trimmed);
  };

  if (kind !== 'country') link(p.countryProperty, input.countryTitle);
  if (kind === 'city') link(p.stateProperty, input.stateTitle);
  if (kind !== 'city') link(p.capitalProperty, input.capitalTitle);

  if (kind === 'city') {
    const lat = input.geoLocation?.[0]?.trim();
    const lng = input.geoLocation?.[1]?.trim();
    if (lat && lng) yaml[p.geoLocationProperty] = [lat, lng];

    const tags = input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    if (tags.length > 0) yaml[p.tagsProperty] = tags;
  }

  return yaml;
}

/**
 * Every frontmatter key this schema owns for this kind, cleared before a
 * rewrite so a field emptied during an edit does not linger from before it.
 *
 * A kind claims only the keys it writes. A country carrying a hand-added
 * `state:` keeps it: nothing reads one from a country, so clearing it would
 * delete a value on the strength of a question the note was not asked. Read
 * is not own, and here not even read.
 */
export function regionManagedKeys(kind: RegionKind, p: RegionPropertyNames): string[] {
  const keys: string[] = [];
  if (kind !== 'country') keys.push(p.countryProperty);
  if (kind === 'city') keys.push(p.stateProperty, p.geoLocationProperty, p.tagsProperty);
  if (kind !== 'city') keys.push(p.capitalProperty);
  return keys;
}

/**
 * Updates an existing country, state or city note in place through
 * `processFrontMatter()`, so the body survives an edit untouched. A city's
 * body in particular holds its related-trips block.
 */
export async function updateRegionNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  kind: RegionKind,
  input: RegionInput,
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
  const p = regionPropertyNames(settings);
  const yaml = buildRegionFrontmatter(input, kind, p);
  const managed = [...(cover ? coverManagedKeys(settings) : []), ...regionManagedKeys(kind, p)];
  const coverYaml = cover ? buildCoverFrontmatter(cover, settings) : {};

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, coverYaml, yaml);
    // Stamped inside the same pass rather than through touchModified(): two
    // passes over one file are two vault writes for one logical edit. A blank
    // setting means "skip that stamp", never a hardcoded fallback.
    if (settings.modifiedProperty) {
      record[settings.modifiedProperty] = formatDateTimeStamp(now);
    }
  });

  return file;
}
