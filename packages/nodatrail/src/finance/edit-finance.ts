/**
 * Editing the two properties Obsidian's own property editor cannot edit.
 *
 * Everything else on a money note is a flat scalar or a list of links, and the
 * property editor is already the right tool for those: NODAtrail creates the
 * note and never opens it again. The two exceptions are a purchase's `items`
 * and a budget's `lines`, both lists of maps, which the property editor renders
 * as an unusable blob of nested fields.
 *
 * **The edit is surgical.** It rewrites one property through the host's own
 * frontmatter editor and leaves every other property, and the whole body,
 * exactly as it was. That is why this goes through `frontmatter.process()`
 * rather than rebuilding the note from a parsed model: a rebuild would carry
 * the note's own properties across only as well as the parser understood them,
 * and a property NODAtrail has no setting for would quietly disappear.
 */
import { App, TFile } from 'obsidian';
import type { AccountBudgetLine, ExpenseLine } from '@technosoftware/trail-core';
import { formatDayTitle } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import type { NODAtrailSettings } from '../settings/types';

/**
 * Writes a purchase's lines.
 *
 * A price, a quantity of one, a discount and a note are each omitted when they
 * say nothing, on the same terms the builder uses: a note holding
 * `quantity: 1` says nothing a note without it does not, and two spellings of
 * the same fact are two things for a hand edit to contradict.
 *
 * An empty list removes the property rather than writing `items: []`. Unlike a
 * budget's lines, an empty items list makes no claim: a purchase with no lines
 * is simply a purchase somebody recorded as a single total.
 */
export async function writePurchaseItems(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  items: readonly ExpenseLine[]
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    if (items.length === 0) {
      delete frontmatter[settings.purchaseItemsProperty];
      return;
    }

    frontmatter[settings.purchaseItemsProperty] = items.map((item) => {
      const value: Record<string, unknown> = { [settings.purchaseItemNameField]: item.name };

      if (item.price !== null) value[settings.purchaseItemPriceField] = item.price;
      if (item.quantity !== 1) value[settings.purchaseItemQuantityField] = item.quantity;
      if (item.discount !== null) value[settings.purchaseItemDiscountField] = item.discount;
      if (item.note) value[settings.purchaseItemNoteField] = item.note;
      return value;
    });
  });

  await touchModified(app, settings, file);
}

/**
 * Writes a budget's lines.
 *
 * **Written even when empty**, which is the opposite of a purchase's items and
 * for a reason: an empty list is how a budget note says "this period is
 * budgeted and holds nothing" rather than "this note has not been filled in".
 * That is the same rule a meal plan's `entries` follows, and it is the only
 * property in this plugin with it.
 */
export async function writeBudgetLines(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  lines: readonly AccountBudgetLine[]
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    frontmatter[settings.budgetLinesProperty] = lines.map((line) => {
      const value: Record<string, unknown> = {
        [settings.budgetLineAccountField]: line.account,
        [settings.budgetLineAmountField]: line.amount,
        [settings.budgetLineRhythmField]: line.rhythm,
      };

      // The three that are written only when they say something, so a budget
      // somebody left simple stays simple in the file.
      if (line.startMonth !== null) value[settings.budgetLineMonthField] = line.startMonth;
      if (line.note) value[settings.budgetLineNoteField] = line.note;
      if (Object.keys(line.overrides).length > 0) {
        value[settings.budgetLineOverridesField] = { ...line.overrides };
      }
      return value;
    });
  });

  await touchModified(app, settings, file);
}

/**
 * The day a bill was most likely paid, offered as a starting point.
 *
 * The due date, because a standing order pays on it and a person paying by hand
 * pays near it. Falling back to today for a bill that names no due date, which
 * is the only other day anybody has in mind while looking at one.
 *
 * **Offered, never written.** This is what a prompt starts at; what gets stored
 * is whatever the reader confirms. Pure, so the choice is testable without a
 * vault.
 */
export function likelyPaidDate(
  bill: { dueDate: string | null; issueDate: string | null },
  today: Date
): string {
  return bill.dueDate ?? bill.issueDate ?? formatDayTitle(today);
}

/**
 * Sets or clears a bill's paid date.
 *
 * The only field on a bill worth a one-click action: it is the commonest thing
 * that happens to one, and it is the difference between a list of what is owed
 * and a list of every bill ever received.
 *
 * Clearing removes the property rather than writing it empty, so a bill that was
 * marked paid by mistake goes back to being exactly what it was.
 *
 * The account the money left is written alongside, when whoever settled the
 * bill knows it: the statement import always does, the mark-paid dialog asks.
 */
export async function setBillPaid(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  paidDate: string | null,
  paidFrom: number | null = null
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    if (paidDate) frontmatter[settings.billPaidDateProperty] = paidDate;
    else delete frontmatter[settings.billPaidDateProperty];

    // The account goes with the date. Unpaying a bill takes both away, because
    // an account the money left is a claim about a payment that did not happen.
    if (paidDate && paidFrom !== null) frontmatter[settings.paidFromProperty] = paidFrom;
    else if (!paidDate) delete frontmatter[settings.paidFromProperty];
  });

  await touchModified(app, settings, file);
}
