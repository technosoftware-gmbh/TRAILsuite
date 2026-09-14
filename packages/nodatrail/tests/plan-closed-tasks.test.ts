/**
 * Which task rows a period's list draws, and in what order.
 *
 * The drawing has no test -- this suite has no DOM -- so what is pinned here is
 * the decision underneath it: a task that has been ticked is still part of the
 * day it was planned for, and it stays where it was rather than moving to the
 * day somebody got round to it.
 *
 * That is the seam worth holding. Placing a closed task by its done date is the
 * plausible reading, it is wrong, and nothing about the markup would say so: the
 * day it was planned into would quietly lose a row and another day would gain
 * one it was never asked to hold.
 */
import { describe, expect, it } from 'vitest';
import { parseTaskLine, type ParsedTask } from '@technosoftware/trail-core';
import { closedTasksInPeriod, periodTaskRows, tasksInPeriod } from '../src/plan/rollup';

const MONDAY = { from: '2026-09-07', to: '2026-09-07' };
const WEEK = { from: '2026-09-07', to: '2026-09-13' };

const parse = (line: string): ParsedTask => parseTaskLine(line);

/** Planned for Monday, ticked on Wednesday. The case the whole thing turns on. */
const LATE = parse('- [x] Rechnung zahlen ⏳ 2026-09-07 ✅ 2026-09-09');
const OPEN = parse('- [ ] Angebot schreiben ⏳ 2026-09-07');
const CANCELLED = parse('- [-] Termin absagen ⏳ 2026-09-07 ❌ 2026-09-07');
const UNDATED = parse('- [x] Irgendwann ✅ 2026-09-07');

describe('closedTasksInPeriod', () => {
  it('keeps a finished task on the day it was planned for, not the day it was ticked', () => {
    expect(closedTasksInPeriod([LATE], MONDAY)).toEqual([LATE]);
    expect(closedTasksInPeriod([LATE], { from: '2026-09-09', to: '2026-09-09' })).toEqual([]);
  });

  it('counts cancelled with done', () => {
    // A day cleared by calling something off is not a day that was empty.
    expect(closedTasksInPeriod([CANCELLED], MONDAY)).toEqual([CANCELLED]);
  });

  it('leaves open tasks to tasksInPeriod', () => {
    expect(closedTasksInPeriod([OPEN], MONDAY)).toEqual([]);
    expect(tasksInPeriod([LATE, CANCELLED], MONDAY)).toEqual([]);
  });

  it('places nothing that states no day, whatever its done date says', () => {
    // The done date is not a planning date, and treating it as one here would
    // be the same mistake as the first test, reached from the other side.
    expect(closedTasksInPeriod([UNDATED], MONDAY)).toEqual([]);
  });
});

describe('periodTaskRows', () => {
  it('draws only open tasks unless asked for the rest', () => {
    expect(periodTaskRows([OPEN, LATE, CANCELLED], MONDAY)).toEqual([OPEN]);
  });

  it('adds the closed ones when asked', () => {
    expect(periodTaskRows([OPEN, LATE, CANCELLED], MONDAY, true)).toHaveLength(3);
  });

  it('sorts the closed ones in among the open ones rather than after them', () => {
    // The point of showing them at all: a finished task belongs beside what was
    // planned around it, the way a declined meeting stays in its own time slot.
    const early = parse('- [x] Früh ⏳ 2026-09-07 ✅ 2026-09-07');
    const late = parse('- [ ] Spät ⏳ 2026-09-11');
    const rows = periodTaskRows([late, early], WEEK, true);
    expect(rows.map((task) => task.text)).toEqual(['Früh', 'Spät']);
  });

  it('does not disturb the list it was given', () => {
    // The plan view hands it the same array it hands the calendar and the
    // deadlines, so a sort in place here would reorder somebody else's list.
    const tasks = [parse('- [ ] Spät ⏳ 2026-09-11'), OPEN];
    const before = [...tasks];
    periodTaskRows(tasks, WEEK, true);
    expect(tasks).toEqual(before);
  });
});
