/**
 * Editing a meal note: the parts that are the note format rather than any one
 * app's way of putting a form in front of somebody.
 *
 * The failure this file exists to catch is a save that eats something. An editor
 * knows about five spans of a note and a real meal has more than five, so most
 * of what is asserted below is what a save leaves alone.
 *
 * Written for CULItrail and moved here with the code.
 */
import { describe, expect, it } from 'vitest';
import {
  emptyPer100g,
  isUnknownSupplier,
  parseMicronutrientSection,
  parseNutritionSection,
  parsePer100g,
  per100g,
  perServing,
  removeSection,
  renderMicronutrientSection,
  renderNutritionSection,
  replaceDescription,
  replaceSection,
  sectionSource,
  round2,
  supplierOptionValues,
} from '../../src/meal';

/**
 * A meal the way an unconverted note in the vault is shaped.
 *
 * The two per-100 g headings are still here on purpose: the figures moved into
 * frontmatter and nothing writes those sections any more, but every meal
 * written before the move still carries them, and reading and then removing
 * them is exactly what this module is asked to do to such a note.
 */
const NOTE = [
  '---',
  'type: meal',
  'servings: 1',
  '---',
  '',
  'mit hausgemachter Pasta',
  '',
  '# Reheating',
  '',
  '- Steamer at 95 °C',
  '',
  '# Notes',
  '',
  '1. Take the wrap off.',
  '',
  '# Nutritional Information (Per 100g)',
  '',
  '- **Calories:** 133 kcal',
  '',
  '# Eating History',
  '',
  '- 2026-01-24 came out well',
  '',
].join('\n');

describe('replacing the description', () => {
  it('replaces the text above the first heading and nothing else', () => {
    const result = replaceDescription(NOTE, 'mit Spätzli');

    expect(result).toContain('mit Spätzli');
    expect(result).not.toContain('mit hausgemachter Pasta');
    // The frontmatter, and every section under it, is untouched.
    expect(result).toContain('type: meal');
    expect(result).toContain('- Steamer at 95 °C');
    expect(result).toContain('- 2026-01-24 came out well');
  });

  it('clears the block rather than leaving blank lines behind', () => {
    const cleared = replaceDescription(NOTE, '');
    expect(cleared).toContain('---\n\n# Reheating');
    // Twice, to prove a second save does not add another blank line.
    expect(replaceDescription(cleared, '')).toBe(cleared);
  });

  it('leaves a note that never had one exactly as it was', () => {
    // Otherwise opening and saving a library normalises whatever blank run sits
    // under the frontmatter, in every note that has no description.
    const none = ['---', 'type: meal', '---', '', '', '# Reheating', '', '- Salt', ''].join('\n');
    expect(replaceDescription(none, '')).toBe(none);
    expect(replaceDescription(none, '  ')).toBe(none);
  });

  it('adds a description to a note that has none', () => {
    const bare = '---\ntype: meal\n---\n\n# Reheating\n\n- salt\n';
    expect(replaceDescription(bare, 'A note')).toContain('A note');
  });
});

describe('reading a section back', () => {
  it('gives exactly what a save will put back', () => {
    // The editor shows this and `replaceSection` writes it. If the two disagree,
    // the first save after opening a note quietly rewrites it.
    expect(sectionSource(NOTE, 'Reheating')).toBe('- Steamer at 95 °C');
    expect(sectionSource(NOTE, 'Nutritional Information (Per 100g)')).toBe(
      '- **Calories:** 133 kcal'
    );
  });

  it('keeps a sub-heading, which a flat reader would drop', () => {
    // An Reheating section whose first line is `## From the freezer` would come
    // back empty, and saving would then delete the group heading.
    const grouped = NOTE.replace('- Steamer at 95 °C', '## From the freezer\n\n- Steamer at 95 °C');

    expect(sectionSource(grouped, 'Reheating')).toContain('## From the freezer');
    expect(sectionSource(grouped, 'Reheating')).toContain('- Steamer at 95 °C');
  });

  it('says nothing about a section the note has not got', () => {
    expect(sectionSource(NOTE, 'Micronutrient Information (Per 100g)')).toBe('');
    expect(sectionSource(NOTE, '  ')).toBe('');
  });

  it('round-trips: read a section, write it back, read it again', () => {
    const once = sectionSource(NOTE, 'Reheating');
    const written = replaceSection(NOTE, '# Reheating', once);

    expect(sectionSource(written, 'Reheating')).toBe(once);
    expect(written).toBe(NOTE);
  });
});

