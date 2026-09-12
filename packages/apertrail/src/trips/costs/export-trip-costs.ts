/**
 * A trip's costs as a page you can print or send to the four other people
 * who went.
 *
 * The same shape the photo spot field sheet has, and deliberately the same
 * paper: both go through `shared/print-sheet.ts`, so two documents printed
 * on the same day look like they came from the same plugin.
 *
 * Pure. It takes strings that are already localized, already formatted and
 * already converted, and returns markup. Which is what keeps rounding,
 * currency and locale decisions in the one place that knows the domain.
 */
import { pageText as esc, metaLine, printableDocument, section } from '../../shared/print-sheet';

export interface CostSheetRow {
  label: string;
  category: string;
  status: string;
  /** Already formatted with its own currency, or null for a row that states no figure (an unpriced or cancelled booking). */
  amount: string | null;
  date: string | null;
  reference: string | null;
  /** The confirmation's file name, as evidence that one exists. The file itself is not in the sheet. Named `documentName` because a field called `document` shadows the global wherever a row is destructured. */
  documentName: string | null;
}

export interface CostSheetTotalRow {
  label: string;
  amount: string;
  note: string | null;
  emphasis: 'subtotal' | 'total' | 'plan';
}

/**
 * The extras nobody has taken, one row each.
 *
 * The summary above the table carries what all of them together would add, and
 * that figure alone was what this sheet said for a while. It claims more than
 * it knows: two excursions offered on one day are a choice between them, so the
 * sum is a ceiling rather than a plan. The rows are what somebody decides from.
 *
 * They are deliberately not in the bookings table. That table is what the
 * totals and the settlement are computed from, and an untaken extra in it would
 * be money somebody is owed.
 */
export interface CostSheetOptional {
  label: string;
  lines: { label: string; amount: string }[];
}

export interface CostSheet {
  title: string;
  subtitle: string | null;
  dateRange: string | null;
  /** One line per currency the trip spends in, with the rate where it has one. */
  currencyLines: string[];
  summary: { label: string; value: string }[];
  rows: CostSheetRow[];
  totals: CostSheetTotalRow[];
  /** Null when the trip offers no extras, which is not the same as offering none worth printing. */
  optional: CostSheetOptional | null;
  balances: string[];
  transfers: string[];
  labels: {
    bookings: string;
    settlement: string;
    booking: string;
    category: string;
    status: string;
    amount: string;
    date: string;
    reference: string;
  };
  caveat: string;
  footer: string;
}

const STYLE = `
  .summary { display: flex; flex-wrap: wrap; gap: 2mm; margin-bottom: 3mm; }
  .summary div { border: 0.5pt solid #c9ccd2; border-radius: 1.5mm; padding: 1.5mm 3mm; min-width: 34mm; }
  .summary .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6pt; color: #6b7079; }
  .summary .v { font-size: 12pt; font-variant-numeric: tabular-nums; }
  .rates { font-size: 9pt; color: #565c66; margin-bottom: 3mm; }
  .rates div { margin-bottom: 0.6mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.6pt;
       color: #6b7079; font-weight: 600; padding: 1.2mm 2mm 1.2mm 0;
       border-bottom: 0.5pt solid #14161a; }
  td { padding: 1.2mm 2mm 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-top: 3mm; margin-left: auto; width: 90mm; }
  .totals .row { display: flex; justify-content: space-between; gap: 4mm; padding: 0.8mm 0;
                 font-size: 10pt; }
  .totals .row.total { border-top: 0.8pt solid #14161a; margin-top: 1mm; padding-top: 1.5mm;
                       font-weight: 700; }
  /* The plan, beside the computed figure and never instead of it. */
  .totals .row.plan { color: #565c66; }
  .totals .note { font-size: 8.5pt; color: #6b7079; }
  .settle { break-inside: avoid; page-break-inside: avoid; }
  /* Quieter than the table above it, because none of it is money anybody has
     committed to. One row each rather than one figure: see CostSheetOptional. */
  .extras ul { list-style: none; margin: 1mm 0 3mm; padding: 0; font-size: 10pt; }
  .extras li { display: flex; justify-content: space-between; gap: 4mm;
               padding: 0.8mm 0; border-bottom: 0.3pt solid #e2e4e8; color: #565c66; }
  .extras .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .settle ul { margin: 1mm 0 3mm; padding-left: 5mm; font-size: 10pt; }
`;

