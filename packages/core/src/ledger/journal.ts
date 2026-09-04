/**
 * The journal: postings written as lines of text, and read back.
 *
 * A household writes a couple of thousand postings a year. One note each would
 * make every folder listing and the metadata cache useless for the sake of a
 * note holding one line of information, so postings live in a fenced block
 * inside a note per month.
 *
 * **Nothing here throws.** A journal is typed by hand, and a single fat-fingered
 * line must not take the other two hundred down with it. Every line that cannot
 * be read comes back as a problem carrying its line number, and the postings
 * that could be read are still returned.
 *
 * App-free.
 */
import { formatDayTitle, parseDayTitle } from '../dates/day.js';
import { roundCents } from '../money/format.js';
import type { JournalProblem, ParsedJournal, Posting } from './types.js';

/** The fence language a journal block is written in. */
export const JOURNAL_LANGUAGE = 'noda-journal';

const FIELD_SEPARATOR = '|';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One journal block found in a note, with where it started. */
export interface JournalBlock {
  source: string;
  /** Zero based line of the opening fence within the note. */
  fenceLine: number;
}

/**
 * The journal blocks in a note.
 *
 * Written here rather than left to a markdown library because the plugin has to
 * find them in a note it is about to append to, and a reader that disagreed
 * with the writer about where a block ends would append into prose.
 */
export function extractJournalBlocks(
  markdown: string,
  language: string = JOURNAL_LANGUAGE
): JournalBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: JournalBlock[] = [];

  let open: { fenceLine: number; fence: string; body: string[] } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/.exec(line);

    if (open) {
      // Only a fence of the same character and at least the same length closes
      // a block, which is what lets a journal quote a shorter fence.
      if (
        fence &&
        fence[1] &&
        fence[1][0] === open.fence[0] &&
        fence[1].length >= open.fence.length &&
        !fence[2]
      ) {
        blocks.push({ source: open.body.join('\n'), fenceLine: open.fenceLine });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }

    if (fence && fence[2]?.toLowerCase() === language.toLowerCase()) {
      open = { fenceLine: index, fence: fence[1] ?? '```', body: [] };
    }
  }

  // An unterminated block still holds postings, and losing them because
  // somebody forgot a fence would be the wrong kind of strict.
  if (open) blocks.push({ source: open.body.join('\n'), fenceLine: open.fenceLine });
  return blocks;
}

/** An amount as written: a figure, its currency, and the other side of a conversion. */
export interface ParsedAmount {
  amount: number;
  currency: string | null;
  counterAmount: number | null;
  counterCurrency: string | null;
}

/**
 * A written amount read.
 *
 * Tolerant on purpose about how a person writes a number: `1'234.50` is the
 * Swiss form, `1,234.50` the English one, `1234,50` the German one. What it
 * will not do is guess when a figure is ambiguous beyond those, because a
 * ledger that guessed at a decimal point would be off by a hundred.
 */
export function parseAmount(text: string): ParsedAmount | null {
  const sides = text.split('=');
  const near = parseOneAmount(sides[0] ?? '');
  if (!near) return null;

  const far = sides.length > 1 ? parseOneAmount(sides[1] ?? '') : null;
  return {
    amount: near.value,
    currency: near.currency,
    counterAmount: far ? far.value : null,
    counterCurrency: far ? far.currency : null,
  };
}

function parseOneAmount(text: string): { value: number; currency: string | null } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const currency = /([A-Za-z]{3})/.exec(trimmed);
  const figure = trimmed
    .replace(/[A-Za-z]/g, '')
    .replace(/['’\s]/g, '')
    .trim();
  if (!figure) return null;

  let normalized = figure;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma >= 0 && lastComma > lastDot) {
    // German form: the comma is the decimal point and any dot groups thousands.
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return {
    value: roundCents(Number(normalized)),
    currency: currency?.[1] ? currency[1].toUpperCase() : null,
  };
}

interface Row {
  line: number;
  raw: string;
  indented: boolean;
  fields: string[];
}

/**
 * Every posting a journal block holds, and everything wrong with it.
 *
 * `lineOffset` is added to every reported line number, so a caller holding a
 * whole note can report the line the person actually sees.
 */
export function parseJournal(source: string, lineOffset = 0): ParsedJournal {
  const postings: Posting[] = [];
  const problems: JournalProblem[] = [];

  const rows = readRows(source, lineOffset);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;

    if (row.indented) {
      // Reached without a header having claimed it: every continuation a header
      // owns is consumed by the header itself, below.
      problems.push({ line: row.line, raw: row.raw, reason: 'orphan-continuation' });
      continue;
    }

    const legs: Row[] = [];
    while (rows[index + 1]?.indented) {
      const next = rows[index + 1];
      if (next) legs.push(next);
      index += 1;
    }

    readPosting(row, legs, postings, problems);
  }

  return { postings, problems };
}

