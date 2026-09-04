/**
 * One cook record as the plain object that goes into frontmatter.
 *
 * Split out of the writer so the shape a note ends up carrying is testable
 * without an `App`: `processFrontMatter` is the only thing around it that needs
 * one, and the decisions worth pinning are all here.
 *
 * App-free.
 */
import type { EatingRecord } from './types';

export function eatingRecordEntry(record: EatingRecord): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    id: record.id,
    // Handed over as a plain string and left to Obsidian to serialize.
    // `quoteDateTime()` is for YAML this plugin writes as text; adding its
    // literal quotes here would produce a doubly quoted value. Whether Obsidian
    // quotes it or not, `readEatingRecords()` reads the property through a
    // Date-tolerant helper, so the clock time survives either way.
    date: record.date,
  };

  if (record.personLink) entry.personLink = record.personLink;
  if (record.rating !== undefined) entry.rating = record.rating;

  // Omitted when empty rather than written as `note: ""`, the same way
  // personLink is. A household that says everything it wants to say with the
  // star rating would otherwise carry one empty line per cook forever, and
  // `readEatingRecords()` reads an absent note and an empty one identically. The
  // writer replaces the whole array on every write, so clearing a note removes
  // the key rather than leaving the old value behind.
  if (record.note) entry.note = record.note;

  return entry;
}
