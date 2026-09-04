/**
 * Opening a period note, creating it if it is not there, and stripping the
 * navigation block off one that has an old one.
 *
 * Creation writes the frontmatter and nothing else, which was already the rule
 * for the body and is now the rule for the whole note: see
 * `docs/design/day-notes.md`.
 */
import { App, TFile } from 'obsidian';
import {
  createdEntry,
  frontmatterObject,
  splitFrontmatterBlock,
  type PeriodLevel,
} from 'trail-core';
import { renderFrontmatterBlock } from 'trail-core/obsidian';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { ensureFolder } from '../shared/note-creation';
import type { NODAtrailSettings } from '../settings/types';
import { stripNavigationBlock } from './nav-block';
import { noteFolderFor, notePathFor, typeValueFor } from './paths';

/**
 * The note for a period, created if missing.
 *
 * A note that was already there is handed back untouched, block included: not
 * writing to it is what makes "open today" safe to run at any hour.
 */
export async function openOrCreatePeriodNote(
  app: App,
  settings: NODAtrailSettings,
  level: PeriodLevel,
  date: Date,
  now: Date
): Promise<TFile> {
  const path = notePathFor(settings, level, date);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  await ensureFolder(app, noteFolderFor(settings, level, date));

  const frontmatter = frontmatterObject(
    settings.typePropertyName,
    typeValueFor(settings, level),
    createdEntry(settings, now)
  );
  // Frontmatter and nothing else. There is no body template: what goes into a
  // period note is the vault owner's business, and a plugin that seeded
  // headings would be seeding headings into 365 notes a year that somebody
  // then has to delete. The day-note dialog creates a heading only when an
  // entry needs one.
  return app.vault.create(path, renderFrontmatterBlock(frontmatter));
}

/**
 * Removes the navigation block from an existing note.
 *
 * Idempotent, and it touches nothing below the block. Returns false when there
 * was no block, so running it twice does not stamp `modified` a second time for
 * no change -- and so a note nobody navigated is left alone entirely.
 */
export async function removeNavigation(
  app: App,
  settings: NODAtrailSettings,
  file: TFile
): Promise<boolean> {
  const host = hostFor(app);
  const text = await host.vault.read(file);
  const { header, body } = splitFrontmatterBlock(text);

  const next = `${header}${stripNavigationBlock(body)}`;
  if (next === text) return false;

  await host.vault.modify(file, next);
  await touchModified(app, settings, file);
  return true;
}
