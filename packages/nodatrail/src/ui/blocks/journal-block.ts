/**
 * A journal block, rendered as a table.
 *
 * The source stays what somebody typed: a line per posting, editable in the
 * note, greppable, diffable. This is only how it reads. A block that rewrote
 * its own source into a table would take the one property that makes a journal
 * worth keeping in a vault.
 *
 * **A line that cannot be read is shown, not skipped.** It appears in place,
 * marked, with what is wrong with it. A renderer that silently dropped a
 * malformed line would leave somebody looking at a table that balances and a
 * file that does not.
 */
import {
  accountLabel,
  parseJournal,
  type Account,
  type JournalProblem,
  type Posting,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { money } from '../kit/format';
import { readAccounts } from '../../ledger/read-ledger';
import type { BlockDeps } from './context';

/**
 * A row of the rendered table: either a posting or the line that failed.
 *
 * A discriminated union rather than two nullable fields, so the two branches
 * cannot be confused and neither needs a null check the compiler cannot see
 * through.
 */
type JournalLine =
  | { kind: 'posting'; line: number; posting: Posting }
  | { kind: 'problem'; line: number; problem: JournalProblem };

export function renderJournalBlock(deps: BlockDeps, source: string, element: HTMLElement): void {
  element.empty();
  const { postings, problems } = parseJournal(source);

  const accounts = new Map<number, Account>();
  for (const record of readAccounts(deps.app, deps.getSettings())) {
    accounts.set(record.account.number, record.account);
  }

  if (postings.length === 0 && problems.length === 0) {
    element.createDiv({ cls: 'nod-journal-empty', text: t('ledger.noPostings') });
    return;
  }

  const table = element.createEl('table', { cls: 'nod-journal' });
  const head = table.createEl('thead').createEl('tr');
  for (const label of [
    t('finance.issueDate'),
    t('ledger.debit'),
    t('ledger.credit'),
    t('finance.amount'),
    t('common.description'),
  ]) {
    head.createEl('th', { text: label });
  }

  const body = table.createEl('tbody');
  // Interleaved by line number, so a problem appears where it actually is
  // rather than in a list underneath that nobody connects to a row.
  const lines: JournalLine[] = [
    ...postings.map((posting): JournalLine => ({ kind: 'posting', line: posting.line, posting })),
    ...problems.map((problem): JournalLine => ({ kind: 'problem', line: problem.line, problem })),
  ].sort((a, b) => a.line - b.line);

  let total = 0;
  for (const entry of lines) {
    const tr = body.createEl('tr');

    if (entry.kind === 'problem') {
      tr.addClass('nod-journal-bad');
      tr.createEl('td', { text: String(entry.problem.line) });
      const cell = tr.createEl('td', { attr: { colspan: '4' } });
      cell.createSpan({ text: t(`ledger.problem.${entry.problem.reason}`) });
      cell.createSpan({ cls: 'nod-journal-raw', text: entry.problem.raw.trim() });
      continue;
    }

    const { posting } = entry;
    total += posting.amount;

    tr.createEl('td', { cls: 'nod-journal-date', text: posting.date });
    tr.createEl('td', { text: name(accounts, posting.debit) });
    tr.createEl('td', { text: name(accounts, posting.credit) });
    tr.createEl('td', {
      cls: 'nod-journal-amount',
      text: money(posting.amount, posting.currency),
    });

    const text = tr.createEl('td');
    text.createSpan({ text: posting.text });
    if (posting.splitOf) {
      text.createSpan({ cls: 'nod-journal-split', text: posting.splitOf });
    }
  }

  const foot = table.createEl('tfoot').createEl('tr');
  foot.createEl('td', {
    attr: { colspan: '3' },
    text: t('ledger.postingCount', { count: String(postings.length) }),
  });
  foot.createEl('td', { cls: 'nod-journal-amount', text: money(total, null) });
  foot.createEl('td');
}

/**
 * An account number as a name, or as itself.
 *
 * A number with no note behind it is shown as the bare number rather than as
 * blank: the number is what the line says, and hiding it would make the row
 * unreadable in exactly the case where somebody needs to read it.
 */
function name(accounts: ReadonlyMap<number, Account>, number: number | null): string {
  if (number === null) return '';
  const account = accounts.get(number);
  return account ? accountLabel(account) : String(number);
}
