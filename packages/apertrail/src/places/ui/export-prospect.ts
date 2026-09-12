/**
 * The App-bound half of a prospect: works out what the note is, reads the
 * vault, inlines the pictures, writes the file. The markup is
 * `places/export-prospect.ts`, which is pure -- the arrangement all four
 * sheets here have.
 *
 * **The subject is a union rather than five builders.** Everything above the
 * facts box is the same question asked of a different note -- what is it
 * called, what does it look like, what does the note say about it -- and only
 * the grey box and the middle section differ. Five builders would be five
 * copies of the first half.
 *
 * Which trips count differs too, and not cosmetically: a ship's are the trips
 * with a leg aboard her, a place's are the trips that stopped there, and a
 * country's are the trips that named it or stopped anywhere in it. Each
 * subject answers that for itself.
 */
import { App } from 'obsidian';
import {
  formatDayTitle,
  parseDayTitle,
  proseBlocks,
  sanitizeTitle,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { exportFolder, exportPath } from '../../shared/export-folder';
import { writeSheet } from '../../shared/write-sheet';
import { loadNoteSummary } from '../../shared/note-summary';
import { travelModeLabel } from '../../shared/travel-mode';
import { APERtrailSettings } from '../../settings/types';
import {
  TravelBoard,
  TravelCity,
  TravelCountry,
  TravelPlace,
  TravelState,
  TravelVehicle,
  TravelExcursion,
} from '../../vault/types';
import { readTravelBoard } from '../../vault/read-entities';
import {
  relatedTrips,
  tripsCovering,
  tripsOnVehicle,
  tripsWithExcursion,
} from '../../trips/related-trips';
import { inlinePicture } from '../../shared/inline-picture';
import { relativeVaultPath, resolveReference } from '../../shared/vault-file';
import { formatMediumDate } from '../../shared/display';
import {
  buildProspectHtml,
  Prospect,
  ProspectCabin,
  ProspectFact,
  ProspectPicture,
} from '../export-prospect';

async function picture(app: App, value: string, caption: string | null): Promise<ProspectPicture> {
  return { src: await inlinePicture(app, value), caption };
}

function formatDay(value: string | null): string | null {
  const parsed = parseDayTitle((value ?? '').slice(0, 10));
  return parsed ? formatMediumDate(parsed) : null;
}

/**
 * The grey box, and only the lines the note actually carries.
 *
 * A brochure that printed "Tonnage: --" for a train would be stating an
 * absence, which is the one thing an omitted line cannot do wrong.
 */
/**
 * Takes the settings and works out the sheet's folder itself, rather than
 * being handed one.
 *
 * The href has to be relative to where the SHEET lands, and the note's own
 * folder was the same thing right up until sheets moved into `_exports` -- at
 * which point passing the wrong one produced a link that opens nothing, and no
 * test of the path arithmetic could see it. There is no longer a wrong value
 * to pass.
 */
export function vehicleFacts(
  app: App,
  settings: APERtrailSettings,
  vehicle: TravelVehicle
): ProspectFact[] {
  const sheetFolder = exportFolder(settings, vehicle.file.path);
  const rows: [string, string | null][] = [
    [t('fieldNames.built'), vehicle.built],
    [t('fieldNames.refurbished'), vehicle.refurbished],
    [t('fieldNames.capacity'), vehicle.capacity === null ? null : String(vehicle.capacity)],
    [t('fieldNames.length'), vehicle.length],
    [t('fieldNames.tonnage'), vehicle.tonnage],
  ];
  const rest: ProspectFact[] = rows
    .filter((row): row is [string, string] => !!row[1])
    .map(([label, value]) => ({ label, value }));

  // The website is a URL and needs no resolving; the deck plan is a file in
  // the vault and is written relative to where this sheet lands, so the link
  // still works in the browser of whoever the sheet was sent to. A plan the
  // note names but the vault does not have prints no row at all, which is the
  // rule every other line here follows.
  if (vehicle.website) {
    rest.push({
      label: t('fieldNames.website'),
      value: vehicle.website,
      href: vehicle.website,
    });
  }
  const plan = vehicle.deckPlan ? resolveReference(app, vehicle.deckPlan) : null;
  if (plan?.kind === 'url') {
    rest.push({
      label: t('fieldNames.deckPlan'),
      value: plan.url,
      href: plan.url,
    });
  } else if (plan?.kind === 'file') {
    rest.push({
      label: t('fieldNames.deckPlan'),
      value: plan.file.name,
      href: encodeURI(relativeVaultPath(sheetFolder, plan.file.path)),
    });
  }
  return rest;
}

/** What a prospect can be about. Every note the gallery draws a card for, minus a booking. */
export type ProspectSubject =
  | { kind: 'vehicle'; vehicle: TravelVehicle }
  | { kind: 'excursion'; excursion: TravelExcursion }
  | { kind: 'place'; place: TravelPlace }
  | { kind: 'city'; city: TravelCity }
  | { kind: 'state'; state: TravelState }
  | { kind: 'country'; country: TravelCountry };

/** The note a subject is, so the caller can name the file and find the folder. */
function subjectFile(subject: ProspectSubject) {
  switch (subject.kind) {
    case 'vehicle':
      return subject.vehicle.file;
    case 'excursion':
      return subject.excursion.file;
    case 'place':
      return subject.place.file;
    case 'city':
      return subject.city.file;
    case 'state':
      return subject.state.file;
    case 'country':
      return subject.country.file;
  }
}

function subjectTitle(subject: ProspectSubject): string {
  switch (subject.kind) {
    case 'vehicle':
      return subject.vehicle.title;
    case 'excursion':
      return subject.excursion.title;
    case 'place':
      return subject.place.title;
    case 'city':
      return subject.city.title;
    case 'state':
      return subject.state.title;
    case 'country':
      return subject.country.title;
  }
}

/** The picture and the pictures, which every subject carries in the same two properties. */
function subjectMedia(subject: ProspectSubject) {
  switch (subject.kind) {
    case 'vehicle':
      return subject.vehicle;
    case 'excursion':
      return subject.excursion;
    case 'place':
      return subject.place;
    case 'city':
      return subject.city;
    case 'state':
      return subject.state;
    case 'country':
      return subject.country;
  }
}

/** Rows the note actually carries. A line saying "Rating: --" would be stating an absence, which is the one thing an omitted line cannot do wrong. */
function rows(entries: [string, string | null][]): ProspectFact[] {
  return entries
    .filter((row): row is [string, string] => !!row[1])
    .map(([label, value]) => ({ label, value }));
}

/**
 * How long it takes, where it is offered, and who runs it.
 *
 * No price and no rating: an excursion note carries neither, on purpose. The
 * price is a fact about the sailing that books it, and a page here quoting one
 * would be quoting a figure this note does not have.
 */
function excursionFacts(excursion: TravelExcursion): ProspectFact[] {
  const facts = rows([
    [t('fieldNames.duration'), excursion.duration],
    [
      t('prospect.where'),
      hierarchy(
        excursion.city?.title ?? excursion.cityTitle,
        excursion.country?.title ?? excursion.countryTitle
      ),
    ],
    [t('fieldNames.operator'), excursion.operatorTitle],
  ]);
  if (excursion.website) {
    facts.push({
      label: t('fieldNames.website'),
      value: excursion.website,
      href: excursion.website,
    });
  }
  return facts;
}

function stars(rating: number | null): string | null {
  return rating === null ? null : '\u2605'.repeat(Math.max(0, Math.min(5, Math.round(rating))));
}

function visitFacts(visited: boolean, lastVisit: string | null): [string, string | null][] {
  return [
    [t('dashboard.visited'), visited ? t('prospect.yes') : t('prospect.notYet')],
    [t('fieldNames.lastVisit'), lastVisit],
  ];
}

function placeFacts(place: TravelPlace): ProspectFact[] {
  const facts = rows([
    // The subtype first: on a grid of hotels, "Hotel" against "Apartment" is
    // the line that separates two notes before anything else does.
    [t('prospect.kind'), place.accommodationType ?? place.fnbType],
    [t('prospect.status'), place.accommodationStatus],
    [t('fieldNames.address'), place.address],
    [t('fieldNames.rating'), stars(place.rating)],
    [
      t('prospect.where'),
      hierarchy(place.city?.title ?? place.cityTitle, place.country?.title ?? place.countryTitle),
    ],
    [t('fieldNames.geoLocation'), place.geoLocation?.join(', ') ?? null],
    ...visitFacts(place.visited, place.lastVisit),
  ]);
  if (place.website) {
    facts.push({
      label: t('fieldNames.website'),
      value: place.website,
      href: place.website,
    });
  }
  return facts;
}

function cityFacts(city: TravelCity): ProspectFact[] {
  return rows([
    [
      t('prospect.where'),
      hierarchy(city.state?.title ?? city.stateTitle, city.country?.title ?? city.countryTitle),
    ],
    [t('fieldNames.geoLocation'), city.geoLocation?.join(', ') ?? null],
    ...visitFacts(city.visited, city.lastVisit),
  ]);
}

function stateFacts(state: TravelState): ProspectFact[] {
  return rows([
    [t('fieldNames.country'), state.country?.title ?? state.countryTitle],
    [t('fieldNames.capital'), state.capital?.title ?? state.capitalTitle],
    [
      t('galleryView.filters.city'),
      state.cities.length > 0 ? state.cities.map((city) => city.title).join(', ') : null,
    ],
  ]);
}

function countryFacts(country: TravelCountry): ProspectFact[] {
  return rows([
    [t('fieldNames.capital'), country.capital?.title ?? country.capitalTitle],
    [
      t('galleryView.filters.state'),
      country.states.length > 0 ? country.states.map((state) => state.title).join(', ') : null,
    ],
  ]);
}

/** "City, Country", or whichever half the note resolved. The same string every card's meta row uses. */
function hierarchy(city: string | null, country: string | null): string | null {
  const parts = [city, country].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Which trips belong on this page.
 *
 * Three different questions, and the difference is the point. A ship's trips
 * are the ones with a leg aboard her; a place's are the ones that stopped
 * there; a region's are the ones that named it or stopped anywhere inside it,
 * because no trip names a State at all and a Country is named in frontmatter
 * rather than visited.
 */
function subjectTrips(board: TravelBoard, subject: ProspectSubject) {
  switch (subject.kind) {
    case 'vehicle':
      return tripsOnVehicle(board, subject.vehicle.title);
    // An excursion's trips are the ones with a stop that IS it, which is a
    // third question again: not a leg aboard, not a stop at a place, but a
    // stop naming the outing itself.
    case 'excursion':
      return tripsWithExcursion(board, subject.excursion.title);
    case 'place':
      return relatedTrips(board, subject.place.title);
    case 'city':
      return tripsCovering(board, [subject.city.title]);
    case 'state':
      return tripsCovering(
        board,
        subject.state.cities.map((city) => city.title)
      );
    case 'country':
      return tripsCovering(board, [
        subject.country.title,
        ...subject.country.states.flatMap((state) => state.cities.map((city) => city.title)),
      ]);
  }
}

/**
 * The top of the page: what it is called, the line under that, and what kind
 * of thing it is and where.
 *
 * One function rather than three fields assembled at the call site, and
 * exported for its own tests. Three times in a week a line that joined two
 * tested halves was wrong and no test could see it (note 45), and every one of
 * them looked exactly like `description: <the right expression>` inside a
 * builder that needs an App. This one does not need an App, so it does not
 * live in one.
 */
export function prospectHeader(subject: ProspectSubject): {
  title: string;
  description: string | null;
  meta: (string | null)[];
} {
  return {
    title: subjectTitle(subject),
    // Every subject carries one now, in the property a Person and a Company
    // already used. It was a vehicle's alone until the cover dialog gave the
    // other six somewhere to type it.
    description: subjectMedia(subject).description,
    meta: subjectMeta(subject),
  };
}

/** The line under the title: what it is, and where. Whatever the note can say, already formatted. */
function subjectMeta(subject: ProspectSubject): (string | null)[] {
  switch (subject.kind) {
    case 'vehicle':
      return [subject.vehicle.operatorTitle, travelModeLabel(subject.vehicle.mode)];
    case 'excursion':
      return [
        subject.excursion.operatorTitle,
        hierarchy(
          subject.excursion.city?.title ?? subject.excursion.cityTitle,
          subject.excursion.country?.title ?? subject.excursion.countryTitle
        ),
      ];
    case 'place':
      return [
        t(`galleryView.filters.${subject.place.kind}`),
        hierarchy(
          subject.place.city?.title ?? subject.place.cityTitle,
          subject.place.country?.title ?? subject.place.countryTitle
        ),
      ];
    case 'city':
      return [
        t('galleryView.filters.city'),
        hierarchy(
          subject.city.state?.title ?? subject.city.stateTitle,
          subject.city.country?.title ?? subject.city.countryTitle
        ),
      ];
    case 'state':
      return [
        t('galleryView.filters.state'),
        subject.state.country?.title ?? subject.state.countryTitle,
      ];
    case 'country':
      return [t('galleryView.filters.country'), null];
  }
}

/** The whole page as a model, before it is markup. Separate from the writing so a caller could preview it. */
export async function buildProspect(
  app: App,
  settings: APERtrailSettings,
  subject: ProspectSubject,
  today: Date = new Date()
): Promise<Prospect> {
  const file = subjectFile(subject);
  const media = subjectMedia(subject);

  const gallery: ProspectPicture[] = [];
  for (const entry of media.gallery) {
    gallery.push(await picture(app, entry.image, entry.caption));
  }

  const cabins: ProspectCabin[] = [];
  if (subject.kind === 'vehicle') {
    for (const cabin of subject.vehicle.cabins) {
      cabins.push({
        name: cabin.name,
        description: cabin.description,
        picture: cabin.image ? await picture(app, cabin.image, null) : null,
      });
    }
  }

  // Read here rather than passed in: a note does not know which trips went
  // there, and that answer only exists once the trips have been read.
  const board = readTravelBoard(app, settings, formatDayTitle(today));

  return {
    ...prospectHeader(subject),
    highlights: media.highlights,
    overview: proseBlocks(await loadNoteSummary(app, file)),
    hero: media.image ? await picture(app, media.image, null) : null,
    cabins,
    facts: subjectFacts(app, settings, subject),
    gallery,
    trips: subjectTrips(board, subject).map((visit) => ({
      title: visit.trip.title,
      when: formatDay(visit.trip.departure),
    })),
    labels: {
      highlights: t('prospect.highlights'),
      overview: t('prospect.overview'),
      cabins: t('vehicleBrochure.cabins'),
      facts: subject.kind === 'vehicle' ? t('vehicleBrochure.facts') : t('prospect.facts'),
      gallery: t('vehicleBrochure.gallery'),
      trips: subject.kind === 'vehicle' ? t('vehicleBrochure.trips') : t('prospect.trips'),
    },
    caveat: t('prospect.caveat'),
    footer: t('vehicleBrochure.footer', { date: formatMediumDate(today) }),
  };
}

function subjectFacts(
  app: App,
  settings: APERtrailSettings,
  subject: ProspectSubject
): ProspectFact[] {
  switch (subject.kind) {
    case 'vehicle':
      return vehicleFacts(app, settings, subject.vehicle);
    case 'excursion':
      return excursionFacts(subject.excursion);
    case 'place':
      return placeFacts(subject.place);
    case 'city':
      return cityFacts(subject.city);
    case 'state':
      return stateFacts(subject.state);
    case 'country':
      return countryFacts(subject.country);
  }
}

export async function exportProspect(
  app: App,
  settings: APERtrailSettings,
  subject: ProspectSubject
): Promise<void> {
  const sheet = await buildProspect(app, settings, subject);
  const file = subjectFile(subject);
  const suffix =
    subject.kind === 'vehicle' ? t('vehicleBrochure.fileSuffix') : t('prospect.fileSuffix');
  const name = sanitizeTitle(`${subjectTitle(subject)} ${suffix}`);

  await writeSheet(app, exportPath(settings, file.path, name), buildProspectHtml(sheet), {
    written: 'vehicleBrochure.written',
    failed: 'vehicleBrochure.failed',
  });
}
