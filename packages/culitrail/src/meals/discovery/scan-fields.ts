/**
 * Reading the meal library to find out what a filter can be built out of.
 *
 * Read on demand, not cached: a modal that offers a field picker scans when it
 * opens and keeps that snapshot for as long as the dialog is up. That follows
 * the rule the rest of the plugin follows, and it means a field added to a note
 * a minute ago is in the next picker rather than after a reload.
 */
import type { App } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { readTags } from 'trail-core';
import { readNotesOfType } from '../../vault/read-notes';
import { internalPropertyNames, summarizeFields, type RawFieldObservations } from './field-summary';
import type { FieldDiscovery } from './types';

export function discoverMealFields(app: App, settings: CULItrailSettings): FieldDiscovery {
  const skip = internalPropertyNames(settings);
  const raw: RawFieldObservations = {
    values: new Map(),
    lists: new Set(),
    tags: new Set(),
    scanned: 0,
  };

  const notes = readNotesOfType(app, settings, 'meal');
  raw.scanned = notes.length;

  for (const note of notes) {
    // The same reader the filters use, so a tag the picker offers is a tag a
    // filter can actually match. Frontmatter only, as everywhere else in this
    // plugin: a body `#tag` has no property name to configure.
    for (const tag of readTags(note.frontmatter.tags)) raw.tags.add(tag);

    for (const [key, value] of Object.entries(note.frontmatter)) {
      if (skip.has(key) || value === null || value === undefined || value === '') continue;

      const seen = raw.values.get(key) ?? [];

      // A list contributes its entries rather than itself, so that
      // `allergens: [nuts, dairy]` is read as two strings and not as one
      // unclassifiable array. Type inference and the suggestion list both
      // want the entries.
      if (Array.isArray(value)) {
        raw.lists.add(key);
        for (const entry of value) {
          if (entry !== null && entry !== undefined && entry !== '') seen.push(entry);
        }
      } else {
        seen.push(value);
      }

      raw.values.set(key, seen);
    }
  }

  return summarizeFields(raw, settings);
}
