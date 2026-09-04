/**
 * Turning one cook record into the Markdown line the note body carries.
 *
 * The line is written in the shape `parser/eating-history.ts` reads back: a bare
 * ISO day first, then the rating as a Dataview inline field, then the prose.
 * That matters more than it looks. The log a plugin writes and the log its own
 * parser understands have to be the same log, or the body section becomes text
 * nothing can see, which is exactly the state a vault ends up in otherwise.
 *
 * The hidden id marker is what makes an edit possible: a Markdown bullet has
 * nowhere else to carry an identity, and an HTML comment is invisible both in
 * reading view and to the parser, which strips comments out of the note text.
 *
 * App-free.
 */
import type { EatingRecord } from './types';

/** How wide a cook photo is embedded, so a log of ten does not become ten full-width pictures. */
const PHOTO_WIDTH = 200;

/**
 * The separator between the parts of a line.
 *
 * A middle dot rather than a dash: the plugin ships no em dashes in text a
 * reader sees, and a hyphen next to a date reads as a range.
 */
const SEPARATOR = ' · ';

export function eatingIdMarker(id: string): string {
  return `<!--culi-id:${id}-->`;
}

/** The `HH:mm` half of a record's datetime, or '' when it carries only a day. */
export function clockTimeOf(date: string): string {
  return /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(date)?.[1] ?? '';
}

/** The `YYYY-MM-DD` half. What the parser keys on, and what `lastEaten` is derived from. */
export function dayOf(date: string): string {
  return date.slice(0, 10);
}

/**
 * One record as a list item.
 *
 * The time and the person go in the line even though frontmatter already holds
 * them, because the point of the body section is to be readable as Markdown.
 * They are not read back: the merge recognises this line and its frontmatter
 * record by id, so the note field stays just the note.
 */
export function renderEatingLine(record: EatingRecord, photo: string | null): string[] {
  const parts: string[] = [];

  const time = clockTimeOf(record.date);
  if (time) parts.push(time);

  // The wikilink is unwrapped to the bare title. A second real link to the same
  // person on every cook would fill their backlinks with a hundred references
  // that say nothing the frontmatter one does not.
  if (record.personLink) {
    parts.push(
      record.personLink
        .replace(/^\[\[|\]\]$/g, '')
        .split('|')
        .pop() ?? ''
    );
  }

  if (record.note.trim()) parts.push(record.note.trim());

  const rating = record.rating !== undefined ? ` [rating:: ${record.rating}]` : '';
  const detail = parts.length > 0 ? ` ${parts.join(SEPARATOR)}` : '';

  const lines = [`- ${dayOf(record.date)}${rating}${detail} ${eatingIdMarker(record.id)}`];
  if (photo) lines.push(`  ![[${photo}|${PHOTO_WIDTH}]]`);
  return lines;
}
