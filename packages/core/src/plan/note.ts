/**
 * The meal plan note: where it lives, and how a line gets into it.
 *
 * A plan note is one person's week:
 *
 *     Eating/Meal Plans/2026/2026-W33-StefanMuster-MealPlan.md
 *
 *     # Meal Plan
 *     ## Monday
 *     - [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4]
 *
 * Everything here is a pure string transform on the note's body. Nothing reads
 * or writes a file, which is what makes it testable without a vault and what
 * would let a host that has never heard of Obsidian reuse it unchanged.
 *
 * **Weekday sections stay in weekday order.** A note that grows Thursday before
 * Monday because that is the order things were recorded is a note nobody can
 * read, so an inserted section goes where the week says it goes.
 */
import { addDays, formatDayTitle } from '../dates/day.js';
import { isoWeekOf, startOfWeekTitle } from '../dates/iso-week.js';
import { parseDayTitle } from '../dates/day.js';
import { splitSections } from '../markdown/sections.js';
import { parsePlanLine, renderPlanLine, type PlanEntry } from './line.js';

/** English weekday headings, Monday first, as the notes write them. */
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * The heading for entries nobody has given a day to yet.
 *
 * A stable English literal written into the note, like the weekday headings,
 * and translated only for display. The aliases are the other spellings accepted
 * on read, so a note written by hand or by an older version still parses.
 *
 * **It sorts before Monday.** A queue is what a week starts as, and a section
 * of undecided meals under Sunday is a section nobody scrolls to.
 */
export const QUEUE_HEADING = 'Meal Plan Queue';

const QUEUE_ALIASES = ['meal plan queue', 'queue', 'unscheduled'];

export function isQueueHeading(heading: string): boolean {
  return QUEUE_ALIASES.includes(heading.trim().toLowerCase());
}

/**
 * Where an entry sits in a plan note: a weekday, or the queue.
 *
 * One type rather than a weekday plus a boolean, because every operation that
 * takes a day takes the queue in exactly the same way – putting an entry there,
 * reading what is there, moving one out. A flag beside the day would mean every
 * one of them growing a branch.
 */
export type PlanSlot = Weekday | 'queue';

/** The heading a slot is written as. */
export function slotHeading(slot: PlanSlot): string {
  return slot === 'queue' ? QUEUE_HEADING : slot;
}

/** The slot a heading names, or null when it names neither. */
export function slotOfHeading(heading: string): PlanSlot | null {
  const trimmed = heading.trim().toLowerCase();
  if (isQueueHeading(trimmed)) return 'queue';

  return WEEKDAYS.find((day) => day.toLowerCase() === trimmed) ?? null;
}

/** Where a slot sorts in a note. The queue is before Monday. */
function slotOrder(slot: PlanSlot): number {
  return slot === 'queue' ? -1 : WEEKDAYS.indexOf(slot);
}

const PLAN_NOTE = /^(\d{4}-W\d{1,2})-(.+?)-MealPlan$/;

export interface PlanNoteRef {
  /** `2026-W33`. */
  week: string;
  /** The person as the filename spells them: `StefanMuster`. */
  person: string;
}

/**
 * A person's title as a plan note's filename spells them.
 *
 * `Stefan Muster` becomes `StefanMuster`: the characters a filename
 * cannot hold come out, and so does every space. The spaces are the part worth
 * knowing about, because it means a plan note's person token is **not** the
 * Person note's title and the two have to be matched through this rather than
 * compared.
 *
 * The rule belongs here because it is part of the filename format rather than
 * part of whoever writes the file: what a week's note is called is how it is
 * found again. Everything that files a week imports this one function rather
 * than restating it, because a second implementation that disagreed by one
 * character would file a week where the other could not find it.
 */
