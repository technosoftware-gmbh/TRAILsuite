/**
 * The trip document's markup.
 *
 * The same two rules the other two sheets' suites pin down, for the same
 * reasons: everything that reaches the page is escaped, because a trip title
 * and a highlight are user input, and a document with parts missing prints
 * without those parts rather than with empty ones.
 *
 * Plus one this sheet is the first to need. It is the only export with a
 * stylesheet somebody has already broken -- `export-photo-spot.ts` shipped
 * with a stray brace at the top of its `STYLE` and a selector line missing
 * from the middle, which no test noticed because a broken CSS rule renders
 * as a page that is merely plainer than it should be. So the CSS of every
 * sheet is checked for balance here, once, for all three.
 */
import { describe, expect, it } from 'vitest';
import { type ProseBlock } from '@technosoftware/trail-core';
import { buildTripDocumentHtml, TripDocument } from '../src/trips/export-trip-document';
import { buildFieldSheetHtml } from '../src/places/export-photo-spot';
import { buildCostSheetHtml } from '../src/trips/costs/export-trip-costs';

/**
 * Paragraphs, as the parser would hand them over.
 *
 * Spelled out rather than run through `proseBlocks`: this suite is about what
 * the markup says, and a fixture that went through the reader would fail here
 * when the reader broke.
 */
function paragraphs(...texts: string[]): ProseBlock[] {
  return texts.map((text) => ({ kind: 'paragraph', text }));
}

function sheet(overrides: Partial<TripDocument> = {}): TripDocument {
  return {
    title: 'Shongololo Express',
    subtitle: 'Zugreise in Suedafrika',
    meta: ['South Africa', '13 February 2026 - 24 February 2026', '12 days'],
    hero: { src: 'data:image/jpeg;base64,AAAA', caption: null },
    highlights: ['Kapstadt & Tafelberg', 'Die Namib bei Sonnenaufgang'],
    overview: paragraphs('Zwoelf Tage im Zug.', 'Von Pretoria bis Swakopmund.'),
    days: [
      {
        arrivals: [],
        departures: [],
        label: 'Day 1',
        title: 'Pretoria',
        note: 'Ankunft und Einschiffung.',
        date: '13 February 2026',
        entries: [
          {
            time: '09:00',
            place: 'Pretoria',
            excursion: null,
            about: null,
            note: 'Boarding at Capital Park',
            optional: null,
            fares: [],
          },
          {
            time: null,
            place: 'Rovos Rail',
            excursion: null,
            about: null,
            note: null,
            optional: null,
            fares: [],
          },
        ],
      },
    ],
    costs: [
      { label: 'Transport', amount: 'CHF 4,200.00' },
      { label: 'Accommodation', amount: 'CHF 800.00' },
    ],
    costTotal: { label: 'Budget', amount: 'CHF 5,000.00' },
    costOptional: null,
    gallery: [{ src: 'data:image/jpeg;base64,BBBB', caption: 'Die Dune 45' }],
    transport: [
      {
        about: null,
        fares: [],
        optional: null,
        time: '20:40 - 06:10',
        label: 'Zürich to Pretoria',
        detail: 'Outward journey · LX288',
        when: 'Day 0 → Day 1',
      },
    ],
    stays: [
      {
        about: null,
        time: null,
        label: 'Rovos Rail',
        detail: null,
        when: 'Day 1 → Day 12',
        fares: [],
        optional: null,
      },
    ],
    transportHint: 'Day 0 is the day before the trip starts.',
    extensions: [],
    extensionsHint: null,
    labels: {
      fareChosen: 'chosen',
      highlights: 'Highlights',
      overview: 'The trip in brief',
      itinerary: 'Day by day',
      extensions: 'Afterwards',
      transport: 'Getting there and back',
      stays: 'Where you stay',
      costs: 'What it costs',
      gallery: 'Pictures',
    },
    caveat: 'Everything on this page comes from the trip note.',
    footer: 'Generated on 30 August 2026.',
    ...overrides,
  };
}

