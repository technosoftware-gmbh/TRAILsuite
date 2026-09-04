/**
 * The two writes behind the Move menu, and why there are two.
 *
 * A deadline and a plan are different facts. `📅` is when a task must be
 * finished; `⏳` is the day somebody decided to do it. Choosing a day in the
 * menu sets the plan, choosing a period sets the deadline and clears the plan.
 *
 * **That is what lets a deadline survive being replanned.** A task that must be
 * done this week is due Sunday; pulling it onto Tuesday and then onto Thursday
 * changes only the plan, and Sunday is still the limit. With one date, the
 * first move would have overwritten it and nothing would remember.
 *
 * Source tests: both writes go through `replaceTaskLine`, and checking that
 * against a real vault is what the smoke suite is for.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { endOfPeriod, parseTaskLine, setTaskDate, placingField } from 'trail-core';

const source = readFileSync(join(__dirname, '..', 'src', 'tasks', 'write-tasks.ts'), 'utf8');
const parse = (line: string) => parseTaskLine(line);

describe('planning a day', () => {
  it('sets the plan and never the deadline', () => {
    expect(source).toMatch(/export async function planTask/);
    expect(source).toContain("setTaskDate(task, 'scheduled', day)");
    // The one thing it must never do.
    const fn = source.slice(source.indexOf('export async function planTask'));
    expect(fn.slice(0, fn.indexOf('}'))).not.toContain("'due'");
  });

  it('leaves a deadline where it was', () => {
    const task = parse('- [ ] Zooplus Bestellung 📅 2026-08-30');
    const planned = parse(setTaskDate(task, 'scheduled', new Date(2026, 7, 25)));
    expect(planned.due).toBe('2026-08-30');
    expect(planned.scheduled).toBe('2026-08-25');
    // And the plan is what now places it.
    expect(placingField(planned)).toBe('scheduled');
  });

  it('can be done twice without touching the deadline either time', () => {
    let task = parse('- [ ] x 📅 2026-08-30');
    for (const day of [new Date(2026, 7, 25), new Date(2026, 7, 27)]) {
      task = parse(setTaskDate(task, 'scheduled', day));
    }
    expect(task.due).toBe('2026-08-30');
    expect(task.scheduled).toBe('2026-08-27');
  });
});

describe('pushing to a period', () => {
  it('sets the deadline to the last day, not the first', () => {
    // A period used as a deadline says finished BY Sunday, not started Monday.
    const week = endOfPeriod('week', new Date(2026, 7, 26));
    const task = parse('- [ ] x');
    expect(parse(setTaskDate(task, 'due', week)).due).toBe('2026-08-30');
  });

  it('clears the plan, because no day has been chosen any more', () => {
    // Leaving it would keep the task sitting on the day somebody has just said
    // they cannot do it on -- the plan is what places it.
    const task = parse('- [ ] x ⏳ 2026-08-25 📅 2026-08-30');
    const dated = parse(setTaskDate(task, 'due', endOfPeriod('week', new Date(2026, 8, 2))));
    const cleared = parse(setTaskDate(dated, 'scheduled', null));
    expect(cleared.scheduled).toBeNull();
    expect(cleared.due).toBe('2026-09-06');
    expect(placingField(cleared)).toBe('due');
  });

  it('is written that way in the module, and re-parses between the two edits', () => {
    // `setTaskDate` works from `raw`, so the second edit has to be made against
    // the line the first one produced rather than against the original.
    const fn = source.slice(source.indexOf('export async function deferToPeriod'));
    expect(fn).toContain("setTaskDate(task, 'due', endOfPeriod(level, date))");
    expect(fn).toContain('const parsed = parseTaskLine(dated)');
    expect(fn).toContain("setTaskDate(parsed, 'scheduled', null)");
  });
});

describe('both writes', () => {
  it('go through one read, replace, write, stamp', () => {
    // Three copies of that sequence would eventually disagree about the
    // refuse-when-the-note-moved rule, which is the part that protects a note
    // edited in another tab.
    expect(source).toMatch(/async function write\(/);
    expect((source.match(/replaceTaskLine\(/g) ?? []).length).toBe(1);
    expect((source.match(/host\.vault\.modify\(/g) ?? []).length).toBe(1);
  });
});
