/**
 * A trip shaped after the Nordkap voyage, for the booking sheet's two suites:
 * two flights around a fifteen-day ship leg sold in two cabins, a hotel night
 * before boarding, and an excursion in nearly every port.
 */
import { ParsedBooking } from '../src/trips/costs/booking-note';
import { aLeg, aNight, anExcursion, aParsedVariant, aStop, aTrip, aVehicle } from './fixtures';

export function aBooking(over: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    tripTitle: 'Nordkap 2027',
    category: 'other',
    status: 'booked',
    supplierTitle: null,
    placeTitle: null,
    date: null,
    amount: null,
    currency: null,
    reference: null,
    payerTitle: null,
    forTitles: [],
    documentPath: null,
    ...over,
  };
}

const TROLLFJORD = aVehicle('MS Trollfjord', {
  cabins: [
    { name: 'Polar Aussenkabine', description: 'Aussenkabine mit Fenster', image: null },
    { name: 'Arktis Aussenkabine Superior', description: 'Grösser, auf dem Oberdeck', image: null },
  ],
});

/**
 * Shaped after the Nordkap voyage the plan names: two flights around a
 * fifteen-day ship leg sold in two cabins, a hotel night in Bergen before
 * boarding, and an excursion in nearly every port, some of them chosen.
 */
export function nordkap(over: Parameters<typeof aTrip>[1] = {}) {
  return aTrip('Nordkap 2027', {
    departure: '2027-06-01',
    return: '2027-06-16',
    personTitles: ['Thomas', 'Anna'],
    currency: 'CHF',
    transport: [
      aLeg({
        direction: 'inbound',
        mode: 'plane',
        carrier: 'Swiss',
        number: 'LX1219',
        origin: 'Kirkenes',
        destination: 'Zürich',
        day: 15,
        toDay: 15,
        from: '14:10',
        to: '19:55',
        cost: 380,
        costUnit: 'person',
      }),
      aLeg({
        direction: 'outbound',
        mode: 'boat',
        carrier: 'Hurtigruten',
        vehicleTitle: 'MS Trollfjord',
        vehicle: TROLLFJORD,
        origin: 'Bergen',
        destination: 'Kirkenes',
        day: 2,
        toDay: 15,
        from: '20:30',
        to: '09:45',
        variants: [
          aParsedVariant({
            name: 'Polar Aussenkabine',
            cost: 4479,
            costUnit: 'person',
            chosen: true,
          }),
          aParsedVariant({ name: 'Arktis Aussenkabine Superior', cost: 5299, costUnit: 'person' }),
        ],
      }),
      aLeg({
        direction: 'outbound',
        mode: 'plane',
        carrier: 'Swiss',
        number: 'LX1218',
        origin: 'Zürich',
        destination: 'Bergen',
        day: 1,
        toDay: 1,
        from: '09:40',
        to: '12:05',
        reference: 'K7Q2XF',
        cost: 290,
        costUnit: 'person',
      }),
    ],
    nights: [
      aNight({
        accommodationTitle: 'Hotel Oleana',
        checkInDay: 1,
        checkOutDay: 2,
        cost: 240,
        costUnit: 'night',
      }),
    ],
    stops: [
      aStop({ placeTitle: 'Bergen', day: 2, from: '10:00', note: 'Bryggen zu Fuss' }),
      aStop({
        placeTitle: 'Tromsø',
        excursionTitle: 'Hundeschlittenfahrt',
        excursion: anExcursion('Hundeschlittenfahrt', { duration: '3 Std.' }),
        day: 7,
        from: '14:30',
        to: '17:30',
        optional: true,
        chosen: true,
        cost: 220,
        costUnit: 'person',
        persons: ['Anna'],
      }),
      aStop({
        placeTitle: 'Tromsø',
        excursionTitle: 'Eismeerkathedrale',
        day: 7,
        from: '15:00',
        optional: true,
        cost: 45,
        costUnit: 'person',
      }),
      aStop({
        placeTitle: 'Honningsvåg',
        excursionTitle: 'Nordkap-Plateau',
        day: 11,
        from: '11:15',
        cost: 159,
        costUnit: 'person',
      }),
    ],
    ...over,
  });
}
