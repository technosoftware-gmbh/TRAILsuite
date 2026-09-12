/**
 * The body reader, against the shapes the vault actually contains.
 *
 * Every fixture here is the real format: a `# Ingredients` that is empty because
 * the recipe was delivered rather than cooked, a `- **Sodium:**` with no figure,
 * a `2 rote Peperoni` where the word after the number is not a unit, and a
 * section heading that repeats because a writer appended where it meant to
 * replace.
 */
import { describe, expect, it } from 'vitest';
import {
  bulletItems,
  labelledValues,
  linesUnder,
  listItems,
  numberedItems,
  groupsUnder,
  linesUnderTree,
  sectionsNamed,
  splitSections,
} from '../../src/markdown';

const BODY = `
Wambatu-Curry im Sri-Lanka-Stil mit Kichererbsen und Auberginen

# Ingredients

## Stroganoff
- 125 g Rindsfilet
- wenig Schlagrahm und Butter

# Instructions

1. Fleisch anbraten.
2. Ablöschen.

# Nutritional Information (Per 100g)

- **Calories:** 158 kcal
- **Sodium:**
`;

describe('splitSections', () => {
  const body = splitSections(BODY);

  it('keeps the opening paragraph out of the sections', () => {
    expect(body.intro).toBe('Wambatu-Curry im Sri-Lanka-Stil mit Kichererbsen und Auberginen');
  });

  it('lists sections in document order with their levels', () => {
    expect(body.sections.map((s) => `${s.level}:${s.heading}`)).toEqual([
      '1:Ingredients',
      '2:Stroganoff',
      '1:Instructions',
      '1:Nutritional Information (Per 100g)',
    ]);
  });

  it('reads an empty section as present but empty, which is 112 of 126 recipes', () => {
    const empty = splitSections('# Ingredients\n\n# Instructions\n');
    expect(empty.sections.map((s) => s.heading)).toEqual(['Ingredients', 'Instructions']);
    expect(bulletItems(linesUnder(empty, 'Ingredients'))).toEqual([]);
  });

  it('keeps a repeated heading as repeated sections rather than merging them', () => {
    // Two recipes in the vault carry their ingredient sections four times over.
    // Merging would hide that; showing it back is how it gets noticed.
    const doubled = splitSections('## A\n- one\n\n## A\n- one\n');
    expect(sectionsNamed(doubled, 'A')).toHaveLength(2);
    expect(bulletItems(linesUnder(doubled, 'A'))).toEqual(['one', 'one']);
  });

  it('matches a heading without regard to case or space', () => {
    expect(sectionsNamed(body, '  ingredients ')).toHaveLength(1);
  });

  it('handles a body with no headings at all', () => {
    const plain = splitSections('Just a paragraph.');
    expect(plain.intro).toBe('Just a paragraph.');
    expect(plain.sections).toEqual([]);
  });
});

describe('list shapes', () => {
  const body = splitSections(BODY);

  it('reads bullets and numbered steps', () => {
    expect(bulletItems(linesUnder(body, 'Stroganoff'))).toEqual([
      '125 g Rindsfilet',
      'wenig Schlagrahm und Butter',
    ]);
    expect(numberedItems(linesUnder(body, 'Instructions'))).toEqual([
      'Fleisch anbraten.',
      'Ablöschen.',
    ]);
  });

  it('reads either shape when an author mixed them', () => {
    expect(listItems(['- one', '2. two', '', 'prose'])).toEqual(['one', 'two']);
  });

  it('reads a labelled row, and keeps one with no figure', () => {
    // `- **Sodium:**` with nothing after it means the figure is unknown.
    // Dropping the row would say the nutrient does not exist.
    expect(labelledValues(linesUnder(body, 'Nutritional Information (Per 100g)'))).toEqual([
      { label: 'Calories', value: '158 kcal' },
      { label: 'Sodium', value: '' },
    ]);
  });
});

describe('groupsUnder', () => {
  const grouped = splitSections(
    '# Ingredients\n\n## Stroganoff\n- 125 g Rindsfilet\n\n## Spaetzli\n- 75 g Mehl\n\n# Instructions\n1. Go.\n'
  );

  it('finds bullets that sit under a subsection, not under the parent', () => {
    // The parent holds nothing itself here. Reading only its own lines returns
    // nothing, which made 14 recipes look like 9.
    expect(linesUnder(grouped, 'Ingredients').filter((l) => l.trim())).toEqual([]);
    expect(bulletItems(linesUnderTree(grouped, 'Ingredients'))).toEqual([
      '125 g Rindsfilet',
      '75 g Mehl',
    ]);
  });

  it('keeps the grouping, which is what a view renders', () => {
    expect(groupsUnder(grouped, 'Ingredients').map((g) => g.heading)).toEqual([
      null,
      'Stroganoff',
      'Spaetzli',
    ]);
  });

  it('stops at the next heading of the same level', () => {
    // A following `# Instructions` must not be swept into the ingredients.
    expect(bulletItems(linesUnderTree(grouped, 'Ingredients'))).not.toContain('Go.');
    expect(linesUnderTree(grouped, 'Ingredients').join('\n')).not.toContain('Go.');
  });

  it('handles a section with no subsections at all', () => {
    const flat = splitSections('# Ingredients\n- 1 g Salz\n');
    const groups = groupsUnder(flat, 'Ingredients');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.heading).toBeNull();
    // Blank lines are kept, including the one a trailing newline leaves, because
    // a caller rebuilding a note from these needs them back.
    expect(bulletItems(groups[0]?.lines ?? [])).toEqual(['1 g Salz']);
  });
});
