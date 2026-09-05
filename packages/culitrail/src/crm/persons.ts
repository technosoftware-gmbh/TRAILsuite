/**
 * Which people are actually offered.
 *
 * One filter, used by two features that must agree: the meal-plan person
 * selector and an order's recipient list. They share it rather than each
 * deriving their own, because a person excluded from one and offered by the
 * other is a bug nobody would think to look for.
 *
 * The filter exists for a specific shape of vault. A People folder often
 * holds notes that are people without being household members: a cookbook
 * author, a contact, a person a trip was shared with. Those should not appear
 * as somebody to plan meals for.
 */
import { App } from 'obsidian';
import { CULItrailSettings } from '../settings/types';
import { filterByTags, parseTagFilter } from '@technosoftware/trail-core';
import { readPersons } from './read-crm';
import { CrmPerson } from './types';

/**
 * The people the eligibility filter admits.
 *
 * **An empty filter means everyone, never nobody.** Turning the feature on
 * must not silently empty the person selector until somebody happens to
 * configure it, so the empty case is the permissive one. This is also the
 * default, so a fresh vault sees every person it has.
 *
 * A parent tag admits its nested children, so a filter of `Family` includes a
 * person tagged `Family/Close`. See trail-core's crm/tags.ts.
 */
export function eligiblePersons(persons: CrmPerson[], eligiblePersonTags: string): CrmPerson[] {
  const filter = parseTagFilter(eligiblePersonTags);
  return filterByTags(persons, filter);
}

/** The eligible people, read fresh from the vault. The form most callers want. */
export function readEligiblePersons(app: App, settings: CULItrailSettings): CrmPerson[] {
  return eligiblePersons(readPersons(app, settings), settings.eligiblePersonTags);
}

/**
 * Eligible people as titles.
 *
 * The title is what a meal-plan note path and an order's `person:` wikilink
 * are both built from, so most callers want these rather than the notes.
 */
export function eligiblePersonTitles(app: App, settings: CULItrailSettings): string[] {
  return readEligiblePersons(app, settings).map((person) => person.title);
}

/**
 * The person a view should show when it has no better answer.
 *
 * Returns the remembered person when they are still eligible, otherwise the
 * first eligible person, otherwise ''. The middle case is the one that
 * matters: a person who has been removed from the vault, renamed, or filtered
 * out by a tag change must not leave the meal-plan view pointing at a note
 * that no longer exists, showing an empty week that looks like data loss.
 */
export function resolveActivePerson(persons: CrmPerson[], remembered: string): string {
  const titles = persons.map((person) => person.title);
  if (remembered && titles.includes(remembered)) return remembered;
  return titles[0] ?? '';
}
