/**
 * Keeping the calendar file an import came from, and replaying it.
 *
 * §D of `docs/design/calendar-import.md` decided this over a record in
 * `data.json`, and the reason is the one `statement-archive.ts` already gives
 * for the same choice: *"Replayed rather than remembered. Nothing was written
 * down about the import, so this is what is true now."* A list of what was
 * written can drift from the notes it describes. A file cannot: it either says
 * a meeting was on the 14th or it does not.
 *
 * **What replay recovers is what an export offered**, not what the importer
 * wrote -- a line already in the note was offered and skipped, and afterwards
 * nothing distinguishes them. `PriorLine` in the core says so, and §D says what
 * the weaker claim costs. What it still guarantees is the one that mattered: a
 * meeting somebody typed by hand was in no export, so it is in no archived file
 * either, and can never be reported as having gone from one.
 *
 * **Per source, and the source is the file's own name.** Two exports, one
 * business and one private, are two archives: a meeting absent from the
 * business calendar is not cancelled, it is in the private one. §H, which
 * reached the same conclusion by way of colours not existing.
 *
 * The pure half and the vault half share a file here, unlike the statement
 * archive's two. There is a third as much of it, and the split earns its keep
 * when there is enough on each side to read separately.
 */
import { TFile, normalizePath, type App } from 'obsidian';
import {
  calendarOwner,
  expandEvents,
  parseIcs,
  parseDayTitle,
  priorLinesOf,
  type PriorImport,
  type PriorLine,
} from '@technosoftware/trail-core';
import { joinFolder } from '@technosoftware/trail-core';
import { noteFolderFor } from './paths';
import { vaultZone } from './vault-zone';
import type { NODAtrailSettings } from '../settings/types';

/** What an archived calendar file's name says about it. */
export interface CalendarArchiveName {
  /** The source it came from: the stem of the file that was imported. */
  source: string;
  from: string;
  to: string;
}

export interface ArchivedCalendar {
  file: TFile;
  name: CalendarArchiveName;
}

/** `2026-09-01` as `20260901`, which is how this vault names a document. */
function compact(day: string): string {
  return day.replace(/-/g, '');
}

/**
 * A source name that survives being a filename and being read back.
 *
 * Lower case, and everything that is not a letter or a digit becomes a hyphen.
 * The name has to round-trip through the archive's own filename, where a
 * literal `_` would split the source from the range and an accent would come
 * back differently depending on which machine wrote it.
 */
export function sourceSlug(fileName: string): string {
  const stem = fileName.replace(/\.[^./]*$/, '');
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // A name made entirely of characters that do not survive is still a name
  // somebody chose. Calling it "calendar" keeps the archive readable and keeps
  // two such files apart by their range, which is the rest of the name.
  return slug === '' ? 'calendar' : slug;
}

/**
 * `20260907-20260913_business.ics`: the range it was imported under, then the
 * source.
 *
 * The range first because that is how the rest of this vault's documents are
 * named and how somebody looks for one, and because the range is what the
 * replay needs: an archived file is only evidence about the days it was read
 * for.
 */
export function calendarFileName(source: string, from: string, to: string): string {
  return `${compact(from)}-${compact(to)}_${sourceSlug(source)}.ics`;
}

/**
 * Reading the name back.
 *
 * Only names this plugin wrote are recognised. An `.ics` somebody dropped into
 * the folder themselves is left alone rather than guessed at: a wrong guess
 * about which range a file covers would report meetings gone that the file was
 * never read for, which is the exact failure §I.2 exists to prevent.
 */
export function readCalendarFileName(name: string): CalendarArchiveName | null {
  const match = /^(\d{8})-(\d{8})_([a-z0-9-]+)\.ics$/i.exec(name.trim());
  if (!match) return null;

  const [, from, to, source] = match;
  if (!from || !to || !source) return null;

  const day = (value: string) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return { source: source.toLowerCase(), from: day(from), to: day(to) };
}

/**
 * Where an archived calendar is filed: the day notes' document folder, for the
 * month the range starts in.
 *
 * Beside the notes it fed, which is where the statement archive puts a CSV and
 * where an invoice for a bill goes. Empty when `documentSubfolder` is blank --
 * "leave documents where they are" -- and here that means keep nothing, because
 * there is nowhere to put it that is not somebody else's folder.
 */
