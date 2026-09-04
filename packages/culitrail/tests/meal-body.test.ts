/**
 * Reading a meal note's body: its sections, the groups a section splits into,
 * and the frontmatter meta beside them.
 */
import { describe, expect, it } from 'vitest';
import {
  extractLeadingText,
  extractSection,
  findHeading,
  stripFrontmatter,
} from '../src/meals/parser/body-sections';
import { splitIntoGroups } from '../src/meals/parser/step-groups';
import { effectiveTotalTime, readMealMeta } from '../src/meals/parser/meal-meta';
import { mergeSettings } from '../src/settings/validate';

const settings = mergeSettings({});

const NOTE = `---
type: meal
servings: 2
---

A Sicilian pasta that lives or dies on salting the aubergine.

## Reheating

### Oven
Heat for 20 minutes at 180 °C.

### Microwave
[temp:: 800 W] [time:: 4 min]

## Notes

Works with rigatoni.
`;

const body = stripFrontmatter(NOTE);

describe('stripFrontmatter', () => {
  it('removes the block, leaving the body spacing as written', () => {
    // The blank line the note had between its frontmatter and its first
    // paragraph survives. Callers split into lines and skip blanks, and
    // collapsing it here would change the body of anything written back.
    expect(stripFrontmatter(NOTE)).not.toContain('type: meal');
    expect(stripFrontmatter(NOTE).trim().startsWith('A Sicilian pasta')).toBe(true);
  });

  it('leaves a note with no frontmatter unchanged', () => {
    expect(stripFrontmatter('# Meal\n')).toBe('# Meal\n');
  });

  it('leaves an unterminated block unchanged rather than eating the file', () => {
    // A note somebody is midway through editing. Truncating would look like
    // the plugin had lost their work.
    const broken = '---\ntype: meal\n\n## Notes\nWorks with rigatoni.\n';
    expect(stripFrontmatter(broken)).toBe(broken);
  });
});

describe('findHeading', () => {
  const lines = body.split('\n');

  it('finds a heading at any level, case-insensitively', () => {
    expect(findHeading(lines, 'reheating').index).toBeGreaterThan(-1);
    expect(findHeading(lines, 'REHEATING').level).toBe(2);
    // Whether a vault writes # or ## is a formatting preference. Requiring
    // one level would mean half a vault's notes silently failing to parse.
    expect(findHeading(['# Reheating'], 'Reheating').level).toBe(1);
  });

  it('returns -1 for an absent heading and for a blank name', () => {
    expect(findHeading(lines, 'Nutrition').index).toBe(-1);
    expect(findHeading(lines, '').index).toBe(-1);
  });
});

describe('extractSection', () => {
  it('reads to the next heading of any level', () => {
    expect(extractSection(body.split('\n'), 'Notes').content).toBe('Works with rigatoni.');
  });

  it('stops at a sub-heading too, which is why grouped sections use their own splitter', () => {
    // The generic helper is right for a flat section such as Notes, and
    // wrong for Reheating, whose content opens with a `###`. Asking it for
    // Reheating yields whatever sat above that sub-heading, here nothing.
    // step-groups.ts compares heading depth instead.
    expect(extractSection(body.split('\n'), 'Reheating').content).toBe('');
    expect(extractSection(body.split('\n'), 'Reheating').exists).toBe(true);
  });

  it('reports a missing section rather than an empty one', () => {
    expect(extractSection(body.split('\n'), 'Nutrition')).toEqual({ exists: false, content: '' });
  });
});

describe('extractLeadingText', () => {
  it('reads the description before the first heading', () => {
    expect(extractLeadingText(body.split('\n'))).toBe(
      'A Sicilian pasta that lives or dies on salting the aubergine.'
    );
  });

  it('treats a note with no headings as entirely description', () => {
    // The right answer for a meal somebody has started but not structured.
    expect(extractLeadingText(['Just a thought about dinner.'])).toBe(
      'Just a thought about dinner.'
    );
  });
});

