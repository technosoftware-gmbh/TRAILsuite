/**
 * Resolves the list of people a trip can be shared with.
 *
 * A thin projection over read-crm.ts rather than its own folder scan. The
 * two used to be separate walks of the vault with their own copies of the
 * folder-plus-type rule, which is one copy too many now that People are
 * read for a dashboard as well as for this dropdown.
 *
 * APERtrail still keeps no contact list of its own: a Person is a note in
 * the configured folder carrying the configured type value, optionally
 * narrowed by a tag filter.
 */
import { App } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { filterByTags, parseTagFilter } from '@technosoftware/trail-core';
import { readCrmBoard } from './read-crm';

/** Every Person note under the configured folder, title-sorted. */
export function getPersonTitles(app: App, settings: APERtrailSettings): string[] {
  const titles = readCrmBoard(app, settings).persons.map((person) => person.title);
  return [...new Set(titles)].sort((a, b) => a.localeCompare(b));
}

/**
 * Every configured Person's title, narrowed to those tagged with one of
 * settings.eligiblePersonTags (comma-separated).
 *
 * An empty eligible-tags setting means "no filter" -- every Person is
 * returned. That default matters: a vault that never touches this setting
 * would otherwise see an empty person list with no clue why, which is worse
 * than showing one person too many.
 *
 * The comparison itself is trail-core's tag matching rather than a string
 * equality test here, because the four ways a hand-written tag misses an exact match are
 * four ways for somebody to be quietly left out of the dropdown: a different
 * case, a leading `#`, a nested tag under the group being filtered on, or a
 * filter typed with a `#` in front. See that module for why each one is
 * answered the way it is.
 */
export function getEligiblePersonTitles(app: App, settings: APERtrailSettings): string[] {
  const filter = parseTagFilter(settings.eligiblePersonTags);
  if (filter.length === 0) return getPersonTitles(app, settings);

  const titles = filterByTags(readCrmBoard(app, settings).persons, filter).map(
    (person) => person.title
  );

  return [...new Set(titles)].sort((a, b) => a.localeCompare(b));
}
