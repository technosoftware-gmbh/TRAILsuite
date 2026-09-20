/**
 * The place and the people an entry carries, which live on child lines.
 *
 * **The headline is what this is really about.** Section D of
 * `day-entry-links.md` chose children over a second link on the line so that
 * the entry's own line could not move: the derived key an importer builds from
 * it, the round-trip rule the editor rests on, and every reader downstream all
 * read that line and none of them changes. So the first thing asserted here is
 * that the headline is byte for byte what it was before any of this existed.
 *
 * After that, the cases that matter are the refusals. A child the dialog cannot
 * reproduce must make the entry read-only rather than be quietly dropped, which
 * is the same arbiter the headline already has, one level down.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { carriesPlace, emptyDraft, entryLines, type DayEntryDraft } from '../src/plan/add-to-day';
import { meetingsIn } from '../src/plan/read-day';

const S = DEFAULT_SETTINGS;
const HEADING = '## 📅 Schedule';

function lunch(over: Partial<DayEntryDraft> = {}): DayEntryDraft {
  return {
    ...emptyDraft('meeting'),
    text: 'Mittagessen',
    context: 'Beruf',
    startTime: '12:00',
    endTime: '13:30',
    ...over,
  };
}

/** A body with the given lines under the schedule heading. */
function body(...lines: string[]): string {
  return [HEADING, ...lines, ''].join('\n');
}

describe('entryLines with children', () => {
  it('leaves the headline exactly as it was', () => {
    const bare = entryLines(S, lunch());
    const full = entryLines(S, lunch({ place: 'Gifthüttli', persons: ['Anna Muster'] }));
    expect(full[0]).toBe(bare[0]);
    expect(full[0]).toBe('- 👥 12:00-13:30 Mittagessen [[Beruf]]');
  });

  it('writes the place first, then the people in the order they were named', () => {
    expect(
      entryLines(S, lunch({ place: 'Gifthüttli', persons: ['Anna Muster', 'Stefan'] }))
    ).toEqual([
      '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
      '    - 📍 [[Gifthüttli]]',
      '    - 🧑 [[Anna Muster]]',
      '    - 🧑 [[Stefan]]',
    ]);
  });

  it('puts the place and the people above what was said and what follows', () => {
    const lines = entryLines(
      S,
      lunch({
        place: 'Gifthüttli',
        persons: ['Anna Muster'],
        notes: 'Rehpfeffer, sehr gut.',
        followUps: [{ text: 'Tisch reservieren', context: '', due: '2026-09-27' }],
      })
    );
    expect(lines.map((line) => line.trim().slice(0, 6))).toEqual([
      '- 👥 1',
      '- 📍 [',
      '- 🧑 [',
      '- 📝 R',
      '- [ ] ',
    ]);
  });

  it('writes nothing for a kind that cannot carry them', () => {
    expect(carriesPlace('task')).toBe(false);
    expect(carriesPlace('note')).toBe(false);
    expect(carriesPlace('idea')).toBe(false);
    const idea = entryLines(S, { ...emptyDraft('idea'), text: 'Etwas', place: 'Gifthüttli' });
    expect(idea).toEqual(['- 💡 Etwas']);
  });

  it('lets a span carry them, because a week in a hotel has a place and people', () => {
    expect(carriesPlace('span')).toBe(true);
    expect(
      entryLines(S, {
        ...emptyDraft('span'),
        text: 'Ferien Sardinien',
        place: 'Hotel Dreieich',
        persons: ['Anna Muster'],
      })
    ).toEqual(['- 🏖️ Ferien Sardinien', '    - 📍 [[Hotel Dreieich]]', '    - 🧑 [[Anna Muster]]']);
  });

  it('writes no child at all when its marker is blank, rather than an unmarked one', () => {
    // Blank means "do not distinguish these". An unmarked child could not be
    // told from a note, which is the reading that loses the place.
    const settings = { ...S, dayPlaceMarker: '' };
    expect(entryLines(settings, lunch({ place: 'Gifthüttli' }))).toHaveLength(1);
  });
});

describe('reading the children back', () => {
  it('reads the place and the people into the draft, and stays editable', () => {
    const [record] = meetingsIn(
      body(
        '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
        '    - 📍 [[Gifthüttli]]',
        '    - 🧑 [[Anna Muster]]'
      ),
      S
    );
    expect(record?.draft.place).toBe('Gifthüttli');
    expect(record?.draft.persons).toEqual(['Anna Muster']);
    expect(record?.editable).toBe(true);
  });

  it('does not read a place child as a note, which would lose it on save', () => {
    const [record] = meetingsIn(
      body(
        '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
        '    - 📍 [[Gifthüttli]]',
        '    - 📝 Rehpfeffer, sehr gut.'
      ),
      S
    );
    expect(record?.draft.notes).toBe('Rehpfeffer, sehr gut.');
    expect(record?.draft.place).toBe('Gifthüttli');
  });

  it('shows every link it found, headline and children alike', () => {
    const [record] = meetingsIn(
      body(
        '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
        '    - 📍 [[Gifthüttli]]',
        '    - 🧑 [[Anna Muster]]'
      ),
      S
    );
    expect(record?.links).toEqual(['Beruf', 'Gifthüttli', 'Anna Muster']);
  });

  it('refuses to edit a child that says more than a title', () => {
    // The dialog has one field per child and no room for somebody's own words
    // beside the link. Rewriting it would drop them, so the entry opens the
    // note instead.
    const [record] = meetingsIn(
      body('- 👥 12:00-13:30 Mittagessen [[Beruf]]', '    - 📍 [[Gifthüttli]] am Barfüsserplatz'),
      S
    );
    expect(record?.editable).toBe(false);
    // Shown all the same: the view draws what the note says even where the
    // dialog will not touch it.
    expect(record?.draft.place).toBe('');
  });

  it('reads a span with children and refuses one carrying a checkbox', () => {
    const [withChildren] = meetingsIn(
      body('- 🏖️ Ferien Sardinien', '    - 📍 [[Hotel Dreieich]]'),
      S
    );
    expect(withChildren?.draft.place).toBe('Hotel Dreieich');
    expect(withChildren?.editable).toBe(true);

    const [withTask] = meetingsIn(body('- 🏖️ Ferien Sardinien', '    - [ ] Sonnencreme kaufen'), S);
    // A span takes no follow-ups, so this is a line it cannot compose back.
    expect(withTask?.editable).toBe(false);
  });

  it('round-trips everything it read', () => {
    const lines = [
      '- 👥 12:00-13:30 Mittagessen [[Beruf]]',
      '    - 📍 [[Gifthüttli]]',
      '    - 🧑 [[Anna Muster]]',
      '    - 🧑 [[Stefan]]',
      '    - 📝 Rehpfeffer, sehr gut.',
    ];
    const [record] = meetingsIn(body(...lines), S);
    expect(record?.editable).toBe(true);
    expect(entryLines(S, record?.draft ?? emptyDraft())).toEqual(lines);
  });

  it('leaves an entry written before any of this existed exactly as it was', () => {
    const lines = ['- 👥 09:00-09:30 Sync [[Kampagne]]', '    - 📝 Launch verschiebt sich.'];
    const [record] = meetingsIn(body(...lines), S);
    expect(record?.editable).toBe(true);
    expect(record?.draft.place).toBe('');
    expect(record?.draft.persons).toEqual([]);
    expect(entryLines(S, record?.draft ?? emptyDraft())).toEqual(lines);
  });
});
