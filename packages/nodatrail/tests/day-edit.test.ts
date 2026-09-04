/**
 * Editing an entry that is already in somebody's note.
 *
 * This is the first write in the day-note feature that touches a line rather
 * than adding one, and two rules carry all of its safety.
 *
 * **An entry is editable only when the plugin can reproduce its line exactly.**
 * Every candidate is parsed into a draft and the draft composed back into a
 * line; equal means the dialog holds everything the line says. Different means
 * the line carries something with no field behind it -- a tag, an unfamiliar
 * emoji, somebody's own wording -- and the entry is shown, is not offered for
 * editing, and opens the note instead. Without that rule, correcting a
 * meeting's time silently drops whatever else was on the line.
 *
 * **The span is re-checked against the file before it is written to.** Line
 * numbers come from a render that may be minutes old. A note edited in Obsidian
 * meanwhile has moved them, and writing to a remembered index would overwrite
 * whatever had taken that line. That is checked in `add-to-day-modal.ts`, and
 * the source test at the bottom pins it, because the alternative to a source
 * test there is no test at all.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { entryLines } from '../src/plan/add-to-day';
import { replaceLines } from '../src/plan/day-body';

const SCHEDULE = '## 📅 Schedule';
const THOUGHTS = '## 🧠 Thoughts';

/**
 * The reader is async and wants an App, so its pure halves are exercised
 * through the module. The file is a stub carrying only what the reader uses:
 * its basename, which is the day every entry in it is dated with.
 */
async function entriesOf(body: string, settings = DEFAULT_SETTINGS, day = '2026-08-28') {
  const module = await import('../src/plan/read-day');
  const fake = {
    vault: { read: () => Promise.resolve(`---\ntype: day\n---\n${body}`) },
  };
  // hostFor() wraps app.vault; the reader only ever calls read().
  return module.readDayEntries({ vault: fake.vault, metadataCache: {} } as never, settings, {
    basename: day,
  } as never);
}

describe('what may be edited', () => {
  it('offers an entry the dialog wrote', async () => {
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00-12:00 PMQ\n`);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].editable).toBe(true);
    expect(meetings[0].draft.startTime).toBe('11:00');
    expect(meetings[0].draft.endTime).toBe('12:00');
  });

  it('refuses an entry naming more than the dialog can hold', async () => {
    // Two links, and the dialog has one context field. Composing the draft
    // back would write one of them and drop the other, so the entry is not
    // offered for editing at all.
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 Sync [[A]] [[B]]\n`);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].editable).toBe(false);
  });

  it('offers an entry whose spacing it would normalise, because nothing is lost', async () => {
    // This used to be refused, and the test below it says why that was wrong:
    // "the rule is about what the round trip loses, not about what looks
    // unusual." A run of spaces loses nothing -- Markdown renders two as one
    // -- so refusing left an entry permanently uneditable in exchange for
    // nothing at all.
    //
    // It was not hypothetical. `parseScheduleLine` collapses whitespace as it
    // reads, so any line carrying a double space could never compose back to
    // itself, and a calendar import had just written a week of them from an
    // Outlook SUMMARY reading "PTM  incl. Change Board".
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 PMQ   mit   Rolf\n`);
    expect(meetings[0].editable).toBe(true);
    // And editing it writes the tidy spelling, which is the whole of the
    // change: one space where there were three, on a line somebody chose to
    // edit.
    expect(meetings[0].draft.text).toBe('PMQ mit Rolf');
  });

  it('still refuses a child indented differently from how it would be written', async () => {
    // Leading whitespace says which meeting a child belongs to, and how deep
    // it sits is a choice somebody made in their own note. The looser reading
    // above starts at the first non-space character precisely so it cannot
    // reach in and re-indent one.
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 Sync\n        - 📝 Notiz\n`);
    expect(meetings[0].editable).toBe(false);
  });

  it('still refuses an entry with something trailing it, which is a line break', async () => {
    // Two spaces at the end of a line are a hard break in Markdown, and that
    // is content rather than spacing. The looser reading above deliberately
    // stops at the last non-space character.
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 PMQ  \n`);
    expect(meetings[0].editable).toBe(false);
  });

  it('still shows what it will not edit', async () => {
    // Refusing to edit is not refusing to display: the day is still the day.
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 Sync [[A]] [[B]]\n`);
    expect(meetings[0].label).toContain('Sync');
    expect(meetings[0].links).toEqual(['A', 'B']);
  });

  it('keeps a tag editable, because the tag rides along in the text', async () => {
    // The rule is about what the round trip loses, not about what looks
    // unusual. A tag survives being carried in the text field, so editing the
    // time is safe and is offered.
    const { meetings } = await entriesOf(`${SCHEDULE}\n\n- 👥 11:00 PMQ #arbeit\n`);
    expect(meetings[0].editable).toBe(true);
    expect(meetings[0].draft.text).toContain('#arbeit');
  });

  it('reads a meeting together with its children', async () => {
    const { meetings } = await entriesOf(
      `${SCHEDULE}\n\n- 👥 10:00 Sync\n    - 📝 Verschiebt sich.\n    - [ ] Nachfassen\n`
    );
    expect(meetings[0].draft.notes).toBe('Verschiebt sich.');
    // Read back as one text field per row: the remainder is kept whole so the
    // round trip is exact, which is what decides whether the meeting may be
    // edited at all.
    expect(meetings[0].draft.followUps).toEqual([{ text: 'Nachfassen', context: '', due: '' }]);
    // Half open and covering all three lines, so deleting takes the children.
    expect(meetings[0].to - meetings[0].from).toBe(3);
    expect(meetings[0].editable).toBe(true);
  });

  it('stays editable after a follow-up has been moved to another day', async () => {
    // The case that ties the two features together. A follow-up is written
    // with the meeting's day, and moving it rewrites that date in place. When
    // the meeting is next opened, composing it back must produce the moved
    // date rather than the meeting's own -- otherwise the round trip fails,
    // the meeting quietly becomes read-only, and the reason would be invisible.
    const { meetings } = await entriesOf(
      `${SCHEDULE}\n\n- 👥 11:00-12:00 PMQ\n    - [ ] Nachfassen 📅 2026-09-07\n`
    );
    expect(meetings).toHaveLength(1);
    expect(meetings[0].draft.followUps).toEqual([
      { text: 'Nachfassen 📅 2026-09-07', context: '', due: '' },
    ]);
    expect(meetings[0].editable).toBe(true);
  });

  it('keeps a follow-up dated with the note when it has not been moved', async () => {
    const { meetings } = await entriesOf(
      `${SCHEDULE}\n\n- 👥 11:00 PMQ\n    - [ ] Nachfassen 📅 2026-08-28\n`
    );
    expect(meetings[0].editable).toBe(true);
  });

  it('tells a note from an idea by the marker it carries', async () => {
    const { thoughts } = await entriesOf(
      `${THOUGHTS}\n\n- 💡 Template bauen\n- 📝 Artikel gelesen\n`
    );
    expect(thoughts.map((entry) => entry.kind)).toEqual(['idea', 'note']);
    expect(thoughts.every((entry) => entry.editable)).toBe(true);
  });

  it('reads a bullet with no marker as a note rather than an idea', async () => {
    // The milder reading: it does not claim somebody wrote down an idea when
    // they wrote down a fact.
    const { thoughts } = await entriesOf(`${THOUGHTS}\n\n- Einfach etwas\n`);
    expect(thoughts[0].kind).toBe('note');
  });
});

