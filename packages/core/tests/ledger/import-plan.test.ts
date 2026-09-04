/**
 * What an import would do before it does it.
 *
 * The two tests that matter most are the ones about a movement arriving twice.
 * Everything else here is bookkeeping; those two are the difference between a
 * balance you can trust and one you cannot.
 */
import { describe, expect, it } from 'vitest';
import { parseAccount, type AccountProperties } from '../../src/ledger/account.js';
import { findMirror, planImport, postingFor, ruleFrom } from '../../src/ledger/import-plan.js';
import { parseJournal } from '../../src/ledger/journal.js';
import {
  CARD_ACCOUNT_PROFILE,
  SWISS_EBANKING_PROFILE,
  acceptedRows,
  parseStatement,
} from '../../src/ledger/statement.js';
import type { Account } from '../../src/ledger/types.js';

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

function account(number: number, extra: Record<string, unknown> = {}): Account {
  const parsed = parseAccount({ number, currency: 'CHF', ...extra }, `Konto ${number}`, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

const ACCOUNTS = [
  account(1005),
  account(1011, { bankAccount: '0204.4243.2002' }),
  account(1013),
  account(1021, { bankAccount: '0510.5272.2002' }),
  // The house account a standing monthly transfer arrives in, and the expense
  // account its interest leaves by. Both real, from the vault this was found in.
  account(1030),
  account(3010, { kind: 'income' }),
  account(4003),
  account(4006, { kind: 'expense' }),
  account(4034),
];

const RULES = [
  { match: 'SWISSCOM', account: 4003 },
  { match: 'REVOLUT BANK UAB', account: 1013 },
  { match: 'MUSTER PHARMA AG', account: 3010 },
];

function bankRows(body: string) {
  const file = `Buchung;Valuta;Buchungstext;Belastung;Gutschrift;Saldo CHF;\n${body}`;
  return acceptedRows(parseStatement(file, SWISS_EBANKING_PROFILE), SWISS_EBANKING_PROFILE);
}

describe('the sign', () => {
  it('credits the account the money left and debits the other side', () => {
    const rows = bankRows(
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 1 SWISSCOM ";29.10;;100.00;\n'
    );
    const posting = rows[0] && postingFor(rows[0], 'k', 1011, 4003);
    expect(posting).toMatchObject({ debit: 4003, credit: 1011, amount: 29.1 });
  });

  it('turns round for money arriving', () => {
    const rows = bankRows(
      '24.07.2026;24.07.2026;" Zahlungseingang / Ref.-Nr. 2 MUSTER PHARMA AG ";;7500.00;100.00;\n'
    );
    const posting = rows[0] && postingFor(rows[0], 'k', 1011, 3010);
    expect(posting).toMatchObject({ debit: 1011, credit: 3010, amount: 7500 });
  });
});

describe('deciding the other side', () => {
  const rows = bankRows(
    [
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 11 SWISSCOM (SCHWEIZ) AG ";29.10;;100.00;',
      '24.07.2026;24.07.2026;" Übertrag von 0510.5272.2002 Muster Erika / Ref.-Nr. 12 ";;1000.00;129.10;',
      '20.07.2026;20.07.2026;" Belastung e-banking / Ref.-Nr. 13 UNBEKANNTER LADEN ";12.00;;-870.90;',
      '',
    ].join('\n')
  );
  const plan = planImport(rows, {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: RULES,
    existing: [],
  });

  it('takes the account number a transfer prints over any text rule', () => {
    const transfer = plan.proposals.find((p) => p.row.transfer);
    expect(transfer?.matchedBy).toBe('transfer');
    expect(transfer?.counterAccount).toBe(1021);
  });

  it('falls back to a text rule', () => {
    const swisscom = plan.proposals.find((p) => p.row.text.includes('SWISSCOM'));
    expect(swisscom).toMatchObject({ matchedBy: 'rule', counterAccount: 4003, status: 'ready' });
  });

  it('asks rather than guessing when nothing matches', () => {
    const unknown = plan.proposals.find((p) => p.row.text.includes('UNBEKANNTER'));
    expect(unknown?.status).toBe('needs-account');
    expect(unknown?.posting).toBeNull();
  });

  it('prefers the more specific of two rules that both match', () => {
    const rows2 = bankRows(
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 1 SWISSCOM (SCHWEIZ) AG ";29.10;;100.00;\n'
    );
    const specific = planImport(rows2, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [
        { match: 'SWISSCOM', account: 4003 },
        { match: 'SWISSCOM (SCHWEIZ) AG', account: 4034 },
      ],
      existing: [],
    });
    expect(specific.proposals[0]?.counterAccount).toBe(4034);
  });
});

describe('a batched payment line', () => {
  const rows = bankRows(
    '27.07.2026;27.07.2026;" Zahlungsauftrag e-banking (Anzahl Buchungen: 10 / Ref.-Nr. 21) ";3518.96;;100.00;\n'
  );
  const plan = planImport(rows, {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: RULES,
    existing: [],
  });

  it('is offered as a split rather than as one expense', () => {
    // Ten invoices behind one debit. Posting it as a single expense would be
    // wrong about every one of them.
    expect(plan.proposals[0]).toMatchObject({ status: 'needs-split', legCount: 10 });
    expect(plan.proposals[0]?.posting).toBeNull();
  });

  it('counts as needing attention rather than as ready', () => {
    expect(plan.ready).toBe(0);
    expect(plan.needsAttention).toBe(1);
  });
});

describe('the same row imported twice', () => {
  const rows = bankRows(
    '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 31 SWISSCOM ";29.10;;100.00;\n'
  );
  const first = planImport(rows, {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: RULES,
    existing: [],
  });

  it('is skipped on the second run', () => {
    const written = first.proposals[0]?.posting;
    expect(written?.importKey).toBe('ref:31');

    const again = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: written ? [written] : [],
    });
    expect(again.proposals[0]?.status).toBe('already-imported');
    expect(again.skipped).toBe(1);
  });
});

