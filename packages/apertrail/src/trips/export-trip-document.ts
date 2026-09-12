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
export interface TripDocumentPicture {
  src: string | null;
  caption: string | null;
}

/** One thing that happens on a day: when, where, and what about it. */
export interface TripDocumentEntry {
  /** "09:00" or "09:00 - 13:30", or null for a stop with no recorded time. */
  time: string | null;
  place: string | null;
  /**
   * What the line IS, where it is an outing sold on the day: the tour's own
   * name, beside the place it happens at rather than instead of it.
   *
   * "Stavanger" says where the ship is; "Auf den Spuren der Wikinger" says
   * what somebody is deciding about, and the optional label beside it says
   * what it costs. All three are the row.
   */
  excursion: string | null;
  /**
   * The excursion in its own words: the `description:` from its note.
   *
   * A line rather than its picture and its prose, for the reason the ship's
   * `about` gives one paragraph down. It has a prospect of its own, and
   * reprinting that on every trip document it appears in is what the prospect
   * exists to avoid. Null for a line that names no excursion, or one the
   * vault has no note for.
   */
  about: string | null;
  note: string | null;
  /**
   * Said on a line that may not happen, already localized. Null for an
   * ordinary one.
   *
   * A brochure day is mostly this -- "Nehmen Sie an einem optionalen Ausflug
   * teil" -- and a printed day that did not distinguish the two would read as
   * a schedule of things that are all going to happen.
   */
  optional: string | null;
  /** The prices this line can be bought at, where there is more than one. */
  fares: TripDocumentFare[];
}

export interface TripDocumentDay {
  /** "Day 3", already localized. Null for the stops before the first dated one, which are not a numbered day of anything. */
  label: string | null;
  /**
   * What ends on this day, already localized: "Arrives today: Oslo to Copenhagen".
   *
   * Legs have their own section and stay there, for the reason on
   * `TripDocumentJourney` below: nothing here is priced, booked or repeated
   * in full. What a day says is that something finishes on it -- the day a
   * fortnight-long voyage ends is a real day of the itinerary, and printing
   * nothing about it left the longest thing on the trip absent from the day
   * it finishes.
   */
  arrivals: string[];
  /**
   * What leaves on this day, already localized, with its clock:
   * "Departs today: Zurich to Oslo - 09:40 - 12:10".
   *
   * The half the arrivals above were missing. A day one whose whole content
   * is the flight out printed the day and said nothing about the flight,
   * which is what this was asked for. The time is on the line because it is
   * what the rest of the day is arranged around; an arrival needs no clock,
   * being placed by the day it lands on.
   */
  departures: string[];
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
  /**
   * What the ship is, in her own words: the `description:` from her note.
   *
   * A line rather than her picture and her prose. She has a prospect of her
   * own now, and repeating it on every trip document she appears in is what
   * that page exists to avoid -- but a name with nothing beside it tells
   * somebody reading the sheet nothing at all. Null for a leg on no named
   * vehicle, or on one the vault has no note for.
   */
  about: string | null;
  /** When it leaves: "Tag 0", or the date once the trip has one. A leg that runs for days says both ends and how long, and a stay says its span. */
  when: string | null;
  /** The prices this line can be bought at, where there is more than one. Empty for the ordinary line. */
  fares: TripDocumentFare[];
  /** Said on a line that may not happen: "Optional" or "Optional, taken", already localized. Null for an ordinary line. */
  optional: string | null;
}

/**
 * One of the prices a line can be bought at, as the document prints it.
 *
 * Printed in full, prices and all, because this page is what somebody decides
 * from: a brochure that listed only the cabin already ticked would have
 * removed the decision it exists to support.
 */
export interface TripDocumentFare {
  label: string;
  description: string | null;
  /** Already formatted with its currency, or null for a fare nobody has priced. */
  amount: string | null;
  /** Marked rather than filtered: the chosen one is what the costs section counted. */
  chosen: boolean;
}

export interface TripDocumentCostRow {
  label: string;
  /** Already formatted with its currency. */
  amount: string;
}

