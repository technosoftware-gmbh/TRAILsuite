/**
 * Writing the sample vault, once the planner has said it may be written.
 *
 * Two things happen here and nothing else: a note the plan marks `write` is
 * created, and a note that is already there and lacks this plugin's block gains
 * one. **An existing note is never overwritten.** It may have been edited, and a
 * sample vault is not worth losing somebody's edit over.
 *
 * The frontmatter is assembled the way every other note this plugin creates
 * assembles it -- the type value first, the creation stamp second, everything
 * else after -- rather than through `createMealNote` or `createOrderNote`.
 * Those two take a title and write the shortest note their editors then fill
 * in, so routing a sample meal through one would mean a second write to add the
 * dozen properties that are the point of the note; and four of the fifteen
 * notes are Person and Company notes, which CULItrail deliberately has no
 * creator for at all. What is shared with them is the shape, which is why it is
 * spelled once below and read against `createOrderNote`.
 *
 * A failure is recorded and the run continues. A half-written vault is the
 * thing worth avoiding, and once the first note is on disk the choice is
 * between finishing and leaving a partial seed behind with nothing naming what
 * is missing.
 */
import { App, normalizePath, stringifyYaml } from 'obsidian';
import {
  sampleVaultWritable,
  type PlannedSampleNote,
  type SampleNote,
  type SampleVaultPlan,
} from 'trail-core';
import type { CULItrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { ensureParentFolders } from '../shared/vault-io';
import { sampleFrontmatter } from './notes';

export interface SampleWriteResult {
  created: number;
  augmented: number;
  /** The titles that could not be written or appended to, for a notice that names them. */
  failed: string[];
}

/** The plan refuses. Typed so the caller translates it; this module ships no user-facing string. */
export class SampleVaultRefused extends Error {
  constructor() {
    super('The sample vault plan refuses to run.');
    this.name = 'SampleVaultRefused';
  }
}

/**
 * The note's full text, frontmatter block included.
 *
 * The frontmatter object is built in `notes.ts`, which imports no Obsidian, so
 * a test can assemble exactly what would be written without needing the host's
 * YAML writer. Only the serialisation happens here, because that is the part
 * that has to be Obsidian's own.
 */
export function sampleNoteText(settings: CULItrailSettings, note: SampleNote, now: Date): string {
  const frontmatter = stringifyYaml(sampleFrontmatter(settings, note, now)).trimEnd();
  return `---\n${frontmatter}\n---\n\n${note.body}`;
}

async function writeOne(
  app: App,
  settings: CULItrailSettings,
  note: SampleNote,
  now: Date
): Promise<void> {
  const path = normalizePath(`${note.folder}/${note.title}.md`);
  await ensureParentFolders(app, path);
  await app.vault.create(path, sampleNoteText(settings, note, now));
}

/**
 * Appends this plugin's fence to a note somebody else's plugin wrote.
 *
 * The one edit this feature makes to a note that already exists, and the reason
 * the preview counts it separately. A leading blank line rather than a bare
 * append, so the fence does not run onto the end of whatever the note last
 * said.
 */
async function augmentOne(app: App, note: SampleNote): Promise<void> {
  const path = normalizePath(`${note.folder}/${note.title}.md`);
  const file = hostFor(app).vault.getFile(path);
  if (!file) throw new Error(`No note at ${path}`);

  await hostFor(app).vault.append(file, `\n\`\`\`${note.ensureBlock}\n\`\`\`\n`);
}

export async function writeSampleVault(
  app: App,
  settings: CULItrailSettings,
  plan: SampleVaultPlan,
  now: Date
): Promise<SampleWriteResult> {
  // Checked here as well as in the modal, because this is the function that
  // touches the vault and a second caller must not be able to skip the guard by
  // not knowing about it.
  if (!sampleVaultWritable(plan)) throw new SampleVaultRefused();

  const result: SampleWriteResult = { created: 0, augmented: 0, failed: [] };

  const run = async (entry: PlannedSampleNote): Promise<void> => {
    if (entry.status === 'write') {
      await writeOne(app, settings, entry.note, now);
      result.created += 1;
      return;
    }
    if (entry.augment) {
      await augmentOne(app, entry.note);
      result.augmented += 1;
    }
  };

  for (const entry of plan.notes) {
    try {
      await run(entry);
    } catch {
      // The title rather than the error: the caller shows this in a notice, and
      // which note went missing is the actionable half.
      result.failed.push(entry.note.title);
    }
  }

  return result;
}
