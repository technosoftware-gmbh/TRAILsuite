/**
 * The chart of accounts.
 *
 * The tree is checked against the real household chart this was designed
 * against, because a tree that comes out in the wrong order is a report nobody
 * recognises.
 */
import { describe, expect, it } from 'vitest';
import {
  accountLabel,
  accountTree,
  accountsByNumber,
  accountsIn,
  duplicateNumbers,
  kindForNumber,
  parseAccount,
  strandedByNumber,
  type AccountProperties,
} from '../../src/ledger/account.js';
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

function account(number: number, title: string, group: string, kind?: Account['kind']): Account {
  const parsed = parseAccount({ number, group, kind, currency: 'CHF' }, title, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

describe('kindForNumber', () => {
  it('reads the Swiss household bands', () => {
    expect(kindForNumber(1005)).toBe('asset');
    expect(kindForNumber(2050)).toBe('liability');
    expect(kindForNumber(3010)).toBe('income');
    expect(kindForNumber(4001)).toBe('expense');
    expect(kindForNumber(5000)).toBe('expense');
  });

  it('claims nothing outside them', () => {
    expect(kindForNumber(999)).toBeNull();
    expect(kindForNumber(9000)).toBeNull();
  });
});

describe('parseAccount', () => {
  it('needs a number and nothing else', () => {
    const parsed = parseAccount({ number: 4001 }, 'IBB (Strom/Gas)', P);
    expect(parsed?.kind).toBe('expense');
    expect(parsed?.group).toBe('');
    expect(parsed?.opening).toBe(0);
  });

  it('refuses a note with no number, since a posting has nothing to name', () => {
    expect(parseAccount({ group: 'Haushalt' }, 'Something', P)).toBeNull();
  });

  it('lets a stated kind beat the number band', () => {
    // The whole point of storing the kind: a chart numbered differently is not
    // silently reinterpreted.
    const parsed = parseAccount({ number: 4001, kind: 'asset' }, 'Odd one', P);
    expect(parsed?.kind).toBe('asset');
  });

  it('trims stray slashes off a group path', () => {
    const parsed = parseAccount(
      { number: 4010, group: '/Gemeinsame Kosten/Renault Twingo/' },
      'x',
      P
    );
    expect(parsed?.group).toBe('Gemeinsame Kosten/Renault Twingo');
  });
});

describe('accountLabel', () => {
  it('does not say the number twice', () => {
    // The note is titled with its number in front, so every list that added the
    // number again read `1001 1001 Household cash EUR`.
    expect(accountLabel(account(1001, '1001 Household cash EUR', 'Haushalt'))).toBe(
      '1001 Household cash EUR'
    );
  });

  it('adds the number when the title does not carry it', () => {
    expect(accountLabel(account(4001, 'IBB (Strom/Gas)', 'Haushalt'))).toBe('4001 IBB (Strom/Gas)');
  });

  it('accepts the separators a person might have typed', () => {
    expect(accountLabel(account(1005, '1005 - Haushaltskonto', 'x'))).toBe('1005 - Haushaltskonto');
  });

  it('is not fooled by a title that merely starts with the same digits', () => {
    // Account 101 must not swallow a title beginning `1010`.
    expect(accountLabel(account(101, '1010 Bargeld', 'x'))).toBe('101 1010 Bargeld');
  });
});

describe('accountTree', () => {
  const accounts = [
    account(4020, 'Auto Renault Captur', 'Gemeinsame Kosten/Renault Captur'),
    account(4000, 'Haushaltsrechnungen', 'Gemeinsame Kosten/Haushalt, Versicherungen'),
    account(4010, 'Auto Renault Twingo', 'Gemeinsame Kosten/Renault Twingo'),
    account(4006, 'Zins Haus', 'Gemeinsame Kosten/Hypothek'),
    account(4001, 'IBB (Strom/Gas)', 'Gemeinsame Kosten/Haushalt, Versicherungen'),
    account(3010, 'Einkommen Netto Stefan', 'Erwerbseinkommen Netto'),
  ];

  it('groups by the path and orders by the lowest number beneath', () => {
    const tree = accountTree(accounts, 'expense');
    const shared = tree.children[0];
    expect(shared?.name).toBe('Gemeinsame Kosten');
    expect(shared?.children.map((child) => child.name)).toEqual([
      'Haushalt, Versicherungen',
      'Hypothek',
      'Renault Twingo',
      'Renault Captur',
    ]);
  });

  it('orders accounts inside a group by number', () => {
    const tree = accountTree(accounts, 'expense');
    const household = tree.children[0]?.children[0];
    expect(household?.accounts.map((a) => a.number)).toEqual([4000, 4001]);
  });

  it('keeps the kinds apart', () => {
    expect(accountsIn(accountTree(accounts, 'income')).map((a) => a.number)).toEqual([3010]);
    expect(accountsIn(accountTree(accounts, 'asset'))).toEqual([]);
  });
});

describe('what the chart gets wrong', () => {
  it('names a number two accounts claim', () => {
    const twice = [account(4030, 'Gesundheit', 'Stefan'), account(4030, 'Etwas', 'Erika')];
    expect(duplicateNumbers(twice)).toEqual([4030]);
    // The first still resolves, so a duplicate does not lose an account.
    expect(accountsByNumber(twice).get(4030)?.title).toBe('Gesundheit');
  });

  it('finds the account filed under the wrong person', () => {
    // The real case this was written for: 4042 sits in Erika's number block and
    // is grouped under Stefan, whose accounts are 4030 to 4036.
    const accounts = [
      account(4030, 'Gesundheit', 'Stefan Kosten/Krankenkasse'),
      account(4031, 'Krankenkasse', 'Stefan Kosten/Krankenkasse'),
      account(4032, 'Arztkosten', 'Stefan Kosten/Krankenkasse'),
      account(4034, 'Telefon Handy', 'Stefan Kosten/Krankenkasse'),
      account(4036, 'Sonstiges', 'Stefan Kosten/Krankenkasse'),
      account(4042, 'Arztkosten / Medikamente', 'Stefan Kosten/Krankenkasse'),
    ];
    expect(strandedByNumber(accounts).map((a) => a.number)).toEqual([4042]);
  });

  it('stays quiet about a group that was never numbered as a block', () => {
    const scattered = [
      account(4000, 'a', 'Sonstiges'),
      account(4500, 'b', 'Sonstiges'),
      account(5000, 'c', 'Sonstiges'),
    ];
    expect(strandedByNumber(scattered)).toEqual([]);
  });

  it('judges a group numbered in tens by its own step, not by ones', () => {
    // A chart numbered in tens is as deliberate as one numbered in ones, and a
    // fixed margin called the first member of 3010, 3020, 3030, 3040 stranded.
    const tens = [
      account(3010, 'a', 'Erwerbseinkommen'),
      account(3020, 'b', 'Erwerbseinkommen'),
      account(3030, 'c', 'Erwerbseinkommen'),
      account(3040, 'd', 'Erwerbseinkommen'),
    ];
    expect(strandedByNumber(tens)).toEqual([]);
  });

  it('still finds an outlier in a group numbered in tens', () => {
    const tens = [
      account(3020, 'b', 'Erwerbseinkommen'),
      account(3030, 'c', 'Erwerbseinkommen'),
      account(3040, 'd', 'Erwerbseinkommen'),
      account(3999, 'x', 'Erwerbseinkommen'),
    ];
    expect(strandedByNumber(tens).map((a) => a.number)).toEqual([3999]);
  });

  it('stays quiet about a group too small to have a habit', () => {
    const pair = [account(4010, 'a', 'Twingo'), account(4099, 'b', 'Twingo')];
    expect(strandedByNumber(pair)).toEqual([]);
  });
});
