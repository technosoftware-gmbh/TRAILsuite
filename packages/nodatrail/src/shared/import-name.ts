/**
 * How a kept import file is named, for both importers at once.
 *
 * `20260913-142530_business_20260907-20260913.ics`, and the statement archive's
 * `20260913-142530_1013_20260401-20260626.csv` is the same shape with the
 * account where the calendar has its source. Three parts, in the order somebody
 * asks about a file sitting in that folder: when was this run, what was read,
 * and which days was it read for.
 *
 * **The stamp leads because an imports folder is a history.** Sorted by name it
 * is sorted by run, which is the order these actually happened in and the only
 * order a list of runs wants. The range used to lead, from when these files
 * lived among documents filed by period; `_imports` is not `_documents` and
 * does not want a document's ordering.
 *
 * **The range stays in the name because the replay cannot work without it.** An
 * archived export is evidence about the days it was read for and about no
 * others: expanding it over anything else invents occurrences nobody was
 * offered, and the next run reports them as vanished. See §I.2 of
 * `docs/design/calendar-import.md`, which exists to stop exactly that.
 *
 * **And the stamp is not decoration either.** It is what tells two runs of the
 * same range apart without a counter, and what lets the history be read in the
 * order it happened rather than in the order of the ranges chosen -- a backfill
 * imported on Friday is a later word than the week imported on Monday, and only
 * the stamp says so.
 *
 * Pure, and shared, so the two archives cannot drift into two shapes.
 */

/** What a kept import file's name says about it. */
export interface ImportFileName {
  /** `20260913-142530`, the local wall clock of the run that kept it. */
  stamp: string;
  /** The calendar's source slug, or the statement's account number. */
  source: string;
  from: string;
  to: string;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/**
 * The run's own moment, to the second.
 *
 * Local wall clock rather than UTC, because this is a name somebody reads
 * beside notes that are themselves titled in local days, and an archive stamped
 * two hours off the day note it fed would be read as a different day. Built
 * from the date's own fields rather than any formatter, so it carries no
 * machine convention with it: `display-locale` forbids the alternative and is
 * right to.
 *
 * A second is fine granularity. Two imports inside one second are one impatient
 * double-click, and `freeImportName` below covers it rather than the format
 * growing a millisecond nobody reads.
 */
export function importStamp(now: Date): string {
  const day = `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `${day}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** `2026-09-01` as `20260901`, which is how this vault compacts a day. */
export function compactDay(day: string): string {
  return day.replace(/-/g, '');
}

/** And back again. */
export function expandDay(compacted: string): string {
  return `${compacted.slice(0, 4)}-${compacted.slice(4, 6)}-${compacted.slice(6, 8)}`;
}

/** The name a kept file is written under, extension and all. */
export function importFileName(name: ImportFileName, extension: string): string {
  const range = `${compactDay(name.from)}-${compactDay(name.to)}`;
  return `${name.stamp}_${name.source}_${range}.${extension}`;
}

/**
 * Reading the name back.
 *
 * **Only names this plugin wrote are recognised.** A file somebody dropped into
 * the folder themselves is left alone rather than guessed at: a wrong guess
 * about which range a file covers would report meetings gone that the file was
 * never read for, and would put a statement against an account it has nothing
 * to do with.
 */
export function readImportFileName(name: string, extension: string): ImportFileName | null {
  const pattern = new RegExp(
    String.raw`^(\d{8}-\d{6})_([A-Za-z0-9-]+)_(\d{8})-(\d{8})\.${extension}$`,
    'i'
  );
  const match = pattern.exec(name.trim());
  if (!match) return null;

  const [, stamp, source, from, to] = match;
  if (!stamp || !source || !from || !to) return null;

  return { stamp, source: source.toLowerCase(), from: expandDay(from), to: expandDay(to) };
}

/**
 * A name nothing in the folder already has.
 *
 * Only ever reached by two runs inside one second, and it still has to be here:
 * `vault.create` on a taken path throws, and an import that wrote its notes and
 * then failed to keep its file is the one failure this feature can least
 * afford to introduce for the sake of a tidier name.
 */
export function freeImportName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;

  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const extension = dot === -1 ? '' : name.slice(dot);
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${stem} ${index}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} ${taken.size}${extension}`;
}

/** Oldest run first, which is the order the plan reads a history in. */
export function byStamp(a: ImportFileName, b: ImportFileName): number {
  return a.stamp.localeCompare(b.stamp);
}
