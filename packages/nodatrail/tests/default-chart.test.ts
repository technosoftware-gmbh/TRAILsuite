/**
 * The chart a fresh install offers.
 *
 * Checked for the things that would be quietly wrong: a duplicate number, a
 * token nobody filled in, an account stranded in the wrong person's block. The
 * last one is checked because the chart this was modelled on had exactly that
 * mistake in it.
 */
import { describe, expect, it } from 'vitest';
import {
  accountTree,
  duplicateNumbers,
  kindForNumber,
  parseAccount,
  strandedByNumber,
  type Account,
  type AccountProperties,
} from 'trail-core';
import { CHART_TOKENS, DEFAULT_CHART, seedChart } from '../src/finance/default-chart';

const P: AccountProperties = {
  numberProperty: 'number',
  kindProperty: 'kind',
  groupProperty: 'group',
  currencyProperty: 'currency',
  openingProperty: 'opening',
  ibanProperty: 'iban',
  bankAccountProperty: 'bankAccount',
  personProperty: 'person',
  openingDateProperty: 'openingDate',
  closedProperty: 'closed',
};

function asAccounts(language: 'de' | 'en'): Account[] {
  return seedChart(language, {
    personOne: 'Stefan',
    personTwo: 'Erika',
    vehicleOne: 'Renault Twingo',
    vehicleTwo: 'Renault Captur',
  }).map((seeded) => {
    const parsed = parseAccount(
      { number: seeded.number, kind: seeded.kind, group: seeded.group, currency: seeded.currency },
      seeded.title,
      P
    );
    if (!parsed) throw new Error(`unreadable seed ${seeded.number}`);
    return parsed;
  });
}

describe('the chart itself', () => {
  it('gives every account a unique number', () => {
    expect(duplicateNumbers(asAccounts('de'))).toEqual([]);
  });

  it('numbers every account inside the band its kind lives in', () => {
    for (const entry of DEFAULT_CHART) {
      expect([entry.number, kindForNumber(entry.number)]).toEqual([entry.number, entry.kind]);
    }
  });

  it('strands nobody in the wrong block', () => {
    // The mistake in the chart this was modelled on: an account numbered in one
    // person's block and grouped under the other. The shipped chart must not
    // hand somebody a copy of it.
    expect(strandedByNumber(asAccounts('de'))).toEqual([]);
  });

  it('says the same thing in both languages', () => {
    expect(asAccounts('en').map((a) => a.number)).toEqual(asAccounts('de').map((a) => a.number));
    for (const entry of DEFAULT_CHART) {
      expect(entry.title.de.length).toBeGreaterThan(0);
      expect(entry.title.en.length).toBeGreaterThan(0);
      expect(entry.group.de.split('/')).toHaveLength(entry.group.en.split('/').length);
    }
  });
});

describe('who an account belongs to', () => {
  it('gives each person a cash account of their own', () => {
    // The chart shipped with household cash and none for either person, which
    // is the account a wallet is. Nobody notices it is missing until they go to
    // enter its opening balance.
    const seeded = seedChart('de', { personOne: 'Stefan', personTwo: 'Erika' });
    expect(seeded.find((a) => a.number === 1010)?.title).toBe('Bargeld Stefan CHF');
    expect(seeded.find((a) => a.number === 1020)?.title).toBe('Bargeld Erika CHF');
  });

  it('links the personal accounts to their person and leaves the shared ones alone', () => {
    const seeded = seedChart('de', { personOne: 'Stefan', personTwo: 'Erika' });
    const person = (number: number) => seeded.find((a) => a.number === number)?.person;
    expect(person(1011)).toBe('Stefan');
    expect(person(1021)).toBe('Erika');
    expect(person(1052)).toBe('Erika');
    // The household account belongs to the household, and an expense account is
    // placed by its group rather than by a person.
    expect(person(1005)).toBeNull();
    expect(person(4001)).toBeNull();
  });

  it('links nobody when no name was given, rather than pointing at a note that does not exist', () => {
    expect(seedChart('de').find((a) => a.number === 1011)?.person).toBeNull();
  });
});

