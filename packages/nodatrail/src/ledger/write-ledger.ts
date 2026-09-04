/**
 * Writing accounts and postings into the vault.
 *
 * An account is an ordinary note and goes through the same creator every other
 * kind does. A posting is not: it is a line inside a note that already exists,
 * or that has to be made first, so it goes through `process` on the file rather
 * than through the note creator.
 */
import { App, TFile, normalizePath } from 'obsidian';
import { formatPosting, looksLikeIban, pad2, parseDayTitle, type Posting } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { createTypedNote } from '../vault/create-note';
import { noteFolderFor } from '../finance/paths';
import { emptyJournalBody, insertPosting } from './journal-text';
import type { SeededAccount } from '../finance/default-chart';

/**
 * What an account note is called: the number first, so the folder sorts the way
 * the printed chart reads.
 *
 * Exported because the chart seed is no longer the only thing that writes one.
 * The sample vault writes a handful of these accounts too, and the two have to
 * agree on the title character for character: the chart seed skips an account
 * whose **number** is taken, while the sample planner skips a note whose
 * **title** is taken, and a second spelling here would let one of them write a
 * duplicate the other could not see.
 */
export function accountNoteTitle(account: SeededAccount): string {
  return `${account.number} ${account.title}`;
}

/** Everything an account note says after its type and its created stamp. */
export function accountFrontmatter(
  settings: NODAtrailSettings,
  account: SeededAccount
): Record<string, unknown> {
  return {
    [settings.accountNumberProperty]: account.number,
    [settings.accountKindProperty]: account.kind,
    [settings.accountGroupProperty]: account.group,
    [settings.accountCurrencyProperty]: account.currency,
    [settings.accountOpeningProperty]: 0,
    // Written only when there is one. An empty link property on every
    // shared account would be noise in fifty notes.
    ...(account.person ? { [settings.accountPersonProperty]: `[[${account.person}]]` } : {}),
    ...(account.identity
      ? {
          [looksLikeIban(account.identity)
            ? settings.accountIbanProperty
            : settings.accountBankNumberProperty]: account.identity,
        }
      : {}),
  };
}

/** Creates one account note. */
export function createAccount(
  app: App,
  settings: NODAtrailSettings,
  account: SeededAccount,
  now: Date
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: settings.accountsFolder,
      title: accountNoteTitle(account),
      typeValue: settings.accountTypeValue,
      properties: accountFrontmatter(settings, account),
    },
    now
  );
}

/** The month a date belongs to, as a journal note is titled. */
export function journalTitleFor(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** Where the journal note for a date lives, path and all. */
export function journalPathFor(settings: NODAtrailSettings, date: Date): string {
  const folder = noteFolderFor(settings, 'journal', date);
  return normalizePath(`${folder}/${journalTitleFor(date)}.md`);
}

/**
 * The journal note for a month, made if it is not there yet.
 *
 * Creating it rather than refusing, because a posting is written on the day
 * something happened and nobody should have to make a note first to record that
 * the electricity bill was paid.
 */
export async function journalNoteFor(
  app: App,
  settings: NODAtrailSettings,
  date: Date,
  now: Date
): Promise<TFile> {
  const path = journalPathFor(settings, date);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  const title = journalTitleFor(date);
  return createTypedNote(
    app,
    settings,
    {
      folder: noteFolderFor(settings, 'journal', date),
      title,
      typeValue: settings.journalTypeValue,
      properties: {},
      body: emptyJournalBody(title),
    },
    now
  );
}

/**
 * Writes one posting into the journal for its own month.
 *
 * Refuses a posting whose date cannot be read, rather than filing it under
 * today: a posting in the wrong month is a balance that is wrong on every day
 * between, and a date somebody mistyped is better rejected at the door.
 */
export async function appendPosting(
  app: App,
  settings: NODAtrailSettings,
  posting: Posting,
  now: Date
): Promise<TFile> {
  const date = parseDayTitle(posting.date);
  if (!date) throw new Error(`posting has no readable date: ${posting.date}`);

  const file = await journalNoteFor(app, settings, date, now);
  const line = formatPosting(posting);
  await app.vault.process(file, (markdown) => insertPosting(markdown, line));
  return file;
}
