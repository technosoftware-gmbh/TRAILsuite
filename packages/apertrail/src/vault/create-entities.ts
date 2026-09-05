/**
 * Creates new Trip/Country/State/City/place-type notes, writing minimal
 * frontmatter only: just the keys read-entities.ts actually understands.
 * Cosmetic fields the templates in docs/templates/ include (image, icon,
 * color, summary) are deliberately left for hand-editing or the vault's own
 * Templater templates. That is an intentional divergence from Templater's
 * "always emit the key, blank if unset" convention: blank keys are omitted
 * here rather than written out empty.
 *
 * The one stamp every note does get is `created`, handed to
 * frontmatterObject() as its own argument so it sits directly after `type`.
 * `modified` is deliberately NOT written here: a note that has only just
 * been created has not been modified, and the first real edit is what adds
 * it.
 */
import { App, TFile } from 'obsidian';
import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../trips/related-trips-block-lang';
import { APT_PHOTO_SPOT_BLOCK_LANG } from '../places/photo-spot-block-lang';
import { APERtrailSettings } from '../settings/types';
import { createdEntry, frontmatterObject } from '@technosoftware/trail-core';
import { renderFrontmatterBlock } from '@technosoftware/trail-core/obsidian';
import { isUnderFolder } from '@technosoftware/trail-core';
import { bookingFolderFor } from '../trips/trip-folder';
import { createNote } from '../shared/note-creation';
import { TRAVEL_PLACE_FOLDER_SETTING, TravelPlaceType } from './entity-types';
import { TravelCity, TravelCountry, TravelState } from './types';

function propertyName(settings: APERtrailSettings): string {
  return settings.typePropertyName.trim() || 'type';
}

/**
 * The body a new City or place note starts with: a related-trips block,
 * so the note answers "when was I here" from the moment it exists. Not
 * added to Country/State notes -- a Trip's stops point at cities and
 * places, never at a country or state, so the block would always be
 * empty there.
 */
function relatedTripsBody(): string {
  return `\n\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}\n\`\`\`\n`;
}

export async function createCountryNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  capital: TravelCity | null = null,
  states: TravelState[] = [],
  now: Date = new Date()
): Promise<TFile> {
  const rest: Record<string, unknown> = {};
  if (capital) rest[settings.capitalProperty] = `[[${capital.title}]]`;
  if (states.length > 0) rest[settings.statesProperty] = states.map((s) => `[[${s.title}]]`);
  const content = renderFrontmatterBlock(
    frontmatterObject(propertyName(settings), 'country', createdEntry(settings, now), rest)
  );
  return createNote(app, settings.countriesFolder, title, content);
}

export async function createStateNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  capital: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  const rest: Record<string, unknown> = {};
  if (country) rest[settings.countryProperty] = `[[${country.title}]]`;
  if (capital) rest[settings.capitalProperty] = `[[${capital.title}]]`;
  const content = renderFrontmatterBlock(
    frontmatterObject(propertyName(settings), 'state', createdEntry(settings, now), rest)
  );
  return createNote(app, settings.statesFolder, title, content);
}

export async function createCityNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  state: TravelState | null = null,
  now: Date = new Date()
): Promise<TFile> {
  const rest: Record<string, unknown> = {};
  if (country) rest[settings.countryProperty] = `[[${country.title}]]`;
  if (state) rest[settings.stateProperty] = `[[${state.title}]]`;
  const content =
    renderFrontmatterBlock(
      frontmatterObject(propertyName(settings), 'city', createdEntry(settings, now), rest)
    ) + relatedTripsBody();
  return createNote(app, settings.citiesFolder, title, content);
}

/**
 * Shared by all four place types (Accommodation/FnB/Landmark/Location) --
 * they only differ in their `type:` value and which folder setting they
 * write into, both looked up via TRAVEL_PLACE_FOLDER_SETTING so this stays
 * the single implementation rather than four near-identical copies. The
 * four exported wrappers below exist so call sites (the Stage 2 modals)
 * get a type-safe, self-explanatory function per entity type rather than
 * having to pass a `kind` string around.
 */
async function createPlaceNote(
  app: App,
  settings: APERtrailSettings,
  kind: TravelPlaceType,
  title: string,
  country: TravelCountry | null,
  city: TravelCity | null,
  now: Date
): Promise<TFile> {
  const rest: Record<string, unknown> = {};
  if (country) rest[settings.countryProperty] = `[[${country.title}]]`;
  if (city) rest[settings.cityProperty] = `[[${city.title}]]`;
  // A photo spot gets its own block above the related-trips one, so the
  // note answers "what am I here to shoot" from the moment it exists,
  // the same way the related-trips block answers "when was I here".
  const body =
    kind === 'photospot'
      ? `\n\`\`\`${APT_PHOTO_SPOT_BLOCK_LANG}\n\`\`\`\n` + relatedTripsBody()
      : relatedTripsBody();
  const content =
    renderFrontmatterBlock(
      frontmatterObject(propertyName(settings), kind, createdEntry(settings, now), rest)
    ) + body;
  const folder = settings[TRAVEL_PLACE_FOLDER_SETTING[kind]] as string;
  return createNote(app, folder, title, content);
}

