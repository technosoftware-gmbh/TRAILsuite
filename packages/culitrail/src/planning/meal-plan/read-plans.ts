/**
 * Reading the meal-plan notes.
 *
 * The one part of this area that needs an `App`. Everything in `plan-note.ts`
 * is app-free and tested without a vault, which is the same split the orders
 * and deliveries areas use.
 *
 * Two shapes are read. A note carrying an `entries:` list is read from its
 * frontmatter; one that does not is read from its checklist body, so a vault
 * that has not been converted still shows its weeks. **Nothing writes the
 * second shape.**
 *
 * Nothing is cached: every view re-reads, so what is on screen can never drift
 * from what is on disk.
 */
import type { App, TFile } from 'obsidian';
import { readPersons } from '../../crm/read-crm';
import { personFileToken } from '../../shared/note-path';
import { readNoteOrEmpty } from '../../shared/vault-io';
import type { CULItrailSettings } from '../../settings/types';
import { readNotesOfType } from '../../vault/read-notes';
import { planEntriesFromBody } from './legacy-body';
import { hasPlanEntries, parsePlanNote, planProperties, type PlanNoteContent } from './plan-note';

export { planProperties } from './plan-note';

export interface PlanRecord extends PlanNoteContent {
  file: TFile;
  /** True when the note is still a checklist and has not been converted. */
  legacy: boolean;
}

/** `2026-W33` out of a plan note's path, wherever in it the template put it. */
export function weekOfPath(path: string): string | null {
  const match = /(\d{4})-W(\d{2})/.exec(path);
  return match ? `${match[1]}-W${match[2]}` : null;
}

/**
 * Person file token to Person note title.
 *
 * Built from the configured People rather than read off the filename, because
 * the filename holds `StefanMuster` and nothing in it says where the space
 * went. Only a fallback now: a converted note states its person outright.
 */
function personTitles(app: App, settings: CULItrailSettings): Map<string, string> {
  const byToken = new Map<string, string>();
  for (const person of readPersons(app, settings)) {
    byToken.set(personFileToken(person.title), person.title);
  }
  return byToken;
}

function personOfPath(path: string, byToken: Map<string, string>): string | null {
  for (const [token, title] of byToken) {
    if (token && path.includes(token)) return title;
  }
  return null;
}

/**
 * The folder the plan notes live in, for a vault whose notes predate the type
 * value.
 *
 * The static head of the path template, which is everything before the first
 * `{token}`. Used only by `readAllPlanNotes` below, and only because a note
 * written before this release carries no `type:` for `readNotesOfType` to
 * match on.
 */
export function mealPlanFolder(settings: CULItrailSettings): string {
  const template = settings.mealPlanPath;
  const head = template.slice(0, template.indexOf('{') === -1 ? undefined : template.indexOf('{'));
  return head.slice(0, head.lastIndexOf('/') + 1);
}

/**
 * Every file that could be a plan note.
 *
 * Folder-and-type for the converted ones, plus everything under the plans
 * folder for the rest. **The union, not one or the other**, and that is the
 * whole reason this function is not a one-line call to `readNotesOfType`: a
 * vault mid-conversion holds both, and a reader that saw only the typed ones
 * would report a history that had lost every week nobody had touched yet.
 */
function planFiles(app: App, settings: CULItrailSettings): TFile[] {
  const typed = readNotesOfType(app, settings, 'mealPlan').map((note) => note.file);
  const seen = new Set(typed.map((file) => file.path));

  const folder = mealPlanFolder(settings);
  const untyped = folder
    ? app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith(folder) && !seen.has(file.path))
    : [];

  return [...typed, ...untyped];
}

/** One plan note, whichever shape it is in. */
export async function readPlanNote(
  app: App,
  settings: CULItrailSettings,
  file: TFile,
  byToken?: Map<string, string>
): Promise<PlanRecord> {
  const properties = planProperties(settings);
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const tokens = byToken ?? personTitles(app, settings);

  const fromPath = {
    week: weekOfPath(file.path),
    personTitle: personOfPath(file.path, tokens),
  };

  if (hasPlanEntries(frontmatter, properties)) {
    return { file, legacy: false, ...parsePlanNote({ frontmatter, properties, fromPath }) };
  }

  const body = await readNoteOrEmpty(app, file.path);
  return {
    file,
    legacy: true,
    week: fromPath.week,
    personTitle: fromPath.personTitle,
    entries: planEntriesFromBody(body, settings),
  };
}

/** Every plan note in the vault, newest week first. */
export async function readAllPlanNotes(
  app: App,
  settings: CULItrailSettings
): Promise<PlanRecord[]> {
  const byToken = personTitles(app, settings);

  const records: PlanRecord[] = [];
  for (const file of planFiles(app, settings)) {
    records.push(await readPlanNote(app, settings, file, byToken));
  }

  // A note whose week cannot be read sorts last rather than first: it is not
  // the most recent week simply because it says nothing.
  return records.sort((a, b) => (b.week ?? '').localeCompare(a.week ?? ''));
}

/** One week for one person, or null when the settings give no path for it. */
export async function readPlanFor(
  app: App,
  settings: CULItrailSettings,
  path: string
): Promise<PlanRecord | null> {
  const file = app.vault.getFileByPath(path);
  return file ? readPlanNote(app, settings, file) : null;
}
