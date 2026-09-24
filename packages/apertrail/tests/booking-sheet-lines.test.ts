/**
 * What the booking sheet puts in front of a travel agency, and what it
 * refuses to guess. See docs/design/booking-sheet.md.
 */
import { describe, expect, it } from 'vitest';
import { bookingSheetLines } from '../src/trips/booking-sheet-lines';
import { aLeg, aNight } from './fixtures';
import { aBooking, nordkap } from './nordkap-fixture';

const OPTIONS = { homeCurrency: 'CHF', joiner: '\u2192' };

describe('the four tables', () => {
  it('puts flights, the ship, the hotel and the chosen excursions each in their own', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.flights.map((leg) => leg.number)).toEqual(['LX1218', 'LX1219']);
    expect(sheet.transport.map((leg) => leg.vehicle)).toEqual(['MS Trollfjord']);
    expect(sheet.hotels.map((stay) => stay.accommodation)).toEqual(['Hotel Oleana']);
    expect(sheet.excursions.map((line) => line.excursion)).toEqual([
      'Hundeschlittenfahrt',
      'Nordkap-Plateau',
    ]);
  });

  /** Somebody who writes the return flight first still hands the agency a sheet in travelling order. */
  it('orders each table by when, not by the order of the note', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.flights.map((leg) => leg.start.date)).toEqual(['2027-06-01', '2027-06-15']);
  });

  it('leaves out a stop that is not an excursion, which is bought at the door', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.excursions.some((line) => line.place === 'Bergen')).toBe(false);
  });

  it('dates a relative line from the trip and keeps its clock times', () => {
    const [outbound] = bookingSheetLines(nordkap(), [], OPTIONS).flights;

    expect(outbound?.start).toEqual({ date: '2027-06-01', day: 1 });
    expect(outbound?.departs).toBe('09:40');
    expect(outbound?.arrives).toBe('12:05');
    expect(outbound?.end).toBeNull();
  });

  it('gives a voyage both ends and its nights', () => {
    const [ship] = bookingSheetLines(nordkap(), [], OPTIONS).transport;

    expect(ship?.start.date).toBe('2027-06-02');
    expect(ship?.end?.date).toBe('2027-06-15');
    expect(ship?.nights).toBe(13);
  });

  it('carries the traveller names as written', () => {
    expect(bookingSheetLines(nordkap(), [], OPTIONS).travellers).toEqual(['Thomas', 'Anna']);
  });
});

describe('the cabin, the class and the room', () => {
  it('is the chosen variant, with the ship’s own words for it', () => {
    const [ship] = bookingSheetLines(nordkap(), [], OPTIONS).transport;

    expect(ship?.choice).toEqual({
      name: 'Polar Aussenkabine',
      description: 'Aussenkabine mit Fenster',
    });
    expect(ship?.choiceOpen).toBe(false);
    expect(ship?.price).toEqual({ cost: 4479, currency: 'CHF', unit: 'person', total: 8958 });
  });

  /**
   * The cost arithmetic counts the first variant while nothing is chosen. The
   * booking sheet must not: here the guess would be a purchase.
   */
  it('is left open, with no price, while nobody has chosen', () => {
    const trip = nordkap();
    const ship = trip.transport[1];
    if (!ship) throw new Error('fixture');
    ship.variants = ship.variants.map((variant) => ({ ...variant, chosen: false }));

    const sheet = bookingSheetLines(trip, [], OPTIONS);
    const [line] = sheet.transport;

    expect(line?.choice).toBeNull();
    expect(line?.choiceOpen).toBe(true);
    expect(line?.price).toBeNull();
    expect(sheet.open).toContainEqual({
      kind: 'variant',
      section: 'transport',
      subject: 'Bergen → Kirkenes',
      options: [
        { name: 'Polar Aussenkabine', cost: 4479, currency: 'CHF', unit: 'person' },
        { name: 'Arktis Aussenkabine Superior', cost: 5299, currency: 'CHF', unit: 'person' },
      ],
    });
  });

  it('groups a party split across rooms under one hotel', () => {
    const trip = nordkap({
      personTitles: ['Thomas', 'Anna', 'Lea'],
      nights: [
        aNight({
          accommodationTitle: 'Hotel Oleana',
          checkInDay: 1,
          checkOutDay: 2,
          persons: ['Thomas', 'Anna'],
          cost: 240,
          costUnit: 'night',
        }),
        aNight({
          accommodationTitle: 'Hotel Oleana',
          checkInDay: 1,
          checkOutDay: 2,
          persons: ['Lea'],
          cost: 160,
          costUnit: 'night',
        }),
      ],
    });

    const [stay] = bookingSheetLines(trip, [], OPTIONS).hotels;

    expect(stay?.nights).toBe(1);
    expect(stay?.rooms.map((room) => room.persons)).toEqual([['Thomas', 'Anna'], ['Lea']]);
    expect(stay?.rooms.map((room) => room.price?.total)).toEqual([240, 160]);
  });
});

describe('who a line is for', () => {
  it('names people only where the line is not for everybody', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.flights[0]?.persons).toBeNull();
    expect(sheet.excursions[0]?.persons).toEqual(['Anna']);
    // Charged to the one person taking it, not to the party.
    expect(sheet.excursions[0]?.price?.total).toBe(220);
  });
});

