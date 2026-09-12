/**
 * A franc figure written against a euro cash box.
 *
 * The quietest error a household ledger can hold. The line parses, the split
 * sums, both sides move the same number, the books close to the cent, and one
 * of the two accounts is wrong by the whole exchange rate. Nothing except the
 * chart knows: the journal is chart-free by design, so the parser cannot catch
 * it and every report downstream is happy to add it up.
 *
 * Found in a real vault: `4024 | 1001 | CHF 130.00 | Tanken`, where 1001 is a
 * euro cash box. It took 130 euros off a box that had lost about 136.
 */
import { describe, expect, it } from 'vitest';
import {
  amountFor,
  balanceAt,
  currencyFor,
  currencyMismatches,
  parseAccount,
  type Account,
  type AccountProperties,
  type Posting,
} from '../../src/index.js';

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

function account(
  number: number,
  currency: string | null,
  extra: Record<string, unknown> = {}
): Account {
  const parsed = parseAccount({ number, currency, ...extra }, `Konto ${number}`, P);
  if (!parsed) throw new Error('unreadable fixture');
  return parsed;
}

function posting(over: Partial<Posting> = {}): Posting {
  return {
    date: '2026-01-31',
    debit: 4024,
    credit: 1001,
    amount: 130,
    currency: 'CHF',
    text: 'Tanken',
    reference: null,
    counterAmount: null,
    counterCurrency: null,
    line: 1,
    entryLine: 1,
    splitOf: null,
    importKey: null,
    ...over,
  };
}

const FUEL = account(4024, 'CHF', { kind: 'expense' });
const BOX = account(1001, 'EUR', { kind: 'asset', opening: 310 });

describe("a posting whose currency is not its account's", () => {
  it('is reported, naming the account and what the figure is written in', () => {
    const found = currencyMismatches([FUEL, BOX], [posting()]);
    expect(found).toHaveLength(1);
    expect(found[0]?.account.number).toBe(1001);
    expect(found[0]?.written).toBe('CHF');
  });

  it('is not reported once both figures are written', () => {
    const fixed = posting({ counterAmount: 135.58, counterCurrency: 'EUR' });
    expect(currencyMismatches([FUEL, BOX], [fixed])).toEqual([]);
  });

  it('names only the side that is wrong', () => {
    const found = currencyMismatches([FUEL, BOX], [posting()]);
    expect(found.map((entry) => entry.account.number)).toEqual([1001]);
  });

  it('leaves a bare figure alone, which the format allows', () => {
    // No currency written at all is the home currency by convention, and
    // flagging those would report a whole vault written the intended way.
    expect(currencyMismatches([FUEL, BOX], [posting({ currency: null })])).toEqual([]);
  });

  it('says nothing about an account with no currency of its own', () => {
    const vague = account(4025, null, { kind: 'expense' });
    expect(currencyMismatches([vague, BOX], [posting({ debit: 4025, credit: 4025 })])).toEqual([]);
  });

  it('says nothing when both sides name the same account, which moves nothing', () => {
    expect(currencyMismatches([FUEL, BOX], [posting({ debit: 1001, credit: 1001 })])).toEqual([]);
  });

  it('is silent on a vault where every posting matches its accounts', () => {
    const chf = account(1011, 'CHF', { kind: 'asset' });
    const clean = posting({ debit: 4024, credit: 1011, currency: 'CHF' });
    expect(currencyMismatches([FUEL, chf], [clean])).toEqual([]);
  });
});

describe('what the mismatch costs', () => {
  it('takes the wrong figure off the account', () => {
    // 130 francs left the box, which held euros. The box loses 130 of them.
    expect(balanceAt([posting()], BOX, '2026-01-31')).toBe(180);
  });

  it('takes the right figure once both are written', () => {
    const fixed = posting({ counterAmount: 135.58, counterCurrency: 'EUR' });
    expect(balanceAt([fixed], BOX, '2026-01-31')).toBe(174.42);
    // And the franc side is untouched by the euro figure.
    expect(amountFor(fixed, FUEL)).toBe(130);
  });
});

describe('currencyFor and amountFor agree about which side an account reads', () => {
  const cases: Posting[] = [
    posting(),
    posting({ counterAmount: 135.58, counterCurrency: 'EUR' }),
    posting({ counterAmount: 135.58, counterCurrency: null }),
    posting({ counterAmount: null, counterCurrency: 'EUR' }),
    posting({ currency: null }),
  ];

  it("never reports one side's currency with the other side's amount", () => {
    for (const entry of cases) {
      for (const acct of [FUEL, BOX]) {
        const readsCounter = amountFor(entry, acct) === entry.counterAmount;
        const saysCounter = currencyFor(entry, acct) === entry.counterCurrency;
        // Only meaningful when the two figures actually differ, otherwise
        // equality does not tell them apart.
        if (entry.counterAmount !== null && entry.counterAmount !== entry.amount) {
          expect(saysCounter).toBe(readsCounter);
        }
      }
    }
  });
});
