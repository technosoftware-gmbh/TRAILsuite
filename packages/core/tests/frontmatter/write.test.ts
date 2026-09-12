/**
 * Setting one property, and leaving the note alone.
 *
 * Almost every case here is about what a write does **not** touch. A host with
 * only a file has to edit frontmatter by hand, and the tempting shortcut is to
 * parse the block and re-emit it, which reorders keys somebody arranged, drops
 * their comments and requotes their strings. So the assertions are mostly the
 * other lines coming back byte for byte.
 */
import { describe, expect, it } from 'vitest';
import {
  setFrontmatterBlock,
  setFrontmatterValue,
  setFrontmatterValues,
  splitFrontmatterBlock,
} from '../../src/frontmatter';

const NOTE = [
  '---',
  'type: recipe',
  'image: Cooking/Recipes/_resources/Penne.jpg',
  'servings: 1',
  'diet: Vegetarisch',
  'tags:',
  '  - dinner',
  '  - quick',
  'created: 2026-08-02T08:34',
  '---',
  '',
].join('\n');

const header = (text = NOTE) => splitFrontmatterBlock(text).header;

function lines(block: string): string[] {
  return block.split('\n');
}

describe('changing a value', () => {
  it('replaces one line and nothing else', () => {
    const next = setFrontmatterValue(header(), 'servings', 4);

    expect(lines(next)).toContain('servings: 4');
    expect(lines(next)).toContain('type: recipe');
    expect(lines(next)).toContain('image: Cooking/Recipes/_resources/Penne.jpg');
    expect(lines(next)).toContain('created: 2026-08-02T08:34');
    // The block is the same length, so nothing was added or lost.
    expect(lines(next)).toHaveLength(lines(header()).length);
  });

  it('keeps the order somebody arranged', () => {
    const next = setFrontmatterValue(header(), 'type', 'recipe');
    expect(lines(next)[1]).toBe('type: recipe');
  });

  it('replaces a block list whole', () => {
    const next = setFrontmatterValue(header(), 'tags', ['lunch']);

    expect(next).toContain('tags:\n  - lunch\n');
    expect(next).not.toContain('quick');
    expect(next).toContain('created: 2026-08-02T08:34');
  });

  it('writes an empty list as a key with nothing under it', () => {
    // Which is what these notes carry for a property that exists and says
    // nothing. `[]` would be a different thing to read back.
    expect(setFrontmatterValue(header(), 'tags', [])).toContain('tags:\ncreated:');
  });
});

describe('adding a value', () => {
  it('appends rather than pushing in at the top', () => {
    // A new property belongs after the ones somebody arranged, not in front.
    const next = setFrontmatterValue(header(), 'supplier', '[[TomTasty AG]]');
    const rows = lines(next).filter((row) => row.trim() && row !== '---');

    expect(rows[rows.length - 1]).toBe('supplier: "[[TomTasty AG]]"');
  });

  it('builds a block for a note that has none', () => {
    expect(setFrontmatterValue('', 'type', 'recipe')).toBe('---\ntype: recipe\n---\n');
  });

  it('leaves a note with no block alone when asked to remove something', () => {
    // There is nothing to remove it from, and inventing an empty block to say
    // so would be worse than doing nothing.
    expect(setFrontmatterValue('', 'type', undefined)).toBe('');
  });
});

describe('an empty value is not a missing one', () => {
  it('writes a key with nothing after it', () => {
    // `prep:` is what these notes' template writes for a field nobody has
    // filled in. Deleting it on save would reshape a hundred notes quietly.
    expect(setFrontmatterValue(header(), 'servings', null)).toContain('servings:\n');
    expect(setFrontmatterValue(header(), 'servings', null)).not.toContain('servings: ');
  });

  it('keeps an empty property through a save that changes nothing', () => {
    const withEmpty = ['---', 'type: recipe', 'prep:', 'cook:', '---', ''].join('\n');
    expect(setFrontmatterValues(withEmpty, { prep: null, cook: null })).toBe(withEmpty);
  });
});