describe('replacing a section', () => {
  it('replaces the content under an existing heading', () => {
    const result = replaceSection(NOTE, '# Reheating', '- Steamer at 100 °C');

    expect(result).toContain('- Steamer at 100 °C');
    expect(result).not.toContain('- Steamer at 95 °C');
    expect(result).toContain('1. Take the wrap off.');
  });

  it('inserts a missing section above the first heading it must precede', () => {
    // Several candidates, the first of which this note has not got, so the
    // section lands above the second. That fallthrough is what keeps a note's
    // shape stable whichever sections it happens to carry.
    const without = NOTE.replace('# Notes\n\n1. Take the wrap off.\n\n', '');
    const result = replaceSection(without, '# Notes', '1. Heat it.', [
      'Micronutrient Information (Per 100g)',
      'Eating History',
    ]);

    const lines = result.split('\n');
    expect(lines.indexOf('# Notes')).toBeGreaterThan(-1);
    expect(lines.indexOf('# Notes')).toBeLessThan(lines.indexOf('# Eating History'));
    // And above nothing it was not asked to precede: Reheating came first in
    // the note and still does.
    expect(lines.indexOf('# Reheating')).toBeLessThan(lines.indexOf('# Notes'));
  });

  it('appends when none of the headings it must precede exist', () => {
    const bare = '---\ntype: meal\n---\n\n# Reheating\n\n- salt\n';
    const result = replaceSection(bare, '# Notes', '1. Heat it.', ['Eating History']);

    expect(result.trimEnd().endsWith('1. Heat it.')).toBe(true);
  });

  it('replaces a section that has group headings in it, rather than doubling them', () => {
    // Found by running every meal in the vault through read-then-write. The
    // old rule stopped at the next heading of any level, so a section with
    // `## From frozen` in it was replaced down to that line and the new content, which
    // contains it, landed above the groups it was meant to replace.
    const grouped = NOTE.replace(
      '- Steamer at 95 °C',
      [
        '## From frozen',
        '',
        '- Oven at 180 °C',
        '',
        '## From chilled',
        '',
        '- Microwave at 800 W',
      ].join('\n')
    );
    const content = sectionSource(grouped, 'Reheating');

    expect(replaceSection(grouped, '# Reheating', content)).toBe(grouped);
    expect(
      replaceSection(grouped, '# Reheating', '- Nothing else').split('## From frozen')
    ).toHaveLength(1);
    // And what followed the section is still there, once.
    expect(replaceSection(grouped, '# Reheating', '- x').split('# Notes')).toHaveLength(2);
  });

  it('leaves every other section byte for byte', () => {
    const result = replaceSection(NOTE, '# Notes', '1. Something else.');
    expect(result).toContain('# Eating History\n\n- 2026-01-24 came out well');
    expect(result).toContain('- **Calories:** 133 kcal');
  });
});

describe('removing a section', () => {
  it('takes the heading and its content, and leaves the rest where it was', () => {
    const result = removeSection(NOTE, 'Nutritional Information (Per 100g)');

    expect(result).not.toContain('# Nutritional Information (Per 100g)');
    expect(result).not.toContain('- **Calories:** 133 kcal');
    // Everything around it, in the order it was in.
    expect(result).toContain('mit hausgemachter Pasta');
    expect(result).toContain('# Reheating\n\n- Steamer at 95 °C');
    expect(result).toContain('# Notes\n\n1. Take the wrap off.');
    expect(result).toContain('# Eating History\n\n- 2026-01-24 came out well');
    expect(result).toContain('servings: 1');
  });

  it('is a no-op when the note has not got the section', () => {
    // The common case once a vault has been converted: every save asks for the
    // removal and almost every note has nothing left to remove. It has to be
    // safe to run on all of them, byte for byte, or opening and saving a
    // library would produce a diff per note.
    expect(removeSection(NOTE, 'Micronutrient Information (Per 100g)')).toBe(NOTE);
    expect(removeSection(NOTE, '  ')).toBe(NOTE);
    expect(removeSection(NOTE, 'Nutritional Information (Per 100g)')).toBe(
      removeSection(
        removeSection(NOTE, 'Nutritional Information (Per 100g)'),
        'Nutritional Information (Per 100g)'
      )
    );
  });

  it('takes a section with group headings in it whole', () => {
    // The same same-level-or-shallower rule `sectionSource` reads by. Stopping
    // at the next heading of any level would leave `## From frozen` and its
    // steps stranded under whatever section came next.
    const grouped = NOTE.replace(
      '- Steamer at 95 °C',
      ['## From frozen', '', '- Oven at 180 °C', '', '## From chilled', '', '- Microwave'].join(
        '\n'
      )
    );
    const result = removeSection(grouped, 'Reheating');

    expect(result).not.toContain('## From frozen');
    expect(result).not.toContain('- Microwave');
    expect(result).toContain('# Notes');
  });

  it('reads a heading the way the writers do', () => {
    // With or without its hashes, and without regard to case, because a caller
    // has the configured heading name and `replaceSection` took either.
    expect(removeSection(NOTE, '# Notes')).toBe(removeSection(NOTE, 'notes'));
    expect(removeSection(NOTE, '# Notes')).not.toContain('1. Take the wrap off.');
  });

  it('does not read inside the frontmatter', () => {
    // A `#` at the start of a line in a YAML block is a comment, not a heading.
    // Cutting from one would take the closing `---` and the whole note with it.
    const commented = ['---', 'type: meal', '# Notes', '---', '', 'text', ''].join('\n');

    expect(removeSection(commented, 'Notes')).toBe(commented);
  });
});

