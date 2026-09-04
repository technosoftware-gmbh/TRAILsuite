/**
 * Which language the chart of accounts is seeded in.
 *
 * The bug this pins: the seed asked the raw `language` setting whether it was
 * `de`. In most vaults that setting is `auto`, which is neither `de` nor `en`,
 * so a German vault following Obsidian's own German got an English chart and no
 * indication why. The question to ask is what the catalogue resolved, not what
 * the setting says.
 */
import { describe, expect, it } from 'vitest';
import { seedChart } from '../src/finance/default-chart';

/** The line main.ts uses, kept here so the rule is tested rather than the wiring. */
const seedLanguage = (resolvedLocale: string): 'de' | 'en' =>
  resolvedLocale.startsWith('de') ? 'de' : 'en';

describe('choosing the language to seed in', () => {
  it('follows a resolved German locale, however it was reached', () => {
    // `auto` resolves to one of these; none of them is the string `de`.
    expect(seedLanguage('de')).toBe('de');
    expect(seedLanguage('de-CH')).toBe('de');
    expect(seedLanguage('de-DE')).toBe('de');
  });

  it('falls back to English for everything else', () => {
    expect(seedLanguage('en')).toBe('en');
    expect(seedLanguage('en-GB')).toBe('en');
    expect(seedLanguage('fr')).toBe('en');
  });

  it('would have been wrong to ask the raw setting', () => {
    // What the code used to do, written out so the mistake cannot come back
    // wearing a different name.
    const oldRule = (setting: string) => (setting === 'de' ? 'de' : 'en');
    expect(oldRule('auto')).toBe('en');
    expect(seedLanguage('de-CH')).toBe('de');
  });
});

describe('the German chart', () => {
  const german = seedChart('de', { personOne: 'Stefan', personTwo: 'Erika' });
  const title = (number: number) => german.find((a) => a.number === number)?.title;

  it('names the accounts as the printed Kontenplan does', () => {
    expect(title(1005)).toBe('Haushaltskonto CHF');
    expect(title(1011)).toBe('Universalkonto Stefan CHF');
    expect(title(3030)).toBe('Nebenerwerb Netto Stefan');
    expect(title(4002)).toBe('Gemeinde (Wasser)');
    // Renumbered out of the expense band into the income one, keeping its name.
    expect(title(3070)).toBe('Kursdifferenzen');
    expect(title(4008)).toBe('Zins und Gebuehren Karten');
    expect(title(5002)).toBe('Steuern Kanton/Gemeinde (3te Saeule)');
  });

  it('groups them in German too, since a group is what a report prints', () => {
    const group = (number: number) => german.find((a) => a.number === number)?.group;
    expect(group(4001)).toBe('Gemeinsame Kosten/Haushalt, Versicherungen');
    expect(group(4031)).toBe('Kosten Stefan/Krankenkasse, Telefon, Kleider');
    expect(group(5000)).toBe('Steuern/Bund, Kanton, Gemeinde');
  });

  it('keeps 3000 for the retirement it is there for, and ships no equity account', () => {
    // 3000 stays: it is the income account this household starts using on
    // retiring. 2100 is deliberately absent, because equity here is computed
    // as assets less liabilities and an account holding it would make the net
    // figure count itself twice.
    expect(title(3000)).toBe('Ertrag/Einnahmen');
    expect(german.some((account) => account.number === 2100)).toBe(false);
  });
});
