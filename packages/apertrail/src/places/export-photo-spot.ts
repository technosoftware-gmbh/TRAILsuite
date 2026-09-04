/**
 * A photo spot as a single self-contained HTML page, built for paper.
 *
 * This is the printed double page the whole feature was derived from,
 * handed back. It is the one thing a spot note can do that is useful with
 * the screen off, and the design cites exactly this ("exporting one spot as
 * a field-ready PDF") in its argument for the block's own fence language.
 *
 * HTML rather than PDF, and rather than Markdown. PDF would mean bundling a
 * renderer for a page this simple; Markdown would print through Obsidian's
 * own chrome and would still be a note rather than a sheet. An HTML file
 * prints from any browser, survives being copied off the vault onto a
 * phone, and needs nothing installed. Everything is inlined, images
 * included, so the file works with no network and no vault around it.
 *
 * Pure by design: it takes strings that are already localized, already
 * formatted and already resolved to data URLs, and returns markup. Which
 * makes it testable, and keeps the question "what does this say" separate
 * from "what is in the vault".
 */

export interface FieldSheetSample {
  /** A data URL, or null when the image could not be inlined -- the caption still earns its place. */
  src: string | null;
  caption: string | null;
  exposure: string | null;
}

export interface FieldSheetMotif {
  name: string;
  role: string;
  isMain: boolean;
  /** Already-formatted "46.9895, 6.9243", or null when the motif has no coordinates of its own. */
  coordinates: string | null;
  direction: string | null;
  lens: string | null;
  season: string | null;
  gear: string[];
  light: { label: string; time: string | null }[];
  relation: string | null;
  technique: string | null;
  note: string | null;
  capture: string;
  captured: boolean;
  offset: string | null;
  samples: FieldSheetSample[];
}

export interface FieldSheetLabels {
  motifs: string;
  light: string;
  samples: string;
  onSite: string;
}

export interface FieldSheet {
  title: string;
  /** "Switzerland > Neuchâtel", or null for a spot with no place above it. */
  subtitle: string | null;
  rating: number | null;
  coordinates: string | null;
  /** "Europe/Zurich", or the device zone said out loud as such. */
  zone: string | null;
  dateLine: string;
  sun: { label: string; value: string }[];
  polarNote: string | null;
  motifs: FieldSheetMotif[];
  looseSamples: FieldSheetSample[];
  logistics: { label: string; value: string }[];
  caveat: string;
  footer: string;
  labels: FieldSheetLabels;
}

import {
  escapeHtml as esc,
  metaLine,
  printableDocument,
  starsHtml as stars,
} from '../shared/print-sheet';

