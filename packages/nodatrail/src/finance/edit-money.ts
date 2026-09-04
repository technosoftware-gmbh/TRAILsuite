/**
 * Changing a money note that already exists.
 *
 * **Only the properties the form shows are written.** Everything else on the
 * note is left exactly as it was, including properties NODAtrail has no setting
 * for. A vault owner who added their own property to a bill should not lose it
 * to an edit dialog that thinks it knows the whole note.
 *
 * The title is not changed here. Renaming a note is Obsidian's own operation
 * and it has to update every link pointing at it; a finance dialog quietly
 * renaming files is a dialog somebody stops trusting with a folder.
 */
import { App, TFile } from 'obsidian';
import {
  purchaseDeliveriesValue,
  type ParsedBill,
  type ParsedPurchase,
  type ParsedRecurring,
  type PurchaseDelivery,
  wikilinkValue,
} from 'trail-core';
import { purchaseProperties } from './properties';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import type { NODAtrailSettings } from '../settings/types';

/** What the edit form can change. Deliberately fewer fields than a bill has. */
export type BillEdits = Pick<
  ParsedBill,
  | 'companyTitle'
  | 'areaTitle'
  | 'category'
  | 'amount'
  | 'currency'
  | 'issueDate'
  | 'dueDate'
  | 'reference'
  | 'documentPaths'
  | 'direction'
  | 'account'
  | 'recurringTitle'
  | 'lines'
>;

export async function writeBillEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: BillEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.billCompanyProperty, wikilinkOrNull(edits.companyTitle));
    write(frontmatter, settings.billAreaProperty, wikilinkOrNull(edits.areaTitle));
    write(frontmatter, settings.billCategoryProperty, edits.category);
    write(frontmatter, settings.billAmountProperty, edits.amount);
    write(frontmatter, settings.billCurrencyProperty, edits.currency);
    write(frontmatter, settings.billIssueDateProperty, edits.issueDate);
    write(frontmatter, settings.billDueDateProperty, edits.dueDate);
    write(frontmatter, settings.billReferenceProperty, edits.reference);
    writePaths(frontmatter, settings.billDocumentProperty, edits.documentPaths);
    // Written only when outgoing, the same rule the core's writer keeps: an
    // absent value means incoming, so writing it on every invoice would add a
    // property to say what every reader already assumes.
    write(
      frontmatter,
      settings.billDirectionProperty,
      edits.direction === 'outgoing' ? 'outgoing' : null
    );
    write(frontmatter, settings.ledgerAccountProperty, edits.account);
    write(frontmatter, settings.billRecurringProperty, wikilinkOrNull(edits.recurringTitle));
    writeList(
      frontmatter,
      settings.billLinesProperty,
      edits.lines.map((line) => {
        const row: Record<string, unknown> = {
          [settings.billLineAccountField]: line.account,
          [settings.billLineAmountField]: line.amount,
        };
        if (line.note) row[settings.billLineNoteField] = line.note;
        return row;
      })
    );
  });

  await touchModified(app, settings, file);
}

/**
 * Writes a value, or removes the property when there is none.
 *
 * Removing rather than writing an empty string, because a blank property and an
 * absent one read the same to a person and differently to a parser, and the
 * absent one is what a note that never had the field looks like.
 */
function write(
  frontmatter: Record<string, unknown>,
  property: string,
  value: string | number | null
): void {
  const key = property.trim();
  if (!key) return;
  if (value === null || value === '') delete frontmatter[key];
  else frontmatter[key] = value;
}

/**
 * The document property, which holds one path or several.
 *
 * One stays a bare string. Writing a list of one would rewrite the frontmatter
 * of every note that has ever had a document, to say what it already said, and
 * a diff full of those hides the edit somebody actually made.
 */
function writePaths(
  frontmatter: Record<string, unknown>,
  property: string,
  paths: readonly string[]
): void {
  const key = property.trim();
  if (!key) return;
  if (paths.length === 0) delete frontmatter[key];
  else if (paths.length === 1) frontmatter[key] = paths[0];
  else frontmatter[key] = [...paths];
}

function wikilinkOrNull(title: string | null): string | null {
  return title ? wikilinkValue(title) : null;
}

