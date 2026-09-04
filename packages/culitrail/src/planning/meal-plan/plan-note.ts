/**
 * The meal-plan note format: the pure half, with no vault behind it.
 *
 * Shaped like `orders/order-note.ts`, down to the property-names object and the
 * build/parse pair, because a plan and an order are now the same kind of
 * document: a few properties and one list of entries. A reader who has
 * understood the order note should not have to learn a second set of
 * conventions for this one.
 *
 * **What this replaces is a body format**, and the trade is worth stating. The
 * old note was a Markdown checklist: `## Tuesday` headings and
 * `- [x] [[Meal]] #meal/lunch [rating:: 5]` lines. That was tickable in the
 * editor, which this is not, and in exchange every field is now a real property
 * a Dataview or Bases query can reach, an entry carries a stable id rather than
 * an HTML-comment marker, and editing one field stopped meaning a regex over a
 * line that might have anything else on it.
 *
 * One thing genuinely got simpler rather than merely moving. A line had no way
 * to say "eaten, and deliberately not rated" except by writing `[rating:: 0]`,
 * a magic value 32 lines in the vault carry and every reader had to special-case.
 * With a real `eaten:` field, that state is an eaten entry with no rating, and
 * the zero has nothing left to mean.
 *
 * App-free.
 */
import { wikilinkTarget, wikilinkValue } from 'trail-core';
import { parseMealSlotKey, parseWeekdayKey, type MealSlotKey } from '../../lang/vocabulary';
import type { WeekdayKey } from '../../lang/vocabulary';
import type { CULItrailSettings } from '../../settings/types';

/** Every frontmatter key this module reads or writes, resolved from settings once. */
export interface PlanProperties {
  typePropertyName: string;
  typeValue: string;
  weekProperty: string;
  personProperty: string;
  entriesProperty: string;
  entryMealField: string;
  entryDayField: string;
  entrySlotField: string;
  entryEatenField: string;
  entryRatingField: string;
  entryTimeField: string;
  entryNoteField: string;
  entryLeftoversField: string;
  entryIdField: string;
}

/** One planned meal. */
export interface PlanEntryContent {
  /**
   * The entry's stable identity, and the handle every edit uses.
   *
   * A Markdown bullet had nowhere to carry one, so the old format smuggled it
   * in an HTML comment and most lines simply had none: an edit had to find its
   * line by what the line said, and two helpings of the same dish on one day
   * were indistinguishable. Here it is an ordinary field.
   */
  id: string;
  /** The meal note's title, written as a wikilink. Null for an entry naming no meal note. */
  mealTitle: string | null;
  /**
   * The text of an entry that is not a meal note: leftovers, dinner at Anna's.
   *
   * The same field carries both, and which one it is comes from whether the
   * value is a wikilink. That is exactly the rule the old checklist used, where
   * `- [ ] [[Pizza]]` was a meal and `- [ ] Leftovers` was not.
   */
  label: string | null;
  /** The English weekday key. Null for the queue: planned this week, no day yet. */
  day: WeekdayKey | null;
  slot: MealSlotKey | null;
  /** Whether it happened. This is what makes the plan notes the eating history. */
  eaten: boolean;
  /** 1 to 5. Null on an eaten entry means eaten and deliberately unrated. */
  rating: number | null;
  /** `HH:mm`, when the eater recorded a clock time. */
  time: string | null;
  note: string | null;
  isLeftovers: boolean;
}

export interface PlanNoteContent {
  /** ISO week title, `2026-W34`. */
  week: string | null;
  /** The Person note's title. Null in a vault with nobody configured. */
  personTitle: string | null;
  entries: PlanEntryContent[];
}

/**
 * Which frontmatter keys this vault uses, out of its settings.
 *
 * Here rather than in the reader beside it, which is where the orders and
 * deliveries areas keep theirs, because this one has a second caller that
 * cannot hold an `App`: the converter in `scripts/`, which runs under plain
 * Node and must resolve the same keys the plugin will read afterwards.
 */
export function planProperties(settings: CULItrailSettings): PlanProperties {
  return {
    typePropertyName: settings.typePropertyName.trim() || 'type',
    typeValue: settings.mealPlanTypeValue,
    weekProperty: settings.mealPlanWeekProperty,
    personProperty: settings.mealPlanPersonProperty,
    entriesProperty: settings.mealPlanEntriesProperty,
    entryMealField: settings.planEntryMealField,
    entryDayField: settings.planEntryDayField,
    entrySlotField: settings.planEntrySlotField,
    entryEatenField: settings.planEntryEatenField,
    entryRatingField: settings.planEntryRatingField,
    entryTimeField: settings.planEntryTimeField,
    entryNoteField: settings.planEntryNoteField,
    entryLeftoversField: settings.planEntryLeftoversField,
    entryIdField: settings.planEntryIdField,
  };
}

