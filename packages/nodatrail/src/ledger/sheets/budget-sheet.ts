/**
 * The budget year as one landscape page you can print: markup only.
 *
 * The shape is the household spreadsheet this replaces. One row per account
 * under the chart's groups, one column per month, and a line between the
 * months that are closed (what happened) and the months still to come (what
 * is planned). Then the total, the plan as made, and the difference, which is
 * what says whether the rest of the year still works. A second table below it
 * holds what is owned and owed at each month end.
 *
 * Pure by design, like APERtrail's trip document: it takes strings that are
 * already localized and already formatted and returns markup, so "what does
 * this say" stays separate from "what is in the vault". Every string goes
 * through `pageText`, because an account title is user input.
 */
import { pageText as esc, printableDocument, sheetCreditHtml } from '@technosoftware/trail-core';

/** One row of the income and expense table. */
export interface BudgetSheetFlowRow {
  kind: 'section' | 'group' | 'account' | 'result';
  label: string;
  /** The account's number on an account row, so a screen can open its statement. Paper ignores it. */
  account: number | null;
  /** How far in the label sits: 0 for a section total, 1 for a top group, and so on. */
  depth: number;
  /** Said after the label in a muted word: "not budgeted", "no rate". */
  marks: string[];
  /** Twelve formatted figures, or '' where there is nothing to say. */
  months: string[];
  total: string;
  plan: string;
  variance: string;
  /** Which of the figures above are below zero, by the same index: months 0-11, then total, plan, variance. */
  negative: boolean[];
}

/** One row of the balances table. Months after the last closed one are '' except on the net worth row. */
export interface BudgetSheetBalanceRow {
  kind: 'section' | 'group' | 'account' | 'net';
  label: string;
  /** As on a flow row. */
  account: number | null;
  depth: number;
  marks: string[];
  opening: string;
  months: string[];
  /** Opening, then months 0-11. */
  negative: boolean[];
}

export interface BudgetSheet {
  /** The language the words are in, for the document. */
  lang: string;
  title: string;
  /** Under the title: the currency, and how far the year is closed. */
  meta: string[];
  /** Twelve short month names. */
  monthLabels: string[];
  /** 0 to 12. */
  closedThrough: number;
  labels: {
    flows: string;
    balances: string;
    opening: string;
    total: string;
    plan: string;
    variance: string;
    actual: string;
    planned: string;
  };
  flows: BudgetSheetFlowRow[];
  balances: BudgetSheetBalanceRow[];
  /** Short explanations printed under a table. */
  flowNotes: string[];
  balanceNotes: string[];
  footer: {
    truth: string;
    /** Null when no account in another currency is on the sheet. */
    currency: string | null;
    credit: string;
  };
}

/**
 * The page. Landscape, because sixteen columns are the sheet, and it is
 * printed from Chrome, which honours a page size where Safari does not.
 *
 * Grey behind the closed months, so the line between reality and plan is
 * visible across the whole table and not only in its header. `print-color-
 * adjust` is what stops a browser from dropping that background to save ink.
 */
const STYLE = `
  @page { size: A4 landscape; margin: 9mm 8mm; }
  body { max-width: none; padding: 0; font-size: 8pt; }
  h1 { font-size: 15pt; }
  .budget { width: 100%; border-collapse: collapse; table-layout: fixed;
            font-size: 6.6pt; line-height: 1.25;
            -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .budget col.label { width: 42mm; }
  .budget col.sum { width: 15.5mm; }
  .budget th, .budget td { padding: 0.55mm 0.7mm; border-bottom: 0.3pt solid #e2e4e8;
                           overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .budget thead th { font-weight: 600; color: #3d424b; border-bottom: 0.8pt solid #14161a;
                     text-align: right; }
  .budget thead th.label { text-align: left; }
  .budget thead tr.phase th { border-bottom: none; font-weight: 500; color: #6b7079; text-align: center;
                              font-size: 6.2pt; text-transform: uppercase; letter-spacing: 0.4pt; }
  /* A figure is never cut short: a clipped "-320'000.00" reads as a different
     number. Only the label column may end in an ellipsis. */
  .budget td.num { text-align: right; font-variant-numeric: tabular-nums;
                   overflow: visible; text-overflow: clip; }
  .budget .closed { background: #f1f2f4; }
  .budget .first-open { border-left: 0.9pt solid #14161a; }
  .budget .sum { border-left: 0.6pt solid #adb2ba; }
  .budget tr.section td { font-weight: 700; border-top: 0.8pt solid #14161a; }
  .budget tr.group td { font-weight: 600; }
  .budget tr.result td, .budget tr.net td { font-weight: 700; border-top: 0.8pt solid #14161a;
                                             border-bottom: 0.8pt solid #14161a; }
  .budget tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .budget .neg { color: #b3261e; }
  .budget .projected { font-style: italic; color: #565c66; }
  .budget .mark { font-weight: 400; font-style: italic; color: #6b7079; padding-left: 1.2mm; }
  .notes { font-size: 7.5pt; color: #565c66; margin: 1.5mm 0 0; }
  .notes p { margin: 0 0 0.8mm; }
  .balances { break-before: page; page-break-before: always; }
  footer .credit a { color: inherit; }
`;

function cellClass(index: number, closedThrough: number): string {
  const classes = ['num'];
  if (index < closedThrough) classes.push('closed');
  if (index === closedThrough && closedThrough > 0 && closedThrough < 12)
    classes.push('first-open');
  return classes.join(' ');
}

function figureCell(value: string, negative: boolean, classes: string): string {
  const all = negative ? `${classes} neg` : classes;
  return `<td class="${all}">${esc(value)}</td>`;
}

