/**
 * Where a money note is filed.
 *
 * The rule that matters most here is the one about a missing date: a bill that
 * says nothing about when it was issued has to land somewhere a person would
 * think to look, and a folder called `undefined` is not that.
 */
import { describe, expect, it } from 'vitest';
import {
  budgetDateOf,
  dateOf,
  expandSubfolder,
  noteFolderFor,
  subfolderFor,
} from '../src/finance/paths';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const S = DEFAULT_SETTINGS;
const AUGUST = new Date(2026, 7, 22);

describe('expandSubfolder', () => {
  it('fills the tokens', () => {
    expect(expandSubfolder('{YYYY}/{MM}', AUGUST)).toBe('2026/08');
    expect(expandSubfolder('{YYYY}', AUGUST)).toBe('2026');
  });

  it('pads the month, so a folder listing sorts', () => {
    expect(expandSubfolder('{YYYY}/{MM}', new Date(2026, 0, 5))).toBe('2026/01');
  });

  it('files flat when the template is blank', () => {
    expect(expandSubfolder('', AUGUST)).toBe('');
    expect(expandSubfolder('   ', AUGUST)).toBe('');
  });

  it('files flat when there is no date, rather than inventing a folder', () => {
    expect(expandSubfolder('{YYYY}/{MM}', null)).toBe('');
  });

  it('keeps a literal segment beside a token', () => {
    expect(expandSubfolder('Archiv/{YYYY}', AUGUST)).toBe('Archiv/2026');
  });

  it('stops at the first segment it cannot fill, keeping what it could', () => {
    // A template asking for something this expander does not know still gets
    // its year, rather than losing the note to a folder named after a token.
    expect(expandSubfolder('{YYYY}/{QQ}', AUGUST)).toBe('2026/{QQ}');
  });
});

describe('the shipped shapes', () => {
  it('files a bill and a purchase by year and month', () => {
    expect(subfolderFor(S, 'bill')).toBe('{YYYY}/{MM}');
    expect(noteFolderFor(S, 'bill', AUGUST)).toBe('Finance/Bills/2026/08');
    expect(noteFolderFor(S, 'purchase', AUGUST)).toBe('Finance/Purchases/2026/08');
  });

  it('files a budget and a standing charge by year alone', () => {
    // Twelve notes a year already: a month folder would hold one and cost a
    // click.
    expect(noteFolderFor(S, 'budget', AUGUST)).toBe('Finance/Budgets/2026');
    expect(noteFolderFor(S, 'recurring', AUGUST)).toBe('Finance/Recurring/2026');
  });

  it('files an undated note in the module folder itself', () => {
    expect(noteFolderFor(S, 'bill', null)).toBe('Finance/Bills');
  });

  it('leaves the PARA kinds flat', () => {
    expect(subfolderFor(S, 'area')).toBe('');
    expect(noteFolderFor(S, 'area', AUGUST)).toBe('1 Areas');
  });

  it('honours a vault that files flat', () => {
    expect(noteFolderFor({ ...S, billSubfolder: '' }, 'bill', AUGUST)).toBe('Finance/Bills');
  });
});

describe('the date a note is filed by', () => {
  it('reads an ISO day', () => {
    expect(dateOf('2026-08-22')?.getMonth()).toBe(7);
    expect(dateOf(null)).toBeNull();
    expect(dateOf('not a day')).toBeNull();
  });

  it('files a monthly budget by its own month', () => {
    expect(budgetDateOf('2026-09')?.getMonth()).toBe(8);
    expect(budgetDateOf('2026-09')?.getFullYear()).toBe(2026);
  });

  it('files a quarterly budget by the first month of its quarter', () => {
    expect(budgetDateOf('2026-Q3')?.getMonth()).toBe(6);
  });

  it('files a yearly budget by January, since only the year is used', () => {
    expect(budgetDateOf('2026')?.getFullYear()).toBe(2026);
    expect(budgetDateOf('2026')?.getMonth()).toBe(0);
  });

  it('puts a whole year of monthly budgets in one folder', () => {
    // The shape asked for: twelve notes a year, all under the year. Written as
    // a loop over all twelve rather than a spot check, because the point is
    // that no month escapes into a folder of its own.
    const months = Array.from(
      { length: 12 },
      (_, index) => `2026-${String(index + 1).padStart(2, '0')}`
    );
    const folders = new Set(
      months.map((period) => noteFolderFor(S, 'budget', budgetDateOf(period)))
    );
    expect([...folders]).toEqual(['Finance/Budgets/2026']);
  });

  it('keeps one year of budgets out of another year folder', () => {
    expect(noteFolderFor(S, 'budget', budgetDateOf('2027-01'))).toBe('Finance/Budgets/2027');
    expect(noteFolderFor(S, 'budget', budgetDateOf('2025-12'))).toBe('Finance/Budgets/2025');
  });

  it('files a budget whose period says nothing flat', () => {
    expect(budgetDateOf(null)).toBeNull();
    expect(budgetDateOf('next month')).toBeNull();
  });
});
