/**
 * Builds the DOM for an invoice-shaped document.
 *
 * Knows the model and nothing else: no App, no settings, no vault, no idea what
 * the document is about. It was the file a sibling plugin would have copied,
 * and it is the file both of them import instead; anything order-shaped or
 * meal-shaped reaching it would mean the split had failed.
 *
 * The class names it writes are the consumer's to style. They carry the `culi-`
 * prefix because CULItrail wrote them and its stylesheet already ships them;
 * renaming them would be a change to a file in every vault's plugin folder for
 * no gain a reader could see.
 */
import { setIcon } from 'obsidian';
import type {
  InvoiceFooter,
  InvoiceLine,
  InvoiceModel,
  InvoiceTotal,
} from '../document/invoice.js';

/** Follows one of the model's link targets. Resolution is the caller's business. */
export type FollowInvoiceLink = (target: string) => void;

export function renderInvoice(
  container: HTMLElement,
  model: InvoiceModel,
  onFollowLink: FollowInvoiceLink
): void {
  const root = container.createDiv({ cls: 'culi-invoice' });

  renderHead(root, model);
  renderFacts(root, model);
  renderTable(root, model, onFollowLink);
  renderTotals(root, model);
  if (model.footer) renderFooter(root, model.footer, onFollowLink);
}

function renderHead(root: HTMLElement, model: InvoiceModel): void {
  const head = root.createDiv({ cls: 'culi-invoice-head' });

  // Not named `document`: this file builds DOM, and shadowing the global there
  // is a trap for whoever edits it next.
  const identity = head.createDiv({ cls: 'culi-invoice-doc' });
  identity.createSpan({ cls: 'culi-invoice-doc-label', text: model.documentLabel });
  if (model.reference) {
    identity.createSpan({ cls: 'culi-invoice-reference', text: model.reference });
  }

  if (model.counterparty) {
    head.createDiv({ cls: 'culi-invoice-counterparty', text: model.counterparty });
  }
}

function renderFacts(root: HTMLElement, model: InvoiceModel): void {
  if (model.facts.length === 0) return;

  const facts = root.createDiv({ cls: 'culi-invoice-facts' });
  for (const fact of model.facts) {
    const row = facts.createSpan({ cls: 'culi-invoice-fact' });
    if (fact.icon) setIcon(row.createSpan({ cls: 'culi-invoice-fact-icon' }), fact.icon);
    row.createSpan({ cls: 'culi-label-caps', text: fact.label });
    row.createSpan({ cls: 'culi-invoice-fact-value', text: fact.value });
  }
}

/**
 * The table, wrapped so it can scroll sideways rather than widen the view.
 *
 * A document with no rows renders no table at all, headings included: a header
 * row over nothing reads as a table that failed to load.
 */
function renderTable(
  root: HTMLElement,
  model: InvoiceModel,
  onFollowLink: FollowInvoiceLink
): void {
  if (model.lines.length === 0) return;

  const scroller = root.createDiv({ cls: 'culi-invoice-table-scroll' });
  const table = scroller.createEl('table', { cls: 'culi-invoice-table' });

  const head = table.createEl('thead').createEl('tr');
  head.createEl('th', { cls: 'culi-invoice-col-label', text: model.columns.label });
  for (const heading of [
    model.columns.quantity,
    model.columns.unitPrice,
    model.columns.lineTotal,
  ]) {
    if (heading !== null) head.createEl('th', { cls: 'culi-invoice-col-num', text: heading });
  }

  const body = table.createEl('tbody');
  for (const line of model.lines) renderLine(body, model, line, onFollowLink);
}

function renderLine(
  body: HTMLElement,
  model: InvoiceModel,
  line: InvoiceLine,
  onFollowLink: FollowInvoiceLink
): void {
  const row = body.createEl('tr', { cls: 'culi-invoice-line' });
  const label = row.createEl('td', { cls: 'culi-invoice-cell-label' });

  const target = line.linkTarget;
  if (target) {
    const link = label.createEl('a', { cls: 'culi-invoice-link', text: line.label });
    link.addEventListener('click', () => onFollowLink(target));
  } else {
    label.setText(line.label);
  }

  // Driven by the model's columns rather than by what this line happens to
  // carry, so every row has the same number of cells and the figures stay in
  // their columns when one line is missing a value.
  const cells: [string | null, string | null | undefined][] = [
    [model.columns.quantity, line.quantity],
    [model.columns.unitPrice, line.unitPrice],
    [model.columns.lineTotal, line.lineTotal],
  ];
  for (const [heading, value] of cells) {
    if (heading === null) continue;
    row.createEl('td', { cls: 'culi-invoice-cell-num', text: value ?? '' });
  }
}

function renderTotals(root: HTMLElement, model: InvoiceModel): void {
  if (model.totals.length === 0) return;

  const totals = root.createDiv({ cls: 'culi-invoice-totals' });
  for (const total of model.totals) renderTotal(totals, model, total);
}

function renderTotal(totals: HTMLElement, model: InvoiceModel, total: InvoiceTotal): void {
  const row = totals.createDiv({
    cls: ['culi-invoice-total-row', `culi-invoice-total-${total.kind}`],
  });

  row.createSpan({ cls: 'culi-invoice-total-label', text: total.label });
  // Always rendered, even empty. The row is a three-column grid so that every
  // amount lines up down the block, and a row that skipped its remark would put
  // its amount in the remark's column instead.
  row.createSpan({ cls: 'culi-invoice-total-note', text: total.note ?? '' });
  row.createSpan({
    cls: 'culi-invoice-total-amount',
    text: model.currency ? `${model.currency} ${total.amount}` : total.amount,
  });
}

function renderFooter(
  root: HTMLElement,
  footer: InvoiceFooter,
  onFollowLink: FollowInvoiceLink
): void {
  if (footer.groups.length === 0) return;

  const section = root.createDiv({ cls: 'culi-invoice-footer' });
  section.createDiv({ cls: 'culi-invoice-footer-heading', text: footer.heading });

  for (const group of footer.groups) {
    const row = section.createDiv({ cls: 'culi-invoice-group' });
    row.createDiv({ cls: 'culi-invoice-group-label', text: group.label });

    const entries = row.createDiv({ cls: 'culi-invoice-group-entries' });
    group.entries.forEach((entry, index) => {
      if (index > 0) entries.appendText(', ');

      const target = entry.linkTarget;
      if (!target) {
        entries.createSpan({ text: entry.label });
        return;
      }

      const link = entries.createEl('a', { cls: 'culi-invoice-link', text: entry.label });
      link.addEventListener('click', () => onFollowLink(target));
    });
  }
}