describe('replacing an entry in place', () => {
  const body = `${SCHEDULE}\n\n- 👥 11:00 PMQ\n- 👥 14:00 Zahnarzt\n`;

  it('rewrites only the span it was given', () => {
    expect(replaceLines(body, 2, 3, ['- 👥 11:00-12:00 PMQ'])).toBe(
      `${SCHEDULE}\n\n- 👥 11:00-12:00 PMQ\n- 👥 14:00 Zahnarzt\n`
    );
  });

  it('deletes a span when given nothing', () => {
    expect(replaceLines(body, 2, 3, [])).toBe(`${SCHEDULE}\n\n- 👥 14:00 Zahnarzt\n`);
  });

  it('takes a meeting and its children together', () => {
    const withChild = `${SCHEDULE}\n\n- 👥 10:00 Sync\n    - 📝 etwas\n- 👥 14:00 Zahnarzt\n`;
    expect(replaceLines(withChild, 2, 4, [])).toBe(`${SCHEDULE}\n\n- 👥 14:00 Zahnarzt\n`);
  });

  it('keeps the blank line that separates a section from the next heading', () => {
    // Deleting the last entry of a section must not pull the next heading up
    // against the one above it.
    const two = `${SCHEDULE}\n\n- 👥 11:00 PMQ\n\n${THOUGHTS}\n\n- 💡 Idee\n`;
    expect(replaceLines(two, 2, 3, [])).toBe(`${SCHEDULE}\n\n${THOUGHTS}\n\n- 💡 Idee\n`);
  });

  it('refuses a span that is not in the body', () => {
    expect(replaceLines(body, 99, 100, ['x'])).toBe(body);
    expect(replaceLines(body, 3, 2, ['x'])).toBe(body);
  });
});

describe('the guard against a note that moved', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'plan', 'add-to-day-modal.ts'), 'utf8');

  it('re-reads the note and re-checks the span before writing', () => {
    expect(source).toContain('const text = await host.vault.read(file);');
    expect(source).toContain('const current = body.split');
    expect(source).toMatch(/if \(moved\) throw new Error\(t\('day\.moved'\)\);/);
  });

  it('compares the lines rather than only their count', () => {
    // A note edited to the same length would otherwise pass the guard and be
    // overwritten, which is the case somebody would never reproduce.
    expect(source).toContain('current.some((line, index) => line !== original[index])');
  });

  it('deletes before appending when an edit changes the kind', () => {
    // In that order on purpose: a failure between the two leaves the entry
    // missing, which somebody notices, rather than duplicated, which they do
    // not.
    const at = source.indexOf('target.entry.kind === this.draft.kind');
    const branch = source.slice(at, at + 600);
    expect(branch.indexOf('this.rewrite(target.file, target.entry, [])')).toBeLessThan(
      branch.indexOf('this.appendTo(target.file')
    );
  });
});

describe('the round trip the editable flag depends on', () => {
  it('is the same composer the dialog writes with', () => {
    // If these ever diverged, `editable` would be answering a different
    // question from the one the write asks.
    const line = entryLines(
      DEFAULT_SETTINGS,
      {
        kind: 'meeting',
        text: 'PMQ',
        context: '',
        due: null,
        // `important: false` until the four named levels replaced it. The
        // fixture kept the dead key and never set the real one.
        priority: null,
        startTime: '11:00',
        endTime: '12:00',
        attendance: '',
        notes: '',
        followUps: [],
      },
      '2026-08-28'
    );
    expect(line).toEqual(['- 👥 11:00-12:00 PMQ']);
  });
});
