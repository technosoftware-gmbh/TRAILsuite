/**
 * The rolling budget year drawn on screen: the same two tables the printed
 * sheet has, built as elements.
 *
 * **Drawn from the sheet's own model**, `budgetSheetModel`, not from a second
 * reading of the ledger. The page and the screen are then one computation with
 * two renderings, so the figure somebody checks on screen is the figure they
 * print, which is the disagreement the ledger sheets plan exists to prevent.
 *
 * Elements rather than the sheet's markup: this plugin builds the DOM it owns
 * (see `ui-conventions.test.ts`), and an account row here is something to
 * click, which opens its statement.
 */
import type {
  BudgetSheet,
  BudgetSheetBalanceRow,
  BudgetSheetFlowRow,
} from '../../ledger/sheets/budget-sheet';

/**
 * The indent classes, by depth. Literals rather than a name built from the
 * number, so the stylesheet test can see every one of them is set; anything
 * deeper than the last sits at the last.
 */
const DEPTH_CLASSES = [
  'nod-roll-depth-0',
  'nod-roll-depth-1',
  'nod-roll-depth-2',
  'nod-roll-depth-3',
  'nod-roll-depth-4',
] as const;

/** The row classes, by kind, literal for the same reason. */
const ROW_CLASSES: Record<BudgetSheetFlowRow['kind'] | BudgetSheetBalanceRow['kind'], string> = {
  section: 'nod-roll-section',
  group: 'nod-roll-group',
  account: 'nod-roll-account-row',
  result: 'nod-roll-result',
  net: 'nod-roll-net',
};

function headerRows(table: HTMLTableElement, sheet: BudgetSheet): void {
  const head = table.createTHead();
  const closed = sheet.closedThrough;

  const phases = head.insertRow();
  phases.addClass('nod-roll-phase');
  phases.createEl('th', { cls: 'nod-roll-label' });
  phases.createEl('th');
  if (closed > 0) {
    const cell = phases.createEl('th', { text: sheet.labels.actual, cls: 'nod-roll-closed' });
    cell.colSpan = closed;
  }
  if (closed < 12) {
    const cell = phases.createEl('th', { text: sheet.labels.planned });
    if (closed > 0) cell.addClass('nod-roll-first-open');
    cell.colSpan = 12 - closed;
  }
  for (let index = 0; index < 3; index += 1) phases.createEl('th');

  const names = head.insertRow();
  names.createEl('th', { cls: 'nod-roll-label' });
  names.createEl('th', { text: sheet.labels.opening, cls: 'nod-roll-sum' });
  sheet.monthLabels.forEach((name, index) => {
    const cell = names.createEl('th', { text: name });
    monthClasses(cell, index, closed);
  });
  for (const label of [sheet.labels.total, sheet.labels.plan, sheet.labels.variance]) {
    names.createEl('th', { text: label, cls: 'nod-roll-sum' });
  }
}

function monthClasses(cell: HTMLElement, index: number, closed: number): void {
  if (index < closed) cell.addClass('nod-roll-closed');
  if (index === closed && closed > 0 && closed < 12) cell.addClass('nod-roll-first-open');
}

function figureCell(row: HTMLTableRowElement, value: string, negative: boolean): HTMLElement {
  const cell = row.createEl('td', { text: value, cls: 'nod-roll-num' });
  if (negative) cell.addClass('nod-roll-neg');
  return cell;
}

function labelCell(
  row: HTMLTableRowElement,
  entry: { label: string; depth: number; marks: string[]; account: number | null },
  openAccount: (number: number) => void
): void {
  const cell = row.createEl('td', { cls: 'nod-roll-label' });
  cell.addClass(
    DEPTH_CLASSES[Math.min(entry.depth, DEPTH_CLASSES.length - 1)] ?? 'nod-roll-depth-0'
  );
  cell.setAttr('title', entry.label);
  const account = entry.account;
  if (account !== null) {
    const link = cell.createEl('a', { text: entry.label, cls: 'nod-roll-account' });
    link.addEventListener('click', () => openAccount(account));
  } else {
    cell.createSpan({ text: entry.label });
  }
  for (const mark of entry.marks) cell.createSpan({ text: mark, cls: 'nod-roll-mark' });
}

function flowRow(
  body: HTMLTableSectionElement,
  entry: BudgetSheetFlowRow,
  closed: number,
  openAccount: (number: number) => void
): void {
  const row = body.insertRow();
  row.addClass(ROW_CLASSES[entry.kind]);
  labelCell(row, entry, openAccount);
  row.createEl('td', { cls: 'nod-roll-num nod-roll-sum' });
  entry.months.forEach((value, index) => {
    monthClasses(figureCell(row, value, entry.negative[index] ?? false), index, closed);
  });
  [entry.total, entry.plan, entry.variance].forEach((value, index) => {
    figureCell(row, value, entry.negative[12 + index] ?? false).addClass('nod-roll-sum');
  });
}

function balanceRow(
  body: HTMLTableSectionElement,
  entry: BudgetSheetBalanceRow,
  closed: number,
  projectedOpening: boolean,
  openAccount: (number: number) => void
): void {
  const row = body.insertRow();
  row.addClass(ROW_CLASSES[entry.kind]);
  labelCell(row, entry, openAccount);
  const opening = figureCell(row, entry.opening, entry.negative[0] ?? false);
  opening.addClass('nod-roll-sum');
  if (projectedOpening) opening.addClass('nod-roll-projected');
  entry.months.forEach((value, index) => {
    const cell = figureCell(row, value, entry.negative[index + 1] ?? false);
    monthClasses(cell, index, closed);
    if (index >= closed) cell.addClass('nod-roll-projected');
  });
  for (let index = 0; index < 3; index += 1)
    row.createEl('td', { cls: 'nod-roll-num nod-roll-sum' });
}

function table(parent: HTMLElement, sheet: BudgetSheet): HTMLTableSectionElement {
  // Scrolls sideways inside its own box: seventeen columns do not fit a pane,
  // and the view around them should not scroll with them.
  const scroller = parent.createDiv({ cls: 'nod-roll-scroll' });
  const element = scroller.createEl('table', { cls: 'nod-roll' });
  const columns = element.createEl('colgroup');
  columns.createEl('col', { cls: 'nod-roll-col-label' });
  for (let index = 0; index < 16; index += 1) columns.createEl('col', { cls: 'nod-roll-col' });
  headerRows(element, sheet);
  return element.createTBody();
}

function notes(parent: HTMLElement, lines: string[]): void {
  for (const line of lines) parent.createEl('p', { text: line, cls: 'nod-roll-note' });
}

/** The income and expense table, then its notes. */
export function renderRollingFlows(
  parent: HTMLElement,
  sheet: BudgetSheet,
  openAccount: (number: number) => void
): void {
  const body = table(parent, sheet);
  for (const entry of sheet.flows) flowRow(body, entry, sheet.closedThrough, openAccount);
  notes(parent, sheet.flowNotes);
}

/** The net worth table, then its notes. Nothing when the chart has no asset or liability with a balance. */
export function renderRollingBalances(
  parent: HTMLElement,
  sheet: BudgetSheet,
  openAccount: (number: number) => void
): void {
  if (sheet.balances.length === 0) return;
  const body = table(parent, sheet);
  for (const entry of sheet.balances)
    balanceRow(body, entry, sheet.closedThrough, sheet.openingProjected, openAccount);
  notes(parent, sheet.balanceNotes);
}
