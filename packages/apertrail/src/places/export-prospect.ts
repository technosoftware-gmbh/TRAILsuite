/**
 * A prospect: one self-contained page about one note, on the same paper as the
 * trip document and the two cost sheets.
 *
 * The order is an operator's own -- what it is, what it looks like, what the
 * note says about it, the categories you choose between, the facts in a box,
 * the rest of the pictures -- and then the section no operator's brochure
 * could carry: the trips of your own that went there. That is what makes it
 * yours rather than theirs, and it is the same last section whether the
 * subject is a ship, a hotel or a country.
 *
 * **One page for every type**, which is why this is not `export-vehicle-
 * brochure.ts` any more. A ship's brochure and a landmark's prospect differ in
 * the facts they list and in one middle section; everything else was identical,
 * and a second copy of two hundred lines of markup is how two pages drift
 * apart in the padding first and in the meaning second.
 *
 * `cabins` is that middle section, and only a vehicle fills it in today. It is
 * a list of categories with a picture and some words each, which is a shape a
 * hotel's room types would fit without changing a line here.
 *
 * Pure by design, like the trip document: it takes strings already localized,
 * already formatted and already resolved, and returns markup. Which keeps
 * "what does this say" apart from "what is in the vault".
 */
import { type ProseBlock } from '@technosoftware/trail-core';
import {
  pageText as esc,
  highlightsHtml,
  metaLine,
  printableDocument,
  proseSections,
  section,
} from '../shared/print-sheet';

/** A picture on the page. `src` is null when it could not be read, and the caption still earns its place. */
export interface ProspectPicture {
  src: string | null;
  caption: string | null;
}

/**
 * One cabin category, as the brochure prints one.
 *
 * The picture is the cabin's own, not the ship's: what a reader is choosing
 * between is the rooms, and a page that showed the same hero three times would
 * be answering a question nobody asked.
 */
export interface ProspectCabin {
  name: string;
  description: string | null;
  picture: ProspectPicture | null;
}

/** One line of the grey box: what it is called and what it says. Already localized and formatted. */
export interface ProspectFact {
  label: string;
  value: string;
  /**
   * Where the value points, when it points anywhere: the website, or a deck
   * plan sitting beside the sheet. Absent on a fact that is only a number.
   *
   * Already relative to where this sheet will be written, because the sheet
   * does not know where that is and the caller does.
   */
  href?: string;
}

/** One trip that sailed on her: its name and when, both already formatted. */
export interface ProspectTrip {
  title: string;
  when: string | null;
}

export interface ProspectLabels {
  highlights: string;
  overview: string;
  cabins: string;
  facts: string;
  gallery: string;
  trips: string;
}

export interface Prospect {
  title: string;
  /** One or two lines under the name. Null when the note says nothing. */
  description: string | null;
  /**
   * Why this is worth doing, one line each, already in the note's order.
   *
   * Above the overview, which is the trip document's own arrangement: it is
   * what somebody scans first, and it sits under the picture where the eye
   * already is. It was a trip's alone until an excursion's page wanted the
   * same three lines; before that they were typed into the summary callout
   * and printed as prose.
   */
  highlights: string[];
  /**
   * The note's own summary block, as the blocks that print it.
   *
   * Beside `description` rather than instead of it: the property is the line
   * an operator would put under her name, and the summary is what the note's
   * owner wrote about her. A ship carrying only one prints only that one.
   *
   * Blocks rather than paragraphs of text since the callout is written in the
   * vault's markdown and this page is the one place nothing renders it: a list
   * of highlights printed as a run of hyphens, and `[[Stavanger]]` printed
   * with its brackets, is what a reader took away from the first real
   * prospect.
   */
  overview: ProseBlock[];
  /** Who runs her, what kind she is: whatever the note could say, already formatted. */
  meta: (string | null)[];
  hero: ProspectPicture | null;
  cabins: ProspectCabin[];
  facts: ProspectFact[];
  gallery: ProspectPicture[];
  trips: ProspectTrip[];
  labels: ProspectLabels;
  caveat: string;
  footer: string;
}

