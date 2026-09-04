/**
 * Recording a cook.
 *
 * **The plan note is the store.** This file used to be the other way round –
 * frontmatter was the source of truth and the plans held the same events
 * again – and the August 2026 migration reversed that for the data without
 * reversing it for the writer, which is how the drift the migration cleaned up
 * started accumulating the same day. A cook is written to the plan line first
 * and nothing here writes a `eatingHistory` property any more.
 *
 * An existing property is **left exactly as it is** rather than deleted.
 * Removing a store from every meal in a vault is a migration, done once with
 * a backup and a verification pass, not something a cook should do on the way
 * past. It is read behind the plans so a vault that has not been migrated
 * still works, and it will simply stop growing.
 *
 * `lastEaten` and `eatenCount` are still written here, which is the one place
 * CULItrail deliberately breaks its own derive-at-read-time rule. They are read
 * by the gallery's sort, its never-eaten filter and the dashboard, all of
 * which see frontmatter alone, so leaving them underived would make a cook
 * invisible everywhere except the view it was recorded from. They are now
 * derived from the plans, which is what keeps them true when the property they
 * used to be counted from is empty.
 */
import { App, TFile } from 'obsidian';
import { stampModified } from 'trail-core';
import { readNoteOrEmpty } from '../../shared/vault-io';
import { readEatingEventsFor } from '../../planning/meal-plan/eating-events';
import { personTitleOf, recordEatingInPlan } from '../../planning/meal-plan/record-eating';
import type { CULItrailSettings } from '../../settings/types';
import { stripFrontmatter } from '../parser/body-sections';
import { newEatingRecordId, readEatingRecords } from './read-records';
import { applyEatingSection, readSectionPhotos } from './section-merge';
import { dayOf } from './render-line';
import type { EatingEntry } from '../types';
import type { EatingRecord } from './types';

/**
 * The summary fields, derived from every cook the meal has.
 *
 * `records` is the merged log – the plans, plus whatever an unmigrated vault
 * still keeps in its property – so the count is of cooks rather than of cooks
 * in one particular place.
 */
function writeFrontmatter(
  app: App,
  file: TFile,
  settings: CULItrailSettings,
  records: EatingRecord[]
): Promise<void> {
  return app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    // The property is not written. See the note at the top of this file: the
    // plan line is the store, and an existing property is left untouched
    // rather than either updated or deleted.

    // By maximum rather than by taking the first, so the derivation does not
    // depend on the caller having sorted. Truncated to the day: everything that
    // consumes lastEaten treats it as a plain date.
    const latest = records.reduce<string | null>(
      (max, record) => (max === null || record.date > max ? record.date : max),
      null
    );
    if (latest) frontmatter[settings.lastEatenProperty] = dayOf(latest);
    else delete frontmatter[settings.lastEatenProperty];

    // Deleted rather than written as 0, so a meal whose last cook was removed
    // reads the same as one nobody has ever made.
    if (records.length > 0) frontmatter[settings.eatenCountProperty] = records.length;
    else delete frontmatter[settings.eatenCountProperty];

    // Recording a cook is one write even though it touches the frontmatter and
    // then the body, so the stamp goes in this pass and the `vault.process`
    // below adds none of its own.
    stampModified(frontmatter, settings);
  });
}

/**
 * Writes the records and brings the body section into line with them.
 *
 * Returns what was written, so a caller can render immediately.
 * `processFrontMatter` resolves before `metadataCache` has caught up, and a
 * modal that re-read the cache on the next tick would briefly show the log it
 * had just added to as empty.
 */
async function syncRecords(
  app: App,
  file: TFile,
  settings: CULItrailSettings,
  records: EatingRecord[]
): Promise<EatingRecord[]> {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  await writeFrontmatter(app, file, settings, sorted);

  if (settings.eatingHistoryHeading.trim()) {
    // The photos already in the section are read and handed back to the
    // renderer. **Nothing adds one any more** – see `addEatingRecord` – but a
    // vault that still keeps a body log has pictures in it, and rewriting a
    // line without carrying its picture across would delete them.
    const existingBody = stripFrontmatter(await readNoteOrEmpty(app, file.path));
    const photos = readSectionPhotos(existingBody, settings.eatingHistoryHeading);

    // Only the body is rewritten, and it is re-read inside `process` rather
    // than carried over from above: `processFrontMatter` has already replaced
    // the frontmatter block, and using the stale text would put the old one back.
    await app.vault.process(file, (contents) => {
      const body = stripFrontmatter(contents);
      const header = contents.slice(0, contents.length - body.length);
      return header + applyEatingSection(body, settings.eatingHistoryHeading, sorted, photos);
    });
  }

  return sorted;
}

/**
 * The plans' view of this meal's history, in the writer's shape.
 *
 * A plan line carries the day and, when the cook stated one, a clock time; the
 * two are put back together because a record's `date` orders two cooks within
 * one day and a bare day cannot.
 */
function recordsFromPlans(events: EatingEntry[]): EatingRecord[] {
  return events.map((event) => ({
    // A line written before ids were put on them has none. A generated one is
    // stable for this pass only, which is enough for the merge below and is
    // why nothing persists it.
    id: event.id ?? newEatingRecordId(),
    date: event.time ? `${event.date}T${event.time}` : event.date,
    personLink: event.person ? `[[${event.person}]]` : undefined,
    rating: event.rating ?? undefined,
    note: event.note ?? '',
  }));
}

/**
 * Every cook this meal has, from both stores, with each counted once.
 *
 * The plans first and the property behind them. In a migrated vault the second
 * is empty; in one that has not been migrated it is the whole log, and this is
 * what lets the same code serve both. Matched by id, so a cook recorded before
 * the plan line existed and then re-recorded is one cook.
 */
async function mergedRecords(
  app: App,
  file: TFile,
  settings: CULItrailSettings
): Promise<EatingRecord[]> {
  const fromPlans = recordsFromPlans(await readEatingEventsFor(app, settings, file.path));
  const seen = new Set(fromPlans.map((record) => record.id));

  return [
    ...fromPlans,
    ...readEatingRecords(app, file, settings).filter((record) => !seen.has(record.id)),
  ];
}

/**
 * Records a cook.
 *
 * The plan line is written first and everything else follows from it: the
 * summary fields are counted off the merged log, so they stay right whether
 * the vault keeps its history in the plans, in the property, or is midway
 * between the two.
 *
 * A failure to write the plan line is reported and not rethrown. An
 * unresolvable person or an unreadable date must not turn a recorded cook into
 * an error dialog over a meal that was eaten – but it does mean the summary
 * fields will not count it, which is the honest outcome: the cook did not get
 * written anywhere that counts.
 */
export async function addEatingRecord(
  app: App,
  file: TFile,
  settings: CULItrailSettings,
  entry: {
    date: string;
    note: string;
    personLink?: string;
    rating?: number;
  }
): Promise<EatingRecord[]> {
  const record: EatingRecord = {
    id: newEatingRecordId(),
    date: entry.date,
    personLink: entry.personLink,
    rating: entry.rating,
    note: entry.note.trim(),
  };

  try {
    await recordEatingInPlan(app, settings, {
      mealTitle: file.basename,
      date: record.date,
      person: personTitleOf(record.personLink),
      rating: record.rating,
      note: record.note,
      id: record.id,
    });
  } catch (error) {
    console.error('CULItrail: recording the cook in the meal plan failed', error);
  }

  return syncRecords(app, file, settings, await mergedRecords(app, file, settings));
}