/**
 * A trip that follows this one, as the document prints it.
 *
 * Its own line, its own dates and its own figure, and the figure is stated as
 * ITS total rather than added to this trip's. Three days in Kopenhagen are
 * separately booked and separately cancellable, and a sheet that folded their
 * hotel into the voyage's total would report a price nobody was ever quoted.
 * The hint under the heading says so in words, because a reader comparing two
 * numbers deserves to be told they are two numbers.
 */
export interface TripDocumentExtension {
  title: string;
  /** Its own dates, already formatted. Null for one that has none yet. */
  when: string | null;
  /** What it is, in its own words: the `subtitle:` from its note. */
  about: string | null;
  /** What it plans to cost, in its own currency and already formatted. Null when it plans nothing. */
  total: string | null;
}

export interface TripDocumentLabels {
  /** The word beside the price that was chosen, in brackets after it. */
  fareChosen: string;
  highlights: string;
  overview: string;
  itinerary: string;
  transport: string;
  stays: string;
  costs: string;
  extensions: string;
  gallery: string;
}

/**
 * The extras nobody has taken: a row each, and what all of them together would
 * add.
 *
 * One figure was what this printed first, and it claimed more than it knew. Six
 * offered excursions are not six excursions somebody is going on, and two on
 * one day are a choice rather than a sum, so the figure a reader wanted was
 * never the one a reader saw. The rows are what a decision is made from; the
 * ceiling is what saying yes to everything would cost, and it says so.
 */
export interface TripDocumentOptional {
  /** The section's own heading, already localized. */
  label: string;
  /** One row per extra, in the note's own order, each with its own figure. */
  lines: TripDocumentCostRow[];
  /**
   * All of them together. Null when the trip offers extras in a currency the
   * sheet cannot sum, which is the rule every total here follows: an amount in
   * another currency is left out rather than converted at a rate nobody stated.
   */
  ceiling: TripDocumentCostRow | null;
}

