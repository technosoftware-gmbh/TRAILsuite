/**
 * Reading every meal in scope into the shape the gallery sorts and filters.
 *
 * Once per render, never inside a comparator. This is the only place in the
 * gallery that touches the vault at all, which is what lets the filtering and
 * the ordering be plain functions with tests.
 *
 * **It reads note bodies, which the gallery deliberately never used to do.** A
 * card is small and the old rule that a body read per card is not worth it still
 * holds for anything cosmetic. Whether a dish is eaten or reheated is not
 * cosmetic: it is a filter facet, so it has to be known before the grid is
 * painted rather than filled in afterwards, and it cannot be answered from
 * frontmatter because ingredients and reheating instructions both live in the
 * body. Measured at 24 ms for 126 notes over a slow mount, which is the reason
 * this is a plain read rather than a lazy pass like the images.
 *
 * The alternative was a cheaper approximation from Obsidian's own heading cache,
 * and it was rejected on purpose: it cannot tell a supplier instruction whose
 * token nothing fills from one that resolves, so the gallery would have said
 * "ready meal" about dishes whose meal view shows nothing. One notion of what a
 * dish is, computed the same way in both places.
 */
import type { App } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { readTags } from '@technosoftware/trail-core';
import { readNoteOrEmpty } from '../../shared/vault-io';
import { readNotesOfType } from '../../vault/read-notes';
import { stripFrontmatter } from '../parser/body-sections';
import { readMealMeta } from '../parser/meal-meta';
import { parseReheatSection } from '../reheating/parse-section';
import { readSuppliersForMeals } from '../reheating/read-supplier';
import { resolveReheating } from '../reheating/resolve';
import { readEatingEvents } from '../../planning/meal-plan/eating-events';
import type { EatingEntry } from '../types';
import type { GalleryEntry } from '../view-model/gallery-entry';

export async function buildGalleryEntries(
  app: App,
  settings: CULItrailSettings
): Promise<GalleryEntry[]> {
  const notes = readNotesOfType(app, settings, 'meal');

  // One pass for every supplier, rather than one lookup per meal. See
  // readSuppliersForMeals for why that distinction is load-bearing.
  const suppliers = await readSuppliersForMeals(
    app,
    settings,
    notes.map((note) => ({ title: note.title, frontmatter: note.frontmatter }))
  );

  // Likewise one pass over the meal plans rather than one per meal. This is
  // where eating history lives since the migration; `readMealMeta` still reads
  // the frontmatter property, which no longer exists on any meal.
  const cooks = settings.eatingHistoryEnabled
    ? await readEatingEvents(app, settings)
    : new Map<string, EatingEntry[]>();

  const entries: GalleryEntry[] = [];

  for (const note of notes) {
    const body = stripFrontmatter(await readNoteOrEmpty(app, note.file.path));
    const supplier = suppliers.get(note.title.trim().toLowerCase()) ?? null;

    entries.push({
      file: note.file,
      title: note.title,
      // A meal at the vault root has a parent whose path is '/', which is not
      // a folder anybody would want offered in a filter dropdown.
      folder: note.file.parent && note.file.parent.path !== '/' ? note.file.parent.path : '',
      tags: readTags(note.frontmatter.tags),
      // The log off the plans, replacing the empty one frontmatter now gives.
      // `eatenCount` and `lastEaten` are left as they are: they are explicit
      // properties on 124 of these notes, the cache `fix-eating-history.py`
      // rebuilds, and they are still correct.
      meta: {
        ...readMealMeta(note.frontmatter, settings),
        eatingHistory: cooks.get(note.file.path) ?? [],
      },
      createdAt: note.file.stat.ctime,
      modifiedAt: note.file.stat.mtime,
      hasReheating:
        resolveReheating(parseReheatSection(body, settings), supplier?.entries ?? [], settings)
          .length > 0,
      supplier,
    });
  }

  return entries;
}