/**
 * The retired body format, which is still every unconverted note's format.
 *
 * The two renderers have no caller left and are marked deprecated, but they are
 * what wrote the sections sitting in the vault today, so rendering and parsing
 * back is the cheapest way to hold the reader to the exact shape those notes
 * carry. The reader is the half that has to keep working; the writer is here as
 * the specification of what it must read.
 */
describe('the per-100 g sections', () => {
  it('round-trips through render and parse', () => {
    const values = {
      ...emptyPer100g(),
      calories: 133,
      kj: 558,
      protein: 7.3,
      fat: 2.8,
      carbs: 20.9,
    };
    expect(parseNutritionSection(renderNutritionSection(values))).toEqual({
      calories: 133,
      kj: 558,
      protein: 7.3,
      fat: 2.8,
      carbs: 20.9,
    });

    const micro = { ...emptyPer100g(), salt: 0.2, sugar: 2.4, saturatedFat: 1.9 };
    expect(parseMicronutrientSection(renderMicronutrientSection(micro))).toEqual({
      salt: 0.2,
      sugar: 2.4,
      saturatedFat: 1.9,
    });
  });

  it('reads the alternative labels a hand-edited note ends up with', () => {
    const parsed = parseNutritionSection(
      ['- Protein: 7.3g', '- **Carbohydrates:** 20.9g', '- kJ: 558'].join('\n')
    );
    expect(parsed).toMatchObject({ protein: 7.3, carbs: 20.9, kj: 558 });
  });

  it('reads a field with no value as unset rather than as zero', () => {
    expect(parseNutritionSection('- **Sugar:** ').calories).toBeNull();
    expect(parsePer100g('- **Calories:** 133 kcal', '- **Sugar:** ').sugar).toBeNull();
  });

  it('writes an empty row rather than dropping a field nobody filled in', () => {
    expect(renderMicronutrientSection(emptyPer100g())).toContain('- **Sugar:** ');
  });
});

describe('the nutrition arithmetic', () => {
  it('converts a label figure to one serving and back', () => {
    expect(round2(perServing(133, 440))).toBe(585.2);
    expect(per100g(585.2, 440)).toBe(133);
  });

  it('refuses to divide by a serving weight it does not have', () => {
    expect(per100g(585.2, null)).toBeNull();
    expect(per100g(585.2, 0)).toBeNull();
  });

  it('carries a null through rather than turning it into zero', () => {
    expect(perServing(null, 440)).toBeNull();
    expect(round2(null)).toBeNull();
  });
});

describe('the supplier the editor offers', () => {
  const companies = ['TomTasty AG', 'VitaFresh'];

  it('offers nobody in particular, then every company', () => {
    expect(supplierOptionValues(companies, null)).toEqual(['', 'TomTasty AG', 'VitaFresh']);
  });

  it('keeps a supplier whose company note no longer exists', () => {
    // The case this function exists for. A `<select>` whose value matches no option
    // falls back to its first, so a list built from the companies alone would let a
    // save replace a supplier somebody typed with "none" without anybody asking.
    expect(supplierOptionValues(companies, 'Gone Foods AG')).toEqual([
      '',
      'TomTasty AG',
      'VitaFresh',
      'Gone Foods AG',
    ]);
    expect(isUnknownSupplier(companies, 'Gone Foods AG')).toBe(true);
  });

  it('does not repeat a supplier that is a company', () => {
    expect(supplierOptionValues(companies, 'VitaFresh')).toEqual(['', 'TomTasty AG', 'VitaFresh']);
    expect(isUnknownSupplier(companies, 'VitaFresh')).toBe(false);
  });

  it('treats a blank supplier as none rather than as an unknown company', () => {
    // A note carrying `supplier:` with nothing after it, or with spaces. Adding that
    // to the list would put an unlabelled blank option under the real one.
    expect(supplierOptionValues(companies, '   ')).toEqual(['', 'TomTasty AG', 'VitaFresh']);
    expect(isUnknownSupplier(companies, '   ')).toBe(false);
  });

  it('offers only nobody in particular when the vault has no company notes', () => {
    // CULItrail creates no Company notes, so this is the state of a fresh vault and
    // the dropdown has to be honest about it rather than absent.
    expect(supplierOptionValues([], null)).toEqual(['']);
    expect(supplierOptionValues([], 'TomTasty AG')).toEqual(['', 'TomTasty AG']);
  });
});
