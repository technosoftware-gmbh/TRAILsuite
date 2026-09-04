/**
 * The meetings of many days at once, for the week and the month.
 *
 * `read-schedule.ts` answers "what is on this day" from one note. This asks it
 * of thirty-one, which is what a calendar needs and what the day view's own
 * comment said would want a cache first: *"a week of meetings is seven notes
 * read on every render... it wants a cache rather than seven more reads."*
 *
 * **That objection turned out to be measuring the wrong thing.** `readTasks()`
 * already reads every note under `taskFolders` on every render -- 139 of them
 * in the vault this was written against -- and the daily-note folder is one of
 * those folders, so the day notes a month needs are already being opened and
 * parsed on the same pass. Thirty-one more reads is not thirty-one more than
 * nothing; it is a fifth again of a cost already paid, for the one thing a
 * calendar is actually for. A cache would still be the answer if the schedule
 * ever wants to be live rather than redrawn.
 *
 * Missing days are simply absent from the result. Most days have no note at
 * all, and a map entry holding an empty list would make every caller check
 * twice for the same nothing.
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { parseDayTitle } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { headingsFor } from './add-to-day';
import { notePathFor } from './paths';
import { readSchedule, type ScheduleEntry } from './read-schedule';

/** One day that has meetings on it, and the note they are written in. */
export interface DayMeetings {
  file: TFile;
  entries: ScheduleEntry[];
}

/**
 * ISO day to its meetings, for every day given that has any.
 *
 * Read in parallel rather than in sequence. Obsidian's vault reads are
 * independent and a month done one after another is thirty-one round trips
 * before the first cell can be drawn.
 */
export async function readScheduleRange(
  app: App,
  settings: NODAtrailSettings,
  days: readonly string[]
): Promise<Map<string, DayMeetings>> {
  const headings = headingsFor(settings, 'meeting');

  const found = await Promise.all(
    days.map(async (iso): Promise<[string, DayMeetings] | null> => {
      const date = parseDayTitle(iso);
      if (date === null) return null;

      const file = app.vault.getAbstractFileByPath(notePathFor(settings, 'day', date));
      // A folder can sit at a note's path, and handing one to the reader asks
      // Obsidian to read a directory.
      if (!(file instanceof TFile)) return null;

      const entries = await readSchedule(app, settings, file, headings);
      return entries.length === 0 ? null : [iso, { file, entries }];
    })
  );

  return new Map(found.filter((pair): pair is [string, DayMeetings] => pair !== null));
}
