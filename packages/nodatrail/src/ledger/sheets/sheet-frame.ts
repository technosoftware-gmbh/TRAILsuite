/**
 * What every portrait ledger sheet has around its body: the title with what it
 * is about, the two or three figures the tab's stat strip shows, and the
 * footer that says the notes are the truth and who made the page.
 *
 * Pure markup from strings already worded and formatted. Every string goes
 * through `pageText`, because an account title is user input.
 */
import { pageText as esc, sheetCreditHtml } from '@technosoftware/trail-core';

export interface SheetStat {
  label: string;
  value: string;
  negative: boolean;
}

export interface SheetFooter {
  truth: string;
  /** Null when no account in another currency is on the sheet. */
  currency: string | null;
  credit: string;
}

/** The paper the portrait sheets share beyond trail-core's page. */
export const FRAME_STYLE = `
  .stats { display: flex; gap: 6mm; margin: 0 0 5mm; }
  .stat { border-top: 1pt solid #14161a; padding-top: 1.2mm; min-width: 36mm; }
  .stat .value { font-size: 13pt; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stat .label { font-size: 8pt; color: #6b7079; }
  .neg { color: #b3261e; }
  footer .credit a { color: inherit; }
`;

export function headerHtml(title: string, meta: readonly string[]): string {
  return (
    `<header><h1>${esc(title)}</h1>` +
    `<div class="meta">${meta.map((part) => esc(part)).join('<span class="sep">&middot;</span>')}</div>` +
    `</header>`
  );
}

export function statsHtml(stats: readonly SheetStat[]): string {
  if (stats.length === 0) return '';
  const cards = stats
    .map(
      (stat) =>
        `<div class="stat"><div class="value${stat.negative ? ' neg' : ''}">${esc(stat.value)}</div>` +
        `<div class="label">${esc(stat.label)}</div></div>`
    )
    .join('');
  return `<div class="stats">${cards}</div>`;
}

export function footerHtml(footer: SheetFooter): string {
  return (
    `<footer><p>${esc(footer.truth)}</p>` +
    (footer.currency ? `<p>${esc(footer.currency)}</p>` : '') +
    `${sheetCreditHtml(footer.credit)}</footer>`
  );
}
