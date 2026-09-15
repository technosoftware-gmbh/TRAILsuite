/**
 * What a task row says beside its text, in the four lists that draw one.
 *
 * Pinned because both halves failed silently on screen: a day note's name put
 * an ISO date beside a localized one, and a task's priority was read and never
 * drawn. See src/ui/kit/task-row.ts.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setDisplayLocale } from '../src/ui/kit/format';
import { taskPriorityChip, taskSourceLabel } from '../src/ui/kit/task-row';
import { periodName } from '../src/plan/labels';

afterEach(() => setDisplayLocale(''));

describe('taskSourceLabel', () => {
  it('drops a day note that names the day the row already shows', () => {
    expect(taskSourceLabel('2026-09-15', '2026-09-15')).toBeUndefined();
  });

  it('draws another day note as a date in the display locale', () => {
    setDisplayLocale('de-CH');
    expect(taskSourceLabel('2026-09-14', '2026-09-15')).toBe('14. September 2026');
    expect(taskSourceLabel('2026-09-14', null)).toBe('14. September 2026');
  });

  it('keeps any other note name as written', () => {
    expect(taskSourceLabel('Umzug Bern', '2026-09-15')).toBe('Umzug Bern');
    expect(taskSourceLabel('2026-W38', '2026-09-15')).toBe('2026-W38');
  });
});

describe('taskPriorityChip', () => {
  it('says nothing for a task that states no priority', () => {
    expect(taskPriorityChip(null)).toBeNull();
  });

  it('names the level and warns only for the urgent two', () => {
    expect(taskPriorityChip('highest')).toEqual({ text: 'Critical', tone: 'warn' });
    expect(taskPriorityChip('high')).toEqual({ text: 'High', tone: 'warn' });
    expect(taskPriorityChip('medium')).toEqual({ text: 'Medium', tone: undefined });
    expect(taskPriorityChip('low')).toEqual({ text: 'Low', tone: 'muted' });
    expect(taskPriorityChip('lowest')).toEqual({ text: 'Low', tone: 'muted' });
  });
});

describe('periodName', () => {
  it('draws a day in the same form as the dates in the list below it', () => {
    setDisplayLocale('de-CH');
    expect(periodName('day', new Date(2026, 8, 15))).toBe('15. September 2026');
    setDisplayLocale('en-US');
    expect(periodName('day', new Date(2026, 8, 15))).toBe('September 15, 2026');
  });
});
