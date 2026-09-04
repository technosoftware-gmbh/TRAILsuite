/**
 * The pure helper behind the settings list editors.
 *
 * Reordering is worth a test rather than a glance because the order of both
 * lists it serves is load-bearing: the badge list is the meal header's
 * layout, and a reheat appliance's order is the order a meal offers them. An off-by-one
 * in `moved()` would silently retune every mode in the vault.
 */
import { describe, expect, it } from 'vitest';
import { moved } from '../src/ui/reorder';

describe('moved', () => {
  it('moves an entry up and down', () => {
    expect(moved(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the original alone', () => {
    const items = ['a', 'b'];
    moved(items, 0, 1);
    expect(items).toEqual(['a', 'b']);
  });

  it('refuses a move that would fall off either end', () => {
    // The buttons are disabled at the ends, but a list that reordered itself
    // into a hole would be a worse bug than a button that does nothing.
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moved(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
    expect(moved(['a', 'b'], 0, 0)).toEqual(['a', 'b']);
  });
});
