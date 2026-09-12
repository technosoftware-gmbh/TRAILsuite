/**
 * Moving a task's date, and the rule that decides which date to move.
 *
 * Deferring a task has to move **the date that places it**, or the task does
 * not move. That rule already existed inside `isInPeriod` as `due ?? scheduled`
 * and is now `placingField`, written once and used by both, because two
 * expressions of one rule eventually disagree about which date it is -- and the
 * symptom would be a defer button that appears to work and changes nothing.
 *
 * The write is surgical, like every other write in this module. A line carries
 * text, tags, links and emoji this parser has no opinion about, and rebuilding
 * it from the parsed fields would quietly normalise somebody's writing every
 * time they deferred a task.
 */
import { describe, expect, it } from 'vitest';
import { parseTaskLine, setTaskDate } from '../../src/tasks/line.js';
import { isInPeriod, placingDay, placingField } from '../../src/tasks/query.js';

const parse = (line: string) => {
  const task = parseTaskLine(line);
  expect(task).not.toBeNull();
  return task!;
};

const NEXT_WEEK = new Date(2026, 8, 7);

describe('which date places a task', () => {
  it('prefers scheduled over due, so a plan places a task and a deadline does not', () => {
    // `due` is when it must be finished; `scheduled` is the day somebody
    // decided to do it. A task shows where it is planned, and its deadline is
    // what makes it overdue -- which is what lets the deadline survive being
    // replanned.
    const task = parse('- [ ] x ⏳ 2026-08-20 📅 2026-08-31');
    expect(placingField(task)).toBe('scheduled');
    expect(placingDay(task)).toBe('2026-08-20');
  });

  it('falls back to due when nothing has been planned', () => {
    const task = parse('- [ ] x 📅 2026-08-31');
    expect(placingField(task)).toBe('due');
    expect(placingDay(task)).toBe('2026-08-31');
  });

  it('leaves the deadline alone when the plan moves', () => {
    const task = parse('- [ ] x ⏳ 2026-08-20 📅 2026-08-31');
    const replanned = parse(setTaskDate(task, placingField(task) ?? 'due', new Date(2026, 7, 25)));
    expect(replanned.scheduled).toBe('2026-08-25');
    expect(replanned.due).toBe('2026-08-31');
  });

  it('places an undated task nowhere, rather than everywhere', () => {
    const task = parse('- [ ] x');
    expect(placingField(task)).toBeNull();
    expect(isInPeriod(task, '2026-01-01', '2099-12-31')).toBe(false);
  });

  it('agrees with isInPeriod, which is the whole reason it was split out', () => {
    for (const line of [
      '- [ ] x ⏳ 2026-08-20 📅 2026-08-31',
      '- [ ] x ⏳ 2026-08-20',
      '- [ ] x 📅 2026-08-31',
      '- [ ] x',
    ]) {
      const task = parse(line);
      const day = placingDay(task);
      expect(isInPeriod(task, '2026-08-31', '2026-08-31')).toBe(day === '2026-08-31');
    }
  });
});

describe('setting a date', () => {
  it('replaces the date that is there', () => {
    const task = parse('- [ ] Zooplus Bestellung ⏫ 📅 2026-08-28');
    expect(setTaskDate(task, 'due', NEXT_WEEK)).toBe('- [ ] Zooplus Bestellung ⏫ 📅 2026-09-07');
  });

  it('adds one that was not there', () => {
    const task = parse('- [ ] x');
    expect(setTaskDate(task, 'scheduled', NEXT_WEEK)).toBe('- [ ] x ⏳ 2026-09-07');
  });

  it('removes it when given null', () => {
    const task = parse('- [ ] x 📅 2026-08-28');
    expect(setTaskDate(task, 'due', null)).toBe('- [ ] x');
  });

  it('leaves every other field exactly where it was', () => {
    // The point of a surgical edit. A rebuild would reorder these and drop the
    // recurrence, which belongs to the Tasks plugin and not to us.
    const line =
      '- [ ] Steuern #steuern [[Steuern 2025]] 🔺 🔁 every month ⏳ 2026-08-01 📅 2026-08-28';
    const next = setTaskDate(parse(line), 'due', NEXT_WEEK);
    const after = parse(next);
    expect(after.text).toBe('Steuern #steuern [[Steuern 2025]]');
    expect(after.priority).toBe('highest');
    expect(after.recurrence).toBe('every month');
    expect(after.scheduled).toBe('2026-08-01');
    expect(after.due).toBe('2026-09-07');
  });

  it('keeps an indented task indented', () => {
    const task = parse('    - [ ] Nachfassen');
    expect(setTaskDate(task, 'due', NEXT_WEEK)).toBe('    - [ ] Nachfassen 📅 2026-09-07');
  });

  it('does not touch the checkbox, so deferring never completes anything', () => {
    const next = setTaskDate(parse('- [ ] x 📅 2026-08-28'), 'due', NEXT_WEEK);
    expect(parse(next).status).toBe('todo');
    expect(parse(next).done).toBeNull();
  });

  it('moves a task out of one period and into another', () => {
    // The end to end claim, in the terms the plan view actually asks in.
    const task = parse('- [ ] x 📅 2026-08-28');
    expect(isInPeriod(task, '2026-08-24', '2026-08-30')).toBe(true);

    const moved = parse(setTaskDate(task, placingField(task) ?? 'due', NEXT_WEEK));
    expect(isInPeriod(moved, '2026-08-24', '2026-08-30')).toBe(false);
    expect(isInPeriod(moved, '2026-09-07', '2026-09-13')).toBe(true);
  });
});
