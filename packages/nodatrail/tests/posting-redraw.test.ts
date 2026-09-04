/**
 * When the posting form redraws itself after an account is chosen.
 *
 * The form's shape is decided from the two accounts: the amount box carries the
 * near currency in its label, and the second figure is offered only when the
 * two sides disagree. Neither can be right when the form is first drawn, so the
 * account picker compares a key before and after and redraws when it moves.
 *
 * The key used to be the two currencies alone, and that key cannot see the case
 * this pins. An account nobody has chosen reports the **home** currency, so
 * `CHF EUR` means both "no debit yet, credit in euros" and "debit in francs,
 * credit in euros". Choosing the euro account first and the franc one second
 * therefore left the key unchanged, no redraw happened, and the second figure
 * the posting now needed was never offered -- while choosing them the other way
 * round worked, which is why this survived a desktop and only showed up on an
 * iPad.
 *
 * A source test, and worth saying so: it pins the guard's *contents*, which is
 * where the defect was. It is not evidence that the form redraws, and the only
 * check that was, was opening it and picking two accounts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '..', 'src', 'ledger', 'new-posting-modal.ts'), 'utf8');

describe('the redraw guard on the account pickers', () => {
  it('compares a key taken before and after the account is set', () => {
    expect(source).toMatch(/const before = this\.currencyShape\(\);/);
    expect(source).toMatch(/if \(this\.currencyShape\(\) !== before\) this\.rerender\(\);/);
  });

  it('includes whether the posting converts, not the currencies alone', () => {
    const shape = /private currencyShape\(\): string \{\s*return `([^`]+)`;/.exec(source)?.[1];
    expect(shape).toBeDefined();
    expect(shape).toContain('this.converts()');
    expect(shape).toContain('this.nearCurrency()');
    expect(shape).toContain('this.farCurrency()');
  });

  it('no longer keys the redraw on the currency pair', () => {
    // The whole bug in one assertion.
    expect(source).not.toContain('currencyPair');
  });

  it('still draws both dependents from that same state', () => {
    expect(source).toContain('if (this.converts()) this.conversionRow(container);');
    expect(source).toContain("`${t('finance.amount')} (${this.nearCurrency()})`");
  });
});
