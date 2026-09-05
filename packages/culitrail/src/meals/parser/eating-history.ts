/**
 * Reading a meal's eating-history log, from either place a vault keeps one.
 *
 * Two sources because two shapes exist in the wild: a frontmatter list of
 * records, which is what a plugin writes, and a Markdown list under a heading,
 * which is what a person writes. Both are read, neither is preferred, and
 * nothing here writes.
 *
 * App-free.
 */
import {
  readIsoDate,
  readDateTimeLike,
  readNumberLike,
  readString,
} from '@technosoftware/trail-core';

export interface EatingEntry {
  /** `YYYY-MM-DD`. An entry with no readable date is dropped rather than shown undated. */
  date: string;
  /**
   * `HH:mm`, when the log records one, so two cooks on a day can be told apart.
   *
   * Its own field rather than left inside the date, because a view formats a day
   * and a clock time differently, and rather than left inside the note, because
   * it is not something anybody wrote about the cook.
   */
  time: string | null;
  rating: number | null;
  /** Whatever the log says about that cook, minus the parts already shown as their own field. */
  note: string | null;
  /** The person who eaten it, as written. A wikilink is unwrapped; nothing is resolved. */
  person: string | null;
  /**
   * The writer's stable id for this cook, when it has one.
   *
   * Present on both sources for an entry CULItrail wrote: as `id:` in the
   * frontmatter record, and as an HTML comment on the body line. It exists so
   * the merge below can recognise the two as one cook without comparing their
   * note text, which lets the body line read richly (`11:45 · Erika · Very
   * good`) while the frontmatter note stays just the note.
   */
  id: string | null;
}

/** `[[Stefan]]` and `[[people/Stefan|Stefan]]` both name Stefan. */
function unwrapWikilink(value: string | null): string | null {
  if (!value) return null;
  const match = /^\[\[([^\]]+)\]\]$/.exec(value.trim());
  if (!match) return value;

  const inner = match[1];
  const alias = inner.indexOf('|');
  const target = alias === -1 ? inner : inner.slice(alias + 1);
  return readString(target.slice(target.lastIndexOf('/') + 1));
}

/** The `HH:mm` half of a stored datetime, or null when it records only a day. */
function clockTimeOf(value: unknown): string | null {
  const stamp = readDateTimeLike(value);
  return stamp ? (/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(stamp)?.[1] ?? null) : null;
}

function fromRecord(record: Record<string, unknown>): EatingEntry | null {
  const date = readIsoDate(record.date);
  if (!date) return null;

  return {
    date,
    time: clockTimeOf(record.date),
    rating: readNumberLike(record.rating),
    note: readString(record.note),
    person: unwrapWikilink(readString(record.personLink) ?? readString(record.person)),
    id: readString(record.id),
  };
}

/**
 * The log held in a frontmatter property.
 *
 * Tolerant of a bare date list as well as a list of records: `- 2026-01-24` is
 * a log somebody could reasonably have typed, and refusing it would mean the
 * feature works only for notes this plugin's own writer produced.
 */
export function readEatingHistoryProperty(value: unknown): EatingEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: EatingEntry[] = [];
  for (const item of value) {
    if (item && typeof item === 'object' && !(item instanceof Date)) {
      const entry = fromRecord(item as Record<string, unknown>);
      if (entry) entries.push(entry);
      continue;
    }

    const date = readIsoDate(item);
    if (date)
      entries.push({
        date,
        time: clockTimeOf(item),
        rating: null,
        note: null,
        person: null,
        id: null,
      });
  }
  return entries;
}

/** A rating written as a Dataview inline field, which is how the note format records one. */
const INLINE_RATING = /\[rating::\s*(\d+(?:\.\d+)?)\s*\]/i;

/** A leading list marker, so both `- 2026-01-24` and `* 2026-01-24` read the same. */
const LIST_MARKER = /^\s*(?:[-*+]|\d+\.)\s+/;

/** A date at the front of the line, in either the ISO or the dotted European form. */
const LEADING_DATE = /^(\d{4}-\d{2}-\d{2})|^(\d{1,2})\.(\d{1,2})\.(\d{4})/;

/**
 * The writer's id marker, and the ones written before it.
 *
 * All three accepted on read: a vault that has been through the older plugin
 * still holds `rb-id` markers, and one written before the rebrand holds
 * `cul-id`. Treating those lines as unidentified would show every one of them
 * twice once its frontmatter record was also read.
 */
const ID_MARKER = /<!--\s*(?:culi|cul|rb)-id:([^>]*?)\s*-->/i;

/** Any HTML comment, so a marker never leaks into the note text a reader sees. */
const HTML_COMMENT = /<!--.*?-->/g;

/**
 * A clock time at the front of what follows the date.
 *
 * Where the writer puts it, and the one part of a line that can be told from
 * the rest without knowing anything about the vault.
 */
const LEADING_TIME = /^[\s·-]*(\d{1,2}:\d{2})\b/;