describe('a trip document', () => {
  it('opens with the title, the subtitle and what the note could say about it', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('<h1>Shongololo Express</h1>');
    expect(html).toContain('Zugreise in Suedafrika');
    expect(html).toContain('South Africa');
    expect(html).toContain('12 days');
  });

  it('assembles in the order the document is read in', () => {
    const html = buildTripDocumentHtml(sheet());
    const at = (needle: string): number => html.indexOf(needle);

    expect(at('<h1>')).toBeLessThan(at('class="hero"'));
    expect(at('class="hero"')).toBeLessThan(at('Highlights'));
    expect(at('Highlights')).toBeLessThan(at('The trip in brief'));
    expect(at('The trip in brief')).toBeLessThan(at('Day by day'));
    expect(at('Day by day')).toBeLessThan(at('Getting there and back'));
    expect(at('Getting there and back')).toBeLessThan(at('Where you stay'));
    expect(at('Where you stay')).toBeLessThan(at('What it costs'));
    expect(at('What it costs')).toBeLessThan(at('Pictures'));
  });

  /** Same fix and same reason as the prospect's: two sheets print one callout. */
  it('prints a summary list as a list', () => {
    const html = buildTripDocumentHtml(
      sheet({
        overview: [{ kind: 'list', items: [{ text: 'Nordkap', ordered: false, items: [] }] }],
      })
    );

    expect(html).toContain('class="overview prose"');
    expect(html).toContain('<ul><li>Nordkap</li></ul>');
  });

  it('says each overview paragraph as its own paragraph', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('<p>Zwoelf Tage im Zug.</p>');
    expect(html).toContain('<p>Von Pretoria bis Swakopmund.</p>');
  });

  it('prints a stop with no time without an empty one', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('<div class="when">09:00</div>');
    expect(html).toContain('<div class="when"></div>');
  });

  /** A day nobody dated or named is not day one of anything, and prints unnumbered. */
  it('prints an unnamed, undated day without a heading', () => {
    const html = buildTripDocumentHtml(
      sheet({
        days: [
          {
            label: null,
            title: null,
            note: null,
            date: null,
            entries: [],
            arrivals: [],
            departures: [],
          },
        ],
      })
    );

    expect(html).toContain('class="day undated"');
    expect(html).not.toContain('<h3>');
  });

  /** "1. Tag: Pretoria" -- the number and the name together, as the reference document heads a day. */
  it('heads a day with its number and its name', () => {
    expect(buildTripDocumentHtml(sheet())).toContain('<h3>Day 1: Pretoria</h3>');
  });

  it('prints the day paragraph above its stops', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('Ankunft und Einschiffung.');
    expect(html.indexOf('Ankunft und Einschiffung.')).toBeLessThan(html.indexOf('Pretoria</b>'));
  });

  /** A day that says something but has nothing booked is still a day of the trip. */
  it('prints a named day that has no stops at all', () => {
    const html = buildTripDocumentHtml(
      sheet({
        days: [
          {
            label: 'Day 4',
            title: 'Seetag',
            note: null,
            date: null,
            entries: [],
            arrivals: [],
            departures: [],
          },
        ],
      })
    );

    expect(html).toContain('<h3>Day 4: Seetag</h3>');
    expect(html).not.toContain('class="day undated"');
  });

  /**
   * Above the day's own paragraph and its stops, because a day that begins
   * with a flight begins with the flight.
   */
  it('prints what leaves and what lands on a day, in that order', () => {
    const html = buildTripDocumentHtml(
      sheet({
        days: [
          {
            label: 'Day 16',
            title: 'Kopenhagen',
            note: 'Finale in Kopenhagen.',
            date: null,
            entries: [],
            arrivals: ['Arrives today: Oslo to Kopenhagen'],
            departures: ['Departs today: CPH to ZRH \u00b7 09:50 - 11:45'],
          },
        ],
      })
    );

    expect(html).toContain('Arrives today: Oslo to Kopenhagen');
    expect(html).toContain('Departs today: CPH to ZRH');
    expect(html.indexOf('Arrives today')).toBeLessThan(html.indexOf('Departs today'));
    expect(html.indexOf('Departs today')).toBeLessThan(html.indexOf('Finale in Kopenhagen.'));
  });

  it('leaves out every section the trip says nothing about', () => {
    const html = buildTripDocumentHtml(
      sheet({
        hero: null,
        highlights: [],
        overview: [],
        days: [],
        transport: [],
        stays: [],
        transportHint: null,
        costs: [],
        costTotal: null,
        gallery: [],
      })
    );

    expect(html).not.toContain('Highlights');
    expect(html).not.toContain('The trip in brief');
    expect(html).not.toContain('Day by day');
    expect(html).not.toContain('Getting there and back');
    expect(html).not.toContain('Where you stay');
    expect(html).not.toContain('What it costs');
    expect(html).not.toContain('Pictures');
    expect(html).toContain('<h1>Shongololo Express</h1>');
  });

  /** A picture that could not be read still prints its caption. */
  it('keeps a caption whose picture could not be inlined', () => {
    const html = buildTripDocumentHtml(
      sheet({ hero: null, gallery: [{ src: null, caption: 'Die Dune 45' }] })
    );

    expect(html).toContain('class="noimg"');
    expect(html).toContain('Die Dune 45');
    expect(html).not.toContain('<img');
  });

  it('escapes everything that reaches the page', () => {
    const html = buildTripDocumentHtml(
      sheet({
        title: '<script>alert(1)</script>',
        highlights: ['Tea & scones'],
        gallery: [{ src: null, caption: '"Sunrise"' }],
      })
    );

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Tea &amp; scones');
    expect(html).toContain('&quot;Sunrise&quot;');
  });
});

/**
 * Braces balance in every sheet's own stylesheet.
 *
 * Weak on purpose -- it counts braces rather than parsing CSS -- but it is
 * exactly the shape of the two defects that were in `export-photo-spot.ts`
 * from its first commit: an unmatched `}` at the top and a rule whose
 * selector line had gone, leaving its declarations to be swallowed by
 * whatever came before. Both survived a full audit because a browser
 * silently recovers from either.
 */
