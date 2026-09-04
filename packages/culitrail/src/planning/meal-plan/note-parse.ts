/**
 * Reading a meal-plan note back into sections and lines.
 *
 * The note is the source of truth, so this has to survive whatever a person
 * has done to it by hand. Anything it cannot read as an entry is kept as a
 * raw line and written back untouched, which is what lets somebody add a
 * shopping reminder under Thursday without the plugin eating it.
 *
 * App-free.
 */
import { isQueueHeading as isCoreQueueHeading, QUEUE_HEADING } from 'trail-core';
import { parseWeekdayKey, type WeekdayKey } from '../../lang/vocabulary';
import type { CULItrailSettings } from '../../settings/types';
import { readLineSuffix } from './meal-suffix';

/**
 * The heading for entries not assigned to a day, and its aliases, are
 * `trail-core`'s: they moved there with the rest of the plan-note format, and
 * this plugin imports the one spelling rather than keeping a second.
 */
export { QUEUE_HEADING };

/**
 * True for the queue's own heading, and for no heading at all.
 *
 * The null case is this plugin's rather than the core's: lines above the first
 * heading in a note belong to no section, and this reads them as queued. The
 * core's reader answers about a heading it was given, which is why the two are
 * not the same function.
 */
export function isQueueHeading(heading: string | null): boolean {
  return heading === null || isCoreQueueHeading(heading);
}

/** A meal line: `- [ ] [[Target|Alias]] suffix`. */
const MEAL_LINE = /^[-*+]\s+(?:\[([x ])\]\s+)?\[\[([^\]|]+)(?:\|[^\]]+)?\]\](.*)?$/i;

/**
 * A line naming a meal that is not a meal note: `- [ ] Grilled cheese (lunch)`.
 *
 * The suffix group accepts a `#tag`, a `[field:: value]`, or a parenthetical
 * at the end. Requiring `::` inside the brackets is what stops a label that
 * genuinely contains brackets, such as `Chicken [Nonna's]`, from having half
 * of itself read as a property.
 */
const PLAIN_LINE =
  /^[-*+]\s+(?:\[([x ])\]\s+)?([^[].*?)\s*((?:#\S.*)|(?:\[\w+::[^\]]*\].*)|(?:\([^)]*\)))?$/i;

export interface MealPlanLine {
  kind: 'entry' | 'raw';
  /** Where this line sits in the note's body, so an editor can rewrite it without searching for it. */
  index: number;
  /**
   * The line up to where its suffix begins, trailing space removed.
   *
   * Kept, along with `suffix`, because editing an entry means replacing what
   * this module owns and leaving the rest of the line exactly as written. A
   * writer that regenerates the whole line instead can only write the fields
   * it happens to model, which is how `[note:: …]`, a `[time:: …]` or a ticked
   * box get silently dropped by a rating change.
   */
  head: string;
  /** Everything trailing the meal link or label, exactly as written. '' when there is none. */
  suffix: string;
  /** The linked meal's note title, or '' for a line naming a meal directly. */
  wikilink: string;
  /** The text of a non-meal line. Undefined on a meal line. */
  label?: string;
  /** The weekday the containing section names, or null in the queue. */
  day: WeekdayKey | null;
  meal: string | null;
  rating: number | null;
  isLeftovers: boolean;
  checked: boolean;
  /** The line exactly as written, so anything not understood survives a rewrite. */
  raw: string;
}

export interface MealPlanSection {
  /** The weekday key, or null for the queue and for any heading that is not a weekday. */
  day: WeekdayKey | null;
  /** The heading exactly as written, so an unrecognized section keeps its name. */
  heading: string | null;
  lines: MealPlanLine[];
}

/**
 * The index of a leading frontmatter block's closing delimiter, or -1.
 *
 * An unterminated block counts as no block, matching what every other reader
 * here does with one: a note somebody is midway through editing is read as
 * body rather than truncated.
 */
function frontmatterEndIndex(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return i;
  }
  return -1;
}

function rawLine(raw: string, index: number): MealPlanLine {
  return {
    kind: 'raw',
    index,
    head: raw,
    suffix: '',
    wikilink: '',
    day: null,
    meal: null,
    rating: null,
    isLeftovers: false,
    checked: false,
    raw,
  };
}

/** Splits a line into the part this module does not own and the suffix it does. */
function splitSuffix(raw: string, suffix: string): { head: string; suffix: string } {
  return { head: raw.slice(0, raw.length - suffix.length).trimEnd(), suffix };
}

export function parseMealPlanNote(body: string, settings: CULItrailSettings): MealPlanSection[] {
  const sections: MealPlanSection[] = [];
  let current: MealPlanSection = { day: null, heading: null, lines: [] };

  const lines = body.split('\n');
  // The note carries `created:` and `modified:` now, and a hand-added
  // top-level YAML list (`tags:` followed by `- dinner`) would otherwise be
  // read as a meal named "dinner". The block's lines are kept rather than
  // skipped: the whole file is rebuilt from these sections when an entry is
  // removed, so a line that is not carried is a line that is lost.
  const frontmatterEnd = frontmatterEndIndex(lines);

  lines.forEach((raw, index) => {
    if (index <= frontmatterEnd) {
      current.lines.push(rawLine(raw, index));
      return;
    }

    if (raw.startsWith('## ')) {
      sections.push(current);
      const heading = raw.slice(3).trim();
      current = { day: parseWeekdayKey(heading), heading, lines: [] };
      return;
    }

    const meal = MEAL_LINE.exec(raw);
    if (meal) {
      const suffix = readLineSuffix(meal[3] ?? '', settings);
      current.lines.push({
        kind: 'entry',
        index,
        ...splitSuffix(raw, meal[3] ?? ''),
        wikilink: meal[2].trim(),
        day: current.day,
        meal: suffix.meal,
        rating: suffix.rating,
        isLeftovers: suffix.isLeftovers,
        checked: meal[1]?.toLowerCase() === 'x',
        raw,
      });
      return;
    }

    const plain = PLAIN_LINE.exec(raw);
    if (plain) {
      const suffix = readLineSuffix(plain[3] ?? '', settings);
      current.lines.push({
        kind: 'entry',
        index,
        ...splitSuffix(raw, plain[3] ?? ''),
        wikilink: '',
        label: plain[2].trim(),
        day: current.day,
        meal: suffix.meal,
        rating: suffix.rating,
        isLeftovers: suffix.isLeftovers,
        checked: plain[1]?.toLowerCase() === 'x',
        raw,
      });
      return;
    }

    current.lines.push(rawLine(raw, index));
  });

  sections.push(current);
  return sections;
}

/** Every entry line across every section, for a caller that does not care which day it was under. */
export function entryLines(sections: MealPlanSection[]): MealPlanLine[] {
  return sections.flatMap((section) => section.lines.filter((line) => line.kind === 'entry'));
}
