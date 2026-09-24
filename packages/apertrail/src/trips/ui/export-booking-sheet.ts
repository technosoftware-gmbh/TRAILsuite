/**
 * Writes a trip's booking sheet into its exports folder.
 *
 * The App-bound half: `booking-sheet-lines.ts` decides what is on the sheet,
 * this file says it in the reader's language and formats, and
 * `export-booking-sheet.ts` turns it into a page. Written into the vault and
 * overwritten without asking, like the other three sheets.
 */
import { App } from 'obsidian';
import { caseFold, parseDayTitle, sanitizeTitle } from '@technosoftware/trail-core';
import { sheetCredit } from '../../shared/sheet-credit';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelBooking, TravelTrip } from '../../vault/types';
import { exportPath } from '../../shared/export-folder';
import { writeSheet } from '../../shared/write-sheet';
import { formatMediumDate, formatMoney } from '../../shared/display';
import { TRIP_LEG_MODES } from '../trip-note';
import {
  BookingChoice,
  BookingLegLine,
  BookingOpenItem,
  BookingOption,
  BookingPrice,
  BookingSection,
  BookingSheetLines,
  BookingState,
  BookingWhen,
  bookingSheetLines,
} from '../booking-sheet-lines';
import {
  BookingSheet,
  BookingSheetCell,
  BookingSheetTable,
  buildBookingSheetHtml,
} from '../export-booking-sheet';

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

/** A date where the trip has one, "Tag 3" where it has only days, nothing where it has neither. */
function whenText(at: BookingWhen): string | null {
  const date = formatDay(at.date);
  if (date) return date;
  return at.day === null ? null : t('tripDocument.day', { number: at.day });
}

function unitText(price: { unit: BookingPrice['unit'] }): string {
  return t(`costs.unit.${price.unit}`);
}

/**
 * What the line comes to, with the figure it was worked out from underneath
 * where the unit multiplied it: "CHF 8'958.00" over "CHF 4'479.00 pro Person".
 * An agent quotes per person and a household pays the sum, and the sheet is
 * laid beside both.
 */
function priceCell(price: BookingPrice | null, choiceOpen: boolean): BookingSheetCell {
  if (choiceOpen) return { main: t('bookingSheet.open'), open: true };
  if (!price) return { main: null };
  return {
    main: formatMoney(price.total, price.currency),
    sub:
      price.unit === 'total'
        ? null
        : `${formatMoney(price.cost, price.currency)} ${unitText(price)}`,
  };
}

function choiceCell(choice: BookingChoice | null, choiceOpen: boolean): BookingSheetCell {
  if (choiceOpen) return { main: t('bookingSheet.open'), open: true };
  if (!choice) return { main: null };
  return { main: choice.name, sub: choice.description };
}

/**
 * The reference where it is booked, and nothing where it is not: an empty
 * cell is the one an agent writes the new code into.
 */
function referenceCell(state: BookingState): BookingSheetCell {
  if (!state.booked) return { main: null };
  return state.reference
    ? { main: state.reference, sub: t('bookingSheet.booked') }
    : { main: t('bookingSheet.booked') };
}

function personsText(persons: string[] | null): string | null {
  return persons === null ? null : t('tripDocument.onlyFor', { names: persons.join(', ') });
}

/** Lines under a cell, joined; null when there are none. */
function subs(...parts: (string | null)[]): string | null {
  const kept = parts.filter((part): part is string => !!part);
  return kept.length === 0 ? null : kept.join(' · ');
}

function modeText(mode: string | null): string | null {
  if (!mode) return null;
  const known = (TRIP_LEG_MODES as readonly string[]).includes(mode);
  return known ? t(`modals.tripEditor.mode.${mode}`) : mode;
}

function routeText(leg: BookingLegLine): string | null {
  const ends = [leg.origin, leg.destination].filter((end): end is string => !!end);
  return ends.length === 0 ? null : ends.join(` ${t('itinerary.legJoiner')} `);
}

/**
 * When a leg leaves, and where it arrives on another day, until when.
 *
 * One night beside a clock is the `+1` on the arrival time, the way a
 * timetable prints it; longer than that, the date cell says both ends and how
 * many nights, which is what a fifteen-day voyage needs.
 */
function legDateCell(leg: BookingLegLine): BookingSheetCell {
  const long = leg.nights !== null && (leg.nights > 1 || leg.arrives === null);
  const end = long && leg.end ? whenText(leg.end) : null;
  return {
    main: whenText(leg.start),
    sub: long
      ? subs(
          end ? t('bookingSheet.until', { date: end }) : null,
          t('itinerary.legNights', { count: leg.nights ?? 0 })
        )
      : null,
  };
}

function arrivesText(leg: BookingLegLine): string | null {
  if (leg.arrives === null) return null;
  return leg.nights === 1 ? `${leg.arrives} +1` : leg.arrives;
}