function sampleFigure(sample: FieldSheetSample): string {
  // A sample whose image could not be inlined still prints its caption: the
  // exposure line is half of what a sample is for, and a silent gap would
  // read as a sample nobody wrote down.
  const image = sample.src
    ? `<img src="${esc(sample.src)}" alt="${esc(sample.caption ?? '')}">`
    : '<div class="noimg"></div>';
  const caption = [sample.caption, sample.exposure]
    .filter((part): part is string => !!part)
    .map((part, index) => `<div class="${index === 0 ? 'cap' : 'exp'}">${esc(part)}</div>`)
    .join('');
  return `<figure>${image}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}

function samplesBlock(samples: FieldSheetSample[]): string {
  if (samples.length === 0) return '';
  return `<div class="samples">${samples.map(sampleFigure).join('')}</div>`;
}

function motifBlock(motif: FieldSheetMotif, labels: FieldSheetLabels): string {
  const head = `<div class="m-head">
      <h3>${esc(motif.name)}</h3>
      <span class="role${motif.isMain ? ' main' : ''}">${esc(motif.role)}</span>
    </div>`;

  const meta = metaLine([motif.coordinates, motif.direction, motif.lens, motif.season]);

  const light =
    motif.light.length === 0
      ? ''
      : `<div class="light">
        <div class="k">${esc(labels.light)}</div>
        <ul>${motif.light
          .map(
            (window) =>
              `<li><span>${esc(window.label)}</span>${
                window.time ? `<b>${esc(window.time)}</b>` : ''
              }</li>`
          )
          .join('')}</ul>
        ${motif.relation ? `<div class="rel">${esc(motif.relation)}</div>` : ''}
      </div>`;

  const gear =
    motif.gear.length === 0
      ? ''
      : `<div class="gear">${motif.gear.map((item) => `<span>${esc(item)}</span>`).join('')}</div>`;

  const note = motif.note ? `<p>${esc(motif.note)}</p>` : '';
  const technique = motif.technique ? `<div class="tip">${esc(motif.technique)}</div>` : '';

  // The capture box is deliberately a box rather than a tick: on paper it is
  // something to fill in with a pen, which is the whole point of carrying
  // the sheet rather than the phone.
  const foot = `<div class="m-foot">
      <span class="cap-state">${motif.captured ? '&#9635;' : '&#9633;'} ${esc(motif.capture)}</span>
      ${motif.offset ? `<span class="offset">${esc(motif.offset)}</span>` : ''}
    </div>`;

  return `<section class="motif${motif.isMain ? ' main' : ''}">
    ${head}${meta}${light}${note}${gear}${technique}${samplesBlock(motif.samples)}${foot}
  </section>`;
}

/** What only a field sheet needs. The page itself comes from shared/print-sheet.ts. */
const STYLE = `
  .sun { display: flex; flex-wrap: wrap; gap: 2mm; }
  .sun div { border: 0.5pt solid #c9ccd2; border-radius: 1.5mm; padding: 1.5mm 2.5mm; min-width: 32mm; }
  .sun .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6pt; color: #6b7079; }
  .sun .v { font-size: 11pt; font-variant-numeric: tabular-nums; }
  .polar { font-size: 9.5pt; color: #565c66; margin-top: 2mm; }
  /* A motif is the unit somebody reads at the spot, so it does not get to
     straddle a page fold. */
  .motif { break-inside: avoid; page-break-inside: avoid; border: 0.5pt solid #c9ccd2;
           border-radius: 2mm; padding: 3mm 3.5mm; margin-bottom: 3mm; }
  .motif.main { border-color: #14161a; border-width: 1pt; }
  .m-head { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 1mm; }
  .role { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.7pt; color: #6b7079;
          border: 0.5pt solid #c9ccd2; border-radius: 1mm; padding: 0.4mm 1.5mm; }
  .role.main { color: #14161a; border-color: #14161a; }
  .light { margin: 1.5mm 0; }
  .light .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6pt; color: #6b7079; }
  .light ul { list-style: none; margin: 0.5mm 0 0; padding: 0; }
  .light li { display: flex; justify-content: space-between; max-width: 90mm;
              border-bottom: 0.3pt dotted #c9ccd2; padding: 0.6mm 0; }
  .light b { font-variant-numeric: tabular-nums; }
  .rel { font-size: 9pt; color: #565c66; margin-top: 1mm; }
  .motif p { margin: 1.5mm 0; }
  .gear span { font-size: 9pt; border: 0.5pt solid #c9ccd2; border-radius: 4mm;
               padding: 0.4mm 2mm; margin-right: 1.5mm; }
  .tip { border-left: 1.5pt solid #14161a; padding: 1mm 0 1mm 2.5mm; margin: 2mm 0;
         font-size: 10pt; }
  .m-foot { display: flex; justify-content: space-between; gap: 3mm; margin-top: 2mm;
            padding-top: 1.5mm; border-top: 0.3pt solid #c9ccd2; font-size: 9.5pt; color: #565c66; }
  .samples { display: flex; flex-wrap: wrap; gap: 2.5mm; margin: 2mm 0; }
  figure { margin: 0; width: 52mm; }
  figure img { width: 100%; height: auto; border-radius: 1.5mm; display: block; }
  .noimg { width: 100%; aspect-ratio: 3 / 2; border: 0.5pt dashed #c9ccd2; border-radius: 1.5mm; }
  figcaption { font-size: 8pt; color: #565c66; margin-top: 1mm; }
  figcaption .exp { font-family: ui-monospace, Menlo, monospace; }
  table.logi { width: 100%; border-collapse: collapse; }
  table.logi th { text-align: left; font-size: 7.5pt; text-transform: uppercase;
                  letter-spacing: 0.6pt; color: #6b7079; font-weight: 600;
                  padding: 1.2mm 2mm 1.2mm 0; vertical-align: top; }
  table.logi td { padding: 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
`;

export function buildFieldSheetHtml(sheet: FieldSheet): string {
  const header = `<header>
    <h1>${esc(sheet.title)}</h1>
    ${metaLine([sheet.subtitle, stars(sheet.rating) || null, sheet.coordinates, sheet.zone])}
  </header>`;

  const sun =
    sheet.sun.length === 0
      ? ''
      : `<h2>${esc(sheet.dateLine)}</h2>
      <div class="sun">${sheet.sun
        .map(
          (row) =>
            `<div><div class="k">${esc(row.label)}</div><div class="v">${esc(row.value)}</div></div>`
        )
        .join('')}</div>
      ${sheet.polarNote ? `<div class="polar">${esc(sheet.polarNote)}</div>` : ''}`;

  const motifs =
    sheet.motifs.length === 0
      ? ''
      : `<h2>${esc(sheet.labels.motifs)}</h2>
      ${sheet.motifs.map((motif) => motifBlock(motif, sheet.labels)).join('')}`;

  const loose =
    sheet.looseSamples.length === 0
      ? ''
      : `<h2>${esc(sheet.labels.samples)}</h2>${samplesBlock(sheet.looseSamples)}`;

  const logistics =
    sheet.logistics.length === 0
      ? ''
      : `<h2>${esc(sheet.labels.onSite)}</h2>
      <table class="logi">${sheet.logistics
        .map((row) => `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
        .join('')}</table>`;

  return printableDocument({
    title: sheet.title,
    style: STYLE,
    body: `${header}
${sun}
${motifs}
${loose}
${logistics}
<footer>
  <p>${esc(sheet.caveat)}</p>
  <p>${esc(sheet.footer)}</p>
</footer>`,
  });
}
