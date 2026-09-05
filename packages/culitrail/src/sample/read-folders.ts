/**
 * What the sample vault's target folders hold right now.
 *
 * The planner in `trail-core` decides whether a seed may run, and it decides it
 * from this: the note titles already sitting in each folder, and which of the
 * notes that declare a block are missing it. This file is the only part of the
 * feature that touches a vault.
 *
 * **Not recursive.** A folder's own notes are what the refusal rule is about; a
 * subfolder is somebody else's business, and walking into one would let a
 * `Meals/Archive` full of real notes refuse a seed that was never going to
 * write there. The seeder's own `From a real vault` subfolder is listed as a
 * target folder in its own right for exactly that reason.
 *
 * A folder that does not exist contributes nothing, which is the ordinary case
 * on a fresh vault rather than a failure.
 */
import { App, TFile, TFolder } from 'obsidian';
import { sampleFolders, type FolderContents, type SampleNote } from '@technosoftware/trail-core';

/**
 * True when a note's text already carries a fence of this language.
 *
 * Line-anchored and tolerant of both fence notations, because the question is
 * whether the block is there rather than whether it was written the way this
 * plugin writes it. A bare `includes()` would answer yes to the fence's name
 * appearing in a sentence about it, which is a thing a documentation-shaped
 * note genuinely contains.
 */
export function carriesBlock(text: string, lang: string): boolean {
  const fence = new RegExp(
    `^\\s*(?:\`{3,}|~{3,})\\s*${lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
    'm'
  );
  return fence.test(text);
}

/** The markdown notes directly in a folder, by title. Empty when the folder is absent. */
function titlesIn(app: App, folder: string): string[] {
  const found = app.vault.getFolderByPath(folder);
  if (!(found instanceof TFolder)) return [];

  return found.children
    .filter((child): child is TFile => child instanceof TFile && child.extension === 'md')
    .map((file) => file.basename);
}

export async function sampleFolderContents(
  app: App,
  notes: readonly SampleNote[]
): Promise<FolderContents[]> {
  const contents: FolderContents[] = [];

  for (const folder of sampleFolders(notes)) {
    const titles = titlesIn(app, folder);
    if (titles.length === 0) {
      // Still reported, so the planner sees a folder that exists and is empty
      // the same way it sees one that does not exist: as nothing in the way.
      contents.push({ folder, titles, withoutBlock: [] });
      continue;
    }

    const withoutBlock: string[] = [];
    for (const note of notes) {
      if (note.folder !== folder || note.ensureBlock === undefined) continue;
      if (!titles.includes(note.title)) continue;

      const file = app.vault.getAbstractFileByPath(`${folder}/${note.title}.md`);
      if (!(file instanceof TFile)) continue;

      // `cachedRead` rather than `read`: this is a look at what is there, and
      // the cached copy is what every other reader in the plugin works from.
      const text = await app.vault.cachedRead(file);
      if (!carriesBlock(text, note.ensureBlock)) withoutBlock.push(note.title);
    }

    contents.push({ folder, titles, withoutBlock });
  }

  return contents;
}
