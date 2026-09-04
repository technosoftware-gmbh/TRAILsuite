/**
 * The chart of accounts a fresh install offers.
 *
 * Modelled on a real Swiss two-person household: a profit calculation over
 * income and expense accounts, balance accounts for cash, bank, pillar 3a,
 * securities and the mortgages, and the costs split into what the household
 * shares and what each person carries. The numbering follows the usual bands,
 * 1 for assets, 2 for liabilities, 3 for income, 4 and 5 for expenses.
 *
 * **A starting point, not a prescription.** Every account here is a note the
 * person can rename, renumber, delete or ignore, and nothing in the code keys
 * off a particular number. What the seed buys is not having to type fifty notes
 * before the first posting.
 *
 * The two people and the two vehicles are tokens, filled in when the chart is
 * seeded. A default chart naming somebody else's household would be a chart
 * everybody renames.
 */
import type { AccountKind } from 'trail-core';

/** One account as the seed describes it, before the names are filled in. */
export interface ChartEntry {
  number: number;
  kind: AccountKind;
  /**
   * Which of the two people this account belongs to, for linking it to the CRM.
   *
   * Only the accounts that are somebody's. A shared household account has none,
   * and neither does an expense account: the costs are split by group, and a
   * person property on those would say the same thing twice.
   */
  person?: 1 | 2;
  /** Group path, `/` separated, in each language. */
  group: { de: string; en: string };
  title: { de: string; en: string };
  currency?: string;
}

/** What the tokens in a seeded chart stand for. */
export interface ChartNames {
  personOne: string;
  personTwo: string;
  vehicleOne: string;
  vehicleTwo: string;
  homeCurrency: string;
}

export const CHART_TOKENS = ['{person1}', '{person2}', '{vehicle1}', '{vehicle2}'] as const;

const SHARED_HOUSE = {
  de: 'Gemeinsame Kosten/Haushalt, Versicherungen',
  en: 'Shared costs/Household, insurance',
};
const VEHICLE_ONE = { de: 'Gemeinsame Kosten/{vehicle1}', en: 'Shared costs/{vehicle1}' };
const VEHICLE_TWO = { de: 'Gemeinsame Kosten/{vehicle2}', en: 'Shared costs/{vehicle2}' };
const COST_ONE = {
  de: 'Kosten {person1}/Krankenkasse, Telefon, Kleider',
  en: '{person1} costs/Health, phone, clothing',
};
const COST_TWO = {
  de: 'Kosten {person2}/Krankenkasse, Telefon, Kleider',
  en: '{person2} costs/Health, phone, clothing',
};
const LEISURE_ONE = {
  de: 'Kosten {person1}/Ferien, Freizeit',
  en: '{person1} costs/Holidays, leisure',
};
const LEISURE_TWO = {
  de: 'Kosten {person2}/Ferien, Freizeit',
  en: '{person2} costs/Holidays, leisure',
};
const FURTHER = { de: 'Weitere Haushaltskosten', en: 'Further household costs' };
const TAX_MAIN = {
  de: 'Steuern/Bund, Kanton, Gemeinde',
  en: 'Taxes/Federal, cantonal, communal',
};

/**
 * The chart itself, as the household's own printed Kontenplan lists it, to 5003.
 *
 * The numbers and the German wording are that chart's; the groups are invented
 * here, because a printed chart has none, and are kept as contiguous number
 * blocks so the stranded-account check stays meaningful.
 *
 * Gaps are the chart's own and are left alone: they are where an account was
 * once needed and where one may be needed again.
 */