/** What the purchase edit form can change. The lines have an editor of their own. */
export type PurchaseEdits = Pick<
  ParsedPurchase,
  | 'companyTitle'
  | 'areaTitle'
  | 'category'
  | 'amount'
  | 'currency'
  | 'date'
  | 'status'
  | 'reference'
  | 'documentPaths'
>;

export async function writePurchaseEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: PurchaseEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.purchaseCompanyProperty, wikilinkOrNull(edits.companyTitle));
    write(frontmatter, settings.purchaseAreaProperty, wikilinkOrNull(edits.areaTitle));
    write(frontmatter, settings.purchaseCategoryProperty, edits.category);
    write(frontmatter, settings.purchaseAmountProperty, edits.amount);
    write(frontmatter, settings.purchaseCurrencyProperty, edits.currency);
    write(frontmatter, settings.purchaseDateProperty, edits.date);
    write(frontmatter, settings.purchaseStatusProperty, edits.status);
    write(frontmatter, settings.purchaseReferenceProperty, edits.reference);
    writePaths(frontmatter, settings.purchaseDocumentProperty, edits.documentPaths);
  });

  await touchModified(app, settings, file);
}

/**
 * Appends one consignment to a purchase's `deliveries:` list.
 *
 * **Appended, never rewritten.** The list is a history of what turned up and
 * when, so a second box does not restate the first, and nothing here recomputes
 * an entry somebody typed by hand. The whole list goes back through
 * `purchaseDeliveriesValue()` so one place decides what the sub-keys are called
 * and which of them are omitted.
 *
 * The status property is deliberately left alone. It is derived now
 * (`purchaseStatusOf()`), and writing it here would put a second, staler answer
 * in the note beside the consignments that decide it.
 */
export async function recordPurchaseDelivery(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  existing: readonly PurchaseDelivery[],
  added: PurchaseDelivery
): Promise<void> {
  const properties = purchaseProperties(settings);
  const value = purchaseDeliveriesValue([...existing, added], properties);

  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    if (value) frontmatter[properties.deliveriesProperty] = value;
  });

  await touchModified(app, settings, file);
}

/** What the recurring edit form can change. */
export type RecurringEdits = Pick<
  ParsedRecurring,
  | 'companyTitle'
  | 'areaTitle'
  | 'category'
  | 'amount'
  | 'currency'
  | 'cadence'
  | 'interval'
  | 'startDate'
  | 'endDate'
  | 'status'
  | 'reference'
  | 'documentPaths'
  | 'account'
>;

export async function writeRecurringEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: RecurringEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.recurringCompanyProperty, wikilinkOrNull(edits.companyTitle));
    write(frontmatter, settings.recurringAreaProperty, wikilinkOrNull(edits.areaTitle));
    write(frontmatter, settings.recurringCategoryProperty, edits.category);
    write(frontmatter, settings.recurringAmountProperty, edits.amount);
    write(frontmatter, settings.recurringCurrencyProperty, edits.currency);
    write(frontmatter, settings.recurringCadenceProperty, edits.cadence);
    // One is the absence of an interval rather than an interval, which is the
    // reading `buildRecurringFrontmatter` takes when the note is created.
    write(
      frontmatter,
      settings.recurringIntervalProperty,
      edits.interval === 1 ? null : edits.interval
    );
    write(frontmatter, settings.recurringStartProperty, edits.startDate);
    write(frontmatter, settings.recurringEndProperty, edits.endDate);
    write(frontmatter, settings.recurringStatusProperty, edits.status);
    write(frontmatter, settings.recurringReferenceProperty, edits.reference);
    writePaths(frontmatter, settings.recurringDocumentProperty, edits.documentPaths);
    write(frontmatter, settings.recurringAccountProperty, edits.account);
  });

  await touchModified(app, settings, file);
}

/** A list, or the property removed when there is nothing in it. Same rule as `write`. */
function writeList(
  frontmatter: Record<string, unknown>,
  property: string,
  rows: readonly Record<string, unknown>[]
): void {
  const key = property.trim();
  if (!key) return;
  if (rows.length === 0) delete frontmatter[key];
  else frontmatter[key] = rows;
}