describe('one transfer, two statements', () => {
  // The case that costs the most and looks the most like it worked. Money moved
  // from the bank account to the card account. It is in the bank export as
  // money leaving and in the card export as money arriving.
  const fromBank = bankRows(
    '09.07.2026;09.07.2026;" Belastung e-banking / Ref.-Nr. 41 REVOLUT BANK UAB ";300.00;;100.00;\n'
  );

  const cardFile = [
    'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
    'Einzahlung,Giro,2026-07-09 11:17:20,2026-07-09 11:17:20,Zahlung von Muster Stefan,300.00,0.00,CHF,ABGESCHLOSSEN,464.73',
    '',
  ].join('\n');
  const fromCard = acceptedRows(
    parseStatement(cardFile, CARD_ACCOUNT_PROFILE),
    CARD_ACCOUNT_PROFILE
  );

  const bankPlan = planImport(fromBank, {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: RULES,
    existing: [],
  });
  const written = bankPlan.proposals[0]?.posting;

  it('posts it once from the first file', () => {
    expect(bankPlan.proposals[0]).toMatchObject({ status: 'ready', counterAccount: 1013 });
    expect(written).toMatchObject({ debit: 1013, credit: 1011, amount: 300 });
  });

  it('recognises the other end of it in the second file', () => {
    const cardPlan = planImport(fromCard, {
      intoAccount: 1013,
      accounts: ACCOUNTS,
      rules: [{ match: 'Zahlung von Muster Stefan', account: 1011 }],
      existing: written ? [written] : [],
    });
    // Different file, different key, same movement. The key alone could never
    // have caught this.
    expect(cardPlan.proposals[0]?.status).toBe('mirrors-existing');
    expect(cardPlan.proposals[0]?.mirrorOf).toBe(written);
    expect(cardPlan.ready).toBe(0);
  });

  it('allows the two ends to be dated a few days apart', () => {
    const late = [
      'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
      'Einzahlung,Giro,2026-07-11 11:17:20,2026-07-11 11:17:20,Zahlung von Muster Stefan,300.00,0.00,CHF,ABGESCHLOSSEN,464.73',
      '',
    ].join('\n');
    const plan = planImport(
      acceptedRows(parseStatement(late, CARD_ACCOUNT_PROFILE), CARD_ACCOUNT_PROFILE),
      {
        intoAccount: 1013,
        accounts: ACCOUNTS,
        rules: [{ match: 'Zahlung von Muster Stefan', account: 1011 }],
        existing: written ? [written] : [],
      }
    );
    expect(plan.proposals[0]?.status).toBe('mirrors-existing');
  });

  it('does not swallow a genuinely separate payment of the same amount', () => {
    const muchLater = [
      'Art,Produkt,Datum des Beginns,Datum des Abschlusses,Beschreibung,Betrag,Gebühr,Währung,Status,Kontostand',
      'Einzahlung,Giro,2026-07-24 09:17:49,2026-07-24 09:17:49,Zahlung von Muster Stefan,300.00,0.00,CHF,ABGESCHLOSSEN,764.73',
      '',
    ].join('\n');
    const plan = planImport(
      acceptedRows(parseStatement(muchLater, CARD_ACCOUNT_PROFILE), CARD_ACCOUNT_PROFILE),
      {
        intoAccount: 1013,
        accounts: ACCOUNTS,
        rules: [{ match: 'Zahlung von Muster Stefan', account: 1011 }],
        existing: written ? [written] : [],
      }
    );
    // Fifteen days apart is two transfers, not one counted twice.
    expect(plan.proposals[0]?.status).toBe('ready');
  });

  it('does not treat a payment to a shop as a mirror of anything', () => {
    // A shop is not an account the household owns, so its payment appears in
    // one statement only and can never arrive twice.
    const shop = bankRows(
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 51 SWISSCOM ";29.10;;100.00;\n'
    );
    const twice = [...shop, ...shop];
    const plan = planImport(twice, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: [],
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['ready', 'ready']);
  });
});

