/**
 * The plan line and the plan note, against the shapes the vault contains.
 *
 * Every fixture here is real: a `[rating:: 0]` that means unrated, a `[note::
 * ½ portion]` carried over from the old body log, an unticked box that means
 * planned rather than eaten, and a `## Meal Plan Queue` heading that is not a
 * weekday.
 */
import { describe, expect, it } from 'vitest';
import {
  clearPlanEntries,
  datesOfWeek,
  emptyPlanNote,
  hasLeftoversTag,
  isQueueHeading,
  LEFTOVERS_TAG,
  movePlanEntry,
  parsePlanLine,
  parsePlanNoteName,
  planEntry,
  planNoteFor,
  planNotePath,
  readPlanNote,
  readPlanQueue,
  removePlanEntry,
  renderPlanLine,
  slotOfHeading,
  stripLeftoversTag,
  upsertPlanEntry,
  weekdayOf,
} from '../../src/plan';

describe('parsePlanLine', () => {
  it('reads the shape the vault writes', () => {
    const entry = parsePlanLine('- [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4]');

    expect(entry).toMatchObject({
      meal: 'Tantanmen Ramen Suppe',
      eaten: true,
      slot: 'lunch',
      rating: 4,
      ratingWritten: true,
      note: null,
    });
  });

  it('reads a written zero as unrated, and remembers it was written', () => {
    const entry = parsePlanLine('- [x] [[Federkohlrisotto]] [rating:: 0] [note:: ½ portion]');

    expect(entry?.rating).toBeNull();
    expect(entry?.ratingWritten).toBe(true);
    expect(entry?.note).toBe('½ portion');
  });

  it('separates planned from eaten', () => {
    expect(parsePlanLine('- [ ] [[Naked Burrito ⚖️]] #meal/lunch')?.eaten).toBe(false);
    expect(parsePlanLine('- [x] [[Naked Burrito ⚖️]] #meal/lunch')?.eaten).toBe(true);
  });

  it('keeps the emoji and the alias out of the title', () => {
    expect(parsePlanLine('- [x] [[Bärlauchrisotto mit Spinat ⚖️]]')?.meal).toBe(
      'Bärlauchrisotto mit Spinat ⚖️'
    );
    expect(parsePlanLine('- [x] [[Naked Burrito ⚖️|Burrito]]')?.meal).toBe('Naked Burrito ⚖️');
  });

  it('is null for anything that is not a plan line', () => {
    expect(parsePlanLine('## Monday')).toBeNull();
    expect(parsePlanLine('- [x] no link here')).toBeNull();
    expect(parsePlanLine('')).toBeNull();
  });

  it('recovers the id marker', () => {
    expect(parsePlanLine('- [x] [[X]] <!--culi-id:mig-7199b0fa95-->')?.id).toBe('mig-7199b0fa95');
  });

  it('ignores a time that is not one', () => {
    expect(parsePlanLine('- [x] [[X]] [time:: 11:30]')?.time).toBe('11:30');
    expect(parsePlanLine('- [x] [[X]] [time:: soon]')?.time).toBeNull();
    expect(parsePlanLine('- [x] [[X]] [time:: 25:00]')?.time).toBeNull();
  });
});

describe('renderPlanLine', () => {
  it('round-trips every field', () => {
    const line =
      '- [x] [[Penne alla Norma ⚖️]] #meal/dinner [rating:: 3] [time:: 11:30] ' +
      '[note:: ½ portion] <!--culi-id:abc123-->';

    expect(renderPlanLine(parsePlanLine(line)!)).toBe(line);
  });

  it('omits a field rather than writing it empty', () => {
    expect(renderPlanLine(planEntry('Lasagne al forno'))).toBe('- [x] [[Lasagne al forno]]');
  });

  it('keeps a written zero, because it means eaten and deliberately unrated', () => {
    const entry = planEntry('X', { ratingWritten: true });
    expect(renderPlanLine(entry)).toBe('- [x] [[X]] [rating:: 0]');
  });

  it('writes an unticked box for a planned meal', () => {
    expect(renderPlanLine(planEntry('X', { eaten: false }))).toBe('- [ ] [[X]]');
  });
});

