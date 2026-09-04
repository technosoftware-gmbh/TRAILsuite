/**
 * The checks, against the three things actually wrong in the target vault.
 */
import { describe, expect, it } from 'vitest';
import {
  billFindings,
  budgetFindings,
  imageFindings,
  paraLinkFindings,
  purchaseFindings,
  sortFindings,
  stampFindings,
  typeFindings,
} from '../src/vault/health/findings';
import type { GoalRecord, ProjectRecord } from '../src/para/board';
import type { BillRecord, PurchaseRecord } from 'trail-core';

const path = (record: { file: unknown }) => (record.file as { path: string }).path;

function goal(title: string, areaTitle: string | null, image: string | null = null): GoalRecord {
  return {
    file: { path: `2 Goals/${title}.md` },
    title,
    archived: false,
    note: {
      image,
      priority: null,
      archived: null,
      areaTitle,
      status: 'ongoing',
      deadline: null,
      achieved: null,
      closed: null,
    },
  };
}

function project(title: string, goalTitles: string[]): ProjectRecord {
  return {
    file: { path: `3 Projects/${title}.md` },
    title,
    archived: false,
    note: {
      image: null,
      priority: null,
      archived: null,
      goalTitles,
      areaTitle: null,
      status: 'ongoing',
      deadline: null,
      completed: null,
      closed: null,
    },
  };
}

