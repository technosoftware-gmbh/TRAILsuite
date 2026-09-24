/**
 * The booking sheet as a page: what somebody takes to a travel agency.
 *
 * Pure. It takes rows that are already chosen, localized and formatted, and
 * returns markup, on the same paper as the other three sheets. What goes on
 * it is decided in `booking-sheet-lines.ts`; how each figure reads, in the
 * App-bound half.
 */
import {
  pageText as esc,
  metaLine,
  printableDocument,
  section,
  sheetCreditHtml,
} from '@technosoftware/trail-core';

/** One cell: the line it is about, and a quieter one underneath where there is more to say. */
export interface BookingSheetCell {
  main: string | null;
  sub?: string | null;
  /** True for a cell that is waiting on a decision: printed as "open" and marked, never as a guess. */
  open?: boolean;
}

export interface BookingSheetColumn {
  label: string;
  /** Share of the row, in percent. Fixed rather than measured, see `table()`. */
  width: number;
  /** Right-aligned and tabular, for a price. */
  num?: boolean;
}

export interface BookingSheetTable {
  heading: string;
  columns: BookingSheetColumn[];
  /** One row per line; a stay with several rooms is one row per room, the hotel's own cells only on the first. */
  rows: BookingSheetCell[][];
}

export interface BookingSheet {
  title: string;
  subtitle: string | null;
  dateRange: string | null;
  travellers: {
    heading: string;
    /** Name, then the columns an agency asks for and the vault does not hold. */
    columns: string[];
    names: string[];
  };
  /** The four tables, each omitted by the caller when it has no rows. */
  tables: BookingSheetTable[];
  totals: { label: string; amounts: string[]; note: string | null } | null;
  open: { heading: string; items: string[] } | null;
  caveat: string;
  /** The credit line's words, before the link trail-core adds. */
  footer: string;
}

const STYLE = `
  table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
  td { overflow-wrap: anywhere; }
  table.rest { margin-bottom: 2mm; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5pt;
       color: #6b7079; font-weight: 600; padding: 1.2mm 1.6mm 1.2mm 0;
       border-bottom: 0.5pt solid #14161a; }
  td { padding: 1.2mm 1.6mm 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td .sub { display: block; font-size: 8pt; color: #6b7079; margin-top: 0.4mm; }
  /* The working under a price may wrap: the total above it is what must not. */
  td.num .sub { white-space: normal; }
  /* Waiting on a decision. Marked rather than coloured alone, so it survives a
     black-and-white printer. */
  td .open { font-style: italic; color: #8a4b00; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  /* Lines to write on: the height a hand needs, not the height text needs. */
  table.people td { height: 7mm; }
  .totals { margin: 2mm 0 0 auto; width: 90mm; font-size: 10pt; }
  .totals .row { display: flex; justify-content: space-between; gap: 4mm; padding: 0.8mm 0;
                 font-variant-numeric: tabular-nums; }
  .totals .row.first { border-top: 0.8pt solid #14161a; padding-top: 1.5mm; font-weight: 700; }
  .totals .note { font-size: 8.5pt; color: #6b7079; }
  .open-items ul { margin: 1mm 0 3mm; padding-left: 5mm; font-size: 10pt; }
  .open-items li { margin-bottom: 0.8mm; }
`;

function cell(value: BookingSheetCell, num: boolean): string {
  const main = value.main === null ? '' : esc(value.main);
  const text = value.open ? `<span class="open">${main}</span>` : main;
  const sub = value.sub ? `<span class="sub">${esc(value.sub)}</span>` : '';
  return `<td${num ? ' class="num"' : ''}>${text}${sub}</td>`;
}

/**
 * A table as two: the header and the first row, then the rest.
 *
 * `section()` keeps a heading with its first block in a box no engine may
 * split, which is what stops a heading being stranded at the foot of a page.
 * Handed the whole table, that box would be every row of it, and a long list
 * of excursions would jump to a fresh page or break anyway. So the box holds
 * the header and one row, and the rest follows in a second table free to
 * break. Both share fixed column widths, which is what makes two tables read
 * as one: measured widths would differ with their contents.
 */
function table(sheetTable: BookingSheetTable): string {
  const cols = `<colgroup>${sheetTable.columns
    .map((column) => `<col style="width:${column.width}%">`)
    .join('')}</colgroup>`;
  const head = `<tr>${sheetTable.columns
    .map((column) => `<th${column.num ? ' class="num"' : ''}>${esc(column.label)}</th>`)
    .join('')}</tr>`;
  const row = (values: BookingSheetCell[]): string =>
    `<tr>${values.map((value, index) => cell(value, sheetTable.columns[index]?.num === true)).join('')}</tr>`;
  const [first, ...rest] = sheetTable.rows;
  const blocks = [`<table>${cols}${head}${first ? row(first) : ''}</table>`];
  if (rest.length > 0) blocks.push(`<table class="rest">${cols}${rest.map(row).join('')}</table>`);
  return section(sheetTable.heading, blocks);
}

function travellers(sheet: BookingSheet): string {
  const { heading, columns, names } = sheet.travellers;
  // Two empty rows for a trip that names nobody: the agency will ask, and a
  // sheet with room to answer is more use than one that leaves the section out.
  const rows = (names.length > 0 ? names : ['', ''])
    .map(
      (name) =>
        `<tr><td>${esc(name)}</td>${columns
          .slice(1)
          .map(() => '<td></td>')
          .join('')}</tr>`
    )
    .join('');
  const head = `<tr>${columns.map((label) => `<th>${esc(label)}</th>`).join('')}</tr>`;
  return section(heading, [`<table class="people">${head}${rows}</table>`]);
}

function totals(sheet: BookingSheet): string {
  const block = sheet.totals;
  if (block === null || block.amounts.length === 0) return '';
  const rows = block.amounts
    .map(
      (amount, index) =>
        `<div class="row${index === 0 ? ' first' : ''}"><span>${index === 0 ? esc(block.label) : ''}</span><span>${esc(amount)}</span></div>`
    )
    .join('');
  const note = block.note ? `<div class="note">${esc(block.note)}</div>` : '';
  return `<div class="totals">${rows}${note}</div>`;
}

function openItems(sheet: BookingSheet): string {
  const block = sheet.open;
  if (block === null || block.items.length === 0) return '';
  const list = `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  return `<section class="open-items">${section(block.heading, [list])}</section>`;
}

export function buildBookingSheetHtml(sheet: BookingSheet): string {
  const header = `<header>
    <h1>${esc(sheet.title)}</h1>
    ${metaLine([sheet.subtitle, sheet.dateRange])}
  </header>`;

  return printableDocument({
    title: sheet.title,
    style: STYLE,
    body: `${header}
${travellers(sheet)}
${sheet.tables
  .filter((entry) => entry.rows.length > 0)
  .map(table)
  .join('\n')}
${totals(sheet)}
${openItems(sheet)}
<footer>
  <p>${esc(sheet.caveat)}</p>
  ${sheetCreditHtml(sheet.footer)}
</footer>`,
  });
}
