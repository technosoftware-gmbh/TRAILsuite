/**
 * What a fenced block gets, and how it reads its own arguments.
 *
 * Every NODAtrail fence takes the `key: value` lines inside it as its
 * arguments, which is the shape Obsidian users already expect from Dataview and
 * from the plugins around it. An unknown key is ignored rather than reported: a
 * block is rendered inside somebody's note, and an error message where a table
 * should be is worse than a table with a default in it.
 *
 * **All six languages take the `nod-` prefix.** The argument that protected
 * `travel-itinerary` in APERtrail only ever applied to strings already in
 * somebody's vault, and none of these is.
 */
import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import type { NODAtrailSettings } from '../../settings/types';

export interface BlockDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  today: () => Date;
  openNote: (file: TFile) => Promise<void>;
  openFile: (path: string) => Promise<void>;
}

/** The `key: value` lines inside a fence, lower-cased keys, trimmed values. */
export function blockArgs(source: string): Map<string, string> {
  const args = new Map<string, string>();

  for (const line of source.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) args.set(key, value);
  }
  return args;
}

/** The note the block is rendered inside, or null when the context names none. */
export function hostNote(app: App, context: MarkdownPostProcessorContext): TFile | null {
  const file = app.vault.getAbstractFileByPath(context.sourcePath);
  return file instanceof TFile ? file : null;
}
