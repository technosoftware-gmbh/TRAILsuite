/**
 * Settings surviving a restart.
 *
 * The bug this exists for: `mergeSettings` matched a saved value against its
 * default's type and knew three of them, boolean, number and string. A setting
 * holding a list fell through all three and was replaced by the default on
 * every load. The exchange rates vanished at the first restart after they were
 * entered, and the import rules would have gone the same way without anybody
 * noticing until the second month asked every question the first had.
 *
 * The last test here is the one that matters most: it names no setting at all,
 * so a list setting added later is covered without anybody remembering to.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';
import { parseRates } from '../src/shared/rates';
import type { NODAtrailSettings } from '../src/settings/types';

/** What the store does: write the object out, read it back. */
const restart = (settings: NODAtrailSettings): NODAtrailSettings =>
  mergeSettings(JSON.parse(JSON.stringify(settings)) as unknown);

describe('exchange rates', () => {
  const saved: NODAtrailSettings = {
    ...DEFAULT_SETTINGS,
    exchangeRates: [
      { currency: 'EUR', rate: 0.93457944 },
      { currency: 'USD', rate: 1.14 },
    ],
  };

  it('survive a restart, to the last digit', () => {
    expect(restart(saved).exchangeRates).toEqual(saved.exchangeRates);
  });

  it('drop a row that says nothing usable and keep the rest', () => {
    const messy = mergeSettings({
      exchangeRates: [
        { currency: 'EUR', rate: 0.93 },
        { currency: 'EU', rate: 1 },
        { currency: 'USD', rate: 0 },
        { currency: 'GBP' },
        'nonsense',
      ],
    });
    expect(messy.exchangeRates).toEqual([{ currency: 'EUR', rate: 0.93 }]);
  });
});

describe('import rules', () => {
  it('survive a restart, which is what makes the second month easier than the first', () => {
    const saved: NODAtrailSettings = {
      ...DEFAULT_SETTINGS,
      importRules: [
        { match: 'SWISSCOM (SCHWEIZ) AG', account: 4034 },
        { match: 'AQUILANA VERSICHERUNGEN', account: 4031 },
      ],
    };
    expect(restart(saved).importRules).toEqual(saved.importRules);
  });

  it('drop a rule with no account to put anything on', () => {
    const messy = mergeSettings({
      importRules: [
        { match: 'MIGROS', account: 4000 },
        { match: '', account: 4000 },
        { match: 'ALDI', account: 0 },
      ],
    });
    expect(messy.importRules).toEqual([{ match: 'MIGROS', account: 4000 }]);
  });
});

describe('every setting that holds a list', () => {
  it('survives a restart, whichever ones those turn out to be', () => {
    // Named by shape rather than by name, so a list setting added next year is
    // covered by this without anybody remembering to come back here.
    const lists = (Object.keys(DEFAULT_SETTINGS) as (keyof NODAtrailSettings)[]).filter((key) =>
      Array.isArray(DEFAULT_SETTINGS[key])
    );
    expect(lists.length).toBeGreaterThan(0);

    const filled: NODAtrailSettings = { ...DEFAULT_SETTINGS };
    const sample: Record<string, unknown[]> = {
      importRules: [{ match: 'X', account: 4000 }],
      exchangeRates: [{ currency: 'EUR', rate: 0.93 }],
    };
    for (const key of lists) {
      const rows = sample[key as string];
      expect(
        rows,
        `no sample row for ${String(key)}; add one when adding the setting`
      ).toBeDefined();
      (filled as unknown as Record<string, unknown>)[key as string] = rows;
    }

    const after = restart(filled) as unknown as Record<string, unknown>;
    for (const key of lists) {
      expect(after[key as string], `${String(key)} did not survive a restart`).toEqual(
        sample[key as string]
      );
    }
  });
});

describe('writing a rate the way another system quotes it', () => {
  it('reads a plain figure', () => {
    expect(parseRates('EUR 0.93458')).toEqual([{ currency: 'EUR', rate: 0.93458 }]);
  });

  it('reads an inverted rate as a division, which is what was pasted', () => {
    // The old system quoted EUR as 1.07 and the figure needed here is its
    // reciprocal. Dividing by hand is where a digit gets lost.
    const [rate] = parseRates('EUR 1/1.07');
    expect(rate?.currency).toBe('EUR');
    expect(rate?.rate).toBeCloseTo(0.93457944, 8);
  });

  it('reads several at once, in either form', () => {
    expect(parseRates('EUR 1/1.07, USD 1.14')).toHaveLength(2);
  });

  it('drops what it cannot read rather than refusing the line', () => {
    expect(parseRates('EUR 1/0, USD 1.14')).toEqual([{ currency: 'USD', rate: 1.14 }]);
    expect(parseRates('nonsense')).toEqual([]);
  });
});
