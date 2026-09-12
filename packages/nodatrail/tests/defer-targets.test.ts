/**
 * Which days the move menu offers.
 *
 * Two rules, and both are about not producing a no-op that looks like a
 * failure.
 *
 * **Today is never offered.** Deferring something to the day it is already on
 * is not a thing anybody means, and a menu entry that writes the same date back
 * would report success and change nothing.
 *
 * **The week's days come from the week on screen, not the week containing
 * today.** A review of next week is done from next week, and offering this
 * week's days there would file everything in the past.
 *
 * Every entry is a concrete date rather than a phrase, worked out once here, so
 * a Monday and a Sunday cannot disagree about what "next week" meant.
 */
import { describe, expect, it } from 'vitest';
import { formatDayTitle } from '@technosoftware/trail-core';
import { deferTargets } from '../src/plan/defer-menu';

/** Friday 28 August 2026. */
const TODAY = new Date(2026, 7, 28);
const days = (level: 'day' | 'week', anchor: Date, today = TODAY) =>
  deferTargets(level, anchor, today).map(formatDayTitle);

describe('from a day', () => {
  it('offers tomorrow and the start of next week', () => {
    expect(days('day', TODAY)).toEqual(['2026-08-29', '2026-08-31']);
  });

  it('never offers today', () => {
    expect(days('day', TODAY)).not.toContain(formatDayTitle(TODAY));
  });

  it('offers Monday when today is a Sunday, not the day itself', () => {
    // Sunday 30 August: tomorrow and next Monday are the same day, and the
    // menu must show it once.
    const sunday = new Date(2026, 7, 30);
    expect(days('day', sunday, sunday)).toEqual(['2026-08-31']);
  });
});

describe('from a week', () => {
  it('offers the seven days of the week on screen', () => {
    // The week of 31 August, viewed from Friday 28 August.
    const nextWeek = new Date(2026, 8, 2);
    const offered = days('week', nextWeek);
    expect(offered).toContain('2026-08-31');
    expect(offered).toContain('2026-09-06');
    expect(offered.filter((day) => day >= '2026-08-31' && day <= '2026-09-06')).toHaveLength(7);
  });

  it('takes the days from the week shown, not the week containing today', () => {
    // Viewing a week in October from August must not offer August's days.
    const october = new Date(2026, 9, 7);
    const offered = days('week', october);
    expect(offered).toContain('2026-10-05');
    expect(offered).toContain('2026-10-11');
  });

  it('lists each day once, even where the quick steps land inside the week', () => {
    // Tomorrow and next Monday both fall in the week on screen here, and the
    // menu must not show either twice.
    const thisWeek = new Date(2026, 7, 28);
    const offered = days('week', thisWeek);
    expect(new Set(offered).size).toBe(offered.length);
    expect(offered).not.toContain(formatDayTitle(TODAY));
  });

  it('still leads with the two quick steps', () => {
    const offered = days('week', new Date(2026, 8, 2));
    expect(offered[0]).toBe('2026-08-29');
    expect(offered[1]).toBe('2026-08-31');
  });
});

describe('the periods offered, which set a deadline rather than a plan', () => {
  it('offers this week and this month as well as the next ones', async () => {
    const { periodTargets } = await import('../src/plan/defer-menu');
    const offered = periodTargets(TODAY).map((target) => target.level);
    expect(offered).toEqual(['week', 'week', 'month', 'month']);
  });

  it('does not offer a period that ends today or earlier', async () => {
    // Sunday 30 August: this week ends today, and a deadline of today is what
    // somebody pushing a task away was moving off.
    const { periodTargets } = await import('../src/plan/defer-menu');
    const sunday = new Date(2026, 7, 30);
    const weeks = periodTargets(sunday).filter((target) => target.level === 'week');
    expect(weeks).toHaveLength(1);
  });

  it('drops this month on its last day, and keeps next month', async () => {
    const { periodTargets } = await import('../src/plan/defer-menu');
    const lastDay = new Date(2026, 7, 31);
    const months = periodTargets(lastDay).filter((target) => target.level === 'month');
    expect(months).toHaveLength(1);
  });
});
