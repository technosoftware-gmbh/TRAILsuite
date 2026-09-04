/**
 * A built-in badge whose translation key was renamed after somebody saved it.
 *
 * `labelKey` is persisted into `data.json` as a string, so renaming one in the
 * translation tables strands every vault that had already saved its header.
 * `t()` answers an unknown key with the key itself, so the header renders
 * `BADGES.BUILTIN.REHEAT` where a word should be. Found in a real vault.
 *
 * The second assertion is the one that is easy to miss: `builtinKey` identifies
 * a built-in by its `labelKey`, so a stale key also makes the badge
 * unrecognisable to `withMissingBuiltins`, which would then decide the built-in
 * is absent and append a second copy of it.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

/** A saved header exactly as an older version wrote it. */
function savedWith(labelKey: string): unknown {
  const cook = DEFAULT_SETTINGS.headerBadges.find(
    (badge) => badge.labelKey === 'badges.builtin.cook'
  );
  return {
    headerBadges: DEFAULT_SETTINGS.headerBadges.map((badge) =>
      badge === cook ? { ...badge, labelKey } : badge
    ),
  };
}

describe('a saved badge naming a renamed translation key', () => {
  it('is rewritten to the key that exists', () => {
    const merged = mergeSettings(savedWith('badges.builtin.reheat'));
    const keys = merged.headerBadges.map((badge) => badge.labelKey);

    expect(keys).toContain('badges.builtin.cook');
    expect(keys).not.toContain('badges.builtin.reheat');
  });

  it('does not gain a duplicate of the badge it renamed', () => {
    const merged = mergeSettings(savedWith('badges.builtin.reheat'));
    const cooks = merged.headerBadges.filter((badge) => badge.labelKey === 'badges.builtin.cook');

    expect(cooks).toHaveLength(1);
  });

  it('leaves a key that resolves alone', () => {
    const merged = mergeSettings(savedWith('badges.builtin.cook'));
    expect(merged.headerBadges.map((badge) => badge.labelKey)).toEqual(
      DEFAULT_SETTINGS.headerBadges.map((badge) => badge.labelKey)
    );
  });

  it('leaves a badge somebody labelled themselves alone', () => {
    // A user-defined badge carries `label`, not `labelKey`, and nothing here
    // should touch it.
    const merged = mergeSettings({
      headerBadges: [{ property: 'cuisine', label: 'Küche', color: 'default', enabled: true }],
    });
    expect(merged.headerBadges[0]?.label).toBe('Küche');
  });
});
