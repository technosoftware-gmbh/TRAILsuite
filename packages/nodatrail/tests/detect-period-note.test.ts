/**
 * `detectPeriodNote`, which decides whether a period command applies to the note
 * in front of you.
 *
 * Two things are pinned here. The ordinary behaviour, including the reason it
 * takes settings at all -- a title of the right shape for the wrong template is
 * no period rather than a period the caller would then act on. And the one
 * collision it is known to get wrong, so that it stays a recorded decision
 * rather than something discovered twice.
 */
import { describe, expect, it } from 'vitest';
import { detectPeriodNote } from '../src/plan/detect';
import { journalTitleFor } from '../src/ledger/write-ledger';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const SEPTEMBER = new Date(2026, 8, 15);

describe('detectPeriodNote', () => {
  it('reads each of the five levels off its own title shape', () => {
    const levels = ['2026-09-15', '2026-W38', '2026-09', '2026-Q3', '2026'].map(
      (title) => detectPeriodNote(DEFAULT_SETTINGS, title)?.level ?? null
    );

    expect(levels).toEqual(['day', 'week', 'month', 'quarter', 'year']);
  });

  it('gives back the first day of the period', () => {
    const month = detectPeriodNote(DEFAULT_SETTINGS, '2026-09');

    expect(month?.date.getFullYear()).toBe(2026);
    expect(month?.date.getMonth()).toBe(8);
    expect(month?.date.getDate()).toBe(1);
  });

  it('is nothing at all for a title of no period shape', () => {
    for (const title of ['Groceries', '2026-13', '2026-W99', 'September 2026', '']) {
      expect(detectPeriodNote(DEFAULT_SETTINGS, title), title).toBeNull();
    }
  });

  it('refuses a title the vault template would not have produced', () => {
    // The reason the function takes settings. A vault whose day notes are named
    // `Day 2026-09-15` should not have a bare `2026-09-15` acted on as one of
    // its day notes, because whatever wrote that note, this vault did not.
    const renamed = {
      ...DEFAULT_SETTINGS,
      dailyPath: '0 Plan/1 Daily/{YYYY}/Day {YYYY}-{MM}-{DD}.md',
    };

    expect(detectPeriodNote(renamed, '2026-09-15')).toBeNull();
  });

  it('narrows only, so a renamed template loses the level rather than moving it', () => {
    // Worth pinning because the comment on the function used to read the other
    // way. `detectPeriodLevel` runs on the raw title first, and it knows five
    // fixed shapes, so a template that renames its notes is not detected under
    // the new name either: the vault simply has no day notes this function can
    // see, and the period commands go quiet on them.
    //
    // Defensible as failing safe -- acting on the wrong note is worse than
    // acting on none -- but it is a narrowing, not a translation, and the two
    // are easy to confuse from the signature.
    const renamed = {
      ...DEFAULT_SETTINGS,
      dailyPath: '0 Plan/1 Daily/{YYYY}/Day {YYYY}-{MM}-{DD}.md',
    };

    expect(detectPeriodNote(renamed, 'Day 2026-09-15')).toBeNull();
    // The other four levels are untouched by that vault's one renamed template.
    expect(detectPeriodNote(renamed, '2026-09')?.level).toBe('month');
  });
});

describe('the one collision it gets wrong, on purpose', () => {
  it('reports a journal note as a month note', () => {
    // `journalTitleFor` and the monthly period note both produce `2026-09`, in
    // different folders, and this function matches on title alone. Every fix
    // reverses something: gating on the folder gives up recognising a note that
    // was moved, and renaming journal notes renames a vault's existing ones.
    //
    // So this asserts the wrong answer deliberately. If it ever starts failing,
    // somebody has changed one of those two decisions, and this test is where
    // they find out what else that changes.
    expect(journalTitleFor(SEPTEMBER)).toBe('2026-09');
    expect(detectPeriodNote(DEFAULT_SETTINGS, journalTitleFor(SEPTEMBER))?.level).toBe('month');
  });

  it('costs nothing beyond a command offering itself, because the strip finds no block', async () => {
    // What the false positive actually gates is `Remove navigation block`.
    // `stripNavigationBlock` consumes only nav-shaped lines at the very top of a
    // body, so a journal note that begins with postings comes back byte for
    // byte and the command reports no change.
    const { stripNavigationBlock } = await import('../src/plan/nav-block');
    const journal =
      '\n| Date | Account | Debit | Credit |\n|---|---|---|---|\n| 2026-09-01 | 1011 | | 320.00 |\n';

    expect(stripNavigationBlock(journal)).toBe(journal);
  });
});
