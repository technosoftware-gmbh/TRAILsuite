/**
 * Writing entries into a meal-plan note.
 *
 * Every edit goes through one primitive: read the note's entries, hand them to
 * a function, write back what it returns. That is a smaller surface than the
 * format it replaces, where adding, removing and editing were three different
 * pieces of line surgery, and the reason is the id. An entry now carries one,
 * so an edit is a lookup rather than a search for a line that says roughly the
 * right thing.
 *
 * A note still in the checklist shape is **converted as it is written**. The
 * entries come out of the body, the body's plan lines go, and anything
 * hand-written in it stays. A conversion that only ran as a migration would
 * leave a vault where saving an old week silently dropped it.
 */
import { App, TFile } from 'obsidian';
import { splitFrontmatterBlock, stampModified } from '@technosoftware/trail-core';
import { getOrCreateNote, readNoteOrEmpty } from '../../shared/vault-io';
import type { CULItrailSettings } from '../../settings/types';
import { bodyWithoutPlan, planEntriesFromBody } from './legacy-body';
import {
  buildPlanFrontmatter,
  hasPlanEntries,
  parsePlanNote,
  patchEntry,
  upsertEntry,
  withoutEntries,
  type EntryTarget,
  type PlanEntryContent,
} from './plan-note';
import { planProperties } from './read-plans';

/** Which week, and whose. Written on every save, since the note should say what it is. */
export interface PlanContext {
  week: string | null;
  personTitle: string | null;
}

/**
 * Returns the entries to write, or null to leave the note alone.
 *
 * Null rather than returning the list unchanged, so "nothing to do" is a
 * decision the mutator states rather than something the writer has to work out
 * by comparing two arrays.
 */
export type PlanMutation = (entries: PlanEntryContent[]) => PlanEntryContent[] | null;

/**
 * Applies one change to a plan note, creating it if it is not there.
 *
 * Reading the entries **inside** `processFrontMatter` rather than before it is
 * deliberate: the metadata cache updates a beat after a write, so two edits in
 * quick succession read through the cache would have the second one working
 * from what the note said before the first. The callback is handed the real
 * frontmatter.
 */
export async function editPlanNote(
  app: App,
  settings: CULItrailSettings,
  path: string,
  context: PlanContext,
  mutate: PlanMutation
): Promise<boolean> {
  const properties = planProperties(settings);

  // Read before the file is touched: a checklist note's entries are in its
  // body, and `processFrontMatter` only sees the block above it.
  const before = await readNoteOrEmpty(app, path);
  const body = splitFrontmatterBlock(before).body;

  const file: TFile = await getOrCreateNote(app, settings, path, '');

  let changed = false;
  let converted = false;

  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    const legacy = !hasPlanEntries(frontmatter, properties);
    const current = legacy
      ? planEntriesFromBody(body, settings)
      : parsePlanNote({ frontmatter, properties }).entries;

    const next = mutate(current);
    if (!next) return;

    Object.assign(
      frontmatter,
      buildPlanFrontmatter(properties, {
        week: context.week,
        personTitle: context.personTitle,
        entries: next,
      })
    );
    stampModified(frontmatter, settings);

    changed = true;
    converted = legacy;
  });

  // The second half of a conversion, and only then. The plan lines are now
  // properties, so leaving them in the body would be the same week written
  // twice, and the next read would see both.
  if (changed && converted) {
    const text = await readNoteOrEmpty(app, file.path);
    const kept = bodyWithoutPlan(body, settings);
    await app.vault.modify(
      file,
      kept ? `${splitFrontmatterBlock(text).header}\n${kept}\n` : splitFrontmatterBlock(text).header
    );
  }

  return changed;
}

/** Adds an entry to a note, or replaces the one already carrying its id. */
export function upsertPlanEntry(
  app: App,
  settings: CULItrailSettings,
  path: string,
  context: PlanContext,
  entry: PlanEntryContent
): Promise<boolean> {
  return editPlanNote(app, settings, path, context, (entries) => upsertEntry(entries, entry));
}

/** Changes some fields of one entry in a note and leaves the rest alone. */
export function patchPlanEntry(
  app: App,
  settings: CULItrailSettings,
  path: string,
  context: PlanContext,
  target: EntryTarget,
  changes: Partial<PlanEntryContent>
): Promise<boolean> {
  return editPlanNote(app, settings, path, context, (entries) =>
    patchEntry(entries, target, changes)
  );
}

/** Removes these entries. Silent about the ones the note does not hold. */
export function removePlanEntries(
  app: App,
  settings: CULItrailSettings,
  path: string,
  context: PlanContext,
  targets: readonly EntryTarget[]
): Promise<boolean> {
  return editPlanNote(app, settings, path, context, (entries) => withoutEntries(entries, targets));
}

/**
 * Rewrites the whole entry list.
 *
 * For the converter and for "clear this week", both of which know what the
 * note should end up saying rather than which entry to change.
 */
export function replacePlanEntries(
  app: App,
  settings: CULItrailSettings,
  path: string,
  context: PlanContext,
  entries: PlanEntryContent[]
): Promise<boolean> {
  return editPlanNote(app, settings, path, context, () => entries);
}
