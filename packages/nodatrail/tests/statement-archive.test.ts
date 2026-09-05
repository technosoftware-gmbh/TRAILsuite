/**
 * Naming an archived statement, and reading the name back.
 *
 * The round trip is the whole of it: a name this plugin writes has to be one it
 * can read, or the archive is a folder of files nothing can say anything about.
 */
import { describe, expect, it } from 'vitest';
import {
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  parseStatement,
  type BankStatementRow,
} from '@technosoftware/trail-core';
import {
  profileFor,
  readStatementFileName,
  statementFileName,
} from '../src/ledger/statement-archive';

const SWISS = [
  'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
  '30.06.2026;30.06.2026;Zinszahlung;600.35;;431.16;',
  '25.02.2026;25.02.2026;Übertrag;;1000.00;1155.26;',
  '',
].join('\n');

const CARD = [
  'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
  'Einzahlung,Giro,2026-04-01 12:03:30,2026-04-01 12:03:31,Zahlung,1000.00,0.00,CHF,ABGESCHLOSSEN,1000.00',
  'Kartenbezahlung,Giro,2026-06-26 11:08:06,2026-06-27 03:02:29,Tom Tasty,-101.92,0.00,CHF,ABGESCHLOSSEN,469.57',
  '',
].join('\n');

/**
 * A row with only the field the name is built from.
 *
 * The two callers below used to cast a `{ date }` literal straight to
 * `BankStatementRow`, which compiles for any shape at all and is exactly how a
 * fixture stops matching the type it claims. A builder says the same thing
 * without the cast, and fails when the row grows a required field.
 */
function dated(date: string): BankStatementRow {
  return {
    line: 1,
    date,
    valueDate: null,
    text: '',
    rawText: '',
    amount: 0,
    currency: 'CHF',
    balance: null,
    reference: null,
    batchCount: null,
    transfer: null,
    status: null,
    accepted: true,
  };
}

describe('the name an archived statement is filed under', () => {
  it('carries the period it covers and the account it went into', () => {
    // `acceptedRows` hands them over oldest first whichever way the file was
    // written, so the name is built from the file's own order rather than from
    // the order the bank happened to print.
    const rows = acceptedRows(
      parseStatement(SWISS, SWISS_EBANKING_PROFILE),
      SWISS_EBANKING_PROFILE
    );
    expect(statementFileName(1030, rows)).toBe('20260225-20260630_1030.csv');
  });

  it('reads back what it wrote', () => {
    const name = statementFileName(1013, [dated('2026-04-01'), dated('2026-06-26')]);
    expect(name).toBe('20260401-20260626_1013.csv');
    expect(readStatementFileName(name)).toEqual({
      from: '2026-04-01',
      to: '2026-06-26',
      account: 1013,
    });
  });

  it('survives a single-row file, where the period is one day', () => {
    const one = [dated('2026-05-04')];
    expect(statementFileName(1005, one)).toBe('20260504-20260504_1005.csv');
  });

  it('recognises nothing it did not write', () => {
    // A file somebody dropped in themselves is left alone. Guessing would put a
    // statement against an account it has nothing to do with, and report rows
    // unposted that were never that account's to post.
    for (const name of [
      'Kontoauszug_1011.csv',
      'accountstatement_1013.csv',
      '20260401-20260626_1013 2.csv',
      '20260401_1013.csv',
      '20260401-20260626_1013.pdf',
    ]) {
      expect(readStatementFileName(name), name).toBeNull();
    }
  });
});

describe('working out which format an archived file is in', () => {
  // The name deliberately does not say, so it is worked out from the contents.
  // The two formats differ in their delimiter, which makes this decisive: a
  // comma-separated file read as semicolon-separated is one column and no rows.
  it('picks the Swiss profile for a semicolon file', () => {
    expect(profileFor(SWISS)?.name).toBe('Swiss e-banking (CSV)');
  });

  it('picks the card profile for a comma file', () => {
    expect(profileFor(CARD)?.name).toBe('Card account (CSV)');
  });

  it('says nothing for a file that is not a statement', () => {
    expect(profileFor('# A note\n\nSome prose.\n')).toBeNull();
    expect(profileFor('')).toBeNull();
  });
});