function readRows(source: string, lineOffset: number): Row[] {
  const rows: Row[] = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    rows.push({
      line: lineOffset + index + 1,
      raw,
      indented: /^\s/.test(raw),
      fields: trimmed.split(FIELD_SEPARATOR).map((field) => field.trim()),
    });
  }

  return rows;
}

function readPosting(
  header: Row,
  legs: readonly Row[],
  postings: Posting[],
  problems: JournalProblem[]
): void {
  const [date, debitText, creditText, amountText, text, reference, importKey] = header.fields;

  if (!date || !DAY.test(date) || !isRealDay(date)) {
    problems.push({ line: header.line, raw: header.raw, reason: 'no-date' });
    return;
  }

  const money = parseAmount(amountText ?? '');
  if (!money) {
    problems.push({ line: header.line, raw: header.raw, reason: 'no-amount' });
    return;
  }

  const debit = readAccountNumber(debitText);
  const credit = readAccountNumber(creditText);
  if (debit === null && credit === null) {
    problems.push({ line: header.line, raw: header.raw, reason: 'no-accounts' });
    return;
  }

  const description = (text ?? '').trim();
  const shared = {
    date,
    currency: money.currency,
    reference: (reference ?? '').trim() || null,
    importKey: (importKey ?? '').trim() || null,
    counterAmount: money.counterAmount,
    counterCurrency: money.counterCurrency,
  };

  if (legs.length === 0) {
    if (debit === null || credit === null) {
      // A header missing a side and carrying no continuations is a split
      // somebody started and did not finish, not a posting.
      problems.push({ line: header.line, raw: header.raw, reason: 'no-accounts' });
      return;
    }

    postings.push({
      ...shared,
      debit,
      credit,
      amount: money.amount,
      text: description,
      line: header.line,
      entryLine: header.line,
      splitOf: null,
    });
    return;
  }

  const parts: { row: Row; account: number; amount: number; text: string }[] = [];
  for (const leg of legs) {
    const [accountText, legAmountText, legText] = leg.fields;
    const account = readAccountNumber(accountText);
    const legMoney = parseAmount(legAmountText ?? '');
    if (account === null || !legMoney) {
      problems.push({ line: leg.line, raw: leg.raw, reason: 'unreadable' });
      continue;
    }
    parts.push({ row: leg, account, amount: legMoney.amount, text: (legText ?? '').trim() });
  }

  const total = roundCents(parts.reduce((sum, part) => sum + part.amount, 0));
  if (total !== money.amount) {
    // Reported and dropped rather than posted. A split that does not sum is a
    // figure somebody mistyped, and posting it would put the error into a
    // balance where it is far harder to find.
    problems.push({
      line: header.line,
      raw: header.raw,
      reason: 'split-does-not-sum',
      difference: roundCents(money.amount - total),
    });
    return;
  }

  for (const part of parts) {
    postings.push({
      ...shared,
      debit: debit ?? part.account,
      credit: credit ?? part.account,
      amount: part.amount,
      text: part.text || description,
      line: part.row.line,
      // Every leg points at the header, which is what makes them one entry
      // however the header was described, or whether it was described at all.
      entryLine: header.line,
      splitOf: description || null,
      counterAmount: null,
      counterCurrency: null,
    });
  }
}

/**
 * A day that exists.
 *
 * `parseDayTitle` rolls a 31st of February over into March, which is right for
 * a note title somebody typed and wrong for a posting: a date that quietly
 * moved would put money in the wrong month. So the parsed day is written back
 * out and compared, and only a date that survives the trip is accepted.
 */
function isRealDay(text: string): boolean {
  const parsed = parseDayTitle(text);
  return parsed !== null && formatDayTitle(parsed) === text;
}

