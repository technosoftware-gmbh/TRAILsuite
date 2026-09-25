/**
 * The entries in one day note, located well enough to edit them.
 *
 * `read-schedule.ts` answers "what is on today" for display. This answers "which
 * lines is that entry, and may we rewrite them" -- which is a stronger question
 * and carries the rule that makes editing safe at all:
 *
 * **An entry is editable only when the plugin can reproduce its line exactly.**
 * Every candidate is parsed into a draft, the draft is composed back into a
 * line, and the two are compared. Equal means the dialog understands everything
 * the line says and can rewrite it losing nothing. Different means the line
 * carries something this plugin has no field for -- a tag, an unfamiliar emoji,
 * somebody's own formatting -- and the entry is shown, is not offered for
 * editing, and opens the note instead.
 *
 * That is a deliberately conservative rule and it is the whole safety of the
 * feature. Without it, editing a meeting's time would quietly drop whatever
 * else was on the line, in a note somebody keeps records in, and they would
 * find out weeks later.
 */
import type { App, TFile } from 'obsidian';
import { splitFrontmatterBlock } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { entryLines, headingsFor, type DayEntryDraft } from './add-to-day';
import type { ScheduleEntry } from './read-schedule';
import { meetingsOf, thoughtsOf, type DayEntryRecord, type Reproduces } from './day-entries';

export type { DayEntryRecord } from './day-entries';

/**
 * Two spellings of one line, for the comparison below only.
 *
 * A run of spaces inside a line is collapsed; the indent in front of it and
 * anything trailing it are left alone. Leading whitespace says which meeting a
 * child belongs to and trailing whitespace is a hard line break, and neither is
 * decoration the editor may quietly drop.
 */
function sameLine(a: string, b: string): boolean {
  const inner = (line: string) => line.replace(/(\S)[ \t]{2,}/g, '$1 ');
  return inner(a) === inner(b);
}

/**
 * True when composing the draft gives back the line it came from.
 *
 * **Character for character, except for a run of spaces inside the line.** The
 * strict comparison was right and had one blind spot: `parseScheduleLine`
 * collapses whitespace as it reads, so a line carrying a double space could
 * never compose back to itself and was read-only for ever. `collapseSpaces`
 * stops this plugin writing such a line, but it cannot reach the ones already
 * in somebody's notes -- and a calendar import had just written a week of them.
 *
 * What the looser reading costs is exact: editing such an entry rewrites it
 * with one space where it had two. Markdown renders the two identically, the
 * change happens only when a person chose to edit that line, and it is the
 * whole of the difference. Everything else the guard refuses, it still refuses.
 */
function reproduces(
  settings: NODAtrailSettings,
  draft: DayEntryDraft,
  original: string[]
): boolean {
  // No day: composing an entry that is already in a note must add nothing, or
  // an undated follow-up written before this rule existed would stop
  // reproducing and its meeting would quietly become read-only.
  const composed = entryLines(settings, draft);
  if (composed.length !== original.length) return false;
  return composed.every((line, index) => sameLine(line, original[index] ?? ''));
}

/** `reproduces` bound to the settings, in the shape `day-entries.ts` takes it. */
function guard(settings: NODAtrailSettings): Reproduces {
  return (draft, original) => reproduces(settings, draft, original);
}

/**
 * The schedule entries of a body, with their positions, without a file.
 *
 * Exported for the one caller that has to move an entry rather than rewrite it
 * in place: it needs the positions of the entries around the one it is moving,
 * on a body it is holding in memory between two edits, which a reader taking a
 * `TFile` cannot give it.
 *
 * **Spans are in here with the meetings**, because they share the section and
 * that caller is asking where the lines are. A span sorts nowhere -- its start
 * is blank, and blank is not greater than any time -- so it is never a boundary
 * and never moves, which is the same treatment an untimed meeting already gets.
 */
export function meetingsIn(body: string, settings: NODAtrailSettings): DayEntryRecord[] {
  return meetingsOf(body, settings, headingsFor(settings, 'meeting'), guard(settings));
}

/**
 * The record for one meeting the calendar views are showing, read fresh.
 *
 * **Read now rather than kept.** A `DayEntryRecord` carries line numbers into
 * the body, and the editor refuses to rewrite a line that has moved since the
 * view was drawn -- rightly, since rewriting the wrong line is a silent edit to
 * somebody's records. The day view survives that because it redraws after every
 * change; a week or a month holds thirty-one notes' worth of positions and any
 * one of them can go stale while the view sits there. So the week keeps no
 * positions at all and asks the note again at the moment of the click.
 *
 * **Matched on what the line says, and only when it says it once.** The week
 * reads a day with `readSchedule`, which parses every bullet under the heading
 * including the notes indented under a meeting; this reads the same section
 * with `readDayEntries`, which folds those into their parent. The two therefore
 * do not agree about how many entries a day has, and an ordinal would sooner or
 * later open the wrong one. The time and the text are what both of them parsed
 * out of the same line, so they are the thing to compare.
 *
 * Null when nothing matches -- a note line clicked in the week is not a meeting
 * here -- and null when several do, because two identical lines on one day give
 * no way to say which was clicked. Both cases leave the caller to open the note,
 * which is where a person can see the difference for themselves.
 */
export async function findDayEntry(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  wanted: Pick<ScheduleEntry, 'from' | 'to' | 'text'> & Partial<Pick<ScheduleEntry, 'kind'>>
): Promise<DayEntryRecord | null> {
  const { meetings: found } = await readDayEntries(app, settings, file);
  // **The kind is part of the match now that two shapes share the section.** A
  // span and an all-day meeting are both untimed, so a span called `Ferien` and
  // an imported all-day `Ferien` on one day are indistinguishable on time and
  // text alone -- and the importer, which passes no kind, must never be handed
  // the span as the meeting it wrote.
  const kind = wanted.kind ?? 'meeting';
  const matches = found.filter(
    (record) =>
      record.kind === kind &&
      record.draft.startTime === wanted.from &&
      record.draft.endTime === wanted.to &&
      record.draft.text === wanted.text
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Everything in the note that the dialog wrote or could have written. */
export async function readDayEntries(
  app: App,
  settings: NODAtrailSettings,
  file: TFile
): Promise<{ meetings: DayEntryRecord[]; thoughts: DayEntryRecord[] }> {
  const text = await hostFor(app).vault.read(file);
  const { body } = splitFrontmatterBlock(text);
  return {
    meetings: meetingsOf(body, settings, headingsFor(settings, 'meeting'), guard(settings)),
    thoughts: thoughtsOf(body, settings, headingsFor(settings, 'idea'), guard(settings)),
  };
}
