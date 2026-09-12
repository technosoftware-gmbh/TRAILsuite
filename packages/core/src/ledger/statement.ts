/**
 * A bank statement export read into rows a ledger can use.
 *
 * **Written against a real file, because a bank CSV has no standard.** Column
 * names, the date format, whether a debit and a credit are two columns or one
 * signed column, the thousands separator, and whether the newest row is first
 * all differ between banks and sometimes between two export dialogs at the same
 * bank. So the shape lives in a profile, one profile per format, and the parser
 * knows nothing about any particular bank.
 *
 * Three things this recognises beyond the columns, all of them present in the
 * statement it was designed against and all of them worth more than the columns:
 *
 * - **A batch.** `Zahlungsauftrag e-banking (Anzahl Buchungen: 10)` is ten
 *   invoices the bank posted as one line. That is a split posting, and knowing
 *   it is a split is what stops ten bills being paid by one posting.
 * - **A transfer.** `Uebertrag von 0510.5272.2002` names the household's own
 *   other account, so the far side can be resolved rather than guessed.
 * - **The running balance.** Every row states the balance after it, so an
 *   import can prove it dropped nothing and counted nothing twice.
 *
 * App-free, and clock-free.
 */
import { pad2 } from '../dates/day.js';
import { roundCents } from '../money/format.js';

/** Where each field sits in a row. A column that the format does not have is -1. */
export interface StatementColumns {
  date: number;
  valueDate: number;
  text: number;
  /** Money out, as a positive figure in its own column. */
  debit: number;
  /** Money in, as a positive figure in its own column. */
  credit: number;
  /** A single signed column, for the formats that use one instead of the two above. */
  amount: number;
  /**
   * A charge in its own column, subtracted from the movement.
   *
   * Not cosmetic. One export states a card subscription as an amount of zero
   * and a fee of 18.99, and an importer that read only the amount would post
   * nothing and be out by 18.99 from that row onwards.
   */
  fee: number;
  balance: number;
  currency: number;
  /** Whether the row is final, for the exports that include pending ones. */
  status: number;
}

export type StatementDateFormat = 'DD.MM.YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';

/** How to read one bank's export. */
export interface StatementProfile {
  name: string;
  delimiter: string;
  /** How many lines to skip before the data. The header row is one of them. */
  headerRows: number;
  columns: StatementColumns;
  dateFormat: StatementDateFormat;
  /** Fixed currency, for a file that names it nowhere. */
  currency: string | null;
  /**
   * Column whose *header* names the currency, as `Saldo CHF` does. -1 for none.
   *
   * Reading it out of the heading rather than asking for it: the file already
   * says, and a setting that could disagree with the file is a setting that
   * eventually will.
   */
  currencyInHeader: number;
  /** True when the first data row is the most recent one. */
  newestFirst: boolean;
  /**
   * The status values that count as money having actually moved.
   *
   * Empty accepts everything, which is right for an export with no such column.
   * A pending row is still read and still returned; it is simply not accepted,
   * because a card authorisation that never settles is not a posting.
   */
  statusAccepts: readonly string[];
  /** Patterns stripped from the description to leave the counterparty. */
  strip: readonly string[];
}

/**
 * The Swiss e-banking export this was written against.
 *
 * Semicolon separated, `DD.MM.YYYY`, debit and credit in their own columns,
 * apostrophe thousands, newest row first, and the currency in the balance
 * column's heading.
 */
export const SWISS_EBANKING_PROFILE: StatementProfile = {
  name: 'Swiss e-banking (CSV)',
  delimiter: ';',
  headerRows: 1,
  columns: {
    date: 0,
    valueDate: 1,
    text: 2,
    debit: 3,
    credit: 4,
    amount: -1,
    fee: -1,
    balance: 5,
    currency: -1,
    status: -1,
  },
  dateFormat: 'DD.MM.YYYY',
  currency: null,
  currencyInHeader: 5,
  newestFirst: true,
  statusAccepts: [],
  strip: [
    '^\\s*Belastung e-banking\\s*/?\\s*',
    '^\\s*Zahlungseingang\\s*/?\\s*',
    '^\\s*Zahlungsauftrag e-banking\\s*',
    '\\(Anzahl Buchungen:\\s*\\d+\\s*/?\\s*',
    'Ref\\.-Nr\\.\\s*\\d+\\s*',
    '\\)\\s*$',
  ],
};

/**
 * A card account export, of the shape a neobank produces.
 *
 * Comma separated, ISO date and time in two columns, one signed amount column
 * with the fee beside it, an explicit currency and status column, and the
 * oldest row first: different in every one of those respects from the export
 * above, which is why the shape is a profile rather than a constant.
 *
 * The booking date is the completion rather than the start. A card payment made
 * on the last evening of June and settled on the first of July belongs to July,
 * because that is the month whose balance it changed.
 */
