/**
 * One order, one number, on every surface that shows one.
 *
 * Three places ask what an order is worth: the invoice document, the card in the
 * orders list, and the sort behind that list. For a while they did not agree.
 * The document was computed-first (`computedOrderTotal(order) ?? order.price`)
 * and the card and the sort were stated-first (`order.price ?? computed`).
 *
 * Nothing in the vault could tell them apart. Of its sixty-two orders, four
 * carry line prices and all four agree with their stated total, so the two rules
 * returned the same number every time and would have gone on doing so until
 * somebody edited a note by hand. That is exactly the kind of disagreement worth
 * a test rather than a comment: it costs nothing to hold, and the day it starts
 * mattering is the day nobody is looking.
 *
 * A source test, because the failure is two call sites drifting apart rather
 * than one function computing wrongly. `computedOrderTotal` is the core's and
 * has its own tests; what is checked here is that nothing goes round it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const RULE = join('orders', 'view-model', 'order-total.ts');

function sources(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

/**
 * The file with its comments taken out.
 *
 * The first version of the check below counted a doc comment naming
 * `computedOrderTotal()` as a call site, which is the sort of false positive
 * that gets a useful test deleted.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('what an order is worth', () => {
  it('is decided in one file', () => {
    const deciders = sources(SRC)
      .filter((file) => code(file.text).includes('computedOrderTotal('))
      .map((file) => file.path);

    // The order editor is allowed its own arithmetic: it is computing the
    // figure it is about to write, not reading one back.
    expect(deciders.filter((path) => path !== join('orders', 'view', 'order-modal.ts'))).toEqual([
      RULE,
    ]);
  });

  it('is read from that file by the document, the card and the sort', () => {
    const byPath = new Map(sources(SRC).map((file) => [file.path, file.text]));

    for (const reader of [
      join('orders', 'invoice-model.ts'),
      join('orders', 'view', 'order-view.ts'),
      join('orders', 'view-model', 'orders-sort.ts'),
    ]) {
      expect(byPath.get(reader)).toContain('orderTotal(');
    }
  });

  /**
   * The rule itself, stated once so a reader of this suite does not have to
   * open another file to know which way round it goes.
   */
  it('prefers the lines over the typed figure, and never the other way round', () => {
    const rule = readFileSync(join(SRC, RULE), 'utf8');

    expect(rule).toContain('computedOrderTotal(order) ?? order.price');
    expect(rule).not.toContain('order.price ?? computedOrderTotal');
  });

  it('leaves an order with no priced line saying what somebody typed', () => {
    const rule = readFileSync(join(SRC, RULE), 'utf8');

    // `computedOrderTotal` returns null for an order with no line prices, so
    // the fallback is what every order written before line prices existed uses.
    expect(rule).toContain('?? order.price');
  });
});
