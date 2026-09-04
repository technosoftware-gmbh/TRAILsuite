/**
 * Reads a meal note off disk into its parsed form.
 *
 * The bridge between the App-free parser and everything above it. Every layer
 * that shows a meal (the view, the gallery card, the suggester) starts here,
 * so a meal means the same thing to all of them.
 *
 * Nothing is cached. `cachedRead()` is Obsidian's own read-through cache, so
 * repeated reads of an unchanged file are cheap without this module holding
 * state that could go stale.
 */
import { App, TFile } from 'obsidian';
import { CULItrailSettings } from '../settings/types';
import { frontmatterOf } from '../shared/vault-scan';
import { extractLeadingText, extractSection, stripFrontmatter } from './parser/body-sections';
import { readMealMeta } from './parser/meal-meta';
import { MealMeta } from './types';

export interface ParsedMeal {
  file: TFile;
  /** The filename without its extension. What meal plans and orders link to. */
  title: string;
  meta: MealMeta;
  /** The free text between the frontmatter and the first heading. */
  description: string;
  /** The Notes section, rendered rather than parsed. */
  notes: string;
  /** The note body with frontmatter removed, kept so a view can render whatever the parser did not claim. */
  body: string;
}

/**
 * Reads and parses one meal.
 *
 * Does not check that the file *is* a meal. Callers that need that ask
 * `isNoteOfType()` first; this one parses whatever it is handed.
 */
export async function readMeal(
  app: App,
  file: TFile,
  settings: CULItrailSettings
): Promise<ParsedMeal> {
  const raw = await app.vault.cachedRead(file);
  const body = stripFrontmatter(raw);
  const lines = body.split('\n');

  return {
    file,
    title: file.basename,
    // The lines go in as well, because this module has them: a meal written
    // before the per-100 g breakdown moved into properties still keeps it under
    // two headings, and the point of this bridge is that a meal means the same
    // thing to every layer above it.
    meta: readMealMeta(frontmatterOf(app, file) ?? {}, settings, lines),
    description: extractLeadingText(lines),
    notes: extractSection(lines, settings.notesHeading).content,
    body,
  };
}
