/**
 * What a calendar import would do, before it does it.
 *
 * The cases that matter here are not the ones where the import works. They are
 * the four ways it can be wrong in a vault and be discovered weeks later:
 *
 * - it offers a meeting that is already in the note, and the day gains a
 *   duplicate;
 * - it re-writes a line somebody edited by hand, and the edit is gone;
 * - it announces that thirty meetings have disappeared from Google when the
 *   truth is that this run never looked for them;
 * - it reports the range it was given rather than the days it will touch, and
 *   creates notes in a month nobody asked about.
 *
 * Each has a test below, and each is a rule the design doc argued for before
 * any of this was written.
 */
import { describe, expect, it } from 'vitest';
import { parseIcs } from '../../src/calendar/ics.js';
import { expandEvents } from '../../src/calendar/recurrence.js';
import {
  meetingKey,
  planCalendarImport,
  priorLinesOf,
  type CalendarImportOptions,
  type ExistingEntry,
} from '../../src/calendar/import-plan.js';

function file(...blocks: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...blocks, 'END:VCALENDAR'].join('\r\n');
}

function event(...lines: string[]): string {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}

/** The whole pipeline: text in, plan out, exactly as the modal will run it. */
function plan(ics: string, options: Partial<CalendarImportOptions> = {}) {
  const from = options.from ?? '2026-09-01';
  const to = options.to ?? '2026-09-30';
  return planCalendarImport(expandEvents(parseIcs(ics), from, to), {
    from,
    to,
    existing: options.existing ?? [],
    history: options.history,
    // Blank converts nothing, which is what these fixtures were written
    // against: none of them states a `Z` time or a foreign `TZID`, so there is
    // nothing here for a zone to change. `calendar-zones.test.ts` and the
    // section at the end of this file cover the conversion itself.
    zone: options.zone ?? '',
  });
}

const CARE = event(
  'UID:care@example.ch',
  'DTSTART;TZID=Europe/Zurich:20260914T090000',
  'DTEND;TZID=Europe/Zurich:20260914T093000',
  'SUMMARY:Meeting mit Care Management',
  'LOCATION:Zürich'
);

const line = (day: string, from: string, text: string, partstat?: string): ExistingEntry => ({
  day,
  from,
  text,
  ...(partstat === undefined ? {} : { partstat }),
});

describe('meetingKey', () => {
  it('is the day, the time and the text, and nothing the note does not show', () => {
    expect(meetingKey('2026-09-14', '09:00', 'Standup')).toBe('2026-09-14~09:00~standup');
  });

  it('reads a time somebody typed unpadded as the same time', () => {
    // Left alone, a line typed as `9:00` never matches the export's `09:00`
    // and the import offers a duplicate of the line sitting right under it.
    expect(meetingKey('2026-09-14', '9:00', 'Standup')).toBe(
      meetingKey('2026-09-14', '09:00', 'Standup')
    );
  });

  it('ignores case and runs of spaces, and nothing beyond that', () => {
    expect(meetingKey('2026-09-14', '09:00', '  Standup   mit  Team ')).toBe(
      meetingKey('2026-09-14', '09:00', 'standup mit team')
    );
    expect(meetingKey('2026-09-14', '09:00', 'Standup!')).not.toBe(
      meetingKey('2026-09-14', '09:00', 'Standup')
    );
  });
});