export const CARD_ACCOUNT_PROFILE: StatementProfile = {
  name: 'Card account (CSV)',
  delimiter: ',',
  headerRows: 1,
  columns: {
    date: 3,
    valueDate: 2,
    text: 4,
    debit: -1,
    credit: -1,
    amount: 5,
    fee: 6,
    balance: 9,
    currency: 7,
    status: 8,
  },
  dateFormat: 'YYYY-MM-DD',
  currency: null,
  currencyInHeader: -1,
  newestFirst: false,
  statusAccepts: ['ABGESCHLOSSEN', 'COMPLETED'],
  strip: [],
};

/** One line of a bank statement, read. */
export interface BankStatementRow {
  /** One based line in the file, for pointing at it. */
  line: number;
  /** Booking date, ISO. */
  date: string;
  /** Value date, ISO, when the format has one. */
  valueDate: string | null;
  /** The description with the boilerplate taken off: usually the counterparty. */
  text: string;
  /** Exactly what the file said, kept because the cleaning is a guess and this is not. */
  rawText: string;
  /** Signed: negative is money leaving the account. */
  amount: number;
  currency: string | null;
  /** The balance after this row, when the format states one. */
  balance: number | null;
  /** The bank's own reference, which is what makes a row identifiable across imports. */
  reference: string | null;
  /** How many payments the bank posted as this one line, when it says. */
  batchCount: number | null;
  /** An internal transfer: the other account as printed, and which way it went. */
  transfer: { account: string; name: string; direction: 'in' | 'out' } | null;
  /** What the file said about the row being final, when it says. */
  status: string | null;
  /** False when a status column says the money has not actually moved yet. */
  accepted: boolean;
}

/** Something in the file that could not be read. */
export interface StatementProblem {
  line: number;
  raw: string;
  reason: 'no-date' | 'no-amount' | 'too-few-columns';
}

export interface ParsedStatement {
  rows: BankStatementRow[];
  problems: StatementProblem[];
  /** Read out of the heading, when the profile says where to look. */
  currency: string | null;
}

const BATCH = /Anzahl Buchungen:\s*(\d+)/i;
// No word boundary before the word: an umlaut is not a word character to a
// non-unicode regex, so `\b` would never match the U-umlaut spelling.
const TRANSFER = /(?:Uebertrag|Übertrag)\s+(von|auf)\s+([\d.-]+)\s+(.+?)\s*(?:\/\s*Ref|$)/i;
const REFERENCE = /Ref\.-Nr\.\s*(\d+)/i;