export interface TripDocument {
  title: string;
  subtitle: string | null;
  /** The country, the dates, the length: whatever the note could say, already formatted. */
  meta: (string | null)[];
  hero: TripDocumentPicture | null;
  highlights: string[];
  /**
   * The overview, as the blocks that print it.
   *
   * Blocks rather than paragraphs of text since the summary callout is written
   * in the vault's markdown and this sheet is one of the two places nothing
   * renders it: a list came out as a run of hyphens and a wikilink came out
   * with its brackets. Same shape and same reason as the prospect's.
   */
  overview: ProseBlock[];
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
  /**
   * What the extras nobody has taken would add, beside the total rather than
   * inside it.
   *
   * Its own figure on purpose: folding it into the total would report a trip
   * costing more than anybody has decided to spend, and leaving it out
   * entirely would hide the difference between a fifteen-day cruise and the
   * same cruise with six excursions on it. Null when the trip offers none.
   */
  costOptional: TripDocumentOptional | null;
  /**
   * The trips that name this one as what they follow, earliest first.
   *
   * Derived rather than written: this note says nothing about them, and the
   * link lives on each of them. Empty for the trip that nothing follows,
   * which is most of them.
   */
  extensions: TripDocumentExtension[];
  /** Why the figures beside the extensions are not in the total above. Null when there are none. */
  extensionsHint: string | null;
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
  /* A heading and the first block under it, as one box. See section() for why
     this is a wrapper rather than a break-after on the heading. */
  /* A step quieter than the line above it: what the ship is, under what she
     is called, in the voice a caption has rather than the voice of the
     itinerary. */
  .journey .about { color: #565c66; font-style: italic; }
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
  /* The fares under a leg, indented so the list reads as belonging to it
     rather than as three more journeys. */
  .journey ul.fares { list-style: none; margin: 1mm 0 0; padding: 0 0 0 4mm;
                      border-left: 0.5pt solid #e2e4e8; }
  .journey ul.fares li { padding: 0.6mm 0; font-size: 9.5pt; color: #2a2f37; }
  .journey ul.fares li.chosen b { font-weight: 700; }
  .journey ul.fares .price { color: #565c66; font-variant-numeric: tabular-nums; }
  .journey ul.fares div { font-size: 9pt; color: #6b7079; white-space: pre-line; }
  .day .arrival { font-size: 9.5pt; color: #565c66; margin: 0 0 1.5mm; }
  /* An offered extra reads as offered rather than scheduled. */
  .optional { font-size: 8.5pt; color: #6b7079; border: 0.4pt dashed #c9ccd2;
              border-radius: 1mm; padding: 0.2mm 1.2mm; white-space: nowrap; }
  /* The tour's name beside the town's. Set apart from the place rather than
     under it: on a brochure day these are one line read left to right, and a
     second bold would make two headings out of one row. */
  .excursion { font-style: italic; }
  /* What the tour says about itself, in the muted style the sheet gives every
     other borrowed line. */
  .about { font-size: 9pt; color: #565c66; }
  /* The extras, under the plan's own total and plainly not part of it: quieter
     ink, no rule above them, and one row each because a single figure for six
     offered excursions is a sum nobody can spend. */
  table.costs tr.optional-head td { border-bottom: none; padding-top: 2.5mm;
                                    font-size: 8.5pt; text-transform: uppercase;
                                    letter-spacing: 0.7pt; color: #6b7079; }
  table.costs tr.optional-line td { border-top: none; color: #565c66; }
  table.costs tr.optional-total td { border-top: none; font-weight: 400; color: #565c66; }
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
  // Arrivals above departures: a day is read in the order it happens, and you
  // land before you leave again.
  const legs = [...day.arrivals, ...day.departures]
    .map((line) => `<p class="arrival">${esc(line)}</p>`)
    .join('');

  const entries = day.entries
    .map((entry) => {
      // The place in bold, then the tour, then what it costs to decide about,
      // then everything the note says. The optional label follows the
      // excursion rather than the place, because on this row the thing that
      // might not happen is the outing and not the town.
      const what = [
        entry.place ? `<b>${esc(entry.place)}</b>` : '',
        entry.excursion
          ? `${entry.place ? ' ' : ''}<span class="excursion">${esc(entry.excursion)}</span>`
          : '',
        entry.optional ? ` <span class="optional">${esc(entry.optional)}</span>` : '',
        entry.about ? `<div class="about">${esc(entry.about)}</div>` : '',
        entry.note ? `<div>${esc(entry.note)}</div>` : '',
        fareList(entry.fares, ''),
      ].join('');
      return `<div class="stop">
        <div class="when">${esc(entry.time ?? '')}</div>
        <div class="what">${what}</div>
      </div>`;
    })
    .join('');

  return `<section class="day${named ? '' : ' undated'}">${heading}${date}${legs}${note}${entries}</section>`;
}

function fareList(fares: TripDocumentFare[], chosenWord: string): string {
  if (fares.length === 0) return '';
  const items = fares
    .map((fare) => {
      const price = [fare.amount, fare.chosen ? `(${chosenWord})` : null]
        .filter((part): part is string => !!part)
        .join(' ');
      return `<li class="${fare.chosen ? 'chosen' : ''}">
        <b>${esc(fare.label)}</b>${price ? ` <span class="price">${esc(price)}</span>` : ''}
        ${fare.description ? `<div>${esc(fare.description)}</div>` : ''}
      </li>`;
    })
    .join('');
  return `<ul class="fares">${items}</ul>`;
}

function journeyBlocks(rows: TripDocumentJourney[], chosenWord: string): string[] {
  return rows.map((row) => {
    // The day and the clock on one line, the way a boarding pass prints
    // them: "Tag 0 &middot; 20:30 - 10:00 +1".
    const clock = [row.when, row.time].filter((part): part is string => !!part).join(' · ');
    return `<div class="journey">
        <b>${esc(row.label)}</b>
        ${clock ? `<div class="clock">${esc(clock)}</div>` : ''}
        ${row.detail ? `<div>${esc(row.detail)}</div>` : ''}
        ${row.about ? `<div class="about">${esc(row.about)}</div>` : ''}
        ${row.optional ? `<div><span class="optional">${esc(row.optional)}</span></div>` : ''}
        ${fareList(row.fares, chosenWord)}
      </div>`;
  });
}

/** One follow-on trip: its name, when it runs, what it is, and what it costs on its own. */
function extensionBlock(extension: TripDocumentExtension): string {
  return `<div class="journey">
    <div class="when">${esc(extension.when ?? '')}</div>
    <div class="what">
      <b>${esc(extension.title)}</b>
      ${extension.about ? `<div class="about">${esc(extension.about)}</div>` : ''}
      ${extension.total ? `<div class="clock">${esc(extension.total)}</div>` : ''}
    </div>
  </div>`;
}

function costsTable(sheet: TripDocument): string {
  if (sheet.costs.length === 0 && !sheet.costTotal && !sheet.costOptional) return '';

  const lines = sheet.costs
    .map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${esc(row.amount)}</td></tr>`)
    .join('');
  const total = sheet.costTotal
    ? `<tr class="total"><td>${esc(sheet.costTotal.label)}</td>
       <td class="num">${esc(sheet.costTotal.amount)}</td></tr>`
    : '';
  // Under the rule rather than above it: none of this is part of the sum, and
  // a row sitting inside the table's own total would read as though it were.
  const optional = sheet.costOptional
    ? `<tr class="optional-head"><td colspan="2">${esc(sheet.costOptional.label)}</td></tr>` +
      sheet.costOptional.lines
        .map(
          (row) =>
            `<tr class="optional-line"><td>${esc(row.label)}</td>` +
            `<td class="num">${esc(row.amount)}</td></tr>`
        )
        .join('') +
      (sheet.costOptional.ceiling
        ? `<tr class="optional-total"><td>${esc(sheet.costOptional.ceiling.label)}</td>` +
          `<td class="num">${esc(sheet.costOptional.ceiling.amount)}</td></tr>`
        : '')
    : '';

  return `<table class="costs">${lines}${total}${optional}</table>`;
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
    sheet.highlights.length === 0 ? [] : [highlightsHtml(sheet.highlights)]
  );

  const overview = section(sheet.labels.overview, proseSections(sheet.overview));

  const itinerary = section(sheet.labels.itinerary, sheet.days.map(dayBlock));

  // The hint rides with the first leg rather than standing on its own, so the
  // heading, the sentence explaining what a day outside the trip means, and
  // the first row a reader applies it to are one thing.
  const journeys = journeyBlocks(sheet.transport, sheet.labels.fareChosen);
  const hint = sheet.transportHint ? `<p class="hint">${esc(sheet.transportHint)}</p>` : '';
  const transport = section(
    sheet.labels.transport,
    journeys.length === 0 ? [] : [`${hint}${journeys[0]}`, ...journeys.slice(1)]
  );

  const stays = section(sheet.labels.stays, journeyBlocks(sheet.stays, sheet.labels.fareChosen));

  const table = costsTable(sheet);
  const costs = section(sheet.labels.costs, table === '' ? [] : [table]);

  // The hint rides with the first extension, for the reason the transport
  // hint rides with the first leg: the sentence and the row it qualifies are
  // one thing, and a page break between them leaves the figure unexplained.
  const extensionRows = sheet.extensions.map(extensionBlock);
  const extensionsHint = sheet.extensionsHint
    ? `<p class="hint">${esc(sheet.extensionsHint)}</p>`
    : '';
  const extensions = section(
    sheet.labels.extensions,
    extensionRows.length === 0
      ? []
      : [`${extensionsHint}${extensionRows[0]}`, ...extensionRows.slice(1)]
  );

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
${extensions}
${gallery}
<footer>
  <p>${esc(sheet.caveat)}</p>
  <p>${esc(sheet.footer)}</p>
</footer>`,
  });
}
