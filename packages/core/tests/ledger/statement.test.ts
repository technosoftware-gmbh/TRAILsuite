/**
 * Reading a bank statement export.
 *
 * The fixture below has the exact shape of the real file this was written
 * against: the same columns, the same date format, the same apostrophe
 * thousands, the same newest-row-first order, the same batched payment lines
 * and the same transfer wording. **The figures, names and account numbers are
 * invented.** A test suite is not a place to keep somebody's salary.
 *
 * The balance chain is arithmetically sound, because the check that matters
 * most here is the one that proves an import dropped nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  CARD_ACCOUNT_PROFILE,
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  parseStatement,
  parseStatementAmount,
  parseStatementDate,
  reconcileStatement,
  splitCsvLine,
  statementRowKey,
  statementRowKeys,
} from '../../src/ledger/statement.js';
import {
  accountForBankNumber,
  looksLikeIban,
  normalizeBankAccount,
  normalizeIban,
  parseAccount,
  type AccountProperties,
} from '../../src/ledger/account.js';

const FIXTURE = [
  'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;',
  '19.08.2026;19.08.2026;" Belastung e-banking / Ref.-Nr. 1000000001 MUSTER ELEKTRO AG ";120.00;;1\'380.00;',
  '14.08.2026;14.08.2026;" Zahlungsauftrag e-banking (Anzahl Buchungen: 3 / Ref.-Nr. 1000000002) ";500.00;;1\'500.00;',
  '11.08.2026;11.08.2026;" Übertrag von 0510.5272.2002 Muster Anna / Ref.-Nr. 1000000003 ";;2\'000.00;2\'000.00;',
  '04.08.2026;04.08.2026;" Übertrag auf 0204.4243.2002 Muster Beat / Ref.-Nr. 1000000004 ";250.00;;0.00;',
  '01.08.2026;01.08.2026;" Zahlungseingang / Ref.-Nr. 1000000005 BEISPIEL AG ";;300.00;250.00;',
  '',
].join('\n');

const P: AccountProperties = {
  numberProperty: 'number',
  kindProperty: 'kind',
  groupProperty: 'group',
  currencyProperty: 'currency',
  openingProperty: 'opening',
  openingDateProperty: 'openingDate',
  closedProperty: 'closed',
  ibanProperty: 'iban',
  bankAccountProperty: 'bankAccount',
  personProperty: 'person',
};

describe('splitCsvLine', () => {
  it('keeps a quoted field whole, delimiter and all', () => {
    expect(splitCsvLine('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
  });

  it('reads a doubled quote as one', () => {
    expect(splitCsvLine('a;"say ""hi""";b', ';')).toEqual(['a', 'say "hi"', 'b']);
  });

  it('keeps the empty field a trailing delimiter makes', () => {
    expect(splitCsvLine('a;b;', ';')).toEqual(['a', 'b', '']);
  });
});

describe('parseStatementAmount', () => {
  it('reads the apostrophe thousands a Swiss export writes', () => {
    expect(parseStatementAmount("3'518.96")).toBe(3518.96);
    expect(parseStatementAmount("7'500.20")).toBe(7500.2);
  });

  it('reads a blank cell as nothing rather than as zero', () => {
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('   ')).toBeNull();
  });

  it('reads a negative balance', () => {
    expect(parseStatementAmount("-2'580.41")).toBe(-2580.41);
  });
});

describe('parseStatementDate', () => {
  it('reads the day-first format', () => {
    expect(parseStatementDate('19.08.2026', 'DD.MM.YYYY')).toBe('2026-08-19');
    expect(parseStatementDate('01.01.2026', 'DD.MM.YYYY')).toBe('2026-01-01');
  });

  it('reads the other formats it claims to', () => {
    expect(parseStatementDate('2026-08-19', 'YYYY-MM-DD')).toBe('2026-08-19');
    expect(parseStatementDate('08/19/2026', 'MM/DD/YYYY')).toBe('2026-08-19');
  });

  it('refuses a day that does not exist, rather than rolling it over', () => {
    // A 31st of February is a format read the wrong way round, and rolling it
    // into March would put money in the wrong month with nobody told.
    expect(parseStatementDate('31.02.2026', 'DD.MM.YYYY')).toBeNull();
    expect(parseStatementDate('19.08.2026', 'MM/DD/YYYY')).toBeNull();
  });

  it('refuses a heading rather than reading it as a row', () => {
    expect(parseStatementDate('Buchung', 'DD.MM.YYYY')).toBeNull();
  });
});

describe('the Swiss e-banking export', () => {
  const parsed = parseStatement(FIXTURE, SWISS_EBANKING_PROFILE);

  it('reads every row and nothing else', () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toHaveLength(5);
  });

  it('takes the currency out of the balance column heading', () => {
    // The file already says. A setting that could disagree with it is a setting
    // that eventually will.
    expect(parsed.currency).toBe('CHF');
    expect(parsed.rows[0]?.currency).toBe('CHF');
  });

  it('signs a debit negative and a credit positive', () => {
    expect(parsed.rows[0]?.amount).toBe(-120);
    expect(parsed.rows[2]?.amount).toBe(2000);
  });

  it('strips the boilerplate off, leaving the counterparty', () => {
    expect(parsed.rows[0]?.text).toBe('MUSTER ELEKTRO AG');
    expect(parsed.rows[4]?.text).toBe('BEISPIEL AG');
  });

  it('keeps the line when a batch line is nothing but boilerplate', () => {
    // Stripping a batched payment line leaves an empty string, and a row with
    // no description at all is worse than a wordy one.
    expect(parsed.rows[1]?.text).toContain('Anzahl Buchungen: 3');
  });

  it('keeps what the file actually said, because the cleaning is a guess', () => {
    expect(parsed.rows[0]?.rawText).toContain('Ref.-Nr. 1000000001');
  });

  it('reads the bank reference, which is what identifies a row again later', () => {
    expect(parsed.rows[0]?.reference).toBe('1000000001');
  });

  it('sees that one line is really three payments', () => {
    // The line the whole split design exists for: the bank posts ten invoices
    // as one debit, and ten bills cannot be settled by one posting.
    expect(parsed.rows[1]?.batchCount).toBe(3);
    expect(parsed.rows[0]?.batchCount).toBeNull();
  });

  it('reads an internal transfer and which way it went', () => {
    expect(parsed.rows[2]?.transfer).toEqual({
      account: '0510.5272.2002',
      name: 'Muster Anna',
      direction: 'in',
    });
    expect(parsed.rows[3]?.transfer?.direction).toBe('out');
  });

  it('reports a row it cannot read rather than losing the file', () => {
    const broken = parseStatement(`${FIXTURE}kaputt;;;;;;\n`, SWISS_EBANKING_PROFILE);
    expect(broken.rows).toHaveLength(5);
    expect(broken.problems[0]?.reason).toBe('no-date');
  });

  it('refuses a row with a figure in both money columns', () => {
    // Which of the two is the movement is exactly the question, and subtracting
    // one from the other would invent a transaction the bank never made.
    const both = parseStatement(
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;\n01.08.2026;01.08.2026;"x";10.00;5.00;0.00;\n',
      SWISS_EBANKING_PROFILE
    );
    expect(both.problems[0]?.reason).toBe('no-amount');
  });
});

describe('reconcileStatement', () => {
  const parsed = parseStatement(FIXTURE, SWISS_EBANKING_PROFILE);

  it('proves the chain holds from the first row to the last', () => {
    const result = reconcileStatement(parsed.rows, SWISS_EBANKING_PROFILE.newestFirst);
    expect(result.ok).toBe(true);
    expect(result.breaks).toEqual([]);
  });

  it('gives the balance the file starts from, which nothing else states', () => {
    const result = reconcileStatement(parsed.rows, SWISS_EBANKING_PROFILE.newestFirst);
    expect(result.opening).toBe(-50);
  });

  it('gives the opening from a single row, which needs no chain', () => {
    const one = parseStatement(
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;\n05.01.2026;05.01.2026;" x ";130.00;;-1500.04;\n',
      SWISS_EBANKING_PROFILE
    );
    const result = reconcileStatement(one.rows, SWISS_EBANKING_PROFILE.newestFirst);
    expect(result.opening).toBe(-1370.04);
    expect(result.ok).toBe(true);
  });

  it('names the first row where it stops adding up', () => {
    const tampered = FIXTURE.replace("1'380.00", "1'390.00");
    const rows = parseStatement(tampered, SWISS_EBANKING_PROFILE).rows;
    const result = reconcileStatement(rows, SWISS_EBANKING_PROFILE.newestFirst);
    expect(result.ok).toBe(false);
    expect(result.breaks[0]).toMatchObject({ line: 2, expected: 1380, stated: 1390 });
  });
});

describe('recognising a row again on a second import', () => {
  const parsed = parseStatement(FIXTURE, SWISS_EBANKING_PROFILE);

  it('uses the bank reference when there is one', () => {
    expect(parsed.rows[0] && statementRowKey(parsed.rows[0])).toBe('ref:1000000001');
  });

  it('falls back to the running balance, which no two rows can share', () => {
    const noRef = parseStatement(
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;\n01.08.2026;01.08.2026;"Kiosk";4.50;;10.00;\n',
      SWISS_EBANKING_PROFILE
    );
    expect(noRef.rows[0] && statementRowKey(noRef.rows[0])).toBe('2026-08-01~-4.50~bal:10.00');
  });

  it('separates rows a real export made identical', () => {
    // Three charges of the same amount to the same merchant, settled in the
    // same second on the same day. This is from a real card export, and the
    // date-amount-text key made all three one row: a second import of that
    // month would have skipped two of the three as already present.
    const identical = [
      'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
      'Kartenbezahlung,Giro,2026-07-01 03:27:38,2026-07-01 03:27:38,Apple,-4.00,0.00,CHF,ABGESCHLOSSEN,96.00',
      'Kartenbezahlung,Giro,2026-07-01 03:27:38,2026-07-01 03:27:38,Apple,-4.00,0.00,CHF,ABGESCHLOSSEN,92.00',
      'Kartenbezahlung,Giro,2026-07-01 03:27:38,2026-07-01 03:27:38,Apple,-4.00,0.00,CHF,ABGESCHLOSSEN,88.00',
    ].join('\n');
    const rows = parseStatement(identical, CARD_ACCOUNT_PROFILE).rows;
    expect(new Set(statementRowKeys(rows)).size).toBe(3);
  });

  it('numbers apart what nothing else can separate', () => {
    const noBalance = {
      ...(parsed.rows[0] as NonNullable<(typeof parsed.rows)[0]>),
      reference: null,
      balance: null,
    };
    expect(statementRowKeys([noBalance, noBalance])).toEqual([
      statementRowKey(noBalance),
      `${statementRowKey(noBalance)}#2`,
    ]);
  });
});

describe('resolving a transfer to an account note', () => {
  function account(number: number, extra: Record<string, unknown>) {
    const parsed = parseAccount({ number, ...extra }, `Konto ${number}`, P);
    if (!parsed) throw new Error('unreadable fixture');
    return parsed;
  }

  const accounts = [
    account(1021, { bankAccount: '0510.5272.2002' }),
    account(1011, { iban: 'CH93 0076 2011 6238 5295 7' }),
  ];

  it('finds the account a printed number belongs to', () => {
    expect(accountForBankNumber(accounts, '0510.5272.2002')?.number).toBe(1021);
  });

  it('does not care how either side was punctuated', () => {
    expect(accountForBankNumber(accounts, '0510-5272-2002')?.number).toBe(1021);
    expect(accountForBankNumber(accounts, '051052722002')?.number).toBe(1021);
    expect(accountForBankNumber(accounts, 'ch9300762011623852957')?.number).toBe(1011);
  });

  it('finds the account whose IBAN contains the printed number', () => {
    // What a Swiss statement actually does: it prints the account number while
    // the note carries the IBAN, and the one is inside the other. Comparing
    // them as equals matched nothing, so every transfer between two of the
    // household's own accounts had to be assigned by hand.
    const withIban = [account(1021, { iban: 'CH04 0076 1099 8877 6600 2' })];
    expect(accountForBankNumber(withIban, '0998.8776.6002')?.number).toBe(1021);
  });

  it('will not match a fragment', () => {
    const withIban = [account(1021, { iban: 'CH04 0076 1099 8877 6600 2' })];
    expect(accountForBankNumber(withIban, '6002')).toBeNull();
  });

  it('refuses when two IBANs both end in the same digits', () => {
    const ambiguous = [
      account(1021, { iban: 'CH04 0076 1099 8877 6600 2' }),
      account(1031, { iban: 'CH47 0088 1099 8877 6600 2' }),
    ];
    expect(accountForBankNumber(ambiguous, '0998.8776.6002')).toBeNull();
  });

  it('returns nothing rather than a guess', () => {
    // A transfer posted to the wrong account is worse than one left for a
    // person to assign.
    expect(accountForBankNumber(accounts, '9999.9999.9999')).toBeNull();
    expect(accountForBankNumber(accounts, '')).toBeNull();
  });

  it('tells an IBAN from a printed account number by its shape', () => {
    // So that one field on screen can hold either. Asking somebody which kind
    // they are about to type is asking them to do the parser's job, and a wrong
    // guess costs nothing because the reader tries both properties anyway.
    expect(looksLikeIban('CH93 0076 2011 6238 5295 7')).toBe(true);
    expect(looksLikeIban('ch9300762011623852957')).toBe(true);
    expect(looksLikeIban('0510.5272.2002')).toBe(false);
    expect(looksLikeIban('')).toBe(false);
    expect(looksLikeIban(null)).toBe(false);
  });

  it('normalises both forms the same way every time', () => {
    expect(normalizeIban('ch93 0076-2011')).toBe('CH9300762011');
    expect(normalizeBankAccount('0510.5272.2002')).toBe('051052722002');
    expect(normalizeBankAccount('keine')).toBeNull();
  });
});

/**
 * The card account export, which shares not one structural decision with the
 * bank export above: comma separated, oldest row first, ISO timestamps, one
 * signed amount column, a fee beside it, and an explicit status.
 *
 * Same disclaimer as the fixture above. Shape real, figures invented.
 */
