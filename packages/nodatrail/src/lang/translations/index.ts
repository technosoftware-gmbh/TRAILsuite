/**
 * The one place a language exists.
 *
 * Before this file was a registry, a locale was declared in three places:
 * a thirteen-entry list of "supported" locales, a two-entry map of tables,
 * and a hardcoded array of the ones actually available. Two of the three
 * disagreed on purpose and the third repeated the second by hand, so a
 * contributor who added a table and wired it into the map got a language
 * that loaded and never appeared in the list. Registering the table WITH
 * the locale removes the state those lists disagreed about: a locale is
 * supported when its table is here, and never otherwise.
 *
 * Adding a language: write `xx.ts` beside this file, import it, add one
 * entry below. Nothing else in `src/` needs to know.
 */
import { LocaleEntry } from '../types';
import { enTranslations } from './en';
import { deTranslations } from './de';

export { enTranslations } from './en';
export { deTranslations } from './de';

/** The locale every missing key falls back to, and the one the type system measures the others against. */
export const FALLBACK_LOCALE = 'en';

export const LOCALES: LocaleEntry[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    table: enTranslations,
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    table: deTranslations,
  },
];

/**
 * The registered locale for a code, matched leniently.
 *
 * Exact match first, then case-insensitively, then by language alone, so
 * `de-AT` finds German and a future `zh-CN` table is found by a vault
 * reporting plain `zh`. Region-specific tables are therefore free to be
 * added later without the callers learning anything new.
 */
export function localeEntry(code: string): LocaleEntry | undefined {
  const wanted = code.trim();
  if (!wanted) return undefined;

  const lower = wanted.toLowerCase();
  return (
    LOCALES.find((locale) => locale.code === wanted) ??
    LOCALES.find((locale) => locale.code.toLowerCase() === lower) ??
    LOCALES.find((locale) => locale.code.toLowerCase().split('-')[0] === lower.split('-')[0])
  );
}
