/**
 * The two reverse lookups behind the related-trips block -- which trips
 * stopped at a given note, and which trips a given person came along on.
 * See trips/related-trips.ts.
 */
import { describe, expect, it } from 'vitest';
import { relatedTrips, tripsOnVehicle, tripsWithPerson } from '../src/trips/related-trips';
import { TravelBoard, TravelTrip, TravelTripStop } from '../src/vault/types';
import { aBoard, aLeg, aStop, aTrip } from './fixtures';

function stop(
  placeTitle: string | null,
  from: string | null = null,
  note?: string
): TravelTripStop {
  return aStop({ placeTitle, from, note: note ?? null });
}

const trip = aTrip;

function board(trips: TravelTrip[]): TravelBoard {
  return aBoard({ trips });
}

describe('relatedTrips', () => {
  it('finds every trip that stopped at the given title', () => {
    const b = board([
      trip('A', { departure: '2026-02-13', stops: [stop('Falknis', '2026-02-13T12:00')] }),
      trip('B', { departure: '2026-03-01', stops: [stop('Gifthüttli')] }),
      trip('C', { departure: '2026-04-01', stops: [stop('Falknis', '2026-04-01T19:00')] }),
    ]);
    expect(relatedTrips(b, 'Falknis').map((v) => v.trip.title)).toEqual(['C', 'A']);
  });

  it('orders most recent first, regardless of status', () => {
    const b = board([
      trip('Past', { effectiveStatus: 'Over', departure: '2025-01-01', stops: [stop('X')] }),
      trip('Upcoming', { effectiveStatus: 'Booked', departure: '2027-01-01', stops: [stop('X')] }),
    ]);
    // A place note answers "when was I last here" and "when am I next
    // here" from one list -- splitting by status would hide the answer to
    // whichever question you weren't asking.
    expect(relatedTrips(b, 'X').map((v) => v.trip.title)).toEqual(['Upcoming', 'Past']);
  });

  it('sorts undated trips last', () => {
    const b = board([
      trip('Undated', { stops: [stop('X')] }),
      trip('Dated', { departure: '2020-01-01', stops: [stop('X')] }),
    ]);
    expect(relatedTrips(b, 'X').map((v) => v.trip.title)).toEqual(['Dated', 'Undated']);
  });

  it('keeps both stops when one trip visits the same place twice', () => {
    const b = board([
      trip('Two visits', {
        departure: '2026-02-13',
        stops: [
          stop('Cafe', '2026-02-13T09:00', 'coffee'),
          stop('Museum', '2026-02-13T10:00'),
          stop('Cafe', '2026-02-13T16:00', 'cake'),
        ],
      }),
    ]);
    const visits = relatedTrips(b, 'Cafe');
    expect(visits).toHaveLength(1);
    expect(visits[0].stops.map((s) => s.note)).toEqual(['coffee', 'cake']);
  });

  it('returns nothing for a place no trip mentions', () => {
    expect(relatedTrips(board([trip('A', { stops: [stop('X')] })]), 'Y')).toEqual([]);
  });

  it('ignores stops whose place link never resolved', () => {
    expect(relatedTrips(board([trip('A', { stops: [stop(null)] })]), 'X')).toEqual([]);
  });
});

describe('tripsWithPerson', () => {
  it('finds every trip naming the person, most recent first', () => {
    const b = board([
      trip('A', { departure: '2026-02-13', personTitles: ['Gaby', 'Stefan'] }),
      trip('B', { departure: '2026-03-01', personTitles: ['Erika'] }),
      trip('C', { departure: '2026-04-01', personTitles: ['Gaby'] }),
    ]);
    expect(tripsWithPerson(b, 'Gaby').map((v) => v.trip.title)).toEqual(['C', 'A']);
  });

  /**
   * Being on a trip is a fact about the whole trip, not about any one stop
   * on it. The block draws a row per trip and nothing per stop for these,
   * which is what the empty list encodes.
   */
  it('matches a trip that has no stops at all', () => {
    const b = board([trip('Weekend', { departure: '2026-05-01', personTitles: ['Marc'] })]);
    const visits = tripsWithPerson(b, 'Marc');
    expect(visits).toHaveLength(1);
    expect(visits[0].stops).toEqual([]);
  });

  it('never attaches stops, even when the trip has some', () => {
    const b = board([
      trip('Basel', { departure: '2026-02-13', personTitles: ['Marc'], stops: [stop('Cafe')] }),
    ]);
    expect(tripsWithPerson(b, 'Marc')[0].stops).toEqual([]);
  });

  it('orders upcoming alongside past, and undated last, same as the place lookup', () => {
    const b = board([
      trip('Undated', { personTitles: ['Marc'] }),
      trip('Past', { effectiveStatus: 'Over', departure: '2025-01-01', personTitles: ['Marc'] }),
      trip('Upcoming', {
        effectiveStatus: 'Booked',
        departure: '2027-01-01',
        personTitles: ['Marc'],
      }),
    ]);
    expect(tripsWithPerson(b, 'Marc').map((v) => v.trip.title)).toEqual([
      'Upcoming',
      'Past',
      'Undated',
    ]);
  });

  it('returns nothing for a person no trip names', () => {
    expect(tripsWithPerson(board([trip('A', { personTitles: ['Gaby'] })]), 'Marc')).toEqual([]);
  });

  /**
   * A participant title is matched exactly as the trip carries it. The
   * trip editor keeps whatever was typed, so a name with no Person note
   * behind it still matches its own note if one is ever created under that
   * exact title -- and never matches a different one.
   */
  it('matches on the exact title, not a partial one', () => {
    const b = board([trip('A', { personTitles: ['Marcus'] })]);
    expect(tripsWithPerson(b, 'Marc')).toEqual([]);
  });
});

