/**
 * Updating the eating-history section of a note body in place.
 *
 * This is a merge, not a regeneration, and that is the whole point of the file.
 * The obvious implementation rewrites the section from the records every time,
 * which keeps the two halves in step at the cost of destroying anything a
 * person typed in there. CULItrail's rule is that hand-editing a note is always
 * safe, so instead:
 *
 *   - a line carrying an id that is still in the records is rewritten in place,
 *     so an edit lands without moving anything around it
 *   - a line carrying an id that is gone is dropped, which is how a delete
 *     reaches the body
 *   - a line carrying no id is left exactly where it is, because a person wrote
 *     it and nothing here knows better
 *   - records with no line yet are appended
 *
 * App-free, so the whole merge is testable without a vault.
 */
import { renderEatingLine } from './render-line';
import type { EatingRecord } from './types';

const HEADING = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;
const ID_MARKER = /<!--\s*(?:culi|cul|rb)-id:([^>]*?)\s*-->/i;

/** A photo embed continuation line, which belongs to the entry above it. */
const PHOTO_LINE = /^\s+!\[\[[^\]]+\]\]\s*$/;

/**
 * The banner the inherited writer stamped on the section.
 *
 * Recognised only to remove it. It claimed the section would be overwritten,
 * which is no longer true, and it named a plugin that is not this one.
 */
const LEGACY_NOTICE = /^<!--\s*This section managed by the Recipe Box plugin\..*?-->\s*$/i;

export interface SectionBounds {
  /** Index of the heading line, or -1 when the note has no such section. */
  headingIndex: number;
  /** First line after the section. */
  endIndex: number;
  level: number;
}

export function findSection(lines: string[], headingName: string): SectionBounds {
  const target = headingName.trim().toLowerCase();
  if (!target) return { headingIndex: -1, endIndex: lines.length, level: 0 };

  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]);
    if (!match || match[2].trim().toLowerCase() !== target) continue;

    const level = match[1].length;
    let end = i + 1;
    // Ends at the next heading of the same level or shallower, so a `###`
    // somebody nested inside the log stays part of it.
    while (end < lines.length) {
      const next = HEADING.exec(lines[end]);
      if (next && next[1].length <= level) break;
      end++;
    }
    return { headingIndex: i, endIndex: end, level };
  }

  return { headingIndex: -1, endIndex: lines.length, level: 0 };
}

function idOf(line: string): string | null {
  return ID_MARKER.exec(line)?.[1]?.trim() || null;
}

/** The photo each existing entry carries, keyed by id, so a rewrite does not drop it. */
export function readSectionPhotos(body: string, headingName: string): Map<string, string> {
  const lines = body.split('\n');
  const { headingIndex, endIndex } = findSection(lines, headingName);
  const photos = new Map<string, string>();
  if (headingIndex < 0) return photos;

  let current: string | null = null;
  for (let i = headingIndex + 1; i < endIndex; i++) {
    const id = idOf(lines[i]);
    if (id) {
      current = id;
      continue;
    }
    if (current && PHOTO_LINE.test(lines[i])) {
      const target = /!\[\[([^\]|]+)/.exec(lines[i])?.[1];
      if (target) photos.set(current, target);
      current = null;
    }
  }
  return photos;
}

/**
 * The section's lines, rebuilt from the records while preserving anything the
 * merge does not own.
 */
function mergeLines(
  existing: string[],
  records: EatingRecord[],
  photos: Map<string, string>
): string[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const written = new Set<string>();
  const out: string[] = [];

  for (let i = 0; i < existing.length; i++) {
    const line = existing[i];

    if (LEGACY_NOTICE.test(line.trim())) continue;

    const id = idOf(line);
    if (!id) {
      // Not ours. Kept verbatim, including a photo line whose entry has gone,
      // since deleting a picture somebody added is not this function's call.
      out.push(line);
      continue;
    }

    // The entry's own photo line, if any, is consumed here and re-emitted by
    // the renderer, so a photo cannot end up orphaned above a rewritten entry.
    if (i + 1 < existing.length && PHOTO_LINE.test(existing[i + 1])) i++;

    const record = byId.get(id);
    if (!record) continue;

    out.push(...renderEatingLine(record, photos.get(id) ?? null));
    written.add(id);
  }

  // Newest first, matching how the log is displayed, so a reader opening the
  // raw note sees the same order as the modal.
  const appended = records
    .filter((record) => !written.has(record.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const blanks = out.length > 0 && out[out.length - 1].trim() === '' ? out.pop() : null;
  for (const record of appended)
    out.push(...renderEatingLine(record, photos.get(record.id) ?? null));
  if (blanks !== null && blanks !== undefined) out.push(blanks);

  return out;
}

/**
 * The note body with its eating-history section updated.
 *
 * A note with no such section gets one appended. A note whose section would end
 * up empty keeps the heading: it is a section the reader asked for, and
 * removing it would make the heading flicker in and out as the last entry is
 * deleted and re-added.
 */
export function applyEatingSection(
  body: string,
  headingName: string,
  records: EatingRecord[],
  photos: Map<string, string>
): string {
  const heading = headingName.trim();
  if (!heading) return body;

  const lines = body.split('\n');
  const { headingIndex, endIndex } = findSection(lines, heading);

  if (headingIndex < 0) {
    const rendered = records
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((record) => renderEatingLine(record, photos.get(record.id) ?? null));
    if (rendered.length === 0) return body;
    return `${body.trimEnd()}\n\n## ${heading}\n${rendered.join('\n')}\n`;
  }

  // The heading line is copied across untouched rather than rewritten, so a
  // vault that writes `# Eating History` keeps its level and the section does not
  // move relative to the headings around it.
  const merged = mergeLines(lines.slice(headingIndex + 1, endIndex), records, photos);
  return [...lines.slice(0, headingIndex + 1), ...merged, ...lines.slice(endIndex)].join('\n');
}
