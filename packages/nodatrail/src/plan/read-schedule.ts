/**
 * Reading the meetings back out of a day note, for display and nothing else.
 *
 * `docs/design/day-notes.md` deferred parsing the body: "a parser for the body
 * format is a parser that can mangle a note you also edited by hand". That
 * reasoning was about **writing**, and it still holds -- nothing here writes.
 *
 * What the design got wrong is that it deferred the reading too, and the first
 * day of real use showed why that was wrong: a day view that lists a task and
 * silently omits the two hours the day was actually spent in is not showing the
 * day. Reading is safe where writing is not, so the read half comes forward and
 * the write half stays deferred.
 *
 * **A line this cannot make sense of is skipped, never guessed at.** A day note
 * is written by hand as well as by the dialog, and a bullet somebody typed
 * under the schedule heading is not required to look like ours.
 */
import type { App, TFile } from 'obsidian';
import { splitFrontmatterBlock } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import {
  scheduleMarkers,
  parseScheduleLine,
  sectionLines,
  type ScheduleEntry,
} from './schedule-line';

export {
  parseScheduleLine,
  scheduleMarkers,
  type Attendance,
  type ScheduleEntry,
  type ScheduleMarkers,
} from './schedule-line';

/**
 * The day's schedule, in the order the note lists it.
 *
 * **Not sorted by time.** The note's order is the order somebody wrote things
 * down in, and a view that reordered them would disagree with the note it is
 * showing. An entry with no time has nowhere to sort to anyway.
 */
export async function readSchedule(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  headings: readonly string[]
): Promise<ScheduleEntry[]> {
  const text = await hostFor(app).vault.read(file);
  const { body } = splitFrontmatterBlock(text);

  const found: ScheduleEntry[] = [];
  for (const line of sectionLines(body, headings)) {
    const entry = parseScheduleLine(line, scheduleMarkers(settings));
    if (entry) found.push(entry);
  }
  return found;
}
