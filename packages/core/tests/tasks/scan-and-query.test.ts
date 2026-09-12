import { describe, expect, it } from 'vitest';
import { replaceTaskLine, scanTasks } from '../../src/tasks/scan.js';
import {
  byUrgency,
  countTasks,
  isDueWithin,
  isInPeriod,
  isOpen,
  isOverdue,
  priorityRank,
} from '../../src/tasks/query.js';
import { parseTaskLine } from '../../src/tasks/line.js';

const TODAY = new Date(2026, 7, 22);

const NOTE = [
  '# Projekt',
  '',
  '- [ ] erste Aufgabe 📅 2026-08-01',
  '- [x] zweite Aufgabe ✅ 2026-08-10',
  '',
  '```',
  '- [ ] not a task, this is a sample',
  '```',
  '',
  '    - [ ] dritte Aufgabe',
].join('\n');

describe('scanTasks', () => {
  it('finds the checkbox lines and where they are', () => {
    const tasks = scanTasks(NOTE);
    expect(tasks.map((task) => task.line)).toEqual([2, 3, 9]);
  });

  it('skips a fenced block, because a sample is not an agenda', () => {
    expect(scanTasks(NOTE).some((task) => task.text.includes('sample'))).toBe(false);
  });

  it('closes the fence again, so what follows is scanned', () => {
    expect(scanTasks(NOTE).some((task) => task.text === 'dritte Aufgabe')).toBe(true);
  });

  it('finds nothing in a note with no checkboxes', () => {
    expect(scanTasks('# Heading\n\nSome prose.')).toEqual([]);
  });
});

describe('replaceTaskLine', () => {
  it('replaces the line it was told to', () => {
    const task = scanTasks(NOTE)[0]!;
    const next = replaceTaskLine(NOTE, task, '- [x] erste Aufgabe ✅ 2026-08-22');
    expect(next.split('\n')[2]).toBe('- [x] erste Aufgabe ✅ 2026-08-22');
  });

  it('refuses when the note has moved on under it', () => {
    const task = scanTasks(NOTE)[0]!;
    const edited = NOTE.replace('- [ ] erste Aufgabe 📅 2026-08-01', '- [ ] umbenannt');
    // The view holding this task scanned a moment ago and another tab has
    // edited the note since. Writing here would clobber that edit.
    expect(replaceTaskLine(edited, task, 'anything')).toBe(edited);
  });

  it('ticks only one of two identical lines', () => {
    const text = '- [ ] gleich\n- [ ] gleich';
    const second = scanTasks(text)[1]!;
    expect(replaceTaskLine(text, second, '- [x] gleich')).toBe('- [ ] gleich\n- [x] gleich');
  });
});

describe('the questions', () => {
  it('counts in-progress as open and cancelled as neither open nor done', () => {
    expect(isOpen({ status: 'todo' })).toBe(true);
    expect(isOpen({ status: 'inProgress' })).toBe(true);
    expect(isOpen({ status: 'done' })).toBe(false);
    expect(isOpen({ status: 'cancelled' })).toBe(false);
  });

  it('calls an open task past its day overdue', () => {
    expect(isOverdue({ status: 'todo', due: '2026-08-21' }, TODAY)).toBe(true);
    expect(isOverdue({ status: 'todo', due: '2026-08-22' }, TODAY)).toBe(false);
    expect(isOverdue({ status: 'done', due: '2026-08-01' }, TODAY)).toBe(false);
  });

  it('never calls an undated task overdue', () => {
    expect(isOverdue({ status: 'todo', due: null }, TODAY)).toBe(false);
  });

  it('reads a horizon of zero days as today', () => {
    expect(isDueWithin({ status: 'todo', due: '2026-08-22' }, TODAY, 0)).toBe(true);
    expect(isDueWithin({ status: 'todo', due: '2026-08-23' }, TODAY, 0)).toBe(false);
    expect(isDueWithin({ status: 'todo', due: '2026-08-23' }, TODAY, 1)).toBe(true);
  });

  it('does not call an overdue task due within the horizon', () => {
    expect(isDueWithin({ status: 'todo', due: '2026-08-01' }, TODAY, 7)).toBe(false);
  });

  it('falls back to the due day when a task has no plan', () => {
    expect(
      isInPeriod({ status: 'todo', due: '2026-08-15', scheduled: null }, '2026-08-01', '2026-08-31')
    ).toBe(true);
  });

  it('shows a task where it is planned, not where it is due', () => {
    // The rule that lets a deadline survive being replanned: a task due in
    // September but planned for August is August's work, and September is when
    // it becomes late rather than where it is listed.
    expect(
      isInPeriod(
        { status: 'todo', due: '2026-09-02', scheduled: '2026-08-15' },
        '2026-08-01',
        '2026-08-31'
      )
    ).toBe(true);
    expect(
      isInPeriod(
        { status: 'todo', due: '2026-09-02', scheduled: '2026-08-15' },
        '2026-09-01',
        '2026-09-30'
      )
    ).toBe(false);
  });

  it('sorts an unstated priority below low', () => {
    expect(priorityRank('lowest')).toBeGreaterThan(priorityRank('low'));
    expect(priorityRank(null)).toBeGreaterThan(priorityRank('lowest'));
  });

  it('reads soonest first, then priority, then alphabetically', () => {
    const tasks = [
      '- [ ] später 📅 2026-09-01',
      '- [ ] undatiert',
      '- [ ] bald wichtig 📅 2026-08-23 🔺',
      '- [ ] bald egal 📅 2026-08-23 🔽',
    ].map((line) => parseTaskLine(line)!);

    expect([...tasks].sort(byUrgency).map((task) => task.text)).toEqual([
      'bald wichtig',
      'bald egal',
      'später',
      'undatiert',
    ]);
  });

  it('counts a set the way a rollup row reads it', () => {
    const tasks = [
      '- [ ] offen 📅 2026-08-01',
      '- [x] fertig',
      '- [-] abgebrochen',
      '- [/] laufend',
    ].map((line) => parseTaskLine(line)!);

    expect(countTasks(tasks, TODAY)).toEqual({ total: 4, open: 2, done: 1, overdue: 1 });
  });
});
