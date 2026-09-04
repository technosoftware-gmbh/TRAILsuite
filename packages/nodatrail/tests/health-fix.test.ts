/**
 * Which findings get a fix button, and which are only ever reported.
 *
 * The rule is not "most of them" and not "the easy ones": a finding is fixable
 * exactly when the check already holds the whole answer. A broken link does not
 * -- repairing it means knowing which note was meant. A disagreeing total does
 * not -- correcting it means knowing which of the two figures is right. Offering
 * a button there would mean guessing on somebody's records.
 *
 * Two qualify. The type, because the folder states the answer. And a stamp in
 * an older shape, because the answer is the same moment spelt differently, which
 * is why converting one is not a rewrite of anything.
 *
 * Pinned here rather than left to the modal, because the modal decides whether
 * to draw a button by asking this, and a wrong answer is either a fix nobody
 * can reach or a button that writes a guess.
 */
import { describe, expect, it } from 'vitest';
import { canFix } from '../src/vault/health/scan';
import { stampFindings } from '../src/vault/health/findings';
import type { Finding } from '../src/vault/health/findings';

function finding(over: Partial<Finding> = {}): Finding {
  return { kind: 'wrongType', path: 'a.md', title: 'a', detail: '', expected: 'project', ...over };
}

describe('canFix', () => {
  it('fixes a type, because the folder says what it should be', () => {
    expect(canFix(finding({ kind: 'wrongType' }))).toBe(true);
    expect(canFix(finding({ kind: 'missingType' }))).toBe(true);
  });

  it('fixes a stamp, because the moment is already written down', () => {
    const [stamp] = stampFindings([
      { path: 'a.md', title: 'a', created: '2026-07-16 - 01:17 pm', modified: null },
    ]);
    expect(stamp).toBeDefined();
    expect(canFix(stamp)).toBe(true);
  });

  it('refuses every finding whose answer the check does not hold', () => {
    // Each of these would have to invent something: which note was meant, which
    // figure is right, which account the budget line intended.
    for (const kind of [
      'brokenLink',
      'missingImage',
      'billWithoutAmount',
      'dueBeforeIssue',
      'totalsDisagree',
      'unknownBudgetArea',
    ] as const) {
      expect(canFix(finding({ kind, expected: 'something' }))).toBe(false);
    }
  });

  it('refuses a fixable kind that arrived without its answer', () => {
    expect(canFix(finding({ kind: 'wrongType', expected: undefined }))).toBe(false);
    expect(
      canFix(finding({ kind: 'oldStampShape', expected: '2026-07-16T13:17', property: undefined }))
    ).toBe(false);
  });

  it('leaves nothing to fix once the stamps are converted', () => {
    // What a vault looks like after the bulk fix has run: the check finds
    // nothing, so there is nothing to press.
    expect(
      stampFindings([
        { path: 'a.md', title: 'a', created: '2026-07-16T00:00', modified: '2026-07-16T13:17' },
      ])
    ).toEqual([]);
  });
});
