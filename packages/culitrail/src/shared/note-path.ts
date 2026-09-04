/**
 * Resolves the `{token}` path templates that address a meal-plan or grocery
 * note.
 *
 * Two token families, resolved in a fixed order and for different reasons.
 * `{person}` is substituted first, because a person's name can contain
 * characters that would otherwise be mistaken for a date token; the date
 * tokens are substituted afterwards against the ISO week.
 *
 * App-free: no `obsidian` import. The tokens are resolved against
 * `trail-core`'s date layer rather than moment, so this is directly testable.
 * The folder half of a resolved path is `trail-core`'s `folderOfPath`.
 */
import { isoWeekOf, localDateISO } from 'trail-core';

/**
 * A person's title as a plan note's filename spells them.
 *
 * The rule is `trail-core`'s, because what a plan note is called belongs to the
 * note format rather than to this plugin: the filename is how a week is found
 * again, long after whatever wrote it. It is imported rather than restated
 * here, since a second implementation that disagreed by one character would
 * file a week where the first could not find it.
 */
import { personFileToken } from 'trail-core';

// Re-exported separately rather than with `export ... from`, which would not
// create the local binding the template filler below needs.
export { personFileToken };

/** The token values a path template can reference. */
interface TokenValues {
  GGGG: string;
  WW: string;
  YYYY: string;
  MM: string;
  DD: string;
}

function tokenValues(date: Date): TokenValues {
  const { weekYear, week } = isoWeekOf(date);
  const [year, month, day] = localDateISO(date).split('-');
  return {
    // ISO week-year and week number. These are the ones the note paths use.
    GGGG: String(weekYear),
    WW: String(week).padStart(2, '0'),
    // Calendar-date tokens, available for a vault that wants them somewhere
    // else. Deliberately NOT used in the shipped defaults: {YYYY} disagrees
    // with {GGGG} in the days around New Year, which is exactly when a week
    // note would land in the wrong year's folder.
    YYYY: year,
    MM: month,
    DD: day,
  };
}

/**
 * Substitutes every token in a path template.
 *
 * An unrecognized token is left as written rather than blanked. A path
 * containing a literal `{foo}` is visibly wrong in the file explorer, whereas
 * one silently collapsed to nothing quietly collides with another week's
 * note.
 */
export function resolveNotePath(
  template: string,
  options: { date?: Date; person?: string } = {}
): string {
  const { date = new Date(), person } = options;

  // Person first: a title can contain digits and letters that would otherwise
  // be read as part of an adjacent date token.
  const withPerson =
    person === undefined ? template : template.replace(/\{person\}/g, personFileToken(person));

  const values = tokenValues(date);
  return withPerson.replace(/\{(GGGG|WW|YYYY|MM|DD)\}/g, (match, token: keyof TokenValues) => {
    return values[token] ?? match;
  });
}

/** True when a template addresses a per-person note, which is what makes a path unresolvable without knowing whose plan it is. */
export function templateNeedsPerson(template: string): boolean {
  return template.includes('{person}');
}