describe('the type check', () => {
  it('catches the quarter note that says it is a month', () => {
    const findings = typeFindings([
      {
        path: '0 Plan/4 Quarterly/2026/2026-Q1.md',
        title: '2026-Q1',
        statedType: 'month',
        expectedType: 'quarter',
      },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('wrongType');
    expect(findings[0]?.detail).toBe('month');
    expect(findings[0]?.expected).toBe('quarter');
  });

  it('tells a missing type from a wrong one, because they are different mistakes', () => {
    const findings = typeFindings([
      { path: 'a.md', title: 'a', statedType: null, expectedType: 'project' },
    ]);
    expect(findings[0]?.kind).toBe('missingType');
  });

  it('says nothing about a note whose type is right', () => {
    expect(
      typeFindings([{ path: 'a.md', title: 'a', statedType: 'area', expectedType: 'area' }])
    ).toEqual([]);
  });
});

describe('the link checks', () => {
  const areas = [{ title: 'Gesundheit' }, { title: 'Hobbies' }];
  const goals = [goal('Fitness', 'Gesundheit'), goal('Verwaist', 'Ein gelöschter Bereich')];

  it('reports a goal pointing at an area that does not exist', () => {
    const findings = paraLinkFindings(goals, [], areas, path);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toBe('Ein gelöschter Bereich');
  });

  it('reports a project pointing at a goal that does not exist', () => {
    const findings = paraLinkFindings([], [project('P', ['Kein Ziel'])], areas, path);
    expect(findings.map((finding) => finding.detail)).toEqual(['Kein Ziel']);
  });

  it('resolves a link case-insensitively, the way Obsidian does', () => {
    expect(paraLinkFindings([goal('X', 'gesundheit')], [], areas, path)).toEqual([]);
  });

  it('says nothing about a project that names no goal at all', () => {
    expect(paraLinkFindings([], [project('P', [])], areas, path)).toEqual([]);
  });
});

describe('the image check', () => {
  it('reports the German paths the vault still carries', () => {
    const broken = goal('X', null, '1 Bereiche/1 Gesundheit/_resources/Gesundheit.png');
    const findings = imageFindings([broken], path, () => false);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('missingImage');
    expect(findings[0]?.detail).toBe('1 Bereiche/1 Gesundheit/_resources/Gesundheit.png');
  });

  it('says nothing about a note with no image', () => {
    expect(imageFindings([goal('X', null)], path, () => false)).toEqual([]);
  });

  it('says nothing about an image that resolves', () => {
    expect(imageFindings([goal('X', null, 'ok.png')], path, () => true)).toEqual([]);
  });
});

describe('the money checks', () => {
  function bill(over: Partial<BillRecord> = {}): BillRecord {
    return {
      file: { path: 'Finance/Bills/b.md' },
      title: 'b',
      companyTitle: null,
      areaTitle: null,
      category: null,
      amount: 100,
      currency: 'CHF',
      issueDate: '2026-07-01',
      dueDate: '2026-08-01',
      paidDate: null,
      reference: null,
      documentPaths: [],
      recurringTitle: null,
      purchaseTitle: null,
      statedStatus: null,
      // The ledger fields a bill has carried since it could be booked, and
      // the direction the parser always states. The fixtures predate all
      // four, so these checks have been running against a bill shape no note
      // can have.
      account: null,
      paidFrom: null,
      lines: [],
      direction: 'incoming',
      ...over,
    };
  }

  it('reports a bill with no amount', () => {
    expect(billFindings([bill({ amount: null })], path)[0]?.kind).toBe('billWithoutAmount');
  });

  it('reports a bill due before it was issued', () => {
    const backwards = bill({ issueDate: '2026-08-01', dueDate: '2026-07-01' });
    expect(billFindings([backwards], path)[0]?.kind).toBe('dueBeforeIssue');
  });

  it('says nothing about a bill that makes sense', () => {
    expect(billFindings([bill()], path)).toEqual([]);
  });

  it('reports a purchase whose total disagrees with its lines', () => {
    const purchase: PurchaseRecord = {
      file: { path: 'Finance/Purchases/p.md' },
      title: 'p',
      reference: '',
      companyTitle: null,
      areaTitle: null,
      projectTitle: null,
      category: null,
      status: 'ordered',
      date: null,
      deliveryDate: null,
      deliveries: [],
      amount: 200,
      currency: 'CHF',
      discount: null,
      shipping: null,
      vatRate: null,
      vatAmount: null,
      items: [{ name: 'x', price: 10, quantity: 1, discount: null, note: null }],
      documentPaths: [],
      billTitle: null,
    };
    expect(purchaseFindings([purchase], path)[0]?.kind).toBe('totalsDisagree');
  });

  it('reports a budget line naming an account no note claims', () => {
    // A line pointing at nothing is a figure that will never be measured and
    // will never say why, which is the quietest way for a budget to be wrong.
    const line = (account: number) => ({
      account,
      amount: 100,
      rhythm: 'monthly' as const,
      startMonth: null,
      note: '',
      overrides: {},
    });
    const budget = {
      file: { path: 'Finance/Budgets/2026/2026.md' },
      title: '2026',
      period: '2026',
      currency: 'CHF',
      lines: [line(4001), line(4999)],
    };
    const findings = budgetFindings([budget], path, [{ number: 4001 }]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toBe('4999');
  });
});

describe('the stamp check', () => {
  it('reports the three older spellings the vault carries, one finding each', () => {
    // One per value rather than one per note: `a` is wrong about both of its
    // stamps, and those are two corrections with two different answers.
    const findings = stampFindings([
      { path: 'a.md', title: 'a', created: '[[2026-07-13]]', modified: '2026-07-25 - 04:50 pm' },
      { path: 'b.md', title: 'b', created: '2026-07-14', modified: null },
    ]);
    expect(findings).toHaveLength(3);
    expect(findings.map((finding) => [finding.property, finding.expected])).toEqual([
      ['created', '2026-07-13T00:00'],
      ['modified', '2026-07-25T16:50'],
      ['created', '2026-07-14T00:00'],
    ]);
  });

  it('carries the value it would write, so the fix has to guess nothing', () => {
    const [finding] = stampFindings([
      { path: 'a.md', title: 'a', created: '2026-07-25 - 12:05 am', modified: null },
    ]);
    // Midnight in the twelve-hour spelling, which is the one that goes wrong.
    expect(finding?.expected).toBe('2026-07-25T00:05');
    expect(finding?.detail).toBe('created: 2026-07-25 - 12:05 am');
  });

  it('offers no fix for a value that is not a moment at all', () => {
    // `created: '[[Steuern]]'` is a link to a note, not a date. Reporting it as
    // an old-shaped stamp would attach a fix button with nothing to write.
    expect(
      stampFindings([{ path: 'a.md', title: 'a', created: '[[Steuern]]', modified: null }])
    ).toEqual([]);
  });

  it('says nothing about a note already in the suite shape', () => {
    expect(
      stampFindings([
        { path: 'a.md', title: 'a', created: '2026-07-13T09:00', modified: '2026-08-04T14:05' },
      ])
    ).toEqual([]);
  });

  it('says nothing about a note carrying no stamps at all', () => {
    expect(
      stampFindings([{ path: 'a.md', title: 'a', created: undefined, modified: undefined }])
    ).toEqual([]);
  });
});

describe('sortFindings', () => {
  it('groups by kind, then reads alphabetically', () => {
    const sorted = sortFindings([
      { kind: 'brokenLink', path: 'b', title: 'B', detail: '' },
      { kind: 'wrongType', path: 'z', title: 'Z', detail: '' },
      { kind: 'brokenLink', path: 'a', title: 'A', detail: '' },
    ]);
    expect(sorted.map((finding) => finding.title)).toEqual(['Z', 'A', 'B']);
  });
});
