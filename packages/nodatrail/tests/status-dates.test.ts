/**
 * What moving a status does to the dates beside it.
 *
 * Five dates are worth keeping on a piece of work: created, deadline, done,
 * closed, archived. Three are the record of a moment the plugin knows -- the
 * day somebody moved the status -- so the status fills them.
 *
 * **Filled, not written.** The field is on the same form, pre-filled with
 * today, and saving commits it. The day of the action and the day of the record
 * routinely differ: a project finished on Friday has its status moved on
 * Monday, and Monday is the wrong answer. Every rule below exists so that
 * correcting it afterwards is not undone by the next status change.
 */
import { describe, expect, it } from 'vitest';
import { datesAfterStatus, dateFieldFor } from '../src/para/status-dates';

const TODAY = '2026-08-29';
const none = { done: null, closed: null };

describe('which date a status is the record of', () => {
  it('maps done and closed, and nothing else', () => {
    expect(dateFieldFor('done')).toBe('done');
    expect(dateFieldFor('closed')).toBe('closed');
    for (const status of [
      'backlog',
      'planned',
      'ongoing',
      'blocked',
      'review',
      'removed',
    ] as const) {
      expect(dateFieldFor(status)).toBeNull();
    }
  });
});

describe('moving into a status that records a day', () => {
  it('fills the date with today', () => {
    expect(datesAfterStatus(none, 'ongoing', 'done', TODAY)).toEqual({
      done: TODAY,
      closed: null,
    });
    expect(datesAfterStatus(none, 'review', 'closed', TODAY)).toEqual({
      done: null,
      closed: TODAY,
    });
  });

  it('leaves a date somebody already corrected alone', () => {
    // The rule the whole feature is for. Reopening a project and closing it
    // again must not quietly replace the day you typed with today.
    const corrected = { done: '2026-08-21', closed: null };
    expect(datesAfterStatus(corrected, 'done', 'done', TODAY)).toEqual(corrected);
    const reclosed = datesAfterStatus(
      { done: '2026-08-21', closed: '2026-08-25' },
      'review',
      'closed',
      TODAY
    );
    expect(reclosed.closed).toBe('2026-08-25');
  });
});

describe('moving out of one', () => {
  it('clears a date that has stopped being true', () => {
    // A project pulled back from Erledigt to Laufend is not one that was
    // finished on a day. Leaving the date would leave the note asserting two
    // contradictory things.
    expect(
      datesAfterStatus({ done: '2026-08-21', closed: null }, 'done', 'ongoing', TODAY)
    ).toEqual(none);
  });

  it('keeps the done date when the work really is still done', () => {
    // Closing something does not unfinish it, and neither does sending it for
    // review.
    for (const after of ['closed', 'review'] as const) {
      const result = datesAfterStatus({ done: '2026-08-21', closed: null }, 'done', after, TODAY);
      expect(result.done).toBe('2026-08-21');
    }
  });

  it('fills the new date while keeping the old one, on done to closed', () => {
    const result = datesAfterStatus({ done: '2026-08-21', closed: null }, 'done', 'closed', TODAY);
    expect(result).toEqual({ done: '2026-08-21', closed: TODAY });
  });

  it('clears the closed date when something is reopened', () => {
    const result = datesAfterStatus(
      { done: '2026-08-21', closed: '2026-08-25' },
      'closed',
      'ongoing',
      TODAY
    );
    expect(result.closed).toBeNull();
  });
});

describe('what it never does', () => {
  it('changes nothing when the status did not move', () => {
    const dates = { done: '2026-08-21', closed: '2026-08-25' };
    expect(datesAfterStatus(dates, 'closed', 'closed', TODAY)).toBe(dates);
  });

  it('touches no date on a move between statuses that record none', () => {
    expect(datesAfterStatus(none, 'backlog', 'ongoing', TODAY)).toEqual(none);
    expect(datesAfterStatus(none, 'ongoing', 'blocked', TODAY)).toEqual(none);
  });

  it('leaves the done date alone when something is dropped rather than finished', () => {
    // Removed is abandoned, which says nothing about whether the work that had
    // been done was done. Clearing it would lose a fact nobody retracted.
    const result = datesAfterStatus(
      { done: '2026-08-21', closed: null },
      'ongoing',
      'removed',
      TODAY
    );
    expect(result.done).toBe('2026-08-21');
  });
});
