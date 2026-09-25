/**
 * Every language's spelling of one key, read straight off the tables.
 *
 * `I18nManager.tAll()` puts the current language first, and the current
 * language is Obsidian's, so it cannot run outside Obsidian. A reader that
 * only has to **recognise** a string this plugin wrote into a note (the day
 * note's headings) does not care which spelling leads, and reads them here.
 *
 * Imports no `obsidian`: the host-free period reader relies on it.
 */
import { LOCALES } from './translations';
import type { LocaleData } from './types';

export function nestedValue(table: LocaleData, path: string): string | LocaleData | undefined {
  return path.split('.').reduce<string | LocaleData | undefined>((node, part) => {
    if (node && typeof node === 'object' && part in node) return node[part];
    return undefined;
  }, table);
}

/** Every registered language's value for `key`, deduplicated, in registration order. */
export function translationsOf(key: string): string[] {
  const seen = new Set<string>();
  for (const locale of LOCALES) {
    const value = nestedValue(locale.table, key);
    if (typeof value === 'string') seen.add(value);
  }
  return [...seen];
}
