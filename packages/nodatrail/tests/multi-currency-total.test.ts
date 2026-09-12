/**
 * The case a screenshot caught: a group of three cash boxes in three
 * currencies, subtotalled as though they were one.
 *
 * `CHF 0.00`, `EUR 310.00` and `USD 500.00` were shown adding to `CHF 810.00`.
 * They do not. The bug predated exchange rates entirely, because the report
 * added whatever figure each account held without ever asking what currency it
 * was in, and no correction applied to the top-level total could have fixed a
 * subtotal that was already wrong.
 */
import { describe, expect, it } from 'vitest';
import {
  balanceSheet,
  flattenReport,
  parseAccount,
  parseJournal,
  type Account,
  type AccountProperties,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { toHome } from '../src/shared/rates';
import type { NODAtrailSettings } from '../src/settings/types';

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

function cash(number: number, currency: string, opening: number): Account {
  const parsed = parseAccount(
    { number, kind: 'asset', group: 'Haushalt', currency, opening },
    `${number} Haushaltskasse ${currency}`,
    P
  );
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

/** The three cash boxes exactly as the screenshot showed them. */
const ACCOUNTS = [cash(1000, 'CHF', 0), cash(1001, 'EUR', 310), cash(1002, 'USD', 500)];
const NO_POSTINGS = parseJournal('').postings;

const settings = (rates: { currency: string; rate: number }[]): NODAtrailSettings => ({
  ...DEFAULT_SETTINGS,
  homeCurrency: 'CHF',
  exchangeRates: rates,
});

const convertWith = (s: NODAtrailSettings) => (amount: number, currency: string | null) =>
  toHome(amount, currency, s);

describe('three currencies in one group', () => {
  it('converts each account and subtotals the group in francs', () => {
    // 310 EUR at 0.94 is 291.40, 500 USD at 0.88 is 440. With the franc box at
    // nothing, the group holds 731.40 and never 810.
    const s = settings([
      { currency: 'EUR', rate: 0.94 },
      { currency: 'USD', rate: 0.88 },
    ]);
    const sheet = balanceSheet(ACCOUNTS, NO_POSTINGS, null, { convert: convertWith(s) });

    expect(sheet.assets.children[0]?.total).toBe(731.4);
    expect(sheet.assetTotal).toBe(731.4);
    expect(sheet.net).toBe(731.4);
  });

  it('keeps each account’s own figure beside the converted one', () => {
    const s = settings([
      { currency: 'EUR', rate: 0.94 },
      { currency: 'USD', rate: 0.88 },
    ]);
    const sheet = balanceSheet(ACCOUNTS, NO_POSTINGS, null, { convert: convertWith(s) });
    const rows = flattenReport(sheet.assets);

    expect(rows.map((entry) => [entry.account.number, entry.stated, entry.amount])).toEqual([
      [1000, 0, 0],
      [1001, 310, 291.4],
      [1002, 500, 440],
    ]);
  });

  it('leaves out only the currency that has no rate, and says how many', () => {
    const s = settings([{ currency: 'EUR', rate: 0.94 }]);
    const sheet = balanceSheet(ACCOUNTS, NO_POSTINGS, null, { convert: convertWith(s) });

    expect(sheet.assetTotal).toBe(291.4);
    expect(sheet.assets.missing).toBe(1);
    const dollars = flattenReport(sheet.assets).find((entry) => entry.account.number === 1002);
    expect(dollars).toMatchObject({ stated: 500, amount: 0, inTotal: false });
  });

  it('never reproduces the figure from the screenshot', () => {
    // 810 is what adding three currencies at face value gives, under every
    // rate table there is.
    for (const rates of [
      [],
      [{ currency: 'EUR', rate: 0.94 }],
      [
        { currency: 'EUR', rate: 0.94 },
        { currency: 'USD', rate: 0.88 },
      ],
    ]) {
      const sheet = balanceSheet(ACCOUNTS, NO_POSTINGS, null, {
        convert: convertWith(settings(rates)),
      });
      expect(sheet.assetTotal).not.toBe(810);
    }
  });
});