/** An entry with nothing in it but its id, for a caller building one field at a time. */
export function emptyPlanEntry(id: string): PlanEntryContent {
  return {
    id,
    mealTitle: null,
    label: null,
    day: null,
    slot: null,
    eaten: false,
    rating: null,
    time: null,
    note: null,
    isLeftovers: false,
  };
}

/** `HH:mm`, and nothing that merely looks like it. A hand-typed `25:00` is not a clock time. */
function readClockTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : null;
}

/**
 * A rating of 1 to 5, or null.
 *
 * A zero is read as null rather than kept. It is what the old line format wrote
 * for "eaten and unrated", and an entry that carries both `eaten: true` and
 * that zero means the one thing this shape can already say without it.
 */
function readRating(value: unknown): number | null {
  // A number or a string holding one. Anything else is not a rating written
  // oddly, it is something else entirely, and coercing it would invent a value.
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.round(parsed);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

/**
 * A flag, from a boolean or from the word.
 *
 * YAML gives a real boolean for `eaten: true`, but a note edited through
 * Obsidian's property editor, or by hand in a hurry, can hold the string. Both
 * mean the same thing and only one of them is worth refusing.
 */
function readFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

/** One entry, as it goes into the note. Absent fields are omitted rather than written empty. */
function entryValue(properties: PlanProperties, entry: PlanEntryContent): Record<string, unknown> {
  const value: Record<string, unknown> = {};

  // The meal first, because it is what somebody reads the entry for. The id
  // goes last for the mirror-image reason: it is machinery.
  if (entry.mealTitle) value[properties.entryMealField] = wikilinkValue(entry.mealTitle);
  else if (entry.label) value[properties.entryMealField] = entry.label;

  if (entry.day) value[properties.entryDayField] = entry.day;
  if (entry.slot) value[properties.entrySlotField] = entry.slot;
  // Only when true. An absent flag is the common case and writing `false` on
  // every planned meal would be six lines of noise per week.
  if (entry.eaten) value[properties.entryEatenField] = true;
  if (entry.rating !== null) value[properties.entryRatingField] = entry.rating;
  if (entry.time) value[properties.entryTimeField] = entry.time;
  if (entry.note) value[properties.entryNoteField] = entry.note;
  if (entry.isLeftovers) value[properties.entryLeftoversField] = true;
  if (entry.id) value[properties.entryIdField] = entry.id;

  return value;
}

export function buildPlanFrontmatter(
  properties: PlanProperties,
  content: PlanNoteContent
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    [properties.typePropertyName]: properties.typeValue,
  };

  if (content.week) frontmatter[properties.weekProperty] = content.week;
  if (content.personTitle) {
    frontmatter[properties.personProperty] = wikilinkValue(content.personTitle);
  }
  // Written even when empty, unlike every other property here. A week somebody
  // has cleared is a real state, and an absent list would read as a note that
  // was never a plan.
  frontmatter[properties.entriesProperty] = content.entries.map((entry) =>
    entryValue(properties, entry)
  );

  return frontmatter;
}

/**
 * One entry, read back.
 *
 * A bare wikilink is accepted in place of a mapping, so `- "[[Pizza]]"` in the
 * list is a meal planned with nothing else said about it. That is the shortest
 * thing somebody adding a meal by hand would write, and refusing it would make
 * the format harder to hand-edit than the checklist it replaced.
 */
function readEntry(raw: unknown, properties: PlanProperties): PlanEntryContent | null {
  if (typeof raw === 'string') {
    const title = wikilinkTarget(raw);
    const text = raw.trim();
    if (!title && !text) return null;
    return { ...emptyPlanEntry(''), mealTitle: title, label: title ? null : text };
  }

  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Record<string, unknown>;

  const mealValue = entry[properties.entryMealField];
  const mealTitle = wikilinkTarget(mealValue);
  const label = mealTitle ? null : readText(mealValue);
  // An entry naming neither is not an entry. It is a stray mapping somebody
  // left in the list, and keeping it would put a nameless card on the week.
  if (!mealTitle && !label) return null;

  return {
    id: readText(entry[properties.entryIdField]) ?? '',
    mealTitle,
    label,
    day: parseWeekdayKey(readText(entry[properties.entryDayField]) ?? ''),
    slot: parseMealSlotKey(readText(entry[properties.entrySlotField]) ?? undefined),
    eaten: readFlag(entry[properties.entryEatenField]),
    rating: readRating(entry[properties.entryRatingField]),
    time: readClockTime(entry[properties.entryTimeField]),
    note: readText(entry[properties.entryNoteField]),
    isLeftovers: readFlag(entry[properties.entryLeftoversField]),
  };
}

export interface ParsePlanInput {
  frontmatter: Record<string, unknown>;
  properties: PlanProperties;
  /** The week and person the filename encodes, used only where the note states none. */
  fromPath?: { week: string | null; personTitle: string | null };
}

/**
 * True when this note has been written in the frontmatter shape at all.
 *
 * The presence of the list, not of an entry in it, because an empty week is a
 * real plan and a note that merely has no `entries:` yet is one the old body
 * reader should still get a look at.
 */
