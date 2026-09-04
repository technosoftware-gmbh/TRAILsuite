/**
 * The values the meal notes in this vault actually carry, for the three fields
 * that have a vocabulary.
 *
 * The reason this exists rather than the settings alone: a library is usually
 * older than any setting somebody gets round to filling in, and a dropdown that
 * offered only the setting would be empty on the day the feature arrives and
 * would quietly drop every value already in the notes. So the settings say what
 * is intended and this says what is true, and `vocabulary.ts` unions them.
 *
 * One pass over the library, because three fields want it.
 */
import type { App } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { readMealMeta } from '../parser/meal-meta';
import { readNotesOfType } from '../../vault/read-notes';

export interface MealLibraryValues {
  diets: string[];
  allergens: string[];
  lines: string[];
}

/** Case-insensitively unique, keeping the first spelling seen, sorted for a dropdown. */
function collected(values: Iterable<string>): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function readMealLibraryValues(app: App, settings: CULItrailSettings): MealLibraryValues {
  const diets: string[] = [];
  const allergens: string[] = [];
  const lines: string[] = [];

  for (const note of readNotesOfType(app, settings, 'meal')) {
    const meta = readMealMeta(note.frontmatter, settings);
    diets.push(...meta.diet);
    allergens.push(...meta.allergens);
    if (meta.line) lines.push(meta.line);
  }

  return { diets: collected(diets), allergens: collected(allergens), lines: collected(lines) };
}
