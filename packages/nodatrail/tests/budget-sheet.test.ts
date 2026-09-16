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
import { previousBudgetYear } from '../src/ledger/previous-budget';
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

  it('carries every balance past the last closed month, and says which figures are planned', () => {
    const { model, html } = sheetFor(8);
    const reserve = model.balances.find((row) => row.label === '1030 Renovationsreserve');
    // No fixture line names an account, so the reserve holds its August figure.
    expect(reserve?.months[8]).toBe(reserve?.months[7]);
    expect(html).toContain('projected');
  });

  it('shows what no account was named for, and only while there is some', () => {
    const bare = sheetFor(8).model.balances.find((row) => row.label === 'Not assigned');
    expect(bare?.months[7]).toBe('');
    expect(bare?.months[8]).not.toBe('');

    // Every line given the note's default: nothing is left unassigned.
    const s = settings();
    const year = rollingYear(LINES, CHART, postings(), 2026, 8, {
      convert: (amount, currency) => toHome(amount, currency, s),
      via: 1011,
    });
    const model = budgetSheetModel(year, {
      settings: s,
      currency: 'CHF',
      lang: 'en',
      today: '2026-09-15',
    });
    expect(model.balances.some((row) => row.label === 'Not assigned')).toBe(false);
    const anna = model.balances.find((row) => row.label === '1011 Privatkonto Anna');
    expect(anna?.months[8]).not.toBe(anna?.months[7]);
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

describe('a year planned before the one before it is closed', () => {
  function nextYear(previousClosed: number) {
    const s = settings();
    const year = rollingYear(LINES, CHART, postings(), 2027, 0, {
      convert: (amount, currency) => toHome(amount, currency, s),
      previous: previousBudgetYear(
        [
          { period: '2026', lines: LINES, closedThrough: previousClosed, via: null } as never,
          { period: '2025', lines: [], closedThrough: 12, via: null } as never,
        ],
        2027
      ),
    });
    const model = budgetSheetModel(year, {
      settings: s,
      currency: 'CHF',
      lang: 'en',
      today: '2026-11-15',
    });
    return { model, html: buildBudgetSheetHtml(model) };
  }

  it('sets the carried-forward balances in italics and says why', () => {
    const { model, html } = nextYear(8);
    expect(model.openingProjected).toBe(true);
    expect(model.balanceNotes[0]).toContain('2026 is not yet closed through December');
    expect(html).toContain('class="num sum projected');
  });

  it('carries the booked balances, upright, once December is closed', () => {
    const { model, html } = nextYear(12);
    expect(model.openingProjected).toBe(false);
    expect(html).not.toContain('class="num sum projected');
  });

  it('finds no previous budget where there is none', () => {
    expect(previousBudgetYear([], 2027)).toBeUndefined();
  });
});