describe('seeding it', () => {
  it('fills every token in, in both languages', () => {
    for (const language of ['de', 'en'] as const) {
      const seeded = seedChart(language, { personOne: 'Stefan', personTwo: 'Erika' });
      for (const account of seeded) {
        for (const token of CHART_TOKENS) {
          expect(`${account.title} ${account.group}`).not.toContain(token);
        }
      }
    }
  });

  it('falls back to a generic name rather than leaving a token showing', () => {
    const seeded = seedChart('de');
    expect(seeded.find((a) => a.number === 1011)?.title).toBe('Universalkonto Person 1 CHF');
  });

  it('keeps a foreign currency account in its own currency', () => {
    const seeded = seedChart('de', { homeCurrency: 'CHF' });
    expect(seeded.find((a) => a.number === 1001)?.currency).toBe('EUR');
    expect(seeded.find((a) => a.number === 1005)?.currency).toBe('CHF');
  });

  it('comes out in the order the printed chart has', () => {
    const tree = accountTree(asAccounts('de'), 'expense');
    expect(tree.children.map((child) => child.name)).toEqual([
      'Gemeinsame Kosten',
      'Kosten Stefan',
      'Kosten Erika',
      'Weitere Haushaltskosten',
      'Steuern',
    ]);
    expect(tree.children[0]?.children.map((child) => child.name)).toEqual([
      'Haushalt, Versicherungen',
      'Hypothek',
      'Ferien',
      'Zinsen und Gebuehren',
      'Renault Twingo',
      'Renault Captur',
    ]);
  });

  it('puts the exchange difference with the income, in a group of its own', () => {
    // Its own group on purpose: it is the line that explains why a balance
    // sheet and a profit calculation disagree, and it is unfindable folded in
    // with other income.
    const tree = accountTree(asAccounts('de'), 'income');
    expect(tree.children.map((child) => child.name)).toContain('Kursdifferenzen');
  });
});

/**
 * The chart against the printed Kontenplan it was taken from.
 *
 * Numbers rather than names, because the names carry tokens and the numbers do
 * not. What this catches is an account quietly dropped or added while the file
 * was being edited, which reads as nothing at all in a diff of eighty lines
 * that all look alike.
 */
const KONTENPLAN = [
  1000, 1001, 1002, 1005, 1006, 1010, 1011, 1012, 1013, 1020, 1021, 1030, 1031, 1040, 1041, 1042,
  1043, 1044, 1050, 1051, 1052, 1053, 1100, 2000, 2005, 2050, 2051, 3000, 3010, 3020, 3030, 3040,
  3050, 3060, 4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4010, 4011, 4012, 4013, 4014, 4020,
  4021, 4022, 4023, 4024, 4030, 4031, 4032, 4033, 4034, 4035, 4036, 4039, 4040, 4041, 4042, 4044,
  4045, 4046, 4050, 4060, 4070, 4080, 4090, 4223, 5000, 5001, 5002, 5003,
];

/** Added by this plugin, and absent from the printed chart. Each was a decision. */
const ADDED = [1060, 2010, 2011, 2020, 2021, 2022, 4008, 4049];

/**
 * Accounts the printed chart numbered in the wrong band, and where they went.
 *
 * Kept as a map rather than deleted from `KONTENPLAN` above, because that list
 * is a record of the chart this was taken from and editing it would lose the
 * only evidence that the account was ever there. An entry here says the account
 * still exists and answers to a different number.
 */
const RENUMBERED = new Map([
  // An exchange difference is a gain as often as a loss, so it belongs with the
  // income rather than among the things the household bought.
  [4223, 3070],
]);

describe('against the printed chart', () => {
  const numbers = DEFAULT_CHART.map((entry) => entry.number);

  it('has every account the Kontenplan lists to 5003', () => {
    const missing = KONTENPLAN.filter(
      (number) => !numbers.includes(RENUMBERED.get(number) ?? number)
    );
    expect(missing).toEqual([]);
  });

  it('adds only the accounts that were decided on deliberately', () => {
    const kept = new Set([...KONTENPLAN, ...RENUMBERED.values()]);
    const extra = numbers.filter((number) => !kept.has(number));
    expect(extra.sort((a, b) => a - b)).toEqual(ADDED);
  });

  it('leaves nothing behind at the number it was moved from', () => {
    for (const from of RENUMBERED.keys()) expect(numbers).not.toContain(from);
  });

  it("stops at 5003, leaving the old system's own bookkeeping behind", () => {
    // 8000, 8800, 8900, 10000 and 70000 are the previous application's opening
    // and carry-forward machinery. This ledger computes all of that.
    expect(numbers.filter((number) => number > 5003)).toEqual([]);
  });
});