const CARD_FIXTURE = [
  'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
  'Kartenbezahlung,Giro,2026-06-30 17:11:27,2026-07-01 03:27:38,Muster Shop,-4.00,0.00,CHF,ABGESCHLOSSEN,96.00',
  'Belastung,Giro,2026-07-01 05:09:04,2026-07-01 05:09:04,Abo Gebuehr,0.00,19.00,CHF,ABGESCHLOSSEN,77.00',
  'Einzahlung,Giro,2026-07-09 08:00:00,2026-07-09 08:00:00,Zahlung von Muster Beat,300.00,0.00,CHF,ABGESCHLOSSEN,377.00',
  'Kartenbezahlung,Giro,2026-07-31 19:00:00,2026-07-31 19:00:00,Muster Kiosk,-7.00,0.00,CHF,AUSSTEHEND,370.00',
  '',
].join('\n');

describe('the card account export', () => {
  const parsed = parseStatement(CARD_FIXTURE, CARD_ACCOUNT_PROFILE);

  it('reads a comma separated file with an oldest-first order', () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0]?.date).toBe('2026-07-01');
  });

  it('books a payment on the day it settled, not the day it was made', () => {
    // Made on the last evening of June, settled on the first of July. July is
    // the month whose balance it changed.
    expect(parsed.rows[0]?.date).toBe('2026-07-01');
    expect(parsed.rows[0]?.valueDate).toBe('2026-06-30');
  });

  it('drops the time off a timestamp rather than choking on it', () => {
    expect(parsed.rows[2]?.date).toBe('2026-07-09');
  });

  it('subtracts a fee that stands beside an amount of zero', () => {
    // The row that would otherwise post nothing and leave every later balance
    // out by the fee.
    expect(parsed.rows[1]?.amount).toBe(-19);
  });

  it('takes the currency from the row rather than from a heading', () => {
    expect(parsed.rows[0]?.currency).toBe('CHF');
  });

  it('reads a row that has not settled, and does not accept it', () => {
    expect(parsed.rows[3]?.status).toBe('AUSSTEHEND');
    expect(parsed.rows[3]?.accepted).toBe(false);
    expect(acceptedRows(parsed, CARD_ACCOUNT_PROFILE)).toHaveLength(3);
  });

  it('reconciles once the pending row is left out', () => {
    const result = reconcileStatement(acceptedRows(parsed, CARD_ACCOUNT_PROFILE), false);
    expect(result.ok).toBe(true);
    expect(result.opening).toBe(100);
  });
});

