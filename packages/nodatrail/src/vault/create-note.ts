/**
 * Writing a new note from a frontmatter object.
 *
 * One place, so that "create the folder", "refuse rather than overwrite" and
 * "stamp `created` directly after `type`" are decided once. The refusal and the
 * folder creation are `trail-core`'s; the ordering is `frontmatterObject`'s, and
 * the serialisation is the host's, because a package that wrote YAML itself
 * would produce notes that change shape the first time Obsidian edits one.
 *
 * **A creation writes no `modified`.** Two identical stamps say nothing one
 * does not.
 */
import { App, TFile } from 'obsidian';
import { createdEntry, frontmatterObject } from '@technosoftware/trail-core';
import { renderFrontmatterBlock } from '@technosoftware/trail-core/obsidian';
import { createNote } from '../shared/note-creation';
import type { NODAtrailSettings } from '../settings/types';

export interface NewNote {
  folder: string;
  title: string;
  typeValue: string;
  /** Everything after the type and the stamp, in the order it should appear. */
  properties: Record<string, unknown>;
  /** Optional body. Most of these notes are frontmatter and a blank page. */
  body?: string;
}

/**
 * Creates the note and hands back the file.
 *
 * Refuses when the folder or the type value is blank, rather than writing. Both
 * are settings, and a note at the vault root or with no type value would be
 * invisible to the reader that just created it, which is the worst of both
 * outcomes: the note exists and the plugin says it does not.
 */
export async function createTypedNote(
  app: App,
  settings: NODAtrailSettings,
  note: NewNote,
  now: Date
): Promise<TFile> {
  if (!note.folder.trim()) throw new FolderNotConfiguredError();
  if (!note.typeValue.trim()) throw new TypeValueNotConfiguredError();

  const frontmatter = frontmatterObject(
    settings.typePropertyName,
    note.typeValue,
    createdEntry(settings, now),
    note.properties
  );

  const body = note.body ? `\n${note.body}\n` : '\n';
  return createNote(app, note.folder, note.title, `${renderFrontmatterBlock(frontmatter)}${body}`);
}

/** Typed so the caller can translate. This package's core-facing modules ship no user-facing strings. */
export class FolderNotConfiguredError extends Error {
  constructor() {
    super('The folder for this kind of note is not configured.');
    this.name = 'FolderNotConfiguredError';
  }
}

export class TypeValueNotConfiguredError extends Error {
  constructor() {
    super('The type value for this kind of note is not configured.');
    this.name = 'TypeValueNotConfiguredError';
  }
}
