/**
 * Reading a task line into the fields a form holds, and refusing to.
 *
 * A form offers four boxes and a task line can say a great deal more than four
 * things, so the refusal is the feature: the fields are composed back and
 * compared with the line they came from, and a line that does not come out the
 * same is not one a form may edit. Nothing here recognises a recurrence rule or
 * a start date by name, which is what keeps the rule honest as the composer
 * grows -- a field added to `composeTaskLine` and not to this file makes lines
 * read-only rather than making them lossy.
 *
 * The two consumers are NODAtrail's meeting follow-ups, which arrive as a bare
 * remainder, and its task editor, which arrives as a `ParsedTask`. Hence the
 * two entry points.
 */
import { describe, expect, it } from 'vitest';
import { parseTaskLine } from '../../src/tasks/line.js';
import { composeTaskFields, splitTaskFields, taskFieldsOf } from '../../src/tasks/fields.js';
import type { EditableTaskFields } from '../../src/tasks/fields.js';
import type { ParsedTask } from '../../src/tasks/types.js';

function task(raw: string): ParsedTask {
  const parsed = parseTaskLine(raw);
  if (!parsed) throw new Error(`not a task line: ${raw}`);
  return parsed;
}

/** The fields of a line the case has already established is editable. */
function fieldsOf(one: ParsedTask): EditableTaskFields {
  const fields = taskFieldsOf(one);
  if (!fields) throw new Error(`refused, and this case is about a line that is not: ${one.raw}`);
  return fields;
}

describe('what a task form may hold', () => {
  it('reads the text, the project, the date and the priority out of a line', () => {
    expect(taskFieldsOf(task('- [ ] Check with PMQ [[CN-1093467]] ⏫ 📅 2026-09-11'))).toEqual({
      text: 'Check with PMQ',
      context: 'CN-1093467',
      due: '2026-09-11',
      priority: 'high',
    });
  });

  it('leaves a tag and a link that are not at the end in the text', () => {
    // Both compose back where they were, so the line survives and the form is
    // merely coarser about them than it is about the trailing link.
    expect(taskFieldsOf(task('- [ ] Prüfen #arbeit [[A]] und [[B]] 📅 2026-09-14'))).toEqual({
      text: 'Prüfen #arbeit [[A]] und',
      context: 'B',
      due: '2026-09-14',
      priority: null,
    });
  });

  it('holds a bare line with nothing on it', () => {
    expect(taskFieldsOf(task('- [ ] Einkaufen'))).toEqual({
      text: 'Einkaufen',
      context: '',
      due: '',
      priority: null,
    });
  });
});

describe('what it refuses', () => {
  // Each of these composes back to something other than the line it came from,
  // which is the whole test: none of them is recognised by name.
  const refused = [
    ['a recurrence rule it would drop', '- [ ] Müll rausbringen 🔁 every week 📅 2026-09-14'],
    ['a second date it has one box for', '- [ ] Prüfen ⏳ 2026-09-10 📅 2026-09-14'],
    ['a start date', '- [ ] Prüfen 🛫 2026-09-10'],
    ['a task already closed', '- [x] Erledigt [[Beruf]]'],
    ['a list marker it does not write', '* [ ] Prüfen [[Beruf]]'],
  ] as const;

  for (const [what, line] of refused) {
    it(`refuses ${what}`, () => {
      expect(taskFieldsOf(task(line))).toBeNull();
    });
  }
});

describe('composing the line again', () => {
  const editable = [
    '- [ ] Einkaufen',
    '- [ ] Prüfen [[Beruf]]',
    '- [ ] Prüfen 📅 2026-09-14',
    '- [ ] Prüfen [[Beruf]] 📅 2026-09-14',
    '- [ ] Prüfen [[Beruf]] ⏫ 📅 2026-09-14',
    '- [ ] Prüfen #arbeit [[Beruf]] 📅 2026-09-14',
    '    - [ ] Nachfassen [[Beruf]] 📅 2026-09-14',
  ];

  it('puts every editable line back exactly as it was', () => {
    for (const raw of editable) {
      const one = task(raw);
      expect(taskFieldsOf(one)).not.toBeNull();
      expect(composeTaskFields(one, fieldsOf(one))).toBe(raw);
    }
  });

  it('keeps a follow-up indented under its meeting', () => {
    const one = task('    - [ ] Nachfassen [[Beruf]]');
    expect(composeTaskFields(one, fieldsOf(one))).toMatch(/^ {4}- \[ \]/);
  });

  it('writes the four fields in the order the parser reads them', () => {
    const one = task('- [ ] Check with PMQ [[CN-1093467]] 📅 2026-09-11');
    expect(
      composeTaskFields(one, {
        text: 'Check with PMQ, follow up',
        context: 'CN-1093467',
        due: '2026-09-18',
        priority: 'high',
      })
    ).toBe('- [ ] Check with PMQ, follow up [[CN-1093467]] ⏫ 📅 2026-09-18');
  });

  it('clears the date when the box is emptied', () => {
    const one = task('- [ ] Prüfen [[Beruf]] 📅 2026-09-14');
    expect(composeTaskFields(one, { ...fieldsOf(one), due: '' })).toBe('- [ ] Prüfen [[Beruf]]');
  });

  it('replaces the project rather than adding a second link', () => {
    const one = task('- [ ] Prüfen [[Beruf]] 📅 2026-09-14');
    const line = composeTaskFields(one, { ...fieldsOf(one), context: 'Privat' });
    expect(line).toBe('- [ ] Prüfen [[Privat]] 📅 2026-09-14');
    expect((line.match(/\[\[/g) ?? []).length).toBe(1);
  });
});

describe('splitting a line nothing has parsed', () => {
  it('lifts the date and the link a follow-up was written with', () => {
    expect(splitTaskFields('Check problem report [[CN-1099213]] 📅 2026-09-14')).toEqual({
      text: 'Check problem report',
      context: 'CN-1099213',
      due: '2026-09-14',
    });
  });

  it('leaves a line naming two days whole', () => {
    // One field, two dates. Lifting one would lose the other on the way out.
    expect(splitTaskFields('Prüfen ⏳ 2026-09-10 📅 2026-09-14')).toEqual({
      text: 'Prüfen ⏳ 2026-09-10 📅 2026-09-14',
      context: '',
      due: '',
    });
  });

  it('leaves a day written some other way alone', () => {
    expect(splitTaskFields('Prüfen 📅 2026-9-4').due).toBe('');
  });
});
