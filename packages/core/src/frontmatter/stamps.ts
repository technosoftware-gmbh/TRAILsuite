/**
 * The `created` and `modified` stamps every note these plugins write carries.
 *
 * Create-once, update-always. A note gets `created` when it is made and nothing
 * ever rewrites it; `modified` appears on the first real edit and is rewritten
 * on every one after. `created` is never backfilled onto a note that arrived
 * without one, because the plugin does not know when that note was made and a
 * guessed date reads as a fact.
 *
 * Both property names are settings, and a blank one means "do not write that
 * stamp" rather than a fallback to a literal: a vault that does not want the
 * property must be able to say so.
 *
 * The value is `formatDateTimeStamp`'s minute-precision local time. See
 * `dates/stamps.ts` for why the precision is load-bearing.
 *
 * The half of this that needs a vault, writing a stamp onto a file that already
 * exists, is not here: it needs a host and arrives with the vault adapter.
 *
 * App-free.
 */
import { formatDateTimeStamp } from '../dates/stamps.js';

/** The two settings a stamp needs, whatever the surrounding settings object looks like. */
export interface NoteStampProperties {
  createdProperty: string;
  modifiedProperty: string;
}

/**
 * The `created` entry to spread into a note's frontmatter as it is built, or an
 * empty record when the setting is blank.
 *
 * A record rather than a value, so the caller places it exactly where it belongs
 * without having to branch on the blank case. `frontmatterObject()` puts it
 * straight after `type`.
 */
export function createdEntry(
  properties: NoteStampProperties,
  now: Date = new Date()
): Record<string, string> {
  const key = properties.createdProperty.trim();
  return key ? { [key]: formatDateTimeStamp(now) } : {};
}

/**
 * Sets `modified` on a frontmatter object being edited.
 *
 * For folding into a write the caller is already making, which is always
 * preferable to a second pass over the same file: one write is one modify event,
 * and a save made of several passes has to produce exactly one `modified` value
 * rather than one per pass.
 *
 * Touches nothing but `modified`. It does not read, add or repair `created`,
 * which is what keeps an old hand-written note's missing origin date missing
 * rather than guessed.
 */
export function stampModified(
  frontmatter: Record<string, unknown>,
  properties: NoteStampProperties,
  now: Date = new Date()
): void {
  const key = properties.modifiedProperty.trim();
  if (key) frontmatter[key] = formatDateTimeStamp(now);
}
