/**
 * The one multiplication that turns a figure on an itinerary line into what
 * the trip will actually pay.
 *
 * The rules worth pinning down are the ones a wrong answer would quietly
 * cost real money: a fare is per passenger and a room is not, silence means
 * `total` so a hand-typed number never inflates itself, and a party of
 * nobody is a party of one rather than a free holiday.
 */
import { describe, expect, it } from 'vitest';
import {
  COST_UNITS,
  costUnitsFor,
  lineCost,
  lineTravellers,
  nightsBetween,
  nightsBetweenDays,
  parseCostUnit,
} from '../src/trips/costs/line-cost';

const TWO = ['Stefan', 'Erika'];

describe('parseCostUnit', () => {
  it('reads each of the four values back', () => {
    for (const unit of COST_UNITS) expect(parseCostUnit(unit)).toBe(unit);
  });

  /**
   * The safe direction to be wrong in. A note that says nothing was typed
   * by hand, and multiplying somebody's 890 into 1780 because the plugin
   * assumed a fare is the one failure that would be silent AND expensive.
   */
  it('reads silence and nonsense as a total, never as a multiplier', () => {
    expect(parseCostUnit(null)).toBe('total');
    expect(parseCostUnit(undefined)).toBe('total');
    expect(parseCostUnit('')).toBe('total');
    expect(parseCostUnit('per head')).toBe('total');
  });
});

describe('costUnitsFor', () => {
  it('opens a stay on per night and a journey on per person', () => {
    expect(costUnitsFor('night')[0]).toBe('night');
    expect(costUnitsFor('leg')[0]).toBe('person');
    expect(costUnitsFor('stop')[0]).toBe('person');
  });

  it('offers a stay the per-night units a journey has no use for', () => {
    expect(costUnitsFor('night')).toContain('personNight');
    expect(costUnitsFor('leg')).not.toContain('night');
  });
});

describe('nightsBetween', () => {
  it('counts the nights of a stay, not the days it touches', () => {
    expect(nightsBetween('2026-04-26', '2026-04-29')).toBe(3);
  });

  it('is null rather than 1 when the stay does not say, so a caller can admit it', () => {
    expect(nightsBetween(null, '2026-04-29')).toBeNull();
    expect(nightsBetween('2026-04-26', null)).toBeNull();
    expect(nightsBetween('not a date', '2026-04-29')).toBeNull();
  });

  // A checkout on the day of arrival is a day room, not a negative stay.
  it('is null for a stay that ends where it began', () => {
    expect(nightsBetween('2026-04-26', '2026-04-26')).toBeNull();
  });

  it('reads a datetime by its date half, the way a stay is written', () => {
    expect(nightsBetween('2026-04-26T15:00', '2026-04-27T10:00')).toBe(1);
  });
});

describe('lineTravellers', () => {
  it('takes the people the line names', () => {
    expect(lineTravellers(['Stefan'], TWO)).toEqual(['Stefan']);
  });

  // Naming nobody is how a line says "everybody", which is why it is never
  // written into a note.
  it('falls back to everybody on the trip', () => {
    expect(lineTravellers([], TWO)).toEqual(TWO);
  });
});