describe('removing a value', () => {
  it('takes the line out', () => {
    const next = setFrontmatterValue(header(), 'diet', undefined);

    expect(next).not.toContain('diet');
    expect(next).toContain('servings: 1');
    expect(lines(next)).toHaveLength(lines(header()).length - 1);
  });

  it('takes a whole block list out', () => {
    const next = setFrontmatterValue(header(), 'tags', undefined);

    expect(next).not.toContain('tags');
    expect(next).not.toContain('dinner');
    expect(next).toContain('created: 2026-08-02T08:34');
  });

  it('says nothing about a key that was never there', () => {
    expect(setFrontmatterValue(header(), 'nonesuch', undefined)).toBe(header());
  });
});

describe('quoting', () => {
  it('quotes a wikilink, which is how these notes carry a link', () => {
    expect(setFrontmatterValue(header(), 'supplier', '[[TomTasty AG]]')).toContain(
      'supplier: "[[TomTasty AG]]"'
    );
  });

  it('leaves an ordinary word alone rather than requoting the vault', () => {
    expect(setFrontmatterValue(header(), 'diet', 'Vegan')).toContain('diet: Vegan');
  });

  it('quotes what would read back as something else', () => {
    const quoted = (value: string) =>
      setFrontmatterValue(header(), 'note', value)
        .split('\n')
        .find((row) => row.startsWith('note:'));

    expect(quoted('true')).toBe('note: "true"');
    expect(quoted('12')).toBe('note: "12"');
    expect(quoted('a: b')).toBe('note: "a: b"');
    expect(quoted('# hash')).toBe('note: "# hash"');
    expect(quoted('')).toBe('note: ""');
  });

  it('escapes a quote rather than producing a broken line', () => {
    expect(setFrontmatterValue(header(), 'note', 'say "hello"')).toContain(
      'note: "say \\"hello\\""'
    );
  });

  it('writes a number and a boolean as themselves', () => {
    expect(setFrontmatterValue(header(), 'servings', 4)).toContain('servings: 4');
    expect(setFrontmatterValue(header(), 'favorite', true)).toContain('favorite: true');
  });
});

describe('several at once', () => {
  it('applies them in order and leaves the rest', () => {
    const next = setFrontmatterValues(header(), {
      servings: 2,
      diet: undefined,
      supplier: '[[TomTasty AG]]',
    });

    expect(next).toContain('servings: 2');
    expect(next).not.toContain('diet');
    expect(next).toContain('supplier: "[[TomTasty AG]]"');
    expect(next).toContain('type: recipe');
  });

  it('round-trips: writing what is already there changes nothing', () => {
    // The property that matters most for a save that runs twice.
    expect(setFrontmatterValues(header(), { servings: 1, diet: 'Vegetarisch' })).toBe(header());
  });
});

describe('what it refuses to do', () => {
  it('leaves a malformed block alone', () => {
    expect(setFrontmatterValue('---\ntype: recipe\n', 'servings', 1)).toBe('---\ntype: recipe\n');
  });

  it('ignores a blank key', () => {
    expect(setFrontmatterValue(header(), '   ', 'x')).toBe(header());
  });

  it('does not confuse an indented key with a top-level one', () => {
    const nested = ['---', 'a:', '  servings: 9', 'servings: 1', '---', ''].join('\n');
    const next = setFrontmatterValue(nested, 'servings', 4);

    expect(next).toContain('  servings: 9');
    expect(next).toContain('servings: 4');
  });
});

/**
 * The escape hatch, and what it is an escape from.
 *
 * An order's `selections:` is a list of maps each holding a list of maps, and a
 * general writer for that is the serializer this file exists not to be. So the
 * caller writes the lines and this places them – which means everything worth
 * asserting is about placement, not about YAML.
 */
