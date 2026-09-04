/**
 * Turns one trip note into a document on disk.
 *
 * The App-bound half: it reads the trip, its overview out of the note body,
 * and every picture it names, formats each figure through the same helpers
 * the blocks draw with, and hands the result to the pure builder.
 * `trips/export-trip-document.ts` turns that into markup and knows nothing
 * about Obsidian.
 *
 * The same two decisions the other two sheets took. It is written INTO the
 * vault rather than offered as a download, because a plugin cannot hand a
 * file to the operating system and a vault is where the user's own files
 * already live. And it overwrites a document of the same name without
 * asking: it is a rendering of a note, not something anybody edits, and a
 * folder of "Shongololo 2.html" would be worse than a stale copy replaced.
 */
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { parseDayTitle, sanitizeTitle } from 'trail-core';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip } from '../../vault/types';
import { ABSOLUTE_URL_RE, resolveImageFile } from '../../ui/components/image-resolve';
import { ensureParentFolders } from '../../shared/note-creation';
import { itineraryDays } from '../itinerary-days';
import { clockTime, endpointDate, RelativeEndpoint, tripDayCount } from '../relative-days';
import { legClock, legWhen } from '../journey-text';
import { estimateLabels } from '../costs/estimate-labels';
import { plannedByCategory, plannedTotal } from '../costs/planned-total';
import { legRoute, tripItemEstimates } from '../costs/estimates';
import { tripExportFolder } from '../trip-folder';
import { loadTripSummary } from '../write-trip-summary';
import {
  buildTripDocumentHtml,
  TripDocument,
  TripDocumentCostRow,
  TripDocumentDay,
  TripDocumentJourney,
  TripDocumentPicture,
} from '../export-trip-document';
import { formatMediumDate, formatMoney } from '../../shared/display';

/**
 * Longest edge a picture is scaled to before it goes into the file.
 *
 * Wider than the field sheet's 1400, because this one has a hero picture
 * across the full 190 mm of an A4 page where that one has 52 mm thumbnails.
 * 1800 is over 240 dpi at that width, which is more than a page printed at
 * home resolves, and it keeps a twenty-picture gallery inside the few
 * megabytes a file has to stay under to be worth mailing.
 */
const MAX_IMAGE_EDGE = 1800;

/**
 * A picture as something an `<img>` can use, downscaled on the way.
 *
 * An external URL is left exactly as it stands: there are no bytes in the
 * vault to inline, and the URL goes on working wherever the file is copied
 * as long as there is a network -- which beats the alternative of printing
 * nothing. Everything else is read out of the vault and re-encoded, because
 * the whole point of the export is a file that needs nothing around it.
 *
 * Downscaling matters more than it looks: a gallery of twenty
 * straight-out-of-camera frames would be two hundred megabytes, which is not
 * a file anybody sends anywhere. Anything the canvas cannot read (an unusual
 * format, a file that has gone missing) comes back null, and the caption
 * prints without it.
 */
async function inlinePicture(app: App, value: string): Promise<string | null> {
  if (ABSOLUTE_URL_RE.test(value)) return value;

  const file = resolveImageFile(app, value);
  if (!file) return null;

  try {
    const bytes = await app.vault.readBinary(file);
    const bitmap = await createImageBitmap(new Blob([bytes]));

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = activeDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    // A picture that cannot be read is not a reason to refuse the document.
    return null;
  }
}

async function picture(
  app: App,
  value: string,
  caption: string | null
): Promise<TripDocumentPicture> {
  return { src: await inlinePicture(app, value), caption };
}

function formatDay(value: string | null): string | null {
  const parsed = parseDayTitle((value ?? '').slice(0, 10));
  return parsed ? formatMediumDate(parsed) : null;
}

/** The trip's own dates. Absent dates print nothing rather than half a range. */
function dateRange(trip: TravelTrip): string | null {
  const from = formatDay(trip.departure);
  const to = formatDay(trip.return);
  if (from && to) return from === to ? from : `${from} - ${to}`;
  return from ?? to;
}

/** "09:00" or "09:00 - 13:30", the same three shapes the itinerary block draws. */
function timeRange(from: string | null, to: string | null): string | null {
  // `clockTime` rather than `dateTimeTimePart`, because a stop on a trip with
  // no dates carries a bare time and would otherwise print none at all.
  const start = clockTime(from);
  const end = clockTime(to);
  if (start && end) return `${start} - ${end}`;
  if (start) return t('itinerary.fromTime', { time: start });
  if (end) return t('itinerary.untilTime', { time: end });
  return null;
}

