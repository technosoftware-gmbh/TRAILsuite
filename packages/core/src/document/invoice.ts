/**
 * What a document laid out as an invoice consists of, with no idea what the
 * document is about.
 *
 * There is deliberately no domain word anywhere in this file: no order, no
 * delivery, no dish, no meal, no person. Everything here is a label and an
 * already-formatted value, so any plugin can render its own kind of document
 * through the one renderer by writing its own adapter. CULItrail has two
 * (an order and a delivery note) and APERtrail is expected to grow more, which
 * is what earned this file its move here: two consumers make a contract.
 *
 * App-free, and types only. The renderer that draws it needs a DOM and lives
 * in `trail-core/obsidian`.
 */

/** One label and value in the row of facts above the table. `icon` is a lucide id. */
export interface InvoiceFact {
  label: string;
  value: string;
  icon?: string;
}

/**
 * What a totals row means, so the renderer can style it without knowing what a
 * discount or a stated figure is.
 *
 * `stated` is the figure the source document itself claims, shown beside a
 * computed `total` rather than instead of it. A document that states a figure
 * and a document that adds one up are two different assertions, and collapsing
 * them loses the only interesting case: when they disagree.
 *
 * A list rather than a bare union, because the renderer builds a class name
 * from it and `tests/stylesheet.test.ts` cannot see a name it never reads as a
 * literal. A consumer's stylesheet test imports this, so a fifth kind added
 * without a rule fails there rather than rendering unstyled.
 */
export const INVOICE_TOTAL_KINDS = ['subtotal', 'adjustment', 'total', 'stated'] as const;

export type InvoiceTotalKind = (typeof INVOICE_TOTAL_KINDS)[number];

/**
 * The table's headings, and by their presence its columns.
 *
 * A null heading means that column is absent, rather than a separate list of
 * flags beside the labels: two fields that have to agree about the same column
 * is the shape that lets a table render a heading over nothing. The adapter
 * decides: a delivery note leaves the price columns null, an order fills them
 * in.
 */
export interface InvoiceColumns {
  label: string;
  quantity: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
}

/**
 * One row of the table.
 *
 * Every cell is display text the adapter already formatted. The renderer never
 * formats a number or a date, which is what keeps rounding, currency and locale
 * decisions in the one place that knows the domain.
 */
export interface InvoiceLine {
  label: string;
  /** What following this row opens, resolved by the caller. Null when nothing is behind it. */
  linkTarget?: string | null;
  quantity?: string | null;
  unitPrice?: string | null;
  lineTotal?: string | null;
}

export interface InvoiceTotal {
  label: string;
  amount: string;
  kind: InvoiceTotalKind;
  /** A short remark beside the amount, for a figure that needs qualifying. */
  note?: string | null;
}

export interface InvoiceFooterEntry {
  label: string;
  linkTarget?: string | null;
}

/** One labelled group of entries, such as a name and what sits under it. */
export interface InvoiceFooterGroup {
  label: string;
  entries: InvoiceFooterEntry[];
}

/** An optional block under the totals, for detail the table itself aggregates away. */
export interface InvoiceFooter {
  heading: string;
  groups: InvoiceFooterGroup[];
}

export interface InvoiceModel {
  /** What kind of document this is, in the reader's language. */
  documentLabel: string;
  /** The document's own identifier, already decorated. Null when it has none. */
  reference: string | null;
  /** Who the document is with. Null when unknown. */
  counterparty: string | null;
  facts: InvoiceFact[];
  /** Shown once beside the total rather than repeated in every cell. Null when unknown. */
  currency: string | null;
  columns: InvoiceColumns;
  lines: InvoiceLine[];
  totals: InvoiceTotal[];
  footer?: InvoiceFooter | null;
}
