/**
 * An invented household's year, for the budget sheet suites: two earners, a
 * house with a mortgage, two cars, taxes paid in instalments, a premium due
 * in January, and a reserve account a fixed amount goes into every month.
 *
 * Invented, and deliberately not anybody's real figures: the repository is
 * public. What it has to be is shaped like a real one, because the sheet is
 * judged against a real spreadsheet.
 */
import {
  parseAccount,
  type Account,
  type AccountBudgetLine,
  type AccountProperties,
  type Posting,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
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

function account(
  number: number,
  title: string,
  kind: string,
  group: string,
  extra: Record<string, unknown> = {}
): Account {
  const parsed = parseAccount(
    { number, kind, group, currency: 'CHF', ...extra },
    `${number} ${title}`,
    P
  );
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

export const CHART: Account[] = [
  account(1005, 'Haushaltskonto', 'asset', 'Haushalt', { opening: 850 }),
  account(1001, 'Haushaltskasse EUR', 'asset', 'Haushalt', { currency: 'EUR', opening: 240 }),
  account(1011, 'Privatkonto Anna', 'asset', 'Anna', { opening: 2400 }),
  account(1021, 'Privatkonto Ben', 'asset', 'Ben', { opening: 1900 }),
  account(1030, 'Renovationsreserve', 'asset', 'Liquiditätsreserve', { opening: 1200 }),
  account(1040, 'Säule 3a Anna', 'asset', 'Vorsorge', { opening: 18500 }),
  account(2050, 'Festhypothek', 'liability', 'Hypotheken', { opening: 320000 }),
  account(3010, 'Lohn netto Anna', 'income', 'Erwerbseinkommen'),
  account(3020, 'Lohn netto Ben', 'income', 'Erwerbseinkommen'),
  account(3090, 'Zinsertrag', 'income', 'Sonstige Einnahmen'),
  account(6010, 'Steuern Bund, Kanton, Gemeinde', 'expense', 'Steuern'),
  account(6110, 'Haushalt', 'expense', 'Gemeinsame Kosten'),
  account(6120, 'Versicherungen', 'expense', 'Gemeinsame Kosten'),
  account(6130, 'Hypothekarzins', 'expense', 'Gemeinsame Kosten'),
  account(6140, 'Auto Kleinwagen', 'expense', 'Gemeinsame Kosten/Autos'),
  account(6150, 'Auto Kombi', 'expense', 'Gemeinsame Kosten/Autos'),
  account(6210, 'Krankenkasse, Telefon, Kleider Anna', 'expense', 'Kosten Anna'),
  account(6220, 'Ferien, Freizeit Anna', 'expense', 'Kosten Anna'),
  account(6310, 'Krankenkasse, Telefon, Kleider Ben', 'expense', 'Kosten Ben'),
  account(6390, 'Geschenke', 'expense', 'Kosten Ben'),
];

function line(partial: Partial<AccountBudgetLine> & { account: number }): AccountBudgetLine {
  return { amount: 0, rhythm: 'monthly', startMonth: null, note: '', overrides: {}, ...partial };
}

export const LINES: AccountBudgetLine[] = [
  line({ account: 3010, amount: 7800, overrides: { 12: 15600 } }),
  line({ account: 3020, amount: 4100 }),
  line({ account: 6010, amount: 2500, overrides: { 3: 8200, 11: 9800 } }),
  line({ account: 6110, amount: 1650 }),
  // Due in January, all of it.
  line({ account: 6120, amount: 3900, rhythm: 'annual', startMonth: 1 }),
  line({ account: 6130, amount: 2480, rhythm: 'quarterly', startMonth: 3 }),
  line({ account: 6140, amount: 510 }),
  line({ account: 6150, amount: 880, overrides: { 4: 1650 } }),
  line({ account: 6210, amount: 1650 }),
  line({ account: 6220, amount: 4200, rhythm: 'annual', startMonth: 7 }),
  line({ account: 6310, amount: 1720 }),
];

let lineNumber = 0;
function post(date: string, debit: number, credit: number, amount: number): Posting {
  lineNumber += 1;
  return {
    date,
    debit,
    credit,
    amount,
    currency: 'CHF',
    text: '',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: lineNumber,
    entryLine: lineNumber,
    splitOf: null,
    importKey: null,
  };
}

/** What happened, January to August: close to the plan, never on it. */
export function postings(): Posting[] {
  const out: Posting[] = [];
  const noise = [1.02, 0.97, 1.05, 0.99, 1.01, 0.94, 1.08, 1.0];
  for (let month = 1; month <= 8; month += 1) {
    const mm = String(month).padStart(2, '0');
    const f = noise[month - 1] ?? 1;
    const r = (value: number) => Math.round(value * f * 100) / 100;
    out.push(post(`2026-${mm}-25`, 1011, 3010, 7800));
    out.push(post(`2026-${mm}-25`, 1021, 3020, r(4100)));
    out.push(post(`2026-${mm}-05`, 6010, 1011, month === 3 ? 8200 : 2500));
    out.push(post(`2026-${mm}-10`, 6110, 1005, r(1650)));
    out.push(post(`2026-${mm}-11`, 6140, 1011, 510.95));
    out.push(post(`2026-${mm}-12`, 6150, 1021, r(month === 4 ? 1650 : 880)));
    out.push(post(`2026-${mm}-15`, 6210, 1011, r(1650)));
    out.push(post(`2026-${mm}-15`, 6310, 1021, r(1720)));
    out.push(post(`2026-${mm}-01`, 1005, 1011, 1700));
    // The reserve: in every month, out every third.
    out.push(post(`2026-${mm}-28`, 1030, 1011, 850));
    if (month % 3 === 0) out.push(post(`2026-${mm}-30`, 6130, 1030, 2483.75));
  }
  out.push(post('2026-01-08', 6120, 1011, 3812.4));
  out.push(post('2026-07-02', 6220, 1011, 4630.1));
  out.push(post('2026-05-14', 6390, 1021, 186.5));
  out.push(post('2026-06-30', 1030, 3090, 12.35));
  // A mortgage amortisation in June.
  out.push(post('2026-06-30', 2050, 1011, 2500));
  return out;
}

export function settings(over: Partial<NODAtrailSettings> = {}): NODAtrailSettings {
  return {
    ...DEFAULT_SETTINGS,
    homeCurrency: 'CHF',
    exchangeRates: [{ currency: 'EUR', rate: 0.94 }],
    ...over,
  };
}
