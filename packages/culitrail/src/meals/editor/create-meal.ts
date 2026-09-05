/**
 * Making a meal note that does not exist yet.
 *
 * **What a new note carries is the shortest thing the readers will recognise:**
 * the configured type value and a creation stamp. Nothing else. No servings, no
 * times, no placeholder text, and **no section headings** either.
 *
 * **The headings are deliberately absent.** `writeMealDraft` needs no section
 * to write into: a meal's figures go into frontmatter, and the one body span it
 * touches is the description, which sits above the first heading and has
 * nothing to anchor on. A seeded heading would be a section this note carries
 * and its neighbours are having taken out.
 *
 * So the body starts empty and the first save shapes it, exactly as a save on
 * any other meal does.
 */
import { App, normalizePath, stringifyYaml, TFile } from 'obsidian';
import { createdEntry } from '@technosoftware/trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { ensureParentFolders } from '../../shared/vault-io';

/**
 * A filename from a typed title.
 *
 * The characters a vault cannot put in a filename come out; everything else
 * stays, including the case and the spaces somebody typed. The title is the
 * note's identity here, the way it is everywhere else in this vault: every
 * wikilink pointing at this meal will address it by this name.
 */
export function mealFilenameStem(title: string): string {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A path in the meals folder that nothing occupies.
 *
 * Numbered rather than overwriting, exactly as an import is: two meals called
 * "Pancakes" is a normal thing for a library to contain, and silently replacing
 * the first would be data loss dressed up as a feature.
 */
export function freeMealPath(app: App, folder: string, title: string): string {
  const stem = mealFilenameStem(title);
  const base = folder.trim().replace(/\/+$/, '');

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const name = attempt === 0 ? stem : `${stem} ${attempt + 1}`;
    const path = normalizePath(base ? `${base}/${name}.md` : `${name}.md`);
    if (!app.vault.getAbstractFileByPath(path)) return path;
  }

  return normalizePath(`${base}/${stem} ${Date.now()}.md`);
}

/** The frontmatter a new meal carries: what it is, and when it was made. */
export function newMealFrontmatter(settings: CULItrailSettings): Record<string, unknown> {
  return {
    [settings.typePropertyName || 'type']: settings.mealTypeValue,
    ...createdEntry(settings),
  };
}

export class MealCreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealCreateError';
  }
}

/**
 * Creates the note and returns it, for the caller to open the editor on.
 *
 * Refuses a blank title and a blank meals folder. The second is the same
 * guard the CRM writers keep and for the same reason: an empty folder setting
 * joined to a filename writes to the vault root, where the reader does not
 * look, and nothing about that failure is visible afterwards.
 */
export async function createMealNote(
  app: App,
  settings: CULItrailSettings,
  title: string
): Promise<TFile> {
  const stem = mealFilenameStem(title);
  if (!stem) throw new MealCreateError('A meal needs a name');

  const folder = settings.mealsFolder.trim();
  if (!folder) throw new MealCreateError('No meals folder is configured');

  const path = freeMealPath(app, folder, title);
  await ensureParentFolders(app, path);

  const frontmatter = stringifyYaml(newMealFrontmatter(settings)).trimEnd();
  return app.vault.create(path, `---\n${frontmatter}\n---\n\n`);
}
