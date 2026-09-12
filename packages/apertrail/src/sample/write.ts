/**
 * Writing a planned sample vault: the notes that are not there yet, and the
 * one block that gets appended to the notes that are.
 *
 * **It refuses before it writes anything.** A plan the core says is not
 * writable throws, and no note is created: half a sample vault is worse than
 * none, because the notes reference each other and a partial seed reads as a
 * broken plugin rather than as a skipped folder.
 *
 * Each note goes through the same three calls every creator in this plugin
 * makes -- `frontmatterObject()` with the created stamp, `renderFrontmatterBlock()`,
 * `createNote()` -- so a sample note's frontmatter is ordered exactly like a
 * note made from a dialog, and the host owns the serialisation in both
 * directions. The typed per-entity creators are deliberately not used: each
 * collects the handful of fields its own dialog offers, and a sample note that
 * had to fit through one of them would lose most of what it is here to show.
 *
 * **A failure is recorded rather than raised.** Once the first note is on disk
 * the vault is already half seeded, and aborting there leaves exactly the state
 * the refusal above exists to prevent. Carrying on and naming what failed is
 * the honest end of a run that went wrong in the middle.
 */
import { App, TFile } from 'obsidian';
import {
  createdEntry,
  frontmatterObject,
  normalizePath,
  sampleVaultWritable,
  sanitizeTitle,
  type SampleNote,
  type SampleVaultPlan,
} from '@technosoftware/trail-core';
import { renderFrontmatterBlock } from '@technosoftware/trail-core/obsidian';
import { APERtrailSettings } from '../settings/types';
import { createNote } from '../shared/note-creation';
import { touchModified } from '../vault/note-stamps';

export interface SampleWriteResult {
  created: number;
  augmented: number;
  /** The titles that did not make it, in the order they were attempted. */
  failed: string[];
}

/**
 * The plan cannot be written and nothing was attempted.
 *
 * Typed and carrying a developer's sentence rather than a translated one: the
 * modal names the occupied folders and the unconfigured settings itself, in the
 * user's language, and disables its own button long before this can be reached.
 * This is the guard for a caller that skipped the preview.
 */
export class SampleVaultRefusedError extends Error {
  constructor() {
    super(
      'The sample vault plan is not writable: a folder is occupied, unconfigured, or there is nothing left to do.'
    );
    this.name = 'SampleVaultRefusedError';
  }
}

/** One note's full text: the type property, the created stamp, everything else, then the body. */
function noteContent(settings: APERtrailSettings, note: SampleNote, now: Date): string {
  const typeProperty = settings.typePropertyName.trim() || 'type';
  return (
    renderFrontmatterBlock(
      frontmatterObject(typeProperty, note.typeValue, createdEntry(settings, now), note.properties)
    ) + note.body
  );
}

/**
 * The note a planned entry points at, or null.
 *
 * By path, since the plan already knows the folder and the title, and by
 * `getFileByPath` rather than by walking the vault: an augment target is a note
 * this run has just decided is exactly where it expects it.
 */
function fileFor(app: App, note: SampleNote): TFile | null {
  return app.vault.getFileByPath(normalizePath(`${note.folder}/${sanitizeTitle(note.title)}.md`));
}

/**
 * Appends this plugin's own block to a note somebody else's plugin wrote.
 *
 * The one edit a seed makes to a note it did not create, which is why it stamps
 * `modified`: the note genuinely was. Same shape as `ensureItineraryBlock()`,
 * including the second pass for the stamp, because an append is a body write
 * and `modified` lives in the frontmatter.
 */
async function appendBlock(
  app: App,
  settings: APERtrailSettings,
  note: SampleNote,
  now: Date
): Promise<void> {
  // Both guards are unreachable through the planner, which only marks a note
  // for augmenting when it declares a block and a note of that title is in
  // that folder. They are here so a caller that assembled a plan by hand fails
  // loudly rather than appending an empty fence to nothing.
  const language = note.ensureBlock;
  if (!language) throw new Error(`${note.title} declares no block to append.`);

  const file = fileFor(app, note);
  if (!file) throw new Error(`No note at ${note.folder}/${note.title}.md to append to.`);

  await app.vault.append(file, `\n\`\`\`${language}\n\`\`\`\n`);
  await touchModified(app, settings, file, now);
}

export async function writeSampleVault(
  app: App,
  settings: APERtrailSettings,
  plan: SampleVaultPlan,
  now: Date
): Promise<SampleWriteResult> {
  if (!sampleVaultWritable(plan)) throw new SampleVaultRefusedError();

  const result: SampleWriteResult = { created: 0, augmented: 0, failed: [] };

  for (const entry of plan.notes) {
    try {
      if (entry.status === 'write') {
        await createNote(
          app,
          entry.note.folder,
          entry.note.title,
          noteContent(settings, entry.note, now)
        );
        result.created++;
      } else if (entry.augment) {
        await appendBlock(app, settings, entry.note, now);
        result.augmented++;
      }
    } catch {
      // Which note failed is the useful half; why it failed is already in the
      // console the host writes, and a message here would be one this plugin
      // invented for an error it did not raise.
      result.failed.push(entry.note.title);
    }
  }

  return result;
}
