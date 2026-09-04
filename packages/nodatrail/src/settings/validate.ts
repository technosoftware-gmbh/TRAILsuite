/**
 * Turning whatever is in `data.json` into a fully typed settings object.
 *
 * Every field is validated individually against the default's own type, and
 * anything missing or of the wrong shape falls back to the default. No corrupt
 * value from a hand-edited file ever reaches the UI, and no caller anywhere has
 * to hold a settings object that might be partial.
 *
 * **An empty string is kept rather than replaced.** Empty is meaningful in
 * several places here: a blank stamp property means "do not write that stamp",
 * a blank tag filter means "everyone", and a blank folder means "find nothing",
 * which is the safe reading of an unconfigured setting rather than the vault
 * root. Replacing a deliberate blank with a default would silently undo all
 * three.
 */
import { DEFAULT_SETTINGS } from './defaults';
import { ExchangeRateSetting, ImportRuleSetting, NODAtrailSettings } from './types';

/** Settings whose value must be a whole number at least this large. */
const MINIMUMS: Partial<Record<keyof NODAtrailSettings, number>> = {
  billDueSoonDays: 0,
};

/**
 * Settings that hold a list, and how to read one row of it.
 *
 * **A setting whose default is an array must appear here.** The loop below
 * matches a saved value against its default's type, and before this existed the
 * three cases it knew were boolean, number and string: an array fell through
 * every one of them and was silently replaced by the default on load. That lost
 * the exchange rates on the first restart after they were entered, and would
 * have quietly thrown away every import rule the same way, which nobody would
 * have noticed until the second month asked the same questions as the first.
 *
 * A row that cannot be read is dropped and the rest are kept, on the same terms
 * as everything else here: one bad line in a hand-edited file must not cost
 * somebody the other twenty.
 */
const LISTS: Partial<Record<keyof NODAtrailSettings, (row: Record<string, unknown>) => unknown>> = {
  importRules: readImportRule,
  exchangeRates: readExchangeRate,
};

function readImportRule(row: Record<string, unknown>): ImportRuleSetting | null {
  const match = typeof row['match'] === 'string' ? row['match'].trim() : '';
  const account = Number(row['account']);
  if (!match || !Number.isInteger(account) || account <= 0) return null;
  return { match, account };
}

function readExchangeRate(row: Record<string, unknown>): ExchangeRateSetting | null {
  const currency = typeof row['currency'] === 'string' ? row['currency'].trim().toUpperCase() : '';
  const rate = Number(row['rate']);
  if (currency.length !== 3 || !Number.isFinite(rate) || rate <= 0) return null;
  return { currency, rate };
}

export function mergeSettings(raw: unknown): NODAtrailSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  // Spread first so every key is present and typed; each loop iteration then
  // either keeps the default or replaces it with a value of the same type.
  const merged: NODAtrailSettings = { ...DEFAULT_SETTINGS };

  // `numberLocale` became `displayLocale` when the setting grew to cover dates
  // and moved into trail-core's shared contract. Read the old key when the new
  // one is absent, and only then: this plugin shipped a default of `de-CH`
  // where the contract's is blank, so a vault that never touched the setting
  // still gave an answer, and dropping it would silently redraw every figure in
  // its ledger in another country's convention. Written back under the new name
  // on the next save, so the migration runs once and the old key disappears.
  if (typeof source.displayLocale !== 'string' && typeof source.numberLocale === 'string') {
    source.displayLocale = source.numberLocale;
  }

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof NODAtrailSettings)[]) {
    const fallback = DEFAULT_SETTINGS[key];
    const value = source[key];

    if (typeof fallback === 'boolean') {
      if (typeof value === 'boolean') assign(merged, key, value);
      continue;
    }

    if (typeof fallback === 'number') {
      const number = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(number)) {
        const floor = MINIMUMS[key] ?? Number.NEGATIVE_INFINITY;
        assign(merged, key, Math.max(floor, Math.round(number)));
      }
      continue;
    }

    if (Array.isArray(fallback)) {
      const read = LISTS[key];
      if (read && Array.isArray(value)) {
        const rows = value
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map(read)
          .filter((row) => row !== null);
        assignList(merged, key, rows);
      }
      continue;
    }

    if (typeof value === 'string') assign(merged, key, value);
  }

  return merged;
}

/** The same one write, for the settings that hold a list. */
function assignList<K extends keyof NODAtrailSettings>(
  settings: NODAtrailSettings,
  key: K,
  value: unknown[]
): void {
  (settings as unknown as Record<string, unknown>)[key as string] = value;
}

/**
 * One write, with the cast in one place.
 *
 * The loop above knows a value matches its default's type, and TypeScript
 * cannot see that through a union of key types. Isolating the cast here keeps
 * it from being copied to three call sites where the reasoning would be less
 * obvious each time.
 */
function assign<K extends keyof NODAtrailSettings>(
  settings: NODAtrailSettings,
  key: K,
  value: string | number | boolean
): void {
  (settings as unknown as Record<string, unknown>)[key as string] = value;
}
