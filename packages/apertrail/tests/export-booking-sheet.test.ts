/**
 * The booking sheet as a page, and the words it puts on it.
 *
 * What goes on the sheet is `booking-sheet-lines.test.ts`. This suite is the
 * other half: that the rows read the way an agent reads them, that an open
 * choice prints as open and never as a price, and that the markup keeps a
 * heading with its table without making a long table unbreakable.
 */
import { describe, expect, it } from 'vitest';
import { buildBookingSheetHtml, BookingSheet } from '../src/trips/export-booking-sheet';
import { buildBookingSheet, tripBookings } from '../src/trips/ui/export-booking-sheet';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { formatMediumDate, formatMoney } from '../src/shared/display';
import { aFile } from './fixtures';
import { aBooking, nordkap } from './nordkap-fixture';

const TODAY = new Date(2026, 8, 24);

function build(trip = nordkap(), bookings = [] as ReturnType<typeof aBooking>[]): BookingSheet {
  const withFiles = bookings.map((booking, index) => ({
    ...booking,
    file: aFile(`Booking ${index}`),
    title: `Booking ${index}`,
  }));
  return buildBookingSheet(trip, withFiles, { ...DEFAULT_SETTINGS, exportAuthor: '' }, TODAY);
}

function table(sheet: BookingSheet, heading: string) {
  const found = sheet.tables.find((entry) => entry.heading === heading);
  if (!found) throw new Error(`no table ${heading}`);
  return found;
}

describe('the rows', () => {
  it('prints a flight as a timetable does: number, route, clock', () => {
    const [first] = table(build(), 'Flights').rows;

    expect(first?.[1]?.main).toBe('Swiss LX1218');
    expect(first?.[2]?.main).toBe('Zürich to Bergen');
    expect(first?.[3]?.main).toBe('09:40');
    expect(first?.[4]?.main).toBe('12:05');
    expect(first?.[6]).toEqual({ main: 'K7Q2XF', sub: 'booked' });
  });

  it('prints the ship with its cabin, the ship’s own words and both ends of the voyage', () => {
    const [ship] = table(build(), 'Transport').rows;

    expect(ship?.[1]).toEqual({ main: 'Hurtigruten', sub: 'Boat · MS Trollfjord' });
    expect(ship?.[5]).toEqual({ main: 'Polar Aussenkabine', sub: 'Aussenkabine mit Fenster' });
    expect(ship?.[0]?.sub).toContain('13 nights');
    expect(ship?.[7]).toEqual({
      main: formatMoney(8958, 'CHF'),
      sub: `${formatMoney(4479, 'CHF')} per person`,
    });
  });

  it('says "open", marked, where the cabin is not chosen, and prints no price', () => {
    const trip = nordkap();
    const ship = trip.transport[1];
    if (!ship) throw new Error('fixture');
    ship.variants = ship.variants.map((variant) => ({ ...variant, chosen: false }));

    const [row] = table(build(trip), 'Transport').rows;

    expect(row?.[5]).toEqual({ main: 'open', open: true });
    expect(row?.[7]).toEqual({ main: 'open', open: true });
  });

  it('names who an excursion is for when that is not everybody', () => {
    const [sled] = table(build(), 'Excursions').rows;

    expect(sled?.[1]?.main).toBe('14:30 - 17:30');
    expect(sled?.[2]?.sub).toBe('HR-TOS5A · 3 Std. · Only Anna · Extra, chosen');
  });

  it('puts the hotel’s own cells on its first room only', () => {
    const trip = nordkap({
      personTitles: ['Thomas', 'Anna', 'Lea'],
      nights: [
        { ...nordkap().nights[0], persons: ['Thomas', 'Anna'] },
        { ...nordkap().nights[0], persons: ['Lea'], cost: 160 },
      ],
    });

    const rows = table(build(trip), 'Accommodation').rows;

    expect(rows).toHaveLength(2);
    expect(rows[0]?.[3]?.main).toBe('Hotel Oleana');
    expect(rows[1]?.[3]?.main).toBeNull();
    expect(rows[1]?.[4]?.sub).toBe('Only Lea');
  });

  it('dates a trip without a departure by its days', () => {
    const [first] = table(build(nordkap({ departure: null, return: null })), 'Flights').rows;

    expect(first?.[0]?.main).toBe('Day 1');
  });
});