export function personFileToken(title: string): string {
  return title
    .replace(/[\\/:*?"<>|[\]#^]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** `2026-W33-StefanMuster-MealPlan` as its parts, or null. */
export function parsePlanNoteName(basename: string): PlanNoteRef | null {
  const match = PLAN_NOTE.exec(basename);
  const week = match?.[1];
  const person = match?.[2];
  return week && person ? { week, person } : null;
}

export function planNoteName(ref: PlanNoteRef): string {
  return `${ref.week}-${ref.person}-MealPlan`;
}

/**
 * Where a plan note belongs, given the folder the vault keeps them in.
 *
 * The year folder comes from the *week-year*, not the calendar year – 2026-W01
 * can start on 29 December 2025, and filing it under 2025 would put a week in a
 * folder its own name contradicts.
 */
export function planNotePath(folder: string, ref: PlanNoteRef): string {
  const year = ref.week.slice(0, 4);
  return `${folder}/${year}/${planNoteName(ref)}.md`;
}

/** Which weekday a `YYYY-MM-DD` falls on, or null when it is not a date. */
export function weekdayOf(isoDate: string): Weekday | null {
  const date = parseDayTitle(isoDate);
  if (!date) return null;

  // getDay() is Sunday-first; the plan is Monday-first.
  return WEEKDAYS[(date.getDay() + 6) % 7] ?? null;
}

/** The note a meal on this date by this person belongs in, or null. */
export function planNoteFor(isoDate: string, person: string): PlanNoteRef | null {
  const date = parseDayTitle(isoDate);
  if (!date) return null;

  const { weekYear, week } = isoWeekOf(date);
  return { week: `${weekYear}-W${String(week).padStart(2, '0')}`, person };
}

/** The seven dates of a week, Monday first, or an empty list for a bad title. */
export function datesOfWeek(week: string): string[] {
  const monday = startOfWeekTitle(week);
  return monday ? WEEKDAYS.map((_, index) => formatDayTitle(addDays(monday, index))) : [];
}

/** The body a brand-new plan note starts from. */
export function emptyPlanNote(): string {
  return '# Meal Plan\n';
}

interface Located {
  lines: string[];
  /** Index of the `## <Weekday>` heading, or -1. */
  heading: number;
  /** Index one past the section's last line, or -1. */
  end: number;
}

function locate(body: string, slot: PlanSlot): Located {
  const lines = body.split('\n');
  const heading = lines.findIndex((line) => {
    const text = line.trim();
    return /^##\s+/.test(text) && slotOfHeading(text.replace(/^##\s+/, '')) === slot;
  });
  if (heading === -1) return { lines, heading, end: -1 };

  let end = lines.length;
  for (let i = heading + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  return { lines, heading, end };
}

/**
 * Where a new `## <Weekday>` or `## Meal Plan Queue` section should be inserted.
 *
 * Before the first section that comes later in the week; failing that, at the
 * end. Any heading that is neither – a note's own `# Meal Plan`, or something a
 * person added – is stepped over rather than reordered.
 */
function insertionPoint(lines: string[], slot: PlanSlot): number {
  const wanted = slotOrder(slot);

  for (let i = 0; i < lines.length; i++) {
    const heading = /^##\s+(.*)$/.exec((lines[i] ?? '').trim())?.[1];
    const found = heading === undefined ? null : slotOfHeading(heading);
    if (found === null) continue;

    if (slotOrder(found) > wanted) return i;
  }
  return lines.length;
}

function trimTrailingBlanks(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[out.length - 1] ?? '').trim() === '') out.pop();
  return out;
}

export interface UpsertResult {
  body: string;
  /** True when an existing line was replaced rather than a new one added. */
  replaced: boolean;
}

/**
 * Puts an entry into a plan note's body.
 *
 * A line with the same id is replaced in place. Failing that – and only when
 * there is no id to go on – a line for the same meal in the same section is
 * replaced, which is what makes rating a meal that is already planned an edit
 * rather than a second entry. Otherwise the entry is appended to its section.
 *
 * **`previousId` is which line to replace; `entry.id` is what to call it
 * afterwards**, and they are the same thing in every case but one: a writer
 * giving an identity to a line that has none. 444 of the 444 plan lines in the
 * vault this was built against carry no id, so a caller that could only address
 * a line by an id it already had could not address any of them. Passing the old
 * id (null) as `previousId` and a fresh one on the entry rewrites the line it
 * found and leaves it findable next time.
 */
export function upsertPlanEntry(
  body: string,
  slot: PlanSlot,
  entry: PlanEntry,
  previousId: string | null = entry.id
): UpsertResult {
  const rendered = renderPlanLine(entry);
  const { lines, heading, end } = locate(body, slot);

  if (heading === -1) {
    const at = insertionPoint(lines, slot);
    const block = [`## ${slotHeading(slot)}`, rendered];
    const before = trimTrailingBlanks(lines.slice(0, at));
    const after = lines.slice(at);

    return {
      body: [
        ...before,
        ...(before.length > 0 ? [''] : []),
        ...block,
        ...(after.length > 0 ? [''] : []),
        ...after,
      ].join('\n'),
      replaced: false,
    };
  }

  for (let i = heading + 1; i < end; i++) {
    const existing = parsePlanLine(lines[i] ?? '');
    if (!existing) continue;

    const sameId = previousId !== null && existing.id === previousId;
    const sameMeal = previousId === null && existing.id === null && existing.meal === entry.meal;
    if (!sameId && !sameMeal) continue;

    const out = [...lines];
    out[i] = rendered;
    return { body: out.join('\n'), replaced: true };
  }

  return { body: appendToSection(lines, heading, end, rendered).join('\n'), replaced: false };
}

/**
 * A rendered line put at the end of a located section.
 *
 * After the section's last non-blank line, so an appended entry does not land
 * beyond a trailing blank and drift away from its own heading.
 */
function appendToSection(lines: string[], heading: number, end: number, line: string): string[] {
  const out = [...lines];
  let at = end;
  while (at > heading + 1 && (out[at - 1] ?? '').trim() === '') at--;
  out.splice(at, 0, line);
  return out;
}

/** Removes the line with this id. Returns the body unchanged when there is none. */
export function removePlanEntry(body: string, id: string): { body: string; removed: boolean } {
  const lines = body.split('\n');
  const at = lines.findIndex((line) => parsePlanLine(line)?.id === id);
  if (at === -1) return { body, removed: false };

  const out = [...lines];
  out.splice(at, 1);
  return { body: out.join('\n'), removed: true };
}

export interface ReadEntry extends PlanEntry {
  /** `YYYY-MM-DD`, resolved from the note's week and the weekday heading. */
  date: string;
  weekday: Weekday;
}

/**
 * Every entry in a plan note's body, with its date resolved.
 *
 * A heading that is not a weekday is skipped rather than guessed at, so a note
 * with a `## Meal Plan Queue` in it contributes nothing instead of contributing
 * something wrong.
 */
export function readPlanNote(body: string, week: string): ReadEntry[] {
  const dates = datesOfWeek(week);
  if (dates.length === 0) return [];

  const out: ReadEntry[] = [];
  for (const section of splitSections(body).sections) {
    const index = WEEKDAYS.findIndex(
      (day) => day.toLowerCase() === section.heading.trim().toLowerCase()
    );
    if (index === -1) continue;

    const date = dates[index];
    if (!date) continue;

    for (const line of section.lines) {
      const entry = parsePlanLine(line);
      if (entry) out.push({ ...entry, date, weekday: WEEKDAYS[index] as Weekday });
    }
  }
  return out;
}

/**
 * Moves the line with this id into another slot, keeping the line itself.
 *
 * **The raw line is carried across, not a re-rendered entry.** A plan line can
 * hold text this module does not model – a `[portion:: ½]` somebody invented, a
 * trailing comment – and moving a meal from Thursday to the queue is no reason
 * to lose it. Re-rendering would quietly rewrite the line to only what
 * `PlanEntry` knows about, which is a different edit than the one asked for.
 *
 * Says nothing and changes nothing when the entry is already there, so a caller
 * that cannot tell does not have to check first.
 */
export function movePlanEntry(
  body: string,
  id: string,
  slot: PlanSlot
): { body: string; moved: boolean } {
  const lines = body.split('\n');
  const at = lines.findIndex((line) => parsePlanLine(line)?.id === id);
  if (at === -1) return { body, moved: false };

  const raw = lines[at] ?? '';

  // Which section it is in now, found by walking back to the nearest heading.
  for (let i = at; i >= 0; i--) {
    const heading = /^##\s+(.*)$/.exec((lines[i] ?? '').trim())?.[1];
    if (heading === undefined) continue;
    if (slotOfHeading(heading) === slot) return { body, moved: false };
    break;
  }

  const without = [...lines];
  without.splice(at, 1);

  const located = locate(without.join('\n'), slot);
  if (located.heading === -1) {
    const insertAt = insertionPoint(without, slot);
    const block = [`## ${slotHeading(slot)}`, raw];
    const before = trimTrailingBlanks(without.slice(0, insertAt));
    const after = without.slice(insertAt);

    return {
      body: [
        ...before,
        ...(before.length > 0 ? [''] : []),
        ...block,
        ...(after.length > 0 ? [''] : []),
        ...after,
      ].join('\n'),
      moved: true,
    };
  }

  return {
    body: appendToSection(located.lines, located.heading, located.end, raw).join('\n'),
    moved: true,
  };
}

/**
 * The entries in the queue section, in the order the note lists them.
 *
 * Separate from `readPlanNote` rather than folded into it, and the reason is
 * the type: a queued meal has no date, and `ReadEntry` promises one. A reader
 * that invented a date for these – today, or the Monday of the week – would be
 * putting a meal on a day nobody chose, which is the whole thing a queue exists
 * not to do.
 */
export function readPlanQueue(body: string): PlanEntry[] {
  const out: PlanEntry[] = [];
  for (const section of splitSections(body).sections) {
    if (!isQueueHeading(section.heading)) continue;

    for (const line of section.lines) {
      const entry = parsePlanLine(line);
      if (entry) out.push(entry);
    }
  }
  return out;
}

/**
 * Takes out every entry a caller says to, and leaves the note otherwise alone.
 *
 * **Lines only. No heading is removed**, empty or not. A `## Thursday` somebody
 * is looking at is part of the shape of the note they arranged, and a clear that
 * also tidies is a clear that did two things when it was asked to do one.
 *
 * Anything that is not a plan line – a heading, a blank, a note somebody typed
 * under Wednesday – is never a candidate, so the predicate only ever sees
 * entries.
 */
export function clearPlanEntries(
  body: string,
  wanted: (entry: PlanEntry) => boolean
): { body: string; removed: number } {
  const kept: string[] = [];
  let removed = 0;

  for (const line of body.split('\n')) {
    const entry = parsePlanLine(line);
    if (entry && wanted(entry)) {
      removed++;
      continue;
    }
    kept.push(line);
  }

  return { body: removed === 0 ? body : kept.join('\n'), removed };
}