describe('every sheet stylesheet', () => {
  const SHEETS: [string, string][] = [
    ['trip document', buildTripDocumentHtml(sheet())],
    [
      'field sheet',
      buildFieldSheetHtml({
        title: 'Creux du Van',
        subtitle: null,
        rating: null,
        coordinates: null,
        zone: null,
        dateLine: 'Light on 14 June 2026',
        sun: [],
        polarNote: null,
        motifs: [],
        looseSamples: [],
        logistics: [],
        caveat: '',
        footer: '',
        labels: { motifs: 'Motifs', light: 'Light', samples: 'Samples', onSite: 'On site' },
      }),
    ],
    [
      'cost sheet',
      buildCostSheetHtml({
        title: 'Costs',
        subtitle: null,
        dateRange: null,
        currencyLines: [],
        summary: [],
        rows: [],
        totals: [],
        optional: null,
        balances: [],
        transfers: [],
        labels: {
          bookings: 'Costs',
          settlement: 'Settling up',
          booking: 'Booking',
          category: 'Category',
          status: 'Status',
          amount: 'Amount',
          date: 'Date',
          reference: 'Reference',
        },
        caveat: '',
        footer: '',
      }),
    ],
  ];

  it.each(SHEETS)('balances its braces: %s', (_name, html) => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    expect(css).not.toBe('');

    let depth = 0;
    for (const character of css) {
      if (character === '{') depth++;
      if (character === '}') depth--;
      // A negative depth is a closing brace with nothing open: the exact
      // shape of the stray `}` this test was written for.
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  /**
   * No declaration stands outside a rule.
   *
   * The second defect: `letter-spacing: 0.6pt; ...` sitting between two
   * rules because its selector had been deleted. Braces still balanced, so
   * the check above would have passed over it. A line at rule depth zero
   * that is not a selector, a comment or an at-rule is one of these.
   */
  it.each(SHEETS)('has no declaration outside a rule: %s', (_name, html) => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';

    let depth = 0;
    const orphans: string[] = [];
    for (const raw of css.split('\n')) {
      const line = raw.trim();
      if (depth === 0 && /^[a-z-]+\s*:/.test(line)) orphans.push(line);
      for (const character of line) {
        if (character === '{') depth++;
        if (character === '}') depth--;
      }
    }

    expect(orphans).toEqual([]);
  });
});

/**
 * The journey there and back, which the Reiseverlauf deliberately does not
 * carry.
 *
 * The day-by-day is the trip itself, day one to the last day, which is what a
 * brochure describes. Flights are settled later and land outside those days as
 * often as not -- an overnight outbound leaves the evening before day one.
 * Folding them into the days would either invent a day 0 in the middle of the
 * brochure or file the flight under a day it does not happen on.
 *
 * The first export of a real trip printed no flight at all, because the
 * document read only `stops` while the note carried it under `transport`.
 */
describe('getting there and back', () => {
  it('prints the leg with its times, route, direction and reference', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('20:40 - 06:10');
    expect(html).toContain('Zürich to Pretoria');
    expect(html).toContain('Outward journey · LX288');
  });

  it('says when the leg is, in the trip’s own days', () => {
    expect(buildTripDocumentHtml(sheet())).toContain('Day 0 → Day 1');
  });

  /** Only where a day outside the trip is actually used, so it explains something wherever it shows. */
  it('explains day 0 when a leg uses one', () => {
    expect(buildTripDocumentHtml(sheet())).toContain('Day 0 is the day before the trip starts.');
  });

  it('leaves the explanation out when every leg is inside the trip', () => {
    const html = buildTripDocumentHtml(sheet({ transportHint: null }));

    expect(html).toContain('Getting there and back');
    expect(html).not.toContain('the day before the trip starts');
  });

  it('prints a stay with the days it covers', () => {
    const html = buildTripDocumentHtml(sheet());

    expect(html).toContain('Rovos Rail');
    expect(html).toContain('Day 1 → Day 12');
  });

  it('escapes a route somebody typed markup into', () => {
    const html = buildTripDocumentHtml(
      sheet({
        transport: [
          {
            time: null,
            label: '<b>X</b>',
            detail: null,
            about: null,
            when: null,
            fares: [],
            optional: null,
          },
        ],
      })
    );

    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});

/**
 * A note is somebody's prose, and prose has paragraphs.
 *
 * The Sossusvlei note on a real trip is two paragraphs with a blank line
 * between them. YAML keeps it, the parser keeps it, the editor's textarea
 * shows it -- and HTML collapses a newline to a space, so the printed page ran
 * them together. Reported as "blank lines in text is displayed in the editor
 * but removed in the export".
 *
 * The fix is `white-space: pre-line` rather than splitting into paragraphs:
 * the note is one field holding one piece of writing, and turning it into
 * several elements would be the renderer deciding where its paragraphs are.
 */
describe('a note written as two paragraphs', () => {
  it('keeps the break the note carries', () => {
    const html = buildTripDocumentHtml(
      sheet({
        days: [
          {
            arrivals: [],
            departures: [],
            label: 'Day 9',
            title: null,
            note: null,
            date: null,
            entries: [
              {
                time: null,
                place: null,
                excursion: null,
                about: null,
                note: 'Erster Absatz.\n\nZweiter Absatz.',
                optional: null,
                fares: [],
              },
            ],
          },
        ],
      })
    );

    expect(html).toContain('Erster Absatz.\n\nZweiter Absatz.');
  });

  it('styles the note so the break survives the browser', () => {
    expect(buildTripDocumentHtml(sheet())).toContain('white-space: pre-line');
  });

  /** The day's own paragraph and the overview get it too: all three are prose fields. */
  it('keeps a break in the day paragraph and the overview', () => {
    const html = buildTripDocumentHtml(
      sheet({
        overview: paragraphs('Eins.\n\nZwei.'),
        days: [
          {
            arrivals: [],
            departures: [],
            label: 'Day 1',
            title: null,
            note: 'Drei.\n\nVier.',
            date: null,
            entries: [],
          },
        ],
      })
    );

    expect(html).toContain('Eins.\n\nZwei.');
    expect(html).toContain('Drei.\n\nVier.');
  });
});

/**
 * The three prose sizes on the page stand in a fixed order.
 *
 * The trip overview is the largest piece of writing, a day's own paragraph
 * introduces the day, and the timed lines under it are its schedule. Read
 * downwards, each is a step quieter than the one above.
 *
 * This exists because the day paragraph declared no size at all and inherited
 * the body's 11pt, which put it level with the overview and well above the
 * lines it introduces. On a real trip that read as a different font in the
 * middle of the day, which is exactly what it was.
 *
 * It asserts the ORDER rather than the three numbers, so the sheet can be
 * retuned without a test to update -- but a rule that stops declaring a size,
 * which is the whole defect, cannot pass.
 */
describe('the prose on the page', () => {
  /**
   * The size one selector declares, in points. Null when the rule declares none.
   *
   * Reads the `font:` shorthand as well as `font-size:`, because `body` sets
   * its size that way and body IS the reference the other two are measured
   * against. A helper that only knew the longhand would report the page's own
   * size as absent and quietly assert nothing.
   */
  function pointSize(css: string, selector: string): number | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    if (rule === undefined) return null;
    const size =
      /font-size:\s*([\d.]+)pt/.exec(rule)?.[1] ?? /\bfont:\s*([\d.]+)pt[/\s]/.exec(rule)?.[1];
    return size === undefined ? null : Number(size);
  }

  const css = /<style>([\s\S]*?)<\/style>/.exec(buildTripDocumentHtml(sheet()))?.[1] ?? '';

  it('sets a day paragraph between the overview and the timed lines', () => {
    // The overview declares no size of its own: it IS the body size, which is
    // the largest prose on the page and the reference the other two sit under.
    const body = pointSize(css, 'body');
    const dayNote = pointSize(css, '.day .day-note');
    const stopNote = pointSize(css, '.stop .what div');

    expect(body).not.toBeNull();
    expect(dayNote).not.toBeNull();
    expect(stopNote).not.toBeNull();

    expect(dayNote).toBeLessThan(body);
    expect(stopNote).toBeLessThan(dayNote);
  });
});

/**
 * What the printer does to the page, which is not what the browser does to it.
 *
 * Every case here was found by printing a real trip to PDF and looking at it,
 * and none of them is visible in the markup: the sheet renders correctly on
 * screen and comes apart on paper. They are grouped because they share a
 * cause -- the sheet states a page it does not get. `@page` takes its margins,
 * a printer driver takes its own on top, and a browser applies defaults to
 * elements the stylesheet never mentions.
 */
describe('the sheet on paper', () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(buildTripDocumentHtml(sheet()))?.[1] ?? '';

  /** The declarations of one rule, whitespace collapsed. Null when there is no such rule. */
  function rule(selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?:^|[;}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    return found === undefined ? null : found.replace(/\s+/g, ' ').trim();
  }

  /**
   * A browser's default `figure` margin is `1em 40px`, so a figure the sheet
   * does not reset is inset from everything around it. The hero was: the
   * largest picture on the page, and the only element on it not aligned to the
   * text. `.gallery figure` had always reset it, which is what made the
   * omission invisible -- one of the two picture contexts was right.
   */
  it('aligns every picture to the text, not to the browser default', () => {
    for (const selector of ['.hero figure', '.gallery figure']) {
      expect(rule(selector), selector).toMatch(/margin:\s*0/);
    }
  });

  /**
   * A section heading alone at the foot of a page names a section the reader
   * cannot see. The gallery's did that, and then the overview's did it again
   * after a fix that only looked like one.
   *
   * **The first version of this test asserted `break-after: avoid` on `h2` and
   * passed while the defect was live.** The declaration says the right thing
   * and is the one an engine may ignore: headless Chromium honours it, and the
   * engine that printed the real PDF did not. A test that checks a rule is
   * present cannot tell the difference between a rule that works and a rule
   * nobody reads.
   *
   * So this checks the markup instead. Every heading is inside a wrapper with
   * something else, and the wrapper is what carries `break-inside: avoid` --
   * the one property every engine implements. That is a structure a renderer
   * cannot decline.
   */
  it('binds every heading to a block, rather than asking a heading to stay', () => {
    const html = buildTripDocumentHtml(sheet());
    const headings = html.match(/<h2>/g) ?? [];
    expect(headings.length).toBeGreaterThan(3);

    // Every heading on the page opens a wrapper: none stands on its own.
    const wrapped = html.match(/<div class="section-head"><h2>/g) ?? [];
    expect(wrapped).toHaveLength(headings.length);

    // And the wrapper carries the property an engine cannot decline.
    expect(rule('.section-head')).toMatch(/break-inside:\s*avoid/);
  });

  /**
   * Only the first block joins the heading. All eleven days of an itinerary in
   * one unbreakable box would be a box taller than the page, which an engine
   * resolves by breaking it anyway -- and the itinerary would start on a fresh
   * page for no reason.
   */
  it('glues only the first block to the heading', () => {
    const day = sheet().days[0];
    const html = buildTripDocumentHtml(
      sheet({ days: [day, { ...day, label: 'Day 2', title: 'Kimberley' }] })
    );

    // The heading opens the wrapper and the first day is immediately inside it.
    expect(html).toContain('<div class="section-head"><h2>Day by day</h2><section class="day"');
    // The wrapper closes after that one day, and the rest follow outside it.
    expect(html).toMatch(/<\/section><\/div><section class="day"/);
  });

  /**
   * Widths in millimetres are widths against a box nobody measured: three
   * 59mm figures need 183mm of a body that asks for 190mm and is given less by
   * `@page` and less again by the printer, so the gallery fell to two per row
   * and ran twice as long. A share of the row is three across whatever the row
   * turns out to be.
   */
  it('sizes a gallery column as a share of the row rather than in millimetres', () => {
    const gallery = rule('.gallery figure');
    expect(gallery).not.toBeNull();
    expect(gallery).toContain('%');
    expect(gallery).not.toMatch(/width:\s*[\d.]+mm/);
  });

  /**
   * The overview used to be kept whole, and this test used to say so. An
   * excursion's summary is an operator's own page of prose rather than a
   * trip's three sentences, and keeping a page of prose together means page
   * one ends early to make room for it. Thomas: an overview as text can be
   * breakable, it might anyway not fit on one page.
   *
   * What is protected now is the heading, which keeps one paragraph with it.
   * The rest breaks where the page runs out, like any other prose.
   */
  it('keeps one paragraph with the heading and lets the rest break', () => {
    const html = buildTripDocumentHtml(
      sheet({ overview: paragraphs('Zwoelf Tage im Zug.', 'Von Pretoria bis Swakopmund.') })
    );

    expect(html).toContain(
      '<div class="section-head"><h2>The trip in brief</h2>' +
        '<div class="overview prose"><p>Zwoelf Tage im Zug.</p></div></div>'
    );
    expect(html).toContain('<div class="overview prose"><p>Von Pretoria bis Swakopmund.</p></div>');
    expect(rule('.overview')).toBeNull();
  });
});