describe('what is still open', () => {
  it('says the undecided excursion with its price', () => {
    const sheet = build();

    expect(sheet.open?.items).toEqual([
      `Eismeerkathedrale, ${formatMediumDate(new Date(2027, 5, 7))}: optional, not decided yet (${formatMoney(45, 'CHF')} per person).`,
    ]);
  });

  /** Six lines that cannot be dated would be six sentences saying the same thing. */
  it('says once that the trip has no departure date, not once per line', () => {
    const sheet = build(nordkap({ departure: null, return: null }));
    const sentences = sheet.open?.items ?? [];

    expect(sentences.filter((item) => item.includes('no departure date'))).toHaveLength(1);
    expect(sentences[0]).toContain('no departure date');
  });

  it('lists the choices a line is waiting on', () => {
    const trip = nordkap();
    const ship = trip.transport[1];
    if (!ship) throw new Error('fixture');
    ship.variants = ship.variants.map((variant) => ({ ...variant, chosen: false }));

    const items = build(trip).open?.items ?? [];

    expect(items).toContain(
      `Bergen to Kirkenes: no choice yet between Polar Aussenkabine (${formatMoney(4479, 'CHF')} per person) / Arktis Aussenkabine Superior (${formatMoney(5299, 'CHF')} per person).`
    );
  });

  it('is left off, with the total’s caveat, once nothing is open', () => {
    const trip = nordkap();
    trip.stops = trip.stops.filter((stop) => stop.excursionTitle !== 'Eismeerkathedrale');

    const sheet = build(trip);

    expect(sheet.open).toBeNull();
    expect(sheet.totals?.note).toBeNull();
  });
});

describe('the bookings it is given', () => {
  it('keeps only this trip’s, matched by title however it is spelled', () => {
    const own = { ...aBooking({ tripTitle: 'nordkap 2027' }), file: aFile('a'), title: 'a' };
    const other = { ...aBooking({ tripTitle: 'Jura im Juni' }), file: aFile('b'), title: 'b' };

    expect(tripBookings(nordkap(), [own, other])).toEqual([own]);
  });
});

