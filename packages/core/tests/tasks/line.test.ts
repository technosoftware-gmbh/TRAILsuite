import { describe, expect, it } from 'vitest';
import {
  completeTaskLine,
  parseTaskLine,
  reopenTaskLine,
  setTaskStatus,
} from '../../src/tasks/line.js';

const TODAY = new Date(2026, 7, 22);

describe('what counts as a task line', () => {
  it('reads the plain case', () => {
    const task = parseTaskLine('- [ ] Steuererklärung einreichen');
    expect(task?.status).toBe('todo');
    expect(task?.text).toBe('Steuererklärung einreichen');
  });

  it('reads every checkbox character', () => {
    expect(parseTaskLine('- [x] done')?.status).toBe('done');
    expect(parseTaskLine('- [X] done')?.status).toBe('done');
    expect(parseTaskLine('- [/] half')?.status).toBe('inProgress');
    expect(parseTaskLine('- [-] gone')?.status).toBe('cancelled');
  });

  it('reads an unknown character as outstanding, and keeps it', () => {
    const task = parseTaskLine('- [?] maybe');
    expect(task?.status).toBe('todo');
    expect(task?.statusChar).toBe('?');
  });

  it('reads the other list markers and keeps the indent', () => {
    expect(parseTaskLine('* [ ] star')?.marker).toBe('*');
    expect(parseTaskLine('+ [ ] plus')?.marker).toBe('+');
    expect(parseTaskLine('1. [ ] numbered')?.marker).toBe('1.');
    expect(parseTaskLine('    - [ ] nested')?.indent).toBe('    ');
  });

  it('refuses a bullet that is not a checkbox', () => {
    expect(parseTaskLine('- just a bullet')).toBeNull();
    expect(parseTaskLine('# a heading')).toBeNull();
    expect(parseTaskLine('')).toBeNull();
  });
});

describe('the fields on a line', () => {
  // Tags and links sit in the description, which is where the Tasks plugin
  // puts them and where they have to be for a recurrence rule to end at the
  // end of the line rather than swallowing them.
  const line =
    '- [ ] Prämie zahlen #finanzen [[Baloise]] 🔺 ➕ 2026-08-01 🛫 2026-08-20 ⏳ 2026-08-25 📅 2026-08-31 🔁 every month';
  const task = parseTaskLine(line)!;

  it('reads the priority', () => {
    expect(task.priority).toBe('highest');
  });

  it('reads all four planning dates', () => {
    expect(task.created).toBe('2026-08-01');
    expect(task.start).toBe('2026-08-20');
    expect(task.scheduled).toBe('2026-08-25');
    expect(task.due).toBe('2026-08-31');
  });

  it('keeps the recurrence rule as written rather than interpreting it', () => {
    expect(task.recurrence).toBe('every month');
  });

  it('reads tags and links', () => {
    expect(task.tags).toEqual(['finanzen']);
    expect(task.links).toEqual(['Baloise']);
  });

  it('strips the fields off the description but keeps the tag and the link', () => {
    // They are part of what the task says, not metadata about it.
    expect(task.text).toBe('Prämie zahlen #finanzen [[Baloise]]');
  });

  it('reports the stronger claim when two priority markers are on one line', () => {
    expect(parseTaskLine('- [ ] x 🔽 🔺')?.priority).toBe('highest');
  });

  it('ignores a marker with no date after it', () => {
    expect(parseTaskLine('- [ ] x 📅 soon')?.due).toBeNull();
  });
});

describe('editing a line', () => {
  it('ticks the box and stamps the day', () => {
    const task = parseTaskLine('- [ ] Dias sortieren')!;
    expect(completeTaskLine(task, TODAY)).toBe('- [x] Dias sortieren ✅ 2026-08-22');
  });

  it('leaves an existing done date alone', () => {
    const task = parseTaskLine('- [ ] Dias sortieren ✅ 2026-06-19')!;
    expect(completeTaskLine(task, TODAY)).toBe('- [x] Dias sortieren ✅ 2026-06-19');
  });

  it('unticks and takes the done date off again', () => {
    const task = parseTaskLine('- [x] Dias sortieren ✅ 2026-06-19')!;
    expect(reopenTaskLine(task)).toBe('- [ ] Dias sortieren');
  });

  it('preserves everything else on the line byte for byte', () => {
    const raw = '   * [ ]  Prämie   zahlen #finanzen [[Baloise]] 🔺 📅 2026-08-31 🔁 every month';
    const task = parseTaskLine(raw)!;
    const done = completeTaskLine(task, TODAY);

    // Only the bracket changes, and the done date is appended. The doubled
    // spaces, the marker order and the trailing rule all survive untouched.
    expect(done).toBe(`${raw.replace('[ ]', '[x]')} ✅ 2026-08-22`);
  });

  it('cancels with a cancelled date and swaps it out again on completion', () => {
    const task = parseTaskLine('- [ ] Umzug planen')!;
    const cancelled = setTaskStatus(task, 'cancelled', TODAY);
    expect(cancelled).toBe('- [-] Umzug planen ❌ 2026-08-22');

    const reparsed = parseTaskLine(cancelled)!;
    expect(setTaskStatus(reparsed, 'done', TODAY)).toBe('- [x] Umzug planen ✅ 2026-08-22');
  });

  it('drops the cancelled date when a task is reopened', () => {
    const task = parseTaskLine('- [-] Umzug planen ❌ 2026-08-22')!;
    expect(reopenTaskLine(task)).toBe('- [ ] Umzug planen');
  });

  it('round-trips a line it does not change', () => {
    const raw = '- [ ] nothing to do here';
    const task = parseTaskLine(raw)!;
    expect(setTaskStatus(task, 'todo', TODAY)).toBe(raw);
  });
});