describe('acceptedRows', () => {
  it('hands both formats back oldest first, whatever order they were written in', () => {
    const bank = parseStatement(FIXTURE, SWISS_EBANKING_PROFILE);
    const card = parseStatement(CARD_FIXTURE, CARD_ACCOUNT_PROFILE);
    expect(acceptedRows(bank, SWISS_EBANKING_PROFILE)[0]?.date).toBe('2026-08-01');
    expect(acceptedRows(card, CARD_ACCOUNT_PROFILE)[0]?.date).toBe('2026-07-01');
  });
});

describe('a key that has to survive a journal line', () => {
  it('never contains the separator the line format uses', () => {
    // Found in a real vault: a TWINT payment with no bank reference stored
    // `2026-01-12|-40.50|bal:367.67` and read back as `2026-01-12`, because the
    // line splits on `|`. The row stopped matching its own key and would have
    // been imported a second time, which is the one thing the key exists to
    // prevent.
    const file =
      'Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;\n' +
      '12.01.2026;11.01.2026;TWINT-Zahlung FREITAG LAB. AG, ZURICH;40.50;;367.67;\n';
    const parsed = parseStatement(file, SWISS_EBANKING_PROFILE);
    const key = parsed.rows[0] && statementRowKey(parsed.rows[0]);

    expect(key).not.toContain('|');
    expect(key).toBe('2026-01-12~-40.50~bal:367.67');
  });

  it('strips a bar out of a bank reference too', () => {
    const row = {
      line: 2,
      date: '2026-01-12',
      valueDate: null,
      text: 'x',
      rawText: 'x',
      amount: -1,
      currency: 'CHF',
      balance: null,
      reference: 'A|B',
      batchCount: null,
      transfer: null,
      status: null,
      accepted: true,
    };
    expect(statementRowKey(row)).toBe('ref:A/B');
  });
});
