/**
 * Localization for CULItrail: locale detection, translation-table loading and
 * key lookup.
 *
 * Initialized first in main.ts's onload(), before the settings store, because
 * `getLocalizedFolderDefaults()` and every synchronous UI-building call to
 * `t()` need a catalogue already in place. Both are written to survive it not
 * being there anyway: `getInstance()` throws and `t()` returns the key, which
 * is what lets unit tests and the very first moments of load work without a
 * bootstrap.
 */
import { App, Plugin } from 'obsidian';
import { enTranslations } from './translations/en';
import { deTranslations } from './translations/de';

export interface LocaleData {
  [key: string]: string | LocaleData;
}

export interface SupportedLocale {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

/** The slice of Obsidian's App that locale detection reads, neither part of the public API. */
interface ObsidianAppWithConfig {
  vault?: {
    config?: {
      userInterfaceMode?: string;
    };
  };
  locale?: string;
}

/** Obsidian injects moment onto window at runtime; the `obsidian` npm package is types-only and cannot. */
interface WindowWithMoment {
  moment?: {
    locale?: () => string;
  };
}

export class I18nManager {
  private app: App;
  private currentLocale = 'en';
  private readonly fallbackLocale = 'en';
  private translations: Map<string, LocaleData> = new Map();
  private supportedLocales: Map<string, SupportedLocale> = new Map();
  private static instance: I18nManager;

  private constructor(plugin: Plugin) {
    this.app = plugin.app;
    this.initializeSupportedLocales();
  }

  static init(plugin: Plugin): I18nManager {
    if (!this.instance) {
      this.instance = new I18nManager(plugin);
    }
    return this.instance;
  }

  static unload(): void {
    this.instance = null;
  }

  /** Throws when not initialized. Callers that can work without a catalogue catch this; see settings/defaults.ts. */
  static getInstance(): I18nManager {
    if (!this.instance) {
      throw new Error('I18nManager not initialized. Call I18nManager.init(plugin) first.');
    }
    return this.instance;
  }

