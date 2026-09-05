/**
 * Follow-ups from one meeting, belonging to several different projects.
 *
 * The case a real Friday produces here: fifteen projects run in parallel, every
 * one that moved gets discussed, and one meeting yields half a dozen tasks
 * across half a dozen of them. The meeting's own context field holds exactly
 * one project, so it could never say what each follow-up was about.
 *
 * It used to work by typing `[[Projekt]]` into a text box, which worked by
 * accident -- the typed text was passed through verbatim -- and meant typing
 * markdown into a dialog whose whole purpose is that nobody has to. Each
 * follow-up is now a row with its own project and its own date.
 *
 * **The typed-link route still works**, and that is not sentiment: a follow-up
 * read back out of a note is offered as one text field, links and dates
 * included, because keeping the remainder whole is what makes the round trip
 * exact -- and the round trip is what decides whether a meeting may be edited
 * at all. So the tests for it stay.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTaskLine } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { emptyDraft, emptyFollowUp, entryLines } from '../src/plan/add-to-day';

const DAY = '2026-08-31';
const fu = (text: string, context = '', due = '') => ({ text, context, due });

const meeting = (over: Record<string, unknown>) =>
  entryLines(DEFAULT_SETTINGS, { ...emptyDraft('meeting'), text: 'Wochenmeeting', ...over }, DAY);

describe('a row naming its own project', () => {
  it('writes the link without anybody typing brackets', () => {
    const lines = meeting({ followUps: [fu('Simulator testen', 'PMQ Reconstitution')] });
    expect(lines[1]).toBe('    - [ ] Simulator testen [[PMQ Reconstitution]] 📅 2026-08-31');
    expect(parseTaskLine(lines[1])?.links).toEqual(['PMQ Reconstitution']);
  });

  it('lets one meeting produce tasks for different projects', () => {
    // The whole point, and the thing a single context field on the meeting
    // could never express.
    const lines = meeting({
      followUps: [
        fu('Simulator testen', 'PMQ Reconstitution'),
        fu('Kunden anrufen', 'CN-1095688'),
        fu('Ohne Bezug'),
      ],
    });
    expect(parseTaskLine(lines[1])?.links).toEqual(['PMQ Reconstitution']);
    expect(parseTaskLine(lines[2])?.links).toEqual(['CN-1095688']);
    expect(parseTaskLine(lines[3])?.links).toEqual([]);
  });

  it('takes the row own date when it has one', () => {
    // "Check this next week" is learned in the meeting, so it is set there
    // rather than moved on Monday.
    const lines = meeting({ followUps: [fu('Nachfassen', 'PMQ', '2026-09-07')] });
    expect(parseTaskLine(lines[1])?.due).toBe('2026-09-07');
  });

  it('falls back to the meeting day when the row leaves it blank', () => {
    const lines = meeting({ followUps: [fu('Nachfassen', 'PMQ')] });
    expect(parseTaskLine(lines[1])?.due).toBe(DAY);
  });

  it('keeps them indented under the meeting they came from', () => {
    const lines = meeting({ followUps: [fu('A', 'Job'), fu('B', 'Job')] });
    expect(parseTaskLine(lines[1])?.indent).toBe('    ');
    expect(parseTaskLine(lines[2])?.indent).toBe('    ');
  });

  it('drops a row somebody added and never filled in', () => {
    const lines = meeting({ followUps: [fu('Echt', 'Job'), emptyFollowUp('Job'), fu('  ')] });
    expect(lines).toHaveLength(2);
  });

  it('does not put the meeting own project on a row that names none', () => {
    // The meeting is about one thing and its follow-ups may each be about
    // another. Inheriting would quietly file a task under the wrong project.
    const lines = meeting({ context: 'PMQ Reconstitution', followUps: [fu('Etwas anderes')] });
    expect(lines[0]).toContain('[[PMQ Reconstitution]]');
    expect(parseTaskLine(lines[1])?.links).toEqual([]);
  });
});

describe('the project carrying over to the next row', () => {
  // Several follow-ups for one project in a row is the commonest shape a
  // meeting produces: one project gets discussed, three things come out of it.
  // Re-picking it each time is three dropdowns for one decision.
  it('starts a new row on the project the last one named', () => {
    expect(emptyFollowUp('PMQ Reconstitution')).toEqual({
      text: '',
      context: 'PMQ Reconstitution',
      due: '',
    });
  });

  it('starts blank when there is nothing to carry', () => {
    expect(emptyFollowUp()).toEqual({ text: '', context: '', due: '' });
  });

  it('carries nothing else, because nothing else repeats', () => {
    // Not the text, obviously; and not the date either -- two tasks for one
    // project routinely have different deadlines, and a date copied silently
    // is a date nobody chose.
    expect(emptyFollowUp('Job').text).toBe('');
    expect(emptyFollowUp('Job').due).toBe('');
  });

  it('is wired to the row above in the dialog', () => {
    const modal = readFileSync(join(__dirname, '..', 'src', 'plan', 'add-to-day-modal.ts'), 'utf8');
    expect(modal).toContain("emptyFollowUp(this.draft.followUps.at(-1)?.context ?? '')");
  });
});

describe('a follow-up read back out of a note', () => {
  it('still writes a link somebody typed into the text', () => {
    // Kept whole on the way in, so it goes back out unchanged and the meeting
    // stays editable.
    const lines = meeting({ followUps: [fu('Simulator testen [[PMQ Reconstitution]]')] });
    expect(parseTaskLine(lines[1])?.links).toEqual(['PMQ Reconstitution']);
  });

  it('does not add a second date to text that already names one', () => {
    const lines = meeting({ followUps: [fu('Nachfassen 📅 2026-09-07')] });
    expect(lines[1]).toBe('    - [ ] Nachfassen 📅 2026-09-07');
  });

  it('leaves a date in the text alone even when the row has one too', () => {
    // The row's field loses, and it has to. That text came from a note, and
    // appending a second marker would leave one line saying two different
    // things -- after which it never round-trips again and its meeting
    // silently stops being editable.
    const lines = meeting({ followUps: [fu('Nachfassen 📅 2026-09-07', '', '2026-09-14')] });
    expect(lines[1]).toBe('    - [ ] Nachfassen 📅 2026-09-07');
    expect((lines[1].match(/📅/g) ?? []).length).toBe(1);
  });
});