export function hasPlanEntries(
  frontmatter: Record<string, unknown>,
  properties: PlanProperties
): boolean {
  return Array.isArray(frontmatter[properties.entriesProperty]);
}

/**
 * The three edits a caller makes to an entry list.
 *
 * Here rather than beside the vault code that calls them, because each one is a
 * rule worth stating on its own and none of them needs an `App` to be true. A
 * null result means "nothing to write", which is a decision the mutator makes
 * rather than something the writer works out by comparing two arrays.
 */

/** Adds an entry, or replaces the one already carrying its id. */
export function upsertEntry(
  entries: readonly PlanEntryContent[],
  entry: PlanEntryContent
): PlanEntryContent[] {
  const index = entries.findIndex((candidate) => candidate.id && candidate.id === entry.id);
  if (index === -1) return [...entries, entry];

  const next = [...entries];
  // In place rather than removed and appended, so changing a slot or a rating
  // does not drop the card to the bottom of its day.
  next[index] = entry;
  return next;
}

/**
 * Cannot occur in a title, a weekday key or a slot key, so two different
 * triples can never collide by being concatenated.
 */
const SEPARATOR = '\u0000';

/** What an entry is, for a note that never gave it an id: its meal, its day and its slot. */
function identityOf(entry: {
  mealTitle: string | null;
  label: string | null;
  day: WeekdayKey | null;
  slot: MealSlotKey | null;
}): string {
  const subject = entry.mealTitle?.trim().toLowerCase() ?? `label:${entry.label?.trim() ?? ''}`;
  return [subject, entry.day ?? '', entry.slot ?? ''].join(SEPARATOR);
}

/** Enough of an entry to find it: its id, and what it would be identified by without one. */
export type EntryTarget = Pick<PlanEntryContent, 'id' | 'mealTitle' | 'label' | 'day' | 'slot'>;

/**
 * Changes some fields of one entry and leaves the rest alone.
 *
 * A merge rather than a replacement, and that is the whole point of it. The
 * plugin's in-memory mirror does not model an entry's `time` or its `note`, so
 * a caller rewriting the entry from state would delete both every time somebody
 * set a rating.
 *
 * **By id, then by what the entry is.** The fallback is not a nicety: an entry
 * a person typed into the list by hand carries no id, and neither does one read
 * out of a note nobody has converted, so an id-only lookup would find nothing
 * and the edit would be a silent no-op. The patched entry takes the id it was
 * looked up with, so from the next edit onwards the fallback is not needed.
 */
export function patchEntry(
  entries: readonly PlanEntryContent[],
  target: EntryTarget,
  changes: Partial<PlanEntryContent>
): PlanEntryContent[] | null {
  const byId = target.id ? entries.findIndex((entry) => entry.id === target.id) : -1;
  const wanted = identityOf(target);
  const index =
    byId === -1 ? entries.findIndex((entry) => !entry.id && identityOf(entry) === wanted) : byId;

  if (index === -1) return null;

  const next = [...entries];
  next[index] = { ...entries[index], ...changes, id: target.id || entries[index].id };
  return next;
}

/**
 * Removes entries, by id and then by what they are.
 *
 * The same fallback `patchEntry` documents, for the same reason: an unconverted
 * note's entries have no ids, and a removal that quietly did nothing would look
 * to the person like a card that came back.
 *
 * **One entry per target**, which is why the fallback loops rather than
 * filtering on a set of identities. A week that genuinely plans the same dish
 * twice on one day should lose one of them when one card is removed, not both.
 */
export function withoutEntries(
  entries: readonly PlanEntryContent[],
  targets: readonly EntryTarget[]
): PlanEntryContent[] | null {
  const ids = new Set(targets.map((target) => target.id).filter(Boolean));
  const doomed = new Set(entries.filter((entry) => entry.id && ids.has(entry.id)));

  for (const target of targets) {
    if (target.id && entries.some((entry) => entry.id === target.id)) continue;

    const wanted = identityOf(target);
    const match = entries.find(
      (entry) => !doomed.has(entry) && !entry.id && identityOf(entry) === wanted
    );
    if (match) doomed.add(match);
  }

  if (doomed.size === 0) return null;
  return entries.filter((entry) => !doomed.has(entry));
}

export function parsePlanNote(input: ParsePlanInput): PlanNoteContent {
  const { frontmatter, properties } = input;
  const raw = frontmatter[properties.entriesProperty];

  return {
    // The property wins over the filename, the way an order's date does: the
    // name is fixed once written and a person correcting the week edits the
    // property.
    week: readText(frontmatter[properties.weekProperty]) ?? input.fromPath?.week ?? null,
    personTitle:
      wikilinkTarget(frontmatter[properties.personProperty]) ??
      readText(frontmatter[properties.personProperty]) ??
      input.fromPath?.personTitle ??
      null,
    entries: (Array.isArray(raw) ? raw : [])
      .map((value) => readEntry(value, properties))
      .filter((entry): entry is PlanEntryContent => entry !== null),
  };
}
