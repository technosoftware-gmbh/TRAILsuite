/**
 * The icon a note carries for itself, and how to tell what kind of icon it is.
 *
 * Every row and card NODAtrail draws leads with an icon that says what the
 * thing IS -- a target for a goal, a receipt for a bill. That is right until
 * a list is forty receipts, at which point the icon has stopped telling you
 * anything and is only taking up the space where something useful could be.
 * A note that names its own icon gets to say so instead.
 *
 * `iconProperty` is not new. It has been a NODAtrail setting since PARA
 * shipped, and until now nothing rendered it: `para/parse.ts` read it into a
 * field no view ever asked for, and `para/write.ts` had a branch for it that
 * only `create.ts` could reach, where it was hard-coded to null. This is that
 * setting finally doing the thing its name claims, and the parse-and-write
 * half is gone: NODAtrail reads a note's icon and shows it, and never writes
 * one. Editing and archiving go through Obsidian's `processFrontMatter`,
 * which leaves properties the form does not show exactly as they were, so
 * there is nothing here that needs to carry an icon across a rewrite.
 *
 * **Two kinds of token, told apart by shape rather than by a list.** A Lucide
 * name goes to `setIcon()`; anything else is drawn as text, which is what
 * makes an emoji work. Matching the shape rather than checking membership of
 * the two thousand names Obsidian ships means this never has to be updated
 * when Lucide adds one, and a name that turns out not to exist renders as an
 * empty slot rather than as the literal string `ph-invoice`.
 */
import { App, TFile } from 'obsidian';

/**
 * Whether a token should go to `setIcon()` rather than be drawn as text.
 *
 * Lucide names are lower-case words joined by hyphens and nothing else. An
 * emoji fails on the first character; so does `Fork Knife`, and so does an
 * icon-pack token carrying a colon.
 */
export function isIconName(token: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(token);
}

/**
 * The token to draw, given whatever the frontmatter held.
 *
 * Pure, and separate from the vault read below so the awkward cases have a
 * test: a property that is a number, a list, or a string of spaces is not an
 * icon, and each falls back rather than reaching a renderer as `[object
 * Object]` or as an empty slot where the type icon should be.
 */
export function pickIcon(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const token = raw.trim();
  return token === '' ? fallback : token;
}

/**
 * The icon this note names, or the fallback the caller would have used.
 *
 * Read from the metadata cache rather than from the parsed record, and that
 * is deliberate: an icon is a property any note can carry, not a field of a
 * bill or of a goal. Threading it through `BillProperties`,
 * `PurchaseProperties`, `RecurringProperties` and the rest would be six
 * parallel changes in `trail-core` to say one thing, and every note type
 * added afterwards would have to remember to say it again.
 */
export function noteIcon(app: App, file: TFile, property: string, fallback: string): string {
  if (!property) return fallback;
  return pickIcon(app.metadataCache.getFileCache(file)?.frontmatter?.[property], fallback);
}
