/**
 * The period notes (days, weeks, months, quarters, years), read through the
 * core's vault ports, for the interchange export.
 *
 * Imports nothing from `obsidian`, which `tests/host-free.test.ts` enforces by
 * walking the export that uses it. Inside Obsidian the plan views read a day
 * with `read-day.ts` and `read-schedule.ts`; the parsing underneath both is
 * `day-entries.ts` and `schedule-line.ts`, and this reads with the same two.
 *
 * **A period note is the note at the path its template gives.** Its title must
 * name a period and the note must sit exactly where `dailyPath` (or the weekly,
 * monthly, quarterly or yearly template) puts that period. Narrower than the
 * plan view, which recognises a period by title alone, on purpose: a journal
 * note is titled `2026-09` exactly like a month note, and a reader that went by
 * title would claim every journal note twice.
 *
 * **What leaves is what the note says, parsed, and nothing it does not.** The
 * schedule (meetings and spans) and the thoughts (notes and ideas) come out as
 * the plan view reads them, with every wikilink resolved to the note behind it.
 * Tasks do not: they are checkbox lines, and they leave as task lines
 * (`task-reader.ts`) whatever note holds them. A follow-up written under a
 * meeting is such a line, and it sits inside the meeting's `lines` range, which
 * is how an importer tells which meeting it came from. The body itself, with
 * whatever else somebody typed into it, is in `vault.json`, raw.
 */
import {
  detectPeriodLevel,
  linkResolver,
  parsePeriodTitle,
  periodRange,
  splitFrontmatterBlock,
  type InterchangeRef,
  type LinkResolver,
  type PeriodLevel,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { translationsOf } from '../lang/all-locales';
import type { Attendance } from './schedule-line';
import { dayHeadings } from './day-headings';
import { meetingsOf, thoughtsOf, type DayEntryRecord } from './day-entries';
import { notePathFor } from './paths';

/** A title as the note wrote it, and the note it resolves to, or null when it resolves to none. */
export interface LinkedNote {
  title: string;
  note: InterchangeRef | null;
}

/** One entry of a period note: a meeting or a span from the schedule, a note or an idea from the thoughts. */
export interface PeriodEntry {
  kind: 'meeting' | 'span' | 'note' | 'idea';
  /** What was answered. Empty for accepted, for a meeting nobody was asked about, and for anything that is not a meeting. */
  attendance: Attendance;
  /** `09:00`, or empty. */
  start: string;
  end: string;
  /** What the line says, with the marker, the time and the wikilinks off. */
  text: string;
  /** The first link on the line: what the entry is about, usually a project. */
  context: LinkedNote | null;
  place: LinkedNote | null;
  persons: LinkedNote[];
  /** The indented note lines under a meeting, one per line. */
  notes: string;
  /** Every link the entry carries, the line and its children alike. */
  links: LinkedNote[];
  /**
   * Zero-based and half open, into the whole file as the vault holds it: the
   * entry's own line and the children under it. A task line inside the range
   * is one of the entry's follow-ups.
   */
  lines: { from: number; to: number };
  /**
   * False when the line says something the day dialog has no field for, so the
   * parsed fields do not hold all of it. The line itself is in `vault.json`.
   */
  complete: boolean;
}

export interface PeriodRecord<F extends VaultFile = VaultFile> {
  file: F;
  title: string;
  level: PeriodLevel;
  /** The first and last day the period covers, ISO. */
  from: string;
  to: string;
  schedule: PeriodEntry[];
  thoughts: PeriodEntry[];
}

/** Which level and date a note is, when it is the note its level's template puts at that path. */
export function periodOf(
  settings: NODAtrailSettings,
  file: VaultFile
): { level: PeriodLevel; date: Date } | null {
  const level = detectPeriodLevel(file.basename);
  if (!level) return null;
  const date = parsePeriodTitle(level, file.basename);
  if (!date) return null;
  // NFC on both sides: a folder setting typed on a Mac can hold an umlaut
  // decomposed, and the export's paths are composed.
  const expected = notePathFor(settings, level, date).normalize('NFC');
  return expected === file.path.normalize('NFC') ? { level, date } : null;
}

/** Each non-blank title, with the note it resolves to. */
export function linkedAll(resolve: LinkResolver, titles: readonly string[]): LinkedNote[] {
  const out: LinkedNote[] = [];
  for (const title of titles) {
    const one = linked(resolve, title);
    if (one) out.push(one);
  }
  return out;
}

/** A title, with the note it resolves to. Null for a blank title. */
export function linked(resolve: LinkResolver, title: string): LinkedNote | null {
  const clean = title.trim();
  if (!clean) return null;
  const file = resolve(clean);
  return { title: clean, note: file ? { ref: file.path } : null };
}

function entry(
  resolve: LinkResolver,
  record: DayEntryRecord,
  offset: number,
  complete: (record: DayEntryRecord) => boolean
): PeriodEntry {
  const { draft } = record;
  const kind = record.kind === 'task' ? 'note' : record.kind;
  return {
    kind,
    attendance: draft.attendance,
    start: draft.startTime,
    end: draft.endTime,
    text: draft.text,
    context: linked(resolve, draft.context),
    place: linked(resolve, draft.place),
    persons: linkedAll(resolve, draft.persons),
    notes: draft.notes,
    links: linkedAll(resolve, record.links),
    lines: { from: record.from + offset, to: record.to + offset },
    complete: complete(record),
  };
}

/**
 * Every period note in the vault, in path order.
 *
 * `complete` is the edit guard's answer where the caller can give it (inside
 * Obsidian, `read-day.ts` composes the entry back). The export cannot compose
 * a line in a language it does not know, so by default it asks a narrower
 * question it can answer: did every link and every child line of the entry
 * find a field to go into.
 */
export async function readPeriodNotesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): Promise<PeriodRecord<F>[]> {
  const files = host.vault.markdownFiles();
  const resolve = linkResolver(files);
  const schedule = dayHeadings(settings, 'meeting', translationsOf);
  const thoughts = dayHeadings(settings, 'idea', translationsOf);

  const found: PeriodRecord<F>[] = [];
  for (const file of files) {
    const period = periodOf(settings, file);
    if (!period) continue;

    const text = await host.vault.read(file);
    const { body } = splitFrontmatterBlock(text);
    // Entry positions are into the body; the file's lines start earlier by
    // however many the frontmatter block takes.
    const offset = text.split('\n').length - body.split('\n').length;
    const range = periodRange(period.level, period.date);

    found.push({
      file,
      title: file.basename,
      level: period.level,
      from: range.from,
      to: range.to,
      schedule: meetingsOf(body, settings, schedule, () => true).map((record) =>
        entry(resolve, record, offset, fieldsHoldAll)
      ),
      thoughts: thoughtsOf(body, settings, thoughts, () => true).map((record) =>
        entry(resolve, record, offset, fieldsHoldAll)
      ),
    });
  }
  return found.sort((a, b) => (a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0));
}

/**
 * Whether the parsed fields account for every link the entry carries.
 *
 * The export's stand-in for the edit guard. It catches what an importer would
 * otherwise lose without noticing, a link on a child line no field reads, and
 * it errs towards `false`: the note's text is in `vault.json` either way.
 */
function fieldsHoldAll(record: DayEntryRecord): boolean {
  const { draft } = record;
  const held = new Set(
    [draft.context, draft.place, ...draft.persons].filter(Boolean).map((title) => title.trim())
  );
  return record.links.every((title) => held.has(title.trim()));
}
