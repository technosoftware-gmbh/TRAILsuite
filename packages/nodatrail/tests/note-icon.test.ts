/**
 * The icon a note names for itself.
 *
 * Two things are checked here and they fail in different ways. Telling a
 * Lucide name from an emoji decides which renderer a token goes to, and
 * getting it wrong is silent: `setIcon()` draws nothing at all for a string
 * it does not recognise, so an emoji sent the wrong way leaves an empty
 * square rather than an error. Picking the token decides what a row falls
 * back to, and getting that wrong puts `[object Object]` or a blank where the
 * type icon should have been.
 *
 * The vault-reading wrapper is not tested here. It is two lines over
 * `metadataCache`, and everything worth asserting about it is in `pickIcon`,
 * which is why the split exists.
 */
import { describe, expect, it } from 'vitest';
import { isIconName, pickIcon } from '../src/ui/kit/note-icon';

describe('isIconName', () => {
  it('accepts the shape a Lucide name has', () => {
    for (const name of ['receipt', 'building-2', 'square-kanban', 'x', 'heart-pulse']) {
      expect(isIconName(name)).toBe(true);
    }
  });

  it('rejects an emoji, which is the whole point', () => {
    // These are real values out of a vault: a receipt, a flag, cutlery, and a
    // regional-indicator pair that is two code points rather than one.
    for (const emoji of ['🧾', '🚩', '🍽️', '🇨🇭', '📑']) {
      expect(isIconName(emoji)).toBe(false);
    }
  });

  it('rejects an icon-pack token, so it renders as itself rather than as nothing', () => {
    // Notebook Navigator wrote these. They are not Lucide names, and
    // setIcon() would draw an empty slot for each. Treated as text they at
    // least show what is wrong -- but see the migration: they should not
    // survive in a vault at all.
    for (const token of ['icons:receipt', 'material-icons:business', 'emoji:🧾']) {
      expect(isIconName(token)).toBe(false);
    }
  });

  it('rejects what merely looks close', () => {
    // Capitals, spaces, underscores and a trailing space all fail, which is
    // deliberate: `Fork Knife` and `mi_business` are not names setIcon() can
    // resolve, and drawing them as text says so.
    for (const near of ['Receipt', 'fork knife', 'mi_business', '2-receipt', '', '-x']) {
      expect(isIconName(near)).toBe(false);
    }
  });
});

describe('pickIcon', () => {
  it('takes a string and trims it', () => {
    expect(pickIcon('receipt', 'wallet')).toBe('receipt');
    expect(pickIcon('  receipt  ', 'wallet')).toBe('receipt');
  });

  it('falls back on a property that is present but empty', () => {
    // A note carrying `icon:` with nothing after it is one somebody started
    // and left. It should look like a note with no icon, not like a row whose
    // icon slot has gone missing.
    expect(pickIcon('', 'wallet')).toBe('wallet');
    expect(pickIcon('   ', 'wallet')).toBe('wallet');
  });

  it('falls back on anything that is not a string', () => {
    // Obsidian hands back whatever the YAML parsed to. A number, a list and a
    // nested map are all reachable by hand-editing, and none of them is an
    // icon.
    for (const raw of [undefined, null, 7, true, ['receipt'], { name: 'receipt' }]) {
      expect(pickIcon(raw, 'wallet')).toBe('wallet');
    }
  });
});
