/**
 * Reading the day's meetings back out of the note.
 *
 * The design deferred parsing the body, and the reasoning was about **writing**:
 * a parser that can mangle a note somebody also edited by hand. That still
 * holds and nothing here writes. What the design got wrong was deferring the
 * reading with it -- the first day of real use produced a note whose whole
 * afternoon was a meeting, and a day view that showed the one task and none of
 * the schedule.
 *
 * So the rule this file holds is: **a line it cannot make sense of is skipped,
 * never guessed at.** A day note is written by hand as well as by the dialog,
 * and a bullet somebody typed under that heading is not obliged to look like
 * ours. Guessing produces an entry at a time nobody wrote, which is worse than
 * showing nothing.
 *
 * The checkbox rule is the one that would otherwise show things twice: the
 * follow-ups written under a meeting are tasks, `readTasks` already finds them,
 * and a schedule that picked them up as well would list each one in two places
 * in the same view.
 */
import { describe, expect, it } from 'vitest';
import { parseScheduleLine } from '../src/plan/read-schedule';

const MARKERS = { accepted: '👥', tentative: '❓', unanswered: '✉️', declined: '🚫' };

const parse = (line: string, marker = '👥') =>
  parseScheduleLine(line, { ...MARKERS, accepted: marker });

describe('a line the dialog wrote', () => {
  it('reads a span', () => {
    expect(parse('- 👥 11:00-12:00 PMQ')).toEqual({
      attendance: '',
      from: '11:00',
      to: '12:00',
      text: 'PMQ',
      links: [],
    });
  });

  it('reads a start with no end', () => {
    expect(parse('- 👥 11:00 PMQ')).toMatchObject({ from: '11:00', to: '', text: 'PMQ' });
  });

  it('reads an end with no start', () => {
    expect(parse('- 👥 -12:00 Abgabe')).toMatchObject({ from: '', to: '12:00', text: 'Abgabe' });
  });

  it('reads a meeting with no time at all', () => {
    expect(parse('- 👥 Zahnarzt')).toMatchObject({ from: '', to: '', text: 'Zahnarzt' });
  });

  it('takes the wikilink off the text and keeps it as a link', () => {
    expect(parse('- 👥 10:00 Sync [[Kampagne Herbst]]')).toEqual({
      attendance: '',
      from: '10:00',
      to: '',
      text: 'Sync',
      links: ['Kampagne Herbst'],
    });
  });
});

describe('a line somebody wrote by hand', () => {
  it('reads a bullet with no marker, because a vault may have cleared it', () => {
    expect(parse('- 09:00-09:30 Standup')).toMatchObject({ from: '09:00', text: 'Standup' });
  });

  it('reads a `*` bullet as readily as a `-` one', () => {
    expect(parse('* 👥 14:00 Termin')).toMatchObject({ from: '14:00', text: 'Termin' });
  });

  it('reads a single-digit hour', () => {
    expect(parse('- 👥 9:00-9:30 Standup')).toMatchObject({ from: '9:00', to: '9:30' });
  });

  it('keeps prose that has no time as an entry with no time', () => {
    // Somebody's note about the afternoon is still part of the schedule.
    expect(parse('- Nachmittag bei Erika')).toMatchObject({
      from: '',
      text: 'Nachmittag bei Erika',
    });
  });

  it('does not read a number that is not a time as one', () => {
    const entry = parse('- 👥 2026 Rückblick');
    expect(entry?.from).toBe('');
    expect(entry?.text).toBe('2026 Rückblick');
  });
});

describe('what it refuses to read', () => {
  it('skips a checkbox, so a follow-up is not listed twice', () => {
    // The rule that keeps the plan view from showing one task in two sections.
    expect(parse('    - [ ] Beim Design nachfassen')).toBeNull();
    expect(parse('- [x] erledigt')).toBeNull();
  });

  it('skips a line that is not a bullet', () => {
    expect(parse('Einfach Text')).toBeNull();
    expect(parse('### Vormittag')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('skips a bullet with nothing on it', () => {
    expect(parse('- 👥')).toBeNull();
    expect(parse('-   ')).toBeNull();
  });
});

describe('what was answered', () => {
  // A calendar knows which of its meetings you are going to, and one marker
  // for all of them writes a day claiming you are in four rooms at once.
  const parseAll = (line: string) => parseScheduleLine(line, MARKERS);

  it('reads an accepted meeting as saying nothing special', () => {
    // Accepted and "I wrote this down myself" are one thing to a reader: it is
    // on, and you are going. So they share a marker and an empty attendance.
    expect(parseAll('- 👥 09:00 Standup')?.attendance).toBe('');
  });

  it('reads the other three off their markers', () => {
    expect(parseAll('- ❓ 09:00 Standup')?.attendance).toBe('tentative');
    expect(parseAll('- ✉️ 09:00 Standup')?.attendance).toBe('unanswered');
    expect(parseAll('- 🚫 09:00 Standup')?.attendance).toBe('declined');
  });

  it('takes the marker off the text, whichever it was', () => {
    expect(parseAll('- 🚫 13:30-14:30 PTM incl. Change Board')).toMatchObject({
      attendance: 'declined',
      from: '13:30',
      to: '14:30',
      text: 'PTM incl. Change Board',
    });
  });

  it('strips the longest marker that fits, not the first that matches', () => {
    // Two markers can share a prefix -- an emoji and the same emoji with a
    // variation selector differ only in the tail -- and stripping the shorter
    // would leave the difference sitting at the front of the text.
    const markers = { accepted: '👥', tentative: '👥❓', unanswered: '', declined: '' };
    expect(parseScheduleLine('- 👥❓ 09:00 Standup', markers)).toMatchObject({
      attendance: 'tentative',
      text: 'Standup',
    });
  });

  it('reads a line with no marker as saying nothing, not as declined', () => {
    expect(parseAll('- 09:00 Standup')?.attendance).toBe('');
  });

  it('ignores a marker a vault has cleared', () => {
    // Blank means "do not distinguish these", and a blank marker matching
    // every line would read the whole day as declined.
    const markers = { accepted: '👥', tentative: '', unanswered: '', declined: '' };
    expect(parseScheduleLine('- 👥 09:00 Standup', markers)?.attendance).toBe('');
    expect(parseScheduleLine('- 09:00 Standup', markers)?.attendance).toBe('');
  });
});
