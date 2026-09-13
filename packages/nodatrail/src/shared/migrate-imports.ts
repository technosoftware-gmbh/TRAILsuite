/**
 * Moving the files earlier versions kept, into the folder they belong in now.
 *
 * Both importers used to file their source next to the invoices, in
 * `documentSubfolder`, under a name that led with the range: an ics called
 * `20260907-20260913_business.ics` and a csv called `20260401-20260626_1013.csv`.
 * They are now kept in `importSubfolder` under a name that leads with the
 * moment of the run. A vault that has been importing for a year holds a folder
 * of the old ones, and they are not decoration: the calendar's "gone from the
 * export" list and the ledger's unposted count are both replayed from these
 * files and from nothing else. Left where they are they stop being read at all,
 * and both features quietly start answering from an empty history.
 *
 * **So this is a move and a rename, and nothing else.** No file is written, no
 * file is deleted, no note is touched. `fileManager.renameFile` is Obsidian's
 * own move, so anything linking to one of these follows it.
 *
 * **The stamp is the honest problem here**, because the old name does not carry
 * one and the run that wrote it is over. What is used instead is the vault's
 * own record of when the file was created, which is the closest thing to the
 * truth that still exists, and the range's last day at midnight when even that
 * is missing. `statement-archive.ts` says file dates on a synced vault are not
 * trustworthy, and that is exactly why the new names take their stamp from the
 * clock at the moment of the run rather than from `stat`: this function is the
 * one place with no better source, and it is a one-off.
 *
 * **A migrated stamp is therefore approximate, and it is allowed to be.** The
 * stamp orders a source's own history, and these files are all older than
 * anything a new run will write, so the order that matters -- everything
 * migrated before everything since -- holds however far off an individual
 * second is.
 *
 * One thing it fixes on the way past. The old scheme numbered a second export
 * of one range `... 2.ics`, and the reader's own pattern never matched a name
 * with a space in it, so those files have been sitting in the archive unread
 * since the day they were written. They are migrated to ordinary names and
 * start counting.
 */
import { TFile, normalizePath, type App } from 'obsidian';
import { parseDayTitle } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { freeImportName, importFileName, importStamp } from './import-name';

/** One file, where it is, and where it is going. */
export interface ImportMove {
  file: TFile;
  /** Where it sits now. */
  from: string;
  /** Where it will sit, folder and new name. */
  to: string;
  /** The folder that has to exist first. */
  folder: string;
}

export interface ImportMigrationPlan {
  moves: ImportMove[];
}

/** What an old archive name said, or null for a file this plugin did not name. */
interface OldName {
  source: string;
  from: string;
  to: string;
}

/**
 * The two old patterns, and the numbered variant of each.
 *
 * Deliberately strict about the source segment: a lower-case slug for an ics, a
 * run of digits for a csv. A file somebody dropped into the documents folder
 * themselves is not moved, for the same reason it was never read -- guessing
 * wrongly about a range is what reports meetings gone that were never offered.
 */
function readOldName(name: string, extension: string): OldName | null {
  const source = extension === 'ics' ? String.raw`[a-z0-9-]+` : String.raw`\d+`;
  const pattern = new RegExp(String.raw`^(\d{8})-(\d{8})_(${source})(?: \d+)?\.${extension}$`, 'i');
  const match = pattern.exec(name.trim());
  if (!match) return null;

  const [, from, to, found] = match;
  if (!from || !to || !found) return null;

  const day = (value: string) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return { source: found.toLowerCase(), from: day(from), to: day(to) };
}

/**
 * When a file was kept, as well as anybody can still say.
 *
 * The vault's creation time first, its modification time second, and the last
 * day of the range at midnight when neither is there. A synced vault sometimes
 * reports zero for both, and a stamp of `19700101-010000` in a folder somebody
 * browses would be worse than a day that is at least the right month.
 */
function stampFor(file: TFile, to: string): string {
  const known = [file.stat.ctime, file.stat.mtime].find(
    (value) => Number.isFinite(value) && value > 0
  );
  if (known !== undefined) return importStamp(new Date(known));

  const day = parseDayTitle(to);
  return importStamp(day ?? new Date(0));
}

/**
 * Every archived import still sitting in a documents folder, and where each one
 * goes.
 *
 * The destination is the **sibling** of the folder the file is in rather than a
 * path recomputed from the note settings. A vault whose daily-note folder was
 * renamed since the import still has its old files where they were put, and
 * recomputing would build a path to a folder that holds none of them and move
 * September's export into a folder for a month it says nothing about. The file
 * knows where it is; only its last segment and its name are wrong.
 *
 * Empty when either subfolder setting is blank, or when the two are the same
 * name: there is nothing to move between.
 */
export function planImportMigration(app: App, settings: NODAtrailSettings): ImportMigrationPlan {
  const documents = settings.documentSubfolder.trim();
  const imports = settings.importSubfolder.trim();
  if (!documents || !imports || documents === imports) return { moves: [] };

  // Names already spoken for, per destination folder, so two files that land on
  // one name inside the plan do not collide when it runs.
  const taken = new Map<string, Set<string>>();
  const namesIn = (folder: string): Set<string> => {
    const held = taken.get(folder);
    if (held) return held;
    const children = app.vault.getFolderByPath(folder)?.children ?? [];
    const fresh = new Set(children.map((child) => child.name));
    taken.set(folder, fresh);
    return fresh;
  };

  const moves: ImportMove[] = [];
  for (const file of app.vault.getFiles()) {
    const extension = file.extension.toLowerCase();
    if (extension !== 'ics' && extension !== 'csv') continue;
    if (file.parent?.name !== documents) continue;

    const old = readOldName(file.name, extension);
    if (!old) continue;

    const parent = file.path.slice(0, file.path.lastIndexOf('/'));
    const folder = normalizePath(`${parent.slice(0, parent.lastIndexOf('/'))}/${imports}`);
    const wanted = importFileName({ ...old, stamp: stampFor(file, old.to) }, extension);

    const here = namesIn(folder);
    const name = freeImportName(wanted, here);
    here.add(name);

    moves.push({ file, from: file.path, to: `${folder}/${name}`, folder });
  }

  // By where they are, so the report reads folder by folder.
  return { moves: moves.sort((a, b) => a.from.localeCompare(b.from)) };
}

export interface ImportMigrationResult {
  moved: number;
  /** The ones that would not move, by the path they are still at. */
  failed: string[];
}

/**
 * Runs the plan.
 *
 * A file that will not move is reported and the rest still go: a single
 * locked file should not leave a vault half migrated with no way to say which
 * half. Running it again is safe and is the fix -- the moved ones are no longer
 * in a documents folder and are not seen a second time.
 */
export async function runImportMigration(
  app: App,
  moves: readonly ImportMove[]
): Promise<ImportMigrationResult> {
  const result: ImportMigrationResult = { moved: 0, failed: [] };

  for (const move of moves) {
    try {
      if (!app.vault.getFolderByPath(move.folder)) await app.vault.createFolder(move.folder);
      await app.fileManager.renameFile(move.file, move.to);
      result.moved += 1;
    } catch {
      result.failed.push(move.from);
    }
  }

  return result;
}