describe('the note itself', () => {
  it('parses and rebuilds a plan note name', () => {
    expect(parsePlanNoteName('2026-W33-StefanMuster-MealPlan')).toEqual({
      week: '2026-W33',
      person: 'StefanMuster',
    });
    expect(parsePlanNoteName('Bärlauchrisotto mit Spinat ⚖️')).toBeNull();
  });

  it('files a note under its week-year, not its calendar year', () => {
    // 2026-W01 starts on 29 December 2025. Filing it under 2025 would put the
    // week in a folder its own name contradicts.
    const ref = planNoteFor('2025-12-29', 'StefanMuster');

    expect(ref?.week).toBe('2026-W01');
    expect(planNotePath('Eating/Meal Plans', ref!)).toBe(
      'Eating/Meal Plans/2026/2026-W01-StefanMuster-MealPlan.md'
    );
  });

  it('knows which weekday a date is', () => {
    expect(weekdayOf('2026-08-12')).toBe('Wednesday');
    expect(weekdayOf('2026-08-16')).toBe('Sunday');
    expect(weekdayOf('not a date')).toBeNull();
  });

  it('gives a week its seven dates', () => {
    expect(datesOfWeek('2026-W33')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
    expect(datesOfWeek('nonsense')).toEqual([]);
  });
});

describe('upsertPlanEntry', () => {
  const BODY = `# Meal Plan
## Monday
- [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4]

## Thursday
- [x] [[Fregola Sarda Tostata al Pomodoro ⚖️]] #meal/dinner [rating:: 3]
`;

  it('appends to a weekday that already exists', () => {
    const { body, replaced } = upsertPlanEntry(BODY, 'Monday', planEntry('Naked Burrito ⚖️'));

    expect(replaced).toBe(false);
    expect(body).toContain(
      '- [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4]\n- [x] [[Naked Burrito ⚖️]]'
    );
  });

  it('inserts a missing weekday in weekday order, not at the end', () => {
    const { body } = upsertPlanEntry(BODY, 'Wednesday', planEntry('Lasagne al forno'));
    const headings = body.split('\n').filter((line) => line.startsWith('## '));

    expect(headings).toEqual(['## Monday', '## Wednesday', '## Thursday']);
  });

  it('appends a late weekday at the end', () => {
    const { body } = upsertPlanEntry(BODY, 'Sunday', planEntry('Lasagne al forno'));
    const headings = body.split('\n').filter((line) => line.startsWith('## '));

    expect(headings).toEqual(['## Monday', '## Thursday', '## Sunday']);
  });

  it('replaces the line with the same id', () => {
    const withId = `# Meal Plan
## Monday
- [x] [[X]] <!--culi-id:one-->
- [x] [[Y]] <!--culi-id:two-->
`;
    const { body, replaced } = upsertPlanEntry(
      withId,
      'Monday',
      planEntry('Y', { id: 'two', rating: 5 })
    );

    expect(replaced).toBe(true);
    expect(body).toContain('- [x] [[Y]] [rating:: 5] <!--culi-id:two-->');
    expect(body).toContain('- [x] [[X]] <!--culi-id:one-->');
    expect(body.split('\n').filter((line) => line.startsWith('- ')).length).toBe(2);
  });

  it('rates a meal that is already planned instead of adding a second line', () => {
    const planned = `# Meal Plan
## Monday
- [ ] [[Naked Burrito ⚖️]] #meal/lunch
`;
    const { body, replaced } = upsertPlanEntry(
      planned,
      'Monday',
      planEntry('Naked Burrito ⚖️', { slot: 'lunch', rating: 4 })
    );

    expect(replaced).toBe(true);
    expect(body).toContain('- [x] [[Naked Burrito ⚖️]] #meal/lunch [rating:: 4]');
    expect(body.split('\n').filter((line) => line.startsWith('- ')).length).toBe(1);
  });

  it('starts a note that has nothing in it', () => {
    const { body } = upsertPlanEntry(emptyPlanNote(), 'Friday', planEntry('Lasagne al forno'));

    expect(body).toBe('# Meal Plan\n\n## Friday\n- [x] [[Lasagne al forno]]');
  });

  it('leaves every other line untouched', () => {
    const { body } = upsertPlanEntry(BODY, 'Monday', planEntry('Naked Burrito ⚖️'));
    const removed = BODY.split('\n').filter((line) => !body.includes(line));

    expect(removed).toEqual([]);
  });
});

describe('removePlanEntry', () => {
  const BODY = `# Meal Plan
## Monday
- [x] [[X]] <!--culi-id:one-->
- [x] [[Y]] <!--culi-id:two-->
`;

  it('removes only the line with that id', () => {
    const { body, removed } = removePlanEntry(BODY, 'one');

    expect(removed).toBe(true);
    expect(body).not.toContain('culi-id:one');
    expect(body).toContain('culi-id:two');
  });

  it('says so when there is nothing to remove', () => {
    expect(removePlanEntry(BODY, 'three')).toEqual({ body: BODY, removed: false });
  });
});

describe('readPlanNote', () => {
  it('resolves each entry to its date', () => {
    const body = `# Meal Plan
## Monday
- [x] [[Tantanmen Ramen Suppe]] #meal/lunch [rating:: 4]
## Sunday
- [ ] [[Naked Burrito ⚖️]]
`;
    const entries = readPlanNote(body, '2026-W33');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ date: '2026-08-10', weekday: 'Monday', rating: 4 });
    expect(entries[1]).toMatchObject({ date: '2026-08-16', weekday: 'Sunday', eaten: false });
  });

  it('skips a heading that is not a weekday rather than guessing', () => {
    const body = `# Meal Plan
## Meal Plan Queue
- [x] [[Something]]
`;
    expect(readPlanNote(body, '2026-W33')).toEqual([]);
  });

  it('is empty for a week title that does not parse', () => {
    expect(readPlanNote('## Monday\n- [x] [[X]]', 'nonsense')).toEqual([]);
  });

  it('round-trips what upsert wrote', () => {
    const entry = planEntry('Lasagne al forno', { slot: 'dinner', rating: 5, note: 'half' });
    const { body } = upsertPlanEntry(emptyPlanNote(), 'Wednesday', entry);
    const [read] = readPlanNote(body, '2026-W33');

    expect(read).toMatchObject({
      meal: 'Lasagne al forno',
      slot: 'dinner',
      rating: 5,
      note: 'half',
    });
    expect(read?.date).toBe('2026-08-12');
  });
});

