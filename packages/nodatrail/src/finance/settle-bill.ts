/**
 * The join between invoices and the ledger.
 *
 * An invoice is entered when it arrives; the bank statement turns up weeks
 * later carrying the same payment. Both describe one movement of money, and if
 * both wrote a posting the ledger would count it twice. So the import
 * recognises the invoice instead: it takes the account the invoice is booked
 * to, writes one posting, and stamps the invoice paid.
 *
 * That leaves the invoices no statement will ever carry -- cash, and any
 * account with no export -- which is what the mark-paid dialog is for. It posts
 * for itself, because nothing else is going to.
 */
import { App, TFile } from 'obsidian';
import { billStatus, isOutstanding, type BillForMatching, type BillRecord } from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { setBillPaid } from './edit-finance';
import { readBills } from './read-finance';

/** An invoice still owed, and the note it came from. */
export interface OpenBill {
  record: BillRecord<TFile>;
  forMatching: BillForMatching;
}

/**
 * The invoices a statement import needs to know about.
 *
 * Two kinds, for two different reasons. **Outstanding ones**, so a row that
 * pays one takes its account and stamps it paid. And **ones already settled
 * from an account by hand**, so a payment the mark-paid dialog has posted
 * already is not posted again by the file that turns up afterwards.
 *
 * A cancelled bill is in neither: somebody said explicitly it is not owed, and
 * offering it would let an unrelated payment of the same amount claim it.
 */
export function billsForImport(app: App, settings: NODAtrailSettings, today: Date): OpenBill[] {
  return readBills(app, settings)
    .filter((bill) => {
      const status = billStatus(bill, today, settings.billDueSoonDays);
      if (isOutstanding(status)) return true;
      return status === 'paid' && bill.paidFrom !== null;
    })
    .map((record) => ({
      record,
      forMatching: {
        title: record.title,
        companyTitle: record.companyTitle,
        amount: record.amount,
        currency: record.currency,
        account: record.account,
        lines: record.lines,
        issueDate: record.issueDate,
        dueDate: record.dueDate,
        paidDate: record.paidDate,
        paidFrom: record.paidFrom,
      },
    }));
}

/** One invoice an import settled, and what settled it. */
export interface Settlement {
  bill: BillRecord<TFile>;
  paidDate: string;
  paidFrom: number;
}

/**
 * Stamps every invoice an import settled.
 *
 * Written after the postings, not before: a failed write leaves the invoices
 * open, which is a state somebody can see and redo. Marked paid with no posting
 * behind them would be a state nothing reports.
 */
export async function settleBills(
  app: App,
  settings: NODAtrailSettings,
  settlements: readonly Settlement[]
): Promise<number> {
  let stamped = 0;
  for (const settlement of settlements) {
    await setBillPaid(
      app,
      settings,
      settlement.bill.file,
      settlement.paidDate,
      settlement.paidFrom
    );
    stamped += 1;
  }
  return stamped;
}