/**
 * What a ship is, under what she is called.
 *
 * A line rather than her picture and her prose: she has a prospect of her own
 * now, and repeating it on every trip document she appears in is what that
 * page exists to avoid. A name with nothing beside it, though, tells somebody
 * reading the sheet nothing at all.
 */
describe('the ship on a leg', () => {
  it('says what she is under the line that names her', () => {
    const html = buildTripDocumentHtml(
      sheet({
        transport: [
          {
            time: null,
            label: 'Oslo - Kirkenes',
            detail: 'Hurtigruten · MS Trollfjord',
            about: 'The Hurtigruten flagship, rebuilt in 2023.',
            when: null,
            fares: [],
            optional: null,
          },
        ],
      })
    );

    expect(html).toContain('class="about"');
    expect(html).toContain('The Hurtigruten flagship, rebuilt in 2023.');
  });

  it('says nothing for a leg on a ship the vault has no note for', () => {
    const html = buildTripDocumentHtml(
      sheet({
        transport: [
          {
            time: null,
            label: 'Oslo - Kirkenes',
            detail: 'Hurtigruten · MS Unknown',
            about: null,
            when: null,
            fares: [],
            optional: null,
          },
        ],
      })
    );

    expect(html).not.toContain('class="about"');
  });

  it('escapes prose somebody typed markup into', () => {
    const html = buildTripDocumentHtml(
      sheet({
        transport: [
          {
            time: null,
            label: 'X',
            detail: null,
            about: '<script>alert(1)</script>',
            when: null,
            fares: [],
            optional: null,
          },
        ],
      })
    );

    expect(html).not.toContain('<script>');
  });
});

