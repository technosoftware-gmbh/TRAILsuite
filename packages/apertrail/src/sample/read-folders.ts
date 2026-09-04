/**
 * What the sample notes' target folders hold right now, in the shape
 * trail-core's planner takes.
 *
 * The planner decides; this only looks. It answers two questions per folder:
 * which notes are directly in it, and -- for the notes that declare a block
 * this plugin owns -- which of the ones already there are missing that block.
 *
 * **Not recursive, deliberately.** A subfolder is somebody else's business: a
 * trip's own `Bookings/` and `Exports/` live under the folder its note sits in,
 * and a scan that walked into them would report a booking as a stranger and
 * refuse to seed a vault the plugin itself had laid out. The refusal rule is
 * about the folder a note would land in, not about everything beneath it.
 *
 * A folder that does not exist contributes nothing, which is the ordinary case
 * on a fresh vault rather than an error.
 */
import { App, normalizePath, TFile } from 'obsidian';
import { sampleFolders, type FolderContents, type SampleNote } from 'trail-core';

/** The markdown notes directly in a folder, ignoring subfolders and anything that is not a note. */
function markdownChildren(app: App, folder: string): TFile[] {
  const found = app.vault.getFolderByPath(normalizePath(folder));
  if (!found) return [];

  return found.children.filter((child): child is TFile => child instanceof TFile);
}

export async function sampleFolderContents(
  app: App,
  notes: readonly SampleNote[]
): Promise<FolderContents[]> {
  const contents: FolderContents[] = [];

  for (const folder of sampleFolders(notes)) {
    const files = markdownChildren(app, folder);
    if (files.length === 0) continue;

    // Only the notes this plan would put in this folder can be augmented, and
    // only the ones that declare a block. Anything else in the folder is a
    // stranger and is the planner's problem, not this loop's.
    const wanted = new Map<string, string>(
      notes.flatMap((note) =>
        note.folder === folder && note.ensureBlock !== undefined
          ? [[note.title, note.ensureBlock] as [string, string]]
          : []
      )
    );

    const withoutBlock: string[] = [];
    for (const file of files) {
      const language = wanted.get(file.basename);
      if (language === undefined) continue;

      // cachedRead rather than read: this is a look, not an edit, and the
      // whole set is read on every preview of the modal.
      const text = await app.vault.cachedRead(file);
      if (!text.includes(`\`\`\`${language}`)) withoutBlock.push(file.basename);
    }

    contents.push({
      folder,
      titles: files.map((file) => file.basename),
      withoutBlock,
    });
  }

  return contents;
}
