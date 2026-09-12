/**
 * A note under a task, and everything it must not disturb.
 *
 * The feature is three lines of string handling; the value is in what it
 * refuses to do. A checkbox line is not a format this codebase owns -- the
 * Tasks plugin, Dataview and every other reader of the same vault parse the
 * same line -- so the task line is never touched, and the block under it must
 * never swallow something that was not a comment.
 */
import { describe, expect, it } from 'vitest';
import { scanTasks } from '../../src/tasks/scan.js';
import { taskComment, withTaskComment } from '../../src/tasks/comment.js';
import { present } from '../testing.js';

const only = (text: string, at = 0) => present(scanTasks(text)[at], `task ${at}`);

describe('writing a comment', () => {
  const note = ['# Woche', '', '- [x] Offerte einholen ✅ 2026-08-31', '', '## Notizen'].join('\n');

  it('puts it under the task, indented, and leaves the line alone', () => {
    const out = withTaskComment(note, only(note), 'Zwei von drei Firmen abgesagt.');

    expect(out.split('\n')[2]).toBe('- [x] Offerte einholen ✅ 2026-08-31');
    expect(out.split('\n')[3]).toBe('  Zwei von drei Firmen abgesagt.');
  });

  it('keeps a nested task nested when it comments on one', () => {
    const nested = ['- [ ] Haus', '  - [x] Offerte einholen'].join('\n');
    const out = withTaskComment(nested, only(nested, 1), 'Erledigt.');

    expect(out.split('\n')[2]).toBe('    Erledigt.');
  });

  it('replaces the comment rather than gathering a second one', () => {
    const once = withTaskComment(note, only(note), 'Erste Fassung.');
    const twice = withTaskComment(once, only(once), 'Zweite Fassung.');

    expect(taskComment(twice, only(twice))).toBe('Zweite Fassung.');
    expect(twice).not.toContain('Erste Fassung');
  });

  it('removes it when the comment is emptied', () => {
    const once = withTaskComment(note, only(note), 'Weg damit.');
    const gone = withTaskComment(once, only(once), '   ');

    expect(taskComment(gone, only(gone))).toBeNull();
    expect(gone).toBe(note);
  });

  /**
   * A blank line inside a comment is dropped rather than indented. Writing a
   * line of nothing but spaces works until an editor set to trim trailing
   * whitespace empties it, and then the block ends there and everything under
   * it is orphaned. Several consecutive lines survive that; paragraphs do not.
   */
  it('keeps a comment of several lines, and collapses the blank ones', () => {
    const out = withTaskComment(note, only(note), 'Erste Zeile.\n\nZweite Zeile.');
    const [, , , a, b] = out.split('\n');

    expect(a).toBe('  Erste Zeile.');
    expect(b).toBe('  Zweite Zeile.');
    expect(taskComment(out, only(out))).toBe('Erste Zeile.\nZweite Zeile.');
  });
});

describe('reading a comment', () => {
  it('is null for a task that has none', () => {
    const note = '- [x] Offerte einholen';
    expect(taskComment(note, only(note))).toBeNull();
  });

  /**
   * The one that would do damage. A sub-task read as its parent's comment
   * would be written back as prose, turning somebody's checkbox into a
   * sentence.
   */
  it('stops at a nested task rather than swallowing it', () => {
    const note = ['- [x] Haus', '  - [ ] Offerte einholen'].join('\n');
    expect(taskComment(note, only(note))).toBeNull();
  });

  it('stops at a blank line', () => {
    const note = ['- [x] Haus', '  Ein Satz.', '', '  Nicht mehr dazu.'].join('\n');
    expect(taskComment(note, only(note))).toBe('Ein Satz.');
  });

  it('stops at anything indented no deeper than the task', () => {
    const note = ['- [x] Haus', '  Ein Satz.', '- [ ] Garten'].join('\n');
    expect(taskComment(note, only(note))).toBe('Ein Satz.');
    expect(scanTasks(note)).toHaveLength(2);
  });

  /**
   * The case above is caught by the nested-task check before the indentation
   * one is reached, so it passed with the depth guard removed. This is the
   * depth guard on its own: ordinary prose at the same level as the task, which
   * is the note's own text and not a comment on anything.
   */
  it('stops at prose at the same level, which belongs to the note', () => {
    const note = ['- [x] Haus', '  Ein Satz.', 'Das hier ist der Fliesstext.'].join('\n');
    expect(taskComment(note, only(note))).toBe('Ein Satz.');
  });

  it('reads a tab-indented comment, since an editor may write either', () => {
    const note = ['- [x] Haus', '\tMit Tabulator.'].join('\n');
    expect(taskComment(note, only(note))).toBe('Mit Tabulator.');
  });

  it('leaves the note untouched at the end of a file', () => {
    const note = '- [x] Haus';
    const out = withTaskComment(note, only(note), 'Am Ende.');

    expect(out).toBe('- [x] Haus\n  Am Ende.');
    expect(taskComment(out, only(out))).toBe('Am Ende.');
  });
});