/**
 * The other side of a leg's vehicle link: which trips sailed on this ship.
 *
 * Matched on the raw title for the reason a person is: a ship somebody typed
 * the name of, with no note behind it, is still the ship they sailed on.
 */
describe('trips on a vehicle', () => {
  const nordkap = aTrip('Nordkap', {
    departure: '2026-12-20',
    transport: [aLeg({ vehicleTitle: 'MS Trollfjord' })],
  });
  const jura = aTrip('Jura', {
    departure: '2026-06-14',
    transport: [aLeg({ carrier: 'SBB' })],
  });

  it('finds the trip with a leg on it', () => {
    const board = aBoard({ trips: [nordkap, jura] });

    expect(tripsOnVehicle(board, 'MS Trollfjord').map((visit) => visit.trip.title)).toEqual([
      'Nordkap',
    ]);
  });

  /** Being aboard is a fact about the leg, and a leg is not a stop. */
  it('names no stops', () => {
    const board = aBoard({ trips: [nordkap] });

    expect(tripsOnVehicle(board, 'MS Trollfjord')[0]?.stops).toEqual([]);
  });

  it('finds nothing for a ship no trip names', () => {
    expect(tripsOnVehicle(aBoard({ trips: [nordkap, jura] }), 'MS Nordlys')).toEqual([]);
  });
});

/**
 * Which buttons each subject's block carries.
 *
 * The block's own drawing is App-bound DOM and stays untested, the boundary
 * this package draws everywhere. What is testable, and what was actually
 * wrong, is the decision behind it: the cabins dialog existed for two entity
 * types as a palette command with no button anywhere, and no test could have
 * said so while the answer lived inside the render.
 */
describe('the buttons a related-trips block offers', () => {
  /**
   * A ship had a button of its own for its cabins, because the dialog was
   * named after them. That dialog was the vehicle's editor all along -- the
   * facts and the catalogue in one form, on purpose -- so a ship now has one
   * Edit button like every other note, and the row is the same three entries
   * everywhere.
   */
  it('gives every subject with an editor the same two buttons', async () => {
    const { subjectActions } = await import('../src/trips/related-trips-actions');

    for (const kind of ['place', 'city', 'state', 'country', 'excursion', 'vehicle'] as const) {
      expect(subjectActions(kind), kind).toEqual(['edit', 'prospect']);
    }
  });

  /**
   * The order is the rule, not the contents: a card's 3-dot menu reads Edit,
   * then Cover, then whatever is specific to the type, and a note shown on
   * two surfaces must not put its actions in two orders.
   */
  it('puts the editor first wherever there is one', async () => {
    const { KINDS_WITH_EDITOR, subjectActions } =
      await import('../src/trips/related-trips-actions');

    for (const kind of KINDS_WITH_EDITOR) {
      expect(subjectActions(kind)[0], kind).toBe('edit');
    }
  });

  it('offers an editor to nothing that has none', async () => {
    const { KINDS_WITH_EDITOR, subjectActions } =
      await import('../src/trips/related-trips-actions');

    for (const kind of ['person'] as const) {
      if (KINDS_WITH_EDITOR.includes(kind)) continue;
      expect(subjectActions(kind), kind).not.toContain('edit');
    }
  });

  /**
   * The drift guard. A place's editor is reachable from its card and from
   * this block, and the first version of the card's menu labelled it with the
   * trip's string, so a landmark offered "Edit trip". One key, both surfaces.
   */
  it('calls editing a note what the card calls it', async () => {
    const { BLOCK_ACTION_LABELS } = await import('../src/trips/related-trips-actions');
    const { CARD_ACTION_LABELS } = await import('../src/ui/gallery/card-actions');

    expect(BLOCK_ACTION_LABELS.edit).toBe(CARD_ACTION_LABELS.edit);
  });

  it('offers a person nothing', async () => {
    const { subjectActions } = await import('../src/trips/related-trips-actions');

    // Not an oversight: a page about somebody, printed from their address and
    // their tags, is not a thing this plugin should make, and they have no
    // cover to edit either.
    expect(subjectActions('person')).toEqual([]);
  });

  it('has a label for every action it can offer', async () => {
    const { BLOCK_ACTION_LABELS, subjectActions } =
      await import('../src/trips/related-trips-actions');
    const { enTranslations } = await import('../src/lang/translations/en');

    const offered = new Set(
      (['vehicle', 'place', 'city', 'state', 'country', 'excursion', 'person'] as const).flatMap(
        (kind) => subjectActions(kind)
      )
    );
    for (const action of offered) {
      const key = BLOCK_ACTION_LABELS[action];
      // Resolved against the catalogue rather than through t(): a missing key
      // renders as the key itself, which is a button that looks like a bug
      // rather than a test that fails.
      const value = key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          enTranslations
        );
      expect(typeof value, key).toBe('string');
    }
  });
});