/**
 * The leftovers mark.
 *
 * It was CULItrail's alone before it moved here, and a reader and a writer
 * disagreeing about it is not hypothetical: `renderPlanLine` did not know the
 * tag, so anything that rewrote a line through this file – rating a meal,
 * ticking it, moving it – silently dropped a `#leftovers` somebody had set in
 * the plugin.
 */
describe('leftovers', () => {
  it('reads the tag off a line', () => {
    expect(parsePlanLine('- [x] [[Chili]] #meal/dinner #leftovers')?.leftovers).toBe(true);
    expect(parsePlanLine('- [x] [[Chili]] #meal/dinner')?.leftovers).toBe(false);
  });

  it('does not read a longer tag as this one', () => {
    // `#leftovers-friday` is somebody's own tag, not this mark, and `\b` reads
    // it as one because `-` is not a word character.
    expect(parsePlanLine('- [x] [[Chili]] #leftovers-friday')?.leftovers).toBe(false);
    expect(parsePlanLine('- [x] [[Chili]] #leftovers/monday')?.leftovers).toBe(false);
    expect(parsePlanLine('- [x] [[Chili]] #leftovers_2')?.leftovers).toBe(false);
    // And still reads the mark where it really is one.
    expect(parsePlanLine('- [x] [[Chili]] #leftovers [note:: x]')?.leftovers).toBe(true);
  });

  it('takes the mark out without taking its neighbours', () => {
    // CULItrail rewrites the tail of a line in place and needs to remove exactly
    // what this file writes.
    expect(stripLeftoversTag('#meal/dinner [rating:: 4] #leftovers [note:: x]')).toBe(
      '#meal/dinner [rating:: 4] [note:: x]'
    );
    expect(stripLeftoversTag('#leftovers-friday')).toBe('#leftovers-friday');
    expect(hasLeftoversTag('#leftovers')).toBe(true);
  });

  it('writes it after the rating, where CULItrail writes it', () => {
    // The two write the same line, or a note edited from both ends has its
    // tokens shuffled on every save.
    const entry = planEntry('Chili', { slot: 'dinner', rating: 4, leftovers: true, note: 'half' });

    expect(renderPlanLine(entry)).toBe(
      `- [x] [[Chili]] #meal/dinner [rating:: 4] #${LEFTOVERS_TAG} [note:: half]`
    );
  });

  it('survives a rewrite that says nothing about it', () => {
    // The failure this closes: rating a leftovers meal used to un-mark it.
    const line = '- [ ] [[Chili]] #meal/dinner #leftovers';
    const entry = parsePlanLine(line);
    expect(renderPlanLine({ ...entry!, eaten: true, rating: 5 })).toContain('#leftovers');
  });

  it('is absent by default, rather than something a caller has to say no to', () => {
    expect(planEntry('Chili').leftovers).toBe(false);
    expect(renderPlanLine(planEntry('Chili'))).not.toContain('#');
  });
});

