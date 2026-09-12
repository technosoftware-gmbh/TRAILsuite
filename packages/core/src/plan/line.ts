/**
 * One line of a meal plan, read and written by the same file.
 *
 * A plan note's body is markdown rather than frontmatter:
 *
 *     ## Monday
 *     - [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4] [note:: ½ portion]
 *
 * This module exists because reading and writing that line have to agree. It is
 * here rather than in CULItrail because a plan line is a note format: which
 * tokens a line may carry and in what order is an agreement about the file
 * rather than one writer's model of it, and a format kept inside the code that
 * renders it changes every time the rendering does. A log a writer emits and a
 * parser cannot read back is how a vault ends up with text nothing can see, and
 * the defence is that both ends call the same function.
 *
 * **`[rating:: 0]` means "eaten but not rated", not "zero stars".** 32 lines in
 * the vault this was written against carry it. `rating` is `null` for those, and
 * a caller that wants to keep the distinction between "no rating written" and "a
 * zero was written" has `ratingWritten` to read.
 *
 * App-free, filesystem-free, clock-free.
 */

export interface PlanEntry {
  /** The linked meal's title, exactly as it should be written. */
  meal: string;
  /** A ticked box: the meal was eaten. Unticked is planned. */
  eaten: boolean;
  /** `lunch`, `dinner`, `snack`, `breakfast`, … or null for no `#meal/` tag. */
  slot: string | null;
  /** 1–5, or null when unrated. A written `0` reads as null. */
  rating: number | null;
  /** True when the line carried a rating field at all, zero included. */
  ratingWritten: boolean;
  /** Free text, or null. */
  note: string | null;
  /** `HH:mm`, or null. */
  time: string | null;
  /** A second outing of something already eaten, marked by `#leftovers`. */
  leftovers: boolean;
  /** The hidden id an editor needs to find this line again, or null. */
  id: string | null;
}

/**
 * Marks an entry as a second outing of something already eaten.
 *
 * **A stable English tag, never translated**, exactly like the `#meal/` slot
 * keys and the weekday headings. It is written into the note, so a vault read
 * in German and written in English has to produce one spelling or the two ends
 * stop meeting.
 */
export const LEFTOVERS_TAG = 'leftovers';

/**
 * The tag, bounded the way Obsidian bounds a tag rather than the way `\b` does.
 *
 * `\b` is a word boundary, and `-` is not a word character, so `#leftovers\b`
 * matches inside `#leftovers-friday` – somebody's own tag read as this mark.
 * An Obsidian tag runs on through letters, digits, `-`, `_` and `/`, so the
 * boundary is "not one of those".
 */
const LEFTOVERS = new RegExp(`#${LEFTOVERS_TAG}(?![\\w/-])`, 'i');
const LEFTOVERS_ALL = new RegExp(`\\s*#${LEFTOVERS_TAG}(?![\\w/-])`, 'gi');

/** True when a line, or the tail of one, carries the leftovers mark. */
export function hasLeftoversTag(text: string): boolean {
  return LEFTOVERS.test(text);
}

/**
 * The same text with the mark taken out, space and all.
 *
 * Exported because CULItrail rewrites the tail of a line in place and has to
 * remove exactly what this file writes. Two regexes for one tag is how
 * `#leftovers-friday` became a leftovers mark in the first place.
 */
export function stripLeftoversTag(text: string): string {
  return text.replace(LEFTOVERS_ALL, '');
}

const CHECKBOX = /^(\s*[-*+]\s*\[)(.)(\]\s*)(.*)$/;
const WIKILINK = /\[\[([^\]|#]+)(?:[^\]]*)?\]\]/;
const MEAL_TAG = /#meal\/([\w-]+)/;
const ID_MARKER = /<!--\s*(?:culi|cul|rb)-id:([^\s>]+?)\s*-->/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The id marker.
 *
 * An HTML comment because a markdown bullet has nowhere else to carry an
 * identity, and a comment is invisible in reading view. The `culi-` prefix is
 * kept from CULItrail's own body log rather than invented fresh, so the ids
 * already written in this vault survive.
 */
export function idMarker(id: string): string {
  return `<!--culi-id:${id}-->`;
}

function inlineField(text: string, field: string): string | null {
  const match = new RegExp(`\\[${field}::\\s*([^\\]]*)\\]`).exec(text);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** A plan line as its parts, or null when the line is not one. */
export function parsePlanLine(line: string): PlanEntry | null {
  const box = CHECKBOX.exec(line);
  const state = box?.[2];
  const rest = box?.[4];
  if (state === undefined || rest === undefined) return null;

  const meal = WIKILINK.exec(rest)?.[1]?.trim();
  if (!meal) return null;

  const raw = inlineField(rest, 'rating');
  const parsed = raw === null ? Number.NaN : Number(raw);
  const time = inlineField(rest, 'time');

  return {
    meal,
    eaten: state.toLowerCase() === 'x',
    slot: MEAL_TAG.exec(rest)?.[1] ?? null,
    rating: Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null,
    ratingWritten: raw !== null,
    note: inlineField(rest, 'note'),
    time: time !== null && TIME.test(time) ? time : null,
    leftovers: hasLeftoversTag(rest),
    id: ID_MARKER.exec(rest)?.[1] ?? null,
  };
}

/**
 * One entry as the line to write.
 *
 * Field order is fixed – link, meal tag, rating, leftovers, time, note, id – so
 * a line rewritten after an edit differs from the old one only where
 * the value changed. A writer that reorders on every save turns a one-word edit
 * into a whole-line diff in the vault's history.
 *
 * A field with nothing in it is omitted rather than written empty: `[note:: ]`
 * is noise, and an absent field is what every reader here treats as unknown.
 */
export function renderPlanLine(entry: PlanEntry): string {
  const parts = [`- [${entry.eaten ? 'x' : ' '}]`, `[[${entry.meal}]]`];

  if (entry.slot) parts.push(`#meal/${entry.slot}`);

  // A written zero is preserved. It is the vault's way of saying a meal was
  // eaten and deliberately not rated, and dropping it would lose that.
  if (entry.rating !== null) parts.push(`[rating:: ${entry.rating}]`);
  else if (entry.ratingWritten) parts.push('[rating:: 0]');

  // After the rating and before the fields an eater writes, which is where
  // CULItrail's own suffix builder puts it. The two write the same line or a
  // note edited by both ends up with its tokens shuffled on every save.
  if (entry.leftovers) parts.push(`#${LEFTOVERS_TAG}`);

  if (entry.time) parts.push(`[time:: ${entry.time}]`);
  if (entry.note) parts.push(`[note:: ${entry.note}]`);
  if (entry.id) parts.push(idMarker(entry.id));

  return parts.join(' ');
}

/** A new entry with everything absent, so a caller states only what it knows. */
export function planEntry(meal: string, overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    meal,
    eaten: true,
    slot: null,
    rating: null,
    ratingWritten: false,
    note: null,
    time: null,
    leftovers: false,
    id: null,
    ...overrides,
  };
}