/**
 * Splits one line on the delimiter, honouring quotes.
 *
 * Written here rather than taken from a library because the package is
 * dependency free, and because the only quoting rule that matters is the one
 * every one of these exports follows.
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else current += char;
  }

  fields.push(current);
  return fields;
}

/** A figure as a bank writes it: `1'234.50`, `1.234,50`, `1,234.50`, or blank. */
export function parseStatementAmount(text: string): number | null {
  const stripped = text
    .replace(/['’\s]/g, '')
    .replace(/[A-Za-z]/g, '')
    .trim();
  if (!stripped) return null;

  let normalized = stripped;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && comma > dot) normalized = normalized.replace(/\./g, '').replace(',', '.');
  else normalized = normalized.replace(/,/g, '');

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  return roundCents(Number(normalized));
}

/** A date in the profile's format, as an ISO day, or null. */
export function parseStatementDate(text: string, format: StatementDateFormat): string | null {
  // A timestamp is a date with a time after it. The time is dropped rather than
  // parsed: a posting is a fact about a calendar day.
  const digits = text.trim().split(/[ T]/)[0]?.trim() ?? '';
  const parts = digits.split(/[./-]/).map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return null;

  let year: number;
  let month: number;
  let day: number;
  if (format === 'YYYY-MM-DD')
    [year, month, day] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  else if (format === 'MM/DD/YYYY')
    [month, day, year] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  else [day, month, year] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];

  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // The day has to exist: 31 February is somebody's typo or a format read the
  // wrong way round, and either way it must not become a posting.
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** The whole file. */
export function parseStatement(text: string, profile: StatementProfile): ParsedStatement {
  // The byte order mark an export writes, by code point rather than as a
  // literal: an invisible character in a source file is one nobody can review.
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = lines.slice(0, profile.headerRows);
  const currency = currencyFromHeader(header, profile);

  const rows: BankStatementRow[] = [];
  const problems: StatementProblem[] = [];

  for (let index = profile.headerRows; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    if (!raw.trim()) continue;

    const line = index + 1;
    const fields = splitCsvLine(raw, profile.delimiter);
    const at = (column: number): string => (column < 0 ? '' : (fields[column] ?? '')).trim();

    const date = parseStatementDate(at(profile.columns.date), profile.dateFormat);
    if (!date) {
      problems.push({ line, raw, reason: 'no-date' });
      continue;
    }

    const amount = signedAmount(at, profile.columns);
    if (amount === null) {
      problems.push({ line, raw, reason: 'no-amount' });
      continue;
    }

    const rawText = at(profile.columns.text);
    const status = at(profile.columns.status) || null;
    rows.push({
      line,
      date,
      valueDate: parseStatementDate(at(profile.columns.valueDate), profile.dateFormat),
      text: cleanText(rawText, profile),
      rawText,
      amount,
      currency: at(profile.columns.currency) || currency || profile.currency,
      balance: parseStatementAmount(at(profile.columns.balance)),
      reference: REFERENCE.exec(rawText)?.[1] ?? null,
      batchCount: readBatch(rawText),
      transfer: readTransfer(rawText),
      status,
      accepted: isAccepted(status, profile),
    });
  }

  return { rows, problems, currency: currency ?? profile.currency };
}

function isAccepted(status: string | null, profile: StatementProfile): boolean {
  if (profile.statusAccepts.length === 0) return true;
  const value = (status ?? '').trim().toUpperCase();
  return profile.statusAccepts.some((accepted) => accepted.toUpperCase() === value);
}

function signedAmount(at: (column: number) => string, columns: StatementColumns): number | null {
  const fee = columns.fee >= 0 ? (parseStatementAmount(at(columns.fee)) ?? 0) : 0;

  if (columns.amount >= 0) {
    const stated = parseStatementAmount(at(columns.amount));
    if (stated === null) return null;
    // The fee is written as a positive charge whichever way the amount points,
    // so it is always subtracted.
    return roundCents(stated - Math.abs(fee));
  }

  const debit = parseStatementAmount(at(columns.debit));
  const credit = parseStatementAmount(at(columns.credit));
  if (debit === null && credit === null) return null;
  // Both columns filled is not a row this can read: which one is the movement
  // is exactly the question, and answering it by subtracting would invent a
  // transaction the bank never made.
  if (debit !== null && credit !== null) return null;
  const movement = debit !== null ? -Math.abs(debit) : Math.abs(credit ?? 0);
  return roundCents(movement - Math.abs(fee));
}

function currencyFromHeader(header: readonly string[], profile: StatementProfile): string | null {
  if (profile.currencyInHeader < 0 || header.length === 0) return null;
  const fields = splitCsvLine(header[0] ?? '', profile.delimiter);
  const cell = (fields[profile.currencyInHeader] ?? '').trim();
  return /\b([A-Z]{3})\b/.exec(cell)?.[1] ?? null;
}

function cleanText(text: string, profile: StatementProfile): string {
  let cleaned = text.trim();
  for (const pattern of profile.strip) cleaned = cleaned.replace(new RegExp(pattern, 'gi'), ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  // A batched payment line is nothing but boilerplate, so stripping it leaves
  // an empty string. Falling back to what the file said beats handing a view a
  // row with no description at all.
  return cleaned || text.trim();
}

function readBatch(text: string): number | null {
  const match = BATCH.exec(text);
  return match?.[1] ? Number(match[1]) : null;
}

function readTransfer(text: string): BankStatementRow['transfer'] {
  const match = TRANSFER.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return {
    account: match[2].trim(),
    name: match[3].trim(),
    direction: match[1].toLowerCase() === 'von' ? 'in' : 'out',
  };
}

/** Where a stated balance and the movements stop agreeing. */
export interface BalanceBreak {
  line: number;
  expected: number;
  stated: number;
}

/**
 * Checks the running balance against the movements.
 *
 * **The reason to bother importing rather than typing.** Every row states the
 * balance after it, so if the chain holds from the first row to the last then
 * nothing was dropped, nothing was counted twice, and no sign was read
 * backwards. A break names the first row where it stopped adding up, which is
 * usually the row whose format the profile has wrong.
 */
export function reconcileStatement(
  rows: readonly BankStatementRow[],
  newestFirst: boolean
): { ok: boolean; breaks: BalanceBreak[]; opening: number | null } {
  const ordered = newestFirst ? [...rows].reverse() : [...rows];
  const withBalance = ordered.filter((row) => row.balance !== null);
  if (withBalance.length === 0) return { ok: true, breaks: [], opening: null };

  // One row states an opening perfectly well: the balance it leaves behind,
  // less what it moved. It is only the chain that needs two, and a month with a
  // single transaction in it is not unusual enough to give up on.
  const breaks: BalanceBreak[] = [];
  for (let index = 1; index < withBalance.length; index += 1) {
    const previous = withBalance[index - 1];
    const current = withBalance[index];
    if (!previous || !current || previous.balance === null || current.balance === null) continue;

    const expected = roundCents(previous.balance + current.amount);
    if (Math.abs(expected - current.balance) > 0.005) {
      breaks.push({ line: current.line, expected, stated: current.balance });
    }
  }

  const first = withBalance[0];
  return {
    ok: breaks.length === 0,
    breaks,
    opening: first && first.balance !== null ? roundCents(first.balance - first.amount) : null,
  };
}

/**
 * What makes a row the same row on a second import.
 *
 * Three fallbacks, in descending order of how much they can be trusted.
 *
 * The bank's own reference, when the export carries one, because it is the only
 * thing the bank promises is unique.
 *
 * Failing that, the **running balance**, which is unique within an account by
 * construction: no two rows can leave the same balance behind unless nothing
 * moved. This one was added after a real card export turned up three identical
 * `Apple -4.00` charges settled in the same second on the same day. The date,
 * the amount and the text together made them one row, and a second import of
 * that month would have skipped two of the three as already present.
 *
 * Failing both, the date, the amount and the text, with an occurrence number
 * appended where that still collides. Stable only while the export is, which is
 * why it is last.
 */
export function statementRowKey(row: BankStatementRow): string {
  if (row.reference) return `ref:${safeInLine(row.reference)}`;
  const amount = row.amount.toFixed(2);
  if (row.balance !== null) return `${row.date}~${amount}~bal:${row.balance.toFixed(2)}`;
  return `${row.date}~${amount}~${safeInLine(row.rawText.trim())}`;
}

/**
 * A key has to survive being written into a journal line and read back.
 *
 * The line's fields are separated by `|`, so a key containing one is cut short
 * on the next read: a composite key came back as just its date, stopped
 * matching the row it was made from, and that row was offered for import all
 * over again. Which defeats the entire purpose of having a key.
 *
 * Found in a real vault, where a TWINT payment with no bank reference stored
 * `2026-01-12|-40.50|bal:367.67` and read back as `2026-01-12`.
 */
function safeInLine(text: string): string {
  return text.replace(/\|/g, '/');
}

/**
 * Where a description stops naming who was paid.
 *
 * A Swiss e-banking description is three parts and only the first is the
 * counterparty: the name and address, then `Mitteilung:` -- the reference the
 * payer typed -- then `Ursprünglicher Auftraggeber:`, the person or standing
 * order that set the payment up. The last two are about the payer's own side.
 *
 * A shared constant rather than a profile field, because no other format read
 * so far prints either marker, so for every other profile this is a no-op. The
 * day one does print something different, this becomes a profile field and
 * this comment is the reason it was not one already.
 */
const COUNTERPARTY_ENDS = /\s*(Mitteilung:|Urspr(ü|ue)nglicher Auftraggeber:)/i;

/**
 * The part of a description that names who was paid.
 *
 * This is what a text rule should be matched against, and what a learned rule
 * should be made from. Matching the whole description means a rule about a
 * counterparty can fire on a row where that name is only the originator --
 * which is how a household's own name, learned from one transfer, came to
 * match every standing order that person had ever set up.
 *
 * Found twice in one vault. `Stefan Muster` learned for one account then
 * matched `Ursprünglicher Auftraggeber: STEFAN MUSTER` on unrelated rows
 * and produced postings from an account to itself. `ERIKA MUSTER-BEISPIEL`,
 * learned from a genuine transfer to an account in her name, then matched the
 * originator field on a health-insurance premium and filed it into the house
 * account. The second is the dangerous shape: it is not a self-posting, so
 * nothing catches it, and the figure is simply in the wrong place.
 *
 * Whitespace-trimmed, and never empty: a description that is nothing but
 * markers comes back as the whole description rather than as a blank that
 * would match every rule.
 */
export function counterpartyOf(text: string): string {
  const head = text.split(COUNTERPARTY_ENDS)[0]?.trim() ?? '';
  return head === '' ? text.trim() : head;
}

/**
 * The keys for a whole file, with collisions numbered apart.
 *
 * Use this rather than mapping `statementRowKey` yourself. Two rows that a key
 * cannot separate get `#1` and `#2` in the order the file lists them, which
 * holds for as long as the export is deterministic. It is the last resort, and
 * a caller that has reached it should say so before writing anything.
 */
export function statementRowKeys(rows: readonly BankStatementRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = statementRowKey(row);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? key : `${key}#${count}`;
  });
}

/**
 * The rows that count: read, final, and in date order oldest first.
 *
 * Everything else is still in `parsed.rows`. A pending row is not dropped from
 * sight, it is simply not offered for posting, because a card authorisation
 * that never settles is not money that moved.
 */
export function acceptedRows(
  parsed: ParsedStatement,
  profile: StatementProfile
): BankStatementRow[] {
  const accepted = parsed.rows.filter((row) => row.accepted);
  const ordered = profile.newestFirst ? [...accepted].reverse() : accepted;
  return ordered;
}