export const DEFAULT_CHART: readonly ChartEntry[] = [
  {
    number: 1000,
    kind: 'asset',
    group: { de: 'Haushalt', en: 'Household' },
    title: { de: 'Haushaltskasse CHF', en: 'Household cash CHF' },
  },
  {
    number: 1001,
    kind: 'asset',
    group: { de: 'Haushalt', en: 'Household' },
    title: { de: 'Haushaltskasse EUR', en: 'Household cash EUR' },
    currency: 'EUR',
  },
  {
    number: 1002,
    kind: 'asset',
    group: { de: 'Haushalt', en: 'Household' },
    title: { de: 'Haushaltskasse USD', en: 'Household cash USD' },
    currency: 'USD',
  },
  {
    number: 1005,
    kind: 'asset',
    group: { de: 'Haushalt', en: 'Household' },
    title: { de: 'Haushaltskonto CHF', en: 'Household account CHF' },
  },
  {
    number: 1006,
    kind: 'asset',
    group: { de: 'Haushalt', en: 'Household' },
    title: { de: 'Reka CHF', en: 'Reka vouchers CHF' },
  },
  {
    number: 1010,
    kind: 'asset',
    person: 1,
    group: { de: '{person1}', en: '{person1}' },
    title: { de: 'Bargeld {person1} CHF', en: 'Cash {person1} CHF' },
  },
  {
    number: 1011,
    kind: 'asset',
    person: 1,
    group: { de: '{person1}', en: '{person1}' },
    title: { de: 'Universalkonto {person1} CHF', en: 'Personal account {person1} CHF' },
  },
  {
    number: 1012,
    kind: 'asset',
    person: 1,
    group: { de: '{person1}', en: '{person1}' },
    title: { de: 'Ferienkonto {person1} CHF', en: 'Holiday account {person1} CHF' },
  },
  {
    number: 1013,
    kind: 'asset',
    person: 1,
    group: { de: '{person1}', en: '{person1}' },
    title: { de: 'Zahlkarte {person1} CHF', en: 'Payment card {person1} CHF' },
  },
  {
    number: 1020,
    kind: 'asset',
    person: 2,
    group: { de: '{person2}', en: '{person2}' },
    title: { de: 'Bargeld {person2} CHF', en: 'Cash {person2} CHF' },
  },
  {
    number: 1021,
    kind: 'asset',
    person: 2,
    group: { de: '{person2}', en: '{person2}' },
    title: { de: 'Universalkonto {person2} CHF', en: 'Personal account {person2} CHF' },
  },
  {
    number: 1030,
    kind: 'asset',
    group: { de: 'Liquiditaetsreserve', en: 'Liquidity reserve' },
    title: { de: 'Zins und Renovation Haus', en: 'Interest and house renovation' },
  },
  {
    number: 1031,
    kind: 'asset',
    group: { de: 'Liquiditaetsreserve', en: 'Liquidity reserve' },
    title: { de: 'Liquiditaetsreserve', en: 'Liquidity reserve' },
  },
  {
    number: 1040,
    kind: 'asset',
    person: 1,
    group: { de: 'Sparen 3', en: 'Pillar 3a' },
    title: { de: 'Sparen 3 {person1} 1', en: 'Pillar 3a {person1} 1' },
  },
  {
    number: 1041,
    kind: 'asset',
    person: 1,
    group: { de: 'Sparen 3', en: 'Pillar 3a' },
    title: { de: 'Sparen 3 {person1} 2', en: 'Pillar 3a {person1} 2' },
  },
  {
    number: 1042,
    kind: 'asset',
    person: 1,
    group: { de: 'Sparen 3', en: 'Pillar 3a' },
    title: { de: 'Sparen 3 {person1} 3', en: 'Pillar 3a {person1} 3' },
  },
  {
    number: 1043,
    kind: 'asset',
    person: 2,
    group: { de: 'Sparen 3', en: 'Pillar 3a' },
    title: { de: 'Sparen 3 {person2} 1', en: 'Pillar 3a {person2} 1' },
  },
  {
    number: 1044,
    kind: 'asset',
    person: 2,
    group: { de: 'Sparen 3', en: 'Pillar 3a' },
    title: { de: 'Sparen 3 {person2} 2', en: 'Pillar 3a {person2} 2' },
  },
  {
    number: 1050,
    kind: 'asset',
    person: 1,
    group: { de: 'Vorsorge', en: 'Long term investments' },
    title: { de: 'Vorsorge Sparen 3 {person1}', en: 'Pillar 3a investments {person1}' },
  },
  {
    number: 1051,
    kind: 'asset',
    person: 1,
    group: { de: 'Vorsorge', en: 'Long term investments' },
    title: { de: 'Mitarbeiteraktien {person1}', en: 'Employee shares {person1}' },
  },
  {
    number: 1052,
    kind: 'asset',
    person: 2,
    group: { de: 'Vorsorge', en: 'Long term investments' },
    title: { de: 'Vorsorge Sparen 3 {person2} 1', en: 'Pillar 3a investments {person2} 1' },
  },
  {
    number: 1053,
    kind: 'asset',
    person: 2,
    group: { de: 'Vorsorge', en: 'Long term investments' },
    title: { de: 'Vorsorge Sparen 3 {person2} 2', en: 'Pillar 3a investments {person2} 2' },
  },
  {
    number: 1060,
    kind: 'asset',
    group: { de: 'Liegenschaft', en: 'Property' },
    title: { de: 'Haus', en: 'House' },
  },
  {
    number: 1100,
    kind: 'asset',
    group: { de: 'Forderungen', en: 'Receivables' },
    title: { de: 'Debitoren', en: 'Receivables' },
  },
  {
    number: 2000,
    kind: 'liability',
    group: { de: 'Verbindlichkeiten', en: 'Payables' },
    title: { de: 'Kreditoren', en: 'Payables' },
  },
  {
    number: 2005,
    kind: 'liability',
    group: { de: 'Verbindlichkeiten', en: 'Payables' },
    title: { de: 'Kreditoren Nebenbuecher', en: 'Payables, subsidiary' },
  },
  {
    number: 2010,
    kind: 'liability',
    group: { de: 'Karten', en: 'Cards' },
    title: { de: 'Kreditkarte', en: 'Credit card' },
  },
  {
    number: 2011,
    kind: 'liability',
    group: { de: 'Karten', en: 'Cards' },
    title: { de: 'Zahlkarte', en: 'Payment card' },
  },
  {
    number: 2020,
    kind: 'liability',
    group: { de: 'Offene Rechnungen', en: 'Amounts owed' },
    title: { de: 'Ratenzahlung', en: 'Instalment plan' },
  },
  {
    number: 2021,
    kind: 'liability',
    group: { de: 'Offene Rechnungen', en: 'Amounts owed' },
    title: { de: 'Steuern Bund offen', en: 'Federal tax payable' },
  },
  {
    number: 2022,
    kind: 'liability',
    group: { de: 'Offene Rechnungen', en: 'Amounts owed' },
    title: { de: 'Steuern Kanton und Gemeinde offen', en: 'Cantonal and communal tax payable' },
  },
  {
    number: 2050,
    kind: 'liability',
    group: { de: 'Hypotheken', en: 'Mortgages' },
    title: { de: 'Geldmarkthypothek', en: 'Money market mortgage' },
  },
  {
    number: 2051,
    kind: 'liability',
    group: { de: 'Hypotheken', en: 'Mortgages' },
    title: { de: 'Festhypothek', en: 'Fixed rate mortgage' },
  },
  {
    number: 3000,
    kind: 'income',
    group: { de: 'Ertrag', en: 'Income' },
    title: { de: 'Ertrag/Einnahmen', en: 'Income' },
  },
  {
    number: 3010,
    kind: 'income',
    group: { de: 'Erwerbseinkommen Netto', en: 'Net earned income' },
    title: { de: 'Einkommen Netto {person1}', en: 'Net income {person1}' },
  },
  {
    number: 3020,
    kind: 'income',
    group: { de: 'Erwerbseinkommen Netto', en: 'Net earned income' },
    title: { de: 'Einkommen Netto {person2}', en: 'Net income {person2}' },
  },
  {
    number: 3030,
    kind: 'income',
    group: { de: 'Erwerbseinkommen Netto', en: 'Net earned income' },
    title: { de: 'Nebenerwerb Netto {person1}', en: 'Net side income {person1}' },
  },
  {
    number: 3040,
    kind: 'income',
    group: { de: 'Erwerbseinkommen Netto', en: 'Net earned income' },
    title: { de: 'Nebenerwerb Netto {person2}', en: 'Net side income {person2}' },
  },
  {
    number: 3050,
    kind: 'income',
    group: { de: 'Zinsen und Renten', en: 'Interest and pensions' },
    title: {
      de: 'Zinsertrag (Bank, Postkonto, Kreditkarte)',
      en: 'Interest received (bank, post, card)',
    },
  },
  {
    number: 3060,
    kind: 'income',
    group: { de: 'Sonstige Einnahmen', en: 'Other income' },
    title: { de: 'Sonstiges Einkommen', en: 'Other income' },
  },
  {
    // Income rather than expense, and a group of its own.
    //
    // A household holding a euro cash box or a dollar account cannot close its
    // books to zero: a posting between two currencies carries both figures, and
    // the two sides move by amounts that only agree at one rate. What is left
    // over is not a cost, it is the difference between the rate on the day and
    // the rate the balance sheet uses, and it is a gain as often as a loss.
    //
    // Booked as an expense it can only read as something the household bought,
    // and a good month shows as a negative cost. Under 3000 both directions
    // read the way they happened. Its own group because it is the one line on
    // the report that explains why two figures elsewhere disagree, and burying
    // it under other income is how somebody spends an evening looking for it.
    number: 3070,
    kind: 'income',
    group: { de: 'Kursdifferenzen', en: 'Exchange differences' },
    title: { de: 'Kursdifferenzen', en: 'Exchange rate differences' },
  },
  {
    number: 4000,
    kind: 'expense',
    group: SHARED_HOUSE,
    title: { de: 'Haushaltsrechnungen', en: 'Household bills' },
  },
  {
    number: 4001,
    kind: 'expense',
    group: SHARED_HOUSE,
    title: { de: 'Strom und Gas', en: 'Electricity and gas' },
  },
  {
    number: 4002,
    kind: 'expense',
    group: SHARED_HOUSE,
    title: { de: 'Gemeinde (Wasser)', en: 'Water and refuse' },
  },
  {
    number: 4003,
    kind: 'expense',
    group: SHARED_HOUSE,
    title: { de: 'Telefon, Internet, Fernsehen', en: 'Phone, internet, television' },
  },
  { number: 4004, kind: 'expense', group: SHARED_HOUSE, title: { de: 'Haustiere', en: 'Pets' } },
  {
    number: 4005,
    kind: 'expense',
    group: SHARED_HOUSE,
    title: {
      de: 'Versicherung (Hausrat, Rechtsschutz, Reise)',
      en: 'Insurance (contents, legal, travel)',
    },
  },
  {
    number: 4006,
    kind: 'expense',
    group: { de: 'Gemeinsame Kosten/Hypothek', en: 'Shared costs/Mortgage' },
    title: { de: 'Zins Haus', en: 'Mortgage interest' },
  },
  {
    // Interest a card charges, which is not interest a bank pays.
    //
    // Both used to land on the one account for interest received, where a
    // charge of 84.83 reads as income of minus 84.83. The profit is the same
    // either way and the account is nonsense either way: an account called
    // interest received holding a negative balance is one nobody can read at a
    // glance, and the two amounts want telling apart anyway, because one is
    // what savings earned and the other is the price of paying a card late.
    number: 4008,
    kind: 'expense',
    group: { de: 'Gemeinsame Kosten/Zinsen und Gebuehren', en: 'Shared costs/Interest and fees' },
    title: { de: 'Zins und Gebuehren Karten', en: 'Card interest and fees' },
  },
  {
    number: 4007,
    kind: 'expense',
    group: { de: 'Gemeinsame Kosten/Ferien', en: 'Shared costs/Holidays' },
    title: { de: 'Reisen, Ferien', en: 'Travel and holidays' },
  },
  {
    number: 4010,
    kind: 'expense',
    group: VEHICLE_ONE,
    title: { de: 'Auto {vehicle1}', en: 'Car {vehicle1}' },
  },
  {
    number: 4011,
    kind: 'expense',
    group: VEHICLE_ONE,
    title: { de: 'Auto-Versicherung {vehicle1}', en: 'Car insurance {vehicle1}' },
  },
  {
    number: 4012,
    kind: 'expense',
    group: VEHICLE_ONE,
    title: { de: 'Auto-Reparatur {vehicle1}', en: 'Car repairs {vehicle1}' },
  },
  {
    number: 4013,
    kind: 'expense',
    group: VEHICLE_ONE,
    title: { de: 'Auto-Leasing {vehicle1}', en: 'Car leasing {vehicle1}' },
  },
  {
    number: 4014,
    kind: 'expense',
    group: VEHICLE_ONE,
    title: { de: 'Strom und Treibstoff {vehicle1}', en: 'Charging and fuel {vehicle1}' },
  },
  {
    number: 4020,
    kind: 'expense',
    group: VEHICLE_TWO,
    title: { de: 'Auto {vehicle2}', en: 'Car {vehicle2}' },
  },
  {
    number: 4021,
    kind: 'expense',
    group: VEHICLE_TWO,
    title: { de: 'Auto-Versicherung {vehicle2}', en: 'Car insurance {vehicle2}' },
  },
  {
    number: 4022,
    kind: 'expense',
    group: VEHICLE_TWO,
    title: { de: 'Auto-Reparatur {vehicle2}', en: 'Car repairs {vehicle2}' },
  },
  {
    number: 4023,
    kind: 'expense',
    group: VEHICLE_TWO,
    title: { de: 'Auto-Leasing {vehicle2}', en: 'Car leasing {vehicle2}' },
  },
  {
    number: 4024,
    kind: 'expense',
    group: VEHICLE_TWO,
    title: { de: 'Strom und Treibstoff {vehicle2}', en: 'Charging and fuel {vehicle2}' },
  },
  { number: 4030, kind: 'expense', group: COST_ONE, title: { de: 'Gesundheit', en: 'Health' } },
  {
    number: 4031,
    kind: 'expense',
    group: COST_ONE,
    title: { de: 'Krankenkasse', en: 'Health insurance' },
  },
  {
    number: 4032,
    kind: 'expense',
    group: COST_ONE,
    title: { de: 'Arztkosten und Medikamente', en: 'Doctor and medication' },
  },
  {
    number: 4033,
    kind: 'expense',
    group: COST_ONE,
    title: { de: 'Lohnabzuege', en: 'Payroll deductions' },
  },
  {
    number: 4034,
    kind: 'expense',
    group: COST_ONE,
    title: { de: 'Telefon Handy', en: 'Mobile phone' },
  },
  { number: 4035, kind: 'expense', group: COST_ONE, title: { de: 'Kleider', en: 'Clothing' } },
  { number: 4036, kind: 'expense', group: COST_ONE, title: { de: 'Sonstiges', en: 'Other' } },
  {
    number: 4039,
    kind: 'expense',
    group: LEISURE_ONE,
    title: { de: 'Reisen, Ferien, Fotografie', en: 'Travel, holidays, photography' },
  },
  { number: 4040, kind: 'expense', group: COST_TWO, title: { de: 'Gesundheit', en: 'Health' } },
  {
    number: 4041,
    kind: 'expense',
    group: COST_TWO,
    title: { de: 'Krankenkasse', en: 'Health insurance' },
  },
  {
    number: 4042,
    kind: 'expense',
    group: COST_TWO,
    title: { de: 'Arztkosten und Medikamente', en: 'Doctor and medication' },
  },
  {
    number: 4044,
    kind: 'expense',
    group: COST_TWO,
    title: { de: 'Telefon Handy', en: 'Mobile phone' },
  },
  { number: 4045, kind: 'expense', group: COST_TWO, title: { de: 'Kleider', en: 'Clothing' } },
  { number: 4046, kind: 'expense', group: COST_TWO, title: { de: 'Sonstiges', en: 'Other' } },
  {
    number: 4049,
    kind: 'expense',
    group: LEISURE_TWO,
    title: { de: 'Reisen, Ferien', en: 'Travel and holidays' },
  },
  {
    number: 4050,
    kind: 'expense',
    group: FURTHER,
    title: { de: 'Versicherung (Hausrat, Leben)', en: 'Insurance (contents, life)' },
  },
  {
    number: 4060,
    kind: 'expense',
    group: FURTHER,
    title: { de: 'Miete oder Hypothek', en: 'Rent or mortgage' },
  },
  {
    number: 4070,
    kind: 'expense',
    group: FURTHER,
    title: { de: 'Strom, Gas, Wasser', en: 'Electricity, gas, water' },
  },
  {
    number: 4080,
    kind: 'expense',
    group: FURTHER,
    title: { de: 'Nahrung, Getraenke, Non Food', en: 'Food, drink, non food' },
  },
  { number: 4090, kind: 'expense', group: FURTHER, title: { de: 'Kleider', en: 'Clothing' } },
  {
    number: 5000,
    kind: 'expense',
    group: TAX_MAIN,
    title: { de: 'Steuern Bund', en: 'Federal tax' },
  },
  {
    number: 5001,
    kind: 'expense',
    group: TAX_MAIN,
    title: { de: 'Steuern Kanton/Gemeinde', en: 'Cantonal and communal tax' },
  },
  {
    number: 5002,
    kind: 'expense',
    group: TAX_MAIN,
    title: { de: 'Steuern Kanton/Gemeinde (3te Saeule)', en: 'Capital withdrawal tax (pillar 3a)' },
  },
  {
    number: 5003,
    kind: 'expense',
    group: { de: 'Steuern/Steuerlich absetzbar', en: 'Taxes/Tax deductible' },
    title: { de: 'Steuerlich absetzbare Rechnungen', en: 'Tax deductible bills' },
  },
];

