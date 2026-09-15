/**
 * The budget year on paper, from a ledger to the markup.
 *
 * The core suite proves the figures; this proves the page says them the way
 * the household spreadsheet it replaces does: expenses and debts negative, the
 * closed months set apart from the plan, the unbudgeted account named, net
 * worth carried past the last closed month and nothing else, and a credit
 * line that names somebody only when a name is set.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { rollingYear } from '@technosoftware/trail-core';
import { buildBudgetSheetHtml } from '../src/ledger/sheets/budget-sheet';
import { budgetSheetModel } from '../src/ledger/sheets/budget-sheet-model';
import { ledgerSheetPath } from '../src/ledger/sheets/sheet-path';
import { toHome } from '../src/shared/rates';
import { setDisplayLocale } from '../src/ui/kit/format';
import { CHART, LINES, postings, settings } from './budget-sheet-fixture';

afterEach(() => setDisplayLocale(''));

function sheetFor(closedThrough: number, over: Parameters<typeof settings>[0] = {}) {
  const s = settings(over);
  const year = rollingYear(LINES, CHART, postings(), 2026, closedThrough, {
    convert: (amount, currency) => toHome(amount, currency, s),
  });
  const model = budgetSheetModel(year, {
    settings: s,
    currency: 'CHF',
    lang: 'en',
    today: '2026-09-15',
  });
  return { year, model, html: buildBudgetSheetHtml(model) };
}

describe('the rows', () => {
  it('shows expenses as negative figures and income as positive', () => {
    const { model } = sheetFor(0);
    const income = model.flows.find((row) => row.kind === 'section');
    const expense = model.flows.filter((row) => row.kind === 'section')[1];
    expect(income?.negative[0]).toBe(false);
    expect(expense?.negative[0]).toBe(true);
    expect(expense?.months[0]?.startsWith('-')).toBe(true);
  });

  it('names an account nobody budgeted once money went through a closed month', () => {
    expect(sheetFor(0).model.flows.some((row) => row.label === '6390 Geschenke')).toBe(false);
    const gifts = sheetFor(8).model.flows.find((row) => row.label === '6390 Geschenke');
    expect(gifts?.marks).toEqual(['not budgeted']);
  });

  it('never prints a negative nothing', () => {
    const { html } = sheetFor(8);
    expect(html).not.toContain('>-0.00<');
  });

  it('leaves an account month blank where nothing moved, and prints every total', () => {
    const { model } = sheetFor(8);
    const insurance = model.flows.find((row) => row.label === '6120 Versicherungen');
    expect(insurance?.months[1]).toBe('');
    expect(insurance?.months[0]).not.toBe('');
  });

  it('ends the income and expense table with the result, whose total is the forecast', () => {
    const { model, year } = sheetFor(8);
    const result = model.flows[model.flows.length - 1];
    expect(result?.kind).toBe('result');
    expect(result?.total.replace(/[^\d.-]/g, '')).toBe(year.result.forecastTotal.toFixed(2));
  });
});

describe('the balances', () => {
  it('puts net worth on top and shows debts as negative figures', () => {
    const { model } = sheetFor(8);
    expect(model.balances[0]?.kind).toBe('net');
    const mortgage = model.balances.find((row) => row.label === '2050 Festhypothek');
    expect(mortgage?.negative[0]).toBe(true);
  });

  it('carries only net worth past the last closed month', () => {
    const { model } = sheetFor(8);
    const net = model.balances[0];
    const reserve = model.balances.find((row) => row.label === '1030 Renovationsreserve');
    expect(net?.months[8]).not.toBe('');
    expect(reserve?.months[7]).not.toBe('');
    expect(reserve?.months[8]).toBe('');
  });

  it('marks a foreign account with no rate, and says so under the page', () => {
    const { model } = sheetFor(8, { exchangeRates: [] });
    const cash = model.balances.find((row) => row.label === '1001 Haushaltskasse EUR');
    expect(cash?.marks).toEqual(['no rate']);
    expect(model.footer.currency).not.toBeNull();
  });
});

describe('the page', () => {
  it('sets the closed months apart from the plan', () => {
    const { html } = sheetFor(8);
    expect(html).toContain('<th colspan="8" class="closed">Actual</th>');
    expect(html).toContain('<th colspan="4" class="first-open">Plan</th>');
  });

  it('gives both tables the same columns, so the months line up', () => {
    const { html } = sheetFor(8);
    const tables = html.split('<table').slice(1);
    expect(tables).toHaveLength(2);
    const widths = tables.map((table) => table.split('<colgroup>')[1]?.split('</colgroup>')[0]);
    expect(widths[0]).toBe(widths[1]);
    const cellsPerRow = tables.map(
      (table) => (table.split('<tbody>')[1]?.split('</tr>')[0]?.match(/<td/g) ?? []).length
    );
    expect(cellsPerRow).toEqual([17, 17]);
  });

  it('prints landscape', () => {
    expect(sheetFor(0).html).toContain('size: A4 landscape');
  });

  it('escapes an account title', () => {
    const chart = CHART.map((account) =>
      account.number === 6110 ? { ...account, title: '6110 <b>Haushalt</b> & Co' } : account
    );
    const s = settings();
    const year = rollingYear(LINES, chart, [], 2026, 0);
    const html = buildBudgetSheetHtml(
      budgetSheetModel(year, { settings: s, currency: 'CHF', lang: 'en', today: '2026-09-15' })
    );
    expect(html).toContain('6110 &lt;b&gt;Haushalt&lt;/b&gt; &amp; Co');
    expect(html).not.toContain('<b>Haushalt</b>');
  });

  it('names the author only when one is set', () => {
    expect(sheetFor(0).model.footer.credit.startsWith('Created on ')).toBe(true);
    expect(sheetFor(0, { exportAuthor: 'Anna' }).model.footer.credit).toMatch(
      /^Created by Anna on .* with NODAtrail$/
    );
    expect(sheetFor(0).html).toContain(
      '<a href="https://technosoftware.com">technosoftware.com</a>'
    );
  });

  it('formats the figures in the vault’s convention', () => {
    setDisplayLocale('de-CH');
    const { model } = sheetFor(0);
    const income = model.flows[0];
    expect(income?.months[0]).toMatch(/^11.900\.00$/);
  });
});

describe('where it goes', () => {
  it('writes into the exports folder under the finance folder', () => {
    expect(ledgerSheetPath(settings(), 'Budget year 2026')).toBe(
      'Finance/_exports/Budget year 2026.html'
    );
  });

  it('writes into the finance folder itself when the subfolder is blank', () => {
    expect(ledgerSheetPath(settings({ exportsSubfolder: '' }), 'B')).toBe('Finance/B.html');
  });
});
