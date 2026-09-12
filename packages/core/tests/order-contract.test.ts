/**
 * The contract itself, and the helper each side's own suite calls.
 *
 * The values are asserted literally rather than against the constant: a test
 * reading `ORDER_CONTRACT.orderPriceProperty` and comparing it to
 * `ORDER_CONTRACT.orderPriceProperty` passes whatever the value is, which is
 * the one thing this file exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  ORDER_CONTRACT,
  ORDER_CONTRACT_KEYS,
  orderContractMismatches,
  describeOrderContractMismatches,
  type OrderContract,
} from '../src/settings/order-contract';

describe('ORDER_CONTRACT', () => {
  it('holds the agreed values', () => {
    expect(ORDER_CONTRACT).toEqual({
      ordersFolder: 'Eating/Orders',
      orderTypeValue: 'order',
      orderCompanyProperty: 'company',
      orderDateProperty: 'orderDate',
      orderPriceProperty: 'price',
      orderPriceCurrencyProperty: 'priceCurrency',
    });
  });

  it('spells the type value in lower case', () => {
    // Compared against an on-disk `type:` value, so the casing is data rather
    // than style, the same way the CRM contract's type values are.
    expect(ORDER_CONTRACT.orderTypeValue).toBe('order');
  });

  it('is frozen, so a consumer cannot edit the shared copy', () => {
    expect(Object.isFrozen(ORDER_CONTRACT)).toBe(true);
  });

  it('lists every key of the interface exactly once', () => {
    expect([...ORDER_CONTRACT_KEYS].sort()).toEqual(Object.keys(ORDER_CONTRACT).sort());
    expect(new Set(ORDER_CONTRACT_KEYS).size).toBe(ORDER_CONTRACT_KEYS.length);
  });

  it('covers exactly the fields a reader needs off an order note', () => {
    // Folder and type locate the notes; company, date, price and currency are
    // the four facts read from one. A field beyond these would be a reader
    // taking an interest in what was eaten, which is the other plugin's
    // business, and a field missing would be a lookup with nothing behind it.
    expect([...ORDER_CONTRACT_KEYS]).toEqual([
      'ordersFolder',
      'orderTypeValue',
      'orderCompanyProperty',
      'orderDateProperty',
      'orderPriceProperty',
      'orderPriceCurrencyProperty',
    ]);
  });
});

describe('orderContractMismatches', () => {
  it('finds nothing when the defaults match', () => {
    expect(orderContractMismatches({ ...ORDER_CONTRACT })).toEqual([]);
  });

  it('reports a value that disagrees', () => {
    const drifted: OrderContract = { ...ORDER_CONTRACT, orderPriceProperty: 'amount' };
    expect(orderContractMismatches(drifted)).toEqual([
      { key: 'orderPriceProperty', expected: 'price', actual: 'amount' },
    ]);
  });

  it('reports a missing key rather than skipping it', () => {
    const { orderPriceCurrencyProperty: _omitted, ...partial } = { ...ORDER_CONTRACT };
    expect(orderContractMismatches(partial)).toEqual([
      { key: 'orderPriceCurrencyProperty', expected: 'priceCurrency', actual: undefined },
    ]);
  });

  it('catches the rename this module was written to catch', () => {
    // The price property renamed on one side only. Before this contract
    // existed both suites stayed green through exactly this change, and the
    // symptom was a ledger reading every order as unpriced.
    const renamedInOnePlugin = { ...ORDER_CONTRACT, orderPriceProperty: 'orderPrice' };
    expect(orderContractMismatches(renamedInOnePlugin).map((m) => m.key)).toEqual([
      'orderPriceProperty',
    ]);
  });

  it('reports every key a partial defaults object leaves out', () => {
    const two = { ordersFolder: 'Eating/Orders', orderTypeValue: 'order' };
    expect(orderContractMismatches(two).map((m) => m.key)).toEqual([
      'orderCompanyProperty',
      'orderDateProperty',
      'orderPriceProperty',
      'orderPriceCurrencyProperty',
    ]);
  });

  it('reports in contract order, not in the caller object order', () => {
    const scrambled: OrderContract = {
      orderPriceCurrencyProperty: 'a',
      orderPriceProperty: 'b',
      orderDateProperty: 'c',
      orderCompanyProperty: 'd',
      orderTypeValue: 'e',
      ordersFolder: 'f',
    };
    expect(orderContractMismatches(scrambled).map((m) => m.key)).toEqual([...ORDER_CONTRACT_KEYS]);
  });
});

describe('describeOrderContractMismatches', () => {
  it('names the key, what was wanted and what was found', () => {
    const message = describeOrderContractMismatches(
      orderContractMismatches({ ...ORDER_CONTRACT, ordersFolder: 'Orders' })
    );
    expect(message).toBe('ordersFolder: expected "Eating/Orders", got "Orders"');
  });

  it('is empty for no mismatches, so a passing assertion reads as silence', () => {
    expect(describeOrderContractMismatches([])).toBe('');
  });
});