/** What only this sheet needs. The page itself comes from shared/print-sheet.ts. */
const STYLE = `
  /* The hero under the title, for the reason the trip document gives: the name
     is what somebody opens the file looking for. */
  .hero { margin: 0 0 5mm; }
  .hero figure { margin: 0; }
  .hero img { width: 100%; height: auto; border-radius: 2mm; display: block; }
  .subtitle { font-size: 12pt; color: #565c66; margin: 0 0 2mm; letter-spacing: 0.2pt; }
  /* A cabin is a picture and its words side by side, and it does not straddle
     a fold: it is the unit somebody compares against the next one. */
  .cabin { display: flex; gap: 4mm; padding: 2mm 0; break-inside: avoid;
           page-break-inside: avoid; border-bottom: 0.3pt solid #e2e4e8; }
  .cabin:last-child { border-bottom: none; }
  .cabin .shot { width: 52mm; flex: none; }
  .cabin .shot img { width: 100%; height: auto; border-radius: 1.5mm; display: block; }
  .cabin .shot .noimg { width: 100%; aspect-ratio: 3 / 2; border: 0.5pt dashed #c9ccd2;
                        border-radius: 1.5mm; }
  .cabin h3 { font-size: 11pt; margin: 0 0 1mm; }
  .cabin p { margin: 0; font-size: 9.5pt; color: #2a2f37; white-space: pre-line; }
  table.facts { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.facts td { padding: 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; vertical-align: top; }
  table.facts td.label { width: 45mm; color: #565c66; }
  /* A printed sheet is read on paper as often as on a screen, so a link keeps
     the ink colour and takes an underline. On paper it reads as emphasis; in a
     browser it is still a link. */
  table.facts a { color: inherit; text-decoration: underline; }
  ul.trips { list-style: none; margin: 0; padding: 0; font-size: 10pt; }
  ul.trips li { padding: 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; }
  ul.trips .when { color: #565c66; }
  .gallery { display: flex; flex-wrap: wrap; gap: 3mm; }
  .gallery figure { margin: 0; width: calc((100% - 6mm) / 3);
                    break-inside: avoid; page-break-inside: avoid; }
  .gallery img { width: 100%; height: auto; border-radius: 1.5mm; display: block; }
  .gallery .noimg { width: 100%; aspect-ratio: 3 / 2; border: 0.5pt dashed #c9ccd2;
                    border-radius: 1.5mm; }
  .gallery figcaption { font-size: 8.5pt; color: #565c66; margin-top: 1mm; }
`;

function pictureFigure(picture: ProspectPicture): string {
  const image = picture.src
    ? `<img src="${esc(picture.src)}" alt="${esc(picture.caption ?? '')}">`
    : '<div class="noimg"></div>';
  const caption = picture.caption ? `<figcaption>${esc(picture.caption)}</figcaption>` : '';
  return `<figure>${image}${caption}</figure>`;
}

/**
 * A cabin block.
 *
 * The picture column is drawn even when there is no picture, so a catalogue
 * where only some cabins are photographed still reads as one column of text
 * rather than as two different layouts down the page.
 */
function cabinBlock(cabin: ProspectCabin): string {
  const image = cabin.picture?.src
    ? `<img src="${esc(cabin.picture.src)}" alt="${esc(cabin.name)}">`
    : '<div class="noimg"></div>';
  const description = cabin.description ? `<p>${esc(cabin.description)}</p>` : '';
  return `<div class="cabin">
      <div class="shot">${image}</div>
      <div class="what"><h3>${esc(cabin.name)}</h3>${description}</div>
    </div>`;
}

export function buildProspectHtml(sheet: Prospect): string {
  const header = `<header>
    <h1>${esc(sheet.title)}</h1>
    ${sheet.description ? `<div class="subtitle">${esc(sheet.description)}</div>` : ''}
    ${metaLine(sheet.meta)}
  </header>`;

  const hero = sheet.hero ? `<div class="hero">${pictureFigure(sheet.hero)}</div>` : '';

  const highlights = section(
    sheet.labels.highlights,
    sheet.highlights.length === 0 ? [] : [highlightsHtml(sheet.highlights)]
  );

  const overview = section(sheet.labels.overview, proseSections(sheet.overview));

  const cabins = section(sheet.labels.cabins, sheet.cabins.map(cabinBlock));

  const facts =
    sheet.facts.length === 0
      ? ''
      : section(sheet.labels.facts, [
          `<table class="facts">${sheet.facts
            .map(
              (fact) =>
                `<tr><td class="label">${esc(fact.label)}</td><td>${
                  fact.href ? `<a href="${esc(fact.href)}">${esc(fact.value)}</a>` : esc(fact.value)
                }</td></tr>`
            )
            .join('')}</table>`,
        ]);

  const gallery = section(
    sheet.labels.gallery,
    sheet.gallery.length === 0
      ? []
      : [`<div class="gallery">${sheet.gallery.map(pictureFigure).join('')}</div>`]
  );

  const trips = section(
    sheet.labels.trips,
    sheet.trips.length === 0
      ? []
      : [
          `<ul class="trips">${sheet.trips
            .map(
              (trip) =>
                `<li>${esc(trip.title)}${
                  trip.when ? ` <span class="when">${esc(trip.when)}</span>` : ''
                }</li>`
            )
            .join('')}</ul>`,
        ]
  );

  return printableDocument({
    title: sheet.title,
    style: STYLE,
    body: `${header}
${hero}
${highlights}
${overview}
${cabins}
${facts}
${gallery}
${trips}
<footer>
  <p>${esc(sheet.caveat)}</p>
  <p>${esc(sheet.footer)}</p>
</footer>`,
  });
}