describe('splitIntoGroups', () => {
  const split = splitIntoGroups(body, 'Reheating');

  it('preserves sub-group headings, with their level', () => {
    // The leading unheaded group is kept rather than dropped: the lines above
    // the first sub-heading are as much a part of the section as the ones
    // under it, and it is the caller's rule, not the walker's, that decides
    // whether an empty one is worth rendering.
    expect(split.groups.map((g) => g.heading)).toEqual([null, 'Oven', 'Microwave']);
    expect(split.groups[1].headingLevel).toBe(3);
    // Raw lines, blank ones included: no rule about what a step is lives in
    // the walker.
    expect(split.groups[1].lines).toEqual(['Heat for 20 minutes at 180 °C.', '']);
  });

  it('stops at the next same-level heading', () => {
    expect(split.after).toContain('## Notes');
    expect(split.groups.flatMap((g) => g.lines).join('\n')).not.toContain('rigatoni');
  });

  it('returns everything before the heading, for a caller rebuilding the note', () => {
    expect(split.before).toContain('A Sicilian pasta');
  });

  it('keeps the lines above the first sub-heading in a group of their own', () => {
    // A section written as prose has no sub-headings at all, and one that opens
    // with an aside above them still said that aside.
    const withAside = '## Reheating\nDo not refreeze.\n### Oven\nHeat it.\n';
    const groups = splitIntoGroups(withAside, 'Reheating').groups;
    expect(groups.map((g) => g.heading)).toEqual([null, 'Oven']);
    expect(groups[0].lines).toContain('Do not refreeze.');
  });

  it('reports nothing at all for a section the note does not have', () => {
    const split = splitIntoGroups('## Notes\nWorks with rigatoni.\n', 'Reheating');
    expect(split.groups).toEqual([]);
    expect(split.before).toContain('Works with rigatoni.');
  });
});

describe('readMealMeta', () => {
  it('reads through the configured property names', () => {
    const meta = readMealMeta({ servings: 2, prepTime: 15, reheatTime: 30 }, settings);
    expect(meta.servings).toBe(2);
    expect(meta.prepTime).toBe(15);
  });

  it('falls back to an alias when the configured name is absent', () => {
    // A meal imported from elsewhere still renders rather than appearing
    // blank.
    expect(readMealMeta({ yield: 4 }, settings).servings).toBe(4);
    expect(readMealMeta({ prep: 15 }, settings).prepTime).toBe(15);
  });

  it('prefers the configured name over any alias', () => {
    // A vault's own naming always wins.
    expect(readMealMeta({ servings: 2, yield: 4 }, settings).servings).toBe(2);
  });

  it('skips a blank configured value in favour of a populated alias', () => {
    // findValue skips empties rather than stopping at the first key that
    // merely exists.
    expect(readMealMeta({ servings: '', yield: 4 }, settings).servings).toBe(4);
  });

  it('reads the bare `total` a note written elsewhere carries', () => {
    // Without this alias, such a note shows a blank Total while holding a real
    // value, and any save writes a second totalTime key beside the orphaned
    // one.
    expect(readMealMeta({ total: 45 }, settings).totalTime).toBe(45);
  });

  it('treats favorite as a boolean with no third state', () => {
    expect(readMealMeta({ favorite: 'yes' }, settings).favorite).toBe(true);
    expect(readMealMeta({}, settings).favorite).toBe(false);
  });

  it('reads lastEaten as a date, dropping any clock time', () => {
    // A meal was eaten on a day, not at a time as far as this property is
    // concerned. Reading it as a datetime would carry a spurious 00:00 into
    // every display.
    expect(readMealMeta({ lastEaten: '2026-07-28T19:40' }, settings).lastEaten).toBe('2026-07-28');
  });

  it('follows a renamed property', () => {
    const renamed = mergeSettings({ servingsProperty: 'portionen' });
    expect(readMealMeta({ portionen: 6 }, renamed).servings).toBe(6);
  });

  it('returns an empty meta for a note with no frontmatter at all', () => {
    const meta = readMealMeta({}, settings);
    expect(meta.servings).toBeNull();
    expect(meta.diet).toEqual([]);
    expect(meta.nutrition.calories).toBeNull();
  });
});

describe('effectiveTotalTime', () => {
  const meta = (overrides: Record<string, unknown>) => readMealMeta(overrides, settings);

  it('derives prep plus reheat when the note states no total', () => {
    expect(effectiveTotalTime(meta({ prepTime: 15, reheatTime: 30 }))).toBe(45);
  });

  it('lets an explicit total win', () => {
    // Somebody who wrote one meant it: a meal that rests overnight has a
    // total far larger than prep plus reheat.
    expect(effectiveTotalTime(meta({ prepTime: 15, reheatTime: 30, totalTime: 720 }))).toBe(720);
  });

  it('derives from whichever component is present', () => {
    expect(effectiveTotalTime(meta({ reheatTime: 30 }))).toBe(30);
  });

  it('returns null when the note states nothing, rather than zero', () => {
    // Zero would render a "Total: 0 min" badge on every meal that says
    // nothing about time.
    expect(effectiveTotalTime(meta({}))).toBeNull();
  });
});
