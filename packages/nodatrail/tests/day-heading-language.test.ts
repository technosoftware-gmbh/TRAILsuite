/**
 * The headings this plugin writes into a note, across a change of language.
 *
 * NODAtrail follows Obsidian's language rather than carrying a setting of its
 * own, which is right for everything on screen and dangerous for the three
 * strings that get **written into a note**. A day note's headings are ours, and
 * a vault that switches language would otherwise look for `## 🎯 Fokus` in a
 * note holding `## 🎯 Focus`, fail, and add a second heading beside the first.
 *
 * That is the silent kind of damage: nothing errors, the note looks nearly
 * right, and it is found weeks later in a file somebody keeps records in.
 *
 * The rule is therefore: **one spelling is written, every spelling is
 * recognised.** These tests hold both halves.
 *
 * (This file began as a throwaway probe while chasing why a German vault got
 * English headings. It turned out not to be a bug -- the vault's Obsidian has
 * no language set, so the whole plugin is English -- but the question exposed
 * the real one above, so the probe became its regression test.)
 */
import { describe, expect, it } from 'vitest';
import { tAll } from '../src/lang/I18nManager';
import { deTranslations } from '../src/lang/translations/de';
import { enTranslations } from '../src/lang/translations/en';
import { appendUnderHeading } from '../src/plan/day-body';
import { headingsFor } from '../src/plan/add-to-day';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const DE = deTranslations.day.headings;
const EN = enTranslations.day.headings;

describe('the tables', () => {
  it('spell the headings differently in the two languages', () => {
    // If these ever coincided, every test below would pass for the wrong
    // reason.
    expect(DE.focus).not.toBe(EN.focus);
    expect(DE.schedule).not.toBe(EN.schedule);
    expect(DE.notes).not.toBe(EN.notes);
  });
});

describe('tAll', () => {
  it('returns every language spelling of a key', () => {
    const all = tAll('day.headings.focus');
    expect(all).toContain(DE.focus);
    expect(all).toContain(EN.focus);
  });

  it('deduplicates, so a key both languages share appears once', () => {
    const all = tAll('day.headings.focus');
    expect(new Set(all).size).toBe(all.length);
  });

  it('returns nothing for a key no language has', () => {
    expect(tAll('day.headings.nothingCalledThis')).toEqual([]);
  });
});

describe('a note written in one language, appended to in the other', () => {
  it('finds the existing heading instead of writing a second one', () => {
    const body = `${EN.focus}\n\n- [ ] Zooplus Bestellung\n`;
    const next = appendUnderHeading(
      body,
      // What a German-language vault would want to write, with the English
      // spelling still accepted.
      [DE.focus, EN.focus],
      ['- [ ] Zweite Aufgabe']
    );
    expect(next).toBe(`${EN.focus}\n\n- [ ] Zooplus Bestellung\n- [ ] Zweite Aufgabe\n`);
    expect(next).not.toContain(DE.focus);
  });

  it('writes the preferred spelling when the note has no heading at all', () => {
    const next = appendUnderHeading('', [DE.focus, EN.focus], ['- [ ] Erste']);
    expect(next.startsWith(DE.focus)).toBe(true);
  });

  it('offers both spellings for every kind, whichever language is current', () => {
    for (const [kind, pair] of [
      ['task', [DE.focus, EN.focus]],
      ['meeting', [DE.schedule, EN.schedule]],
      ['idea', [DE.notes, EN.notes]],
    ] as const) {
      const all = headingsFor(DEFAULT_SETTINGS, kind);
      for (const spelling of pair) expect(all).toContain(spelling);
    }
  });

  it('keeps a configured heading first and the defaults behind it', () => {
    // Filling the setting in must not orphan the notes written before it was
    // filled in.
    const mine = { ...DEFAULT_SETTINGS, dayFocusHeading: '## Heute' };
    const all = headingsFor(mine, 'task');
    expect(all[0]).toBe('## Heute');
    expect(all).toContain(EN.focus);
    expect(all).toContain(DE.focus);
  });
});
