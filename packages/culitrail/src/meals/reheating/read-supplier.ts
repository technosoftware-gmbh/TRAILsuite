/**
 * Which company sells a dish, and the reheating boilerplate it publishes.
 *
 * The one part of this feature that needs an `App`: everything else in
 * `src/meals/reheating/` is app-free and tested without a vault. Kept in a file
 * of its own for exactly that reason.
 *
 * **This reads a company note and never writes one.** A Person or Company note
 * is shared with APERtrail, and CULItrail's half of that contract is that it
 * creates and modifies neither. See docs/design/shared-crm.md.
 */
import { App, TFile } from 'obsidian';
import { emptyCompanyTerms, type CompanyTerms } from '../../crm/company-terms';
import { readCrmBoard } from '../../crm/read-crm';
import { eligiblePersonTitles } from '../../crm/persons';
import { ordersForMeal } from '../../orders/related-orders';
import { readOrders } from '../../orders/read-orders';
import type { CULItrailSettings } from '../../settings/types';
import { linkOrText } from 'trail-core';
import { readNoteOrEmpty } from '../../shared/vault-io';
import { stripFrontmatter } from '../parser/body-sections';
import { parseReheatSection } from './parse-section';
import type { ApplianceEntry } from './types';
import { selectionTitles } from 'trail-core';

/** How a supplier was arrived at, so a reader can be told which and why. */
export type SupplierSource = 'property' | 'order' | 'none';

export interface SupplierResolution {
  /** The company note, when one exists. Null when the answer is a name with no note. */
  file: TFile | null;
  title: string | null;
  source: SupplierSource;
  /**
   * What this company charges.
   *
   * Empty for a supplier that is a bare name with no note, which is the same
   * shape a company that states no terms produces: both mean there is nothing
   * to pre-fill an order from, and neither is an error.
   */
  terms: CompanyTerms;
}

/** No supplier at all, exported so a caller can state the absence rather than build it. */
export const NO_SUPPLIER: SupplierResolution = {
  file: null,
  title: null,
  source: 'none',
  terms: emptyCompanyTerms(),
};

/**
 * The company that sells this dish.
 *
 * The explicit property first, then the most recent order naming the dish. That
 * order is the point: a supplier derived from order history is a guess about the
 * present, correct in the common case and wrong for a dish bought once from a
 * company that has since changed its packaging, and the property is the escape
 * hatch from exactly that.
 *
 * A property naming a company with no note resolves to the title and no file. It
 * is not an error: the household knows who sells it, and there is simply no
 * boilerplate to read.
 */
export function resolveSupplier(
  app: App,
  settings: CULItrailSettings,
  mealTitle: string,
  frontmatter: Record<string, unknown>
): SupplierResolution {
  const companies = readCrmBoard(app, settings).companies;
  const found = (title: string): { file: TFile | null; terms: CompanyTerms } => {
    const company = companies.find(
      (candidate) => candidate.title.trim().toLowerCase() === title.trim().toLowerCase()
    );
    return { file: company?.file ?? null, terms: company?.terms ?? emptyCompanyTerms() };
  };

  const stated = linkOrText(frontmatter[settings.supplierProperty]);
  if (stated) return { ...found(stated), title: stated, source: 'property' };

  const orders = readOrders(app, settings, eligiblePersonTitles(app, settings));
  for (const order of ordersForMeal(orders, mealTitle)) {
    if (!order.companyTitle) continue;
    return { ...found(order.companyTitle), title: order.companyTitle, source: 'order' };
  }

  return NO_SUPPLIER;
}

/**
 * The supplier's reheating boilerplate, as appliance entries.
 *
 * Empty for a supplier with no note, no such section, or no supplier at all, and
 * the three are deliberately indistinguishable to the caller: each means the same
 * thing, which is that only the dish's own words are available.
 */
export async function readSupplierEntries(
  app: App,
  settings: CULItrailSettings,
  supplier: SupplierResolution
): Promise<ApplianceEntry[]> {
  if (!supplier.file) return [];

  const body = stripFrontmatter(await readNoteOrEmpty(app, supplier.file.path));
  return parseReheatSection(body, settings);
}

