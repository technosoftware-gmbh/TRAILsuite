/**
 * Reading a plan note nobody has converted yet.
 *
 * This is the bridge, and the reason it gets its own suite is that it runs
 * exactly once per note and then never again. A converter that misreads a week
 * does not fail loudly; it writes a smaller week and the missing meals look
 * like meals nobody planned. Every rule here is one the conversion depends on
 * being right the first time.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { bodyWithoutPlan, planEntriesFromBody } from '../src/planning/meal-plan/legacy-body';

const settings = mergeSettings({});

const note = [
  '# Meal Plan',
  '',
  '## Meal Plan Queue',
  '- [ ] Leftovers',
  '## Tuesday',
  '- [x] [[Beef Stroganoff mit Spätzli]] [rating:: 5] [time:: 11:40] <!--culi-id:ch-msyv7xe0-->',
  '## Wednesday',
  '- [ ] [[Grüne Casarecce mit Poulet]] #meal/dinner #leftovers',
].join('\n');

describe('the entries a checklist holds', () => {
  const entries = planEntriesFromBody(note, settings);

  it('reads a ticked line as an eaten entry, with everything the line carried', () => {
    expect(entries[1]).toEqual({
      id: 'ch-msyv7xe0',
      mealTitle: 'Beef Stroganoff mit Spätzli',
      label: null,
      day: 'tuesday',
      slot: null,
      eaten: true,
      rating: 5,
      time: '11:40',
      note: null,
      isLeftovers: false,
    });
  });

  it('reads the slot and the leftovers mark off an unticked one', () => {
    expect(entries[2]).toMatchObject({
      mealTitle: 'Grüne Casarecce mit Poulet',
      day: 'wednesday',
      slot: 'dinner',
      eaten: false,
      isLeftovers: true,
    });
  });

  it('reads a line naming no meal note as a label, in the queue', () => {
    expect(entries[0]).toMatchObject({ mealTitle: null, label: 'Leftovers', day: null });
  });

  it('leaves the id empty for the lines that never carried one', () => {
    // Most of them. The marker was only ever written by whatever recorded a
    // meal eaten, so whoever writes the note next mints the rest.
    expect(entries[0].id).toBe('');
    expect(entries[2].id).toBe('');
  });

  it('reads a written zero as eaten and unrated', () => {
    const [read] = planEntriesFromBody('## Monday\n- [x] [[Pizza]] [rating:: 0]', settings);
    expect(read).toMatchObject({ eaten: true, rating: null });
  });

  it('reads a slot in any of the three notations, whatever the note used', () => {
    const body = [
      '## Monday',
      '- [ ] [[A]] #meal/lunch',
      '- [ ] [[B]] [meal:: dinner]',
      '- [ ] [[C]] (breakfast)',
    ].join('\n');

    expect(planEntriesFromBody(body, settings).map((entry) => entry.slot)).toEqual([
      'lunch',
      'dinner',
      'breakfast',
    ]);
  });
});

describe('what is left of the body', () => {
  it('keeps nothing when the note was only a plan', () => {
    expect(bodyWithoutPlan(note, settings)).toBe('');
  });

  it('keeps a hand-written line, which is the promise the old format made', () => {
    const body = ['# Meal Plan', '## Tuesday', '- [ ] [[Pizza]]', 'Buy bread on the way home'].join(
      '\n'
    );

    expect(bodyWithoutPlan(body, settings)).toBe('Buy bread on the way home');
  });

  it("keeps a section of somebody's own, heading and all", () => {
    const body = ['## Tuesday', '- [ ] [[Pizza]]', '## Shopping', '- Bread', '- Milk'].join('\n');

    expect(bodyWithoutPlan(body, settings)).toBe('## Shopping\n- Bread\n- Milk');
  });

  it('drops the title, and only while it is still the title', () => {
    const body = ['# Meal Plan', '', 'Something.', '# Meal Plan', 'More.'].join('\n');
    expect(bodyWithoutPlan(body, settings)).toBe('Something.\n# Meal Plan\nMore.');
  });
});