/**
 * The row as the document actually builds it.
 *
 * A test of the markup cannot see a builder that never fills the field in,
 * which is the mistake this file has now made twice in a week over a
 * different field each time. `documentTransport` needs no App, so this goes
 * through the thing that decides.
 */
describe('what a leg row is built from', () => {
  it('takes the ship own words from her note', async () => {
    const { documentTransport } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aLeg, aTrip, aVehicle } = await import('./fixtures');

    const trip = aTrip('Nordkap', {
      transport: [
        aLeg({
          vehicleTitle: 'MS Trollfjord',
          vehicle: aVehicle('MS Trollfjord', { description: 'The Hurtigruten flagship.' }),
        }),
      ],
    });

    expect(documentTransport(trip, DEFAULT_SETTINGS)[0].about).toBe('The Hurtigruten flagship.');
  });

  /** A ship somebody typed the name of, with no note behind it, has no words to lend. */
  it('says nothing for a leg whose ship has no note', async () => {
    const { documentTransport } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aLeg, aTrip } = await import('./fixtures');

    const trip = aTrip('Nordkap', { transport: [aLeg({ vehicleTitle: 'MS Unknown' })] });

    expect(documentTransport(trip, DEFAULT_SETTINGS)[0].about).toBeNull();
  });
});

/**
 * What a leg says outside its own section.
 *
 * Reported from a real Nordkap note: the flight to Oslo is on day 1 and the
 * printed day 1 said nothing about it, because a leg was named only on the
 * day it landed and only when it ran overnight. The clock rides with the
 * departure, since the rest of the day is arranged around it.
 */
