/**
 * The day entries that name a note, for the block that note carries.
 *
 * **A Person note is the first use and not the only one.** The question "which
 * days name this note" is the same question whether the note is a person, a
 * trip or a restaurant, and the answer is found the same way: an entry names a
 * note by linking to it. So a trip note carrying this fence lists the days its
 * own seeded stops were written into, which is §F.3 of
 * `docs/design/day-entry-links.md` and cost no code of its own.
 *
 * **An excursion is the one that does not work yet**, and it is worth writing
 * down why rather than leaving it to be discovered: a seeded stop says the
 * excursion as its *text* and links only the trip, so an excursion note has
 * nothing pointing at it to be found by. Making it a link would be a format
 * question rather than a reading one.
 *
 * **It asks the vault which notes link here rather than reading them all.**
 * `metadataCache.resolvedLinks` already holds, for every note, what it links
 * to; a person who appears in forty day notes costs forty reads rather than
 * one per day note in the vault. That is the difference between a block that
 * renders when a note is opened and one that makes opening a note slow, and it
 * is why this does not reuse `readScheduleRange`, which reads a range whether
 * or not those days say anything.
 *
 * **Only day notes.** A note can be linked from anywhere -- a project, a bill,
 * another trip -- and this answers one question: which days wrote about it. A
 * note that is not a day note is not an answer to it. The check is
 * `detectPeriodNote`, so a vault whose template does not produce the title is
 * not claimed.
 *
 * **Newest first and capped.** Somebody's wife appears in years of day notes,
 * and a block that drew all of them would be a wall nobody reads. The cap is
 * this module's rather than a setting: the block says how many more there are,
 * which is the number worth knowing.
 *
 * Nothing here writes.
 */
import { TFile, type App } from 'obsidian';
import { titlesMatch } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { detectPeriodNote } from './detect';
import { readDayEntries, type DayEntryRecord } from './read-day';

/** One entry on one day, as the block draws it. */
export interface NamingDay {
  /** The day note's title, which for the shipped template is the ISO day. */
  day: string;
  file: TFile;
  record: DayEntryRecord;
}

/** How many are drawn before the block says how many more there are. */
export const NAMING_DAY_LIMIT = 40;

export interface NamingDays {
  entries: NamingDay[];
  /** Entries found beyond the cap. Zero when everything found is drawn. */
  more: number;
}

/**
 * The day notes that link to this one, newest first.
 *
 * Sorted by title, which is the ISO day under every template that
 * `detectPeriodNote` recognises as a day. A vault whose day notes sort
 * differently from their dates is one this does not claim at all.
 */
function linkingDayNotes(app: App, settings: NODAtrailSettings, target: TFile): TFile[] {
  const out: TFile[] = [];

  for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
    if (!(target.path in targets)) continue;

    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) continue;
    if (detectPeriodNote(settings, file.basename)?.level !== 'day') continue;
    out.push(file);
  }

  return out.sort((a, b) => b.basename.localeCompare(a.basename));
}

/**
 * Every entry in those notes that names this one, in the order the days run.
 *
 * **Matched on the link, not on the text.** An entry names a note by carrying
 * its title in a link, which is exactly what `record.links` collects from the
 * headline and the children alike. A meeting whose text happens to mention a
 * name is not an answer: the whole point of writing the person on a child line
 * was to say it in a way a reader can be sure about.
 */
export async function readDaysNaming(
  app: App,
  settings: NODAtrailSettings,
  subject: TFile,
  limit = NAMING_DAY_LIMIT
): Promise<NamingDays> {
  const found: NamingDay[] = [];

  for (const file of linkingDayNotes(app, settings, subject)) {
    const { meetings, thoughts } = await readDayEntries(app, settings, file);
    for (const record of [...meetings, ...thoughts]) {
      if (!record.links.some((link) => titlesMatch(link, subject.basename))) continue;
      found.push({ day: file.basename, file, record });
    }
  }

  return { entries: found.slice(0, limit), more: Math.max(0, found.length - limit) };
}
