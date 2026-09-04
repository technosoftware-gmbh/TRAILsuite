/**
 * The eating-history reader, over both shapes a vault keeps a log in.
 *
 * The frontmatter cases are taken from a real migrated vault, where the dates
 * are written unquoted and therefore reach the reader as native Dates rather
 * than as strings.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import type { EatingEntry } from '../src/meals/parser/eating-history';
import {
  lastEatingDate,
  mergeEatingHistory,
  parseEatingHistorySection,
  readEatingHistoryProperty,
} from '../src/meals/parser/eating-history';

/** An `EatingEntry` with only the fields a case is about. */
function eaten(over: Partial<EatingEntry> = {}): EatingEntry {
  return {
    id: null,
    date: '2026-01-24',
    time: null,
    rating: null,
    note: null,
    person: null,
    ...over,
  };
}

describe('the frontmatter eating log', () => {
  it('reads a list of records', () => {
    const entries = readEatingHistoryProperty([
      { id: 'a', date: '2026-07-23', personLink: '[[Erika]]', note: '11:45 Erika' },
      { id: 'b', date: '2026-07-13', personLink: '[[Stefan]]', rating: 4, note: 'Sehr gut' },
    ]);

    expect(entries).toEqual([
      eaten({ id: 'a', date: '2026-07-23', note: '11:45 Erika', person: 'Erika' }),
      eaten({ id: 'b', date: '2026-07-13', rating: 4, note: 'Sehr gut', person: 'Stefan' }),
    ]);
  });

  it('reads a date Obsidian parsed into a Date, keeping the day it names', () => {
    // An unquoted `2026-07-23T11:45` in a note arrives here as a Date. The
    // day is what an eating log is about, so the clock time is dropped rather
    // than the entry.
    const entries = readEatingHistoryProperty([{ date: new Date(2026, 6, 23, 11, 45) }]);
    expect(entries[0].date).toBe('2026-07-23');
  });

  it('reads a bare list of dates', () => {
    expect(readEatingHistoryProperty(['2026-01-24', '2025-12-01'])).toHaveLength(2);
  });

  it('drops an entry with no readable date rather than showing it undated', () => {
    expect(
      readEatingHistoryProperty([{ note: 'sometime last winter' }, { date: '2026-01-24' }])
    ).toEqual([eaten()]);
  });

  it('resolves a wikilink with an alias and a path to the name', () => {
    const entries = readEatingHistoryProperty([
      { date: '2026-01-24', personLink: '[[CRM/People/Stefan|Tom]]' },
    ]);
    expect(entries[0].person).toBe('Tom');
  });

  it('reads the clock time as its own field, so the day and the time are separate', () => {
    const [entry] = readEatingHistoryProperty([{ date: '2026-07-23T11:45' }]);
    expect(entry.date).toBe('2026-07-23');
    expect(entry.time).toBe('11:45');
  });

  it('says nothing about the time when the record records only a day', () => {
    expect(readEatingHistoryProperty([{ date: '2026-07-23' }])[0].time).toBeNull();
  });

  it('recovers the time from a date Obsidian turned into a Date', () => {
    // An unquoted `2026-07-23T11:45` arrives here as a native Date. The day used
    // to be all that survived, which is why the time only ever reached the modal
    // by way of the body line's text.
    const [entry] = readEatingHistoryProperty([{ date: new Date(2026, 6, 23, 11, 45) }]);
    expect(entry.date).toBe('2026-07-23');
    expect(entry.time).toBe('11:45');
  });

  it('is not fooled by a property holding something that is not a list', () => {
    expect(readEatingHistoryProperty('2026-01-24')).toEqual([]);
    expect(readEatingHistoryProperty(undefined)).toEqual([]);
  });
});

describe('the body eating log', () => {
  it('reads a list under the heading, in either date notation', () => {
    const entries = parseEatingHistorySection(
      ['- 2026-01-24 - came out well', '* 17.05.2026 with the good pan', 'not a list line'].join(
        '\n'
      )
    );

    expect(entries).toEqual([
      eaten({ note: 'came out well' }),
      eaten({ date: '2026-05-17', note: 'with the good pan' }),
    ]);
  });

  it('reads an inline rating and keeps it out of the note', () => {
    const [entry] = parseEatingHistorySection('- 2026-01-24 [rating:: 4] too much salt');
    expect(entry.rating).toBe(4);
    expect(entry.note).toBe('too much salt');
  });

  it('keeps a line that is only a date', () => {
    expect(parseEatingHistorySection('- 2026-01-24')).toEqual([eaten()]);
  });

  it('takes a leading clock time as the time rather than as part of the note', () => {
    const [entry] = parseEatingHistorySection('- 2026-01-24 18:30 came out well');
    expect(entry.time).toBe('18:30');
    expect(entry.note).toBe('came out well');
  });

  it('leaves a time in the middle of a line alone, since only a leading one is structural', () => {
    // `parseEatingHistorySection` is forgiving about everything except the date,
    // and a sentence that happens to mention a clock time is prose.
    const [entry] = parseEatingHistorySection('- 2026-01-24 forgot it until 22:00');
    expect(entry.time).toBeNull();
    expect(entry.note).toBe('forgot it until 22:00');
  });

  it('ignores a line with no date, since a log entry is a date first', () => {
    expect(parseEatingHistorySection('- ate it again at some point')).toEqual([]);
  });
});