describe('two transfers that are not one transfer', () => {
  it('keeps money sent and money returned as two movements', () => {
    // A thousand out to the other account and a thousand back the same day.
    // Same pair, same amount, same date, and emphatically not a duplicate: the
    // mirror check requires the same direction for exactly this reason.
    const rows = bankRows(
      [
        '24.07.2026;24.07.2026;" Übertrag auf 0510.5272.2002 Muster Erika / Ref.-Nr. 61 ";1000.00;;100.00;',
        '24.07.2026;24.07.2026;" Übertrag von 0510.5272.2002 Muster Erika / Ref.-Nr. 62 ";;1000.00;1100.00;',
        '',
      ].join('\n')
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [],
      existing: [],
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['ready', 'ready']);
    // Oldest first, which for a newest-first export is the file read backwards.
    expect(plan.proposals.map((p) => [p.posting?.debit, p.posting?.credit])).toEqual([
      [1011, 1021],
      [1021, 1011],
    ]);
  });

  it('does catch the same direction twice inside one file', () => {
    // Which is what a duplicated export row looks like once the reference is
    // gone. The plan grows as it is made, so a row proposed earlier is a mirror
    // for one proposed later.
    const rows = bankRows(
      [
        '24.07.2026;24.07.2026;" Übertrag auf 0510.5272.2002 Muster Erika ";1000.00;;100.00;',
        '25.07.2026;25.07.2026;" Übertrag auf 0510.5272.2002 Muster Erika ";1000.00;;-900.00;',
        '',
      ].join('\n')
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [],
      existing: [],
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['ready', 'mirrors-existing']);
  });

  it('keeps two payments the bank numbered separately', () => {
    // The same-file backstop above is for a duplicated row once its reference
    // is gone. Two different `Ref.-Nr.` are the bank saying these are two
    // transactions, and that outranks a guess made from pair, amount and date.
    //
    // From a real vault: two card payments of CHF 500.00 two days apart, both
    // out of the same account to the same card. The second was dropped as a
    // mirror of the first and every balance after it was 500.00 out.
    const rows = bankRows(
      [
        '07.01.2026;07.01.2026;" Belastung e-banking / Ref.-Nr. 1485522061 REVOLUT BANK UAB ";500.00;;412.92;',
        '05.01.2026;05.01.2026;" Belastung e-banking / Ref.-Nr. 1484490806 REVOLUT BANK UAB ";500.00;;3007.26;',
        '',
      ].join('\n')
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: [],
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['ready', 'ready']);
    expect(plan.ready).toBe(2);
  });

  it('keeps them separate on a second import of the same file', () => {
    // The half of that bug the first fix missed, and the more dangerous half.
    //
    // Once the first payment is in the ledger, the second row no longer needs
    // the same-run pool to be swallowed: it mirrors an *existing* posting on
    // pair, amount and date. And because every other row of the file is
    // already imported by key, the run reports nothing to do -- a silent
    // refusal to repair the very balance the re-import was for.
    //
    // What tells the two cases apart is not the reference but where the
    // candidate came from: a posting carrying a key this file produces was
    // written by this same statement, so it is another of its rows and never
    // the far end of a transfer.
    const rows = bankRows(
      [
        '07.01.2026;07.01.2026;" Belastung e-banking / Ref.-Nr. 1485522061 REVOLUT BANK UAB ";500.00;;412.92;',
        '05.01.2026;05.01.2026;" Belastung e-banking / Ref.-Nr. 1484490806 REVOLUT BANK UAB ";500.00;;3007.26;',
        '',
      ].join('\n')
    );
    const existing = parseJournal(
      '2026-01-05 | 1013 | 1011 | CHF 500.00 | REVOLUT BANK UAB |  | ref:1484490806'
    ).postings;
    expect(existing[0]?.importKey).toBe('ref:1484490806');

    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing,
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['already-imported', 'ready']);
    expect(plan.ready).toBe(1);
  });

  it('still catches the far end of a transfer from another file', () => {
    // The guard above must not cost the mirror check its actual job. This
    // posting carries a reference the file being imported never mentions,
    // which is what a second bank's export of the same movement looks like.
    const rows = bankRows(
      [
        '05.01.2026;05.01.2026;" Belastung e-banking / Ref.-Nr. 1484490806 REVOLUT BANK UAB ";500.00;;3007.26;',
        '',
      ].join('\n')
    );
    const existing = parseJournal(
      '2026-01-06 | 1013 | 1011 | CHF 500.00 | Transfer, as the other bank wrote it |  | ref:9900000001'
    ).postings;

    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing,
    });
    expect(plan.proposals.map((p) => p.status)).toEqual(['mirrors-existing']);
  });
});

