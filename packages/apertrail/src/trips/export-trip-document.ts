/**
 * A trip as one page you can print, mail, or hand to somebody who is coming.
 *
 * The third sheet this plugin exports, after the photo spot field sheet and
 * the trip cost sheet, and deliberately on the same paper: all three go
 * through `shared/print-sheet.ts`, so two documents printed on the same day
 * look like they came from the same plugin.
 *
 * The order is the one a tour operator's own document uses, and the one
 * somebody reads a trip in: what it is, what it looks like, why you would go,
 * what it is in prose, what happens each day, what it costs, and the
 * pictures. `docs/design/trip-document.md` records where each part comes
 * from.
 *
 * **One file, nothing to keep together.** Every picture arrives here already
 * a data URL, so the page opens with its pictures anywhere it is copied to
 * -- which is the whole requirement the export exists for. The downscaling
 * and the reading of bytes belong to the App-bound half; this file only
 * knows that `src` is something an `<img>` can use.
 *
 * Pure by design: it takes strings that are already localized, already
 * formatted and already resolved, and returns markup. Which keeps "what does
 * this say" separate from "what is in the vault".
 */
import { escapeHtml as esc, metaLine, printableDocument } from '../shared/print-sheet';

/** A picture on the page. `src` is null when it could not be read, and the caption still earns its place. */
export interface TripDocumentPicture {
  src: string | null;
  caption: string | null;
}

/** One thing that happens on a day: when, where, and what about it. */
export interface TripDocumentEntry {
  /** "09:00" or "09:00 - 13:30", or null for a stop with no recorded time. */
  time: string | null;
  place: string | null;
  note: string | null;
}

export interface TripDocumentDay {
  /** "Day 3", already localized. Null for the stops before the first dated one, which are not a numbered day of anything. */
  label: string | null;
  /** What the day is called: "Pretoria", beside its number. */
  title: string | null;
  date: string | null;
  /** The day's own paragraph, which a brochure gives every day and a note gives the days that earned one. */
  note: string | null;
  entries: TripDocumentEntry[];
}

/**
 * A leg or a stay, as the document prints one.
 *
 * Kept out of the day-by-day on purpose. The Reiseverlauf is the trip itself,
 * day one to the last day, which is what a brochure describes and what somebody
 * decides on. Flights are the other thing: they are settled later, and once
 * they are concrete the outbound one usually leaves the day *before* day one
 * and the return lands the day after the last. Folding those into the days
 * would either invent a day 0 in the middle of the brochure or file the flight
 * under a day it does not happen on.
 */
export interface TripDocumentJourney {
  /** "20:30 - 10:00 +1" for a leg, null for a stay, which has no clock. */
  time: string | null;
  label: string;
  /** The direction and the reference, under the route. */
  detail: string | null;
  /** When it leaves: "Tag 0", or the date once the trip has one. A stay says its span here instead. */
  when: string | null;
}

export interface TripDocumentCostRow {
  label: string;
  /** Already formatted with its currency. */
  amount: string;
}

export interface TripDocumentLabels {
  highlights: string;
  overview: string;
  itinerary: string;
  transport: string;
  stays: string;
  costs: string;
  gallery: string;
}

export interface TripDocument {
  title: string;
  subtitle: string | null;
  /** The country, the dates, the length: whatever the note could say, already formatted. */
  meta: (string | null)[];
  hero: TripDocumentPicture | null;
  highlights: string[];
  /** The overview, one entry per paragraph. */
  overview: string[];
  days: TripDocumentDay[];
  transport: TripDocumentJourney[];
  stays: TripDocumentJourney[];
  /**
   * What a day number outside the trip's own days means, when one is used.
   *
   * Set only when a leg actually falls before day one or after the last day,
   * so the note appears where it explains something and nowhere else. Under
   * the heading rather than on each row: it is a fact about the numbering, not
   * about any one flight.
   */
  transportHint: string | null;
  costs: TripDocumentCostRow[];
  /** The plan's total, set apart from the lines above it. Null when the trip carries no budget. */
  costTotal: TripDocumentCostRow | null;
  gallery: TripDocumentPicture[];
  labels: TripDocumentLabels;
  caveat: string;
  footer: string;
}

