/**
 * Creating the four money notes.
 *
 * Three of the four are named the same way, from the three facts each of them
 * already carries: `20260604_baloise_1040269824`. `finance-title.ts` derives
 * it, and the forms let somebody overrule it. A budget is titled by its year,
 * which is the only fact it has.
 *
 * All four are filed under a subfolder derived from the date they are about,
 * which `paths.ts` decides. A bill with no date lands in the module folder
 * itself rather than in a folder named after nothing.
 */
import { App, TFile } from 'obsidian';
import {
  buildBillFrontmatter,
  buildAccountBudgetFrontmatter,
  buildPurchaseFrontmatter,
  buildRecurringFrontmatter,
  type ParsedBill,
  type ParsedAccountBudget,
  type ParsedPurchase,
  type ParsedRecurring,
} from 'trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { createTypedNote } from '../vault/create-note';
import { budgetDateOf, dateOf, noteFolderFor } from './paths';
import {
  billProperties,
  budgetProperties,
  purchaseProperties,
  recurringProperties,
} from './properties';

/** Everything a purchase note says. The reference is a property now, like every other field. */
export type PurchaseContent = ParsedPurchase;

export function createPurchase(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: PurchaseContent,
  now: Date
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: noteFolderFor(settings, 'purchase', dateOf(content.date)),
      title,
      typeValue: settings.purchaseTypeValue,
      properties: stripType(
        buildPurchaseFrontmatter(purchaseProperties(settings), content),
        settings
      ),
    },
    now
  );
}

export function createBill(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParsedBill,
  now: Date
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: noteFolderFor(settings, 'bill', dateOf(content.issueDate ?? content.dueDate)),
      title,
      typeValue: settings.billTypeValue,
      properties: stripType(buildBillFrontmatter(billProperties(settings), content), settings),
    },
    now
  );
}

export function createRecurring(
  app: App,
  settings: NODAtrailSettings,
  title: string,
  content: ParsedRecurring,
  now: Date
): Promise<TFile> {
  return createTypedNote(
    app,
    settings,
    {
      folder: noteFolderFor(settings, 'recurring', dateOf(content.startDate)),
      title,
      typeValue: settings.recurringTypeValue,
      properties: stripType(
        buildRecurringFrontmatter(recurringProperties(settings), content),
        settings
      ),
    },
    now
  );
}

export function createBudget(
  app: App,
  settings: NODAtrailSettings,
  content: ParsedAccountBudget,
  now: Date
): Promise<TFile> {
  const title = content.period ?? 'budget';

  return createTypedNote(
    app,
    settings,
    {
      folder: noteFolderFor(settings, 'budget', budgetDateOf(content.period)),
      title,
      typeValue: settings.budgetTypeValue,
      properties: stripType(
        buildAccountBudgetFrontmatter(budgetProperties(settings), content),
        settings
      ),
    },
    now
  );
}

/** See `para/create.ts`: the type property is `frontmatterObject`'s to place, not a builder's to repeat. */
function stripType(
  frontmatter: Record<string, unknown>,
  settings: NODAtrailSettings
): Record<string, unknown> {
  const { [settings.typePropertyName]: _type, ...rest } = frontmatter;
  return rest;
}
