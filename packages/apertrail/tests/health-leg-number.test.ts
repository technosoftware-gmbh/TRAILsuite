/**
 * The check for a flight number still sitting in the booking reference.
 * See src/vault/health/leg-number-issues.ts for why it warns and never moves.
 */
import { describe, expect, it } from 'vitest';
import { legNumberWarnings, looksLikeFlightNumber } from '../src/vault/health/leg-number-issues';
import { aLeg, aTrip } from './fixtures';

describe('what reads as a flight number', () => {
  it.each(['LX1218', 'LX 1218', 'lh872', 'U2 1234', '4U 812', 'LH 1199A'])('%s does', (value) => {
    expect(looksLikeFlightNumber(value)).toBe(true);
  });

  /** A booking code is six mixed characters, and a reference can be anything somebody typed. */
  it.each(['K7Q2XF', 'OL-5521', 'RR-2609', 'LX12345', 'Swiss', ''])('%s does not', (value) => {
    expect(looksLikeFlightNumber(value)).toBe(false);
  });
});

describe('the warning', () => {
  it('names a flight whose reference is its flight number', () => {
    const trip = aTrip('Rovos', {
      transport: [
        aLeg({ mode: 'plane', origin: 'Zürich', destination: 'Pretoria', reference: 'LX288' }),
      ],
    });

    expect(legNumberWarnings(trip)).toEqual([
      { reference: 'LX288', legLabel: 'Zürich - Pretoria' },
    ]);
  });

  it('leaves alone a flight that already has its number', () => {
    const trip = aTrip('Rovos', {
      transport: [aLeg({ mode: 'plane', number: 'LX288', reference: 'LX288' })],
    });

    expect(legNumberWarnings(trip)).toEqual([]);
  });

  it('leaves alone a real booking code', () => {
    const trip = aTrip('Rovos', { transport: [aLeg({ mode: 'plane', reference: 'K7Q2XF' })] });

    expect(legNumberWarnings(trip)).toEqual([]);
  });

  /** A train number has no shape to test, so a train is not guessed at. */
  it('leaves alone anything that is not a flight', () => {
    const trip = aTrip('Rovos', { transport: [aLeg({ mode: 'train', reference: 'IC 812' })] });

    expect(legNumberWarnings(trip)).toEqual([]);
  });

  it('leaves alone a flight with flights of its own', () => {
    const trip = aTrip('Bergen', {
      transport: [
        aLeg({
          mode: 'plane',
          reference: 'LH 1199',
          segments: [
            {
              carrier: null,
              number: 'LH 1199',
              origin: 'Zürich',
              destination: 'Frankfurt',
              day: null,
              toDay: null,
              from: null,
              to: null,
            },
            {
              carrier: null,
              number: 'LH 872',
              origin: 'Frankfurt',
              destination: 'Bergen',
              day: null,
              toDay: null,
              from: null,
              to: null,
            },
          ],
        }),
      ],
    });

    expect(legNumberWarnings(trip)).toEqual([]);
  });
});
