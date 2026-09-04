/**
 * The plan note: what goes into its frontmatter, and what comes back out.
 *
 * The round trip is the thing to protect, the same as it was for the checklist
 * this replaces, but the failures worth pinning down have moved. A line format
 * could lose a field to a regex; a property list loses one to an omission rule
 * that is slightly too keen, so most of what is asserted here is about what is
 * written and what is deliberately not.
 *
 * The other half is the three mutators. They are pure for exactly this reason:
 * "editing a rating must not delete the note somebody wrote when they ate it"
 * is a rule, and a rule that can only be checked by running Obsidian is a rule
 * nobody checks.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { planProperties } from '../src/planning/meal-plan/plan-note';
import {
  buildPlanFrontmatter,
  emptyPlanEntry,
  hasPlanEntries,
  parsePlanNote,
  patchEntry,
  upsertEntry,
  withoutEntries,
  type PlanEntryContent,
} from '../src/planning/meal-plan/plan-note';

const settings = mergeSettings({});
const properties = planProperties(settings);

const entry = (overrides: Partial<PlanEntryContent> = {}): PlanEntryContent => ({
  ...emptyPlanEntry('e1'),
  mealTitle: 'Risotto alla Puttanesca',
  day: 'tuesday',
  slot: 'lunch',
  ...overrides,
});

const parse = (frontmatter: Record<string, unknown>) => parsePlanNote({ frontmatter, properties });

describe('what a plan note says', () => {
  it('writes the week, the person and one mapping per entry', () => {
    expect(
      buildPlanFrontmatter(properties, {
        week: '2026-W34',
        personTitle: 'Stefan Muster',
        entries: [entry({ eaten: true, rating: 5, time: '11:40' })],
      })
    ).toEqual({
      type: 'mealPlan',
      week: '2026-W34',
      person: '[[Stefan Muster]]',
      entries: [
        {
          meal: '[[Risotto alla Puttanesca]]',
          day: 'tuesday',
          slot: 'lunch',
          eaten: true,
          rating: 5,
          time: '11:40',
          id: 'e1',
        },
      ],
    });
  });

  it('omits a flag that is false rather than writing it on every entry', () => {
    const [written] = buildPlanFrontmatter(properties, {
      week: null,
      personTitle: null,
      entries: [entry()],
    }).entries as Record<string, unknown>[];

    expect(Object.keys(written)).toEqual(['meal', 'day', 'slot', 'id']);
  });

  it('writes an empty list rather than no list, because a cleared week is a real state', () => {
    const frontmatter = buildPlanFrontmatter(properties, {
      week: '2026-W34',
      personTitle: null,
      entries: [],
    });
    expect(frontmatter.entries).toEqual([]);
    expect(hasPlanEntries(frontmatter, properties)).toBe(true);
  });

  it('round-trips through the writer and the reader', () => {
    const content = {
      week: '2026-W34',
      personTitle: 'Stefan Muster',
      entries: [
        entry({ eaten: true, rating: 4, time: '19:05', note: 'half a portion' }),
        entry({ id: 'e2', mealTitle: null, label: 'Leftovers', day: null, isLeftovers: true }),
      ],
    };

    expect(parse(buildPlanFrontmatter(properties, content))).toEqual(content);
  });

  it('tells a meal note from a plain label by whether the value is a link', () => {
    const read = parse({
      entries: [{ meal: '[[Pizza]]' }, { meal: 'Dinner at Anna’s' }],
    });

    expect(read.entries[0]).toMatchObject({ mealTitle: 'Pizza', label: null });
    expect(read.entries[1]).toMatchObject({ mealTitle: null, label: 'Dinner at Anna’s' });
  });

  it('takes a bare wikilink as an entry, since that is what a hand-edit writes', () => {
    expect(parse({ entries: ['[[Pizza]]'] }).entries[0]).toMatchObject({
      mealTitle: 'Pizza',
      day: null,
    });
  });

  it('drops a mapping naming nothing rather than putting a nameless card on the week', () => {
    expect(parse({ entries: [{ day: 'monday' }, { meal: '[[Pizza]]' }] }).entries).toHaveLength(1);
  });

  it('reads a zero rating as none, which is what the old line format meant by it', () => {
    // 32 lines in the vault carry `[rating:: 0]` for "eaten and deliberately
    // unrated". With a real `eaten` field that is an eaten entry with no
    // rating, and the magic value has nothing left to say.
    expect(
      parse({ entries: [{ meal: '[[Pizza]]', eaten: true, rating: 0 }] }).entries[0]
    ).toMatchObject({ eaten: true, rating: null });
  });

  it('refuses a rating and a clock time that are not one', () => {
    const [read] = parse({
      entries: [{ meal: '[[Pizza]]', rating: 9, time: '25:00' }],
    }).entries;

    expect(read.rating).toBeNull();
    expect(read.time).toBeNull();
  });

  it('reads a flag written as the word, which is what a hand-edit can leave', () => {
    expect(parse({ entries: [{ meal: '[[Pizza]]', eaten: 'true' }] }).entries[0].eaten).toBe(true);
  });

  it('ignores a day or a slot that is not one of the fixed set', () => {
    const [read] = parse({
      entries: [{ meal: '[[Pizza]]', day: 'someday', slot: 'brunch' }],
    }).entries;

    expect(read.day).toBeNull();
    expect(read.slot).toBeNull();
  });

  it('prefers the property over the filename, since a person corrects the property', () => {
    const read = parsePlanNote({
      frontmatter: { week: '2026-W34', entries: [] },
      properties,
      fromPath: { week: '2026-W01', personTitle: 'Erika Muster' },
    });

    expect(read.week).toBe('2026-W34');
    // And falls back to it for what the note does not state.
    expect(read.personTitle).toBe('Erika Muster');
  });

  it('is not a plan note at all when it carries no entries list', () => {
    expect(hasPlanEntries({ week: '2026-W34' }, properties)).toBe(false);
  });
});

describe('editing a week', () => {
  const week = [entry(), entry({ id: 'e2', mealTitle: 'Pizza', day: 'friday' })];

  it('adds an entry the week does not have', () => {
    const next = upsertEntry(week, entry({ id: 'e3', mealTitle: 'Lasagne' }));
    expect(next.map((candidate) => candidate.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('replaces one it does, in place, so the card does not drop to the bottom', () => {
    const next = upsertEntry(week, entry({ id: 'e2', mealTitle: 'Pizza', day: 'sunday' }));
    expect(next).toHaveLength(2);
    expect(next[1].day).toBe('sunday');
  });

  it('keeps the fields a patch says nothing about', () => {
    // The rule this exists for. State does not model `time` or `note`, so a
    // caller rewriting the entry from state would delete both every time
    // somebody set a rating.
    const eaten = [entry({ eaten: true, time: '19:05', note: 'half a portion' })];
    const [patched] = patchEntry(eaten, entry(), { rating: 4 }) ?? [];

    expect(patched).toMatchObject({ rating: 4, time: '19:05', note: 'half a portion' });
  });

  it('moves an entry to another day without it becoming a different entry', () => {
    const [patched] = patchEntry(week, entry(), { day: 'thursday' }) ?? [];
    expect(patched).toMatchObject({ id: 'e1', day: 'thursday' });
  });

  it('finds an entry with no id by what it is, and gives it one', () => {
    // A note nobody has converted has no ids at all, and neither has an entry
    // somebody typed into the list by hand. An id-only lookup would find
    // nothing and the edit would be a silent no-op.
    const unconverted = [entry({ id: '' })];
    const [patched] = patchEntry(unconverted, entry({ id: 'fresh' }), { rating: 4 }) ?? [];

    expect(patched).toMatchObject({ id: 'fresh', rating: 4 });
  });

  it('writes nothing for an entry the note does not hold', () => {
    expect(patchEntry(week, entry({ id: 'nope', mealTitle: 'Nothing' }), { rating: 4 })).toBeNull();
  });

  it('removes several entries in one pass, for clearing a week', () => {
    expect(withoutEntries(week, week)).toEqual([]);
  });

  it('removes one copy when a day genuinely holds the same dish twice', () => {
    const twice = [entry({ id: '' }), entry({ id: '' })];
    expect(withoutEntries(twice, [entry({ id: '' })])).toHaveLength(1);
  });

  it('writes nothing when the note holds none of them', () => {
    expect(withoutEntries(week, [entry({ id: 'nope', mealTitle: 'Nothing' })])).toBeNull();
    expect(withoutEntries(week, [])).toBeNull();
  });
});
