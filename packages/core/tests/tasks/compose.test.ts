/**
 * Writing a checkbox line, and reading it back.
 *
 * This is the first thing in the module that writes a line rather than editing
 * one, and the property that matters is not what the string looks like -- it is
 * that **the parser beside it reads back exactly what was put in.** A composer
 * that drifted from its own parser would produce a task the plan view could not
 * see the due date of, in a note that looked right to a human.
 *
 * So most of this file is round trips. The two tests that do assert on the
 * literal string are there because the field order is the Tasks plugin's rather
 * than ours: another reader of the same vault has to make sense of the line,
 * and getting the order wrong is invisible here and visible there.
 */
import { describe, expect, it } from 'vitest';
import { completeTaskLine, composeTaskLine, parseTaskLine } from '../../src/tasks/line.js';

const DUE = new Date(2026, 7, 31);

/** Compose then parse, which is the shape almost every test here wants. */
function roundTrip(draft: Parameters<typeof composeTaskLine>[0]) {
  const line = composeTaskLine(draft);
  const parsed = parseTaskLine(line);
  expect(parsed).not.toBeNull();
  return { line, task: parsed! };
}

describe('composing a task line', () => {
  it('writes the bare case as a plain open checkbox', () => {
    expect(composeTaskLine({ text: 'Abo prüfen' })).toBe('- [ ] Abo prüfen');
  });

  it('puts the fields in the order the Tasks plugin writes them', () => {
    // Description, links, priority, then the dated fields. This is the one
    // assertion about the literal string that is worth making.
    expect(
      composeTaskLine({
        text: 'Q3-Budget fertigstellen',
        links: ['Q3 Finanzen'],
        priority: 'high',
        due: DUE,
      })
    ).toBe('- [ ] Q3-Budget fertigstellen [[Q3 Finanzen]] ⏫ 📅 2026-08-31');
  });

  it('reads back everything it was given', () => {
    const { task } = roundTrip({
      text: 'Q3-Budget fertigstellen',
      links: ['Q3 Finanzen', 'Gesundheit'],
      priority: 'high',
      due: DUE,
    });
    expect(task.status).toBe('todo');
    expect(task.text).toBe('Q3-Budget fertigstellen [[Q3 Finanzen]] [[Gesundheit]]');
    expect(task.links).toEqual(['Q3 Finanzen', 'Gesundheit']);
    expect(task.priority).toBe('high');
    expect(task.due).toBe('2026-08-31');
  });

  it('says nothing about a field it was not given', () => {
    // Omitted has to mean the line is silent, not that the line says "none".
    const { task } = roundTrip({ text: 'Abo prüfen' });
    expect(task.priority).toBeNull();
    expect(task.due).toBeNull();
    expect(task.scheduled).toBeNull();
    expect(task.links).toEqual([]);
    expect(task.recurrence).toBeNull();
  });

  it('keeps an indented task indented', () => {
    const { line, task } = roundTrip({
      text: 'Am Montag nachfassen',
      indent: '    ',
      due: DUE,
    });
    expect(line.startsWith('    - [ ] ')).toBe(true);
    expect(task.indent).toBe('    ');
  });

  it('writes a link with no alias', () => {
    // An alias would be a second place the project's name is spelled, and
    // renaming the project would leave the alias saying the old name.
    expect(composeTaskLine({ text: 'x', links: ['Q3 Finanzen'] })).toContain('[[Q3 Finanzen]]');
    expect(composeTaskLine({ text: 'x', links: ['Q3 Finanzen'] })).not.toContain('|');
  });

  it('drops a blank link rather than writing empty brackets', () => {
    // `[[]]` parses as no link at all, so the line would look wrong and read
    // fine, which is the worst combination available.
    expect(composeTaskLine({ text: 'x', links: ['', '  '] })).toBe('- [ ] x');
  });

  it('trims the text, so a stray space does not become part of the task', () => {
    expect(composeTaskLine({ text: '  Abo prüfen  ', due: DUE })).toBe(
      '- [ ] Abo prüfen 📅 2026-08-31'
    );
  });

  it('survives being ticked, which is the only other write in this module', () => {
    // The two writes have to agree about the line, and this is where that is
    // checked: compose one, tick it, and it is still a task with its fields.
    const { task } = roundTrip({ text: 'Abo prüfen', due: DUE, priority: 'high' });
    const ticked = parseTaskLine(completeTaskLine(task, new Date(2026, 7, 28)));
    expect(ticked?.status).toBe('done');
    expect(ticked?.due).toBe('2026-08-31');
    expect(ticked?.priority).toBe('high');
  });
});