describe('a leg named on a day of the itinerary', () => {
  async function days(transport: unknown[]) {
    const { documentDays } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const trip = aTrip('Nordkap', {
      departure: null,
      transport: transport as never,
    });
    return documentDays(trip, DEFAULT_SETTINGS);
  }

  it('names the flight on the day it leaves, with its times', async () => {
    const { aLeg } = await import('./fixtures');
    const [day] = await days([
      aLeg({ day: 1, toDay: 1, from: '09:40', to: '12:10', origin: 'Zürich', destination: 'Oslo' }),
    ]);

    expect(day.label).toBe('Day 1');
    expect(day.departures).toEqual(['Departs today: Zürich to Oslo · 09:40 - 12:10']);
    expect(day.arrivals).toEqual([]);
  });

  it('names a voyage on both the day it leaves and the day it ends', async () => {
    const { aLeg } = await import('./fixtures');
    const groups = await days([
      aLeg({ day: 2, toDay: 16, origin: 'Oslo', destination: 'Kopenhagen' }),
    ]);

    expect(groups.map((g) => g.label)).toEqual(['Day 2', 'Day 16']);
    expect(groups[0].departures).toEqual(['Departs today: Oslo to Kopenhagen']);
    expect(groups[1].arrivals).toEqual(['Arrives today: Oslo to Kopenhagen']);
    expect(groups[1].departures).toEqual([]);
  });

  it('draws the day a return flight falls on after the trip', async () => {
    const { aLeg } = await import('./fixtures');
    const groups = await days([
      aLeg({ day: 18, toDay: 18, from: '09:50', to: '11:45', origin: 'CPH', destination: 'ZRH' }),
    ]);

    expect(groups.map((g) => g.label)).toEqual(['Day 18']);
    expect(groups[0].departures).toEqual(['Departs today: CPH to ZRH · 09:50 - 11:45']);
  });
});

/**
 * The price beside "Optional".
 *
 * Reported from real use of a Nordkap brochure: an excursion in Stavanger
 * that costs 119 francs a head printed as the bare word "Optional", and the
 * figure was two pages away in the cost table. An optional line is the one
 * line on the page somebody has to decide about while reading it.
 *
 * `optionalLabel` is exported for this: the builders that call it are pure,
 * but the label is the join between a markup module and an arithmetic one,
 * and that join is where this file's last two bugs lived.
 */
describe('what an optional line says about its price', () => {
  const priced = { cost: 119, currency: 'CHF', costUnit: 'person' as const, variants: [] };

  it('says nothing at all for a line that is happening', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      { ...priced, optional: false, chosen: false },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toBeNull();
  });

  it('names the amount and the unit together', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      { ...priced, optional: true, chosen: false },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toContain('Optional');
    expect(label).toContain('119');
    expect(label).toContain('per person');
  });

  /**
   * The unit is printed because it changes the sum. 119 for two people is not
   * 119 each, and the row is read by somebody deciding for a household.
   */
  it('says in total rather than per person when that is what the note says', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      { ...priced, costUnit: 'total', optional: true, chosen: false },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toContain('in total');
    expect(label).not.toContain('per person');
  });

  it('keeps saying it was taken once somebody decided', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      { ...priced, optional: true, chosen: true },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toContain('Optional, taken');
    expect(label).toContain('119');
  });

  it('says the bare word for an optional line nobody priced', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      { ...priced, cost: null, optional: true, chosen: false },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toBe('Optional');
  });

  /**
   * Its variants are listed under it in full, with their own names and
   * figures. Repeating one of them in the heading would pick a favourite the
   * note did not.
   */
  it('says the bare word for a line sold at several prices', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const label = optionalLabel(
      {
        ...priced,
        cost: null,
        variants: [
          {
            name: 'Outside',
            description: null,
            cost: 119,
            currency: null,
            costUnit: 'person',
            chosen: false,
          },
          {
            name: 'Superior',
            description: null,
            cost: 189,
            currency: null,
            costUnit: 'person',
            chosen: false,
          },
        ],
        optional: true,
        chosen: false,
      },
      aTrip('Nordkap'),
      DEFAULT_SETTINGS
    );

    expect(label).toBe('Optional');
  });

  /** A line that names no currency is in the trip's, and a trip that names none is in the home one. */
  it('falls back to the trip currency and then to the home one', async () => {
    const { optionalLabel } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const unpriced = { ...priced, currency: null, optional: true, chosen: false };

    expect(
      optionalLabel(unpriced, aTrip('Nordkap', { currency: 'NOK' }), DEFAULT_SETTINGS)
    ).toContain('NOK');
    expect(optionalLabel(unpriced, aTrip('Nordkap'), DEFAULT_SETTINGS)).toContain('CHF');
  });

  /**
   * Through the builder rather than the label, because a builder that never
   * passes the trip through is exactly the mistake a label test cannot see.
   */
  it('reaches a leg row built by the document', async () => {
    const { documentTransport } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aLeg, aTrip } = await import('./fixtures');

    const trip = aTrip('Nordkap', {
      transport: [aLeg({ cost: 119, currency: null, costUnit: 'person', optional: true })],
    });

    expect(documentTransport(trip, DEFAULT_SETTINGS)[0].optional).toContain('119');
  });
});