describe('lineCost', () => {
  const base = { cost: 890, persons: [], participants: TWO };

  it('leaves a total alone', () => {
    expect(lineCost({ ...base, unit: 'total' }).amount).toBe(890);
  });

  it('charges a fare once per passenger', () => {
    const figure = lineCost({ ...base, unit: 'person' });
    expect(figure.amount).toBe(1780);
    expect(figure.multiplier).toBe(2);
    // Kept so the row can show the sum rather than only its answer.
    expect(figure.unitAmount).toBe(890);
  });

  it('charges a room once per night however many are in it', () => {
    const figure = lineCost({
      cost: 240,
      unit: 'night',
      persons: [],
      participants: TWO,
      checkIn: '2026-04-26',
      checkOut: '2026-04-29',
    });
    expect(figure.amount).toBe(720);
    expect(figure.people).toBe(2);
  });

  it('charges a bed per person per night', () => {
    const figure = lineCost({
      cost: 60,
      unit: 'personNight',
      persons: [],
      participants: TWO,
      checkIn: '2026-04-26',
      checkOut: '2026-04-28',
    });
    expect(figure.amount).toBe(240);
    expect(figure.multiplier).toBe(4);
  });

  /**
   * A per-night figure on a stay with no dates counts once, and says so
   * through a null `nights` -- the row prints that rather than passing off
   * a one-night guess as the answer.
   */
  it('counts a per-night stay once when it has no dates, and admits it', () => {
    const figure = lineCost({ cost: 240, unit: 'night', persons: [], participants: TWO });
    expect(figure.amount).toBe(240);
    expect(figure.nights).toBeNull();
  });

  it('charges only the people the line names', () => {
    expect(lineCost({ ...base, unit: 'person', persons: ['Stefan'] }).amount).toBe(890);
  });

  /**
   * A trip that lists no participants is a trip somebody took alone.
   * Multiplying its flights by zero would report a free holiday.
   */
  it('treats a trip with nobody listed as a party of one', () => {
    expect(lineCost({ cost: 890, unit: 'person', persons: [], participants: [] }).amount).toBe(890);
  });

  it('has no amount at all for a line nobody has priced, which is not zero', () => {
    expect(
      lineCost({ cost: null, unit: 'person', persons: [], participants: TWO }).amount
    ).toBeNull();
  });

  it('keeps a priced-at-zero line at zero rather than losing it', () => {
    expect(lineCost({ cost: 0, unit: 'person', persons: [], participants: TWO }).amount).toBe(0);
  });

  // Money is rounded to the cent at every step, the rule shared/money.ts
  // exists to enforce.
  it('rounds to the cent', () => {
    expect(lineCost({ cost: 12.335, unit: 'person', persons: [], participants: TWO }).amount).toBe(
      24.67
    );
  });
});

/**
 * A stay priced per night, on a trip that has no dates yet.
 *
 * The whole point of the relative day: a twelve-day brochure can already say
 * a three-night stay costs 240 a night. A night count is a difference, and a
 * difference does not need to know when the counting started -- so this works
 * with no departure anywhere in sight, which is the state the trip is in for
 * as long as it is being designed.
 */
describe('a stay that says which days it covers', () => {
  it('counts its nights from the two day numbers', () => {
    expect(nightsBetweenDays(3, 5)).toBe(2);
  });

  it('counts nothing for a stay that arrives and leaves the same day', () => {
    expect(nightsBetweenDays(3, 3)).toBeNull();
  });

  it('counts nothing rather than a negative for days the wrong way round', () => {
    expect(nightsBetweenDays(5, 3)).toBeNull();
  });

  it('counts nothing when the stay names only one end', () => {
    expect(nightsBetweenDays(3, null)).toBeNull();
    expect(nightsBetweenDays(undefined, 5)).toBeNull();
  });

  it('multiplies a per-night figure by them', () => {
    const cost = lineCost({
      cost: 240,
      unit: 'night',
      persons: [],
      participants: ['Stefan', 'Erika'],
      checkInDay: 3,
      checkOutDay: 5,
    });

    expect(cost.amount).toBe(480);
    expect(cost.nights).toBe(2);
  });

  /**
   * A relative stay may still carry the dates it had before it was made
   * relative. The day numbers are what the note now means, so they win --
   * otherwise the figure on screen would come from the half nobody edits.
   */
  it('prefers the day numbers over dates left behind by an earlier edit', () => {
    const cost = lineCost({
      cost: 100,
      unit: 'night',
      persons: [],
      participants: ['Stefan'],
      checkIn: '2026-04-26',
      checkOut: '2026-05-06',
      checkInDay: 1,
      checkOutDay: 3,
    });

    expect(cost.nights).toBe(2);
    expect(cost.amount).toBe(200);
  });

  it('still counts a dated stay from its dates', () => {
    expect(
      lineCost({
        cost: 100,
        unit: 'night',
        persons: [],
        participants: ['Stefan'],
        checkIn: '2026-04-26',
        checkOut: '2026-04-28',
      }).nights
    ).toBe(2);
  });
});
