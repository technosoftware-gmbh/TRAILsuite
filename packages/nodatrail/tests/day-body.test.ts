/**
 * Putting a line into a day note.
 *
 * Two rules carry everything that could go wrong here, and both are about a
 * note somebody else wrote.
 *
 * **It inserts and never reorders.** Almost every plan note in the vault this
 * was built for holds migrated content. A function that tidied a note while
 * adding a line to it would be rewriting somebody's records in passing, and
 * that is the failure this module is most careful about: it is silent, and it
 * is found months later.
 *
 * **A missing heading is created, never a template.** The alternative was
 * seeding three headings into every day note, which is three headings a day to
 * delete on the days nothing happened.
 *
 * The section-end rule is the subtle one. A section ends at the next heading of
 * the same level or shallower; a deeper heading belongs to it. Get that
 * backwards and an entry lands in front of a subsection that was part of the
 * section it belonged to.
 */
import { describe, expect, it } from 'vitest';
import { appendUnderHeading } from '../src/plan/day-body';

const FOCUS = '## 🎯 Fokus';
const NOTES = '## 🧠 Gedanken';

describe('adding under a heading that is there', () => {
  it('puts the line at the end of the section, not the top', () => {
    // A day note is read downwards. An entry made at four belongs after the
    // one made at nine.
    const body = `${FOCUS}\n\n- [ ] erste\n`;
    expect(appendUnderHeading(body, [FOCUS], ['- [ ] zweite'])).toBe(
      `${FOCUS}\n\n- [ ] erste\n- [ ] zweite\n`
    );
  });

  it('stops at the next heading of the same level', () => {
    const body = `${FOCUS}\n\n- [ ] erste\n\n${NOTES}\n\n- 💡 Idee\n`;
    expect(appendUnderHeading(body, [FOCUS], ['- [ ] zweite'])).toBe(
      `${FOCUS}\n\n- [ ] erste\n- [ ] zweite\n\n${NOTES}\n\n- 💡 Idee\n`
    );
  });

  it('treats a deeper heading as part of the section', () => {
    // `### Vormittag` under `## Fokus` belongs to Fokus, so a new entry goes
    // after it rather than in front of it.
    const body = `${FOCUS}\n\n### Vormittag\n\n- [ ] erste\n\n${NOTES}\n`;
    expect(appendUnderHeading(body, [FOCUS], ['- [ ] zweite'])).toBe(
      `${FOCUS}\n\n### Vormittag\n\n- [ ] erste\n- [ ] zweite\n\n${NOTES}\n`
    );
  });

  it('matches a heading somebody padded with spaces', () => {
    const body = `  ${FOCUS}  \n\n- [ ] erste\n`;
    expect(appendUnderHeading(body, [FOCUS], ['- [ ] zweite'])).toContain('- [ ] zweite');
  });

  it('adds several lines in the order given', () => {
    // A meeting and the two things said in it are one capture.
    const body = `## 📅 Termine\n\n- 👥 09:00 Standup\n`;
    const next = appendUnderHeading(
      body,
      ['## 📅 Termine'],
      ['- 👥 10:00 Sync mit Marketing', '    - 📝 Launch verschiebt sich.', '    - [ ] Nachfassen']
    );
    expect(next.split('\n').slice(-4, -1)).toEqual([
      '- 👥 10:00 Sync mit Marketing',
      '    - 📝 Launch verschiebt sich.',
      '    - [ ] Nachfassen',
    ]);
  });
});

describe('adding under a heading that is not there', () => {
  it('creates it at the end, under whatever the note already held', () => {
    const body = '# Gedanken\n\n- Erika angerufen.\n';
    expect(appendUnderHeading(body, [NOTES], ['- 💡 Idee'])).toBe(
      `# Gedanken\n\n- Erika angerufen.\n\n${NOTES}\n\n- 💡 Idee\n`
    );
  });

  it('writes the first entry of an empty note without a leading blank', () => {
    expect(appendUnderHeading('', [FOCUS], ['- [ ] erste'])).toBe(`${FOCUS}\n\n- [ ] erste\n`);
  });

  it('does not disturb migrated content it is appending after', () => {
    // The shape almost every existing plan note is in: a --- rule at the top
    // and section separators through the middle.
    const body = '---\n\n**Week 28**\n\n---\n\n# 🇨🇭 Schweiz\n\n- etwas\n';
    const next = appendUnderHeading(body, [NOTES], ['- 💡 Idee']);
    expect(next.startsWith(body.trimEnd())).toBe(true);
    expect(next).toBe(`${body.trimEnd()}\n\n${NOTES}\n\n- 💡 Idee\n`);
  });
});

describe('what it refuses to do', () => {
  it('changes nothing when there is nothing to add', () => {
    const body = `${FOCUS}\n\n- [ ] erste\n`;
    expect(appendUnderHeading(body, [FOCUS], [])).toBe(body);
    expect(appendUnderHeading(body, [FOCUS], ['', '   '])).toBe(body);
  });

  it('never reorders what was already in the note', () => {
    // The rule this module exists to keep, stated as the property rather than
    // as one expected string: every line the note had is still there, in the
    // order it was in. A tidier that sorted or regrouped sections would pass a
    // string comparison somebody had updated to match it, and would fail this.
    const body = `${NOTES}\n\n- 💡 zuerst\n\n${FOCUS}\n\n- [ ] Aufgabe\n\n## Anderes\n\ntext\n`;
    const before = body.split('\n').filter((line) => line.trim() !== '');
    const after = appendUnderHeading(body, [FOCUS], ['- [ ] noch eine']).split('\n');

    let cursor = 0;
    for (const line of before) {
      const found = after.indexOf(line, cursor);
      expect(found, `lost or moved: ${line}`).toBeGreaterThanOrEqual(0);
      cursor = found + 1;
    }
  });

  it('adds exactly the lines it was given and no others', () => {
    const body = `${FOCUS}\n\n- [ ] Aufgabe\n`;
    const next = appendUnderHeading(body, [FOCUS], ['- [ ] noch eine']);
    const added = next.split('\n').length - body.split('\n').length;
    expect(added).toBe(1);
  });
});
