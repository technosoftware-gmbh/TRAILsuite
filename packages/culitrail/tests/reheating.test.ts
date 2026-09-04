/**
 * Reheating a dish that was bought ready to eat.
 *
 * The merge-rule block below has **one case per row of the table** in
 * docs/design/ready-meals.md, in the same order, and is meant to be read next to
 * it. The row worth defending is the one where a supplier's wording carries a
 * token nothing fills: the appliance is withheld entirely, because "heat for
 * about {time}" reads as a bug and cannot be acted on in a kitchen.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { matchAppliance, applianceLabel } from '../src/meals/reheating/appliances';
import { parseReheatSection } from '../src/meals/reheating/parse-section';
import { resolveAppliance, resolveReheating } from '../src/meals/reheating/resolve';
import type { ApplianceEntry } from '../src/meals/reheating/types';
import type { CULItrailSettings } from '../src/settings/types';

const settings: CULItrailSettings = mergeSettings({});

function entry(over: Partial<ApplianceEntry> = {}): ApplianceEntry {
  return {
    applianceId: 'steamer',
    label: 'Steamer',
    unknown: false,
    steps: [],
    temp: null,
    time: null,
    ...over,
  };
}

describe('matching a sub-heading to an appliance', () => {
  it('matches the configured label', () => {
    expect(matchAppliance('Steamer', settings.reheatAppliances)).toEqual({
      applianceId: 'steamer',
      label: 'Steamer',
      unknown: false,
    });
  });

  it('matches the id, and case and whitespace do not count', () => {
    expect(matchAppliance('  STEAMER ', settings.reheatAppliances).applianceId).toBe('steamer');
  });

  it('matches the German default in an English vault, and the English in a German one', () => {
    // A household that switches language must not stop recognising the headings
    // it has already written, and a shared vault holds both.
    expect(matchAppliance('Dampfgarer', settings.reheatAppliances).applianceId).toBe('steamer');

    const german = mergeSettings({
      reheatAppliances: [{ id: 'steamer', label: 'Dampfgarer' }],
    });
    const match = matchAppliance('Steamer', german.reheatAppliances);
    expect(match.applianceId).toBe('steamer');
    // Labelled from the vault's own list rather than echoing the note.
    expect(match.label).toBe('Dampfgarer');
  });

  it('keeps an appliance it has never heard of, labelled as written', () => {
    // Text somebody typed under a heading this plugin has no vocabulary for is
    // still their instruction. Hiding it would be the parser deciding it knows
    // better than the note.
    const match = matchAppliance('Air fryer', settings.reheatAppliances);
    expect(match).toEqual({ applianceId: 'Air fryer', label: 'Air fryer', unknown: true });
  });

  it('resolves an id back to its label, and falls back to the id itself', () => {
    expect(applianceLabel('oven', settings.reheatAppliances)).toBe('Oven');
    expect(applianceLabel('tandoor', settings.reheatAppliances)).toBe('tandoor');
  });
});

describe('reading a reheating section', () => {
  it('reads prose as a step, since a supplier states one in a sentence', () => {
    const body = [
      '# Reheating',
      '',
      '## Steamer',
      'Remove the clear plastic wrap from the dish. Use the reheat function at 95',
      'degrees Celsius and heat it for about 25 minutes.',
    ].join('\n');

    const [read] = parseReheatSection(body, settings);
    expect(read.applianceId).toBe('steamer');
    expect(read.steps).toHaveLength(1);
    expect(read.steps[0]).toContain('about 25 minutes');
  });

  it('reads a list as one step per item', () => {
    const body = [
      '# Reheating',
      '## Oven',
      '1. Preheat to 180 °C.',
      '2. Heat for 20 minutes.',
    ].join('\n');
    expect(parseReheatSection(body, settings)[0].steps).toEqual([
      'Preheat to 180 °C.',
      'Heat for 20 minutes.',
    ]);
  });

  it('reads the inline fields and keeps them out of the steps', () => {
    const body = ['# Reheating', '## Steamer', '[temp:: 95 °C] [time:: 25 min]'].join('\n');
    const [read] = parseReheatSection(body, settings);

    expect(read.temp).toBe('95 °C');
    expect(read.time).toBe('25 min');
    expect(read.steps).toEqual([]);
  });

  it('drops an appliance heading with nothing under it', () => {
    // It says only that somebody typed a heading. An empty instruction reads as a
    // parsing failure rather than as an absence.
    const body = ['# Reheating', '## Steamer', '', '## Oven', 'Heat for 20 minutes.'].join('\n');
    expect(parseReheatSection(body, settings).map((e) => e.applianceId)).toEqual(['oven']);
  });

  it('finds nothing in a note with no such section, and nothing when the heading is blank', () => {
    expect(parseReheatSection('# Notes\n- Works with rigatoni.', settings)).toEqual([]);
    expect(
      parseReheatSection('# Reheating\n## Oven\nHot.', mergeSettings({ reheatingHeading: '' }))
    ).toEqual([]);
  });

  it('leaves a fenced block out of the instructions', () => {
    // Found on the real TomTasty company note. The shared CRM note carries a
    // `culi-related-orders` fence after the reheating section, and with no heading
    // following it every line of it landed inside the Steamer instruction: the
    // reader was told to remove the plastic wrap and then shown backticks.
    const body = [
      '# Reheating',
      '',
      '## Steamer',
      'Remove the wrap and reheat.',
      '',
      '```culi-related-orders',
      '```',
    ].join('\n');

    expect(parseReheatSection(body, settings)[0].steps).toEqual(['Remove the wrap and reheat.']);
  });

  it('does not read an inline field out of a fenced example', () => {
    const body = ['# Reheating', '## Oven', '```', '[temp:: 200 °C]', '```', 'Heat it.'].join('\n');
    const [read] = parseReheatSection(body, settings);

    expect(read.temp).toBeNull();
    expect(read.steps).toEqual(['Heat it.']);
  });

  it('does not read a section another feature renders as an appliance', () => {
    // The real case, and it will hit most dishes: the eating-history writer emits
    // `## Eating History` while these notes write their other sections `#`, so a
    // `# Reheating` pasted above the log puts the log *inside* it, one level
    // deeper. Without this guard the log was offered as a way to reheat the dish.
    const body = [
      '# Reheating',
      '',
      '## Steamer',
      '[temp:: 95 °C] [time:: 25 min]',
      '',
      '## Eating History',
      '- 2025-12-11 12:00 · Stefan Muster',
    ].join('\n');

    expect(parseReheatSection(body, settings).map((e) => e.label)).toEqual(['Steamer']);
  });

  it('finds the section wherever it sits, not only at the end of the note', () => {
    // The convention is that it comes last, and a note that puts it first is
    // still a note whose reheating instructions should be found.
    const body = [
      '# Reheating',
      '## Oven',
      'Heat for 20 minutes.',
      '',
      '# Notes',
      'Works with rigatoni.',
    ].join('\n');
    expect(parseReheatSection(body, settings).map((e) => e.applianceId)).toEqual(['oven']);
  });

  it('ignores prose that names no appliance', () => {
    const body = ['# Reheating', 'Do not refreeze.', '## Oven', 'Heat for 20 minutes.'].join('\n');
    expect(parseReheatSection(body, settings).map((e) => e.applianceId)).toEqual(['oven']);
  });
});

describe('the merge rule, one case per row of the design table', () => {
  const supplierProse = entry({ steps: ['Unwrap. Reheat at {temp} for about {time}.'] });

  it('row 1: dish prose wins outright, supplier ignored', () => {
    const resolved = resolveAppliance(
      entry({ steps: ['Steam it for 25 minutes.'] }),
      supplierProse
    );
    expect(resolved?.steps).toEqual(['Steam it for 25 minutes.']);
    expect(resolved?.source).toBe('dish');
  });

  it('row 2: dish prose with its own tokens is filled from its own numbers', () => {
    const resolved = resolveAppliance(
      entry({ steps: ['Steam at {temp} for {time}.'], temp: '95 °C', time: '25 min' }),
      undefined
    );
    expect(resolved?.steps).toEqual(['Steam at 95 °C for 25 min.']);
    expect(resolved?.source).toBe('dish');
  });

  it('row 3: numbers only fill the supplier wording', () => {
    const resolved = resolveAppliance(entry({ temp: '95 °C', time: '25 min' }), supplierProse);
    expect(resolved?.steps).toEqual(['Unwrap. Reheat at 95 °C for about 25 min.']);
    expect(resolved?.source).toBe('supplier');
  });

  it('row 4: numbers are appended when the supplier wording has no token for them', () => {
    // A supplier that never mentions a temperature and a dish that states one are
    // both saying something a reader needs.
    const resolved = resolveAppliance(
      entry({ temp: '95 °C', time: '25 min' }),
      entry({ steps: ['Unwrap and use the reheat function.'] })
    );
    expect(resolved?.steps).toEqual(['Unwrap and use the reheat function.', '95 °C, 25 min']);
    expect(resolved?.source).toBe('supplier');
  });

  it('row 5: numbers alone become the instruction when nobody supplies wording', () => {
    const resolved = resolveAppliance(entry({ temp: '95 °C', time: '25 min' }), undefined);
    expect(resolved?.steps).toEqual(['95 °C, 25 min']);
    expect(resolved?.source).toBe('numbers');
  });

  it('row 6: the supplier wording alone, when the dish says nothing', () => {
    const resolved = resolveAppliance(undefined, entry({ steps: ['Unwrap and heat through.'] }));
    expect(resolved?.steps).toEqual(['Unwrap and heat through.']);
    expect(resolved?.source).toBe('supplier');
  });

  it('row 7: a supplier token nothing fills withholds the appliance entirely', () => {
    expect(resolveAppliance(undefined, supplierProse)).toBeNull();
    // Half the numbers is still not enough: "at 95 °C for" is worse than silence.
    expect(resolveAppliance(entry({ temp: '95 °C' }), supplierProse)).toBeNull();
    // And with both, it resolves, which is what makes the case above a decision
    // rather than a failure to parse.
    expect(
      resolveAppliance(entry({ temp: '95 °C', time: '25 min' }), supplierProse)
    ).not.toBeNull();
  });

  it('row 8: nothing on either side offers nothing', () => {
    expect(resolveAppliance(entry(), entry())).toBeNull();
    expect(resolveAppliance(undefined, undefined)).toBeNull();
  });
});

describe('resolving a whole dish', () => {
  it('offers the union of what the two notes mention, in the configured order', () => {
    const dish = [entry({ applianceId: 'oven', label: 'Oven', steps: ['Dish oven wording.'] })];
    const supplier = [
      entry({ applianceId: 'steamer', label: 'Steamer', steps: ['Supplier steamer wording.'] }),
      entry({
        applianceId: 'microwave',
        label: 'Microwave',
        steps: ['Supplier microwave wording.'],
      }),
    ];

    // Microwave, Oven, Steamer is the order of the default settings list, not the
    // order either note happens to list them in.
    expect(resolveReheating(dish, supplier, settings).map((r) => r.applianceId)).toEqual([
      'microwave',
      'oven',
      'steamer',
    ]);
  });

  it('fills each appliance from its own numbers, with nothing appended twice', () => {
    // Two appliances whose supplier wording names a temperature and whose dishes
    // give different ones. A second step on either row would mean the token went
    // unrecognised and the temperature was appended on top of the sentence that
    // already states it.
    const supplier = [
      entry({ applianceId: 'microwave', label: 'Microwave', steps: ['Microwave it at {temp}.'] }),
      entry({ applianceId: 'oven', label: 'Oven', steps: ['Oven at {temp}.'] }),
    ];
    const dish = [
      entry({ applianceId: 'microwave', label: 'Microwave', temp: '800 W' }),
      entry({ applianceId: 'oven', label: 'Oven', temp: '180 °C' }),
    ];

    const resolved = resolveReheating(dish, supplier, settings);
    expect(resolved.map((r) => r.steps)).toEqual([['Microwave it at 800 W.'], ['Oven at 180 °C.']]);
  });

  it('puts an unknown appliance last rather than dropping it', () => {
    const dish = [
      entry({ applianceId: 'Tandoor', label: 'Tandoor', unknown: true, steps: ['Somehow.'] }),
      entry({ applianceId: 'oven', label: 'Oven', steps: ['Heat it.'] }),
    ];
    expect(resolveReheating(dish, [], settings).map((r) => r.label)).toEqual(['Oven', 'Tandoor']);
  });
});

describe('a dish and its supplier, end to end', () => {
  it('fills the supplier wording from the numbers Älpler Magronen states', () => {
    // The nine notes in the real vault that state a temperature and a time of
    // their own under an appliance their supplier writes the wording for. This
    // is the case most likely to regress, so it is asserted as a whole rather
    // than only through its parts.
    const body = [
      '# Notes',
      'Bought as a ready meal, and reheated in the steamer.',
      '',
      '# Reheating',
      '',
      '## Steamer',
      '[temp:: 95 °C] [time:: 25 min]',
    ].join('\n');

    const supplier = parseReheatSection(
      ['# Reheating', '## Steamer', 'Remove the wrap. Reheat at {temp} for about {time}.'].join(
        '\n'
      ),
      settings
    );

    const reheating = resolveReheating(parseReheatSection(body, settings), supplier, settings);
    expect(reheating).toHaveLength(1);
    expect(reheating[0].steps).toEqual(['Remove the wrap. Reheat at 95 °C for about 25 min.']);
    expect(reheating[0].source).toBe('supplier');
  });
});
