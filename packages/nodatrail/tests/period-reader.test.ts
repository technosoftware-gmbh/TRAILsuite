/**
 * Which notes the export treats as period notes: the note at the path its
 * level's template gives, and nothing that merely carries a period's title.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { periodOf } from '../src/plan/period-reader';

const file = (path: string) => ({ path, basename: path.split('/').pop().replace(/\.md$/, '') });

describe('periodOf', () => {
  it('recognises each level at its template path', () => {
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/1 Daily/2026/2026-09-25.md'))?.level).toBe(
      'day'
    );
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/2 Weekly/2026/2026-W39.md'))?.level).toBe(
      'week'
    );
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/3 Monthly/2026/2026-09.md'))?.level).toBe(
      'month'
    );
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/4 Quarterly/2026/2026-Q3.md'))?.level).toBe(
      'quarter'
    );
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/5 Yearly/2026.md'))?.level).toBe('year');
  });

  it('does not take a journal note for a month, though both are titled 2026-09', () => {
    expect(periodOf(DEFAULT_SETTINGS, file('Finance/Journal/2026/2026-09.md'))).toBeNull();
  });

  it('does not take a day note filed under the wrong year', () => {
    expect(periodOf(DEFAULT_SETTINGS, file('0 Plan/1 Daily/2025/2026-09-25.md'))).toBeNull();
  });

  it('follows the template a vault configured', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      dailyPath: '0 Planung/1 Täglich/{YYYY}/{YYYY}-{MM}-{DD}.md',
    };
    expect(periodOf(settings, file('0 Planung/1 Täglich/2026/2026-09-25.md'))?.level).toBe('day');
    expect(periodOf(settings, file('0 Plan/1 Daily/2026/2026-09-25.md'))).toBeNull();
  });

  it('matches a folder setting whose umlaut was stored decomposed', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      dailyPath: '0 Planung/1 Ta\u0308glich/{YYYY}/{YYYY}-{MM}-{DD}.md',
    };
    expect(periodOf(settings, file('0 Planung/1 T\u00e4glich/2026/2026-09-25.md'))?.level).toBe(
      'day'
    );
  });
});