/**
 * A booking note: what one part of a trip costs, and the paperwork behind it.
 *
 * Minimal frontmatter like every other creator, and deliberately no block in
 * the body. Every field a booking carries is a flat scalar or a list of
 * links, so Obsidian's own property editor is already a better editor than
 * anything this plugin would write. See
 * docs/design/trip-budget-and-bookings.md §7.1.
 */
export async function createBookingNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  draft: {
    tripTitle?: string | null;
    category?: string | null;
    status?: string | null;
    amount?: number | null;
    currency?: string | null;
    /** Written so a booking made from an itinerary line supersedes that line's estimate straight away, rather than after somebody remembers to type the reference. */
    reference?: string | null;
    placeTitle?: string | null;
    /** Who it is for. Empty is written as nothing, because a booking naming nobody already means everybody on the trip. */
    forTitles?: string[];
  } = {},
  now: Date = new Date()
): Promise<TFile> {
  const rest: Record<string, unknown> = {};
  if (draft.tripTitle) rest[settings.bookingTripProperty] = `[[${draft.tripTitle}]]`;
  if (draft.category) rest[settings.bookingCategoryProperty] = draft.category;
  if (draft.status) rest[settings.bookingStatusProperty] = draft.status;
  // Zero is a real amount: a comped hotel night is a booking worth recording,
  // and it is not the same fact as a booking nobody has priced yet.
  if (draft.amount !== null && draft.amount !== undefined) {
    rest[settings.bookingAmountProperty] = draft.amount;
  }
  if (draft.currency) rest[settings.bookingCurrencyProperty] = draft.currency;
  if (draft.reference) rest[settings.bookingReferenceProperty] = draft.reference;
  if (draft.placeTitle) rest[settings.bookingPlaceProperty] = `[[${draft.placeTitle}]]`;
  if (draft.forTitles && draft.forTitles.length > 0) {
    rest[settings.bookingForProperty] = draft.forTitles.map((title) => `[[${title}]]`);
  }

  const content = renderFrontmatterBlock(
    frontmatterObject(propertyName(settings), 'booking', createdEntry(settings, now), rest)
  );
  // Inside the trip's own folder when it has one, so a trip's bookings sit
  // with its pictures and its papers rather than in a shared pile. A trip
  // still flat in `Trips/` has nowhere of its own, and its bookings go where
  // they always went. Both are read; see `bookingReadFolders`.
  return createNote(
    app,
    bookingFolderFor(settings, tripNoteOf(app, settings, draft.tripTitle)),
    title,
    content
  );
}

export function createAccommodationNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  city: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  return createPlaceNote(app, settings, 'accommodation', title, country, city, now);
}

export function createFnbNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  city: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  return createPlaceNote(app, settings, 'fnb', title, country, city, now);
}

export function createLandmarkNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  city: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  return createPlaceNote(app, settings, 'landmark', title, country, city, now);
}

/**
 * A photo spot's motifs, samples and access details are all optional and
 * all edited in the block afterwards, so creation collects exactly what the
 * other four place types collect. There is deliberately no "add a first
 * motif here" step: a spot you just heard about is worth a note before you
 * know what you would shoot there.
 */
export function createPhotoSpotNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  city: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  return createPlaceNote(app, settings, 'photospot', title, country, city, now);
}

export function createLocationNote(
  app: App,
  settings: APERtrailSettings,
  title: string,
  country: TravelCountry | null = null,
  city: TravelCity | null = null,
  now: Date = new Date()
): Promise<TFile> {
  return createPlaceNote(app, settings, 'location', title, country, city, now);
}

// Trip creation lives in write-trip.ts, not here: Trips are the only
// Travel entity with an edit path as well as a create path, and that path
// brings a requirement none of the seven types above have (never clobber
// the note body). See that file's own header comment.

/**
 * The note a booking's trip link points at, or null.
 *
 * By title, which is how every link in this vault resolves. A booking naming a
 * trip that does not exist yet -- or a title that never resolved -- gets null
 * and lands in the flat bookings folder, which is a better answer than
 * inventing a folder for a trip nobody has made.
 */
function tripNoteOf(
  app: App,
  settings: APERtrailSettings,
  tripTitle: string | null | undefined
): { path: string; basename: string } | null {
  const wanted = (tripTitle ?? '').trim();
  if (!wanted) return null;

  const match = app.vault
    .getMarkdownFiles()
    .find((file) => file.basename === wanted && isUnderFolder(file.path, settings.tripsFolder));
  return match ? { path: match.path, basename: match.basename } : null;
}