/** What only a trip document needs. The page itself comes from shared/print-sheet.ts. */
const STYLE = `
  /* The hero sits under the title rather than above it: the name of the trip
     is what somebody is looking for when they open the file, and a picture
     that pushed it off the first screen would be decoration in the way. */
  .hero { margin: 0 0 5mm; }
  /* A browser gives a figure the default margin 1em 40px, so without this the
     largest picture on the page sat 80px narrower than the rule above it and
     the text below it -- the one element on the sheet not aligned to anything.
     The gallery's figures have always zeroed it; the hero was simply missed.
     No backticks in here: this comment lives inside a template literal, and a
     backtick ends the string rather than quoting anything. */
  .hero figure { margin: 0; }
  .hero img { width: 100%; height: auto; border-radius: 2mm; display: block; }
  .hero figcaption { font-size: 8.5pt; color: #6b7079; margin-top: 1.5mm; }
  .subtitle { font-size: 12pt; color: #565c66; margin: 0 0 2mm; letter-spacing: 0.2pt; }
  .highlights { list-style: none; margin: 0; padding: 0; }
  .highlights li { break-inside: avoid; padding: 1.2mm 0 1.2mm 6mm; position: relative;
                   border-bottom: 0.3pt solid #e2e4e8; }
  .highlights li::before { content: "\\2605"; position: absolute; left: 0; color: #a8801f; }
  /* Kept whole. The overview is the one piece of continuous prose on the sheet
     and a reader who has to turn the page mid-sentence has lost the thread of
     it; a day, by contrast, is a unit small enough to move on its own. The
     cost is white space at the foot of the page it no longer fits on, which
     for a brochure is the better half of the trade: it leaves the first page
     as the title, the picture and the highlights, which is a cover. A block
     taller than a page still breaks, because a browser breaks what it cannot
     place. */
  .overview { break-inside: avoid; page-break-inside: avoid; }
  /* A heading and the first block under it, as one box. See section() for why
     this is a wrapper rather than a break-after on the heading. */
  .section-head { break-inside: avoid; page-break-inside: avoid; }
  .overview p { margin: 0 0 2.5mm; white-space: pre-line; }
  /* A day is the unit somebody reads, so it does not get to straddle a fold. */
  .day { break-inside: avoid; page-break-inside: avoid; margin-bottom: 3.5mm;
         padding-left: 4mm; border-left: 1pt solid #c9ccd2; }
  .day.undated { border-left-style: dotted; }
  .day h3 { font-size: 11pt; }
  .day .meta { margin: 0 0 1.5mm; }
  /* A step below the trip overview and a step above the timed lines: the
     day's paragraph introduces the day, and the lines under it are the
     schedule. Inheriting the body's 11pt made it as loud as the overview and
     read, correctly, as a different font from everything around it. */
  .day .day-note { margin: 0 0 2mm; font-size: 10pt; color: #2a2f37;
                   white-space: pre-line; }
  .stop { display: flex; gap: 3mm; padding: 0.8mm 0; }
  .stop .when { width: 24mm; flex: none; font-variant-numeric: tabular-nums;
                color: #565c66; font-size: 9.5pt; }
  .stop .what b { font-weight: 600; }
  /* pre-line, because a note is somebody's prose and may be two paragraphs.
     HTML collapses a newline to a space, so without this the blank line
     between them disappeared on the way to the page while the editor and the
     note itself still had it. */
  .stop .what div { font-size: 9.5pt; color: #565c66; white-space: pre-line; }
  /* No time gutter here, unlike a day's stops. A transport section is three
     rows rather than fourteen, so there is nothing to align, and the whole
     point of a flight card is that the route and the clock read as one block. */
  .journey { padding: 1.2mm 0; break-inside: avoid; }
  .journey b { font-weight: 600; }
  .journey div { font-size: 9.5pt; color: #565c66; }
  .journey .clock { font-variant-numeric: tabular-nums; }
  .hint { font-size: 9pt; color: #6b7079; margin: 0 0 2mm; }
  table.costs { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.costs td { padding: 1.2mm 0; border-bottom: 0.3pt solid #e2e4e8; }
  table.costs td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.costs tr.total td { border-top: 0.8pt solid #14161a; border-bottom: none;
                            padding-top: 1.5mm; font-weight: 700; }
  .gallery { display: flex; flex-wrap: wrap; gap: 3mm; }
  /* Three across, as a share of the row rather than 59mm of it. The sheet asks
     for a 190mm body and never gets one: @page takes 12mm a side, and a
     printer driver takes its own margin on top of that, so a width in
     millimetres is a width against a box nobody has measured. Three 59mm
     figures need 183mm and fell to two per row in Obsidian's own PDF export,
     which doubled the length of the gallery. A share of the row is three
     across whatever the printer decides the row is. */
  .gallery figure { margin: 0; width: calc((100% - 6mm) / 3);
                    break-inside: avoid; page-break-inside: avoid; }
  .gallery img { width: 100%; height: auto; border-radius: 1.5mm; display: block; }
  .gallery .noimg { width: 100%; aspect-ratio: 3 / 2; border: 0.5pt dashed #c9ccd2;
                    border-radius: 1.5mm; }
  .gallery figcaption { font-size: 8.5pt; color: #565c66; margin-top: 1mm; }
`;