describe('the markup', () => {
  const html = buildBookingSheetHtml(build());

  it('escapes what the notes wrote', () => {
    const sheet = build(nordkap());
    sheet.title = 'Booking sheet: <Nordkap> & more';

    expect(buildBookingSheetHtml(sheet)).toContain('Booking sheet: &lt;Nordkap&gt; &amp; more');
  });

  it('prints the four sections that have rows, in booking order', () => {
    const order = [
      'Travellers',
      'Flights',
      'Accommodation',
      'Transport',
      'Excursions',
      'Still open',
    ].map((heading) => html.indexOf(`<h2>${heading}</h2>`));

    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('leaves out a table with no rows', () => {
    const trip = nordkap({ nights: [] });

    expect(buildBookingSheetHtml(build(trip))).not.toContain('<h2>Accommodation</h2>');
  });

  /**
   * The heading keeps the header row and one line with it, and the rest is free
   * to break. A whole table in the unbreakable box would jump a long list of
   * excursions to a fresh page.
   */
  it('keeps a heading with its first row and lets the rest break', () => {
    const flights = html.slice(
      html.indexOf('<h2>Flights</h2>'),
      html.indexOf('<h2>Accommodation</h2>')
    );
    const box = flights.slice(0, flights.indexOf('</div>'));

    expect(box).toContain('LX1218');
    expect(box).not.toContain('LX1219');
    expect(flights).toContain('<table class="rest">');
    expect(flights.indexOf('LX1219')).toBeGreaterThan(flights.indexOf('<table class="rest">'));
  });

  it('gives both halves of a table the same fixed columns', () => {
    const flights = html.slice(
      html.indexOf('<h2>Flights</h2>'),
      html.indexOf('<h2>Accommodation</h2>')
    );
    const colgroups = flights.match(/<colgroup>.*?<\/colgroup>/g) ?? [];

    expect(colgroups).toHaveLength(2);
    expect(colgroups[0]).toBe(colgroups[1]);
    expect(html).toMatch(/table-layout:\s*fixed/);
  });

  it('marks an open cell so it survives a black-and-white printer', () => {
    const trip = nordkap();
    const ship = trip.transport[1];
    if (!ship) throw new Error('fixture');
    ship.variants = ship.variants.map((variant) => ({ ...variant, chosen: false }));

    expect(buildBookingSheetHtml(build(trip))).toContain('<span class="open">open</span>');
  });

  it('leaves two lines to write on when the trip names nobody', () => {
    const empty = buildBookingSheetHtml(build(nordkap({ personTitles: [] })));
    const people = empty.slice(empty.indexOf('<table class="people">'));

    expect(people.slice(0, people.indexOf('</table>')).match(/<tr><td><\/td>/g)).toHaveLength(2);
  });
});

/**
 * Found on the first real sheet: a voyage at CHF 5'040.00 ran past the edge of
 * its column and the figure under it broke as "CHF 2'520.0" over "0". The
 * columns are fixed widths, so they have to add up, and a figure may only
 * break where it has a space.
 */
describe('the columns', () => {
  it.each(['Flights', 'Accommodation', 'Transport', 'Excursions'])(
    'fill the row exactly: %s',
    (heading) => {
      const sheet = build();
      const widths = table(sheet, heading).columns.reduce((sum, column) => sum + column.width, 0);

      expect(widths).toBe(100);
    }
  );

  it('never breaks a price inside a number', () => {
    const html = buildBookingSheetHtml(build());

    expect(html).toMatch(/td\.num\s*\{\s*overflow-wrap:\s*normal;/);
  });
});

/** The Bergen flights as Thomas first had to type them, as one ticket instead. */
describe('a flight with a change of plane', () => {
  function viaFrankfurt() {
    const trip = nordkap();
    const outbound = trip.transport[2];
    if (!outbound) throw new Error('fixture');
    Object.assign(outbound, {
      carrier: 'Lufthansa',
      number: null,
      origin: 'Zürich',
      destination: 'Bergen',
      from: '07:00',
      to: '12:10',
      cost: 160,
      segments: [
        {
          carrier: null,
          number: 'LH 1199',
          origin: 'Zürich',
          destination: 'Frankfurt',
          day: 1,
          toDay: null,
          from: '07:00',
          to: '08:00',
        },
        {
          carrier: 'Edelweiss',
          number: 'LH 872',
          origin: 'Frankfurt',
          destination: 'Bergen',
          day: 1,
          toDay: null,
          from: '10:10',
          to: '12:10',
        },
      ],
    });
    return trip;
  }

  it('prints a row per flight, each with its own number, route and times', () => {
    const rows = table(build(viaFrankfurt()), 'Flights').rows.slice(0, 2);

    expect(rows.map((row) => row[1]?.main)).toEqual(['Lufthansa LH 1199', 'Edelweiss LH 872']);
    expect(rows.map((row) => row[2]?.main)).toEqual(['Zürich to Frankfurt', 'Frankfurt to Bergen']);
    expect(rows.map((row) => row[3]?.main)).toEqual(['07:00', '10:10']);
  });

  it('prints the ticket’s reference and price once, on the first flight', () => {
    const [first, second] = table(build(viaFrankfurt()), 'Flights').rows;

    expect(first?.[6]).toEqual({ main: 'K7Q2XF', sub: 'booked' });
    expect(first?.[7]?.main).toBe(formatMoney(320, 'CHF'));
    expect(second?.slice(5)).toEqual([{ main: null }, { main: null }, { main: null }]);
  });

  it('counts the fare once in the total', () => {
    const sheet = build(viaFrankfurt());

    // 2 x 160 in place of 2 x 290 for the outbound flight.
    expect(sheet.totals?.amounts).toEqual([formatMoney(320 + 760 + 8958 + 240 + 220 + 318, 'CHF')]);
  });
});
