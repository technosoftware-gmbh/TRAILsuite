/**
 * What each kind of entry becomes in a note.
 *
 * The point of the capture dialog is that nobody types `- [ ]`, a wikilink, a
 * priority emoji or a date marker. Which means **this file is where the format
 * somebody's notes end up in is actually decided**, and it is worth being
 * explicit about the three claims it makes.
 *
 * A task is a checkbox in the Tasks plugin's format, composed by the core, so
 * the plan view can already read and tick it and every other reader of the
 * vault makes sense of it.
 *
 * A starred task is a **high-priority** task rather than a star of our own.
 * Invent a second way to say "this matters" and the plan view's urgency sort
 * cannot see it.
 *
 * A meeting is several lines written at once, which is the whole reason a
 * meeting is captured as a unit: what was said and what follows are its
 * children in the same breath, so nothing has to parse the note back later to
 * work out which meeting a note belonged under.
 */
import { describe, expect, it } from 'vitest';
import { parseTaskLine } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { emptyDraft, entryLines, headingsFor } from '../src/plan/add-to-day';
import type { NODAtrailSettings } from '../src/settings/types';

const SETTINGS: NODAtrailSettings = { ...DEFAULT_SETTINGS };

const draft = (over: Partial<ReturnType<typeof emptyDraft>>) => ({
  ...emptyDraft(over.kind ?? 'task'),
  ...over,
});

/** A follow-up row, as the editor holds one. */
const fu = (text: string, context = '', due = '') => ({ text, context, due });

/** The note being written into. Every entry is dated with it unless it says otherwise. */
const DAY = '2026-08-28';

/** `entryLines` with the day supplied, which is how every caller uses it. */
const lines = (
  settings: NODAtrailSettings,
  over: Partial<ReturnType<typeof emptyDraft>>,
  day = DAY
) => entryLines(settings, draft(over), day);

describe('the spacing of what is written', () => {
  it('writes one space where the text carried several', () => {
    // A line this plugin writes has to be a line it can read back.
    // `parseScheduleLine` collapses whitespace as it reads, so a double space
    // written here composes back with one and the entry is read-only from the
    // moment it is saved. It looked like a bug in the editor and was a bug in
    // the writer, and a calendar import wrote a week of them from an Outlook
    // SUMMARY reading "PTM  incl. Change Board".
    expect(lines(SETTINGS, { kind: 'meeting', text: 'PTM  incl. Change Board' })).toEqual([
      '- 👥 PTM incl. Change Board',
    ]);
  });

  it('leaves a wikilink alone, spaces and all', () => {
    // A note title may hold two spaces legitimately, and rewriting one breaks
    // the link rather than tidying it.
    const [line] = lines(SETTINGS, { kind: 'meeting', text: 'Sync', context: 'A  B' });
    expect(line).toContain('[[A  B]]');
  });

  it('writes one space in a follow-up too', () => {
    const written = lines(SETTINGS, {
      kind: 'meeting',
      text: 'Sync',
      followUps: [fu('Angebot   schreiben')],
    });
    expect(written[1]).toBe(`    - [ ] Angebot schreiben 📅 ${DAY}`);
  });
});

