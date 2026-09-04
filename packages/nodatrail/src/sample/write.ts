/**
 * Writing a planned sample vault: the notes that are not there yet, and the one
 * block that gets appended to the notes that are.
 *
 * **It refuses before it writes anything.** A plan the core says is not writable
 * throws and no note is created: half a sample vault is worse than none, because
 * the notes reference each other and a partial seed reads as a broken plugin
 * rather than as a skipped folder.
 *
 * Every note goes through `createTypedNote`, which is the one place in this
 * plugin that decides "make the folder", "refuse rather than overwrite" and
 * "stamp `created` directly after `type`". The typed creators next to it --
 * `createProject`, `createBill`, `createAccount` -- are deliberately not used:
 * each takes the parsed record its own dialog collects, and the day notes, the
 * journal and the two Person notes have no creator at all. What is shared with
 * them is the note shape, and it is shared by going through the same function
 * they do rather than by being written out again here.
 *
 * **A failure is recorded rather than raised.** Once the first note is on disk
 * the vault is already half seeded, and aborting there leaves exactly the state
 * the refusal above exists to prevent. Carrying on and naming what failed is the
 * honest end of a run that went wrong in the middle.
 */
import { App } from 'obsidian';
import { sampleVaultWritable, type SampleNote, type SampleVaultPlan } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { createTypedNote } from '../vault/create-note';

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
      'The sample vault plan is not writable: a folder is occupied, a setting is unconfigured, or there is nothing left to do.'
    );
    this.name = 'SampleVaultRefusedError';
  }
}

/**
 * Appends this plugin's own block to a note somebody else's plugin wrote.
 *
 * The one edit a seed makes to a note it did not create, which is why it stamps
 * `modified`: the note genuinely was edited. A leading blank line rather than a
 * bare append, so the fence does not run onto the end of whatever the note last
 * said.
 */
async function appendBlock(app: App, settings: NODAtrailSettings, note: SampleNote): Promise<void> {
  // Both guards are unreachable through the planner, which marks a note for
  // augmenting only when it declares a block and a note of that title sits in
  // that folder. They are here so a caller that assembled a plan by hand fails
  // loudly rather than appending an empty fence to nothing.
  const language = note.ensureBlock;
  if (!language) throw new Error(`${note.title} declares no block to append.`);

  const host = hostFor(app);
  const file = host.vault.getFile(`${note.folder}/${note.title}.md`);
  if (!file) throw new Error(`No note at ${note.folder}/${note.title}.md to append to.`);

  await host.vault.append(file, `\n\`\`\`${language}\n\`\`\`\n`);
  await touchModified(app, settings, file);
}

export async function writeSampleVault(
  app: App,
  settings: NODAtrailSettings,
  plan: SampleVaultPlan,
  now: Date
): Promise<SampleWriteResult> {
  // Checked here as well as in the modal, because this is the function that
  // touches the vault and a second caller must not be able to skip the guard by
  // not knowing about it.
  if (!sampleVaultWritable(plan)) throw new SampleVaultRefusedError();

  const result: SampleWriteResult = { created: 0, augmented: 0, failed: [] };

  for (const entry of plan.notes) {
    try {
      if (entry.status === 'write') {
        await createTypedNote(
          app,
          settings,
          {
            folder: entry.note.folder,
            title: entry.note.title,
            typeValue: entry.note.typeValue,
            properties: entry.note.properties,
            body: entry.note.body,
          },
          now
        );
        result.created += 1;
      } else if (entry.augment) {
        await appendBlock(app, settings, entry.note);
        result.augmented += 1;
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