function flightsTable(lines: BookingSheetLines): BookingSheetTable {
  return {
    heading: t('bookingSheet.flights'),
    columns: [
      { label: t('bookingSheet.date'), width: 13 },
      { label: t('bookingSheet.flight'), width: 14 },
      { label: t('bookingSheet.route'), width: 19 },
      { label: t('bookingSheet.departs'), width: 7 },
      { label: t('bookingSheet.arrives'), width: 8 },
      { label: t('bookingSheet.class'), width: 13 },
      { label: t('bookingSheet.reference'), width: 12 },
      { label: t('bookingSheet.price'), width: 14, num: true },
    ],
    rows: lines.flights.map((leg) => [
      legDateCell(leg),
      { main: [leg.carrier, leg.number].filter(Boolean).join(' ') || null },
      {
        main: routeText(leg),
        sub: subs(personsText(leg.persons), leg.optional ? t('bookingSheet.optionalChosen') : null),
      },
      { main: leg.departs },
      { main: arrivesText(leg) },
      choiceCell(leg.choice, leg.choiceOpen),
      referenceCell(leg.state),
      priceCell(leg.price, leg.choiceOpen),
    ]),
  };
}

function transportTable(lines: BookingSheetLines): BookingSheetTable {
  return {
    heading: t('bookingSheet.transport'),
    columns: [
      { label: t('bookingSheet.date'), width: 13 },
      { label: t('bookingSheet.operator'), width: 16 },
      { label: t('bookingSheet.route'), width: 17 },
      { label: t('bookingSheet.departs'), width: 7 },
      { label: t('bookingSheet.arrives'), width: 7 },
      { label: t('bookingSheet.cabin'), width: 17 },
      { label: t('bookingSheet.reference'), width: 9 },
      { label: t('bookingSheet.price'), width: 14, num: true },
    ],
    rows: lines.transport.map((leg) => [
      legDateCell(leg),
      {
        main:
          [leg.carrier, leg.number].filter(Boolean).join(' ') || leg.vehicle || modeText(leg.mode),
        // The ship after who runs it, and what kind of thing it is: Hurtigruten
        // is who you book with, MS Trollfjord is what you board.
        sub: subs(modeText(leg.mode), leg.carrier || leg.number ? leg.vehicle : null),
      },
      {
        main: routeText(leg),
        sub: subs(personsText(leg.persons), leg.optional ? t('bookingSheet.optionalChosen') : null),
      },
      { main: leg.departs },
      { main: arrivesText(leg) },
      choiceCell(leg.choice, leg.choiceOpen),
      referenceCell(leg.state),
      priceCell(leg.price, leg.choiceOpen),
    ]),
  };
}

/** One row per room, the hotel's own cells only on the first: a party in two rooms is one booking of two rooms. */
function hotelsTable(lines: BookingSheetLines): BookingSheetTable {
  const rows: BookingSheetCell[][] = [];
  for (const stay of lines.hotels) {
    stay.rooms.forEach((room, index) => {
      const first = index === 0;
      rows.push([
        { main: first ? whenText(stay.checkIn) : null },
        { main: first ? whenText(stay.checkOut) : null },
        { main: first && stay.nights !== null ? String(stay.nights) : null },
        first
          ? {
              main: stay.accommodation ?? t('itinerary.unnamedNight'),
              // What an agent needs to find the right one of three hotels
              // with the same name.
              sub: subs(stay.city, stay.address, stay.website),
            }
          : { main: null },
        {
          main: room.choiceOpen ? t('bookingSheet.open') : (room.choice?.name ?? null),
          open: room.choiceOpen,
          sub: subs(room.choice?.description ?? null, personsText(room.persons)),
        },
        referenceCell(room.state),
        priceCell(room.price, room.choiceOpen),
      ]);
    });
  }
  return {
    heading: t('bookingSheet.hotels'),
    columns: [
      { label: t('bookingSheet.checkIn'), width: 12 },
      { label: t('bookingSheet.checkOut'), width: 12 },
      { label: t('bookingSheet.nights'), width: 8 },
      { label: t('bookingSheet.accommodation'), width: 23 },
      { label: t('bookingSheet.room'), width: 19 },
      { label: t('bookingSheet.reference'), width: 12 },
      { label: t('bookingSheet.price'), width: 14, num: true },
    ],
    rows,
  };
}

function excursionsTable(lines: BookingSheetLines): BookingSheetTable {
  return {
    heading: t('bookingSheet.excursions'),
    columns: [
      { label: t('bookingSheet.date'), width: 13 },
      { label: t('bookingSheet.time'), width: 11 },
      { label: t('bookingSheet.excursion'), width: 24 },
      { label: t('bookingSheet.place'), width: 12 },
      { label: t('bookingSheet.variant'), width: 14 },
      { label: t('bookingSheet.reference'), width: 12 },
      { label: t('bookingSheet.price'), width: 14, num: true },
    ],
    rows: lines.excursions.map((line) => [
      { main: whenText(line.start) },
      { main: line.from && line.to ? `${line.from} - ${line.to}` : line.from },
      {
        main: line.excursion,
        sub: subs(
          line.operator,
          line.duration,
          personsText(line.persons),
          line.optional ? t('bookingSheet.optionalChosen') : null
        ),
      },
      { main: line.place },
      choiceCell(line.choice, line.choiceOpen),
      referenceCell(line.state),
      priceCell(line.price, line.choiceOpen),
    ]),
  };
}