describe('the queue', () => {
  const NOTE = `# Meal Plan

## Meal Plan Queue
- [ ] [[Chili]] <!--culi-id:q1-->

## Wednesday
- [x] [[Frittata]] #meal/dinner <!--culi-id:w1-->
`;

  it('accepts the spellings a note may already use', () => {
    expect(['Meal Plan Queue', 'queue', 'Unscheduled', ' QUEUE '].map(isQueueHeading)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isQueueHeading('Monday')).toBe(false);
    expect(slotOfHeading('unscheduled')).toBe('queue');
    expect(slotOfHeading('Monday')).toBe('Monday');
    expect(slotOfHeading('Shopping')).toBeNull();
  });

  it('is read on its own, because a queued meal has no date', () => {
    // `readPlanNote` promises a date on every entry it returns, and inventing
    // one here would put a meal on a day nobody chose.
    expect(readPlanQueue(NOTE).map((entry) => entry.meal)).toEqual(['Chili']);
    expect(readPlanNote(NOTE, '2026-W33').map((entry) => entry.meal)).toEqual(['Frittata']);
  });

  it('takes a new entry, and puts its section before Monday', () => {
    const { body } = upsertPlanEntry(
      '# Meal Plan\n\n## Monday\n- [x] [[X]]\n',
      'queue',
      planEntry('Chili', { eaten: false })
    );
    const headings = body.split('\n').filter((line) => line.startsWith('## '));

    expect(headings).toEqual(['## Meal Plan Queue', '## Monday']);
    expect(readPlanQueue(body).map((entry) => entry.meal)).toEqual(['Chili']);
  });

  it('replaces in place there, like any other section', () => {
    const { body, replaced } = upsertPlanEntry(
      NOTE,
      'queue',
      planEntry('Chili al forno', { eaten: false, id: 'q1' })
    );

    expect(replaced).toBe(true);
    expect(readPlanQueue(body).map((entry) => entry.meal)).toEqual(['Chili al forno']);
  });

  it('contributes nothing to the week, before and after', () => {
    expect(readPlanNote(NOTE, '2026-W33')).toHaveLength(1);
  });
});

