/**
 * A view that reports on a period has to let somebody choose the period.
 *
 * The balance sheet already computed itself as of the last day of the period on
 * screen, which was correct and useless: the tab drew no period bar, so the
 * period on screen was always the one containing today. With a year of data on
 * the books there was no way to ask what was held and owed at the end of March.
 * The finance view had the same shape of problem from the other side: it drew
 * no bar and scoped nothing, so every invoice ever written was on one list.
 *
 * Two rules are pinned here, and the second is why the control was extracted
 * into `PeriodPicker` rather than copied:
 *
 *  - whichever tab reads a period range renders the bar that changes it;
 *  - both views drive the same picker, so the two cannot drift into offering
 *    different levels or naming the same month differently.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VIEWS = join(__dirname, '..', 'src', 'ui', 'views');
const read = (name: string): string => readFileSync(join(VIEWS, name), 'utf8');
const LEDGER = read('ledger-view.ts');
const FINANCE = read('finance-view.ts');
const PICKER = readFileSync(join(__dirname, '..', 'src', 'ui', 'kit', 'period-bar.ts'), 'utf8');

/** One method's body, by brace matching from its signature. */
function methodBody(source: string, name: string): string {
  const signature = new RegExp(`private (?:async )?${name}\\(`);
  const start = source.search(signature);
  if (start < 0) throw new Error(`no method named ${name}`);

  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/**
 * The tab renderers, read off the dispatch rather than listed here.
 *
 * Listed by hand, a tab added later is a tab this test forgets to check, and
 * the check is worth exactly as much as its coverage of new tabs.
 */
function tabRenderers(source: string): string[] {
  const names = [...source.matchAll(/this\.tab === '\w+'\)\s*(?:await\s+)?this\.(\w+)\(/g)].map(
    (match) => match[1]
  );
  return [...new Set(names)];
}

/** Everything a method reaches, one level of this-call deep, which is as deep as these views go. */
function reach(source: string, name: string): string {
  const body = methodBody(source, name);
  const called = [...body.matchAll(/this\.(render\w+)\(/g)].map((match) => match[1]);
  return [body, ...called.map((child) => methodBody(source, child))].join('\n');
}

/** True when a view puts the bar on screen before it dispatches to a tab. */
function drawsBarForEveryTab(source: string): boolean {
  return /this\.period\.render\(/.test(source.slice(0, source.indexOf('if (this.tab ===')));
}

describe('the ledger view period control', () => {
  const renderers = tabRenderers(LEDGER);

  it('finds the tabs to check, so a broken read cannot pass silently', () => {
    expect(renderers.length).toBeGreaterThanOrEqual(5);
    expect(renderers).toContain('renderBalance');
  });

  it('draws a period bar on every tab whose figures move with the period', () => {
    const missing = renderers.filter((name) => {
      const text = reach(LEDGER, name);
      return text.includes('this.range()') && !text.includes('this.renderPeriodBar(');
    });
    expect(missing).toEqual([]);
  });

  it('draws it on the balance sheet, which is a statement about one day', () => {
    expect(reach(LEDGER, 'renderBalance')).toContain('this.renderPeriodBar(');
  });
});

describe('the finance view period control', () => {
  const renderers = tabRenderers(FINANCE);

  it('finds the tabs to check', () => {
    expect(renderers).toEqual(
      expect.arrayContaining(['renderPurchases', 'renderBills', 'renderRecurring'])
    );
  });

  it('draws the bar once, above whichever tab is showing', () => {
    expect(drawsBarForEveryTab(FINANCE)).toBe(true);
  });

  it('scopes the invoices to the period', () => {
    expect(reach(FINANCE, 'renderBills')).toContain('this.period.holds(');
  });

  it('never hides an invoice that is still owed', () => {
    // The one thing a period filter on bills can get dangerously wrong. An
    // unpaid January invoice is at its most important in March, so whatever the
    // window is, everything outstanding outside it is listed as well.
    const body = reach(FINANCE, 'renderBills');
    expect(body).toContain('outstandingElsewhere');
    expect(body).toMatch(/outstanding\.filter\(.*!this\.period\.holds\(/s);
  });

  it('leaves the total owed unscoped, since a shrinking total is unactionable', () => {
    // `owed` is summed from `outstanding`, which is the whole set, and the stat
    // strip is built from it before any filtering happens.
    const body = methodBody(FINANCE, 'renderBills');
    expect(body.indexOf('const owed = sumByCurrency(')).toBeLessThan(
      body.indexOf('this.period.holds(')
    );
  });

  it("counts a standing cost's occurrences in the period on screen", () => {
    expect(reach(FINANCE, 'renderRecurring')).toContain('this.period.range()');
  });
});

describe('the two views share one control', () => {
  it('neither view builds a period bar of its own', () => {
    // The bar's own markup and the period arithmetic behind it both live in one
    // file. A view importing `shiftPeriod` is a view about to grow a second
    // copy of the control. (`createEl('select')` is not checked: the ledger has
    // a legitimate one for the accrual-or-cash basis.)
    for (const source of [LEDGER, FINANCE]) {
      expect(source).not.toContain('nod-period-bar');
      expect(source).not.toContain('shiftPeriod');
      expect(source).not.toContain('periodTitle');
    }
    expect(PICKER).toContain('nod-period-bar');
  });

  it('offers the same levels wherever it is drawn', () => {
    expect(PICKER).toMatch(/PERIOD_LEVELS = \['month', 'quarter', 'year'\]/);
  });

  it('lets the day be a month end, so a closed month can be checked', () => {
    // Without the month level the finest question askable is a whole quarter,
    // and no month-end figure can be reconciled against anything.
    expect(PICKER).toMatch(/PERIOD_LEVELS = \[[^\]]*'month'/);
  });

  it('goes back to following today when the level changes', () => {
    // A month title cannot be parsed as a year, so keeping it would leave the
    // bar naming a period the level cannot read.
    expect(PICKER).toMatch(/this\.level = [^;]+;\s*(\/\/[^\n]*\n\s*)*this\.chosen = null;/);
  });
});