describe('merging the two logs', () => {
  it('sorts newest first and collapses the same meal recorded twice', () => {
    const merged = mergeEatingHistory(
      [eaten({ note: 'good' })],
      [eaten({ date: '2026-05-17', rating: 5 }), eaten({ rating: 4, note: 'good' })]
    );

    expect(merged.map((entry) => entry.date)).toEqual(['2026-05-17', '2026-01-24']);
    // The richer record won, so the rating from the second source survived.
    expect(merged[1].rating).toBe(4);
  });

  it('folds an unidentified body line into the record it is the same entry as', () => {
    // The state every migrated note in a real vault is in: the frontmatter
    // records carry ids, the body lines the same writer produced carry no id
    // marker at all, and the two halves agree on the date and on the text. By id
    // alone they look like two entries, so the whole log renders twice, once
    // with the person and once without.
    const merged = mergeEatingHistory(
      [
        eaten({
          id: 'mig-8243f18b5d',
          date: '2026-07-30',
          rating: 4,
          note: '11:45 · Erika · Sehr gut',
          person: 'Erika Muster',
        }),
        eaten({
          id: 'mig-f5d7a29809',
          date: '2026-07-30',
          rating: 4,
          note: '11:45 · Stefan · Sehr gut',
          person: 'Stefan Muster',
        }),
      ],
      [
        eaten({ date: '2026-07-30', rating: 4, note: '11:45 · Erika · Sehr gut' }),
        eaten({ date: '2026-07-30', rating: 4, note: '11:45 · Stefan · Sehr gut' }),
      ]
    );

    expect(merged.length).toBe(2);
    // The record's person survives the fold, which is the half worth keeping.
    expect(merged.map((entry) => entry.person)).toEqual(['Erika Muster', 'Stefan Muster']);
  });

  it('folds the same way when the body line is read first', () => {
    // The sources arrive in whatever order the caller passes them, and an
    // id-less line read first must not claim a key of its own.
    const line = eaten({ date: '2026-07-30', rating: 4, note: '11:45 · Erika' });
    const record = eaten({
      id: 'mig-8243f18b5d',
      date: '2026-07-30',
      rating: 4,
      note: '11:45 · Erika',
      person: 'Erika Muster',
    });

    const merged = mergeEatingHistory([line], [record]);
    expect(merged.length).toBe(1);
    expect(merged[0].person).toBe('Erika Muster');
    expect(merged[0].id).toBe('mig-8243f18b5d');
  });

  it('keeps two identified entries apart even when they read identically', () => {
    // Two people eating the same dish on the same day with nothing written
    // about either. They declared their own identity; the fold must not use one
    // to swallow the other.
    const merged = mergeEatingHistory([
      eaten({ id: 'a', date: '2026-07-30', person: 'Erika' }),
      eaten({ id: 'b', date: '2026-07-30', person: 'Stefan' }),
    ]);

    expect(merged.length).toBe(2);
  });

  it('folds one unidentified line into only one of two identical records', () => {
    // The ambiguous case, pinned so the count stays right: an id-less line that
    // could be either of two identified entries is one of them, not a third.
    const merged = mergeEatingHistory(
      [
        eaten({ id: 'a', date: '2026-07-30', person: 'Erika' }),
        eaten({ id: 'b', date: '2026-07-30', person: 'Stefan' }),
      ],
      [eaten({ date: '2026-07-30' })]
    );

    expect(merged.length).toBe(2);
  });

  it('still shows a hand-written line that matches no record', () => {
    // The fold is a merge of two records of one meal, not a filter. A line
    // somebody typed about a meal the frontmatter never learned about is still
    // a meal they ate.
    const merged = mergeEatingHistory(
      [eaten({ id: 'a', date: '2026-07-30', rating: 4, note: 'Sehr gut', person: 'Erika' })],
      [eaten({ date: '2026-06-02', note: 'ate it again' })]
    );

    expect(merged.map((entry) => entry.date)).toEqual(['2026-07-30', '2026-06-02']);
  });

  it('derives last-made and times-eaten, and yields to an explicit value', () => {
    const settings = mergeSettings({});
    const log = [{ date: '2026-01-24' }, { date: '2026-05-17' }];

    const derived = readMealMeta({ eatingHistory: log }, settings);
    expect(derived.lastEaten).toBe('2026-05-17');
    expect(derived.eatenCount).toBe(2);

    // An explicit property wins, because somebody who wrote one meant it.
    const stated = readMealMeta(
      { eatingHistory: log, lastEaten: '2026-06-01', eatenCount: 9 },
      settings
    );
    expect(stated.lastEaten).toBe('2026-06-01');
    expect(stated.eatenCount).toBe(9);
  });

  it('derives last-made from the log', () => {
    expect(lastEatingDate([eaten(), eaten({ date: '2026-05-17' })])).toBe('2026-05-17');
    expect(lastEatingDate([])).toBeNull();
  });
});
