/**
 * Which day a "mark paid" prompt should start at.
 *
 * Small, and worth a test for the reason the whole finance module is careful
 * about dates: the day a bill was paid decides which month's budget it lands
 * in, and a prompt that starts at the wrong day is a prompt most people accept.
 */
import { describe, expect, it } from 'vitest';
import { likelyPaidDate } from '../src/finance/edit-finance';

const TODAY = new Date(2026, 7, 22);

describe('likelyPaidDate', () => {
  it('starts at the due date, which is when a standing order pays', () => {
    expect(likelyPaidDate({ dueDate: '2026-08-31', issueDate: '2026-07-01' }, TODAY)).toBe(
      '2026-08-31'
    );
  });

  it('falls back to the issue date rather than to today', () => {
    // A bill with no due date is still a bill from a particular month, and
    // today is whenever somebody got round to recording it.
    expect(likelyPaidDate({ dueDate: null, issueDate: '2026-07-01' }, TODAY)).toBe('2026-07-01');
  });

  it('falls back to today only when the bill names no day at all', () => {
    expect(likelyPaidDate({ dueDate: null, issueDate: null }, TODAY)).toBe('2026-08-22');
  });
});
