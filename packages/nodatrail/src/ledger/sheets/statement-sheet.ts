/**
 * One account's statement on paper, laid out the way a bank's is: opening
 * balance, one line per movement with debit and credit in columns of their
 * own and the running balance beside them, closing balance.
 *
 * **Debit and credit as two columns rather than one signed movement.** On
 * paper a minus sign is the thing a photocopy loses.
 *
 * Oldest first, which is the order a printed statement reads in, although the
 * tab lists the newest first: on screen the newest is what somebody looks for.
 *
 * Pure markup from a worded model.
 */
import { pageText as esc, printableDocument } from '@technosoftware/trail-core';
import {
  FRAME_STYLE,
  footerHtml,
  headerHtml,
  statsHtml,
  type SheetFooter,
  type SheetStat,
} from './sheet-frame';

export interface StatementSheetRow {
  date: string;
  text: string;
  reference: string | null;
  /** The other account's label, or the word for none. */
  other: string;
  /** What the movement put in, or ''. */
  inward: string;
  /** What it took out, or ''. */
  outward: string;
  balance: string;
  negativeBalance: boolean;
}

export interface StatementSheet {
  lang: string;
  title: string;
  meta: string[];
  stats: SheetStat[];
  labels: {
    date: string;
    text: string;
    other: string;
    inward: string;
    outward: string;
    balance: string;
    opening: string;
    closing: string;
  };
  opening: string;
  closing: string;
  rows: StatementSheetRow[];
  /** Said when the period has no movement, instead of an empty table. */
  empty: string | null;
  footer: SheetFooter;
}

const STYLE = `
  ${FRAME_STYLE}
  .statement { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
  .statement th { text-align: left; font-weight: 600; color: #3d424b; font-size: 8pt;
                  border-bottom: 0.8pt solid #14161a; padding: 0.8mm 1mm; }
  .statement td { padding: 0.8mm 1mm; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
  .statement .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .statement th.num { text-align: right; }
  .statement .date { white-space: nowrap; width: 22mm; }
  .statement .ref { display: block; font-size: 7.5pt; color: #6b7079; }
  .statement tr { break-inside: avoid; page-break-inside: avoid; }
  .statement tr.edge td { font-weight: 700; }
  .notes { font-size: 9pt; color: #565c66; }
`;

export function buildStatementSheetHtml(sheet: StatementSheet): string {
  const { labels } = sheet;
  const head =
    `<thead><tr><th class="date">${esc(labels.date)}</th><th>${esc(labels.text)}</th>` +
    `<th>${esc(labels.other)}</th><th class="num">${esc(labels.inward)}</th>` +
    `<th class="num">${esc(labels.outward)}</th><th class="num">${esc(labels.balance)}</th></tr></thead>`;

  const edge = (label: string, value: string) =>
    `<tr class="edge"><td></td><td colspan="4">${esc(label)}</td><td class="num">${esc(value)}</td></tr>`;

  const rows = sheet.rows
    .map(
      (row) =>
        `<tr><td class="date">${esc(row.date)}</td>` +
        `<td>${esc(row.text)}${row.reference ? `<span class="ref">${esc(row.reference)}</span>` : ''}</td>` +
        `<td>${esc(row.other)}</td><td class="num">${esc(row.inward)}</td>` +
        `<td class="num">${esc(row.outward)}</td>` +
        `<td class="num${row.negativeBalance ? ' neg' : ''}">${esc(row.balance)}</td></tr>`
    )
    .join('');

  // A heading-less table: the header row repeats on every page by itself,
  // which is what `thead` is for, so there is no heading to strand.
  const body =
    sheet.empty !== null
      ? `<p class="notes">${esc(sheet.empty)}</p>`
      : `<table class="statement">${head}<tbody>${edge(labels.opening, sheet.opening)}${rows}` +
        `${edge(labels.closing, sheet.closing)}</tbody></table>`;

  return printableDocument({
    title: sheet.title,
    lang: sheet.lang,
    style: STYLE,
    body:
      headerHtml(sheet.title, sheet.meta) +
      statsHtml(sheet.stats) +
      body +
      footerHtml(sheet.footer),
  });
}