describe('a task', () => {
  it('is a checkbox the core composed and the core can read back', () => {
    const [line] = lines(SETTINGS, { kind: 'task', text: 'Abo prüfen' });
    expect(line).toBe(`- [ ] Abo prüfen 📅 ${DAY}`);
    expect(parseTaskLine(line)?.status).toBe('todo');
  });

  it('names its project as a bare wikilink', () => {
    const [line] = lines(SETTINGS, { kind: 'task', text: 'Q3-Budget', context: 'Q3 Finanzen' });
    expect(line).toBe(`- [ ] Q3-Budget [[Q3 Finanzen]] 📅 ${DAY}`);
    expect(parseTaskLine(line)?.links).toEqual(['Q3 Finanzen']);
  });

  it('writes each named level as the marker the Tasks plugin reads', () => {
    // Four names, four of the format's five markers. A claim only this plugin
    // understood would be invisible to the plan view's urgency sort and to
    // every other reader of the same vault.
    const at = (level: 'critical' | 'high' | 'medium' | 'low') =>
      parseTaskLine(lines(SETTINGS, { kind: 'task', text: 'x', priority: level })[0])?.priority;
    expect(at('critical')).toBe('highest');
    expect(at('high')).toBe('high');
    expect(at('medium')).toBe('medium');
    expect(at('low')).toBe('low');
  });

  it('says nothing about a priority nobody set', () => {
    const [line] = lines(SETTINGS, { kind: 'task', text: 'x', priority: null });
    expect(parseTaskLine(line)?.priority).toBeNull();
    expect(line).not.toContain('⭐');
  });

  it('carries a due date the parser reads back', () => {
    const [line] = lines(SETTINGS, { kind: 'task', text: 'x', due: '2026-08-31' });
    expect(parseTaskLine(line)?.due).toBe('2026-08-31');
  });

  it('falls back to the note it is written into when no date was given', () => {
    // **The rule that makes an entry visible at all.** A task with no date
    // falls in no period -- `placingDay` is null and every view filters by
    // date -- so an undated task would vanish the moment it was saved. An
    // entry in a day's note is that day's unless it says otherwise.
    const [line] = lines(SETTINGS, { kind: 'task', text: 'x', due: null });
    expect(parseTaskLine(line)?.due).toBe(DAY);
  });

  it('still prefers a date that was given', () => {
    const [line] = lines(SETTINGS, { kind: 'task', text: 'x', due: '2026-09-04' });
    expect(parseTaskLine(line)?.due).toBe('2026-09-04');
  });
});

describe('a meeting', () => {
  it('is one line plus its children, in the order they are read', () => {
    expect(
      lines(SETTINGS, {
        kind: 'meeting',
        startTime: '10:00',
        endTime: '11:30',
        text: 'Sync mit Marketing',
        context: 'Kampagne Herbst',
        notes: 'Launch verschiebt sich.\n\nZwei Wochen.',
        followUps: [fu('Beim Design nachfassen')],
      })
    ).toEqual([
      '- 👥 10:00-11:30 Sync mit Marketing [[Kampagne Herbst]]',
      '    - 📝 Launch verschiebt sich.',
      '    - 📝 Zwei Wochen.',
      `    - [ ] Beim Design nachfassen 📅 ${DAY}`,
    ]);
  });

  it('drops the blank lines somebody left between notes', () => {
    const written = lines(SETTINGS, { kind: 'meeting', text: 'x', notes: '\n\neins\n\n\nzwei\n' });
    expect(written).toHaveLength(3);
  });

  it('leaves no gap where a time was not given', () => {
    // The absent part must leave no trace, rather than a double space that
    // nobody sees until they read the raw file.
    const [line] = lines(SETTINGS, { kind: 'meeting', text: 'Zahnarzt' });
    expect(line).toBe('- 👥 Zahnarzt');
  });

  it('writes a span as one word, and half a span as what it is', () => {
    // A meeting is a span rather than an instant: what somebody wants to see
    // is not that a thing started at eleven but that eleven to twelve is gone.
    const at = (over: Record<string, string>) =>
      lines(SETTINGS, { kind: 'meeting', text: 'PMQ', ...over })[0];
    expect(at({ startTime: '11:00', endTime: '12:00' })).toBe('- 👥 11:00-12:00 PMQ');
    expect(at({ startTime: '11:00' })).toBe('- 👥 11:00 PMQ');
    // An end with no start is a deadline, and refusing to write it would lose it.
    expect(at({ endTime: '12:00' })).toBe('- 👥 -12:00 PMQ');
  });

  it('dates a follow-up with the meeting day, so it is not invisible', () => {
    // Where the rule matters most: a follow-up is typed into a box with no
    // date field at all, so without this every one of them would fall in no
    // period and never appear in any view.
    const written = lines(SETTINGS, { kind: 'meeting', text: 'x', followUps: [fu('Nachfassen')] });
    expect(parseTaskLine(written[1])?.due).toBe(DAY);
  });

  it('does not add a second date to a follow-up that already names one', () => {
    // A follow-up moved to another day comes back through here when its
    // meeting is edited. Appending a second date would leave one line saying
    // two different things, and it would never round-trip again.
    const written = lines(SETTINGS, {
      kind: 'meeting',
      text: 'x',
      followUps: [fu('Nachfassen 📅 2026-09-07')],
    });
    expect(written[1]).toBe('    - [ ] Nachfassen 📅 2026-09-07');
  });

  it('leaves a follow-up scheduled or started elsewhere alone too', () => {
    for (const marker of ['⏳', '🛫']) {
      const written = lines(SETTINGS, {
        kind: 'meeting',
        text: 'x',
        followUps: [fu(`Nachfassen ${marker} 2026-09-07`)],
      });
      expect(written[1]).not.toContain('📅');
    }
  });

  it('adds no date at all when composing an entry already in a note', () => {
    // The other half of the rule, and the one that keeps old notes editable:
    // composing without a day reproduces an undated follow-up exactly, so
    // every meeting written before this rule existed stays editable.
    const written = entryLines(
      SETTINGS,
      draft({ kind: 'meeting', text: 'x', followUps: [fu('Nachfassen')] })
    );
    expect(written[1]).toBe('    - [ ] Nachfassen');
  });

  it('writes a follow-up as a real task, so the plan view can tick it', () => {
    const written = lines(SETTINGS, { kind: 'meeting', text: 'x', followUps: [fu('Nachfassen')] });
    const follow = parseTaskLine(written[1]);
    expect(follow?.status).toBe('todo');
    expect(follow?.indent).toBe('    ');
  });
});