describe('what is open', () => {
  it('lists an optional excursion nobody has decided on, and keeps it off the table', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.excursions.some((line) => line.excursion === 'Eismeerkathedrale')).toBe(false);
    expect(sheet.open).toContainEqual({
      kind: 'undecided',
      section: 'excursion',
      subject: 'Eismeerkathedrale',
      when: { date: '2027-06-07', day: 7 },
      price: { cost: 45, currency: 'CHF', unit: 'person', total: 90 },
      options: [],
    });
  });

  it('lists every line it cannot date while the trip has no departure', () => {
    const sheet = bookingSheetLines(nordkap({ departure: null, return: null }), [], OPTIONS);
    const undated = sheet.open.filter((item) => item.kind === 'undated');

    // Two flights, the ship, the hotel and the two chosen excursions.
    expect(undated).toHaveLength(6);
    expect(undated).toContainEqual({
      kind: 'undated',
      section: 'hotel',
      subject: 'Hotel Oleana',
      day: 1,
    });
    // And the table still prints the day, ordered by it.
    expect(sheet.flights.map((leg) => leg.start)).toEqual([
      { date: null, day: 1 },
      { date: null, day: 15 },
    ]);
  });

  it('asks for the departure time of a flight, not of a rental car', () => {
    const trip = nordkap({
      transport: [
        aLeg({ mode: 'plane', origin: 'Zürich', destination: 'Bergen', day: 1 }),
        aLeg({ mode: 'car', carrier: 'Hertz', day: 1 }),
      ],
    });

    const noTime = bookingSheetLines(trip, [], OPTIONS).open.filter(
      (item) => item.kind === 'noTime'
    );

    expect(noTime).toEqual([{ kind: 'noTime', section: 'flight', subject: 'Zürich → Bergen' }]);
  });

  it('is empty for a trip with every choice made', () => {
    const trip = nordkap();
    trip.stops = trip.stops.filter((stop) => stop.excursionTitle !== 'Eismeerkathedrale');

    expect(bookingSheetLines(trip, [], OPTIONS).open).toEqual([]);
  });
});

describe('what is already booked', () => {
  it('reads a leg carrying a booking reference as booked', () => {
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.flights[0]?.state).toEqual({ booked: true, reference: 'K7Q2XF' });
    expect(sheet.flights[1]?.state).toEqual({ booked: false, reference: null });
  });

  it('takes a hotel’s reference from its booking note, and ignores an estimate', () => {
    const booked = bookingSheetLines(
      nordkap(),
      [aBooking({ placeTitle: 'Hotel Oleana', reference: 'OL-5521' })],
      OPTIONS
    );
    const estimated = bookingSheetLines(
      nordkap(),
      [aBooking({ placeTitle: 'Hotel Oleana', reference: 'OL-5521', status: 'estimate' })],
      OPTIONS
    );

    expect(booked.hotels[0]?.state).toEqual({ booked: true, reference: 'OL-5521' });
    expect(estimated.hotels[0]?.state.booked).toBe(false);
  });

  /** Two excursions in Tromsø: a booking naming the town cannot say which one it paid for. */
  it('matches an excursion by its own title, and by its place only where that is unambiguous', () => {
    const trip = nordkap();
    trip.stops = trip.stops.map((stop) =>
      stop.excursionTitle === 'Eismeerkathedrale' ? { ...stop, chosen: true } : stop
    );

    const byTown = bookingSheetLines(
      trip,
      [aBooking({ placeTitle: 'Tromsø', reference: 'T-1' })],
      OPTIONS
    );
    const byTitle = bookingSheetLines(
      trip,
      [aBooking({ placeTitle: 'Hundeschlittenfahrt', reference: 'H-7' })],
      OPTIONS
    );
    const byPort = bookingSheetLines(
      trip,
      [aBooking({ placeTitle: 'Honningsvåg', reference: 'N-3' })],
      OPTIONS
    );

    expect(byTown.excursions.every((line) => !line.state.booked)).toBe(true);
    expect(
      byTitle.excursions.find((line) => line.excursion === 'Hundeschlittenfahrt')?.state
    ).toEqual({
      booked: true,
      reference: 'H-7',
    });
    expect(
      byPort.excursions.find((line) => line.excursion === 'Nordkap-Plateau')?.state.reference
    ).toBe('N-3');
  });
});

describe('the totals', () => {
  it('add the priced lines per currency, the untaken extra and the open choice left out', () => {
    // Flights 2 x 290 + 2 x 380, ship 2 x 4479, hotel 1 night x 240,
    // dog sled 1 x 220, plateau 2 x 159. The cathedral is undecided.
    const sheet = bookingSheetLines(nordkap(), [], OPTIONS);

    expect(sheet.totals).toEqual([{ currency: 'CHF', amount: 580 + 760 + 8958 + 240 + 220 + 318 }]);
  });

  it('never adds two currencies together', () => {
    const trip = nordkap();
    const hotel = trip.nights[0];
    if (!hotel) throw new Error('fixture');
    hotel.currency = 'NOK';
    hotel.cost = 2600;

    const totals = bookingSheetLines(trip, [], OPTIONS).totals;

    expect(totals).toContainEqual({ currency: 'NOK', amount: 2600 });
    expect(totals.find((total) => total.currency === 'CHF')?.amount).toBe(
      580 + 760 + 8958 + 220 + 318
    );
  });
});
