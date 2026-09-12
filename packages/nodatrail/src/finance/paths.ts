/**
 * Where a money note is filed beneath its module folder.
 *
 * A bill goes under the year and month it was issued, a purchase under the year
 * and month it was ordered, and a budget and a standing charge under the year
 * alone. A year of bills is a few hundred notes and a month of them is a
 * handful, which is the size a folder is still worth opening; a budget is
 * twelve notes a year already, so a month folder there would hold one note and
 * cost a click.
 *
 * **Only writing is affected.** The readers match anything beneath the module
 * folder, so a vault that files flat, a vault that files by year and a vault
 * that changes its mind halfway through are all read identically and no
 * migration is ever required.
 *
 * Pure.
 */
import { joinFolder, pad2, parseDayTitle } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { folderFor, type NodaFolderType } from '../vault/entity-types';

/**
 * The template with its tokens filled in, or '' when the date says nothing.
 *
 * **A segment whose tokens have no value is dropped**, rather than expanded to
 * an empty string or to the word undefined. A bill with no issue date lands in
 * the Bills folder itself, which is exactly where somebody looking for the
 * un-dated ones would think to look.
 */
export function expandSubfolder(template: string, date: Date | null): string {
  const trimmed = template.trim();
  if (!trimmed) return '';

  const values: Record<string, string | null> = date
    ? { YYYY: String(date.getFullYear()), MM: pad2(date.getMonth() + 1) }
    : { YYYY: null, MM: null };

  const segments: string[] = [];
  for (const segment of trimmed.split('/')) {
    if (!segment) continue;

    let usable = true;
    const filled = segment.replace(/\{([A-Za-z]+)\}/g, (whole, token: string) => {
      if (!(token in values)) return whole;
      const value = values[token];
      if (value === null) usable = false;
      return value ?? '';
    });

    if (!usable) break;
    segments.push(filled);
  }

  return segments.join('/');
}

/** The full folder a new note of one kind goes in, given the date it is about. */
export function noteFolderFor(
  settings: NODAtrailSettings,
  type: NodaFolderType,
  date: Date | null
): string {
  return joinFolder(folderFor(settings, type), expandSubfolder(subfolderFor(settings, type), date));
}

/** The template configured for one kind. The four that have one; the PARA kinds file flat. */
export function subfolderFor(settings: NODAtrailSettings, type: NodaFolderType): string {
  switch (type) {
    case 'bill':
      return settings.billSubfolder;
    case 'purchase':
      return settings.purchaseSubfolder;
    case 'budget':
      return settings.budgetSubfolder;
    case 'recurring':
      return settings.recurringSubfolder;
    case 'journal':
      return settings.journalSubfolder;
    default:
      return '';
  }
}

/** An ISO day as a Date, for a caller holding what a note says rather than a Date. */
export function dateOf(isoDay: string | null): Date | null {
  return isoDay ? parseDayTitle(isoDay) : null;
}

/**
 * The date a budget note is filed by: the first day of the period it is for.
 *
 * Read from the period string rather than from a date property, because that
 * string is the only thing a budget states about when it applies. A period
 * nothing can parse files the note flat, which is the same fallback every other
 * kind gets.
 */
export function budgetDateOf(period: string | null): Date | null {
  const text = period?.trim() ?? '';
  const year = /^(\d{4})/.exec(text);
  if (!year) return null;

  const month = /^\d{4}-(\d{2})$/.exec(text);
  const quarter = /^\d{4}-Q([1-4])$/i.exec(text);

  const monthIndex = month ? Number(month[1]) - 1 : quarter ? (Number(quarter[1]) - 1) * 3 : 0;
  return new Date(Number(year[1]), monthIndex, 1);
}
