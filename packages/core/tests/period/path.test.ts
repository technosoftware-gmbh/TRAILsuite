import { describe, expect, it } from 'vitest';
import {
  expandPeriodPath,
  periodFolder,
  periodTitleFromTemplate,
  templateMatchesTitle,
} from '../../src/period/path.js';

const DATE = new Date(2026, 7, 22);

/** The five shipped templates, so the defaults are checked rather than assumed. */
const TEMPLATES = {
  day: '0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md',
  week: '0 Plan/2 Weekly/{GGGG}/{GGGG}-W{WW}.md',
  month: '0 Plan/3 Monthly/{YYYY}/{YYYY}-{MM}.md',
  quarter: '0 Plan/4 Quarterly/{YYYY}/{YYYY}-Q{Q}.md',
  year: '0 Plan/5 Yearly/{YYYY}.md',
};

describe('expandPeriodPath', () => {
  it('produces the paths this vault already uses', () => {
    expect(expandPeriodPath(TEMPLATES.day, DATE)).toBe('0 Plan/1 Daily/2026/2026-08-22.md');
    expect(expandPeriodPath(TEMPLATES.week, DATE)).toBe('0 Plan/2 Weekly/2026/2026-W34.md');
    expect(expandPeriodPath(TEMPLATES.month, DATE)).toBe('0 Plan/3 Monthly/2026/2026-08.md');
    expect(expandPeriodPath(TEMPLATES.quarter, DATE)).toBe('0 Plan/4 Quarterly/2026/2026-Q3.md');
    expect(expandPeriodPath(TEMPLATES.year, DATE)).toBe('0 Plan/5 Yearly/2026.md');
  });

  it('pads month, day and week to two digits', () => {
    expect(expandPeriodPath('{YYYY}-{MM}-{DD}', new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(expandPeriodPath('{GGGG}-W{WW}', new Date(2026, 0, 5))).toBe('2026-W02');
  });

  it('uses the ISO week-year, which is the whole reason GGGG exists', () => {
    // 31 December 2025 is a Wednesday in ISO week 1 of 2026. Filing that note
    // under {YYYY} would put it in 2025, where the 2026 reader never looks.
    const newYearsEve = new Date(2025, 11, 31);
    expect(expandPeriodPath('{GGGG}-W{WW}', newYearsEve)).toBe('2026-W01');
    expect(expandPeriodPath('{YYYY}', newYearsEve)).toBe('2025');
  });

  it('gets each quarter right', () => {
    expect(expandPeriodPath('{Q}', new Date(2026, 0, 1))).toBe('1');
    expect(expandPeriodPath('{Q}', new Date(2026, 3, 1))).toBe('2');
    expect(expandPeriodPath('{Q}', new Date(2026, 6, 1))).toBe('3');
    expect(expandPeriodPath('{Q}', new Date(2026, 11, 31))).toBe('4');
  });

  it('leaves an unknown token exactly as written', () => {
    // A visibly wrong path somebody fixes beats a plausible one that quietly
    // collects notes in the wrong place.
    expect(expandPeriodPath('Plan/{YYYY}/{NOPE}.md', DATE)).toBe('Plan/2026/{NOPE}.md');
  });
});

describe('the folder and the title', () => {
  it('splits the expanded path at its last separator', () => {
    expect(periodFolder(TEMPLATES.day, DATE)).toBe('0 Plan/1 Daily/2026');
    expect(periodTitleFromTemplate(TEMPLATES.day, DATE)).toBe('2026-08-22');
  });

  it('handles a template with no folder at all', () => {
    expect(periodFolder('{YYYY}.md', DATE)).toBe('');
    expect(periodTitleFromTemplate('{YYYY}.md', DATE)).toBe('2026');
  });
});

describe('templateMatchesTitle', () => {
  it('accepts every shipped template', () => {
    expect(templateMatchesTitle(TEMPLATES.day, 'day', DATE)).toBe(true);
    expect(templateMatchesTitle(TEMPLATES.week, 'week', DATE)).toBe(true);
    expect(templateMatchesTitle(TEMPLATES.month, 'month', DATE)).toBe(true);
    expect(templateMatchesTitle(TEMPLATES.quarter, 'quarter', DATE)).toBe(true);
    expect(templateMatchesTitle(TEMPLATES.year, 'year', DATE)).toBe(true);
  });

  it('rejects a template that renames the note, because the links between them resolve by title', () => {
    expect(templateMatchesTitle('Plan/{DD}-{MM}-{YYYY}.md', 'day', DATE)).toBe(false);
  });
});
