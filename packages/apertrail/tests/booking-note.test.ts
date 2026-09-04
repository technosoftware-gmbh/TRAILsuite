/**
 * Reading a booking note.
 *
 * The two defaults are the interesting part. An unrecognized category reads
 * as `other` and an unrecognized status as `booked`, rather than as null,
 * because both are what a half-typed note most likely means: something was
 * spent on something, and it is committed. A nullable status would leave a
 * figure in none of the three totals, which is the one outcome guaranteed to
 * be wrong.
 */
import { describe, expect, it } from 'vitest';
import { normalizeCurrency } from 'trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { parseBooking } from '../src/trips/costs/booking-note';
import { bookingProperties } from '../src/vault/read-entities';

const PROPS = bookingProperties(DEFAULT_SETTINGS);

function parse(frontmatter: Record<string, unknown>) {
  return parseBooking(frontmatter, PROPS);
}

describe('a filled-in booking', () => {
  const booking = parse({
    trip: '[[Jura im Juni]]',
    category: 'transport',
    status: 'paid',
    supplier: '[[SBB]]',
    place: '[[Neuchâtel]]',
    date: '2026-06-14',
    amount: 187.4,
    currency: 'chf',
    reference: 'XK7F2Q',
    payer: '[[Stefan Muster]]',
    for: ['[[Stefan Muster]]', '[[Erika Muster]]'],
    document: '[[SBB 2026-06-14.pdf]]',
  });

  it('reads every field, resolving wikilinks to titles', () => {
    expect(booking.tripTitle).toBe('Jura im Juni');
    expect(booking.supplierTitle).toBe('SBB');
    expect(booking.placeTitle).toBe('Neuchâtel');
    expect(booking.payerTitle).toBe('Stefan Muster');
    expect(booking.forTitles).toEqual(['Stefan Muster', 'Erika Muster']);
    expect(booking.amount).toBe(187.4);
    expect(booking.reference).toBe('XK7F2Q');
    expect(booking.documentPath).toBe('[[SBB 2026-06-14.pdf]]');
  });

  // An ISO code is upper case, and a vault that typed `chf` meant CHF. The
  // note keeps what it says; only the reading is normalized.
  it('normalizes the currency code without rewriting the note', () => {
    expect(booking.currency).toBe('CHF');
    expect(normalizeCurrency('  eur ')).toBe('EUR');
    expect(normalizeCurrency('')).toBeNull();
  });
});

describe('an empty or half-typed booking', () => {
  it('reads a note with nothing on it as an uncategorised, committed booking', () => {
    const booking = parse({});
    expect(booking.category).toBe('other');
    expect(booking.status).toBe('booked');
    expect(booking.amount).toBeNull();
    expect(booking.tripTitle).toBeNull();
  });

  it('falls back for values outside the two vocabularies', () => {
    const booking = parse({ category: 'Flug', status: 'reserviert' });
    expect(booking.category).toBe('other');
    expect(booking.status).toBe('booked');
  });

  // Zero is a real amount: a comped hotel night is a booking worth recording.
  it('keeps a zero amount as zero rather than as absent', () => {
    expect(parse({ amount: 0 }).amount).toBe(0);
  });

  // Obsidian often hands a number back as a string.
  it('reads an amount typed as a string', () => {
    expect(parse({ amount: '42.50' }).amount).toBe(42.5);
  });

  // A date property Obsidian has turned into a Date still has to read as a day.
  it('reads a date down to its day part', () => {
    expect(parse({ date: '2026-06-14T00:00' }).date).toBe('2026-06-14');
  });

  it('reads a single-entry for list as one person', () => {
    expect(parse({ for: '[[Erika Muster]]' }).forTitles).toEqual(['Erika Muster']);
  });
});
