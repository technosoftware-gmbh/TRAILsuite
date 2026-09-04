/**
 * Reading and writing notes.
 *
 * The rules themselves are `trail-core`'s: create the folder if it is missing,
 * absent and empty are the same thing to a reader, and a note this plugin
 * creates gets `created` while a note it overwrites gets `modified`. This is
 * the `App`-shaped face of them, so no caller here has to hold a vault host.
 */
import type { App, TFile } from 'obsidian';
import {
  getOrCreateNote as getOrCreateNoteCore,
  ensureParentFolders as ensureParentFoldersCore,
  readNoteOrEmpty as readNoteOrEmptyCore,
  writeNote as writeNoteCore,
} from 'trail-core';
import { hostFor } from './vault-host';
import type { NoteStampSettings } from './note-stamps';

/** A note's text, or '' when there is no such note. */
export function readNoteOrEmpty(app: App, path: string): Promise<string> {
  return readNoteOrEmptyCore(hostFor(app), path);
}

/** Creates every folder above a path that does not exist yet, one segment at a time. */
export function ensureParentFolders(app: App, path: string): Promise<void> {
  return ensureParentFoldersCore(hostFor(app), path);
}

/**
 * Writes a note, creating it and its folders if need be, and stamping it.
 *
 * `content` replaces the file outright, frontmatter included, so a caller
 * rewriting an existing note has to carry that note's own properties across in
 * the text it passes. Every caller here does; `splitFrontmatterBlock()` exists
 * for the ones that rebuild a note from its sections and would otherwise start
 * at the title and drop `created` on the way.
 */
export function writeNote(
  app: App,
  settings: NoteStampSettings,
  path: string,
  content: string
): Promise<void> {
  return writeNoteCore(hostFor(app), settings, path, content);
}

/**
 * The note at a path, created with `initialContent` if it is not there yet.
 *
 * A note that was already there is handed back untouched, stamp included: not
 * writing to it is exactly what makes this different from `writeNote()`.
 */
export function getOrCreateNote(
  app: App,
  settings: NoteStampSettings,
  path: string,
  initialContent: string
): Promise<TFile> {
  return getOrCreateNoteCore(hostFor(app), settings, path, initialContent);
}
