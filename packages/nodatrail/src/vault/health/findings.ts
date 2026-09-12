/**
 * What a vault check can find, and the arithmetic that finds it.
 *
 * The inverse of what the readers ask. A reader asks "which notes are
 * projects"; this asks "which notes in the Projects folder are not", which is
 * the question the folder-AND-type rule makes worth asking now and then. A note
 * that gets moved, or whose type gets typo'd, drops out of every view silently
 * and by design, and this is where it turns up again.
 *
 * Pure, so the whole set of checks is testable against plain objects. The
 * vault-bound half is `scan.ts`.
 */
import {
  suiteStampShape,
  type BillRecord,
  type AccountBudgetRecord,
  type PurchaseRecord,
} from '@technosoftware/trail-core';
import { purchaseTotalsDisagree } from '@technosoftware/trail-core';
import type { GoalRecord, ProjectRecord, ParaRecord } from '../../para/board';

export const FINDING_KINDS = [
  'missingType',
  'wrongType',
  'brokenLink',
  'missingImage',
  'billWithoutAmount',
  'dueBeforeIssue',
  'totalsDisagree',
  'unknownBudgetArea',
  'oldStampShape',
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  kind: FindingKind;
  path: string;
  title: string;
  /** What exactly is wrong, in the vault's own words: the value found, the link that resolves to nothing. */
  detail: string;
  /** What the value should be, where the check knows. Only a finding that carries this can be offered a one-click fix. */
  expected?: string;
  /**
   * The frontmatter property the finding is about, where it is about one.
   *
   * Carried so a fix knows what to write without parsing the report back. A
   * note can be wrong about `created` and `modified` at once, and those are two
   * separate corrections with two separate values.
   */
  property?: string;
}

/** A note in a folder NODAtrail claims, reduced to what a check needs. */
export interface FolderNote {
  path: string;
  title: string;
  /** The `type:` as written, or null when the note has none. */
  statedType: string | null;
  /** The value a note in this folder should carry. */
  expectedType: string;
}

/**
 * Notes sitting in a claimed folder under the wrong type, or none.
 *
 * The two are separate kinds because they are different mistakes: a missing
 * type is a note somebody has not finished, and a wrong one is a note that
 * looks finished and is invisible. The vault this was built for has exactly one
 * of the second, a quarter note carrying `type: month`.
 */
export function typeFindings(notes: readonly FolderNote[]): Finding[] {
  return notes
    .filter((note) => note.statedType !== note.expectedType)
    .map((note) => ({
      kind: note.statedType === null ? ('missingType' as const) : ('wrongType' as const),
      path: note.path,
      title: note.title,
      detail: note.statedType ?? '',
      expected: note.expectedType,
    }));
}

/** A link that resolves to no note. */
export function linkFindings<T, F>(
  records: readonly ParaRecord<T, F>[],
  pathOf: (record: ParaRecord<T, F>) => string,
  targetsOf: (note: T) => (string | null)[],
  known: readonly { title: string }[]
): Finding[] {
  const titles = new Set(known.map((entry) => entry.title.trim().toLowerCase()));

  return records.flatMap((record) =>
    targetsOf(record.note)
      .filter((target): target is string => target !== null)
      .filter((target) => !titles.has(target.trim().toLowerCase()))
      .map((target) => ({
        kind: 'brokenLink' as const,
        path: pathOf(record),
        title: record.title,
        detail: target,
      }))
  );
}

/** An `image:` naming a file the vault does not have. */
export function imageFindings<T extends { image: string | null }, F>(
  records: readonly ParaRecord<T, F>[],
  pathOf: (record: ParaRecord<T, F>) => string,
  resolves: (value: string) => boolean
): Finding[] {
  return records
    .filter((record) => record.note.image !== null && !resolves(record.note.image))
    .map((record) => ({
      kind: 'missingImage' as const,
      path: pathOf(record),
      title: record.title,
      detail: record.note.image ?? '',
    }));
}

/** Bills that cannot be read as bills. */
export function billFindings<F>(
  bills: readonly BillRecord<F>[],
  pathOf: (bill: BillRecord<F>) => string
): Finding[] {
  const findings: Finding[] = [];

  for (const bill of bills) {
    if (bill.amount === null) {
      findings.push({
        kind: 'billWithoutAmount',
        path: pathOf(bill),
        title: bill.title,
        detail: '',
      });
    }
    if (bill.dueDate && bill.issueDate && bill.dueDate < bill.issueDate) {
      findings.push({
        kind: 'dueBeforeIssue',
        path: pathOf(bill),
        title: bill.title,
        detail: `${bill.issueDate} > ${bill.dueDate}`,
      });
    }
  }
  return findings;
}

