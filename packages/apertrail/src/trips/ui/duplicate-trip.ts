/**
 * Copies a trip into a new one, so the copy can be cut down.
 *
 * The App-bound half. `trips/duplicate-trip.ts` decides what a copy IS -- a
 * plan rather than a record, with the dates and the status left off -- and this
 * one does the vault: the pictures, the note, and what is deliberately left
 * behind.
 *
 * **Three things are not copied, each for its own reason.**
 *
 * The **bookings** are not, and this is the one that would do damage. A booking
 * is a record of money committed: a second copy of one flight reads as a second
 * flight bought, and it would be counted as spent on a trip that has not
 * happened. The itinerary's own `cost` estimates DO come across with the
 * frontmatter, so the copy still says what it is planned to cost -- which is
 * the figure a copy wants anyway.
 *
 * The **exports** are not, because they are renderings. Everything in that
 * folder can be made again from the note, and a copy carrying the original's
 * document would carry the original's name inside it.
 *
 * The **note body's blocks** are, along with everything else in the body. The
 * overview is the part of a trip that takes longest to write and the part a
 * shorter version of the same journey keeps almost unchanged, so the body is
 * copied whole rather than rebuilt from `initialBody()`.
 */
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { NoteExistsError, splitFrontmatterBlock } from 'trail-core';
import { renderFrontmatterBlock } from 'trail-core/obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip } from '../../vault/types';
import { createNote, ensureParentFolders } from '../../shared/note-creation';
import { duplicateTripInput, ownedPictures } from '../duplicate-trip';
import { newTripFolder, ownedTripFolder } from '../trip-folder';
import { tripToInput } from '../write-trip';
import { buildTripFrontmatter } from '../trip-note';
import { tripPropertyNames } from '../../vault/read-entities';
import { formatDateTimeStamp } from 'trail-core';

/**
 * Copies the picture files the original keeps in its own folder.
 *
 * One at a time and tolerantly: a gallery entry whose file has gone missing is
 * a broken link in the original too, and refusing to duplicate a trip over one
 * would be the plugin holding a whole feature hostage to a stale path. The copy
 * ends up naming the same missing file, which is what the original does.
 *
 * Returns how many were copied, for the notice: "copied with 7 pictures" is the
 * one number that tells somebody the copy is complete.
 */
async function copyPictures(
  app: App,
  from: string,
  to: string,
  relatives: readonly string[]
): Promise<number> {
  let copied = 0;

  for (const relative of relatives) {
    const source = app.vault.getFileByPath(normalizePath(`${from}/${relative}`));
    if (!(source instanceof TFile)) continue;

    const target = normalizePath(`${to}/${relative}`);
    if (app.vault.getFileByPath(target)) continue;

    try {
      await ensureParentFolders(app, target);
      await app.vault.createBinary(target, await app.vault.readBinary(source));
      copied += 1;
    } catch {
      // Same reasoning as a missing file: one picture that cannot be written is
      // not a reason to abandon a copy of forty stops.
    }
  }

  return copied;
}

/**
 * The original's body, which is the overview and the two blocks.
 *
 * The frontmatter is split off and thrown away rather than edited: the copy's
 * is built from the input by the same writer every other trip goes through, so
 * there is exactly one place that knows what a trip's frontmatter looks like.
 */
async function bodyOf(app: App, file: TFile): Promise<string> {
  return splitFrontmatterBlock(await app.vault.read(file)).body;
}

/**
 * Writes the copy and returns it, or null when the name is taken.
 *
 * A name collision comes back as null rather than as a thrown error, because
 * the caller is a dialog that should say so and stay open rather than close on
 * a stack trace.
 */
export async function duplicateTripNote(
  app: App,
  settings: APERtrailSettings,
  trip: TravelTrip,
  title: string,
  now: Date = new Date()
): Promise<TFile | null> {
  const from = ownedTripFolder(trip.file.path, trip.file.basename);
  const to = newTripFolder(settings, title) || null;

  const original = tripToInput(trip);
  const input = duplicateTripInput(original, { from, to });

  const yaml = buildTripFrontmatter({
    properties: tripPropertyNames(settings),
    typeValue: 'trip',
    ...input,
    created: formatDateTimeStamp(now),
    modified: null,
  });

  try {
    const body = await bodyOf(app, trip.file);
    // The pictures first: a note created against files that are not there yet
    // renders empty until the vault catches up, and the copy is opened at once.
    const pictures =
      from && to ? await copyPictures(app, from, to, ownedPictures(original, from)) : 0;

    const file = await createNote(
      app,
      newTripFolder(settings, title),
      title,
      renderFrontmatterBlock(yaml) + body
    );

    new Notice(t('trip.duplicated', { title, pictures: String(pictures) }));
    return file;
  } catch (err) {
    if (err instanceof NoteExistsError) {
      new Notice(t('trip.duplicateExists', { title }));
      return null;
    }
    new Notice(err instanceof Error ? err.message : t('trip.duplicateFailed'));
    return null;
  }
}