describe('a rule matches who was paid, not who paid', () => {
  // A Swiss e-banking description is three parts and only the first names the
  // counterparty: the name and address, then `Mitteilung:` -- what the payer
  // typed -- then `Ursprünglicher Auftraggeber:`, whoever set the payment up.
  // Matching the whole line let a rule about a counterparty fire on a row
  // where that name was only the originator.
  //
  // From a real vault, and it cost real money: `ERIKA MUSTER-BEISPIEL`,
  // learned from a genuine transfer to an account in her name, then matched
  // the originator field of a health-insurance premium and filed it into the
  // house account. Nothing caught it, because unlike the self-posting version
  // of this bug the result is a perfectly ordinary posting in the wrong place.
  const HOUSE = [{ match: 'ERIKA MUSTER-BEISPIEL', account: 1030, learned: true }];

  function ebanking(text: string, amount: string) {
    return bankRows(
      `26.05.2026;26.05.2026;" Belastung e-banking / Ref.-Nr. 1534745264 ${text} ";${amount};;100.00;\n`
    );
  }

  it('fires where the name is the counterparty', () => {
    const rows = ebanking(
      'ERIKA MUSTER-BEISPIEL MUSTERWEG 1 8000 ZUERICH Schweiz Mitteilung: HAUSZINS',
      '850.00'
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: HOUSE,
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.proposals[0]?.counterAccount).toBe(1030);
  });

  it('does not fire where the name is only the originator', () => {
    const rows = ebanking(
      'SWISSCOM (SCHWEIZ) AG ALTE TIEFENAUSTRASSE 6 3050 BERN Schweiz Ursprünglicher Auftraggeber: ERIKA MUSTER-BEISPIEL',
      '29.10'
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: HOUSE,
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('needs-account');
    expect(plan.proposals[0]?.counterAccount).toBeNull();
  });

  it('does not fire where the name is only in the message', () => {
    const rows = ebanking(
      'OSWALD NAHRUNGSMITTEL GMBH 6312 STEINHAUSEN Schweiz Mitteilung: AUFT. 10000820998/ERIKA MUSTER-BEISPIEL',
      '208.40'
    );
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: HOUSE,
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('needs-account');
  });

  it('still honours a rule learned from a whole description', () => {
    // Both sides are cut at the same place, so a rule carrying a message and
    // an originator keeps working -- and generalises to the vendor's later
    // rows, which is what somebody writing a rule for a shop meant. Without
    // that symmetry every rule ever learned would stop matching at once.
    const learned = [
      {
        match:
          'HEYLIGHT AG RUE DU NANT 8 1207 GENEVE Schweiz Mitteilung: H-EWUBVI Ursprünglicher Auftraggeber: STEFAN MUSTER',
        account: 4003,
        learned: true,
      },
    ];
    const later = ebanking(
      'HEYLIGHT AG RUE DU NANT 8 1207 GENEVE Schweiz Mitteilung: H-DOHL4Y Ursprünglicher Auftraggeber: STEFAN MUSTER',
      '58.98'
    );
    const plan = planImport(later, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: learned,
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.proposals[0]?.counterAccount).toBe(4003);
  });

  it('learns the counterparty rather than the whole description', () => {
    const rows = ebanking(
      'HEYLIGHT AG RUE DU NANT 8 1207 GENEVE Schweiz Mitteilung: H-EWUBVI Ursprünglicher Auftraggeber: STEFAN MUSTER',
      '47.47'
    );
    const row = rows[0];
    expect(row && ruleFrom(row, 4003).match).toBe('HEYLIGHT AG RUE DU NANT 8 1207 GENEVE Schweiz');
  });
});

describe('a transfer the other statement already posted', () => {
  // From a real vault, and the numbers are the real ones. A standing monthly
  // 850.00 leaves 1011 as a payment to a person's name and arrives in 1030 as a
  // payment from a person's name. The bank numbers the two legs separately --
  // unlike its own internal transfer, which prints one reference on both -- so
  // the import key cannot pair them, and neither row names an account.
  const ARRIVING =
    '24.04.2026;24.04.2026;" Zahlungseingang / Ref.-Nr. 1523340819 Stefan Muster ";;850.00;1221.51;';

  const booked = parseJournal(
    '2026-04-24 | 1030 | 1011 | CHF 850.00 | ERIKA MUSTER-BEISPIEL |  | ref:1523340467'
  ).postings;

  it('recognises it rather than asking, and names the account it came from', () => {
    const plan = planImport(bankRows(`${ARRIVING}\n`), {
      intoAccount: 1030,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: booked,
    });

    const proposal = plan.proposals[0];
    expect(proposal?.status).toBe('mirrors-existing');
    expect(proposal?.counterAccount).toBe(1011);
    expect(proposal?.matchedBy).toBe('transfer');
    // Nothing is written for it, which is the whole point: answering the
    // question it used to ask would have posted the movement a second time.
    expect(proposal?.posting).toBeNull();
    expect(plan.ready).toBe(0);
    expect(plan.needsAttention).toBe(0);
  });

  it('still asks when two postings fit, because picking one is how a ledger goes wrong', () => {
    const twice = parseJournal(
      [
        '2026-04-24 | 1030 | 1011 | CHF 850.00 | one |  | ref:1523340467',
        '2026-04-24 | 1030 | 1021 | CHF 850.00 | the other |  | ref:1523340468',
      ].join('\n')
    ).postings;

    const plan = planImport(bankRows(`${ARRIVING}\n`), {
      intoAccount: 1030,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: twice,
    });
    expect(plan.proposals[0]?.status).toBe('needs-account');
  });

  it('still asks when the booked posting is a day off', () => {
    // The three-day window `findMirror` uses is for two different banks booking
    // a transfer on different days. Both legs inside one bank are the same day,
    // so this lookup is same-day only and a day's distance means ask.
    const dayBefore = parseJournal(
      '2026-04-23 | 1030 | 1011 | CHF 850.00 | a day early |  | ref:1523340467'
    ).postings;

    const plan = planImport(bankRows(`${ARRIVING}\n`), {
      intoAccount: 1030,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: dayBefore,
    });
    expect(plan.proposals[0]?.status).toBe('needs-account');
  });

  it('still asks when the far side is not an account the household owns', () => {
    // An expense posted by hand on the same day for the same figure is not the
    // far end of a transfer, and treating it as one would drop a real row.
    const expense = parseJournal(
      '2026-04-24 | 1030 | 4006 | CHF 850.00 | an expense |  | ref:1523340467'
    ).postings;

    const plan = planImport(bankRows(`${ARRIVING}\n`), {
      intoAccount: 1030,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: expense,
    });
    expect(plan.proposals[0]?.status).toBe('needs-account');
  });
});

describe('findMirror', () => {
  const posting = parseJournal('2026-07-09 | 1013 | 1011 | 300.00 | x').postings[0];

  it('needs the same pair of accounts the same way round', () => {
    const reversed = parseJournal('2026-07-09 | 1011 | 1013 | 300.00 | x').postings;
    expect(posting && findMirror(posting, reversed, 3)).toBeNull();
  });

  it('needs the same amount', () => {
    const other = parseJournal('2026-07-09 | 1013 | 1011 | 300.50 | x').postings;
    expect(posting && findMirror(posting, other, 3)).toBeNull();
  });
});

describe('learning a rule', () => {
  it('remembers the counterparty as the file writes it', () => {
    const rows = bankRows(
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 71 ORELL FUESSLI THALIA AG ";79.70;;100.00;\n'
    );
    expect(rows[0] && ruleFrom(rows[0], 4036)).toEqual({
      match: 'ORELL FUESSLI THALIA AG',
      account: 4036,
      learned: true,
    });
  });
});

describe('a row that pays an invoice', () => {
  const openBill = {
    title: '20260801_Aquilana_1040269824',
    companyTitle: 'Aquilana',
    amount: 30.35,
    currency: 'CHF',
    account: 4031,
    lines: [],
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    paidDate: null,
    paidFrom: null,
  };

  const rows = bankRows(
    [
      '14.08.2026;14.08.2026;" Belastung e-banking / Ref.-Nr. 1563958107 AQUILANA VERSICHERUNGEN ";30.35;;100.00;',
      '05.08.2026;05.08.2026;" Belastung e-banking / Ref.-Nr. 1561138148 SWISSCOM (SCHWEIZ) AG ";29.10;;130.35;',
      '',
    ].join('\n')
  );

  it('takes the invoice account and says which invoice', () => {
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: [...ACCOUNTS, account(4031)],
      rules: RULES,
      existing: [],
      bills: [openBill],
    });

    const paid = plan.proposals.find((p) => p.row.amount === -30.35);
    expect(paid?.matchedBy).toBe('bill');
    expect(paid?.counterAccount).toBe(4031);
    expect(paid?.settles?.bill.title).toBe('20260801_Aquilana_1040269824');
    expect(plan.settled).toBe(1);
  });

  it('beats a text rule, because somebody classified that document by hand', () => {
    // The rule would send this to 4003; the invoice says 4034. A pattern that
    // happened to match must not overrule a person looking at the paper.
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: [],
      bills: [{ ...openBill, companyTitle: 'Swisscom', amount: 29.1, account: 4034 }],
    });

    const swisscom = plan.proposals.find((p) => p.row.amount === -29.1);
    expect(swisscom?.matchedBy).toBe('bill');
    expect(swisscom?.counterAccount).toBe(4034);
  });

  it('asks for the account of a matched invoice nobody has classified', () => {
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: [],
      bills: [{ ...openBill, account: null }],
    });

    const paid = plan.proposals.find((p) => p.row.amount === -30.35);
    expect(paid?.status).toBe('needs-account');
    // Which invoice it is, is still known: that is the half worth keeping.
    expect(paid?.settles?.bill.title).toBe('20260801_Aquilana_1040269824');
  });

  it('lets one invoice be paid once, however many rows would fit it', () => {
    // Two identical payments to one vendor is two payments. If both claimed the
    // single open bill it would be stamped paid twice and the second row would
    // be posted as though it settled something.
    const twice = bankRows(
      [
        '14.08.2026;14.08.2026;" Belastung e-banking / Ref.-Nr. 1 AQUILANA VERSICHERUNGEN ";30.35;;100.00;',
        '15.08.2026;15.08.2026;" Belastung e-banking / Ref.-Nr. 2 AQUILANA VERSICHERUNGEN ";30.35;;69.65;',
        '',
      ].join('\n')
    );

    const plan = planImport(twice, {
      intoAccount: 1011,
      accounts: [...ACCOUNTS, account(4031)],
      rules: [],
      existing: [],
      bills: [openBill],
    });

    expect(plan.settled).toBe(1);
    expect(plan.proposals.filter((p) => p.settles !== null)).toHaveLength(1);
    expect(plan.proposals.find((p) => p.settles === null)?.status).toBe('needs-account');
  });

  it('leaves every row alone when the vault holds no bills', () => {
    const plan = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: RULES,
      existing: [],
    });
    expect(plan.settled).toBe(0);
    expect(plan.proposals.find((p) => p.row.amount === -29.1)?.matchedBy).toBe('rule');
  });
});