export function calendarArchiveFolder(settings: NODAtrailSettings, from: string): string {
  const subfolder = settings.documentSubfolder.trim();
  const day = parseDayTitle(from);
  if (!subfolder || day === null) return '';
  return joinFolder(noteFolderFor(settings, 'day', day), subfolder);
}

/**
 * Keeps the file an import read.
 *
 * **Never overwrites, and never stores the same bytes twice.** Re-importing a
 * range that is already archived is a normal thing to do, and it must not leave
 * a second copy behind each time. A *different* export of the same range and
 * source gets a numbered name, because two exports of one week are two
 * documents and the later one is not necessarily the better one.
 *
 * Returns the path it landed at, or null when nothing was written.
 */
export async function archiveCalendar(
  app: App,
  settings: NODAtrailSettings,
  source: string,
  from: string,
  to: string,
  text: string
): Promise<string | null> {
  const folder = calendarArchiveFolder(settings, from);
  if (!folder || text.trim() === '') return null;

  const path = normalizePath(folder);
  if (!app.vault.getFolderByPath(path)) await app.vault.createFolder(path);

  const wanted = calendarFileName(source, from, to);
  const existing = app.vault.getFolderByPath(path)?.children ?? [];
  const taken = new Set(existing.map((child) => child.name));

  const sameName = existing.find((child) => child.name === wanted);
  if (sameName instanceof TFile) {
    const held = await app.vault.cachedRead(sameName);
    if (held === text) return sameName.path;
  }

  let name = wanted;
  for (let index = 2; taken.has(name) && index < 100; index += 1) {
    name = wanted.replace(/\.ics$/i, ` ${index}.ics`);
  }

  const written = await app.vault.create(`${path}/${name}`, text);
  return written.path;
}

/**
 * Every calendar file this plugin has archived, newest range first.
 *
 * The whole vault is walked rather than one folder, because a year of imports
 * has files under several month folders and the caller wants the source's
 * history, not one month of it.
 */
export function readCalendarArchive(app: App, settings: NODAtrailSettings): ArchivedCalendar[] {
  const subfolder = settings.documentSubfolder.trim();
  if (!subfolder) return [];

  const found: ArchivedCalendar[] = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension.toLowerCase() !== 'ics') continue;
    if (file.parent?.name !== subfolder) continue;

    const name = readCalendarFileName(file.name);
    if (name) found.push({ file, name });
  }

  return found.sort((a, b) => b.name.to.localeCompare(a.name.to));
}

/**
 * What earlier exports of one source said, replayed from the files themselves.
 *
 * Each archived file is expanded over **its own** range rather than over the
 * one being imported now. That is what makes the answer evidence: a file read
 * for September is evidence about September and about nothing else, and
 * expanding it over October would produce occurrences nobody was ever offered.
 *
 * The occurrences are turned into lines by the core's own `priorLinesOf`
 * rather than here, so a multi-day event is split into days by exactly the code
 * that will split it again in a moment. Deriving the keys locally would agree
 * with the plan right up until one of the two changed, and then every holiday
 * would read as having been cancelled.
 *
 * A file that no longer parses contributes nothing rather than throwing. An
 * export whose format changed is a reason to import fewer conclusions, not to
 * stop the import.
 */
export async function priorImportsOf(
  app: App,
  settings: NODAtrailSettings,
  source: string
): Promise<PriorImport[]> {
  const slug = sourceSlug(source);
  const files = readCalendarArchive(app, settings).filter((one) => one.name.source === slug);

  // Oldest first, so the plan's "later runs win" reading of the history is the
  // order these actually happened in.
  files.reverse();

  const out: PriorImport[] = [];
  for (const archived of files) {
    const text = await app.vault.cachedRead(archived.file);
    const { from, to } = archived.name;

    let lines: PriorLine[] = [];
    try {
      // The owner from the archived file itself, not from the one being
      // imported now. They are the same calendar in every real case, and
      // taking it from the file keeps the replay a reading of that file.
      // The same zone the plan is being derived in, and it has to be: a key
      // is built from a converted clock, so a replay reading the archive in a
      // different zone would report every meeting as new and gone at once.
      // `vault-zone.ts` says what that ties the feature to.
      lines = priorLinesOf(
        expandEvents(parseIcs(text), from, to, calendarOwner(text)).occurrences,
        vaultZone()
      );
    } catch {
      lines = [];
    }

    out.push({ from, to, lines });
  }
  return out;
}
