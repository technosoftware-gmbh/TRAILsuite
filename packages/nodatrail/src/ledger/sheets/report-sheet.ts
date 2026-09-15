/**
 * A report on paper: the chart, the profit calculation or the balance sheet.
 *
 * Three tabs, one shape. Each is the account tree with a figure on every
 * account and a total on every group, so each prints as sections of one table:
 * number and name, what the account holds in its own currency where that
 * differs, and the figure in the reporting currency, right-aligned so a column
 * can be added by eye. Groups print expanded whatever is folded on screen:
 * folding is a reading posture, and paper has no click.
 *
 * Pure markup from a worded model; see `report-sheet-model.ts`.
 */
import { pageText as esc, printableDocument, section } from '@technosoftware/trail-core';
import {
  FRAME_STYLE,
  footerHtml,
  headerHtml,
  statsHtml,
  type SheetFooter,
  type SheetStat,
} from './sheet-frame';

export interface ReportSheetRow {
  kind: 'group' | 'account';
  label: string;
  depth: number;
  /** What a foreign account holds in its own currency, and at what rate. Null for the rest. */
  detail: string | null;
  amount: string;
  negative: boolean;
  /** An account whose figure is outside the total, for want of a rate. */
  outside: boolean;
}

export interface ReportSheetSection {
  title: string;
  /** "Total Aktiven": the words on the total row. */
  totalLabel: string;
  total: string;
  negative: boolean;
  rows: ReportSheetRow[];
}

export interface ReportSheet {
  lang: string;
  title: string;
  meta: string[];
  stats: SheetStat[];
  sections: ReportSheetSection[];
  /** Said under the sections: the basis a profit is on, or that a period had nothing. */
  notes: string[];
  footer: SheetFooter;
}

const STYLE = `
  ${FRAME_STYLE}
  .report { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .report td { padding: 0.9mm 1mm; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
  .report td.amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; width: 34mm; }
  .report tr { break-inside: avoid; page-break-inside: avoid; }
  .report tr.group td { font-weight: 600; }
  .report tr.total td { font-weight: 700; border-top: 0.8pt solid #14161a; border-bottom: none; }
  .report .detail { display: block; font-size: 8pt; color: #6b7079; }
  .report .outside { font-style: italic; color: #6b7079; }
  .report .d1 { padding-left: 4mm; } .report .d2 { padding-left: 8mm; }
  .report .d3 { padding-left: 12mm; } .report .d4 { padding-left: 16mm; }
  .notes { font-size: 8.5pt; color: #565c66; margin: 2mm 0 0; }
`;

function rowHtml(row: ReportSheetRow): string {
  const depth = Math.min(row.depth, 4);
  const labelClass = depth > 0 ? ` class="d${depth}"` : '';
  const detail = row.detail ? `<span class="detail">${esc(row.detail)}</span>` : '';
  const amountClass = ['amount', row.negative ? 'neg' : '', row.outside ? 'outside' : '']
    .filter(Boolean)
    .join(' ');
  return (
    `<tr class="${row.kind}"><td${labelClass}>${esc(row.label)}${detail}</td>` +
    `<td class="${amountClass}">${esc(row.amount)}</td></tr>`
  );
}

function sectionHtml(part: ReportSheetSection): string {
  // The section's heading glued to its first rows through `section()`, which
  // is why the table is split: the first two rows go in the unbreakable box,
  // the rest may break wherever the page ends.
  const head = part.rows.slice(0, 2);
  const rest = part.rows.slice(2);
  const total =
    `<tr class="total"><td>${esc(part.totalLabel)}</td>` +
    `<td class="amount${part.negative ? ' neg' : ''}">${esc(part.total)}</td></tr>`;
  const table = (rows: string) => `<table class="report">${rows}</table>`;

  const blocks = [table(head.map(rowHtml).join('') + (rest.length === 0 ? total : ''))];
  if (rest.length > 0) blocks.push(table(rest.map(rowHtml).join('') + total));
  return section(part.title, blocks);
}

export function buildReportSheetHtml(sheet: ReportSheet): string {
  const notes = sheet.notes.map((line) => `<p class="notes">${esc(line)}</p>`).join('');
  return printableDocument({
    title: sheet.title,
    lang: sheet.lang,
    style: STYLE,
    body:
      headerHtml(sheet.title, sheet.meta) +
      statsHtml(sheet.stats) +
      sheet.sections.map(sectionHtml).join('') +
      notes +
      footerHtml(sheet.footer),
  });
}
