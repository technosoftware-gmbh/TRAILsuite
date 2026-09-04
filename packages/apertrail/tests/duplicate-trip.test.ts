/**
 * What a duplicate keeps, and what it deliberately does not.
 *
 * The clearing is the part worth pinning. A trip's stops derive visits on the
 * places they name, so a copy carrying `travelStatus: Over` and last month's
 * dates would claim you had been to every one of them a second time and would
 * move the last-visit date on each. That is a bad write into notes that are
 * somebody's records, and it is invisible: nothing errors, a dashboard just
 * quietly says something untrue.
 *
 * The rest is the ordinary half -- the route survives whole, and pictures
 * follow the trip into its new folder.
 */
import { describe, expect, it } from 'vitest';
import {
  duplicateTitle,
  duplicateTripInput,
  ownedPictures,
  rehomePicture,
} from '../src/trips/duplicate-trip';
import { tripToInput } from '../src/trips/write-trip';
import { aLeg, aNight, aStop, aTrip } from './fixtures';

const FROM = 'Trips/Rovos Rail';
const TO = 'Trips/Rovos Rail kurz';
const REHOME = { from: FROM, to: TO };

function original() {
  return tripToInput(
    aTrip('Rovos Rail', {
      subtitle: 'Zugreise in Südafrika',
      departure: '2026-09-08',
      return: '2026-09-19',
      travelStatus: 'Over',
      reviewStatus: 'Written',
      rating: 4,
      highlights: ['Fish River Canyon', 'Sossusvlei'],
      image: `${FROM}/_resources/hero.jpeg`,
      gallery: [
        { image: `${FROM}/_resources/zug1.jpeg`, caption: 'Der Zug' },
        { image: 'https://example.com/remote.jpeg', caption: 'Nicht im Vault' },
      ],
      days: [{ day: 5, title: 'Fish River Canyon', note: 'Zwei Absätze.' }],
      stops: [aStop({ placeTitle: 'Kimberley', day: 3 })],
      nights: [aNight({ accommodationTitle: 'African Rock', checkInDay: 1, checkOutDay: 2 })],
      transport: [aLeg({ origin: 'Zürich', destination: 'Johannesburg', day: 0, toDay: 1 })],
      currency: 'CHF',
      budget: [{ category: 'transport', amount: 4298 }],
    })
  );
}

describe('what a duplicate leaves behind', () => {
  const copy = duplicateTripInput(original(), REHOME);

  it('is a plan rather than a record', () => {
    expect(copy.departure).toBeNull();
    expect(copy.return).toBeNull();
    expect(copy.travelStatus).toBeNull();
    expect(copy.reviewStatus).toBeNull();
    expect(copy.rating).toBeNull();
  });

  /**
   * Null rather than the string `Planned`: a trip with no status and no dates
   * already reads as Planned, and writing it would store what the note derives.
   */
  it('says nothing rather than saying Planned', () => {
    expect(copy.travelStatus).toBeNull();
  });
});

describe('what a duplicate keeps', () => {
  const copy = duplicateTripInput(original(), REHOME);

  it('keeps the whole route', () => {
    expect(copy.days).toHaveLength(1);
    expect(copy.days[0].title).toBe('Fish River Canyon');
    expect(copy.stops).toHaveLength(1);
    expect(copy.nights).toHaveLength(1);
    expect(copy.transport).toHaveLength(1);
  });

  /** The day numbers are the whole reason a copy is worth making before its dates exist. */
  it('keeps the day numbers, which is what the copy is planned against', () => {
    expect(copy.stops[0].day).toBe(3);
    expect(copy.nights[0].checkInDay).toBe(1);
    expect(copy.transport[0].day).toBe(0);
    expect(copy.transport[0].toDay).toBe(1);
  });

  it('keeps what the trip says about itself, and what it plans to cost', () => {
    expect(copy.subtitle).toBe('Zugreise in Südafrika');
    expect(copy.highlights).toEqual(['Fish River Canyon', 'Sossusvlei']);
    expect(copy.currency).toBe('CHF');
    expect(copy.budget).toEqual([{ category: 'transport', amount: 4298 }]);
  });

  it('shares no array with the trip it was copied from', () => {
    const from = original();
    const made = duplicateTripInput(from, REHOME);
    made.highlights.push('Neu');
    made.stops[0].persons.push('[[Wer]]');

    expect(from.highlights).toEqual(['Fish River Canyon', 'Sossusvlei']);
    expect(from.stops[0].persons).toEqual([]);
  });
});

describe('the pictures', () => {
  const copy = duplicateTripInput(original(), REHOME);

  it('follow the trip into its new folder', () => {
    expect(copy.image).toBe(`${TO}/_resources/hero.jpeg`);
    expect(copy.gallery[0].image).toBe(`${TO}/_resources/zug1.jpeg`);
  });

  /** A URL has no folder, and a picture kept somewhere shared is shared on purpose. */
  it('leave alone anything that was not the trip’s own', () => {
    expect(copy.gallery[1].image).toBe('https://example.com/remote.jpeg');
    expect(rehomePicture('Attachments/shared.jpeg', REHOME)).toBe('Attachments/shared.jpeg');
  });

  /** `folder + '/'`, so a sibling whose name merely starts the same way is not caught. */
  it('are not confused by a sibling folder with a longer name', () => {
    expect(rehomePicture('Trips/Rovos Rail 2/x.jpeg', REHOME)).toBe('Trips/Rovos Rail 2/x.jpeg');
  });

  /** A trip still flat in `Trips/` owns no folder, so both go on naming the same files. */
  it('are left where they are when the trip owns no folder', () => {
    const flat = { from: null, to: TO };
    expect(rehomePicture(`${FROM}/_resources/hero.jpeg`, flat)).toBe(
      `${FROM}/_resources/hero.jpeg`
    );
    expect(ownedPictures(original(), null)).toEqual([]);
  });

  it('are listed once each, relative to the folder they came from', () => {
    const twice = original();
    twice.gallery.push({ image: `${FROM}/_resources/hero.jpeg`, caption: null });

    expect(ownedPictures(twice, FROM)).toEqual(['_resources/hero.jpeg', '_resources/zug1.jpeg']);
  });
});

describe('the suggested name', () => {
  it('counts past what already exists', () => {
    expect(duplicateTitle('Rovos Rail', [])).toBe('Rovos Rail (2)');
    expect(duplicateTitle('Rovos Rail', ['Rovos Rail (2)'])).toBe('Rovos Rail (3)');
    expect(duplicateTitle('Rovos Rail', ['Rovos Rail (2)', 'Rovos Rail (3)'])).toBe(
      'Rovos Rail (4)'
    );
  });

  /** Vault paths do not distinguish case on every platform, so neither does this. */
  it('does not offer a name that differs only in case', () => {
    expect(duplicateTitle('Rovos Rail', ['rovos rail (2)'])).toBe('Rovos Rail (3)');
  });
});