/**
 * A picture, or the space where one was meant to be.
 *
 * A gallery entry whose file could not be read still prints its caption, the
 * same way a field sheet's sample does: the caption is somebody's own words
 * about the picture, and a silent gap would read as a picture nobody chose.
 */
function pictureFigure(picture: TripDocumentPicture): string {
  const image = picture.src
    ? `<img src="${esc(picture.src)}" alt="${esc(picture.caption ?? '')}">`
    : '<div class="noimg"></div>';
  const caption = picture.caption ? `<figcaption>${esc(picture.caption)}</figcaption>` : '';
  return `<figure>${image}${caption}</figure>`;
}

function dayBlock(day: TripDocumentDay): string {
  // "1. Tag: Pretoria" -- the number and the name together, which is how the
  // reference document heads a day and how somebody says it out loud.
  const named = day.label && day.title ? `${day.label}: ${day.title}` : (day.label ?? day.title);
  const heading = named ? `<h3>${esc(named)}</h3>` : '';
  const date = day.date ? `<div class="meta">${esc(day.date)}</div>` : '';
  const note = day.note ? `<p class="day-note">${esc(day.note)}</p>` : '';

  const entries = day.entries
    .map((entry) => {
      const what = [
        entry.place ? `<b>${esc(entry.place)}</b>` : '',
        entry.note ? `<div>${esc(entry.note)}</div>` : '',
      ].join('');
      return `<div class="stop">
        <div class="when">${esc(entry.time ?? '')}</div>
        <div class="what">${what}</div>
      </div>`;
    })
    .join('');

  return `<section class="day${named ? '' : ' undated'}">${heading}${date}${note}${entries}</section>`;
}

function journeyBlocks(rows: TripDocumentJourney[]): string[] {
  return rows.map((row) => {
    // The day and the clock on one line, the way a boarding pass prints
    // them: "Tag 0 &middot; 20:30 - 10:00 +1".
    const clock = [row.when, row.time].filter((part): part is string => !!part).join(' · ');
    return `<div class="journey">
        <b>${esc(row.label)}</b>
        ${clock ? `<div class="clock">${esc(clock)}</div>` : ''}
        ${row.detail ? `<div>${esc(row.detail)}</div>` : ''}
      </div>`;
  });
}

