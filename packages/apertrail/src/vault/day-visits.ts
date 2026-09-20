/**
 * Days somebody wrote a place into, as evidence that they were there.
 *
 * **A place visited outside a trip had no way to count as visited.** The
 * derivation beside this reads trips, and rightly: a stop on a finished trip is
 * evidence. But a restaurant on an ordinary Tuesday is not a trip and never
 * will be, and the Prospekt said `nicht besucht` about a place somebody had
 * eaten at the day before. This is the other half of that evidence.
 *
 * **It reads a title and a link, and never a body.** `metadataCache.
 * resolvedLinks` already holds what every note links to; a note whose title has
 * the day shape and links to a place is a day somebody wrote that place into,
 * and its title *is* the date. So this needs no heading, no marker and no
 * setting belonging to the plugin that writes those notes: nothing here parses
 * a format this package does not own, which is what kept it out of a contract.
 * See `packages/nodatrail/docs/design/day-entry-links.md` section F.4.
 *
 * **The cost is honest and is worth stating.** A day note that merely mentions
 * a place -- "muss ich mal ausprobieren" with a link in it -- counts as a
 * visit. That is looser than the trip rule deliberately: a Planned trip is an
 * intention and is not counted, where a link in a day note cannot be told from
 * one. The alternative was reading the day-entry format to find the line the
 * link sits on, which means a contract over somebody else's note body for one
 * flag on a card.
 *
 * **The day shape rather than the day folder.** `detectPeriodLevel` knows five
 * fixed title shapes and needs no settings, so a vault that renames its day
 * notes is not claimed here at all -- it gets no day visits rather than wrong
 * ones. That is the same direction every other narrowing in this package
 * fails in.
 */
import { TFile, type App } from 'obsidian';
import { detectPeriodLevel } from '@technosoftware/trail-core';

/**
 * Every note path a day note links to, with the days that link to it.
 *
 * Keyed by path rather than by title, because that is what `resolvedLinks`
 * resolved and because two notes in different folders may share a title. The
 * trip index beside this is keyed by title for the opposite reason: a stop
 * names a title and has no path to offer.
 */
export function readDayVisits(app: App): Map<string, string[]> {
  const byPath = new Map<string, string[]>();

  // **Defaulted, because a link index is something Obsidian builds.** It is
  // absent before the vault has been indexed and in any host that never builds
  // one, and a board read that threw there would take every card with it rather
  // than one flag on some of them.
  const resolved = app.metadataCache.resolvedLinks ?? {};

  for (const [sourcePath, targets] of Object.entries(resolved)) {
    const source = app.vault.getAbstractFileByPath(sourcePath);
    if (!(source instanceof TFile)) continue;
    // The title of a day note is the day. That is true by construction of every
    // template `detectPeriodLevel` recognises, which is why nothing here parses
    // a date out of anything.
    if (detectPeriodLevel(source.basename) !== 'day') continue;

    for (const targetPath of Object.keys(targets)) {
      const days = byPath.get(targetPath) ?? [];
      days.push(source.basename);
      byPath.set(targetPath, days);
    }
  }

  return byPath;
}
