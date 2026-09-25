/**
 * A plugin's in-memory record, made safe to write as JSON.
 *
 * App-free.
 */
import type { InterchangeRef } from './types.js';

/** True for an object that stands for a note: it carries the host's file, with a path. */
function noteBacked(value: object): value is { file: { path: string } } {
  const file = (value as { file?: unknown }).file;
  return (
    typeof file === 'object' &&
    file !== null &&
    typeof (file as { path?: unknown }).path === 'string'
  );
}

function plain(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => plain(item, depth + 1) ?? null);
  if (value instanceof Map) return plain(Object.fromEntries(value), depth);
  if (value instanceof Set) return plain([...value], depth);

  const object: object = value;
  // Another note's record, reached through a pointer: its path, not its body.
  // This is also what ends every cycle, since the record at the top is the only
  // note-backed object whose fields are walked.
  if (depth > 0 && noteBacked(object)) return { ref: object.file.path } satisfies InterchangeRef;

  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(object)) {
    // The record's own file is the entry's `path`; the host object behind it
    // (a TFile carries its vault and parent folder) is not data.
    if (depth === 0 && key === 'file') continue;
    const converted = plain(field, depth + 1);
    if (converted !== undefined) out[key] = converted;
  }
  return out;
}

/**
 * A record as plain JSON data.
 *
 * - A nested object that carries a `file` with a path is another note's record
 *   and becomes `{ ref: path }`, so the travel board's cycles leave as a tree.
 * - The top-level `file` is dropped: the entry carries the path beside it.
 * - Maps become objects, Sets arrays, Dates ISO strings, and `undefined`, a
 *   non-finite number and an invalid date all become `null` rather than
 *   vanishing, so a reader can tell "absent" from "the field does not exist".
 */
export function toInterchangeRecord(record: object): Record<string, unknown> {
  return plain(record, 0) as Record<string, unknown>;
}
