/**
 * "What has this person ordered", or "what have we ordered from them", rendered
 * inside the CRM note it sits in as a `culi-related-orders` fenced code block.
 *
 * This is CULItrail writing into a note it does not own, which is the whole point
 * of it. A Person note is shared: APERtrail creates it and renders which trips
 * that person was on, and this renders what they ordered. Neither plugin owns
 * the note; each answers its own question inside it, and the note stays readable
 * with either of them disabled, because a fence no plugin claims renders as a
 * plain code block rather than an error.
 *
 * Takes no arguments, and reads which note it is in from the rendering context's
 * own path, so the same fence works pasted into any Person or Company note.
 */
import { App, MarkdownPostProcessorContext, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { eligiblePersonTitles } from '../../crm/persons';
import { readCrmBoard } from '../../crm/read-crm';
import { formatIsoDate } from '../../meals/view-model/format-date';
import type { CULItrailSettings } from '../../settings/types';
import { readOrders } from '../read-orders';
import { ordersForCompany, ordersForPerson, orderTotal } from '../related-orders';
import type { OrderRecord } from '../types';
import { CUL_RELATED_ORDERS_BLOCK_LANG } from '../related-orders-block-lang';
import { selectionTitles } from 'trail-core';

export { CUL_RELATED_ORDERS_BLOCK_LANG };

/** Which question this note is the subject of, or null when it is neither. */
type BlockSubject = 'person' | 'company';

/** The note title to look up: the basename of the file being rendered. */
function titleFromPath(sourcePath: string): string {
  const name = sourcePath.split('/').pop() ?? sourcePath;
  return name.replace(/\.md$/i, '');
}

function blockSubject(
  app: App,
  settings: CULItrailSettings,
  sourcePath: string
): BlockSubject | null {
  const board = readCrmBoard(app, settings);

  if (board.persons.some((person) => person.file.path === sourcePath)) return 'person';
  return board.companies.some((company) => company.file.path === sourcePath) ? 'company' : null;
}

function priceText(order: OrderRecord): string | null {
  if (order.price === null) return null;
  return [order.price.toFixed(2), order.priceCurrency].filter(Boolean).join(' ');
}

/**
 * One row: when, who or whom, what, how much.
 *
 * `detail` is the half that differs between the two subjects, passed in rather
 * than branched on here, so the row layout is decided once.
 */
function renderRow(
  container: HTMLElement,
  order: OrderRecord,
  detail: string | null,
  mealTitles: string[],
  openFile: (path: string) => void
): void {
  const row = container.createDiv({ cls: 'culi-related-order' });

  row.createDiv({
    cls: 'culi-related-order-date',
    text: order.orderDate ? formatIsoDate(order.orderDate) : t('orders.related.noDate'),
  });

  setIcon(
    row.createSpan({ cls: 'culi-related-order-icon' }),
    order.deliveryDate ? 'truck' : 'receipt'
  );

  const body = row.createDiv({ cls: 'culi-related-order-body' });

  // The order number, not the filename: it is what a supplier calls this order,
  // and it is the thing somebody would be looking for on a receipt.
  const link = body.createEl('a', {
    cls: 'culi-related-order-link',
    text: order.orderNumber || order.title,
  });
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openFile(order.file.path);
  });

  if (detail) body.createSpan({ cls: 'culi-related-order-detail', text: detail });

  const price = priceText(order);
  if (price) body.createSpan({ cls: 'culi-related-order-price', text: price });

  // Said rather than left out: an order somebody was in on before deciding what
  // they wanted is a real state, and an empty row reads as a parsing failure.
  body.createDiv({
    cls: 'culi-related-order-meals',
    text: mealTitles.length > 0 ? mealTitles.join(', ') : t('orders.related.nothingChosen'),
  });
}

export interface RelatedOrdersBlockDeps {
  getSettings: () => CULItrailSettings;
  openFile: (path: string) => void;
}

export function renderRelatedOrders(
  app: App,
  el: HTMLElement,
  sourcePath: string,
  deps: RelatedOrdersBlockDeps
): void {
  el.empty();
  el.addClass('culi-related-orders');

  const settings = deps.getSettings();
  const subject = blockSubject(app, settings, sourcePath);

  if (!subject) {
    // Not an error. The likeliest cause is a folder or type-value setting that
    // does not match where the note actually lives, which is worth saying rather
    // than rendering an empty block somebody has to guess about.
    el.createDiv({ cls: 'culi-related-orders-empty', text: t('orders.related.notASubject') });
    return;
  }

  const title = titleFromPath(sourcePath);
  // Every configured person, not only the eligible ones: this reads back what an
  // order already says, and a person who has since been filtered out of the
  // picker was still on the order.
  const orders = readOrders(app, settings, eligiblePersonTitles(app, settings));

  if (subject === 'person') {
    const mine = ordersForPerson(orders, title);
    if (mine.length === 0) {
      el.createDiv({ cls: 'culi-related-orders-empty', text: t('orders.related.emptyPerson') });
      return;
    }

    for (const { order, selection } of mine) {
      renderRow(el, order, order.companyTitle, selectionTitles(selection), deps.openFile);
    }
    return;
  }

  const theirs = ordersForCompany(orders, title);
  if (theirs.length === 0) {
    el.createDiv({ cls: 'culi-related-orders-empty', text: t('orders.related.emptyCompany') });
    return;
  }

  for (const order of theirs) {
    // Who ordered, flattened: on a company note the interesting axis is the
    // order, and one row per person would repeat the date and price down the page.
    const people = order.selections.map((selection) => selection.personTitle).filter(Boolean);
    const meals = order.selections.flatMap((selection) => selectionTitles(selection));
    renderRow(el, order, people.join(', ') || null, meals, deps.openFile);
  }

  const total = orderTotal(theirs);
  if (total) {
    el.createDiv({
      cls: 'culi-related-orders-total',
      text: t('orders.related.total', {
        amount: total.amount.toFixed(2),
        currency: total.currency,
        count: theirs.length,
      }),
    });
  }
}

/** The registrar is passed in so the plugin instance owns the registration. */
export function registerRelatedOrdersBlock(
  app: App,
  deps: RelatedOrdersBlockDeps,
  register: (
    lang: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
  ) => void
): void {
  register(CUL_RELATED_ORDERS_BLOCK_LANG, (_source, el, ctx) => {
    renderRelatedOrders(app, el, ctx.sourcePath, deps);
  });
}
