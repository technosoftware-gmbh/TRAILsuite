/**
 * The shapes the translation layer is built from, in a file that neither
 * the tables nor the manager can import in a circle.
 *
 * `Translations` is `typeof enTranslations` rather than a hand-written
 * interface. That is what makes English the base language in the type
 * system and not only by convention: a key a translation spells differently
 * from English is a compile error rather than a string that silently falls
 * back forever.
 */
import { enTranslations } from './translations/en';

/** Every key English has, nested the way English nests it. */
export type Translations = typeof enTranslations;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? T[K] : DeepPartial<T[K]>;
};

/**
 * A locale nobody has finished yet, which is what every community
 * translation is for most of its life. `t()` falls back to English key by
 * key, so a partial table is a usable table; the type only insists that
 * whatever IS in it is spelled the way English spells it.
 */
export type PartialTranslations = DeepPartial<Translations>;

/** The runtime shape a dotted lookup walks. */
export interface LocaleData {
  [key: string]: string | LocaleData;
}

export interface SupportedLocale {
  code: string;
  /** The English name, for a list that should read the same whatever the UI language is. */
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  contributors?: string[];
}

/** A locale plus the table that makes it real. A locale without one cannot be registered, which is the whole point of the registry. */
export interface LocaleEntry extends SupportedLocale {
  table: PartialTranslations;
}