describe('planCalendarImport', () => {
  it('proposes an event the vault does not hold', () => {
    const out = plan(file(CARE));
    expect(out.proposals).toHaveLength(1);
    expect(out.proposals[0]).toMatchObject({
      uid: 'care@example.ch',
      day: '2026-09-14',
      from: '09:00',
      to: '09:30',
      summary: 'Meeting mit Care Management',
      location: 'Zürich',
      status: 'new',
      writes: true,
      span: null,
      stale: null,
    });
    expect(out).toMatchObject({
      toWrite: 1,
      alreadyPresent: 0,
      needsAttention: 0,
      days: ['2026-09-14'],
    });
  });

  it('leaves alone a meeting the note already has', () => {
    const out = plan(file(CARE), {
      existing: [line('2026-09-14', '09:00', 'Meeting mit Care Management')],
    });
    expect(out.proposals[0]).toMatchObject({ status: 'already-present', writes: false });
    expect(out).toMatchObject({ toWrite: 0, alreadyPresent: 1, days: [] });
  });

  it('does not care who wrote the line it matches', () => {
    // No history at all: this is somebody's hand-typed meeting, and it counts
    // exactly as much as one we wrote. Deriving the key is what makes the two
    // indistinguishable, which is the whole of §D.
    const out = plan(file(CARE), {
      existing: [line('2026-09-14', '9:00', 'meeting   mit Care Management')],
    });
    expect(out.proposals[0]?.status).toBe('already-present');
  });

  it('keeps the location off the line and beside it', () => {
    // The note format has no place for it. Putting it on the line would change
    // what gets written into a vault, which is not an importer's decision.
    const [only] = plan(file(CARE)).proposals;
    expect(only?.location).toBe('Zürich');
    expect(only?.key).toBe(meetingKey('2026-09-14', '09:00', 'Meeting mit Care Management'));
  });

  describe('when the record says we wrote it before', () => {
    const wrote = (key: string, day = '2026-09-14') => [
      { from: '2026-09-01', to: '2026-09-30', lines: [{ uid: 'care@example.ch', day, key }] },
    ];

    it('calls it changed upstream when our line is still there and says something else', () => {
      const old = line('2026-09-14', '09:00', 'Care Management');
      const out = plan(file(CARE), {
        existing: [old],
        history: wrote(meetingKey(old.day, old.from, old.text)),
      });
      expect(out.proposals[0]).toMatchObject({ status: 'changed-upstream', writes: true });
      // Named, because nothing here removes it and the person would otherwise
      // be left with two lines and no way to tell which is the current one.
      expect(out.proposals[0]?.stale).toEqual(old);
    });

    it('calls it edited here when our line has gone, and does not write over the edit', () => {
      const out = plan(file(CARE), {
        existing: [],
        history: wrote(meetingKey('2026-09-14', '09:00', 'Meeting mit Care Management')),
      });
      expect(out.proposals[0]).toMatchObject({ status: 'edited-here', writes: false, stale: null });
      expect(out.needsAttention).toBe(1);
    });

    it('still calls it present when somebody fixed it by hand to match', () => {
      const out = plan(file(CARE), {
        existing: [line('2026-09-14', '09:00', 'Meeting mit Care Management')],
        history: wrote('2026-09-14~09:00~etwas ganz anderes'),
      });
      expect(out.proposals[0]?.status).toBe('already-present');
    });

    it('takes the latest run as what the note holds now', () => {
      // Two runs, and the first one's line is still lying in the note: run two
      // already reported it as stale and nobody deleted it. Reading the first
      // run as current would report the same staleness a second time and offer
      // a line run two has already written.
      const first = line('2026-09-14', '09:00', 'Care Management');
      const out = plan(file(CARE), {
        existing: [first],
        history: [
          {
            from: '2026-09-01',
            to: '2026-09-15',
            lines: [
              {
                uid: 'care@example.ch',
                day: '2026-09-14',
                key: meetingKey(first.day, first.from, first.text),
              },
            ],
          },
          {
            from: '2026-09-16',
            to: '2026-09-30',
            lines: [
              {
                uid: 'care@example.ch',
                day: '2026-09-14',
                key: meetingKey('2026-09-14', '09:00', 'Meeting mit Care Management'),
              },
            ],
          },
        ],
      });
      expect(out.proposals[0]).toMatchObject({ status: 'edited-here', stale: null });
    });
  });

  it('writes one identical line rather than two, whatever the export says', () => {
    const twice = event(
      'UID:andere@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260914T090000',
      'SUMMARY:Meeting mit Care Management'
    );
    const out = plan(file(CARE, twice));
    expect(out.proposals.map((one) => one.status)).toEqual(['new', 'duplicate-in-file']);
    expect(out).toMatchObject({ toWrite: 1, needsAttention: 1 });
  });

  describe('an occurrence covering several days', () => {
    it('becomes one line per day, with the times at the ends', () => {
      const conference = event(
        'UID:konferenz@example.ch',
        'DTSTART;TZID=Europe/Zurich:20260914T090000',
        'DTEND;TZID=Europe/Zurich:20260916T170000',
        'SUMMARY:Konferenz'
      );
      expect(
        plan(file(conference)).proposals.map((one) => [one.day, one.from, one.to, one.span])
      ).toEqual([
        ['2026-09-14', '09:00', '', { index: 1, count: 3 }],
        ['2026-09-15', '', '', { index: 2, count: 3 }],
        ['2026-09-16', '', '17:00', { index: 3, count: 3 }],
      ]);
    });

    it('reads an all-day end as exclusive, so a holiday does not gain a day', () => {
      const holiday = event(
        'UID:ferien@example.ch',
        'DTSTART;VALUE=DATE:20260914',
        'DTEND;VALUE=DATE:20260917',
        'SUMMARY:Ferien'
      );
      expect(plan(file(holiday)).proposals.map((one) => one.day)).toEqual([
        '2026-09-14',
        '2026-09-15',
        '2026-09-16',
      ]);
    });

    it('reports the days it will touch, not the range it was given', () => {
      // §I.1. A holiday starting on 28 September is imported whole, so eight
      // day notes are written and five of them are October. An import that
      // said "September" and then created 2026-10-03.md would be a surprise in
      // somebody's vault, which is the thing this whole feature avoids.
      const holiday = event(
        'UID:ferien@example.ch',
        'DTSTART;VALUE=DATE:20260928',
        'DTEND;VALUE=DATE:20261006',
        'SUMMARY:Ferien'
      );
      const out = plan(file(holiday));
      expect(out.days).toHaveLength(8);
      expect(out.days.at(0)).toBe('2026-09-28');
      expect(out.days.at(-1)).toBe('2026-10-05');
    });
  });

  describe('what is no longer in the export', () => {
    const gone = [
      {
        from: '2026-09-01',
        to: '2026-09-30',
        lines: [
          {
            uid: 'abgesagt@example.ch',
            day: '2026-09-10',
            key: meetingKey('2026-09-10', '14:00', 'Jour fixe'),
          },
        ],
      },
    ];

    it('lists it, with the line the vault still holds', () => {
      const still = line('2026-09-10', '14:00', 'Jour fixe');
      const out = plan(file(CARE), { existing: [still], history: gone });
      expect(out.missing).toEqual([
        {
          uid: 'abgesagt@example.ch',
          day: '2026-09-10',
          key: still.day + '~14:00~jour fixe',
          entry: still,
        },
      ]);
    });

    it('does not flag what this run never looked for', () => {
      // §I.2. Import September, then October: every September key is absent
      // from the October export, and reported naively the second import
      // announces thirty cancellations, all of them wrong.
      const out = plan(file(CARE), { from: '2026-10-01', to: '2026-10-31', history: gone });
      expect(out.missing).toEqual([]);
    });

    it('does not flag an event whose text merely changed', () => {
      const out = plan(file(CARE), {
        history: [
          {
            from: '2026-09-01',
            to: '2026-09-30',
            lines: [{ uid: 'care@example.ch', day: '2026-09-14', key: 'etwas anderes' }],
          },
        ],
      });
      expect(out.missing).toEqual([]);
    });

    it('reports nothing on a first import, having written nothing to lose', () => {
      expect(plan(file(CARE)).missing).toEqual([]);
    });
  });

  describe('the gap between one range and the next', () => {
    const after = (to: string) => [{ from: '2026-09-01', to, lines: [] }];

    it('names the days nothing covered', () => {
      // §I.3. A straddling event belongs to the earlier range only, so a gap
      // loses whatever crosses it, silently.
      expect(
        plan(file(CARE), { from: '2026-09-20', to: '2026-09-30', history: after('2026-09-15') }).gap
      ).toEqual({ from: '2026-09-16', to: '2026-09-19' });
    });

    it('says nothing when the ranges adjoin', () => {
      expect(
        plan(file(CARE), { from: '2026-09-16', to: '2026-09-30', history: after('2026-09-15') }).gap
      ).toBeNull();
    });

    it('says nothing when they overlap', () => {
      expect(
        plan(file(CARE), { from: '2026-09-10', to: '2026-09-30', history: after('2026-09-15') }).gap
      ).toBeNull();
    });

    it('says nothing about a backfill, which is the gap being filled', () => {
      expect(
        plan(file(CARE), { from: '2026-08-01', to: '2026-08-31', history: after('2026-09-15') }).gap
      ).toBeNull();
    });

    it('says nothing on a first import', () => {
      expect(plan(file(CARE)).gap).toBeNull();
    });
  });

  describe('a rule the expander cannot honour', () => {
    const odd = event(
      'UID:rapport@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260907T090000',
      'RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1',
      'SUMMARY:Monatsrapport'
    );

    it('writes none of it, and says which part it could not read', () => {
      const out = plan(file(odd));
      expect(out.proposals.length).toBeGreaterThan(1);
      expect(out.proposals.every((one) => one.status === 'unsupported-rule')).toBe(true);
      expect(out.toWrite).toBe(0);
      expect(out.unsupported).toEqual([
        { uid: 'rapport@example.ch', summary: 'Monatsrapport', parts: ['BYSETPOS'] },
      ]);
    });

    it('outranks a line already saying the same thing', () => {
      // "Already present" is a claim about a day, and the days from a rule we
      // mis-read are exactly what is in doubt.
      const out = plan(file(odd), {
        existing: [line('2026-09-07', '09:00', 'Monatsrapport')],
      });
      expect(out.proposals[0]?.status).toBe('unsupported-rule');
    });

    it('passes a series whose walk gave up straight through', () => {
      const ancient = event(
        'UID:uralt@example.ch',
        'DTSTART;TZID=Europe/Zurich:19000101T090000',
        'RRULE:FREQ=DAILY',
        'SUMMARY:Uralt'
      );
      expect(plan(file(ancient)).truncated).toEqual([
        { uid: 'uralt@example.ch', summary: 'Uralt' },
      ]);
    });
  });

  it('gives a day one line when two instances of a series both cover it', () => {
    // A nine-day event on a weekly rule: the second instance starts before the
    // first has finished, so four days are covered twice. Two identical lines
    // in one note either way, and the note is what a person reads.
    const overlapping = event(
      'UID:messe@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260907T090000',
      'DTEND;TZID=Europe/Zurich:20260915T170000',
      'RRULE:FREQ=WEEKLY;COUNT=2',
      'SUMMARY:Messe'
    );
    const out = plan(file(overlapping));
    expect(out.proposals.map((one) => one.day)).toEqual(out.days);
    expect(out.days.at(0)).toBe('2026-09-07');
    expect(out.days.at(-1)).toBe('2026-09-22');
    expect(out.days).toHaveLength(16);
  });

  it('places a recurring series across the range and counts what it would write', () => {
    const standup = event(
      'UID:standup@example.ch',
      'DTSTART;TZID=Europe/Zurich:20240108T090000',
      'DTEND;TZID=Europe/Zurich:20240108T091500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'SUMMARY:Standup'
    );
    const out = plan(file(standup), {
      existing: [line('2026-09-14', '09:00', 'Standup')],
    });
    expect(out.days).toEqual(['2026-09-07', '2026-09-21', '2026-09-28']);
    expect(out).toMatchObject({ toWrite: 3, alreadyPresent: 1, needsAttention: 0 });
  });
});

