/**
 * A line sold at more than one price, and a line that may not happen at all.
 *
 * Both were reported as needs rather than bugs. A voyage is offered as an
 * outside cabin at one price and a superior outside cabin at another; nearly
 * every day of the same brochure offers an excursion you may or may not take.
 * The two are orthogonal and a line can be both.
 *
 * The rule that makes the first safe is that variants are never added
 * together: they are the same thing, and exactly one is bought. The rule that
 * makes the second safe is that an untaken extra stays out of the plan, so a
 * total never quietly includes a decision nobody has made.
 *
 * Every check here was confirmed by breaking the code and watching it go red.
 */
import { describe, expect, it } from 'vitest';
import {
  chosenVariant,
  countsInPlan,
  hasVariants,
  lineFigure,
} from '../src/trips/costs/line-variants';
import { aParsedLeg, aParsedNight, aParsedStop, aParsedVariant } from './fixtures';

const POLAR = aParsedVariant({ name: 'Polar outside', cost: 4479, currency: 'CHF' });
const SUPERIOR = aParsedVariant({ name: 'Arctic superior', cost: 5299, currency: 'CHF' });

describe('a line with one price', () => {
  it('is priced from its own figure', () => {
    const figure = lineFigure(aParsedLeg({ cost: 890, currency: 'CHF', costUnit: 'person' }));

    expect(figure.cost).toBe(890);
    expect(figure.variant).toBeNull();
    expect(figure.assumed).toBe(false);
  });

  it('carries no variants', () => {
    expect(hasVariants(aParsedLeg())).toBe(false);
  });
});

describe('a line with several prices', () => {
  it('is priced from the one that was chosen', () => {
    const leg = aParsedLeg({ cost: 1, variants: [POLAR, { ...SUPERIOR, chosen: true }] });

    expect(lineFigure(leg).cost).toBe(5299);
    expect(lineFigure(leg).variant?.name).toBe('Arctic superior');
    expect(lineFigure(leg).assumed).toBe(false);
  });

  /**
   * The largest figure on a trip must not fall out of its own budget for as
   * long as the trip is being decided, which is exactly when the budget is
   * read. The note's own order picks it, and the caller is told it was an
   * assumption so a row can say so.
   */
  it('counts the first one while the choice is still open, and says so', () => {
    const figure = lineFigure(aParsedLeg({ variants: [POLAR, SUPERIOR] }));

    expect(figure.cost).toBe(4479);
    expect(figure.assumed).toBe(true);
  });

  /** The line's own figure would count the same thing twice, and the variant is the more specific statement. */
  it('ignores the line its own cost', () => {
    expect(lineFigure(aParsedLeg({ cost: 99999, variants: [POLAR] })).cost).toBe(4479);
  });

  /** A note that states the currency once, on the line, means it for every price under it. */
  it('falls back to the line currency for a variant that names none', () => {
    const leg = aParsedLeg({
      currency: 'NOK',
      variants: [aParsedVariant({ name: 'Inside', cost: 3200 })],
    });

    expect(lineFigure(leg).currency).toBe('NOK');
  });

  it('reports which was chosen, and none while nobody has', () => {
    expect(chosenVariant(aParsedLeg({ variants: [POLAR, SUPERIOR] }))).toBeNull();
    expect(
      chosenVariant(aParsedLeg({ variants: [POLAR, { ...SUPERIOR, chosen: true }] }))?.name
    ).toBe('Arctic superior');
  });

  /** A choice is one. A note hand-edited into two ticks reads as the first, rather than as a total of both. */
  it('takes the first of two marked chosen', () => {
    const leg = aParsedLeg({
      variants: [
        { ...POLAR, chosen: true },
        { ...SUPERIOR, chosen: true },
      ],
    });

    expect(lineFigure(leg).cost).toBe(4479);
  });

  /** The same shape on all three, which is the whole reason it is one module rather than three. */
  it('prices a stop and a stay the same way', () => {
    const excursion = aParsedStop({ variants: [POLAR, SUPERIOR] });
    const room = aParsedNight({ variants: [{ ...SUPERIOR, chosen: true }, POLAR] });

    expect(lineFigure(excursion).cost).toBe(4479);
    expect(lineFigure(room).cost).toBe(5299);
  });
});

describe('whether a line is in the plan at all', () => {
  it('counts an ordinary line', () => {
    expect(countsInPlan(aParsedStop())).toBe(true);
  });

  it('leaves out an extra nobody has taken', () => {
    expect(countsInPlan(aParsedStop({ optional: true }))).toBe(false);
  });

  it('counts an extra once it is taken', () => {
    expect(countsInPlan(aParsedStop({ optional: true, chosen: true }))).toBe(true);
  });

  /** `chosen` says nothing on a line that was never in question, and must not be read as a second way of saying "planned". */
  it('is unmoved by chosen on a line that is not optional', () => {
    expect(countsInPlan(aParsedStop({ optional: false, chosen: true }))).toBe(true);
  });
});
