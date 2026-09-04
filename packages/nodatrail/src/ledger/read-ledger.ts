/**
 * Reading the ledger out of the vault.
 *
 * The accounts come from the metadata cache like every other note. The postings
 * do not: they are text in the body of a journal note, so reading them means
 * reading the file. That is why everything here that touches postings is
 * asynchronous while the rest of the plugin's readers are not.
 *
 * Nothing is cached. A view re-reads on render, so what it shows cannot drift
 * from what is on disk.
 */
import { App, TFile } from 'obsidian';
import {
  accountsByNumber,
  parseAccountBudget,
  extractJournalBlocks,
  parseAccount,
  parseJournal,
  currencyMismatches,
  matchOrdersForLines,
  selfPostings,
  unknownAccounts,
  type Account,
  type AccountBudgetRecord,
  type CurrencyMismatch,
  type JournalProblem,
  type OrderMatch,
  type Posting,
} from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { readNotes } from '../vault/read-notes';
import { accountProperties } from './properties';
import { readOrders } from '../finance/read-orders';
import { budgetProperties } from '../finance/properties';

/** An account note read, with the file it came from. */
export interface AccountRecord {
  file: TFile;
  account: Account;
}

/** The chart, in account-number order. */
export function readAccounts(app: App, settings: NODAtrailSettings): AccountRecord[] {
  const properties = accountProperties(settings);

  const records: AccountRecord[] = [];
  for (const note of readNotes(app, settings, 'account')) {
    const account = parseAccount(note.frontmatter, note.title, properties);
    // A note with no number is skipped rather than guessed at: the number is
    // the account's identity, and inventing one would put postings on it.
    if (account) records.push({ file: note.file, account });
  }

  return records.sort((a, b) => a.account.number - b.account.number);
}

/** Everything one journal note holds. */
export interface JournalRecord {
  file: TFile;
  title: string;
  postings: Posting[];
  problems: JournalProblem[];
}

/** The whole ledger: every account, every posting, and everything wrong with it. */
export interface Ledger {
  accounts: Account[];
  byNumber: Map<number, Account>;
  postings: Posting[];
  journals: JournalRecord[];
  problems: { file: TFile; problem: JournalProblem }[];
  /** Postings naming a number no account note claims. */
  unknown: { file: TFile; posting: Posting; number: number }[];
  /**
   * Postings moving a figure through an account that keeps another currency.
   *
   * Alongside the parse problems rather than among them: the journal line is
   * perfectly readable, and only the chart says it is wrong.
   */
  mismatches: { file: TFile; mismatch: CurrencyMismatch }[];
  /**
   * Postings whose text names an order the vault prices differently.
   *
   * Only the disagreements. A leg that matches its order to the cent is the
   * normal case and saying so on every render would bury the one line worth
   * looking at. Empty when no orders folder is configured, which is most vaults.
   */
  orderDiffers: { file: TFile; posting: Posting; match: OrderMatch }[];
  /**
   * Postings naming one account on both sides, which move nothing.
   *
   * The quietest thing a journal can hold: it parses, it balances, it leaves
   * every total alone and the books still close. Only the bank disagrees.
   */
  selfPostings: { file: TFile; posting: Posting }[];
}

/**
 * Every journal note read.
 *
 * `cachedRead` rather than `read`, because a view asking for the ledger on
 * every render must not hit the disk once per note per render.
 */
export async function readJournals(
  app: App,
  settings: NODAtrailSettings
): Promise<JournalRecord[]> {
  const notes = readNotes(app, settings, 'journal');

  const records = await Promise.all(
    notes.map(async (note) => {
      const markdown = await app.vault.cachedRead(note.file);
      const postings: Posting[] = [];
      const problems: JournalProblem[] = [];

      for (const block of extractJournalBlocks(markdown)) {
        // The offset makes a reported line number point at the line the person
        // sees in the note rather than at a line of the block.
        const parsed = parseJournal(block.source, block.fenceLine + 1);
        postings.push(...parsed.postings);
        problems.push(...parsed.problems);
      }

      return { file: note.file, title: note.title, postings, problems };
    })
  );

  return records.sort((a, b) => a.title.localeCompare(b.title));
}

/** The chart and the journals together, which is what every report needs. */
export async function readLedger(app: App, settings: NODAtrailSettings): Promise<Ledger> {
  const accounts = readAccounts(app, settings).map((record) => record.account);
  const journals = await readJournals(app, settings);
  const orders = readOrders(app, settings);
  const postings = journals.flatMap((journal) => journal.postings);
  const known = new Set(accounts.map((account) => account.number));

  return {
    accounts,
    byNumber: accountsByNumber(accounts),
    postings,
    journals,
    problems: journals.flatMap((journal) =>
      journal.problems.map((problem) => ({ file: journal.file, problem }))
    ),
    unknown: journals.flatMap((journal) =>
      unknownAccounts(journal.postings, known).map((found) => ({ file: journal.file, ...found }))
    ),
    mismatches: journals.flatMap((journal) =>
      currencyMismatches(accounts, journal.postings).map((mismatch) => ({
        file: journal.file,
        mismatch,
      }))
    ),
    selfPostings: journals.flatMap((journal) =>
      selfPostings(journal.postings).map((posting) => ({ file: journal.file, posting }))
    ),
    orderDiffers: journals.flatMap((journal) =>
      matchOrdersForLines(journal.postings, orders)
        .filter(({ match }) => (match.difference ?? 0) !== 0)
        .map(({ line, match }) => ({ file: journal.file, posting: line, match }))
    ),
  };
}

/** Postings dated outside the month their journal note is named for. */
export function misfiledPostings(journals: readonly JournalRecord[]): {
  file: TFile;
  posting: Posting;
}[] {
  const found: { file: TFile; posting: Posting }[] = [];

  for (const journal of journals) {
    // Only a note titled as a month can be wrong about one. A journal somebody
    // named something else is theirs to name.
    if (!/^\d{4}-\d{2}$/.test(journal.title)) continue;
    for (const posting of journal.postings) {
      if (!posting.date.startsWith(journal.title)) found.push({ file: journal.file, posting });
    }
  }

  return found;
}

/**
 * The budget notes, newest year first.
 *
 * Read here rather than with the other money notes because a budget is keyed to
 * accounts and measured against postings: it belongs to the ledger now, not
 * beside the bills it used to be measured from.
 */
export function readBudgets(app: App, settings: NODAtrailSettings): AccountBudgetRecord<TFile>[] {
  const properties = budgetProperties(settings);

  return readNotes(app, settings, 'budget')
    .map((note) => ({
      file: note.file,
      title: note.title,
      ...parseAccountBudget(note.frontmatter, properties),
    }))
    .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''));
}