/**
 * Purchases whose stated total does not match their lines.
 *
 * Reported rather than corrected. The stated figure is what was charged and the
 * computed one is an opinion about it; which of the two is wrong is not
 * something a check can know, and rewriting either would be rewriting a record.
 */
export function purchaseFindings<F>(
  purchases: readonly PurchaseRecord<F>[],
  pathOf: (purchase: PurchaseRecord<F>) => string
): Finding[] {
  return purchases.filter(purchaseTotalsDisagree).map((purchase) => ({
    kind: 'totalsDisagree' as const,
    path: pathOf(purchase),
    title: purchase.title,
    detail: String(purchase.amount ?? ''),
  }));
}

/**
 * Budget lines naming an account no note claims.
 *
 * The same check the area version did, moved with the budget onto accounts. A
 * line pointing at nothing is a figure that will never be measured and will
 * never say why, which is the quietest way for a budget to be wrong.
 */
export function budgetFindings<F>(
  budgets: readonly AccountBudgetRecord<F>[],
  pathOf: (budget: AccountBudgetRecord<F>) => string,
  accounts: readonly { number: number }[]
): Finding[] {
  const known = new Set(accounts.map((account) => account.number));
  return budgets.flatMap((budget) =>
    budget.lines
      .filter((line) => !known.has(line.account))
      .map((line) => ({
        kind: 'unknownBudgetArea' as const,
        path: pathOf(budget),
        title: budget.title,
        detail: String(line.account),
      }))
  );
}

/** A note whose stamp still carries one of the older spellings. */
export interface StampNote {
  path: string;
  title: string;
  created: unknown;
  modified: unknown;
}

/**
 * Stamps that are not in the shape this suite writes, one finding per value.
 *
 * **One per value rather than one per note**, because each is a separate
 * correction with its own before and after, and a fix button that names the
 * value it is about is one somebody can trust. A note wrong about both
 * `created` and `modified` produces two.
 *
 * The original reasoning here was that nothing should bulk rewrite these: a
 * note converts the first time NODAtrail writes to it, and a mass rewrite would
 * give every note in the vault a new modification date. The first half still
 * holds and the second turned out to be false. Converting does not restamp
 * anything -- `suiteStampShape` re-spells the moment already written and never
 * moves it -- so a vault full of old shapes was left with a report nobody could
 * act on and no way to act on it. The fix is offered.
 */
export function stampFindings(notes: readonly StampNote[]): Finding[] {
  const findings: Finding[] = [];

  for (const note of notes) {
    for (const [property, value] of [
      ['created', note.created],
      ['modified', note.modified],
    ] as const) {
      const expected = suiteStampShape(value);
      // Null covers both "already right" and "cannot be read at all". The
      // second is deliberately not reported here: a value this cannot parse is
      // not a stamp in an older shape, it is something else entirely, and
      // calling it one would offer a fix that has nothing to write.
      if (expected === null) continue;

      findings.push({
        kind: 'oldStampShape',
        path: note.path,
        title: note.title,
        detail: `${property}: ${describeStamp(value)}`,
        expected,
        property,
      });
    }
  }

  return findings;
}

/**
 * A stamp value for a report line.
 *
 * A frontmatter value is `unknown`, and only a string is worth quoting back. A
 * `Date` cannot arrive here at all -- the parser reports one as already in
 * shape, so it never becomes a finding -- and anything else is not a stamp.
 */
function describeStamp(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Goal and project links, which are the two the PARA tree is built on. */
export function paraLinkFindings<F>(
  goals: readonly GoalRecord<F>[],
  projects: readonly ProjectRecord<F>[],
  areas: readonly { title: string }[],
  pathOf: (record: { file: F }) => string
): Finding[] {
  return [
    ...linkFindings(goals, pathOf, (note) => [note.areaTitle], areas),
    ...linkFindings(projects, pathOf, (note) => note.goalTitles, goals),
  ];
}

/** Findings in the order a report reads them: by kind, then by note. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      FINDING_KINDS.indexOf(a.kind) - FINDING_KINDS.indexOf(b.kind) ||
      a.title.localeCompare(b.title)
  );
}
