/**
 * Reading the persisted eating-history records out of frontmatter.
 *
 * Separate from `parser/eating-history.ts`, which reads the same property into
 * the flat display shape and also reads the body log. This one is the writer's
 * view of the data: ids and clock times intact, nothing merged in, so an edit
 * round-trips exactly what was there.
 */
import { App, TFile } from 'obsidian';
import { readDateTimeLike, readNumberLike, readString } from 'trail-core';
import { frontmatterOf } from '../../shared/vault-scan';
import type { CULItrailSettings } from '../../settings/types';
import type { EatingRecord } from './types';

/**
 * A new record id.
 *
 * Random rather than sequential, for the same reason meal-plan entry ids are:
 * two devices can add a cook to the same meal without having seen each
 * other, and a counter would hand both the same number.
 */
export function newEatingRecordId(): string {
  return `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A rating clamped to the 0 to 5 range, or undefined when the record states none. */
function readRating(value: unknown): number | undefined {
  const rating = readNumberLike(value);
  if (rating === null) return undefined;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

/**
 * The records the note holds, in stored order.
 *
 * A record with no readable date is dropped: it cannot be ordered, rendered or
 * matched, and keeping it would mean every later write copied it forward. A
 * record with no id is given one, so a log written by hand or by an older
 * version becomes addressable the first time anything is written.
 */
export function readEatingRecords(
  app: App,
  file: TFile,
  settings: CULItrailSettings
): EatingRecord[] {
  const frontmatter = frontmatterOf(app, file) ?? {};
  const raw = frontmatter[settings.eatingHistoryFrontmatterProperty];
  if (!Array.isArray(raw)) return [];

  const records: EatingRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || item instanceof Date) continue;
    const record = item as Record<string, unknown>;

    // Read as a datetime, not a string. Obsidian decides for itself whether to
    // quote a value it serializes, so `date` can come back as a native Date;
    // `readString` would return null for one and the record would be dropped,
    // which is the whole log lost the second time anything is written.
    const date = readDateTimeLike(record.date);
    if (!date) continue;

    records.push({
      id: readString(record.id) ?? newEatingRecordId(),
      date,
      personLink: readString(record.personLink) ?? undefined,
      rating: readRating(record.rating),
      note: readString(record.note) ?? '',
    });
  }
  return records;
}
