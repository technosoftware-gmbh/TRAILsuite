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
import {
  emptyDraft,
  type FollowUp,
  entryLines,
  headingsFor,
  type DayEntryDraft,
  type DayEntryKind,
} from './add-to-day';
import { meetingMarkers, parseScheduleLine, type ScheduleEntry } from './read-schedule';

export interface DayEntryRecord {
  kind: DayEntryKind;
  draft: DayEntryDraft;
  /** What to show: the line's own text, already stripped of marker and time. */
  label: string;
  /** `11:00-12:00`, or empty. */
  span: string;
  links: string[];
  /** Zero-based, into the **body** rather than the file. Half open, so a meeting covers its children. */
  from: number;
  to: number;
  /** False when the line says something the dialog has no field for. */
  editable: boolean;
}

/** The lines of a section, with the index each one sits at in the body. */
function sectionLines(body: string, headings: readonly string[]): { line: string; at: number }[] {
  const lines = body.split('\n');
  const start = lines.findIndex((line) =>
    headings.some((heading) => line.trim() === heading.trim())
  );
  if (start === -1) return [];

  const level = (/^(#{1,6})\s/.exec(lines[start] ?? '')?.[1] ?? '').length;
  const out: { line: string; at: number }[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const next = (/^(#{1,6})\s/.exec(lines[index] ?? '')?.[1] ?? '').length;
    if (next > 0 && next <= level) break;
    out.push({ line: lines[index] ?? '', at: index });
  }
  return out;
}

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

/** A meeting's children: the indented lines that follow it, up to the next unindented bullet. */
function childrenOf(lines: readonly { line: string; at: number }[], index: number): number {
  let end = index + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end]?.line ?? '')) end += 1;
  return end;
}

/**
 * The meeting entries of a body, with their positions, without a file.
 *
 * Exported for the one caller that has to move an entry rather than rewrite it
 * in place: it needs the positions of the entries around the one it is moving,
 * on a body it is holding in memory between two edits, which a reader taking a
 * `TFile` cannot give it.
 */
export function meetingsIn(body: string, settings: NODAtrailSettings): DayEntryRecord[] {
  return meetings(body, settings);
}

function meetings(body: string, settings: NODAtrailSettings): DayEntryRecord[] {
  const lines = sectionLines(body, headingsFor(settings, 'meeting'));
  const out: DayEntryRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index];
    if (!row || /^\s/.test(row.line)) continue;

    const parsed = parseScheduleLine(row.line, meetingMarkers(settings));
    if (!parsed) continue;

    const end = childrenOf(lines, index);
    const own = lines.slice(index, end).map((entry) => entry.line);
    const draft: DayEntryDraft = {
      ...emptyDraft('meeting'),
      attendance: parsed.attendance,
      text: parsed.text,
      context: parsed.links[0] ?? '',
      startTime: parsed.from,
      endTime: parsed.to,
      notes: childText(own, settings.dayNoteMarker),
      followUps: childTasks(own),
    };

    out.push({
      kind: 'meeting',
      draft,
      label: parsed.text,
      span: parsed.from && parsed.to ? `${parsed.from}-${parsed.to}` : parsed.from || parsed.to,
      links: parsed.links,
      from: row.at,
      to: (lines[end - 1]?.at ?? row.at) + 1,
      editable: reproduces(settings, draft, own),
    });
    index = end - 1;
  }
  return out;
}

/** The indented note lines under a meeting, as the dialog's box would hold them. */
function childText(own: readonly string[], marker: string): string {
  const mark = marker.trim();
  return own
    .slice(1)
    .filter((line) => !/^\s*[-*+]\s+\[.\]/.test(line))
    .map((line) => {
      const rest = /^\s*[-*+]\s+(.*)$/.exec(line)?.[1] ?? '';
      return mark && rest.startsWith(mark) ? rest.slice(mark.length).trim() : rest.trim();
    })
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * The indented checkbox lines under a meeting, as the row editor holds them.
 *
 * **The remainder is kept whole in `text`, links and dates included.** That is
 * what makes the round trip exact, which is what decides whether the meeting
 * may be edited at all: composing the row back has to reproduce the line
 * character for character, and picking the link out into `context` and the date
 * out into `due` would put them back in a different order.
 *
 * So a follow-up read from a note is offered as one text field. A row typed
 * into the editor is composed from three. Both produce the same shape of line;
 * only the editing of an existing one is coarser, and it is coarser in the
 * direction that cannot lose anything.
 */
function childTasks(own: readonly string[]): FollowUp[] {
  return own
    .slice(1)
    .map((line) => /^\s*[-*+]\s+\[.\]\s*(.*)$/.exec(line)?.[1] ?? '')
    .filter((line) => line !== '')
    .map((text) => ({ text, context: '', due: '' }));
}

function thoughts(body: string, settings: NODAtrailSettings): DayEntryRecord[] {
  const lines = sectionLines(body, headingsFor(settings, 'idea'));
  const out: DayEntryRecord[] = [];

  for (const row of lines) {
    if (/^\s/.test(row.line)) continue;
    // No markers: a thought's own marker is read below, and handing the
    // meeting markers to a note would strip one off a line that merely starts
    // with the same emoji.
    const parsed = parseScheduleLine(row.line, {
      accepted: '',
      tentative: '',
      unanswered: '',
      declined: '',
    });
    if (!parsed) continue;

    // Which of the two it is comes from the marker it carries. A line with
    // neither is a note: that is the milder reading, and the one that does not
    // claim somebody wrote down an idea when they wrote down a fact.
    const idea = settings.dayIdeaMarker.trim();
    const rest = /^\s*[-*+]\s+(.*)$/.exec(row.line)?.[1]?.trim() ?? '';
    const kind: DayEntryKind = idea && rest.startsWith(idea) ? 'idea' : 'note';

    const marker = kind === 'idea' ? idea : settings.dayNoteMarker.trim();
    const text = marker && rest.startsWith(marker) ? rest.slice(marker.length).trim() : rest;
    const links = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => (match[1] ?? '').trim());

    const draft: DayEntryDraft = {
      ...emptyDraft(kind),
      text: text
        .replace(/\[\[[^\]]+\]\]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
      context: links[0] ?? '',
    };

    out.push({
      kind,
      draft,
      label: draft.text,
      span: '',
      links,
      from: row.at,
      to: row.at + 1,
      editable: reproduces(settings, draft, [row.line]),
    });
  }
  return out;
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
  wanted: Pick<ScheduleEntry, 'from' | 'to' | 'text'>
): Promise<DayEntryRecord | null> {
  const { meetings: found } = await readDayEntries(app, settings, file);
  const matches = found.filter(
    (record) =>
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
  return { meetings: meetings(body, settings), thoughts: thoughts(body, settings) };
}
