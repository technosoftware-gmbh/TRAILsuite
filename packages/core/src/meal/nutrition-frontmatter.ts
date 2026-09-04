/**
 * A nutrient list as frontmatter carries it: a sequence of maps, read back
 * tolerantly and built back plainly.
 *
 * **The sub-key names arrive as arguments.** What a property is called is a
 * vault's decision and lives in a consumer's settings, so this package takes the
 * three names rather than knowing them. That is the same split as the reheating
 * field names, and it is what lets one vault write `nutrient`/`unit`/`value`
 * while another writes something in its own language without either of them
 * forking the reader.
 *
 * **Nothing here emits YAML.** The writer returns plain records and the host
 * serializes them, because the host also owns the other direction: Obsidian's
 * `processFrontMatter()` re-serialises a whole block with its own writer, and a
 * block written with a different one changes shape the first time anything else
 * edits it. See `frontmatter/block.ts`.
 *
 * **Each sub-key is omitted individually when absent**, following the `stops`
 * list in APERtrail's trip notes. A row with a name and no figure serializes as
 * a one-key entry rather than as a name beside two nulls, because a person opens
 * this file and reads it.
 */
import { findValue, readNumberLike, readString } from '../frontmatter/read.js';
import { matchNutrient, type NutrientEntry } from './nutrients.js';

/** The three sub-key names, as a consumer's settings spell them. */
export interface NutrientFieldNames {
  name: string;
  unit: string;
  value: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * The entries a frontmatter value holds.
 *
 * Tolerant in three specific ways, each of which is a shape a real note reaches:
 * a single map instead of a list, because a property editor writes one that way
 * when there is one row; a figure stored as `"2.9"`, because a property declared
 * as text keeps it that way; and a row with no unit, because somebody deleted it.
 *
 * **A missing or unreadable figure is null, never zero.** Zero is a measurement:
 * it says this meal contains no sugar. Null says nobody has measured it. A
 * reader that turns the second into the first invents a fact, and the fact then
 * gets averaged, charted and believed.
 *
 * A row with no usable name is dropped, because the nutrient **is** the row and
 * an entry carrying only a number says nothing that could be shown or summed.
 *
 * Names are resolved through `matchNutrient`, so a note that wrote `Fett` reads
 * back as `fat`. The German spelling is not preserved: the id is the note
 * format's word and the displayed word comes from a consumer's locale files, so
 * keeping the typed spelling would mean a vault's own language setting stopped
 * deciding what it sees. A name nothing recognises keeps its spelling exactly.
 */
export function readNutrientList(value: unknown, fields: NutrientFieldNames): NutrientEntry[] {
  if (value === undefined || value === null) return [];

  const rows = Array.isArray(value) ? (value as unknown[]) : [value];
  const entries: NutrientEntry[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;

    const name = readString(findValue(record, fields.name));
    if (name === null) continue;

    entries.push({
      name: matchNutrient(name).id,
      unit: readString(findValue(record, fields.unit)) ?? '',
      value: readNumberLike(findValue(record, fields.value)),
    });
  }

  return entries;
}

/**
 * The plain records that go into the frontmatter object.
 *
 * A row whose name is blank is left out for the same reason the reader drops
 * one: it would come back as nothing.
 */
export function nutrientListValue(
  entries: readonly NutrientEntry[],
  fields: NutrientFieldNames
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  for (const entry of entries) {
    const name = entry.name.trim();
    if (name === '') continue;

    const record: Record<string, unknown> = { [fields.name]: name };

    const unit = entry.unit.trim();
    if (unit !== '') record[fields.unit] = unit;
    // Written when it is a number, including zero, and left out when it is null.
    // The distinction is the whole point of the reader's null rule, and it would
    // be lost here by an `if (entry.value)`.
    if (entry.value !== null) record[fields.value] = entry.value;

    records.push(record);
  }

  return records;
}
