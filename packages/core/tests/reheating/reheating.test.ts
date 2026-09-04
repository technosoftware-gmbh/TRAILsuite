/**
 * Reheating an ordered meal.
 *
 * The merge-rule block below has **one case per row of the table** in CULItrail's
 * `docs/design/ready-meals.md`, in the same order, and is meant to be read next
 * to it. The row worth defending is the one where a supplier's wording carries a
 * token nothing fills: the appliance is withheld entirely, because "heat for
 * about {time}" reads as a bug and cannot be acted on in a kitchen.
 *
 * Written for CULItrail and moved here with the code, which is why the fixtures
 * are its vault's rather than invented.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPLIANCES,
  applianceLabel,
  matchAppliance,
  parseApplianceEntries,
  resolveAppliance,
  resolveReheating,
  type ApplianceEntry,
  type ReheatAppliance,
} from '../../src/reheating';

const appliances: ReheatAppliance[] = DEFAULT_APPLIANCES;

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

/** A section already split into blocks, which is what the core is handed. */
function blocks(...pairs: [string | null, string[]][]) {
  return pairs.map(([heading, lines]) => ({ heading, lines }));
}

describe('matching a sub-heading to an appliance', () => {
  it('matches the configured label', () => {
    expect(matchAppliance('Steamer', appliances)).toEqual({
      applianceId: 'steamer',
      label: 'Steamer',
      unknown: false,
    });
  });

  it('matches the id, and case and whitespace do not count', () => {
    expect(matchAppliance('  STEAMER ', appliances).applianceId).toBe('steamer');
  });

  it('matches the German default in an English vault, and the English in a German one', () => {
    // A household that switches language must not stop recognising the headings
    // it has already written, and a shared vault holds both.
    expect(matchAppliance('Dampfgarer', appliances).applianceId).toBe('steamer');

    const german: ReheatAppliance[] = [{ id: 'steamer', label: 'Dampfgarer' }];
    const match = matchAppliance('Steamer', german);
    expect(match.applianceId).toBe('steamer');
    // Labelled from the vault's own list rather than echoing the note.
    expect(match.label).toBe('Dampfgarer');
  });

  it('keeps an appliance it has never heard of, labelled as written', () => {
    // Text somebody typed under a heading with no vocabulary for it is still
    // their instruction. Hiding it would be the parser deciding it knows better
    // than the note.
    const match = matchAppliance('Air fryer', appliances);
    expect(match).toEqual({ applianceId: 'Air fryer', label: 'Air fryer', unknown: true });
  });

  it('resolves an id back to its label, and falls back to the id itself', () => {
    expect(applianceLabel('oven', appliances)).toBe('Oven');
    expect(applianceLabel('tandoor', appliances)).toBe('tandoor');
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
    expect(resolveReheating(dish, supplier, appliances).map((r) => r.applianceId)).toEqual([
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

    const resolved = resolveReheating(dish, supplier, appliances);
    expect(resolved.map((r) => r.steps)).toEqual([['Microwave it at 800 W.'], ['Oven at 180 °C.']]);
  });

  it('puts an unknown appliance last rather than dropping it', () => {
    const dish = [
      entry({ applianceId: 'Tandoor', label: 'Tandoor', unknown: true, steps: ['Somehow.'] }),
      entry({ applianceId: 'oven', label: 'Oven', steps: ['Heat it.'] }),
    ];
    expect(resolveReheating(dish, [], appliances).map((r) => r.label)).toEqual(['Oven', 'Tandoor']);
  });
});

describe('the supplier-wording case, end to end', () => {
  it("fills a supplier's tokens from the meal's own numbers", () => {
    // A real note from the vault this was built against: the meal states the
    // numbers and the company states the wording. This is the case most likely
    // to regress, so it is asserted as a whole rather than only through its
    // parts.
    const dish = parseApplianceEntries(blocks(['Steamer', ['[temp:: 95 °C] [time:: 25 min]']]), {
      appliances,
    });
    const supplier = parseApplianceEntries(
      blocks(['Steamer', ['Remove the wrap. Reheat at {temp} for about {time}.']]),
      { appliances }
    );

    const reheating = resolveReheating(dish, supplier, appliances);
    expect(reheating).toHaveLength(1);
    expect(reheating[0]?.steps).toEqual(['Remove the wrap. Reheat at 95 °C for about 25 min.']);
  });

  it("shows nothing when a supplier's wording has an unfillable token", () => {
    // Correctly not shown: there is nothing that can be filled in for it.
    expect(resolveReheating([], [entry({ steps: ['Heat for {time}.'] })], appliances)).toEqual([]);
  });
});
