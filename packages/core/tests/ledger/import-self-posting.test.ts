/**
 * A statement row whose other side resolves to the account being imported into.
 *
 * Found in a real vault, and it is the quietest failure the importer has had.
 * A learned rule of `Stefan Muster` -> 1011, written from one row, then
 * matched the account holder's own name inside `Ursprünglicher Auftraggeber:
 * STEFAN MUSTER` on rows that had nothing to do with that account. Three
 * payments were written as `1011 | 1011`, which move nothing at all:
 * `effectOn` returns zero for a posting naming one account twice, so the money
 * never left, the books still closed because a zero is balanced, and the import
 * reported success.
 *
 * Then it compounded. A fourth row resolved the same way, and `findMirror`
 * found the first self-posting waiting for it -- same debit, same credit, same
 * amount, same day -- so the row was dropped as an already-posted transfer.
 * Four rows lost to one rule, and the only visible symptom was a closing
 * balance 1'359.76 above the bank's.
 *
 * The guard is that such a row is never ready. Asking is the only safe answer:
 * the rule cannot be trusted here, and any other account would be invented.
 *
 * **The cause is fixed as well now, and this stays as the second line.** A rule
 * is matched against the counterparty rather than the whole description, so a
 * name sitting in `Ursprünglicher Auftraggeber:` no longer resolves anything at
 * all -- the first case below reaches `needs-account` without the guard being
 * needed. The guard still is, because a rule can legitimately name the account
 * being imported into: the second case is a card whose own rule points at the
 * card, which no amount of careful matching prevents.
 */
import { describe, expect, it } from 'vitest';
import { planImport, type Account, type BankStatementRow } from '../../src/index.js';

function account(number: number, kind: Account['kind'], title = `Konto ${number}`): Account {
  return {
    number,
    title,
    kind,
    group: '',
    currency: 'CHF',
    opening: 0,
    openingDate: null,
    closed: null,
    iban: null,
    bankAccount: null,
    personTitle: null,
  };
}

const ACCOUNTS = [
  account(1011, 'asset', 'Universalkonto'),
  account(1013, 'asset', 'Zahlkarte'),
  account(2011, 'liability', 'PayCard'),
  account(4039, 'expense', 'Reisen'),
];

let line = 0;
function row(text: string, amount: number, date = '2026-05-26'): BankStatementRow {
  line += 1;
  return {
    line,
    date,
    valueDate: date,
    text,
    rawText: text,
    amount,
    currency: 'CHF',
    balance: null,
    // The bank's reference, which is what keys a row across imports. Distinct
    // per row here, so nothing is skipped as already imported.
    reference: `ref-${line}`,
    batchCount: null,
    transfer: null,
    status: null,
    accepted: true,
  };
}

/** The rule that caused it: the account holder's own name, learned from one row. */
const OWN_NAME = [{ match: 'Stefan Muster', account: 1011, learned: true }];

describe('a row pointed back at its own account', () => {
  const plan = planImport([row('PAYCARD Ursprünglicher Auftraggeber: STEFAN MUSTER', -500)], {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: OWN_NAME,
    existing: [],
  });
  const proposal = plan.proposals[0];

  it('is never ready to write', () => {
    expect(proposal?.status).not.toBe('ready');
    expect(plan.ready).toBe(0);
  });

  it('asks which account instead', () => {
    expect(proposal?.status).toBe('needs-account');
  });

  it('never reaches the guard, because the rule no longer matches', () => {
    // `Stefan Muster` sits in the originator field and the counterparty is
    // `PAYCARD`, so nothing resolves and there is no same-account case to
    // report. This assertion is the fix; the one below it is the guard.
    expect(proposal?.sameAccount).toBe(false);
    expect(proposal?.matchedBy).toBeNull();
  });

  it('writes no posting at all', () => {
    // The whole bug: a posting existed, was balanced, and moved nothing.
    expect(proposal?.posting).toBeNull();
  });
});

describe('a rule that names the account being imported into', () => {
  // The guard's own case, reached the only way still open to it: a rule about
  // the counterparty, pointing at the account whose statement this is. Reading
  // the counterparty cannot prevent this one -- the counterparty really is the
  // card -- so the guard is what stops a posting that moves nothing.
  const plan = planImport([row('REVOLUT BANK UAB', -500)], {
    intoAccount: 1013,
    accounts: ACCOUNTS,
    rules: [{ match: 'REVOLUT BANK UAB', account: 1013, learned: true }],
    existing: [],
  });
  const proposal = plan.proposals[0];

  it('asks, and says why', () => {
    expect(proposal?.status).toBe('needs-account');
    expect(proposal?.sameAccount).toBe(true);
  });

  it('writes no posting', () => {
    expect(proposal?.posting).toBeNull();
  });
});

describe('the second row it used to swallow', () => {
  // Two rows the same rule points at 1011, same amount, same day. Before the
  // guard the first became `1011 | 1011` and the second was dropped as its
  // mirror, so one bad rule cost two payments rather than one.
  const rows = [
    row('PAYCARD Ursprünglicher Auftraggeber: STEFAN MUSTER', -500),
    row('REVOLUT BANK UAB Mitteilung: STEFAN MUSTER, CH', -500),
  ];
  const plan = planImport(rows, {
    intoAccount: 1011,
    accounts: ACCOUNTS,
    rules: OWN_NAME,
    existing: [],
  });

  it('keeps both rows, and loses neither to the other', () => {
    expect(plan.proposals).toHaveLength(2);
    expect(plan.proposals.map((entry) => entry.status)).toEqual(['needs-account', 'needs-account']);
  });

  it('calls neither of them a mirror of the other', () => {
    expect(plan.proposals.every((entry) => entry.mirrorOf === null)).toBe(true);
  });

  it('counts both as needing attention, so the dialog cannot say it is done', () => {
    expect(plan.needsAttention).toBe(2);
  });
});

describe('what the guard must not break', () => {
  it('leaves a rule pointing somewhere else alone', () => {
    const plan = planImport([row('REVOLUT BANK UAB', -500)], {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [{ match: 'REVOLUT BANK UAB', account: 1013 }],
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.proposals[0]?.posting?.credit).toBe(1011);
    expect(plan.proposals[0]?.posting?.debit).toBe(1013);
  });

  it('still recognises a genuine transfer between two different own accounts', () => {
    const first = planImport([row('REVOLUT BANK UAB', -500, '2026-05-22')], {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [{ match: 'REVOLUT BANK UAB', account: 1013 }],
      existing: [],
    });
    const posting = first.proposals[0]?.posting;
    if (!posting) throw new Error('expected a posting');

    // The same transfer read from the other account's statement, one day later.
    const second = planImport([row('Übertrag', -500, '2026-05-23')], {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [{ match: 'Übertrag', account: 1013 }],
      existing: [posting],
    });
    expect(second.proposals[0]?.status).toBe('mirrors-existing');
  });

  it('still books an ordinary expense', () => {
    const plan = planImport([row('KLARNA BANK AB', -293.26)], {
      intoAccount: 1011,
      accounts: ACCOUNTS,
      rules: [{ match: 'KLARNA', account: 4039 }],
      existing: [],
    });
    expect(plan.proposals[0]?.status).toBe('ready');
    expect(plan.ready).toBe(1);
  });
});