function labelCell(label: string, depth: number, marks: string[]): string {
  const indent = depth > 0 ? ` style="padding-left:${(depth * 2.6).toFixed(1)}mm"` : '';
  const said = marks.map((mark) => `<span class="mark">${esc(mark)}</span>`).join('');
  return `<td class="label"${indent} title="${esc(label)}">${esc(label)}${said}</td>`;
}

/** The two header rows: which months are actual and which are plan, then the month names. */
function monthHeader(sheet: BudgetSheet, before: string[], after: string[]): string {
  const closed = sheet.closedThrough;
  const open = 12 - closed;
  const lead = before.map(() => '<th></th>').join('');
  const trail = after.map(() => '<th></th>').join('');
  const phases =
    (closed > 0 ? `<th colspan="${closed}" class="closed">${esc(sheet.labels.actual)}</th>` : '') +
    (open > 0
      ? `<th colspan="${open}"${closed > 0 ? ' class="first-open"' : ''}>${esc(sheet.labels.planned)}</th>`
      : '');

  const names = sheet.monthLabels
    .map((name, index) => `<th class="${cellClass(index, closed)}">${esc(name)}</th>`)
    .join('');
  const beforeCells = before.map((label) => `<th class="sum">${esc(label)}</th>`).join('');
  const afterCells = after.map((label) => `<th class="sum">${esc(label)}</th>`).join('');

  return (
    `<thead><tr class="phase"><th class="label"></th>${lead}${phases}${trail}</tr>` +
    `<tr><th class="label"></th>${beforeCells}${names}${afterCells}</tr></thead>`
  );
}

/** The label, the twelve months, and the summary columns before or after them, which get a fixed width so their headings fit. */
function colgroup(before: number, after: number): string {
  const sums = (count: number) => '<col class="sum">'.repeat(count);
  return `<colgroup><col class="label">${sums(before)}${'<col>'.repeat(12)}${sums(after)}</colgroup>`;
}

function flowTable(sheet: BudgetSheet): string {
  const { labels } = sheet;
  const rows = sheet.flows
    .map((row) => {
      const months = row.months
        .map((value, index) =>
          figureCell(value, row.negative[index] ?? false, cellClass(index, sheet.closedThrough))
        )
        .join('');
      const sums = [row.total, row.plan, row.variance]
        .map((value, index) => figureCell(value, row.negative[12 + index] ?? false, 'num sum'))
        .join('');
      // An empty Vortrag, so this table's months sit under the balances'
      // months: the two halves are read against each other column by column.
      return `<tr class="${row.kind}">${labelCell(row.label, row.depth, row.marks)}<td class="num sum"></td>${months}${sums}</tr>`;
    })
    .join('');

  return (
    `<table class="budget flows">${colgroup(1, 3)}` +
    monthHeader(sheet, [labels.opening], [labels.total, labels.plan, labels.variance]) +
    `<tbody>${rows}</tbody></table>`
  );
}

function balanceTable(sheet: BudgetSheet): string {
  const rows = sheet.balances
    .map((row) => {
      const opening = figureCell(row.opening, row.negative[0] ?? false, 'num sum');
      const months = row.months
        .map((value, index) => {
          const classes = cellClass(index, sheet.closedThrough);
          const projected = row.kind === 'net' && index >= sheet.closedThrough;
          return figureCell(
            value,
            row.negative[index + 1] ?? false,
            projected ? `${classes} projected` : classes
          );
        })
        .join('');
      // And empty Total, Plan and Variance for the same reason in the other
      // direction: a balance on a day does not add up across a year.
      const empty = '<td class="num sum"></td>'.repeat(3);
      return `<tr class="${row.kind}">${labelCell(row.label, row.depth, row.marks)}${opening}${months}${empty}</tr>`;
    })
    .join('');

  return (
    `<table class="budget">${colgroup(1, 3)}` +
    monthHeader(
      sheet,
      [sheet.labels.opening],
      [sheet.labels.total, sheet.labels.plan, sheet.labels.variance]
    ) +
    `<tbody>${rows}</tbody></table>`
  );
}

function notes(lines: string[]): string {
  if (lines.length === 0) return '';
  return `<div class="notes">${lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>`;
}

export function buildBudgetSheetHtml(sheet: BudgetSheet): string {
  const header =
    `<header><h1>${esc(sheet.title)}</h1>` +
    `<div class="meta">${sheet.meta.map((part) => esc(part)).join('<span class="sep">&middot;</span>')}</div>` +
    `</header>`;

  // Plain headings rather than `section()`, which glues a heading to the block
  // under it in one box no engine may break. A table of sixty rows is taller
  // than a page, and a box that cannot fit is broken anyway, after first being
  // pushed to a fresh page. Neither heading can be stranded at a page foot:
  // the first follows the title, the second opens a page of its own.
  const flows = `<h2>${esc(sheet.labels.flows)}</h2>${flowTable(sheet)}${notes(sheet.flowNotes)}`;
  const balances =
    sheet.balances.length === 0
      ? ''
      : `<div class="balances"><h2>${esc(sheet.labels.balances)}</h2>` +
        `${balanceTable(sheet)}${notes(sheet.balanceNotes)}</div>`;

  const footer =
    `<footer><p>${esc(sheet.footer.truth)}</p>` +
    (sheet.footer.currency ? `<p>${esc(sheet.footer.currency)}</p>` : '') +
    `${sheetCreditHtml(sheet.footer.credit)}</footer>`;

  return printableDocument({
    title: sheet.title,
    lang: sheet.lang,
    style: STYLE,
    body: `${header}${flows}${balances}${footer}`,
  });
}