describe('a note and an idea', () => {
  it('carry their own marker and go under the same heading', () => {
    expect(lines(SETTINGS, { kind: 'note', text: 'Artikel gelesen' })).toEqual([
      '- 📝 Artikel gelesen',
    ]);
    expect(lines(SETTINGS, { kind: 'idea', text: 'Template bauen' })).toEqual([
      '- 💡 Template bauen',
    ]);
    expect(headingsFor(SETTINGS, 'note')).toEqual(headingsFor(SETTINGS, 'idea'));
  });

  it('writes a plain bullet when the marker setting is blank', () => {
    // Blank is a real answer for somebody who does not want emoji in a note,
    // and it must not leave a dangling space where the marker would have been.
    const plain = { ...SETTINGS, dayIdeaMarker: '' };
    expect(lines(plain, { kind: 'idea', text: 'Template bauen' })).toEqual(['- Template bauen']);
  });
});

describe('what it refuses to write', () => {
  it('writes nothing at all for an entry with no text', () => {
    // An empty bullet in somebody's records is worse than a dialog that did
    // nothing, and the dialog blocks on this too.
    expect(lines(SETTINGS, { kind: 'task', text: '   ' })).toEqual([]);
    expect(lines(SETTINGS, { kind: 'meeting', text: '', notes: 'etwas' })).toEqual([]);
  });
});

describe('the headings', () => {
  it('fall back to the translated default while the setting is blank', () => {
    expect(SETTINGS.dayFocusHeading).toBe('');
    const [first] = headingsFor(SETTINGS, 'task');
    expect(first).toBeDefined();
    expect(first.startsWith('##')).toBe(true);
  });

  it('are taken over by a setting that has been filled in', () => {
    const mine = { ...SETTINGS, dayFocusHeading: '## Heute' };
    expect(headingsFor(mine, 'task')[0]).toBe('## Heute');
  });

  it('still recognise the defaults a note may already carry', () => {
    // The bug this prevents: fill the setting in, and every note written
    // before that keeps its old heading. Writing only the new one would put a
    // second heading beside the first in a note somebody keeps records in.
    const mine = { ...SETTINGS, dayFocusHeading: '## Heute' };
    expect(headingsFor(mine, 'task').length).toBeGreaterThan(1);
    expect(headingsFor(mine, 'task')).toContain('## 🎯 Focus');
  });

  it('offers every language spelling, so switching language finds the old notes', () => {
    // NODAtrail follows Obsidian's language. A vault that switches it must not
    // gain a second set of headings in its day notes.
    const all = headingsFor(SETTINGS, 'task');
    expect(all).toContain('## 🎯 Focus');
    expect(all).toContain('## 🎯 Fokus');
  });
});
