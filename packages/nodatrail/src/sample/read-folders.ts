/**
 * What the sample notes' target folders hold right now, in the shape
 * trail-core's planner takes.
 *
 * The planner decides; this only looks, and it is the only part of the feature
 * that reads a vault. It answers two questions per folder: which notes are
 * directly in it, and -- for the notes that declare a block this plugin owns --
 * which of the ones already there are missing that block.
 *
 * **Not recursive, deliberately.** A subfolder is somebody else's business. A
 * project owns a folder named after it, and its `_documents/` and `_resources/`
 * live inside that folder; a scan that walked into them would report somebody's
 * invoice as a stranger and refuse to seed a vault this plugin had itself laid
 * out. The refusal rule is about the folder a note would land in, not about
 * everything beneath it.
 *
 * A folder that does not exist contributes nothing, which is the ordinary case
 * on a fresh vault rather than an error.
 */
import { App, TFile, TFolder } from 'obsidian';
import { sampleFolders, type FolderContents, type SampleNote } from 'trail-core';
import { hostFor } from '../shared/vault-host';

/**
 * True when a note's text already carries a fence of this language.
 *
 * Line-anchored and tolerant of both fence notations, because the question is
 * whether the block is there rather than whether it was written the way this
 * plugin writes it. A bare `includes()` would answer yes to the fence's name
 * appearing in a sentence about it, which is a thing a note documenting the
 * block genuinely contains -- and appending a second fence to such a note would
 * be the one edit this feature makes to somebody else's file, made wrongly.
 */
export function carriesBlock(text: string, language: string): boolean {
  const fence = new RegExp(
    `^\\s*(?:\`{3,}|~{3,})\\s*${language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
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
  const host = hostFor(app);
  const contents: FolderContents[] = [];

  for (const folder of sampleFolders(notes)) {
    const titles = titlesIn(app, folder);
    if (titles.length === 0) continue;

    const withoutBlock: string[] = [];
    for (const note of notes) {
      if (note.folder !== folder || note.ensureBlock === undefined) continue;
      if (!titles.includes(note.title)) continue;

      const file = host.vault.getFile(`${folder}/${note.title}.md`);
      if (!file) continue;

      // `cachedRead` rather than `read`: this is a look at what is there, and
      // the whole set is read again on every preview of the modal.
      const text = await app.vault.cachedRead(file);
      if (!carriesBlock(text, note.ensureBlock)) withoutBlock.push(note.title);
    }

    contents.push({ folder, titles, withoutBlock });
  }

  return contents;
}
