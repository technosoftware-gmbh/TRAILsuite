/**
 * Translation lookup for the plugin, over the locale registry in
 * `translations/index.ts`.
 *
 * Two rules carry everything here. English is the base language: every
 * table is measured against it at compile time and every missing key falls
 * back to it at runtime, key by key, so a half-finished translation renders
 * as a mix of two languages rather than as a screen of raw key paths. And
 * the locale follows Obsidian rather than a setting of this plugin's own,
 * because a vault owner who has already told Obsidian which language they
 * read should not have to say it twice.
 *
 * What is deliberately NOT here: any translation of a value that gets
 * written into a note. The light windows, the accessibility values, the
 * transit modes and the type literals stay English identifiers in the
 * frontmatter and are only translated on their way to the screen.
 */
import { App, Plugin } from 'obsidian';
import { FALLBACK_LOCALE, LOCALES, localeEntry } from './translations';
import { LocaleData, LocaleEntry, SupportedLocale } from './types';
import { isPluralForms, selectPluralForm } from './plural';

export type { LocaleData, SupportedLocale } from './types';

interface ObsidianAppWithConfig {
  vault?: {
    config?: {
      userInterfaceMode?: string;
    };
  };
  locale?: string;
}

interface WindowWithMoment {
  moment?: {
    locale?: () => string;
  };
}

export class I18nManager {
  private readonly app: App;
  private current: LocaleEntry;
  private readonly fallback: LocaleEntry;
  private static instance: I18nManager | null = null;

  private constructor(plugin: Plugin) {
    this.app = plugin.app;
    // The registry cannot be empty and always carries English, so this is a
    // lookup rather than a search that might fail.
    this.fallback = localeEntry(FALLBACK_LOCALE) ?? LOCALES[0];
    this.current = this.fallback;
  }

  static init(plugin: Plugin): I18nManager {
    if (!this.instance) this.instance = new I18nManager(plugin);
    return this.instance;
  }

  static unload(): void {
    this.instance = null;
  }

  static getInstance(): I18nManager {
    if (!this.instance) {
      throw new Error('I18nManager not initialized. Call I18nManager.init(plugin) first.');
    }
    return this.instance;
  }

  /**
   * Kept async because the plugin awaits it on load and a future table read
   * from disk would need it.
   *
   * `preferred` is the saved language setting, read before the settings
   * store proper because the store's own folder defaults are localized and
   * therefore need the catalogue already in place. Anything but a
   * registered code (including the literal `auto`) means "follow Obsidian".
   */
  async initialize(preferred?: string): Promise<void> {
    const wanted = preferred && preferred !== 'auto' ? preferred : this.detectedLocale();
    await this.setLocale(wanted);
  }

  /** What following Obsidian resolves to right now. Public so the settings page can switch back to it without a reload. */
  detectedLocale(): string {
    return this.detectUserLocale();
  }

  /**
   * Reads Obsidian's own language, then the document's, then the browser's.
   *
   * Every one of those is a global that may simply not be there (no moment,
   * an Obsidian build that moved its locale setting, a test environment
   * with no document), which is why the whole thing sits in one try and any
   * failure means "detected nothing" rather than an error.
   */
  private detectUserLocale(): string {
    try {
      const candidates = [
        this.getMomentLocale(),
        activeDocument?.documentElement?.lang,
        (this.app as ObsidianAppWithConfig).vault?.config?.userInterfaceMode,
        (this.app as ObsidianAppWithConfig).locale,
        navigator?.language,
        navigator?.languages?.[0],
      ];

      for (const candidate of candidates) {
        // localeEntry() already matches a region tag against a plain
        // language code and the other way round, so there is nothing to
        // split or normalize here.
        const entry = candidate ? localeEntry(candidate) : undefined;
        if (entry) return entry.code;
      }
    } catch {
      // Detection failed; the fallback below is the answer.
    }

    return FALLBACK_LOCALE;
  }

  private getMomentLocale(): string | null {
    try {
      const instance = (window as WindowWithMoment | undefined)?.moment;
      if (typeof instance?.locale === 'function') return instance.locale();
      return null;
    } catch {
      return null;
    }
  }

  /** Unknown or unregistered codes resolve to English rather than to a table that would make every key render as itself. */
  async setLocale(locale: string): Promise<void> {
    this.current = localeEntry(locale) ?? this.fallback;
    return Promise.resolve();
  }

  t(key: string, interpolations?: Record<string, string | number>): string {
    try {
      const value = this.lookup(key);
      // A key may hold a set of plural forms instead of one string. Which
      // form is right is a property of the language, not of the call site,
      // so the call site passes a `count` and says nothing about grammar.
      const resolved =
        isPluralForms(value) && typeof interpolations?.count === 'number'
          ? selectPluralForm(value, interpolations.count, this.current.code)
          : value;
      if (typeof resolved !== 'string') return key;
      return interpolations ? interpolate(resolved, interpolations) : resolved;
    } catch {
      return key;
    }
  }

  /** The current locale, then English. Per key rather than per table, so a partial translation is a usable one. */
  private lookup(key: string): string | LocaleData | undefined {
    const own = nestedValue(this.current.table, key);
    if (own !== undefined) return own;
    if (this.current.code === this.fallback.code) return undefined;
    return nestedValue(this.fallback.table, key);
  }

  /** Every registered locale. There is no second list of "supported" ones: a locale without a table cannot be registered. */
  getLocales(): SupportedLocale[] {
    return LOCALES.map(({ table: _table, ...locale }) => locale);
  }

  getCurrentLocale(): string {
    return this.current.code;
  }

  getCurrentLocaleInfo(): SupportedLocale {
    const { table: _table, ...locale } = this.current;
    return locale;
  }

  isRTL(): boolean {
    return this.current.direction === 'rtl';
  }
}

function nestedValue(table: LocaleData, path: string): string | LocaleData | undefined {
  return path.split('.').reduce<string | LocaleData | undefined>((node, part) => {
    if (node && typeof node === 'object' && part in node) return node[part];
    return undefined;
  }, table);
}

/** `{name}` placeholders. An unknown one is left as written rather than blanked, so a bad key looks like a bad key. */
function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => variables[key]?.toString() ?? match
  );
}

/**
 * Every language's spelling of one key, the current one first.
 *
 * For the one case where a string this plugin **wrote into a note** has to be
 * found again later: the day note's headings. `t()` answers in whichever
 * language is current, and a vault that switches language would then look for
 * `## 🎯 Fokus` in a note carrying `## 🎯 Focus` and write a second heading
 * beside the first. Both spellings are ours, so both are worth recognising.
 *
 * Deduplicated, and the current locale leads, so a caller can treat the first
 * entry as the one to write and the rest as ones to accept.
 *
 * Not for anything on screen. A label rendered in two languages at once is a
 * bug; this exists because a note outlives the setting that spelled it.
 */
export function tAll(key: string): string[] {
  const seen = new Set<string>();
  const current = t(key);
  if (current !== key) seen.add(current);

  for (const locale of LOCALES) {
    const value = nestedValue(locale.table, key);
    if (typeof value === 'string') seen.add(value);
  }
  return [...seen];
}

/** The call site everything else uses. Returns the key when the manager is not up yet, which is what the settings defaults rely on. */
export function t(key: string, interpolations?: Record<string, string | number>): string {
  try {
    return I18nManager.getInstance().t(key, interpolations);
  } catch {
    return key;
  }
}