describe('an answer given after the line was written', () => {
  // The case the design doc recorded as a limitation and a real week of use
  // turned into the main case: import the week, then go through the calendar on
  // Monday morning declining what you will not attend. The line's day, time and
  // text never move, so the key matches and the import used to call it present
  // and leave the marker saying you were going.
  const invited = (partstat: string) =>
    event(
      'UID:care@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260914T090000',
      'DTEND;TZID=Europe/Zurich:20260914T093000',
      'SUMMARY:Meeting mit Care Management',
      `ATTENDEE;PARTSTAT=${partstat};CN=stefan@example.ch:mailto:stefan@example.ch`
    );

  const planFor = (partstat: string, held: string) =>
    planCalendarImport(
      expandEvents(
        parseIcs(file(invited(partstat))),
        '2026-09-01',
        '2026-09-30',
        'stefan@example.ch'
      ),
      {
        from: '2026-09-01',
        to: '2026-09-30',
        existing: [line('2026-09-14', '09:00', 'Meeting mit Care Management', held)],
        zone: '',
      }
    );

  it('notices a meeting you have since declined', () => {
    const out = planFor('DECLINED', 'NEEDS-ACTION');
    expect(out.proposals[0]?.status).toBe('answer-changed');
    expect(out).toMatchObject({ toUpdate: 1, alreadyPresent: 0, toWrite: 0 });
  });

  it('names the line it would rewrite, and nothing else about it moves', () => {
    // The one write in this feature that touches a line already in a note, so
    // the plan says which line rather than leaving a caller to work it out.
    const out = planFor('DECLINED', '');
    expect(out.proposals[0]?.updates).toEqual({
      day: '2026-09-14',
      from: '09:00',
      text: 'Meeting mit Care Management',
      partstat: '',
    });
  });

  it('notices a change in either direction', () => {
    // Declining is the common one, but a meeting declined and then accepted
    // would otherwise stay wrong for ever.
    expect(planFor('', 'DECLINED').proposals[0]?.status).toBe('answer-changed');
    expect(planFor('TENTATIVE', 'DECLINED').proposals[0]?.status).toBe('answer-changed');
  });

  it('leaves a line alone when the answer has not moved', () => {
    expect(planFor('DECLINED', 'DECLINED').proposals[0]?.status).toBe('already-present');
    expect(planFor('NEEDS-ACTION', 'NEEDS-ACTION').proposals[0]?.status).toBe('already-present');
  });

  it('treats accepted and not-invited as one answer, because a line cannot tell them apart', () => {
    // Not invited means no ATTENDEE line naming you at all -- your own blocked
    // time. `PARTSTAT=` with nothing after it is a different thing: an
    // invitation you have not answered, which RFC 5545 reads as NEEDS-ACTION
    // and which a line does distinguish.
    expect(planFor('ACCEPTED', '').proposals[0]?.status).toBe('already-present');

    const mine = event(
      'UID:care@example.ch',
      'DTSTART;TZID=Europe/Zurich:20260914T090000',
      'DTEND;TZID=Europe/Zurich:20260914T093000',
      'SUMMARY:Meeting mit Care Management'
    );
    const out = planCalendarImport(
      expandEvents(parseIcs(file(mine)), '2026-09-01', '2026-09-30', 'stefan@example.ch'),
      {
        from: '2026-09-01',
        to: '2026-09-30',
        existing: [line('2026-09-14', '09:00', 'Meeting mit Care Management', 'ACCEPTED')],
        zone: '',
      }
    );
    expect(out.proposals[0]?.status).toBe('already-present');
  });

  it('reads an invitation with an empty PARTSTAT as unanswered, not as accepted', () => {
    // The distinction the case above turns on, asserted so it cannot drift.
    expect(planFor('', 'ACCEPTED').proposals[0]?.status).toBe('answer-changed');
    expect(planFor('', 'NEEDS-ACTION').proposals[0]?.status).toBe('already-present');
  });

  it('does not invent a fifth state for an answer it cannot render', () => {
    // DELEGATED and the rest reduce to nothing rather than to a marker that
    // does not exist.
    expect(planFor('DELEGATED', '').proposals[0]?.status).toBe('already-present');
  });

  it('says nothing when the caller does not report what its lines say', () => {
    // Every caller before this one. An absent `partstat` means "I do not
    // distinguish answers", which must not read as "every answer is accepted".
    const out = planCalendarImport(
      expandEvents(
        parseIcs(file(invited('DECLINED'))),
        '2026-09-01',
        '2026-09-30',
        'stefan@example.ch'
      ),
      {
        from: '2026-09-01',
        to: '2026-09-30',
        existing: [line('2026-09-14', '09:00', 'Meeting mit Care Management')],
        zone: '',
      }
    );
    expect(out.proposals[0]?.status).toBe('already-present');
    expect(out.toUpdate).toBe(0);
  });

  it('counts a rewrite as work the import does, not work it asks for', () => {
    const out = planFor('DECLINED', '');
    expect(out.needsAttention).toBe(0);
    expect(out.days).toEqual(['2026-09-14']);
  });
});

