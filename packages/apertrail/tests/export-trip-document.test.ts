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
import { buildTripDocumentHtml, TripDocument } from '../src/trips/export-trip-document';
import { buildFieldSheetHtml } from '../src/places/export-photo-spot';
import { buildCostSheetHtml } from '../src/trips/costs/export-trip-costs';

function sheet(overrides: Partial<TripDocument> = {}): TripDocument {
  return {
    title: 'Shongololo Express',
    subtitle: 'Zugreise in Suedafrika',
    meta: ['South Africa', '13 February 2026 - 24 February 2026', '12 days'],
    hero: { src: 'data:image/jpeg;base64,AAAA', caption: null },
    highlights: ['Kapstadt & Tafelberg', 'Die Namib bei Sonnenaufgang'],
    overview: ['Zwoelf Tage im Zug.', 'Von Pretoria bis Swakopmund.'],
    days: [
      {
        arrivals: [],
        label: 'Day 1',
        title: 'Pretoria',
        note: 'Ankunft und Einschiffung.',
        date: '13 February 2026',
        entries: [
          {
            time: '09:00',
            place: 'Pretoria',
            note: 'Boarding at Capital Park',
            optional: null,
            fares: [],
          },
          { time: null, place: 'Rovos Rail', note: null, optional: null, fares: [] },
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
        time: null,
        label: 'Rovos Rail',
        detail: null,
        when: 'Day 1 → Day 12',
        fares: [],
        optional: null,
      },
    ],
    transportHint: 'Day 0 is the day before the trip starts.',
    labels: {
      fareChosen: 'chosen',
      highlights: 'Highlights',
      overview: 'The trip in brief',
      itinerary: 'Day by day',
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
        days: [{ label: null, title: null, note: null, date: null, entries: [], arrivals: [] }],
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
          { label: 'Day 4', title: 'Seetag', note: null, date: null, entries: [], arrivals: [] },
        ],
      })
    );

    expect(html).toContain('<h3>Day 4: Seetag</h3>');
    expect(html).not.toContain('class="day undated"');
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
          { time: null, label: '<b>X</b>', detail: null, when: null, fares: [], optional: null },
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
            label: 'Day 9',
            title: null,
            note: null,
            date: null,
            entries: [
              {
                time: null,
                place: null,
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
        overview: ['Eins.\n\nZwei.'],
        days: [
          {
            arrivals: [],
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
   * The overview is the one piece of continuous prose on the sheet, and it
   * split across a page break. A day may move on its own -- it is a unit -- but
   * a paragraph the reader is midway through is not.
   */
  it('keeps the overview whole', () => {
    expect(rule('.overview')).toMatch(/break-inside:\s*avoid/);
  });
});