/** One seeded account, ready to be written as a note. */
export interface SeededAccount {
  number: number;
  kind: AccountKind;
  group: string;
  title: string;
  currency: string;
  /** The person note this account belongs to, as a title. Null for a shared one. */
  person: string | null;
  /** An IBAN or the number a statement prints. Null for an account no bank knows. */
  identity?: string | null;
}

/**
 * The chart with the tokens filled in.
 *
 * A name left blank falls back to the token's plain word rather than producing
 * an account called `Privatkonto {person1}`, because a half-filled chart is
 * worse than a generic one.
 */
export function seedChart(language: 'de' | 'en', names: Partial<ChartNames> = {}): SeededAccount[] {
  const filled: ChartNames = {
    personOne: names.personOne?.trim() || (language === 'de' ? 'Person 1' : 'Person 1'),
    personTwo: names.personTwo?.trim() || (language === 'de' ? 'Person 2' : 'Person 2'),
    vehicleOne: names.vehicleOne?.trim() || (language === 'de' ? 'Auto 1' : 'Car 1'),
    vehicleTwo: names.vehicleTwo?.trim() || (language === 'de' ? 'Auto 2' : 'Car 2'),
    homeCurrency: names.homeCurrency?.trim() || 'CHF',
  };

  const fill = (text: string): string =>
    text
      .replace(/\{person1\}/g, filled.personOne)
      .replace(/\{person2\}/g, filled.personTwo)
      .replace(/\{vehicle1\}/g, filled.vehicleOne)
      .replace(/\{vehicle2\}/g, filled.vehicleTwo);

  return DEFAULT_CHART.map((entry) => ({
    number: entry.number,
    kind: entry.kind,
    group: fill(entry.group[language]),
    title: fill(entry.title[language]),
    currency: entry.currency ?? filled.homeCurrency,
    // Only when a real name was given: a link to a person note called
    // `Person 1` would point at nothing.
    person:
      entry.person === undefined
        ? null
        : entry.person === 1
          ? names.personOne?.trim() || null
          : names.personTwo?.trim() || null,
  }));
}
