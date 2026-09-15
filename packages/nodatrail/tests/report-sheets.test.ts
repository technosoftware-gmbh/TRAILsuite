/**
 * The chart, profit, balance and statement tabs on paper.
 *
 * Each sheet is made from the same reading its tab draws (see
 * `readings.test.ts`); what is pinned here is how the page says it: totals that
 * are the reading's totals, a foreign account that says what it holds, a
 * statement laid out as a bank's with debit and credit apart, and nothing a
 * note says reaching the page as markup.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parseAccount, type AccountProperties } from '@technosoftware/trail-core';
import {
  balanceReading,
  chartReading,
  incomeReading,
  statementReading,
} from '../src/ledger/readings';
import { buildReportSheetHtml } from '../src/ledger/sheets/report-sheet';
import {
  balanceSheetModel,
  chartSheetModel,
  incomeSheetModel,
  statementSheetModel,
  type ReportSheetContext,
} from '../src/ledger/sheets/report-sheet-model';
import { buildStatementSheetHtml } from '../src/ledger/sheets/statement-sheet';
import { toHome } from '../src/shared/rates';
import { setDisplayLocale } from '../src/ui/kit/format';
import { CHART, postings, settings } from './budget-sheet-fixture';

afterEach(() => setDisplayLocale(''));

const s = settings();
const convert = (amount: number, currency: string | null) => toHome(amount, currency, s);
const ledger = { accounts: CHART, postings: postings() };
const byNumber = new Map(CHART.map((account) => [account.number, account]));
const Q2 = { from: '2026-04-01', to: '2026-06-30' };
const context: ReportSheetContext = {
  settings: s,
  lang: 'en',
  today: '2026-09-15',
  periodLabel: '2026-Q2',
};
const plain = (text: string) => Number(text.replace(/[^\d.-]/g, ''));

describe('the chart', () => {
  const reading = chartReading(ledger, Q2, convert);
  const model = chartSheetModel(reading, context);

  it('has the four sections, each totalled as the reading totals it', () => {
    expect(model.sections.map((part) => part.title)).toEqual([
      'Assets',
      'Liabilities',
      'Income',
      'Expenses',
    ]);
    expect(plain(model.sections[0]?.total ?? '')).toBe(reading.held.assetTotal);
    expect(plain(model.sections[3]?.total ?? '')).toBe(reading.flows.expenseTotal);
  });

  it('says what a foreign account holds, and at what rate', () => {
    const cash = model.sections[0]?.rows.find((row) => row.label === '1001 Haushaltskasse EUR');
    expect(cash?.detail).toContain('0.94');
    expect(model.footer.currency).not.toBeNull();
  });

  it('marks a foreign account outside the total when it has no rate', () => {
    const bare = settings({ exchangeRates: [] });
    const noRate = chartSheetModel(
      chartReading(ledger, Q2, (a, c) => toHome(a, c, bare)),
      { ...context, settings: bare }
    );
    const cash = noRate.sections[0]?.rows.find((row) => row.label === '1001 Haushaltskasse EUR');
    expect(cash?.outside).toBe(true);
  });
});

describe('the profit', () => {
  it('names its basis, on either basis', () => {
    const accrual = incomeSheetModel(incomeReading(ledger, Q2, 'accrual', convert), context);
    const cash = incomeSheetModel(incomeReading(ledger, Q2, 'cash', convert), context);
    expect(accrual.title).toBe('Profit 2026-Q2');
    expect(cash.title).toBe('Profit 2026-Q2 (cash)');
    expect(accrual.notes[0]).toMatch(/^What the period cost: /);
    expect(cash.notes[0]).toMatch(/^What left the accounts: /);
  });

  it('prints no empty sections for a period nothing was booked in', () => {
    const empty = incomeSheetModel(
      incomeReading(ledger, { from: '2027-01-01', to: '2027-03-31' }, 'accrual', convert),
      context
    );
    expect(empty.sections).toEqual([]);
    expect(empty.notes).toContain('Nothing posted in this period.');
    expect(buildReportSheetHtml(empty)).not.toContain('<h2>');
  });
});

describe('the balance sheet', () => {
  it('is headed with its day', () => {
    const model = balanceSheetModel(balanceReading(ledger, Q2, convert), context);
    expect(model.title).toBe('Balance sheet on June 30, 2026');
  });
});

describe('the statement', () => {
  const reserve = byNumber.get(1030);
  if (!reserve) throw new Error('fixture');
  const reading = statementReading(ledger, reserve, Q2);
  const model = statementSheetModel(reading, byNumber, context);

  it('puts what came in and what went out in columns of their own', () => {
    const interest = model.rows.find((row) => row.other === '6130 Hypothekarzins');
    expect(interest?.outward).not.toBe('');
    expect(interest?.inward).toBe('');
    const transfer = model.rows.find((row) => row.other === '1011 Privatkonto Anna');
    expect(transfer?.inward).toBe('850.00');
  });

  it('opens and closes on the reading, and lists oldest first', () => {
    expect(plain(model.opening)).toBe(reading.opening);
    expect(plain(model.closing)).toBe(reading.closing);
    expect(model.rows[0]?.date).toBe('April 28, 2026');
    const html = buildStatementSheetHtml(model);
    expect(html.indexOf('Opening balance')).toBeLessThan(html.indexOf('April 28, 2026'));
  });

  it('says so for a period with no movement, instead of printing an empty table', () => {
    const quiet = statementSheetModel(
      statementReading(ledger, reserve, { from: '2027-01-01', to: '2027-01-31' }),
      byNumber,
      context
    );
    expect(quiet.empty).toBe('Nothing posted in this period.');
    expect(buildStatementSheetHtml(quiet)).not.toContain('<table');
  });

  it('escapes what a posting says', () => {
    const tampered = {
      ...reading,
      rows: reading.rows.map((row, index) =>
        index === 0 ? { ...row, posting: { ...row.posting, text: '<img src=x>' } } : row
      ),
    };
    const html = buildStatementSheetHtml(statementSheetModel(tampered, byNumber, context));
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });
});

describe('an account title on a report', () => {
  it('reaches the page as text', () => {
    const P: AccountProperties = {
      numberProperty: 'number',
      kindProperty: 'kind',
      groupProperty: 'group',
      currencyProperty: 'currency',
      openingProperty: 'opening',
      openingDateProperty: 'openingDate',
      closedProperty: 'closed',
      ibanProperty: 'iban',
      bankAccountProperty: 'bankAccount',
      personProperty: 'person',
    };
    const odd = parseAccount({ number: 1500, kind: 'asset', opening: 5 }, '1500 A & <B>', P);
    if (!odd) throw new Error('fixture');
    const html = buildReportSheetHtml(
      balanceSheetModel(balanceReading({ accounts: [odd], postings: [] }, Q2, convert), context)
    );
    expect(html).toContain('1500 A &amp; &lt;B&gt;');
  });
});