function isoFromDotted(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * The log written as a Markdown list under the eating-history heading.
 *
 * Deliberately forgiving about everything except the date. A hand-kept log is
 * prose with a date in front of it, and a parser that demanded a format would
 * show an empty history for every note somebody actually maintained by hand.
 * Anything after the date, minus the inline rating, is kept verbatim as the
 * note rather than parsed further.
 */
export function parseEatingHistorySection(markdown: string): EatingEntry[] {
  const entries: EatingEntry[] = [];

  for (const line of markdown.split('\n')) {
    const withoutMarker = line.replace(LIST_MARKER, '');
    if (withoutMarker === line || withoutMarker.trim() === '') continue;

    const match = LEADING_DATE.exec(withoutMarker.trim());
    if (!match) continue;

    const date = match[1] ?? isoFromDotted(match[2], match[3], match[4]);
    const rest = withoutMarker.trim().slice(match[0].length);

    const rating = INLINE_RATING.exec(rest);
    const marker = ID_MARKER.exec(rest);
    const id = marker ? readString(marker[1]) : null;

    // The separators a log line uses between the date and the rest are
    // punctuation, not content, so a leading one is dropped. Without this every
    // note reads as starting with a dash. HTML comments go too: the id marker is
    // invisible in rendered Markdown and should be invisible here.
    const text = rest
      .replace(INLINE_RATING, '')
      .replace(HTML_COMMENT, '')
      .replace(/^[\s\-:,]+/, '');

    const time = LEADING_TIME.exec(text)?.[1] ?? null;
    const withoutTime = time === null ? text : text.slice(LEADING_TIME.exec(text)?.[0].length ?? 0);

    entries.push({
      date,
      time,
      rating: rating ? Number(rating[1]) : null,
      // A line carrying an id contributes no note, because such a line is the
      // plugin's own rendering of a record rather than something anybody wrote:
      // its text is composed of the time, the person and the note the record
      // already holds, so reading it back as a note shows the person twice.
      // A line with no id is a line a person typed, and its text is the note.
      note: id ? null : readString(withoutTime.replace(/^[\s·-]+/, '')),
      person: null,
      // The body line does not carry it. The record does, and the merge below
      // takes the record's, which is why this half stays silent rather than
      // guessing from the prose.
      id,
    });
  }

  return entries;
}

/** The identity of a cook for a source that carries no id: its day and its text. */
function textKey(entry: EatingEntry): string {
  return `date:${entry.date}|${entry.note ?? ''}`;
}

/**
 * Both sources as one log, newest first.
 *
 * Merged rather than one winning, because a note that carries both is a note
 * mid-migration and hiding half of it would look like data loss.
 *
 * Two entries are the same cook when they share an id, and failing that when
 * they agree on date and note. The id case is what CULItrail's own writer
 * relies on: it puts the time and the person into the body line so the raw
 * Markdown reads as a log, while the frontmatter note holds only the note, and
 * without an id those two would look like two different cooks on one day.
 * Date-and-note remains the fallback for a hand-kept log and for anything an
 * older version wrote.
 *
 * The third rule is the one that repairs a real vault: **an entry with no id
 * folds into an identified entry that agrees on date and note.** A writer that
 * gave the frontmatter records ids but wrote the body lines without the marker
 * leaves every cook in the note doubled, once with the record's person and once
 * without, and by id alone the two halves are indistinguishable from two real
 * cooks. Only an id-less entry folds this way: two entries that both carry ids
 * are two cooks by their own declaration, however alike they read.
 */
export function mergeEatingHistory(...sources: EatingEntry[][]): EatingEntry[] {
  const all = sources.flat();

  // Built ahead of the merge rather than during it, because the sources arrive
  // in no guaranteed order and an id-less body line read before its record
  // would otherwise have already claimed a key of its own.
  const identifiedByText = new Map<string, string>();
  for (const entry of all) {
    if (!entry.id) continue;
    const text = textKey(entry);
    // First wins. Two identified cooks reading identically on one day are still
    // two cooks; an id-less line matching both can only be folded into one, and
    // folding it into the first is what keeps the count right.
    if (!identifiedByText.has(text)) identifiedByText.set(text, `id:${entry.id}`);
  }

  const byKey = new Map<string, EatingEntry>();

  for (const entry of all) {
    const key = entry.id
      ? `id:${entry.id}`
      : (identifiedByText.get(textKey(entry)) ?? textKey(entry));
    const existing = byKey.get(key);
    // The richer of two records of the same cook wins, so a bare date in one
    // source does not overwrite the same date carrying a rating in the other,
    // and the frontmatter record's person survives the body line having none.
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    byKey.set(key, {
      date: existing.date,
      time: existing.time ?? entry.time,
      rating: existing.rating ?? entry.rating,
      note: existing.note ?? entry.note,
      person: existing.person ?? entry.person,
      id: existing.id ?? entry.id,
    });
  }

  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The most recent date in a log.
 *
 * Derived, never written back: an explicit `lastEaten:` in the note always
 * wins over this, the same way an explicit total time wins over prep plus
 * cook.
 */
export function lastEatingDate(entries: EatingEntry[]): string | null {
  let latest: string | null = null;
  for (const entry of entries) if (!latest || entry.date > latest) latest = entry.date;
  return latest;
}