function optionText(option: BookingOption, index: number): string {
  const name = option.name ?? t('itinerary.variantUnnamed', { number: index + 1 });
  if (option.cost === null) return name;
  return `${name} (${formatMoney(option.cost, option.currency)} ${unitText(option)})`;
}

function subjectText(subject: string | null, section: BookingSection): string {
  return subject ?? t(`bookingSheet.section.${section}`);
}

/**
 * The open items as sentences.
 *
 * A trip with no departure date cannot date any line, and six sentences each
 * saying so would bury the two that ask for a decision. So those collapse
 * into one; a line with neither a date nor a day of the trip is still named
 * on its own, since the one sentence does not explain it.
 */
function openSentences(items: BookingOpenItem[]): string[] {
  const sentences: string[] = [];
  let noDeparture = false;
  for (const item of items) {
    const subject = subjectText(item.subject, item.section);
    switch (item.kind) {
      case 'variant':
        sentences.push(
          t('bookingSheet.openVariant', {
            subject,
            options: item.options.map(optionText).join(' / '),
          })
        );
        break;
      case 'undecided': {
        const when = whenText(item.when);
        const price = item.price
          ? `${formatMoney(item.price.cost, item.price.currency)} ${unitText(item.price)}`
          : item.options.length > 0
            ? item.options.map(optionText).join(' / ')
            : null;
        if (when === null) sentences.push(t('bookingSheet.openUndecidedUndated', { subject }));
        else if (price === null) sentences.push(t('bookingSheet.openUndecided', { subject, when }));
        else sentences.push(t('bookingSheet.openUndecidedPriced', { subject, when, price }));
        break;
      }
      case 'undated':
        if (item.day === null) sentences.push(t('bookingSheet.openUndated', { subject }));
        else noDeparture = true;
        break;
      case 'noTime':
        sentences.push(
          t(
            item.section === 'flight' ? 'bookingSheet.openNoFlightTime' : 'bookingSheet.openNoTime',
            {
              subject,
            }
          )
        );
        break;
    }
  }
  if (noDeparture) sentences.unshift(t('bookingSheet.openNoDeparture'));
  return sentences;
}

export function buildBookingSheet(
  trip: TravelTrip,
  bookings: TravelBooking[],
  settings: APERtrailSettings,
  today: Date = new Date()
): BookingSheet {
  const lines = bookingSheetLines(trip, bookings, {
    homeCurrency: settings.homeCurrency,
    joiner: t('itinerary.legJoiner'),
  });
  const open = openSentences(lines.open);
  const leftOut = lines.open.some((item) => item.kind === 'variant' || item.kind === 'undecided');

  return {
    title: t('bookingSheet.title', { trip: trip.title }),
    subtitle: trip.country?.title ?? trip.countryTitle,
    dateRange: dateRange(trip),
    travellers: {
      heading: t('bookingSheet.travellers'),
      columns: [
        t('bookingSheet.name'),
        t('bookingSheet.birthDate'),
        t('bookingSheet.passportName'),
      ],
      names: lines.travellers,
    },
    // In the order a trip is booked: getting there, sleeping there, getting
    // about, and what is done there.
    tables: [
      flightsTable(lines),
      hotelsTable(lines),
      transportTable(lines),
      excursionsTable(lines),
    ],
    totals:
      lines.totals.length === 0
        ? null
        : {
            label: t('bookingSheet.total'),
            amounts: lines.totals.map((total) => formatMoney(total.amount, total.currency)),
            note: leftOut ? t('bookingSheet.totalNote') : null,
          },
    open: open.length === 0 ? null : { heading: t('bookingSheet.openHeading'), items: open },
    caveat: t('bookingSheet.caveat'),
    footer: sheetCredit(
      settings,
      (author) => t('bookingSheet.footer', { author, date: formatMediumDate(today) }),
      () => t('bookingSheet.footerAnonymous', { date: formatMediumDate(today) })
    ),
  };
}

/** This trip's bookings out of every booking on the board, matched by title the way every link here is. */
export function tripBookings(trip: TravelTrip, bookings: TravelBooking[]): TravelBooking[] {
  const title = caseFold(trip.title);
  return bookings.filter((booking) => caseFold(booking.tripTitle) === title);
}

export async function exportBookingSheet(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip,
  bookings: TravelBooking[]
): Promise<void> {
  const sheet = buildBookingSheet(trip, tripBookings(trip, bookings), settings);
  const name = sanitizeTitle(`${trip.title} ${t('bookingSheet.fileSuffix')}`);
  await writeSheet(app, exportPath(settings, trip.file.path, name), buildBookingSheetHtml(sheet), {
    written: 'bookingSheet.written',
    failed: 'bookingSheet.failed',
  });
}
