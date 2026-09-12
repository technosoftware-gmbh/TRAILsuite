/**
 * A thing you can be sold a day of: the Viking tour out of Stavanger, a
 * king-crab safari, a bus to the Nordkap.
 *
 * **Why it is not a place.** A place is somewhere you went and carries
 * coordinates, a country and a city of its own; an excursion is something
 * that is run, on a day, by somebody, and the place it happens at is the
 * stop it hangs off. It is not a member of `TRAVEL_PLACE_TYPES` for the
 * reason a vehicle is not: it needs almost none of the place shape, and the
 * one field it does share -- which city it is offered in -- it carries as a
 * plain link rather than as a claim to have been anywhere.
 *
 * **Why it is not a trip either**, which is the question that was actually
 * asked. A trip drives the dashboard's status counts, the trip ordering and
 * the next-trip countdown, and one cruise brochure carries ten optional
 * excursions. Filing them as trips would put ten things nobody is going on
 * into the count of trips somebody is going on. A trip that follows another
 * trip is a different need with a different answer -- see the trip's
 * `extends`.
 *
 * **There is deliberately no catalogue here**, which is where this differs
 * from the ship. A vehicle lists its cabins because one sailing sells
 * several grades of the same voyage and the leg picks exactly one of them; a
 * stop picks one excursion, so a half-day and a full-day version of the same
 * tour are two notes rather than two rows in one. What the tour costs stays
 * on the trip's own line, in its `cost` or its `variants`, because the same
 * excursion is priced differently on every sailing that offers it. That is
 * the vehicle's rule with the catalogue half removed: the description is
 * here, the price is on the trip.
 *
 * Pure: no Obsidian import, no clock. The shape mirrors `vehicle-note.ts`.
 */
import { readString, readTextLines, toWikilink, wikilinkTarget } from '@technosoftware/trail-core';

/** Every property name an excursion note touches, resolved from settings by the caller. */
export interface ExcursionPropertyNames {
  /**
   * The one-line description, sharing the name a Person, a Company and a
   * ship already use rather than inventing a second word for the same thing.
   * The brochure paragraph stays in the note body, where a reader writes it.
   */
  descriptionProperty: string;
  /** Who runs it, as a link to a Company note. A fact about the tour, not about any trip that takes it. */
  operatorProperty: string;
  /**
   * How long it takes, as free text.
   *
   * Not a number of hours: operators quote "ca. 4 Stunden", "half day" and
   * "3.5 hrs" and mean the same kind of thing by all three, and a number
   * would force this reader to pick one of those spellings as the truth.
   * Nothing computes with it.
   */
  durationProperty: string;
  /** Where it is offered. Resolved by the caller, the same way a place's are. */
  countryProperty: string;
  cityProperty: string;
  websiteProperty: string;
  imageProperty: string;
  galleryProperty: string;
  /** Why it is worth doing, one line each. The trip's own property, so a vault spells it once. */
  highlightsProperty: string;
  galleryImageField: string;
  galleryCaptionField: string;
}

/** One picture, the same shape a trip's and a vehicle's gallery entry has. */
export interface ParsedExcursionPicture {
  image: string;
  caption: string | null;
}

export interface ParsedExcursion {
  /** One or two lines: what it is, in the words a brochure would use. The long version is the note body. */
  description: string | null;
  /** Who runs it, as written: a wikilink read down to its target. Nothing here joins a trip to a company. */
  operatorTitle: string | null;
  duration: string | null;
  /** Raw wikilink targets. Resolved against the board's Cities and Countries by the caller. */
  countryTitle: string | null;
  cityTitle: string | null;
  website: string | null;
  /** Exactly as the note wrote it: a vault path, a wikilink or a URL. */
  image: string | null;
  gallery: ParsedExcursionPicture[];
  /** What a brochure would lead with, in the order they should read. Empty when the note says nothing. */
  highlights: string[];
}

/**
 * An excursion note's frontmatter, read defensively: everything absent reads
 * as unset rather than as an error, the rule every reader here follows.
 */
export function parseExcursion(
  frontmatter: Record<string, unknown>,
  p: ExcursionPropertyNames
): ParsedExcursion {
  const fm = frontmatter;
  return {
    description: readString(fm[p.descriptionProperty]),
    operatorTitle: wikilinkTarget(fm[p.operatorProperty]) ?? readString(fm[p.operatorProperty]),
    duration: readString(fm[p.durationProperty]),
    countryTitle: wikilinkTarget(fm[p.countryProperty]),
    cityTitle: wikilinkTarget(fm[p.cityProperty]),
    website: readString(fm[p.websiteProperty]),
    image: readString(fm[p.imageProperty]),
    gallery: objectEntries(fm[p.galleryProperty]).flatMap((entry) => {
      const image = readString(entry[p.galleryImageField]);
      return image ? [{ image, caption: readString(entry[p.galleryCaptionField]) }] : [];
    }),
    // Not `readStringList`: a highlight is a sentence, and "Oslo - die
    // schoene, historische Hauptstadt" is one of them rather than two.
    highlights: readTextLines(fm[p.highlightsProperty]),
  };
}

function objectEntries(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
  );
}

/** What a creation form hands the writer. */
export interface ExcursionInput {
  description: string | null;
  operatorTitle: string | null;
  duration: string | null;
  countryTitle: string | null;
  cityTitle: string | null;
  website: string | null;
}

/**
 * The frontmatter a new excursion note carries.
 *
 * Optional fields are omitted rather than written empty, the rule every
 * creator here follows: a note that says nothing about its duration says
 * nothing, rather than saying it has none.
 */
export function buildExcursionFrontmatter(
  input: ExcursionInput,
  p: ExcursionPropertyNames
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

  write(p.descriptionProperty, input.description);
  link(p.operatorProperty, input.operatorTitle);
  write(p.durationProperty, input.duration);
  link(p.countryProperty, input.countryTitle);
  link(p.cityProperty, input.cityTitle);
  write(p.websiteProperty, input.website);

  return yaml;
}

/**
 * Every frontmatter key this schema owns, cleared before a rewrite.
 *
 * The boundary the vehicle and the photo spot both draw, for the same
 * reason: an edit clears what it owns and then writes what it means, so a
 * field emptied during this edit does not linger from before it. `image`,
 * `gallery` and `highlights` are read by this schema and NOT owned by it --
 * the cover owns and clears those, and an editor that cleared them here would
 * delete a picture nobody asked it to touch.
 */
export function excursionManagedKeys(p: ExcursionPropertyNames): string[] {
  return [
    p.descriptionProperty,
    p.operatorProperty,
    p.durationProperty,
    p.countryProperty,
    p.cityProperty,
    p.websiteProperty,
  ];
}

/** An excursion read back from the vault, in the shape the writer takes, so an edit round-trips everything it does not change. */
export function excursionToInput(excursion: ParsedExcursion): ExcursionInput {
  return {
    description: excursion.description,
    operatorTitle: excursion.operatorTitle,
    duration: excursion.duration,
    countryTitle: excursion.countryTitle,
    cityTitle: excursion.cityTitle,
    website: excursion.website,
  };
}