describe('a property whose value is lines', () => {
  const NESTED = [
    '  - person: "[[Stefan Muster]]"',
    '    items:',
    '      - recipe: "[[Penne alla Norma]]"',
    '        price: 19',
  ];

  const ORDER = [
    '---',
    'type: order',
    'selections:',
    '  - person: "[[Erika Muster]]"',
    '    recipes:',
    '      - "[[Lasagne]]"',
    'created: 2026-08-02T08:34',
    '---',
    '',
  ].join('\n');

  it('replaces the whole span the old value occupied', () => {
    const next = setFrontmatterBlock(ORDER, 'selections', NESTED);

    expect(next).toContain('      - recipe: "[[Penne alla Norma]]"');
    expect(next).not.toContain('Erika');
    expect(next).not.toContain('Lasagne');
  });

  it('leaves what came after it exactly where it was', () => {
    // The failure this was written against: a nested value's span running on
    // and swallowing the next property.
    const next = setFrontmatterBlock(ORDER, 'selections', NESTED);

    expect(next.split('\n')).toContain('created: 2026-08-02T08:34');
    expect(next.split('\n')).toContain('type: order');
  });

  it('writes the lines as given, indentation and all', () => {
    // Nothing here knows what they mean, so nothing here reformats them.
    expect(setFrontmatterBlock(ORDER, 'selections', NESTED)).toContain(NESTED.join('\n'));
  });

  it('appends a property the note does not have', () => {
    const next = setFrontmatterBlock('---\ntype: order\n---\n', 'selections', NESTED);
    expect(next).toBe(`---\ntype: order\nselections:\n${NESTED.join('\n')}\n---\n`);
  });

  it('removes the property when there are no lines', () => {
    // An empty list of selections is not an order, and a caller that has none
    // is asking for the key to go rather than for an empty one.
    expect(setFrontmatterBlock(ORDER, 'selections', [])).not.toContain('selections');
  });

  it('round-trips: writing back what is there changes nothing', () => {
    const lines = ['  - person: "[[Erika Muster]]"', '    recipes:', '      - "[[Lasagne]]"'];
    expect(setFrontmatterBlock(ORDER, 'selections', lines)).toBe(ORDER);
  });

  it('builds a block for a note that has none, and refuses a malformed one', () => {
    expect(setFrontmatterBlock('', 'selections', NESTED)).toBe(
      `---\nselections:\n${NESTED.join('\n')}\n---\n`
    );
    expect(setFrontmatterBlock('---\ntype: order\n', 'selections', NESTED)).toBe(
      '---\ntype: order\n'
    );
    expect(setFrontmatterBlock(ORDER, '  ', NESTED)).toBe(ORDER);
  });

  it('does not mistake an indented key for the one it was asked for', () => {
    const nested = ['---', 'a:', '  selections: 9', 'selections:', '  - x', '---', ''].join('\n');
    const next = setFrontmatterBlock(nested, 'selections', ['  - y']);

    expect(next).toContain('  selections: 9');
    expect(next).toContain('selections:\n  - y');
  });
});

/**
 * A datetime survives a host that reads YAML 1.1.
 *
 * The failure this prevents is invisible from inside this package: an unquoted
 * `2026-09-01T07:00` is a timestamp to YAML 1.1, so Obsidian parses it to a
 * `Date` and writes it back without the time. A trip's departure loses its
 * hour, and nothing in the app that wrote it ever sees the loss.
 *
 * The date-only case is the other half of the rule and matters as much: those
 * are what Obsidian's own property editor produces, and quoting them would make
 * every note this writer touches look edited.
 */
describe('a datetime', () => {
  const header = '---\ntitle: Lofoten\n---\n';

  it('is quoted, so a YAML 1.1 host cannot truncate it', () => {
    for (const value of ['2026-09-01T07:00', '2026-09-01T07:00:30', '2026-09-01 07:00']) {
      expect(setFrontmatterValue(header, 'departure', value)).toContain(`departure: "${value}"`);
    }
  });

  it('is quoted inside a list too', () => {
    expect(setFrontmatterValue(header, 'times', ['2026-09-01T07:00'])).toContain(
      '  - "2026-09-01T07:00"'
    );
  });

  it('leaves a date-only value alone, which is what Obsidian itself writes', () => {
    expect(setFrontmatterValue(header, 'checkIn', '2026-09-01')).toContain('checkIn: 2026-09-01');
  });

  it('leaves a plain word alone', () => {
    expect(setFrontmatterValue(header, 'mode', 'plane')).toContain('mode: plane');
  });
});
