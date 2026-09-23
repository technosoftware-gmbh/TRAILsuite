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
import { App, getIcon } from 'obsidian';
import { caseFold, parseDayTitle, proseBlocks, sanitizeTitle } from '@technosoftware/trail-core';
import { sheetCredit } from '../../shared/sheet-credit';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip, TravelVehicle } from '../../vault/types';
import { inlinePicture } from '../../shared/inline-picture';
import { itineraryDays } from '../itinerary-days';
import { clockTime, endpointDate, RelativeEndpoint, tripDayCount } from '../relative-days';
import { legClock, legDayText, legRouteText, legWhen } from '../journey-text';
import { estimateLabels } from '../costs/estimate-labels';
import { plannedByCategory, plannedTotal } from '../costs/planned-total';
import { legRoute, tripItemEstimates } from '../costs/estimates';
import { legsArrivingOn, legsDepartingOn } from '../leg-days';
import { isFlight, travelModeIcon } from '../../shared/travel-mode';
import { ParsedTripLineChoice } from '../trip-note';
import { cabinDescription } from '../../places/vehicle-note';
import { optionalItems, optionalTotal, plannedEstimates } from '../costs/estimates';
import { exportPath } from '../../shared/export-folder';
import { writeSheet } from '../../shared/write-sheet';
import { loadNoteSummary } from '../../shared/note-summary';
import {
  buildTripDocumentHtml,
  TripDocument,
  TripDocumentCostRow,
  TripDocumentDay,
  TripDocumentExtension,
  TripDocumentFare,
  TripDocumentJourney,
  TripDocumentOptional,
  TripDocumentPerPerson,
  TripDocumentPicture,
  TripDocumentRoom,
} from '../export-trip-document';
import { formatMediumDate, formatMoney } from '../../shared/display';
import { lineFigure, VariedLine } from '../costs/line-variants';
import { namesSomebodyElse, perPersonShares } from '../costs/per-person';

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
 * The prices a line can be bought at, as the document prints them.
 *
 * All of them, not only the chosen one: this page is what somebody decides
 * from, and a brochure listing only the cabin already ticked would have taken
 * the decision off the page it exists to support.
 */
function documentFares(
  line: ParsedTripLineChoice & { currency: string | null },
  trip: TravelTrip,
  settings: APERtrailSettings,
  /** The vehicle the line is taken on, for the cabin descriptions it holds. Null for every line that is not a leg with one. */
  vehicle: TravelVehicle | null = null
): TripDocumentFare[] {
  return line.variants.map((variant, index) => ({
    label: variant.name ?? t('itinerary.variantUnnamed', { number: index + 1 }),
    // The ship's own words where the trip does not have its own: a cabin is
    // described once, in the ship's note, and priced per sailing here.
    description: variant.description ?? cabinDescription(vehicle, variant.name),
    amount:
      variant.cost === null
        ? null
        : formatMoney(
            variant.cost,
            variant.currency ?? line.currency ?? trip.currency ?? settings.homeCurrency
          ),
    chosen: variant.chosen,
  }));
}

/**
 * What a line that may not happen says about itself, or null for the ordinary
 * one.
 *
 * **With its price, where it has one.** An optional line is the one line on
 * the page somebody has to decide about while reading it, and the price is
 * most of the decision -- "Optional" alone sends them to the cost table at the
 * back for a figure that belongs beside the paragraph. An ordinary stop says
 * nothing here: it is happening, and what the trip costs is the table's job.
 *
 * The unit is printed with the amount because it changes the sum: 119 francs
 * for two people is not what 119 francs per person is, and the row is read by
 * somebody deciding for a household rather than for themselves.
 *
 * A line priced through variants says nothing here either -- they are listed
 * under it in full, with their own names and figures, and repeating one of
 * them in the heading would be picking a favourite the note did not.
 *
 * `trip` and `settings` are required rather than optional because they are
 * only ever there to fall back to for the currency, and an optional parameter
 * would have let a call site forget one and print the label with no price at
 * all -- silently, and only for the lines whose own note omits the currency.
 * That is the join this file keeps getting wrong; a required parameter turns
 * it into a typecheck instead of a test.
 */
