/**
 * Reading a plan note that is still a Markdown checklist.
 *
 * **Read only, and deliberately a dead end.** Nothing writes this shape any
 * more. It exists so that a note nobody has converted yet still shows its week,
 * and so the converter has one place to get the entries from rather than
 * teaching itself the line format a second time.
 *
 * Everything it needs is in `note-parse.ts` and `meal-suffix.ts`, which are the
 * other two files kept for this reason alone.
 *
 * App-free.
 */
import type { CULItrailSettings } from '../../settings/types';
import { readEatingFields, readLineSuffix } from './meal-suffix';
import { isQueueHeading, parseMealPlanNote, type MealPlanSection } from './note-parse';
import { emptyPlanEntry, type PlanEntryContent } from './plan-note';

/**
 * True for a section the plan format itself created: a weekday, or the queue.
 *
 * A `## Shopping` section somebody added is not one, and its bullets are not
 * plan entries. The line parser cannot tell the difference on its own, since
 * `- Bread` and `- Leftovers` are the same shape, so the section it sits under
 * is the only thing that can. Reading it any other way would put the shopping
 * list on the week.
 */
function isPlanSection(section: MealPlanSection): boolean {
  return section.day !== null || isQueueHeading(section.heading);
}

/**
 * The entries a checklist body holds, in the shape the frontmatter format uses.
 *
 * An entry with no `<!--culi-id:…-->` marker comes back with an empty id, which
 * is most of them: the marker was only ever written by whatever recorded a
 * cook. Whoever writes the note next mints one.
 *
 * A `[rating:: 0]` becomes an eaten entry with no rating, which is the thing
 * the zero was standing in for. `readLineSuffix` already stops at 1 to 5, so
 * this costs nothing here beyond saying so.
 */
export function planEntriesFromBody(body: string, settings: CULItrailSettings): PlanEntryContent[] {
  const lines = parseMealPlanNote(body, settings)
    .filter(isPlanSection)
    .flatMap((section) => section.lines.filter((line) => line.kind === 'entry'));

  return lines.map((line) => {
    const suffix = readLineSuffix(line.suffix, settings);
    const fields = readEatingFields(line.suffix);

    return {
      ...emptyPlanEntry(fields.id ?? ''),
      mealTitle: line.wikilink || null,
      label: line.wikilink ? null : (line.label?.trim() ?? null),
      day: line.day,
      slot: suffix.meal,
      eaten: line.checked,
      rating: suffix.rating,
      time: fields.time,
      note: fields.note,
      isLeftovers: suffix.isLeftovers,
    };
  });
}

/**
 * What is left of a body once the plan has been lifted out of it.
 *
 * Takes the body **without** its frontmatter block, and gives back whatever
 * somebody wrote that was not a plan: a shopping reminder under Thursday, a
 * paragraph at the top, a `## Shopping` section of their own. The converter
 * keeps it, because the one promise the checklist format made was that a
 * hand-written line survives every rewrite, and dropping those on the way out
 * would be breaking that promise at the last possible moment.
 *
 * The weekday headings, the queue heading and the `# Meal Plan` title go, since
 * all three are structure this format invented to hold the entries that are
 * now properties.
 */
export function bodyWithoutPlan(body: string, settings: CULItrailSettings): string {
  const kept: string[] = [];
  let seenContent = false;

  for (const section of parseMealPlanNote(body, settings)) {
    const structural = isPlanSection(section);
    if (section.heading && !structural) {
      kept.push(`## ${section.heading}`);
      seenContent = true;
    }

    for (const line of section.lines) {
      // Only a plan section's entries go. A bullet under somebody's own heading
      // is theirs.
      if (line.kind === 'entry' && structural) continue;

      // The note's own title, and only while nothing else has been kept, so a
      // `# ` heading further down that somebody wrote survives.
      if (!seenContent && /^#\s/.test(line.raw)) continue;
      if (!seenContent && !line.raw.trim()) continue;

      kept.push(line.raw);
      if (line.raw.trim()) seenContent = true;
    }
  }

  return kept.join('\n').trim();
}