/**
 * The itinerary, as numbered days.
 *
 * **The day's own number, not a running count.** A trip written as day one to
 * day twelve says which day each stop is on, and a counter would renumber them
 * the moment a day had no stop in it -- which is exactly the case a brochure
 * has, where day four is a day at sea with nothing booked. A dated trip gets
 * its numbers derived from the dates, so both kinds print "Day 3".
 *
 * A group with no number at all is the stops before the first dated one on a
 * trip that says nothing else. It prints unnumbered, which is what it is.
 */
function documentDays(trip: TravelTrip): TripDocumentDay[] {
  return itineraryDays(trip.stops, trip.departure, trip.days).map((group) => ({
    label: group.number === null ? null : t('tripDocument.day', { number: group.number }),
    title: group.title,
    date: group.date ? formatDay(group.date) : null,
    note: group.note,
    entries: group.stops.map((stop) => ({
      time: timeRange(stop.from, stop.to),
      place: stop.placeTitle,
      note: stop.note,
    })),
  }));
}

/**
 * How long the trip runs, for deciding what counts as outside it.
 *
 * Its own function because two things need it and they need it for different
 * reasons: the meta line says it, and the transport section uses it to tell a
 * return flight the day after the trip from an ordinary day of it.
 */
function tripLength(trip: TravelTrip): number | null {
  return tripDayCount(trip.departure, trip.return, [
    ...trip.days.map((day) => day.day),
    ...trip.stops.map((stop) => stop.day),
    ...trip.nights.map((night) => night.checkOutDay),
    ...trip.transport.map((leg) => leg.toDay ?? leg.day),
  ]);
}

/**
 * When a leg or a stay happens, said the way the reader can place it.
 *
 * Dates once the trip has them, and day numbers before that -- "Tag 0 -> Tag
 * 1" for an overnight flight leaving the evening before the trip starts.
 */
function journeyWhen(
  from: RelativeEndpoint,
  to: RelativeEndpoint,
  departure: string | null
): string | null {
  const dates = [endpointDate(from, departure), endpointDate(to, departure)].filter(
    (date): date is string => date !== null
  );
  if (dates.length > 0) {
    return [...new Set(dates)]
      .map((date) => formatDay(date))
      .filter((date): date is string => date !== null)
      .join(' \u2192 ');
  }

  const days = [from.day, to.day].filter((day): day is number => day !== null && day !== undefined);
  if (days.length === 0) return null;
  return [...new Set(days)].map((day) => t('tripDocument.day', { number: day })).join(' \u2192 ');
}

/**
 * The journey there and back, and where the trip sleeps.
 *
 * Their own sections rather than lines inside the days. The Reiseverlauf is
 * the trip itself, day one to the last day; a flight is settled later and
 * lands outside those days as often as not.
 */
function documentTransport(trip: TravelTrip): TripDocumentJourney[] {
  const joiner = t('itinerary.legJoiner');
  return trip.transport.map((leg) => ({
    // A flight card: when it leaves, then the clock with `+1` hanging off the
    // arrival. Not both day numbers, which said the same thing twice and in a
    // vocabulary no timetable uses.
    time: legClock(leg, trip.departure),
    label: legRoute(leg, joiner) ?? t('itinerary.unnamedLeg'),
    detail:
      [
        t(leg.direction === 'inbound' ? 'itinerary.inbound' : 'itinerary.outbound'),
        leg.carrier,
        leg.reference,
      ]
        .filter((part): part is string => !!part)
        .join(' \u00b7 ') || null,
    when: legWhen(leg, trip.departure),
  }));
}

function documentStays(trip: TravelTrip): TripDocumentJourney[] {
  return trip.nights.map((night) => ({
    time: null,
    label: night.accommodationTitle ?? t('itinerary.unnamedNight'),
    detail: null,
    when: journeyWhen(
      { day: night.checkInDay, value: night.checkIn },
      { day: night.checkOutDay, value: night.checkOut },
      trip.departure
    ),
  }));
}

/**
 * What a day number outside the trip's own days means.
 *
 * Only when one is actually used, so the note explains something wherever it
 * appears. Under the heading rather than on each row: it is a fact about the
 * numbering, not about any one flight.
 */