describe('the excursion on a stop', () => {
  const withExcursion = (over: Record<string, unknown>) =>
    sheet({
      days: [
        {
          arrivals: [],
          departures: [],
          label: 'Day 3',
          title: 'Stavanger',
          note: null,
          date: null,
          entries: [
            {
              time: null,
              place: 'Stavanger',
              excursion: 'In the footsteps of the Vikings',
              about: 'Viking House, the Swords in the Rock, and the Domsteinene.',
              note: null,
              optional: 'Optional - CHF 119.00 per person',
              fares: [],
              ...over,
            },
          ],
        },
      ],
    });

  it('names the tour beside the town and says what it is', () => {
    const html = buildTripDocumentHtml(withExcursion({}));

    // Both on the row, in the order somebody reads it: where the ship is,
    // what is being offered, what it costs to decide about, and then the
    // tour's own words.
    expect(html).toContain('<b>Stavanger</b>');
    expect(html).toContain('class="excursion"');
    expect(html).toContain('In the footsteps of the Vikings');
    expect(html).toContain('Viking House, the Swords in the Rock, and the Domsteinene.');
    expect(html.indexOf('class="excursion"')).toBeLessThan(html.indexOf('class="optional"'));
  });

  it('prints a tour the vault has no note for, with nothing under it', () => {
    const html = buildTripDocumentHtml(withExcursion({ about: null }));

    expect(html).toContain('King crab safari'.slice(0, 0) + 'In the footsteps of the Vikings');
    expect(html).not.toContain('class="about"');
  });

  it('prints an ordinary stop with no excursion markup at all', () => {
    const html = buildTripDocumentHtml(withExcursion({ excursion: null, about: null }));

    expect(html).not.toContain('class="excursion"');
  });

  it('escapes a tour name somebody typed markup into', () => {
    const html = buildTripDocumentHtml(withExcursion({ excursion: '<script>alert(1)</script>' }));

    expect(html).not.toContain('<script>');
  });

  /**
   * Through the builder rather than the markup, because a builder that never
   * passes the excursion through is exactly the mistake a markup test cannot
   * see. The same lesson note 45 recorded, on the same file.
   */
  it('reaches a day row built by the document', async () => {
    const { documentDays } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip, aStop, anExcursion } = await import('./fixtures');

    const trip = aTrip('Nordkap', {
      stops: [
        aStop({
          day: 3,
          placeTitle: 'Stavanger',
          excursionTitle: 'In the footsteps of the Vikings',
          excursion: anExcursion('In the footsteps of the Vikings', {
            description: 'Viking House and the Swords in the Rock.',
          }),
        }),
      ],
    });

    const entry = documentDays(trip, DEFAULT_SETTINGS)[0].entries[0];
    expect(entry.excursion).toBe('In the footsteps of the Vikings');
    expect(entry.about).toBe('Viking House and the Swords in the Rock.');
  });
});

