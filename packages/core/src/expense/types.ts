/**
 * The money notes' domain model: what a purchase, a bill, a recurring cost and
 * a budget say.
 *
 * Here rather than in NODAtrail on the note-format rule, which does not count
 * consumers. A bill note is a record of a transaction, and the notes in a vault
 * go on holding to their format long after any particular reader of them. A
 * format defined inside the view that renders it is redefined every time the
 * rendering changes, and a bill whose meaning drifted between releases would be
 * a bill whose paid-ness drifted.
 *
 * The trip and photo-spot schemas stay in APERtrail, and the PARA schemas stay
 * in NODAtrail, on the other side of the same line: those are a product's model
 * of the world rather than a record of something that happened.
 *
 * App-free.
 */

/**
 * How far along a purchase is.
 *
 * A fixed vocabulary, because the views and the totals key off these exact
 * strings. `returned` counts as zero and stays visible, for the reason
 * APERtrail's `refunded` does: the note is the evidence, and deleting it would
 * lose the reference the money came back under.
 */
export const PURCHASE_STATUSES = ['ordered', 'delivered', 'returned', 'cancelled'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * What a bill is, right now.
 *
 * **Derived rather than stored**, except where a note states one explicitly.
 * `paid` follows from a paid date, `overdue` and `due` from the due date and
 * today. The only one that cannot be derived is `cancelled`, because no date
 * says it, which is exactly why the property exists at all.
 */
export const BILL_STATUSES = ['open', 'due', 'overdue', 'paid', 'cancelled'] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

/** How often a standing charge falls due. Fixed: the projection arithmetic keys off each one. */
export const RECURRING_CADENCES = [
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'once',
] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const RECURRING_STATUSES = ['active', 'paused', 'ended'] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

/**
 * The categories a fresh install ships.
 *
 * **A list, not a fixed vocabulary.** Nothing in the code keys off a particular
 * one: budget matching is string equality against whatever the note says, so a
 * vault that adds `pets` gets a working budget line without a release. These
 * are ids rather than words, so each shows in the reader's own language, and an
 * id this list does not know is kept and shown exactly as written. That is
 * `meal/nutrients.ts`'s rule, and it is here for the same reason: the
 * vocabulary is a default, not a boundary.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'housing',
  'utilities',
  'insurance',
  'health',
  'transport',
  'food',
  'household',
  'leisure',
  'education',
  'tax',
  'fees',
  'savings',
  'gifts',
  'other',
] as const;

/**
 * One line of a purchase.
 *
 * `name` is free text rather than a link, which is the one real difference from
 * a meal order's line. The thing bought is usually not a note and should never
 * have to become one before it can be written down.
 *
 * A null price means nobody recorded one. It is not zero: zero is a line that
 * was genuinely free, and a view that showed the two the same way would report
 * an unpriced order as free.
 */
export interface ExpenseLine {
  name: string;
  price: number | null;
  /** At least 1, and omitted from the note when it is 1. */
  quantity: number;
  /** A percentage off this line alone, on top of anything off the whole purchase. */
  discount: number | null;
  note: string | null;
}

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return (
    typeof value === 'string' && (PURCHASE_STATUSES as readonly string[]).includes(value.trim())
  );
}

export function isBillStatus(value: unknown): value is BillStatus {
  return typeof value === 'string' && (BILL_STATUSES as readonly string[]).includes(value.trim());
}

export function isRecurringCadence(value: unknown): value is RecurringCadence {
  return (
    typeof value === 'string' && (RECURRING_CADENCES as readonly string[]).includes(value.trim())
  );
}

export function isRecurringStatus(value: unknown): value is RecurringStatus {
  return (
    typeof value === 'string' && (RECURRING_STATUSES as readonly string[]).includes(value.trim())
  );
}