export interface SupplierReheating {
  supplier: SupplierResolution;
  entries: ApplianceEntry[];
}

/** Both halves in one call, for a view that wants to name the supplier it used. */
export async function readSupplierReheating(
  app: App,
  settings: CULItrailSettings,
  mealTitle: string,
  frontmatter: Record<string, unknown>
): Promise<SupplierReheating> {
  const supplier = resolveSupplier(app, settings, mealTitle, frontmatter);
  return { supplier, entries: await readSupplierEntries(app, settings, supplier) };
}

export interface MealRef {
  title: string;
  frontmatter: Record<string, unknown>;
}

/**
 * Suppliers for many meals at once.
 *
 * **Not a loop over `readSupplierReheating`, and that is the entire reason this
 * exists.** That function reads every order note to find the newest one naming
 * its dish, which is right for one meal and quadratic for a library: the
 * gallery asking it 126 times would read the 59 order notes 126 times over.
 * Here the orders are read once, each company's boilerplate is read once, and
 * both are shared across every meal that resolves to them.
 *
 * Keyed by meal title, lower-cased and trimmed, because that is how an order
 * names a dish and titles are compared that way everywhere else in the plugin.
 */
export interface MealSupplier {
  /** The company's title as the meal or the order names it. */
  title: string;
  entries: ApplianceEntry[];
  terms: CompanyTerms;
}

export async function readSuppliersForMeals(
  app: App,
  settings: CULItrailSettings,
  meals: MealRef[]
): Promise<Map<string, MealSupplier>> {
  const key = (title: string): string => title.trim().toLowerCase();

  const companies = readCrmBoard(app, settings).companies;
  const byCompanyKey = new Map(companies.map((company) => [key(company.title), company]));

  // The newest order per dish, from one pass over the orders rather than one
  // pass per dish.
  const newestCompany = new Map<string, string>();
  const orders = readOrders(app, settings, eligiblePersonTitles(app, settings));
  for (const order of [...orders].sort((a, b) =>
    (a.orderDate ?? '').localeCompare(b.orderDate ?? '')
  )) {
    if (!order.companyTitle) continue;
    for (const selection of order.selections) {
      // Ascending by date, so a later order overwrites an earlier one and the
      // last write wins is the newest.
      for (const title of selectionTitles(selection))
        newestCompany.set(key(title), order.companyTitle);
    }
  }

  const wanted = new Map<string, TFile>();
  const supplierOf = new Map<string, string>();
  const titleOf = new Map<string, string>();

  for (const meal of meals) {
    const stated = linkOrText(meal.frontmatter[settings.supplierProperty]);
    const title = stated ?? newestCompany.get(key(meal.title));
    if (!title) continue;

    supplierOf.set(key(meal.title), key(title));
    titleOf.set(key(title), title);
    const file = byCompanyKey.get(key(title))?.file;
    if (file) wanted.set(key(title), file);
  }

  const entriesByCompany = new Map<string, ApplianceEntry[]>();
  for (const [companyKey, file] of wanted) {
    const body = stripFrontmatter(await readNoteOrEmpty(app, file.path));
    entriesByCompany.set(companyKey, parseReheatSection(body, settings));
  }

  // Every meal that resolved to a company is in the map, including one whose
  // company publishes no boilerplate: the caller wants the name and the terms
  // whether or not there are reheating steps behind them.
  const byMeal = new Map<string, MealSupplier>();
  for (const meal of meals) {
    const companyKey = supplierOf.get(key(meal.title));
    if (!companyKey) continue;

    byMeal.set(key(meal.title), {
      title: titleOf.get(companyKey) ?? companyKey,
      entries: entriesByCompany.get(companyKey) ?? [],
      terms: byCompanyKey.get(companyKey)?.terms ?? emptyCompanyTerms(),
    });
  }
  return byMeal;
}
