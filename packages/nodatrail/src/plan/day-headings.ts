/**
 * The headings a day note's entries sit under, in every spelling this plugin
 * has written them in. Pure: which languages to ask is the caller's.
 *
 * `add-to-day.ts` asks with the current language first, because the first
 * entry is the one it writes. The interchange export only has to recognise a
 * heading and asks the tables directly (`lang/all-locales.ts`), since the
 * current language is Obsidian's and the export runs without it.
 */
import type { NODAtrailSettings } from '../settings/types';
import type { DayEntryKind } from './day-draft';

/**
 * The headings for `kind`: the configured one first when there is one, then
 * every language's own. See `headingsFor` in `add-to-day.ts` for the rules.
 */
export function dayHeadings(
  settings: NODAtrailSettings,
  kind: DayEntryKind,
  translations: (key: string) => string[]
): string[] {
  // A span files under the schedule with the meetings, not with the thoughts.
  // A fortnight away is the reason nothing else is in those days, which is the
  // question the schedule answers and the notes section does not.
  const scheduled = kind === 'meeting' || kind === 'span';
  const configured = (
    kind === 'task'
      ? settings.dayFocusHeading
      : scheduled
        ? settings.dayScheduleHeading
        : settings.dayNotesHeading
  ).trim();

  const key = kind === 'task' ? 'focus' : scheduled ? 'schedule' : 'notes';
  const candidates = configured
    ? [configured, ...translations(`day.headings.${key}`)]
    : translations(`day.headings.${key}`);

  return [...new Set(candidates.filter((heading) => heading.trim() !== ''))];
}