function rowsTable(sheet: CostSheet): string {
  if (sheet.rows.length === 0) return '';

  const head = `<tr>
    <th>${esc(sheet.labels.booking)}</th>
    <th>${esc(sheet.labels.category)}</th>
    <th>${esc(sheet.labels.status)}</th>
    <th>${esc(sheet.labels.date)}</th>
    <th class="num">${esc(sheet.labels.amount)}</th>
  </tr>`;

  const body = sheet.rows
    .map((row) => {
      // The reference and the document name ride under the label rather than
      // in columns of their own: on paper the amount is the column that must
      // not be squeezed, and both are things you read once at a desk.
      const under = [row.reference, row.documentName]
        .filter((part): part is string => !!part)
        .map((part) => esc(part))
        .join(' &middot; ');
      return `<tr>
        <td>${esc(row.label)}${under ? `<br><span class="rates">${under}</span>` : ''}</td>
        <td>${esc(row.category)}</td>
        <td>${esc(row.status)}</td>
        <td>${esc(row.date ?? '')}</td>
        <td class="num">${esc(row.amount ?? '')}</td>
      </tr>`;
    })
    .join('');

  return `<table>${head}${body}</table>`;
}

function totalsBlock(sheet: CostSheet): string {
  if (sheet.totals.length === 0) return '';
  return `<div class="totals">${sheet.totals
    .map(
      (total) => `<div class="row ${total.emphasis}">
        <span>${esc(total.label)}${total.note ? ` <span class="note">${esc(total.note)}</span>` : ''}</span>
        <span>${esc(total.amount)}</span>
      </div>`
    )
    .join('')}</div>`;
}

function optionalBlock(sheet: CostSheet): string {
  const extras = sheet.optional;
  if (extras === null || extras.lines.length === 0) return '';

  const rows = extras.lines
    .map(
      (line) =>
        `<li><span>${esc(line.label)}</span><span class="num">${esc(line.amount)}</span></li>`
    )
    .join('');

  return `<section class="extras">${section(extras.label, [`<ul>${rows}</ul>`])}</section>`;
}

function settlementBlock(sheet: CostSheet): string {
  if (sheet.balances.length === 0 && sheet.transfers.length === 0) return '';
  const list = (entries: string[]): string =>
    `<ul>${entries.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul>`;

  // Wrapped as well as kept whole. The settle block asks not to be split at
  // all, which is the stronger promise and the one that usually holds, but a
  // party of eight can outgrow a page and an engine then breaks it anyway --
  // and a heading is the one thing that must not be left behind when it does.
  return `<section class="settle">${section(sheet.labels.settlement, [
    ...(sheet.balances.length > 0 ? [list(sheet.balances)] : []),
    ...(sheet.transfers.length > 0 ? [list(sheet.transfers)] : []),
  ])}</section>`;
}

export function buildCostSheetHtml(sheet: CostSheet): string {
  const header = `<header>
    <h1>${esc(sheet.title)}</h1>
    ${metaLine([sheet.subtitle, sheet.dateRange])}
  </header>`;

  const summary =
    sheet.summary.length === 0
      ? ''
      : `<div class="summary">${sheet.summary
          .map(
            (cell) =>
              `<div><div class="k">${esc(cell.label)}</div><div class="v">${esc(cell.value)}</div></div>`
          )
          .join('')}</div>`;

  const rates =
    sheet.currencyLines.length === 0
      ? ''
      : `<div class="rates">${sheet.currencyLines.map((line) => `<div>${esc(line)}</div>`).join('')}</div>`;

  // The heading, the table and the totals as one section, which also means a
  // trip with no bookings yet prints no bookings heading. It used to print an
  // empty one: this sheet was the last that did, and the other three have
  // always left out a section they have nothing to put under.
  const bookings = section(
    sheet.labels.bookings,
    [rowsTable(sheet), totalsBlock(sheet)].filter((block) => block !== '')
  );

  return printableDocument({
    title: sheet.title,
    style: STYLE,
    body: `${header}
${summary}
${rates}
${bookings}
${optionalBlock(sheet)}
${settlementBlock(sheet)}
<footer>
  <p>${esc(sheet.caveat)}</p>
  <p>${esc(sheet.footer)}</p>
</footer>`,
  });
}
