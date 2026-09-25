/**
 * A plugin's section file, built from the records its readers return.
 *
 * App-free.
 */
import type { VaultFile } from '../vault/ports.js';
import { toInterchangeRecord } from './to-record.js';
import {
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
  type FamilyEntry,
  type LineEntry,
  type SectionFile,
} from './types.js';

/** A family's records as entries, in path order. Every record must carry the file it was read from. */
export function familyEntries<F extends VaultFile>(records: readonly { file: F }[]): FamilyEntry[] {
  return records
    .map((record) => ({ path: record.file.path, record: toInterchangeRecord(record) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * A line family's records as entries, in note then line order. Every record
 * carries the file it was read from and its zero-based line; the line stays in
 * the record as well as on the entry, where a reader expects it.
 */
export function lineEntries<F extends VaultFile>(
  records: readonly { file: F; line: number }[]
): LineEntry[] {
  return records
    .map((record) => ({
      path: record.file.path,
      line: record.line,
      record: toInterchangeRecord(record),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
}

/** The whole file a plugin writes. `lines` is left out when there are none. */
export function sectionFile(
  source: string,
  meta: { sourceVersion: string; generatedAt: string },
  families: Record<string, FamilyEntry[]>,
  lines?: Record<string, LineEntry[]>
): SectionFile {
  return {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    source,
    sourceVersion: meta.sourceVersion,
    generatedAt: meta.generatedAt,
    families,
    ...(lines && Object.keys(lines).length > 0 ? { lines } : {}),
  };
}
