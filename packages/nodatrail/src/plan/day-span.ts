/**
 * Finding the other days a line runs over, without anything having been
 * written down about it.
 *
 * **Nothing marks a span as a span.** A holiday from the 13th to the 26th is
 * fourteen ordinary lines in fourteen ordinary notes, indistinguishable from
 * fourteen a person typed one at a time -- which is exactly the property §D of
 * `calendar-import.md` spent a fortnight arriving at, and the reason the
 * calendar import derives its key rather than remembering what it wrote. A
 * counter in the line (`Ferien (3/14)`) would make this function trivial and
 * would put a new element into a note format that is much easier to add to than
 * to take back.
 *
 * So the span is recovered the same way the importer recovers its history: by
 * reading what is there now. Walk out from the day somebody clicked, one day at
 * a time, for as long as the neighbouring note holds **exactly one** entry of
 * the same kind saying the same thing. The first day that does not is the edge.
 *
 * **Where it stops is as much of the answer as how far it got.** A day saying
 * this twice gives no way to tell which line belongs to the span, and a day
 * whose line says more than the dialog can compose back must not be rewritten
 * at all -- `read-day.ts` holds that rule and it does not get weaker for being
 * reached from here. Both are boundaries, and both are named in `refused` so
 * the dialog can say the span may run further rather than quietly claiming it
 * does not.
 *
 * What this cannot do is tell a span from a coincidence. Two separate notes
 * reading `Sport` on consecutive Tuesdays are one span to this function if they
 * happen to be adjacent. That is the honest cost of storing nothing, it is
 * visible in the dialog before anything is written, and the alternative was the
 * counter.
 */
import { TFile, type App } from 'obsidian';
import { addDays, formatDayTitle, parseDayTitle } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { spans } from './add-to-day';
import { notePathFor } from './paths';
import { readDayEntries, type DayEntryRecord } from './read-day';

/** One day of a span: where the line is, and which line it is. */
export interface SpanDay {
  /** ISO day, which is also the note's title. */
  day: string;
  file: TFile;
  record: DayEntryRecord;
}

/** Why a day at the edge was not taken into the span. */
export type SpanRefusal = 'ambiguous' | 'not-editable';

export interface FoundSpan {
  /** First and last day claimed. Equal, and one day long, for an ordinary entry. */
  from: string;
  to: string;
  days: SpanDay[];
  /**
   * The days the walk stopped at for a reason other than the span ending. At
   * most one on each side, and each one means the span may really run further.
   */
  refused: { day: string; why: SpanRefusal }[];
}

/**
 * A year each way.
 *
 * Not a guard against a pathological vault so much as against this function:
 * every step is a file read, and a bug in the match would otherwise walk the
 * whole calendar reading notes. A span longer than a year is a thing to write
 * on an area note, not into three hundred and sixty-six day notes.
 */
const REACH = 366;

/** Whether two entries are the same line said on two days. */
function sameEntry(a: DayEntryRecord, b: DayEntryRecord): boolean {
  return (
    a.kind === b.kind &&
    a.draft.text === b.draft.text &&
    a.draft.context.trim() === b.draft.context.trim()
  );
}

/** The records on one day that could be this entry, and the file holding them. */
async function dayOf(
  app: App,
  settings: NODAtrailSettings,
  day: string,
  wanted: DayEntryRecord
): Promise<{ file: TFile; matches: DayEntryRecord[] } | null> {
  const date = parseDayTitle(day);
  if (!date) return null;

  const file = app.vault.getAbstractFileByPath(notePathFor(settings, 'day', date));
  if (!(file instanceof TFile)) return null;

  // The section the kind lives in, and only that one. A span sits under the
  // schedule with the meetings; a note and an idea sit under the thoughts.
  const { meetings, thoughts } = await readDayEntries(app, settings, file);
  const here = wanted.kind === 'span' ? meetings : thoughts;
  return { file, matches: here.filter((record) => sameEntry(record, wanted)) };
}

/**
 * The span the given entry belongs to, as the vault says it is right now.
 *
 * The anchor day is always in the result, whatever its neighbours say: it is
 * the entry somebody clicked and the record they were shown. A kind that cannot
 * span comes back as itself, one day long, so a caller need not ask twice.
 */
export async function findDaySpan(
  app: App,
  settings: NODAtrailSettings,
  anchorDay: string,
  anchor: { file: TFile; entry: DayEntryRecord }
): Promise<FoundSpan> {
  const here: SpanDay = { day: anchorDay, file: anchor.file, record: anchor.entry };
  const found: FoundSpan = { from: anchorDay, to: anchorDay, days: [here], refused: [] };

  const start = parseDayTitle(anchorDay);
  if (!start || !spans(anchor.entry.kind)) return found;

  for (const step of [-1, 1] as const) {
    const claimed: SpanDay[] = [];
    for (let offset = 1; offset <= REACH; offset += 1) {
      const day = formatDayTitle(addDays(start, step * offset));
      const read = await dayOf(app, settings, day, anchor.entry);
      // No note, or nothing on it that says this: the span ended, which is the
      // ordinary way out and is not a refusal.
      if (!read || read.matches.length === 0) break;

      if (read.matches.length > 1) {
        found.refused.push({ day, why: 'ambiguous' });
        break;
      }
      const record = read.matches[0];
      if (!record) break;
      if (!record.editable) {
        found.refused.push({ day, why: 'not-editable' });
        break;
      }

      claimed.push({ day, file: read.file, record });
    }

    if (step === -1) {
      claimed.reverse();
      found.days.unshift(...claimed);
      found.from = found.days[0]?.day ?? anchorDay;
    } else {
      found.days.push(...claimed);
      found.to = found.days[found.days.length - 1]?.day ?? anchorDay;
    }
  }

  return found;
}