export function optionalLabel(
  line: VariedLine,
  trip: TravelTrip,
  settings: APERtrailSettings
): string | null {
  if (!line.optional) return null;
  const said = line.chosen ? t('tripDocument.optionalTaken') : t('tripDocument.optional');

  if (line.variants.length > 0) return said;
  const figure = lineFigure(line);
  if (figure.cost === null) return said;

  const money = formatMoney(figure.cost, figure.currency ?? trip.currency ?? settings.homeCurrency);
  return `${said} \u00b7 ${money} ${t(`costs.unit.${figure.costUnit}`)}`;
}

/** Names as one line of text, in the order the note gives them. */
function joinNames(names: readonly string[]): string {
  return names.join(', ');
}

/**
 * Who a line is for, where that is not the whole party: "Only Anna".
 *
 * Nothing for a line that names nobody or names exactly the participants,
 * because those are the lines everybody is on, and printing every name on
 * every row would hide the few rows that differ.
 */
export function linePersons(persons: readonly string[], trip: TravelTrip): string | null {
  if (!namesSomebodyElse(persons, trip.personTitles)) return null;
  return t('tripDocument.onlyFor', { names: joinNames(persons) });
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
export function documentDays(trip: TravelTrip, settings: APERtrailSettings): TripDocumentDay[] {
  return itineraryDays(trip.stops, trip.departure, trip.days, trip.transport).map((group) => ({
    label: group.number === null ? null : t('tripDocument.day', { number: group.number }),
    title: group.title,
    date: group.date ? formatDay(group.date) : null,
    // What a leg says outside its own section: that it leaves today, and that
    // it lands today. Nothing else -- see trips/leg-days.ts.
    arrivals: legsArrivingOn(trip.transport, group, trip.departure).map((leg) => ({
      text: t('tripDocument.arrivals', { legs: legRouteText(leg) }),
      icon: travelModeIcon(leg.mode),
    })),
    // A flight takes off, everything else leaves: "Abflug" beside "Abfahrt",
    // the word the itinerary in the note uses on the same line.
    departures: legsDepartingOn(trip.transport, group, trip.departure).map((leg) => ({
      text: t(isFlight(leg.mode) ? 'tripDocument.flights' : 'tripDocument.departures', {
        legs: legDayText(leg, trip.departure),
      }),
      icon: travelModeIcon(leg.mode),
    })),
    note: group.note,
    entries: group.stops.map((stop) => ({
      time: timeRange(stop.from, stop.to),
      place: stop.placeTitle,
      // The raw title, so a tour the vault has no note for still prints. The
      // description below is the half that needs the note.
      excursion: stop.excursionTitle,
      about: stop.excursion?.description ?? null,
      note: stop.note,
      optional: optionalLabel(stop, trip, settings),
      persons: linePersons(stop.persons, trip),
      fares: documentFares(stop, trip, settings),
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
 *
 * Exported for its own suite: it needs no App, and the one thing it does that
 * a test of the markup cannot see is decide what each row is made of -- which
 * is where the ship's own words come from.
 */
export function documentTransport(
  trip: TravelTrip,
  settings: APERtrailSettings
): TripDocumentJourney[] {
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
        // The ship between who runs it and the booking reference, which is the
        // order somebody reads a ticket in.
        leg.vehicleTitle,
        leg.reference,
      ]
        .filter((part): part is string => !!part)
        .join(' \u00b7 ') || null,
    when: legWhen(leg, trip.departure),
    about: leg.vehicle?.description ?? null,
    fares: documentFares(leg, trip, settings, leg.vehicle),
    optional: optionalLabel(leg, trip, settings),
    persons: linePersons(leg.persons, trip),
    rooms: [],
  }));
}

/**
 * Where the trip sleeps, one row per stay and the rooms under it.
 *
 * A party of three in two rooms is written as two night entries at the same
 * place over the same days, each naming who is in it. Printed as two stays,
 * that read as two hotels; so entries sharing the place and both ends are one
 * stay here, in the order the first of them appears, with a room each.
 *
 * A stay with a single entry prints as it always has, plus who it is for when
 * that is not everybody. Exported for its own suite.
 */
export function documentStays(
  trip: TravelTrip,
  settings: APERtrailSettings
): TripDocumentJourney[] {
  const groups = new Map<string, typeof trip.nights>();
  for (const night of trip.nights) {
    const key = [
      caseFold(night.accommodationTitle),
      night.checkInDay ?? night.checkIn ?? '',
      night.checkOutDay ?? night.checkOut ?? '',
    ].join('|');
    const group = groups.get(key);
    if (group) group.push(night);
    else groups.set(key, [night]);
  }

  return [...groups.values()].map((nights) => {
    const [first] = nights;
    const single = nights.length === 1;
    const rooms: TripDocumentRoom[] = single
      ? []
      : nights.map((night) => ({
          persons: night.persons.length > 0 ? joinNames(night.persons) : null,
          optional: optionalLabel(night, trip, settings),
          fares: documentFares(night, trip, settings),
        }));
    return {
      time: null,
      label: first.accommodationTitle ?? t('itinerary.unnamedNight'),
      detail: null,
      when: journeyWhen(
        { day: first.checkInDay, value: first.checkIn },
        { day: first.checkOutDay, value: first.checkOut },
        trip.departure
      ),
      // A stay is at a place, and a place's own words belong on the place's own
      // prospect rather than under every night somebody spent there.
      about: null,
      fares: single ? documentFares(first, trip, settings) : [],
      optional: single ? optionalLabel(first, trip, settings) : null,
      persons: single ? linePersons(first.persons, trip) : null,
      rooms,
    };
  });
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
 * What one follow-on trip comes to, in its own currency.
 *
 * The same arithmetic the trip's own costs section does, run over the other
 * note. Its own currency and not this trip's: converting here would be
 * arithmetic the reader cannot check, which is the rule `plannedByCategory`
 * already follows for a line in a foreign currency.
 */
function extensionTotal(trip: TravelTrip, settings: APERtrailSettings): string | null {
  const currency = trip.currency ?? settings.homeCurrency;
  const lines = plannedByCategory(
    trip.budget,
    plannedEstimates(tripItemEstimates(trip, estimateLabels())),
    currency
  );
  const total = plannedTotal(lines);
  return total === null ? null : formatMoney(total, currency);
}

/**
 * The trips that follow this one, earliest first.
 *
 * Read off the board rather than off the note: the link lives on each child,
 * and this list is derived. One level, never a chain -- an extension of an
 * extension belongs on ITS own sheet, and following the chain here would
 * print a trip somebody has not opened.
 */
export function documentExtensions(
  trip: TravelTrip,
  settings: APERtrailSettings
): TripDocumentExtension[] {
  return trip.extensions.map((extension) => ({
    title: extension.title,
    when: journeyWhen(
      { day: null, value: extension.departure },
      { day: null, value: extension.return },
      extension.departure
    ),
    about: extension.subtitle,
    total: extensionTotal(extension, settings),
  }));
}

/**
 * Each person's part of the trip, as the document prints it.
 *
 * Null unless at least two people are named somewhere: one traveller's share
 * is the whole plan again. The hint is set when the trip has a category
 * budget, because then the planned total above counts that budget and these
 * totals, built from the lines alone, need not add up to it.
 */
export function documentPerPerson(
  trip: TravelTrip,
  settings: APERtrailSettings
): TripDocumentPerPerson | null {
  const currency = trip.currency ?? settings.homeCurrency;
  const shares = perPersonShares(
    tripItemEstimates(trip, estimateLabels()),
    trip.personTitles,
    currency
  ).filter((share) => share.items.length > 0);
  if (shares.length < 2) return null;

  return {
    label: t('tripDocument.perPerson'),
    hint: trip.budget.length > 0 ? t('tripDocument.perPersonHint') : null,
    people: shares.map((share) => ({
      person: share.person,
      lines: share.items.map((item) => ({
        label: item.label,
        // What the figure is a part of, only where the line is something shared
        // -- a room, a car -- rather than a price per head that is already each
        // person's own.
        detail:
          item.sharedBy > 1 && (item.unit === 'total' || item.unit === 'night')
            ? t('tripDocument.shareOf', {
                count: item.sharedBy,
                amount: formatMoney(item.lineAmount, item.currency ?? currency),
              })
            : null,
        amount: formatMoney(item.amount, item.currency ?? currency),
      })),
      total:
        share.total === null
          ? null
          : {
              label: share.partial ? t('tripDocument.perPersonPartial') : t('costs.planned'),
              amount: formatMoney(share.total, currency),
            },
    })),
  };
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
): {
  costs: TripDocumentCostRow[];
  costTotal: TripDocumentCostRow | null;
  costOptional: TripDocumentOptional | null;
} {
  const currency = trip.currency ?? settings.homeCurrency;
  const estimates = tripItemEstimates(trip, estimateLabels());
  const lines = plannedByCategory(trip.budget, plannedEstimates(estimates), currency);
  const total = plannedTotal(lines);
  const ceiling = optionalTotal(trip, estimateLabels(), currency);

  // Each extra in the currency its own line states, which is the one the reader
  // would be quoted. The ceiling below sums only the trip's own currency, the
  // rule every total here follows, so a row in another currency is on the page
  // without being folded into a figure nobody could check.
  const extras = optionalItems(trip, estimateLabels()).map((item) => ({
    label: item.label,
    amount: formatMoney(item.amount, item.currency ?? currency),
  }));

  const costOptional =
    extras.length === 0
      ? null
      : {
          label: t('tripDocument.optionalTotal'),
          lines: extras,
          ceiling:
            ceiling === null
              ? null
              : { label: t('costs.optionalAll'), amount: formatMoney(ceiling, currency) },
        };

  if (total === null) return { costs: [], costTotal: null, costOptional };

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
    costOptional,
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

/**
 * The drawing for every icon a day's leg line names, as SVG markup.
 *
 * Obsidian's own icon, so the printed day shows the same plane or ship as the
 * itinerary in the note. Inline rather than linked: the document is one file
 * that opens and prints anywhere, with no icon font to find.
 */
function legIcons(days: TripDocumentDay[]): Record<string, string> {
  const icons: Record<string, string> = {};
  for (const day of days) {
    for (const line of [...day.arrivals, ...day.departures]) {
      if (line.icon in icons) continue;
      const svg = getIcon(line.icon);
      // Serialised rather than read back as markup, which also writes the SVG
      // namespace out, so the drawing survives as a file of its own.
      if (svg) icons[line.icon] = new XMLSerializer().serializeToString(svg);
    }
  }
  return icons;
}

/** The whole document as a model, before it is markup. Separate from the writing so a caller could preview it. */
export async function buildTripDocument(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip,
  today: Date = new Date()
): Promise<TripDocument> {
  const overview = await loadNoteSummary(app, trip.file);

  const gallery: TripDocumentPicture[] = [];
  for (const entry of trip.gallery) gallery.push(await picture(app, entry.image, entry.caption));

  const days = documentDays(trip, settings);

  return {
    title: trip.title,
    subtitle: trip.subtitle,
    meta: [
      trip.country?.title ?? trip.countryTitle,
      dateRange(trip),
      lengthLine(trip),
      trip.personTitles.length > 0
        ? t('tripDocument.travellers', { names: joinNames(trip.personTitles) })
        : null,
    ],
    hero: trip.image ? await picture(app, trip.image, null) : null,
    highlights: trip.highlights,
    overview: proseBlocks(overview),
    days,
    icons: legIcons(days),
    transport: documentTransport(trip, settings),
    stays: documentStays(trip, settings),
    transportHint: transportHint(trip),
    ...documentCosts(trip, settings),
    costPerPerson: documentPerPerson(trip, settings),
    extensions: documentExtensions(trip, settings),
    // Said only where there is something to say it about, so the sentence
    // appears where it explains a figure and nowhere else.
    extensionsHint: trip.extensions.length > 0 ? t('tripDocument.extensionsHint') : null,
    gallery,
    labels: {
      highlights: t('tripDocument.highlights'),
      overview: t('tripDocument.overview'),
      itinerary: t('tripDocument.itinerary'),
      transport: t('tripDocument.transport'),
      stays: t('tripDocument.stays'),
      costs: t('tripDocument.costs'),
      extensions: t('tripDocument.extensions'),
      gallery: t('tripDocument.gallery'),
      fareChosen: t('tripDocument.variantChosen'),
    },
    caveat: t('tripDocument.caveat'),
    footer: sheetCredit(
      settings,
      (author) => t('tripDocument.footer', { author, date: formatMediumDate(today) }),
      () => t('tripDocument.footerAnonymous', { date: formatMediumDate(today) })
    ),
  };
}

/** Writes the document into the trip's exports folder, says where it went, and opens it. */
export async function exportTripDocument(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip
): Promise<void> {
  const sheet = await buildTripDocument(app, settings, trip);
  const name = sanitizeTitle(`${trip.title} ${t('tripDocument.fileSuffix')}`);
  await writeSheet(app, exportPath(settings, trip.file.path, name), buildTripDocumentHtml(sheet), {
    written: 'tripDocument.written',
    failed: 'tripDocument.failed',
  });
}
