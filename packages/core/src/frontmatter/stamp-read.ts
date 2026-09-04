/**
 * Reading a `created` or `modified` stamp back out of a note, in every shape a
 * real vault turns out to hold one in.
 *
 * The writer's shape is `formatDateTimeStamp`'s `YYYY-MM-DDTHH:mm`, and it is
 * the only one anything here writes. But the vault these plugins were built
 * against carries three others, all of them written by something before this
 * suite existed:
 *
 *   created:  '[[2026-07-14]]'          a wikilink to that day's note
 *   modified: 2026-07-25 - 04:50 pm     a clock with a separator and a meridiem
 *   created:  '2026-07-14'              a bare day, no clock at all
 *
 * A reader that understood only the first would call 470 notes undated, and
 * "when did I last touch this" is the question half the views in this suite
 * are built on. So: read four shapes, write one.
 *
 * **Nothing here converts a note.** The conversion happens the next time
 * something writes to that note, one note at a time, which is the only way a
 * vault gets consistent without a day on which every note in it acquires a new
 * modification date.
 *
 * App-free. Every Date is built from local components, never parsed by the
 * engine's own heuristics, because `new Date('2026-07-14')` is UTC midnight and
 * `new Date('2026-07-14 00:00')` is local midnight, and a stamp is a local fact.
 */
import { formatDateTimeStamp } from '../dates/stamps.js';
import { stripWikilink } from '../links/wikilink.js';

/** Which of the four shapes a value was written in. */
export type StampShape = 'stamp' | 'date' | 'dayLink' | 'legacyClock';

export interface ParsedStamp {
  /** The moment the stamp names, at local time. A shape carrying no clock lands on local midnight. */
  date: Date;
  shape: StampShape;
}

/** `2026-08-04T14:05`, with `T` or a space, and optional seconds. The shape this suite writes. */
const STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** `2026-07-14`, a day and nothing else. */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `2026-07-25 - 04:50 pm`, and the variants of it that occur.
 *
 * The separator is a hyphen with optional spaces, the hour may be one digit or
 * two, and the meridiem is optional so the same pattern reads a 24-hour
 * `2026-07-25 - 16:50`. Case-insensitive because `PM` and `pm` both appear.
 */
const LEGACY_CLOCK =
  /^(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i;

/**
 * A local Date from calendar fields, or null when the fields do not name a real
 * day.
 *
 * The round-trip check is what rejects `2026-02-30`: the constructor rolls it
 * over into March rather than refusing, and a stamp that silently became a
 * different day would be worse than one that read as absent.
 */
function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  const rolled =
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day;
  return rolled ? null : date;
}

/** 12-hour to 24-hour. `12 am` is midnight and `12 pm` is noon, which is the one pair that trips every naive version of this. */
function hourFromMeridiem(hour: number, meridiem: string | undefined): number | null {
  if (!meridiem) return hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;

  const isAfternoon = meridiem.toLowerCase().startsWith('p');
  if (hour === 12) return isAfternoon ? 12 : 0;
  return isAfternoon ? hour + 12 : hour;
}

/**
 * The stamp a frontmatter value holds, with the shape it was written in, or
 * null when the value names no moment at all.
 *
 * A native `Date` is accepted because Obsidian's YAML parser coerces an
 * unquoted timestamp carrying seconds into one before anything here sees it,
 * and reported as `stamp`: it is not a shape somebody typed, it is the shape
 * the parser turned a typed one into, and nothing downstream needs to tell
 * those apart.
 */
export function readStamp(value: unknown): ParsedStamp | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { date: value, shape: 'stamp' };
  }
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (text === '') return null;

  const stamp = STAMP.exec(text);
  if (stamp) return build(stamp, 'stamp');

  const legacy = LEGACY_CLOCK.exec(text);
  if (legacy) {
    const hour = hourFromMeridiem(Number(legacy[4]), legacy[7]);
    if (hour === null) return null;

    const date = localDate(
      Number(legacy[1]),
      Number(legacy[2]),
      Number(legacy[3]),
      hour,
      Number(legacy[5]),
      legacy[6] === undefined ? 0 : Number(legacy[6])
    );
    return date ? { date, shape: 'legacyClock' } : null;
  }

  const bare = DATE.exec(text);
  if (bare) return build(bare, 'date');

  // A wikilink last, and only when what is inside it is itself a day. A link to
  // anything else is a link, not a date, and reading `created: '[[Steuern]]'`
  // as a moment would invent one.
  const linked = stripWikilink(text);
  if (linked !== text) {
    const day = DATE.exec(linked.trim());
    if (day) return build(day, 'dayLink');
  }

  return null;
}

function build(match: RegExpExecArray, shape: StampShape): ParsedStamp | null {
  const hour = match[4] === undefined ? 0 : Number(match[4]);
  const date = localDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    hour,
    match[5] === undefined ? 0 : Number(match[5]),
    match[6] === undefined ? 0 : Number(match[6])
  );
  return date ? { date, shape } : null;
}

/** The moment alone, for the many callers that do not care what shape it was in. */
export function readStampDate(value: unknown): Date | null {
  return readStamp(value)?.date ?? null;
}

/**
 * True when a value is already in the shape this suite writes.
 *
 * For a health check that wants to report the notes still carrying an old
 * spelling, and for a writer that wants to leave a note alone when it has
 * nothing to change.
 */
export function isSuiteStampShape(value: unknown): boolean {
  return readStamp(value)?.shape === 'stamp';
}

/**
 * The same moment, spelt the way this suite spells it, or null.
 *
 * Null for a value no shape here can read, which is an answer a caller has to
 * be given rather than protected from: converting a stamp nobody can parse
 * would mean inventing one, and a check that quietly replaced an unreadable
 * value with a guess would be worse than the value it replaced.
 *
 * Null too for a value already in the right shape, so a caller can ask "is
 * there anything to do here" and "what is it" as one question.
 *
 * **The instant never moves. Only its spelling changes.** That is the whole
 * reason this is safe to run over a vault in bulk, and it is why converting a
 * `modified` stamp does not lie about when the note was last touched.
 */
export function suiteStampShape(value: unknown): string | null {
  const parsed = readStamp(value);
  if (!parsed || parsed.shape === 'stamp') return null;
  return formatDateTimeStamp(parsed.date);
}