describe("the zone the file states, read into the vault's", () => {
  // The bug this section exists for: a real export mixes `TZID=Europe/Zurich`
  // with bare `Z`, and until the conversion landed both were copied digit for
  // digit. A third of a working calendar arrived two hours early in summer and
  // one in winter, which reads as an early meeting rather than as a fault.
  const ZURICH = 'Europe/Zurich';

  it('reads a UTC instant as the vault wall clock', () => {
    const out = plan(
      file(
        event(
          'UID:z@example.ch',
          'DTSTART:20260914T060000Z',
          'DTEND:20260914T062500Z',
          'SUMMARY:Out of Office'
        )
      ),
      { zone: ZURICH }
    );

    expect(out.proposals[0]?.day).toBe('2026-09-14');
    expect(out.proposals[0]?.from).toBe('08:00');
    expect(out.proposals[0]?.to).toBe('08:25');
  });

  it('leaves a time already stated in the vault zone alone', () => {
    const out = plan(
      file(
        event(
          'UID:local@example.ch',
          'DTSTART;TZID=Europe/Zurich:20260914T080000',
          'DTEND;TZID=Europe/Zurich:20260914T082500',
          'SUMMARY:Out of Office'
        )
      ),
      { zone: ZURICH }
    );

    expect(out.proposals[0]?.from).toBe('08:00');
  });

  it('moves a late instant onto the day it happens on here', () => {
    // Worse than a wrong time: a right time in a note nobody will look at.
    const out = plan(
      file(
        event(
          'UID:late@example.ch',
          'DTSTART:20260914T230000Z',
          'DTEND:20260914T234500Z',
          'SUMMARY:Late call'
        )
      ),
      { zone: ZURICH }
    );

    expect(out.proposals[0]?.day).toBe('2026-09-15');
    expect(out.proposals[0]?.from).toBe('01:00');
    expect(out.days).toEqual(['2026-09-15']);
  });

  it('leaves an all-day event on its stated day', () => {
    const out = plan(
      file(
        event(
          'UID:day@example.ch',
          'DTSTART;VALUE=DATE:20260914',
          'DTEND;VALUE=DATE:20260915',
          'SUMMARY:Zuhause'
        )
      ),
      { zone: ZURICH }
    );

    expect(out.proposals[0]?.day).toBe('2026-09-14');
    expect(out.proposals[0]?.from).toBe('');
  });

  it('derives a prior key off the converted clock, not the file digits', () => {
    // Asserted on `priorLinesOf` directly. Going through the plan cannot see
    // this: `existing` is matched by key first, so a note that holds the
    // corrected line reads as already-present whatever the replay believed,
    // and `missing` is identified by uid and day rather than by key. The one
    // observable difference is the key itself.
    const ics = file(
      event(
        'UID:z@example.ch',
        'DTSTART:20260914T060000Z',
        'DTEND:20260914T062500Z',
        'SUMMARY:Out of Office'
      )
    );
    const occurrences = expandEvents(parseIcs(ics), '2026-09-01', '2026-09-30').occurrences;

    expect(priorLinesOf(occurrences, ZURICH)[0]?.key).toBe(
      meetingKey('2026-09-14', '08:00', 'Out of Office')
    );
    expect(priorLinesOf(occurrences, '')[0]?.key).toBe(
      meetingKey('2026-09-14', '06:00', 'Out of Office')
    );
  });

  it('recognises a line it wrote before, because the replay converts the same way', () => {
    // The half that would break silently. A key is derived from the converted
    // clock, so `priorLinesOf` has to convert identically or a re-import
    // reports every meeting as new and gone at once.
    const ics = file(
      event(
        'UID:z@example.ch',
        'DTSTART:20260914T060000Z',
        'DTEND:20260914T062500Z',
        'SUMMARY:Out of Office'
      )
    );
    const history = [
      {
        from: '2026-09-01',
        to: '2026-09-30',
        lines: priorLinesOf(
          expandEvents(parseIcs(ics), '2026-09-01', '2026-09-30').occurrences,
          ZURICH
        ),
      },
    ];

    const out = plan(ics, {
      zone: ZURICH,
      history,
      existing: [{ day: '2026-09-14', from: '08:00', text: 'Out of Office' }],
    });

    expect(out.proposals[0]?.status).toBe('already-present');
    expect(out.missing).toEqual([]);
  });
});