describe('moving an entry between slots', () => {
  const NOTE = `# Meal Plan

## Meal Plan Queue
- [ ] [[Chili]] [portion:: ½] <!--culi-id:q1-->

## Wednesday
- [x] [[Frittata]] #meal/dinner <!--culi-id:w1-->
`;

  it('carries the line across rather than re-rendering it', () => {
    // `[portion:: ½]` is not something this module models, and moving a meal is
    // no reason to lose it.
    const { body, moved } = movePlanEntry(NOTE, 'q1', 'Wednesday');

    expect(moved).toBe(true);
    expect(body).toContain('- [ ] [[Chili]] [portion:: ½] <!--culi-id:q1-->');
    expect(readPlanQueue(body)).toEqual([]);
    expect(readPlanNote(body, '2026-W33').map((entry) => entry.meal)).toEqual([
      'Frittata',
      'Chili',
    ]);
  });

  it('goes back to the queue as easily as it left', () => {
    const { body } = movePlanEntry(NOTE, 'w1', 'queue');

    expect(readPlanQueue(body).map((entry) => entry.meal)).toEqual(['Chili', 'Frittata']);
    expect(readPlanNote(body, '2026-W33')).toEqual([]);
  });

  it('builds the section it is moving into when the note has none', () => {
    const { body } = movePlanEntry(NOTE, 'q1', 'Friday');

    expect(body.split('\n').filter((line) => line.startsWith('## '))).toEqual([
      '## Meal Plan Queue',
      '## Wednesday',
      '## Friday',
    ]);
  });

  it('says nothing and changes nothing when it is already there', () => {
    expect(movePlanEntry(NOTE, 'w1', 'Wednesday')).toEqual({ body: NOTE, moved: false });
    expect(movePlanEntry(NOTE, 'nonesuch', 'Friday')).toEqual({ body: NOTE, moved: false });
  });

  it('leaves the heading behind when it empties a section', () => {
    // The note's shape is somebody's, not this function's to tidy.
    const { body } = movePlanEntry(NOTE, 'w1', 'queue');
    expect(body).toContain('## Wednesday');
  });
});

describe('clearing entries', () => {
  const NOTE = `# Meal Plan

## Monday
- [x] [[Frittata]] #meal/dinner [rating:: 5]
- [ ] [[Chili]]
Shopping: paprika

## Tuesday
- [ ] [[Lasagne]]
`;

  it('takes out only what it is asked for', () => {
    const { body, removed } = clearPlanEntries(NOTE, (entry) => !entry.eaten);

    expect(removed).toBe(2);
    expect(body).toContain('[[Frittata]]');
    expect(body).not.toContain('[[Chili]]');
    expect(body).not.toContain('[[Lasagne]]');
  });

  it('never touches a line that is not an entry', () => {
    // A heading, a blank, and a reminder somebody typed under Monday.
    const { body } = clearPlanEntries(NOTE, () => true);

    expect(body).toContain('## Monday');
    expect(body).toContain('## Tuesday');
    expect(body).toContain('Shopping: paprika');
    expect(readPlanNote(body, '2026-W33')).toEqual([]);
  });

  it('returns the body it was given when it removes nothing', () => {
    expect(clearPlanEntries(NOTE, () => false)).toEqual({ body: NOTE, removed: 0 });
  });
});

describe('giving a line an identity it never had', () => {
  // Every one of the 444 plan lines in the vault this was built against carries
  // no id, so a writer that could only address a line by an id it already had
  // could address none of them.
  const NOTE = '# Meal Plan\n\n## Monday\n- [x] [[Chili]] #meal/dinner\n';

  it('replaces the line it found and leaves it findable', () => {
    const entry = planEntry('Chili', { slot: 'dinner', rating: 4, id: 'mp-new' });
    const { body, replaced } = upsertPlanEntry(NOTE, 'Monday', entry, null);

    expect(replaced).toBe(true);
    expect(readPlanNote(body, '2026-W33')).toHaveLength(1);
    expect(readPlanNote(body, '2026-W33')[0]).toMatchObject({ rating: 4, id: 'mp-new' });
  });

  it('defaults to the entry\u2019s own id, so nothing else changes shape', () => {
    // The three-argument call is every existing caller, and it behaves as it did.
    const entry = planEntry('Chili', { slot: 'dinner', rating: 4 });
    expect(upsertPlanEntry(NOTE, 'Monday', entry).replaced).toBe(true);

    const withId = planEntry('Chili', { slot: 'dinner', id: 'mp-new' });
    expect(upsertPlanEntry(NOTE, 'Monday', withId).replaced).toBe(false);
  });

  it('does not adopt a line that already answers to something else', () => {
    const owned = '# Meal Plan\n\n## Monday\n- [x] [[Chili]] <!--culi-id:old-->\n';
    expect(upsertPlanEntry(owned, 'Monday', planEntry('Chili', { id: 'new' }), null).replaced).toBe(
      false
    );
  });
});
