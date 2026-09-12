/**
 * The related-trips fence a note carries, and making sure a note has one.
 *
 * The block answers "when was I here" from inside the note, which is why
 * every note that can answer it is created with one.
 *
 * **A Country and a State are among them, and were not.** The reason recorded
 * against leaving them out was that a trip's stops point at cities and places,
 * never at a country or state, so the block would always be empty there. That
 * was true of the block as first written and stopped being true when it
 * learned to roll a region up: a State asks the question of the cities under
 * it, and a Country asks it of its states' cities and of its own name, which a
 * trip carries in frontmatter. The prospect had already grown the same section
 * for the same six notes, so the two surfaces disagreed about a country for no
 * reason either of them recorded.
 */
import { App, TFile } from 'obsidian';
import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../trips/related-trips-block-lang';
import { APERtrailSettings } from '../settings/types';
import { touchModified } from './note-stamps';

/** The body a new note starts with, so it answers the question from the moment it exists. */
export function relatedTripsBody(): string {
  return `\n\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}\n\`\`\`\n`;
}

/**
 * Appends the block to a note that has none, and says whether it did.
 *
 * For the notes that predate this: a country written last year has no fence,
 * so its Edit and Prospekt buttons would never appear however the plugin is
 * changed. Adding it when the note is saved anyway is what reaches those
 * without a migration that rewrites a vault nobody asked it to touch.
 *
 * Same shape and same reasoning as `ensureItineraryBlock()`: the note is read
 * first and nothing is written when the fence is already there, because a
 * second copy of a block would render twice and because `modified` must not
 * move on a save that changed no text.
 */
export async function ensureRelatedTripsBlock(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  now: Date = new Date()
): Promise<boolean> {
  const existing = await app.vault.read(file);
  if (existing.includes(`\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}`)) return false;

  await app.vault.append(file, relatedTripsBody());
  await touchModified(app, settings, file, now);
  return true;
}