  /**
   * The locales the plugin knows how to name, which is a longer list than the
   * locales it actually ships a table for (see getAvailableLocales()). A
   * locale being listed here only means detection recognizes it; setLocale()
   * falls back to English when its table turns out to be empty.
   */
  private initializeSupportedLocales(): void {
    const locales: SupportedLocale[] = [
      { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
      { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
      { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
      { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
      { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr' },
      { code: 'zh-CN', name: 'Chinese Simplified', nativeName: '简体中文', direction: 'ltr' },
      { code: 'zh-TW', name: 'Chinese Traditional', nativeName: '繁體中文', direction: 'ltr' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
      { code: 'he', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl' },
    ];

    for (const locale of locales) this.supportedLocales.set(locale.code, locale);
  }

  async initialize(): Promise<void> {
    try {
      await this.setLocale(this.detectUserLocale());
    } catch {
      await this.setLocale('en');
    }
  }

  /**
   * Follows Obsidian's own language setting rather than offering a locale
   * setting of its own, so the plugin never disagrees with the app around it.
   */
  private detectUserLocale(): string {
    try {
      const obsidianLocale =
        this.getMomentLocale() ||
        activeDocument.documentElement.lang ||
        (this.app as ObsidianAppWithConfig).vault?.config?.userInterfaceMode ||
        (this.app as ObsidianAppWithConfig).locale;

      if (obsidianLocale) {
        // Both Chinese variants map to one table until a second one ships.
        if (obsidianLocale.toLowerCase().startsWith('zh')) {
          return 'zh-CN';
        }

        if (this.isLocaleSupported(obsidianLocale)) {
          return obsidianLocale;
        }

        // en-GB and friends fall back to their language code.
        const languageCode = obsidianLocale.split('-')[0].toLowerCase();
        if (this.isLocaleSupported(languageCode)) {
          return languageCode;
        }
      }

      const browserLocale = navigator.language || navigator.languages?.[0];
      if (browserLocale) {
        if (this.isLocaleSupported(browserLocale)) {
          return browserLocale;
        }

        const languageCode = browserLocale.split('-')[0];
        if (this.isLocaleSupported(languageCode)) {
          return languageCode;
        }
      }
    } catch {
      // Every branch above reads a global that may simply not exist (no
      // window, no moment, an Obsidian build that moved its locale setting).
      // Any of those just means "we could not detect anything", which the
      // fallback below already handles. This is also the path unit tests
      // take, since none of those globals exist under Node.
    }

    return this.fallbackLocale;
  }

  private getMomentLocale(): string | null {
    try {
      if (typeof window !== 'undefined' && (window as WindowWithMoment).moment) {
        const momentInstance = (window as WindowWithMoment).moment;
        if (momentInstance?.locale && typeof momentInstance.locale === 'function') {
          return momentInstance.locale();
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private isLocaleSupported(locale: string): boolean {
    return this.supportedLocales.has(locale);
  }

  private getTranslationsFromFile(locale: string): LocaleData {
    const translationMap: Record<string, LocaleData> = {
      en: enTranslations,
      de: deTranslations,
      // Add more languages here as they become available.
    };

    return translationMap[locale] || {};
  }

  async setLocale(locale: string): Promise<void> {
    // Deliberately not wrapped in a try/catch: initialize() above already
    // catches and falls back to English, and swallowing a failure here as
    // well would leave the manager reporting a locale whose table never
    // loaded.
    if (!this.isLocaleSupported(locale)) {
      locale = this.fallbackLocale;
    }

    const localeData = this.getTranslationsFromFile(locale);

    // A supported-but-unshipped locale has no data. Fall back rather than
    // registering an empty table, which would make every t() return its key.
    if (locale !== this.fallbackLocale && Object.keys(localeData).length === 0) {
      locale = this.fallbackLocale;
      this.translations.set(locale, this.getTranslationsFromFile(locale));
    } else {
      this.translations.set(locale, localeData);
    }

    this.currentLocale = locale;
  }

  t(key: string, interpolations?: Record<string, string | number>): string {
    try {
      const value = this.getTranslation(key);

      if (interpolations && typeof value === 'string') {
        return this.interpolate(value, interpolations);
      }

      return typeof value === 'string' ? value : key;
    } catch {
      return key;
    }
  }

  private getTranslation(key: string): string | LocaleData {
    const currentTranslations = this.translations.get(this.currentLocale);
    const fallbackTranslations = this.translations.get(this.fallbackLocale);

    let value = this.getNestedValue(currentTranslations, key);

    // A key present in English but not yet in the active locale renders in
    // English rather than as a raw key. tests/translation-keys.test.ts is
    // what stops that from becoming the normal state of affairs.
    if (value === undefined && this.currentLocale !== this.fallbackLocale) {
      value = this.getNestedValue(fallbackTranslations, key);
    }

    return value ?? key;
  }

  private getNestedValue(
    obj: LocaleData | undefined,
    path: string
  ): string | LocaleData | undefined {
    if (!obj) return undefined;

    return path.split('.').reduce((current: string | LocaleData | undefined, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return current[key];
      }
      return undefined;
    }, obj);
  }

  private interpolate(template: string, variables: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
      return variables[key]?.toString() ?? match;
    });
  }

  getSupportedLocales(): SupportedLocale[] {
    return Array.from(this.supportedLocales.values());
  }

  getCurrentLocale(): string {
    return this.currentLocale;
  }

  getCurrentLocaleInfo(): SupportedLocale | undefined {
    return this.supportedLocales.get(this.currentLocale);
  }

  isRTL(): boolean {
    return this.getCurrentLocaleInfo()?.direction === 'rtl';
  }

  /** The locales that actually ship a table, as opposed to the ones detection can name. */
  getAvailableLocales(): SupportedLocale[] {
    const availableLocaleCodes = ['en', 'de'];

    return availableLocaleCodes
      .map((code) => this.supportedLocales.get(code))
      .filter((locale): locale is SupportedLocale => locale !== undefined);
  }
}

/** Returns the key itself when the manager is not initialized, so no caller has to guard. */
export function t(key: string, interpolations?: Record<string, string | number>): string {
  try {
    return I18nManager.getInstance().t(key, interpolations);
  } catch {
    return key;
  }
}