describe('a row paying an invoice that divides across accounts', () => {
  // The real one: a telephone invoice with a credit line on it.
  const sunrise = {
    title: '20260101_SUNRISE_8108714124',
    companyTitle: 'Sunrise',
    amount: 122.7,
    currency: 'CHF',
    account: null,
    lines: [
      { account: 4034, amount: -4, note: 'Gutschrift' },
      { account: 4003, amount: 126.7, note: '' },
    ],
    issueDate: '2026-01-01',
    dueDate: '2026-01-31',
    paidDate: null,
    paidFrom: null,
  };

  const rows = bankRows(
    '27.07.2026;27.07.2026;" Belastung e-banking / Ref.-Nr. 1557486603 SUNRISE GMBH ";122.70;;100.00;\n'
  );

  const plan = planImport(rows, {
    intoAccount: 1011,
    accounts: [...ACCOUNTS, account(4003)],
    rules: [],
    existing: [],
    bills: [sunrise],
  });
  const proposal = plan.proposals[0];

  it('is ready without anybody opening the split editor', () => {
    // The invoice already says how it divides. Asking again would be asking
    // somebody to re-type what is written down twice.
    expect(proposal?.status).toBe('ready');
    expect(proposal?.matchedBy).toBe('bill');
  });

  it('carries the legs the invoice states', () => {
    expect(proposal?.legs).toEqual(sunrise.lines);
  });

  it('leaves the side the legs fill blank, and credits the account that paid', () => {
    expect(proposal?.posting).toMatchObject({ debit: null, credit: 1011, amount: 122.7 });
  });

  it('still settles the invoice', () => {
    expect(proposal?.settles?.bill.title).toBe('20260101_SUNRISE_8108714124');
    expect(plan.settled).toBe(1);
  });

  it('carries no legs on an ordinary row', () => {
    const plain = planImport(rows, {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [],
      existing: [],
      bills: [{ ...sunrise, lines: [], account: 4034 }],
    });
    expect(plain.proposals[0]?.legs).toEqual([]);
    expect(plain.proposals[0]?.counterAccount).toBe(4034);
  });
});
