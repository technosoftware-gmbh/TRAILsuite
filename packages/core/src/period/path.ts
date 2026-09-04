/**
 * Turning a period into the path of its note, and a path back into a period.
 *
 * The template is a setting, so a vault that files its dailies somewhere else
 * changes one string rather than needing a release. The token set is small on
 * purpose: every token is a calendar field, and nothing here formats a name or
 * a label, because the core ships no user-facing strings.
 *
 *   {YYYY}  calendar year        2026
 *   {MM}    month, zero padded   08
 *   {DD}    day, zero padded     22
 *   {GGGG}  ISO week-year        2026
 *   {WW}    ISO week, padded     34
 *   {Q}     quarter              3
 *
 * **`{GGGG}` and `{WW}` rather than `{YYYY}` and a week number**, for the reason
 * CULItrail's meal-plan path already documents: the calendar year and the ISO
 * week-year disagree at a year boundary, so a week note filed under `{YYYY}` is
 * filed under the wrong year for one week in most years and is then not where
 * the following year's reader looks for it.
 *
 * An unknown token is left exactly as written rather than replaced with an
 * empty string. A typo should produce a visibly wrong path that somebody fixes,
 * not a plausible one that silently collects notes.
 *
 * App-free.
 */
import { pad2 } from '../dates/day.js';
import { isoWeekOf } from '../dates/iso-week.js';
import { normalizePath } from '../paths/folders.js';
import { periodTitle, type PeriodLevel } from './levels.js';

/** Every token's value for one date. */
function tokenValues(date: Date): Record<string, string> {
  const week = isoWeekOf(date);

  return {
    YYYY: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    DD: pad2(date.getDate()),
    GGGG: String(week.weekYear),
    WW: pad2(week.week),
    Q: String(Math.floor(date.getMonth() / 3) + 1),
  };
}

/**
 * The template with its tokens filled in.
 *
 * Takes the date rather than the level, because a template says which fields it
 * wants and the level does not change what `{MM}` means.
 */
export function expandPeriodPath(template: string, date: Date): string {
  const values = tokenValues(date);
  return normalizePath(
    template.replace(/\{([A-Za-z]+)\}/g, (whole, token: string) => values[token] ?? whole)
  );
}

/** The note's path for a period, from the level's template. */
export function periodNotePath(template: string, _level: PeriodLevel, date: Date): string {
  return expandPeriodPath(template, date);
}

/**
 * The folder a level's notes live in: the template up to its last separator,
 * with the tokens filled in.
 *
 * A folder rather than a template, because the year folder in
 * `0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md` is part of where the note goes
 * and a caller creating the note has to create it.
 */
export function periodFolder(template: string, date: Date): string {
  const path = expandPeriodPath(template, date);
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

/** The note's title, which is its filename without the extension, from the same template. */
export function periodTitleFromTemplate(template: string, date: Date): string {
  const path = expandPeriodPath(template, date);
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

/**
 * True when a template produces the title the level's own formatter would.
 *
 * A vault may name its daily notes anything, and this suite does not object.
 * But every reader that resolves a wikilink between two period notes resolves
 * it by title, so a template that renames the note quietly breaks the
 * navigation between them. This is what a settings row uses to say so.
 */
export function templateMatchesTitle(template: string, level: PeriodLevel, date: Date): boolean {
  return periodTitleFromTemplate(template, date) === periodTitle(level, date);
}
