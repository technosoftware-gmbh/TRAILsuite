/**
 * The day's meetings, drawn the way the week draws them.
 *
 * The drawing itself has no test -- this suite has no DOM -- so what is pinned
 * here is the seam where the two views can quietly disagree: turning a day
 * note's record into the line a calendar shows.
 *
 * That seam is where the bug was. The day view went through the generic row
 * kit, which strips the marker along with everything else it does not know
 * about, so a meeting you had declined read in the day exactly like one you
 * were going to -- in the view you look at before walking into the room.
 * Nothing about the markup could have caught it; this can.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

vi.mock('obsidian', async () => {
  const stub = await vi.importActual<typeof import('./obsidian-stub')>('./obsidian-stub');
  return { TFile: stub.TFile, normalizePath: (path: string) => path, setIcon: () => undefined };
});

const { meetingRowOf } = await import('../src/ui/views/plan-calendar');
const { emptyDraft } = await import('../src/plan/add-to-day');

type Record_ = Parameters<typeof meetingRowOf>[0];

function record(
  over: Partial<Record_['draft']> & { editable?: boolean; links?: string[] }
): Record_ {
  const { editable = true, links = [], ...draft } = over;
  return {
    kind: 'meeting',
    draft: { ...emptyDraft('meeting'), ...draft },
    label: draft.text ?? '',
    span: '',
    links,
    from: 0,
    to: 1,
    editable,
  };
}

describe('meetingRowOf', () => {
  it('carries what was answered through to the line', () => {
    // The whole point. A declined meeting has to arrive at the drawing still
    // knowing it was declined, or the day says you are going.
    expect(
      meetingRowOf(
        record({ text: 'PTM', startTime: '13:30', attendance: 'declined' }),
        DEFAULT_SETTINGS
      ).entry.attendance
    ).toBe('declined');
  });

  it('carries the other two as well', () => {
    for (const attendance of ['tentative', 'unanswered', ''] as const) {
      expect(
        meetingRowOf(record({ text: 'X', startTime: '09:00', attendance }), DEFAULT_SETTINGS).entry
          .attendance
      ).toBe(attendance);
    }
  });

  it('carries the times as the note states them', () => {
    const { entry } = meetingRowOf(
      record({ text: 'Sync', startTime: '09:00', endTime: '09:30' }),
      DEFAULT_SETTINGS
    );
    expect(entry).toMatchObject({ from: '09:00', to: '09:30', text: 'Sync' });
  });

  it('puts a meeting in the band its start time falls in', () => {
    // The same `bandOf` the week uses, so the two cannot disagree about where
    // half past eleven belongs.
    const band = (from: string) =>
      meetingRowOf(record({ text: 'X', startTime: from }), DEFAULT_SETTINGS).band;
    expect(band('09:00')).toBe('morning');
    expect(band('12:30')).toBe('lunch');
    expect(band('15:00')).toBe('afternoon');
  });

  it('leaves a meeting with no time out of the bands rather than guessing one', () => {
    // Putting it under MORGEN would be the view inventing a time the note does
    // not claim.
    expect(meetingRowOf(record({ text: 'Zuhause' }), DEFAULT_SETTINGS).band).toBeNull();
  });

  it('follows the vault lunch settings rather than a fixed hour', () => {
    const late = { ...DEFAULT_SETTINGS, weekLunchStart: '13:00', weekLunchEnd: '14:00' };
    expect(meetingRowOf(record({ text: 'X', startTime: '12:30' }), late).band).toBe('morning');
    expect(meetingRowOf(record({ text: 'X', startTime: '13:30' }), late).band).toBe('lunch');
  });

  it('shows what a meeting is about', () => {
    expect(
      meetingRowOf(record({ text: 'Sync', startTime: '09:00', links: ['Beruf'] }), DEFAULT_SETTINGS)
        .note
    ).toBe('Beruf');
  });

  it('says a line cannot be edited where it would say what it is about', () => {
    // Better than letting it look editable and fail on the click.
    const { note } = meetingRowOf(
      record({ text: 'Sync', startTime: '09:00', links: ['Beruf'], editable: false }),
      DEFAULT_SETTINGS
    );
    expect(note).not.toBe('Beruf');
    expect(note).not.toBe('');
  });
});
