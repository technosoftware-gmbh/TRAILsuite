/**
 * What the meal picker offers first.
 *
 * The rule worth pinning down is the one that is easy to "improve" into a bug:
 * the last delivery sorts to the top, it does not filter the list. A freezer
 * holds more than the last box, and a picker that only offered what arrived on
 * Tuesday could not plan the meal that arrived a fortnight ago.
 */
import { describe, expect, it } from 'vitest';
import { deliveredFirst } from '../src/planning/view-model/picker-order';

const choices = [
  { label: 'Lasagne' },
  { label: 'Pizza' },
  { label: 'Risotto' },
  { label: 'Tantanmen Ramen Suppe' },
];

const labels = (result: readonly { label: string }[]) => result.map((choice) => choice.label);

describe('deliveredFirst', () => {
  it('puts the last delivery at the top', () => {
    const result = deliveredFirst(choices, new Set(['pizza', 'tantanmen ramen suppe']));
    expect(labels(result)).toEqual(['Pizza', 'Tantanmen Ramen Suppe', 'Lasagne', 'Risotto']);
  });

  it('keeps the rest, because the freezer holds more than the last box', () => {
    const result = deliveredFirst(choices, new Set(['pizza']));
    expect(result).toHaveLength(choices.length);
  });

  it('keeps the library order inside each half', () => {
    // A comparator would have been free to reorder the undelivered meals, and
    // nothing on screen would have explained why the list moved.
    const result = deliveredFirst(choices, new Set(['risotto', 'lasagne']));
    expect(labels(result)).toEqual(['Lasagne', 'Risotto', 'Pizza', 'Tantanmen Ramen Suppe']);
  });

  it('flags each choice, so a row can say which ones just arrived', () => {
    const result = deliveredFirst(choices, new Set(['pizza']));
    expect(result[0]).toEqual({ label: 'Pizza', delivered: true });
    expect(result.filter((choice) => choice.delivered)).toHaveLength(1);
  });

  it('matches on the title regardless of case or stray spacing', () => {
    // The set comes from wikilinks somebody typed, and the library titles come
    // from filenames. Neither side is under this code's control.
    const result = deliveredFirst([{ label: '  Pizza ' }], new Set(['pizza']));
    expect(result[0].delivered).toBe(true);
  });

  it('changes nothing when nothing has been delivered', () => {
    const result = deliveredFirst(choices, new Set());
    expect(labels(result)).toEqual(labels(choices));
    expect(result.every((choice) => !choice.delivered)).toBe(true);
  });

  it('carries the rest of the choice through untouched', () => {
    const picked = { kind: 'meal' as const, path: 'Pizza.md' };
    const result = deliveredFirst([{ label: 'Pizza', picked }], new Set(['pizza']));
    expect(result[0].picked).toBe(picked);
  });
});