function transportHint(trip: TravelTrip): string | null {
  const last = tripLength(trip);
  const days = trip.transport
    .flatMap((leg) => [leg.day, leg.toDay])
    .filter((day): day is number => day !== null);

  const early = days.some((day) => day < 1);
  const late = last !== null && days.some((day) => day > last);
  if (!early && !late) return null;

  return [early ? t('tripDocument.beforeStart') : null, late ? t('tripDocument.afterEnd') : null]
    .filter((part): part is string => part !== null)
    .join(' ');
}

/**
 * What the trip plans to cost, by category.
 *
 * The **budget** rather than the bookings, which is the difference between
 * this document and the cost sheet beside it. A brochure states a price; a
 * cost sheet states what has been spent against it. Printing the ledger here
 * would make this a second cost sheet that happened to have pictures.
 */
function documentCosts(
  trip: TravelTrip,
  settings: APERtrailSettings
): { costs: TripDocumentCostRow[]; costTotal: TripDocumentCostRow | null } {
  const currency = trip.currency ?? settings.homeCurrency;
  const lines = plannedByCategory(trip.budget, tripItemEstimates(trip, estimateLabels()), currency);
  const total = plannedTotal(lines);
  if (total === null) return { costs: [], costTotal: null };

  return {
    costs: lines.map((line) => ({
      label: t(`booking.category.${line.category}`),
      amount: formatMoney(line.amount, currency),
    })),
    costTotal: {
      // "Planned" rather than "Budget": the figures are budget lines where the
      // trip states one and its itinerary's own estimates where it does not,
      // and calling an estimate a budget claims somebody set a ceiling.
      label: t('costs.planned'),
      amount: formatMoney(total, currency),
    },
  };
}

/**
 * How long the trip is, in whole days, or null when it does not say.
 *
 * From its dates when it has them, and otherwise from the highest day number
 * anything on it names -- so an undated brochure still says "12 Tage" on its
 * first line, which is half of what that line is for.
 */
function lengthLine(trip: TravelTrip): string | null {
  const days = tripLength(trip);
  return days !== null && days > 0 ? t('tripDocument.days', { count: days }) : null;
}

/** The whole document as a model, before it is markup. Separate from the writing so a caller could preview it. */
export async function buildTripDocument(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip,
  today: Date = new Date()
): Promise<TripDocument> {
  const overview = await loadTripSummary(app, trip.file);

  const gallery: TripDocumentPicture[] = [];
  for (const entry of trip.gallery) gallery.push(await picture(app, entry.image, entry.caption));

  return {
    title: trip.title,
    subtitle: trip.subtitle,
    meta: [trip.country?.title ?? trip.countryTitle, dateRange(trip), lengthLine(trip)],
    hero: trip.image ? await picture(app, trip.image, null) : null,
    highlights: trip.highlights,
    // A blank line separates paragraphs, which is what it does everywhere
    // else in a note. A single-paragraph overview comes back as one entry.
    overview: overview
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== ''),
    days: documentDays(trip),
    transport: documentTransport(trip),
    stays: documentStays(trip),
    transportHint: transportHint(trip),
    ...documentCosts(trip, settings),
    gallery,
    labels: {
      highlights: t('tripDocument.highlights'),
      overview: t('tripDocument.overview'),
      itinerary: t('tripDocument.itinerary'),
      transport: t('tripDocument.transport'),
      stays: t('tripDocument.stays'),
      costs: t('tripDocument.costs'),
      gallery: t('tripDocument.gallery'),
    },
    caveat: t('tripDocument.caveat'),
    footer: t('tripDocument.footer', { date: formatMediumDate(today) }),
  };
}

/**
 * Writes the document into the trip's own folder and says where it went.
 *
 * Every folder above the file is created when it is missing, because a trip
 * that has never exported anything has no exports folder yet, and refusing
 * over that would be a plugin asking the user to make a directory for it.
 */
export async function exportTripDocument(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip
): Promise<void> {
  const sheet = await buildTripDocument(app, settings, trip);
  const folder = tripExportFolder(settings, {
    path: trip.file.path,
    basename: trip.file.basename,
  });
  const name = sanitizeTitle(`${trip.title} ${t('tripDocument.fileSuffix')}`);
  const path = normalizePath(folder ? `${folder}/${name}.html` : `${name}.html`);

  try {
    await ensureParentFolders(app, path);
    const existing = app.vault.getFileByPath(path);
    const html = buildTripDocumentHtml(sheet);
    if (existing instanceof TFile) await app.vault.modify(existing, html);
    else await app.vault.create(path, html);
    new Notice(t('tripDocument.written', { path }));
  } catch (err) {
    new Notice(err instanceof Error ? err.message : t('tripDocument.failed'));
  }
}