describe('what follows the trip', () => {
  const extension = {
    title: 'Kopenhagen',
    when: '31 December 2027 - 3 January 2028',
    about: 'Three days at the far end of the voyage',
    total: 'CHF 940.00',
  };

  it('prints each one with its own dates and its own figure', () => {
    const html = buildTripDocumentHtml(
      sheet({ extensions: [extension], extensionsHint: 'Not in the total above.' })
    );

    expect(html).toContain('Kopenhagen');
    expect(html).toContain('CHF 940.00');
    expect(html).toContain('Not in the total above.');
  });

  it('leaves the section out entirely when nothing follows the trip', () => {
    const html = buildTripDocumentHtml(sheet({ extensions: [], extensionsHint: null }));

    expect(html).not.toContain('Afterwards');
  });

  it('keeps the figure out of the trip’s own total', () => {
    const html = buildTripDocumentHtml(
      sheet({ extensions: [extension], extensionsHint: 'Not in the total above.' })
    );

    // The extension's figure is a second number, not a bigger one. It sits
    // below the costs table rather than inside it, because three days in
    // Kopenhagen are separately booked and separately cancellable.
    const table = html.slice(html.indexOf('<table class="costs">'), html.indexOf('</table>'));
    expect(table).not.toContain('CHF 940.00');
  });

  it('escapes a title somebody typed markup into', () => {
    const html = buildTripDocumentHtml(
      sheet({ extensions: [{ ...extension, title: '<script>alert(1)</script>' }] })
    );

    expect(html).not.toContain('<script>');
  });

  /** Through the builder, for the reason the excursion row is checked there. */
  it('reaches a row built by the document, with the extension’s own money', async () => {
    const { documentExtensions } = await import('../src/trips/ui/export-trip-document');
    const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');
    const { aTrip } = await import('./fixtures');

    const child = aTrip('Kopenhagen', {
      departure: '2027-12-31',
      currency: 'DKK',
      subtitle: 'Three days at the far end',
      budget: [{ category: 'accommodation', amount: 4200 }],
    });
    const parent = aTrip('Nordkap', { extensions: [child] });

    const [row] = documentExtensions(parent, DEFAULT_SETTINGS);
    expect(row.title).toBe('Kopenhagen');
    expect(row.about).toBe('Three days at the far end');
    // Its own currency, not the parent's: converting here would be arithmetic
    // the reader cannot check.
    expect(row.total).toContain('DKK');
  });
});

/**
 * A link typed into the itinerary, which is where this will actually happen:
 * a day note and a stop note are textareas somebody types a sentence into,
 * and a sentence about a place is how a link gets written.
 */
describe('a wikilink in the itinerary', () => {
  it('prints a day note as a reader wants to read it', () => {
    const day = sheet().days[0];
    const html = buildTripDocumentHtml(
      sheet({ days: [{ ...day, note: 'Ankunft in [[Stavanger]].' }] })
    );

    expect(html).toContain('<p class="day-note">Ankunft in Stavanger.</p>');
    expect(html).not.toContain('[[');
  });

  it('prints a stop note the same way, alias and all', () => {
    const day = sheet().days[0];
    const entry = { ...day.entries[0], note: 'Treffpunkt am [[Hafen|Kai]]' };
    const html = buildTripDocumentHtml(sheet({ days: [{ ...day, entries: [entry] }] }));

    expect(html).toContain('Treffpunkt am Kai');
    expect(html).not.toContain('[[');
  });
});

/**
 * The extras nobody has taken.
 *
 * One figure said "Optional zusätzlich CHF 678" and left the reader to imagine
 * which extras it covered. On a trip offering an excursion most days it is also
 * a sum nobody can spend: two on one day are a choice between them. The rows
 * are the decision; the sum stays as a ceiling and now says so.
 */
describe('what the extras cost', () => {
  const extras = {
    label: 'Optional zusätzlich',
    lines: [
      { label: 'Tromsø', amount: 'CHF 440.00' },
      { label: 'Auf den Spuren der Wikinger', amount: 'CHF 238.00' },
    ],
    ceiling: { label: 'All of them together', amount: 'CHF 678.00' },
  };

  it('prints one row per extra, under the plan rather than inside it', () => {
    const html = buildTripDocumentHtml(sheet({ costOptional: extras }));
    const table = /<table class="costs">([\s\S]*?)<\/table>/.exec(html)?.[1] ?? '';

    expect(table).toContain(
      '<tr class="optional-head"><td colspan="2">Optional zusätzlich</td></tr>'
    );
    expect(table.match(/<tr class="optional-line">/g) ?? []).toHaveLength(2);
    expect(table).toContain('Tromsø');
    // After the plan's own total: nothing here is part of that sum.
    expect(table.indexOf('optional-head')).toBeGreaterThan(table.indexOf('class="total"'));
  });

  it('prints the ceiling last, as its own row', () => {
    const table =
      /<table class="costs">([\s\S]*?)<\/table>/.exec(
        buildTripDocumentHtml(sheet({ costOptional: extras }))
      )?.[1] ?? '';

    expect(table).toContain('All of them together');
    expect(table.indexOf('optional-total')).toBeGreaterThan(table.lastIndexOf('optional-line'));
  });

  /**
   * An extra priced in another currency is on the page and out of the sum, the
   * rule every total on this sheet follows. The sheet is handed both already
   * formatted, so what it has to get right is printing the rows with no ceiling
   * at all rather than printing a zero.
   */
  it('prints the rows with no ceiling when there is nothing it may sum', () => {
    const table =
      /<table class="costs">([\s\S]*?)<\/table>/.exec(
        buildTripDocumentHtml(sheet({ costOptional: { ...extras, ceiling: null } }))
      )?.[1] ?? '';

    expect(table).toContain('optional-line');
    expect(table).not.toContain('optional-total');
  });

  it('prints nothing at all for a trip that offers none', () => {
    const table =
      /<table class="costs">([\s\S]*?)<\/table>/.exec(
        buildTripDocumentHtml(sheet({ costOptional: null }))
      )?.[1] ?? '';

    expect(table).not.toContain('optional-');
  });
});