function costsTable(sheet: TripDocument): string {
  if (sheet.costs.length === 0 && !sheet.costTotal) return '';

  const lines = sheet.costs
    .map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${esc(row.amount)}</td></tr>`)
    .join('');
  const total = sheet.costTotal
    ? `<tr class="total"><td>${esc(sheet.costTotal.label)}</td>
       <td class="num">${esc(sheet.costTotal.amount)}</td></tr>`
    : '';

  return `<table class="costs">${lines}${total}</table>`;
}

/**
 * A section: its heading, glued to the first thing under it.
 *
 * **Why the heading is wrapped rather than told to stay.** A break-after of
 * avoid on the heading says exactly the right thing, and is the one property
 * an engine is free to ignore. Headless Chromium honours it; whatever printed
 * the first real PDF did not, and left the overview's heading alone at the
 * foot of a page naming a section three centimetres away. Adding that
 * declaration was correct code standing where it could never run.
 *
 * A break-inside of avoid is the one every engine implements, so the heading
 * and the first block become a single box that cannot be split. That is also
 * why only the FIRST block goes in: gluing all eleven days of an itinerary
 * into one unbreakable box asks for a box taller than the page, which an
 * engine resolves by breaking it anyway -- back where we started, and with the
 * itinerary starting on a fresh page for no reason. One block is always small
 * enough to move, and moving it is the whole of what is needed.
 *
 * The heading's own top margin collapses out through the wrapper, so the
 * spacing above a section is what it always was.
 */
function section(label: string, blocks: string[]): string {
  if (blocks.length === 0) return '';
  const [first, ...rest] = blocks;
  return `<div class="section-head"><h2>${esc(label)}</h2>${first}</div>${rest.join('')}`;
}

export function buildTripDocumentHtml(sheet: TripDocument): string {
  const header = `<header>
    <h1>${esc(sheet.title)}</h1>
    ${sheet.subtitle ? `<div class="subtitle">${esc(sheet.subtitle)}</div>` : ''}
    ${metaLine(sheet.meta)}
  </header>`;

  const hero = sheet.hero ? `<div class="hero">${pictureFigure(sheet.hero)}</div>` : '';

  const highlights = section(
    sheet.labels.highlights,
    sheet.highlights.length === 0
      ? []
      : [
          `<ul class="highlights">${sheet.highlights
            .map((line) => `<li>${esc(line)}</li>`)
            .join('')}</ul>`,
        ]
  );

  const overview = section(
    sheet.labels.overview,
    sheet.overview.length === 0
      ? []
      : [
          `<div class="overview">${sheet.overview
            .map((paragraph) => `<p>${esc(paragraph)}</p>`)
            .join('')}</div>`,
        ]
  );

  const itinerary = section(sheet.labels.itinerary, sheet.days.map(dayBlock));

  // The hint rides with the first leg rather than standing on its own, so the
  // heading, the sentence explaining what a day outside the trip means, and
  // the first row a reader applies it to are one thing.
  const journeys = journeyBlocks(sheet.transport);
  const hint = sheet.transportHint ? `<p class="hint">${esc(sheet.transportHint)}</p>` : '';
  const transport = section(
    sheet.labels.transport,
    journeys.length === 0 ? [] : [`${hint}${journeys[0]}`, ...journeys.slice(1)]
  );

  const stays = section(sheet.labels.stays, journeyBlocks(sheet.stays));

  const table = costsTable(sheet);
  const costs = section(sheet.labels.costs, table === '' ? [] : [table]);

  const gallery = section(
    sheet.labels.gallery,
    sheet.gallery.length === 0
      ? []
      : [`<div class="gallery">${sheet.gallery.map(pictureFigure).join('')}</div>`]
  );

  return printableDocument({
    title: sheet.title,
    style: STYLE,
    body: `${header}
${hero}
${highlights}
${overview}
${itinerary}
${transport}
${stays}
${costs}
${gallery}
<footer>
  <p>${esc(sheet.caveat)}</p>
  <p>${esc(sheet.footer)}</p>
</footer>`,
  });
}
