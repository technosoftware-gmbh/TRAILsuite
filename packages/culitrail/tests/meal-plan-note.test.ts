/**
 * The parts of the planning area that are not the note format: which entries a
 * scope holds, and which file a week and a person resolve to.
 *
 * The checklist reader is here too, and only that half of it. Nothing writes a
 * plan line any more, so what is left to protect is that a note nobody has
 * converted is still read correctly. The frontmatter format has its own suite
 * in `plan-note.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { MealPlanEntry } from '../src/settings/types';
import {
  entriesForMeal,
  entriesInScope,
  entryInScope,
  groupByDay,
} from '../src/planning/meal-plan/entries';
import { readLineSuffix } from '../src/planning/meal-plan/meal-suffix';
import { entryLines, parseMealPlanNote } from '../src/planning/meal-plan/note-parse';
import { mealPlanNotePath, pathForEntry } from '../src/planning/meal-plan/note-path';

const settings = mergeSettings({});

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: 'e1',
    mealPath: 'Eating/Meals/Risotto.md',
    addedDate: '2026-08-10',
    week: '2026-W33',
    person: 'Stefan Muster',
    ...overrides,
  };
}

describe('readLineSuffix', () => {
  it('reads a meal slot in any of the three notations, whatever the setting says', () => {
    // Changing the notation setting must not orphan the notes written under
    // the old one.
    for (const suffix of [' #meal/dinner', ' [meal:: dinner]', ' (dinner)']) {
      expect(readLineSuffix(suffix, settings).meal).toBe('dinner');
    }
  });

  it('follows a renamed field', () => {
    const renamed = mergeSettings({ mealSlotFieldName: 'mahlzeit' });
    expect(readLineSuffix(' #mahlzeit/lunch', renamed).meal).toBe('lunch');
  });

  it('reads a slot key case-insensitively, since a note may be hand-edited', () => {
    expect(readLineSuffix(' (Dinner)', settings).meal).toBe('dinner');
  });

  it('ignores a value that is not one of the four slots', () => {
    // The four are a fixed vocabulary the grid columns key off. A fifth
    // invented by hand would have nowhere to appear.
    expect(readLineSuffix(' (elevenses)', settings).meal).toBeNull();
  });

  it('reads a rating, and only a plausible one', () => {
    expect(readLineSuffix(' [rating:: 4]', settings).rating).toBe(4);
    expect(readLineSuffix(' [rating:: 9]', settings).rating).toBeNull();
    expect(readLineSuffix('', settings).rating).toBeNull();
  });

  it('reads the leftovers mark', () => {
    expect(readLineSuffix(' #leftovers', settings).isLeftovers).toBe(true);
    expect(readLineSuffix(' #leftover-pizza', settings).isLeftovers).toBe(false);
  });

  it('does not let a rating or the leftovers tag be mistaken for a meal slot', () => {
    // Both are stripped before the slot is looked for. Without that, the
    // Dataview slot pattern matches `[rating:: 4]` and yields nothing while
    // consuming the real suffix.
    const parsed = readLineSuffix(' #meal/dinner [rating:: 4] #leftovers', settings);
    expect(parsed).toEqual({ meal: 'dinner', rating: 4, isLeftovers: true });
  });
});

describe('parseMealPlanNote', () => {
  const note = [
    '# Meal Plan',
    '',
    '## Monday',
    '- [ ] [[Risotto]] (dinner)',
    '- [x] Grilled cheese (lunch)',
    '',
    '## Thursday',
    '- [ ] [[Lasagne]] (dinner) [rating:: 5] #leftovers',
    'Remember to defrost the stock.',
  ].join('\n');

  it('reads sections as weekday keys, not as whatever the heading said', () => {
    const sections = parseMealPlanNote(note, settings);
    expect(sections.map((section) => section.day)).toEqual([null, 'monday', 'thursday']);
  });

  it('reads a meal line and a plain meal line differently', () => {
    const lines = entryLines(parseMealPlanNote(note, settings));
    expect(lines[0]).toMatchObject({ wikilink: 'Risotto', meal: 'dinner', checked: false });
    expect(lines[1]).toMatchObject({ wikilink: '', label: 'Grilled cheese', checked: true });
  });

  it('keeps a wikilink alias out of the target', () => {
    const [line] = entryLines(parseMealPlanNote('- [ ] [[Risotto|Tonight]]', settings));
    expect(line.wikilink).toBe('Risotto');
  });

  it('reads nothing inside the frontmatter block as a meal', () => {
    // The note carries `created:` and `modified:` now, and a hand-added
    // top-level YAML list would otherwise put a meal named "dinner" in the
    // plan on a day nobody chose.
    const stamped = [
      '---',
      'created: 2026-08-04T16:33',
      'tags:',
      '- dinner',
      '---',
      '# Meal Plan',
      '',
      '## Monday',
      '- [ ] [[Risotto]]',
    ].join('\n');

    const lines = entryLines(parseMealPlanNote(stamped, settings));
    expect(lines).toHaveLength(1);
    expect(lines[0].wikilink).toBe('Risotto');
  });

  it('carries the frontmatter lines through, so a rebuild cannot lose them', () => {
    // Removing an entry rewrites the note from these sections. A line that is
    // not carried is a line that is gone.
    const stamped =
      '---\ncreated: 2026-08-04T16:33\n---\n# Meal Plan\n\n## Monday\n- [ ] [[Risotto]]';
    const rebuilt = parseMealPlanNote(stamped, settings)
      .flatMap((section) =>
        (section.heading ? [`## ${section.heading}`] : []).concat(
          section.lines.map((line) => line.raw)
        )
      )
      .join('\n');
    expect(rebuilt).toBe(stamped);
  });

  it('reads rating and leftovers off an entry', () => {
    const lines = entryLines(parseMealPlanNote(note, settings));
    expect(lines[2]).toMatchObject({ wikilink: 'Lasagne', rating: 5, isLeftovers: true });
  });

  it('keeps anything it cannot read as a raw line', () => {
    const sections = parseMealPlanNote(note, settings);
    const thursday = sections.find((section) => section.day === 'thursday');
    expect(thursday?.lines.some((line) => line.raw === 'Remember to defrost the stock.')).toBe(
      true
    );
  });

  it('does not read a bracketed label as a property', () => {
    // `Chicken [Nonna's]` is a name, not a field. Requiring `::` inside the
    // brackets is what tells them apart.
    const [line] = entryLines(parseMealPlanNote("- [ ] Chicken [Nonna's]", settings));
    expect(line.label).toBe("Chicken [Nonna's]");
  });

  it('treats an unrecognized heading as a section rather than dropping it', () => {
    const sections = parseMealPlanNote('## Leftovers\n- [ ] Lasagne al forno', settings);
    expect(sections[1]).toMatchObject({ day: null, heading: 'Leftovers' });
  });
});

describe('entryInScope', () => {
  const scope = { week: '2026-W33', person: 'Stefan Muster' };

  it('needs both the week and the person to match', () => {
    expect(entryInScope(entry(), scope)).toBe(true);
    expect(entryInScope(entry({ week: '2026-W34' }), scope)).toBe(false);
    expect(entryInScope(entry({ person: 'Someone Else' }), scope)).toBe(false);
  });

  it('does not adopt an entry with no week', () => {
    // The inherited version treats a missing week as "the current week", to
    // accommodate data written before week navigation existed. CULItrail has
    // never written such an entry, so that rule would only ever pull junk
    // into whichever week happened to be on screen.
    expect(entryInScope(entry({ week: undefined }), scope)).toBe(false);
  });

  it('matches a vault with no people configured', () => {
    expect(entryInScope(entry({ person: undefined }), { week: '2026-W33', person: '' })).toBe(true);
  });

  it('narrows a list', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b', week: '2026-W34' })];
    expect(entriesInScope(entries, scope).map((item) => item.id)).toEqual(['a']);
  });
});

describe('entriesForMeal and groupByDay', () => {
  it('finds every entry for one meal across weeks', () => {
    const entries = [
      entry({ id: 'a' }),
      entry({ id: 'b', week: '2026-W34' }),
      entry({ id: 'c', mealPath: 'Other.md' }),
    ];
    expect(entriesForMeal(entries, 'Eating/Meals/Risotto.md').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('keys the queue off null rather than the string "null"', () => {
    const grouped = groupByDay([entry({ id: 'a' }), entry({ id: 'b', day: 'monday' })]);
    expect(grouped.get(null)?.map((e) => e.id)).toEqual(['a']);
    expect(grouped.get('monday')?.map((e) => e.id)).toEqual(['b']);
  });
});

describe('mealPlanNotePath', () => {
  it('resolves the week and the person into the template', () => {
    const path = mealPlanNotePath(settings, '2026-W33', 'Stefan Muster');
    expect(path).toContain('2026-W33');
    expect(path).toContain('StefanMuster');
  });

  it('refuses a week title it cannot parse rather than filing under today', () => {
    expect(mealPlanNotePath(settings, 'not-a-week', 'Stefan')).toBeNull();
  });

  it('refuses a per-person template with nobody to fill in', () => {
    // Otherwise the path keeps a literal {person} and creates a file nobody
    // meant to exist.
    expect(mealPlanNotePath(settings, '2026-W33', '  ')).toBeNull();
  });

  it('keys an entry off its own week and person, not the current view', () => {
    const path = pathForEntry(settings, entry({ week: '2026-W01', person: 'Ada Lovelace' }));
    expect(path).toContain('2026-W01');
    expect(path).toContain('AdaLovelace');
    expect(pathForEntry(settings, entry({ week: undefined }))).toBeNull();
  });
});