function readAccountNumber(text: string | undefined): number | null {
  const trimmed = (text ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** One leg of a split, as it was written under its header. */
export interface SplitLine {
  account: number;
  amount: number;
  text: string;
}

/** A split read back into the shape it was written in. */
export interface SplitEntry {
  /** Null on the side the legs fill, which is how the parser knows to take it from them. */
  debit: number | null;
  credit: number | null;
  legs: SplitLine[];
  /** What the header states, which is what the legs sum to. */
  amount: number;
}

/**
 * A written entry recovered from the postings it parsed into.
 *
 * **The inverse of what `parseJournal` does to a split**, and it exists because
 * that expansion is lossy in exactly one way: the parser fills the header's
 * blank side from each leg, so every posting comes back with both sides named
 * and nothing says which one was blank. An editor reading `debit === null` to
 * find out therefore finds it never is, concludes the legs filled the credit,
 * and shows every leg as the card it was paid from. Saving that writes a header
 * naming both sides, whereupon the leg accounts are ignored on the next read
 * and a fifteen line card statement collapses onto one expense account.
 *
 * What survives the expansion is the shape: the legs of a split differ on the
 * side they filled and agree on the side the header named. So the side every
 * posting agrees about is the header's, and the side they differ on is theirs.
 *
 * Returns null for a set that cannot have been written as one entry, which is a
 * reason for a caller to refuse rather than to write a guess.
 */
export function readSplit(postings: readonly Posting[]): SplitEntry | null {
  const first = postings[0];
  if (!first) return null;

  if (postings.length === 1) {
    return {
      debit: first.debit,
      credit: first.credit,
      legs: [],
      amount: first.amount,
    };
  }

  const sameDebit = postings.every((posting) => posting.debit === first.debit);
  const sameCredit = postings.every((posting) => posting.credit === first.credit);

  // Both sides constant is a split whose header named both, so the legs never
  // filled anything and either reading round-trips. Normalised to the shape the
  // writer produces, which is the one the parser reads back unchanged.
  const legsAreDebits = sameCredit;
  if (!legsAreDebits && !sameDebit) return null;

  const legs: SplitLine[] = [];
  for (const posting of postings) {
    const account = legsAreDebits ? posting.debit : posting.credit;
    // A leg with no account of its own is a leg this cannot put back.
    if (account === null) return null;
    legs.push({ account, amount: posting.amount, text: posting.text });
  }

  return {
    debit: legsAreDebits ? null : first.debit,
    credit: legsAreDebits ? first.credit : null,
    legs,
    amount: roundCents(legs.reduce((sum, leg) => sum + leg.amount, 0)),
  };
}

/**
 * One posting written back as a line.
 *
 * The inverse of the simple form only. A split is written by its own editor,
 * because a function that took a list and guessed which legs belonged together
 * would be guessing about somebody's money.
 */
export function formatPosting(posting: Posting): string {
  const amount = posting.currency
    ? `${posting.currency} ${posting.amount.toFixed(2)}`
    : posting.amount.toFixed(2);
  const converted =
    posting.counterAmount !== null && posting.counterCurrency
      ? `${amount} = ${posting.counterCurrency} ${posting.counterAmount.toFixed(2)}`
      : amount;

  const fields = [
    posting.date,
    posting.debit === null ? '' : String(posting.debit),
    posting.credit === null ? '' : String(posting.credit),
    converted,
    // Free text, and the separator is a bar. A bank description carrying one
    // would shift every field after it and turn a reference into an account
    // number on the next read.
    unbarred(posting.text),
  ];
  // The import key needs the reference column filled to sit in the seventh, so
  // an imported posting with no bill behind it writes an empty one.
  if (posting.reference || posting.importKey) fields.push(unbarred(posting.reference ?? ''));
  if (posting.importKey) fields.push(unbarred(posting.importKey));

  return fields.join(' | ');
}

/**
 * A field that cannot break the line it is written into.
 *
 * The format separates fields with `|`, so any free text carrying one silently
 * shifts everything after it: a description becomes a description and a
 * reference, a reference becomes an import key, and the key that was supposed
 * to stop a row being imported twice comes back as a fragment of itself.
 */
function unbarred(text: string): string {
  return text.replace(/\|/g, '/');
}
