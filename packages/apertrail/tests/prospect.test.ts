/**
 * A prospect for every note the gallery draws a card for.
 *
 * The pure half only, which is the boundary every sheet's suite here draws:
 * what the page says is worth testing, and reading the vault to fill it in is
 * App-bound work with its own failure modes. What is asserted is the part that
 * differs per subject -- the facts, the meta line and which trips count --
 * plus the two rules that made one page out of five.
 */
import { describe, expect, it } from 'vitest';
import { type ProseBlock } from '@technosoftware/trail-core';
import { buildProspectHtml, Prospect } from '../src/places/export-prospect';
import { tripsCovering } from '../src/trips/related-trips';
import { aBoard, aTrip } from './fixtures';
import type { TFile } from 'obsidian';
import { TravelCity, TravelTrip } from '../src/vault/types';

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

function sheet(over: Partial<Prospect> = {}): Prospect {
  return {
    title: 'Landquart Fashion Outlet',
    description: null,
    overview: [],
    meta: ['Location', 'Landquart, Schweiz'],
    hero: null,
    cabins: [],
    facts: [],
    gallery: [],
    highlights: [],
    trips: [],
    labels: {
      highlights: 'Highlights',
      overview: 'In short',
      cabins: 'Categories',
      facts: 'The details',
      gallery: 'Pictures',
      trips: 'Your trips here',
    },
    caveat: 'Everything here comes from this note.',
    footer: 'Generated on 7 September 2026.',
    ...over,
  };
}

describe('the prospect page', () => {
  it('leads with the name and the meta line', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('<h1>Landquart Fashion Outlet</h1>');
    expect(html).toContain('Landquart, Schweiz');
  });

  /**
   * The middle section only a vehicle fills in. A hotel's page has to read as
   * a page rather than as a ship's brochure with a hole in it, which is what
   * an empty heading would make it.
   */
  it('omits the categories section for a subject with none', () => {
    expect(buildProspectHtml(sheet())).not.toContain('Categories');
  });

  it('prints the categories when there are some', () => {
    const html = buildProspectHtml(
      sheet({ cabins: [{ name: 'Polar Aussenkabine', description: null, picture: null }] })
    );

    expect(html).toContain('Categories');
    expect(html).toContain('Polar Aussenkabine');
  });

  it('prints the facts a note carries as rows', () => {
    const html = buildProspectHtml(
      sheet({ facts: [{ label: 'Where', value: 'Landquart, Schweiz' }] })
    );

    expect(html).toContain('<td class="label">Where</td>');
  });

  /** A note nobody has been to yet prints no heading for the trips that did not happen. */
  it('omits the trips section for a place nobody has been to', () => {
    expect(buildProspectHtml(sheet())).not.toContain('Your trips here');
  });

  it('escapes a title somebody typed markup into', () => {
    expect(buildProspectHtml(sheet({ title: '<script>alert(1)</script>' }))).not.toContain(
      '<script>'
    );
  });
});

/**
 * Which trips count as "here" for a region.
 *
 * No trip names a State at all, and a Country is named in frontmatter rather
 * than stopped at, so the question has to be asked of the names underneath.
 */
describe('trips covering a region', () => {
  const file = (basename: string) => ({ path: `${basename}.md`, basename }) as TFile;
  const city = (title: string): TravelCity =>
    ({ file: file(title), title }) as unknown as TravelCity;
  const stop = (placeTitle: string) => ({ placeTitle }) as unknown as TravelTrip['stops'][number];

  it('counts a trip that names the region in its frontmatter', () => {
    const board = aBoard({ trips: [aTrip('Wanderjahr', { countryTitle: 'Schweiz' })] });

    expect(tripsCovering(board, ['Schweiz']).map((v) => v.trip.title)).toEqual(['Wanderjahr']);
  });

  it('counts a trip that lists the city', () => {
    const board = aBoard({ trips: [aTrip('Kurztrip', { cityTitles: ['Basel'] })] });

    expect(tripsCovering(board, ['Basel'])).toHaveLength(1);
  });

  /** A trip that stopped somewhere in the region counts, and brings its stops with it. */
  it('counts a trip that stopped there, and carries the stops', () => {
    const board = aBoard({ trips: [aTrip('Kurztrip', { stops: [stop('Basel'), stop('Bern')] })] });
    const [visit] = tripsCovering(board, ['Basel']);

    expect(visit.stops).toHaveLength(1);
  });

  /** A trip that only named the region contributes no stops, which is honest rather than empty. */
  it('carries no stops for a trip that only named it', () => {
    const board = aBoard({ trips: [aTrip('Wanderjahr', { countryTitle: 'Schweiz' })] });

    expect(tripsCovering(board, ['Schweiz'])[0].stops).toEqual([]);
  });

  it('counts a trip once however many ways it matches', () => {
    const board = aBoard({
      trips: [aTrip('Beides', { countryTitle: 'Schweiz', cityTitles: ['Basel'] })],
    });

    expect(tripsCovering(board, ['Schweiz', 'Basel'])).toHaveLength(1);
  });

  /** A state with no cities written down yet asks about nothing, and gets nothing rather than everything. */
  it('says nothing for an empty set of names', () => {
    const board = aBoard({ trips: [aTrip('Wanderjahr', { countryTitle: 'Schweiz' })] });

    expect(tripsCovering(board, [])).toEqual([]);
    expect(tripsCovering(board, ['', '  '])).toEqual([]);
  });

  it('leaves a city out of it when nothing points there', () => {
    const board = aBoard({ trips: [aTrip('Wanderjahr', { countryTitle: 'Schweiz' })] });

    expect(tripsCovering(board, [city('Basel').title])).toEqual([]);
  });
});

/**
 * The subtitle every subject can now carry.
 *
 * `description:` was a vehicle's alone until the cover dialog gave the other
 * six somewhere to type it, and the prospect prints whichever of the two short
 * things a note has: this line, the summary, both, or neither.
 */
describe('the line under the title', () => {
  it('prints the description as a subtitle', () => {
    const html = buildProspectHtml(sheet({ description: 'A shopping village in Landquart.' }));

    expect(html).toContain('class="subtitle"');
    expect(html).toContain('A shopping village in Landquart.');
  });

  it('prints no subtitle for a note that carries none', () => {
    expect(buildProspectHtml(sheet({ description: null }))).not.toContain('class="subtitle"');
  });

  it('prints both when the note carries a description and a summary', () => {
    const html = buildProspectHtml(
      sheet({
        description: 'A shopping village.',
        overview: paragraphs('Open every day but Sunday.'),
      })
    );

    expect(html).toContain('class="subtitle"');
    expect(html).toContain('<p>Open every day but Sunday.</p>');
  });

  /**
   * Reported off the first real Wikinger prospect: the highlights came out as
   * a run of lines each opening with a hyphen, because the summary was being
   * passed to a `<p>` as raw text. What the callout says is markdown, and this
   * page is the one place nothing renders it.
   */
  it('prints a summary list as a list', () => {
    const html = buildProspectHtml(
      sheet({
        overview: [
          {
            kind: 'list',
            items: [
              { text: 'Nordkap', ordered: false, items: [] },
              { text: 'Hammerfest', ordered: false, items: [] },
            ],
          },
        ],
      })
    );

    expect(html).toContain('class="overview prose"');
    expect(html).toContain('<ul><li>Nordkap</li><li>Hammerfest</li></ul>');
  });

  /**
   * The trip document had this section and the prospect did not, so an
   * excursion's highlights had nowhere to be but inside the summary callout,
   * where the page printed them as prose. Same place as the trip's: under the
   * picture, where the eye already is, and above the words.
   */
  it('prints the highlights as a starred list above the overview', () => {
    const html = buildProspectHtml(
      sheet({
        highlights: ['Viking House', 'Domsteinene'],
        overview: paragraphs('Ein Tag an Land.'),
      })
    );

    expect(html).toContain('<ul class="highlights"><li>Viking House</li><li>Domsteinene</li></ul>');
    expect(html.indexOf('class="highlights"')).toBeLessThan(html.indexOf('class="overview'));
    expect(html.indexOf('class="hero"')).toBeLessThan(html.indexOf('class="highlights"'));
  });

  /** Same treatment as the prose below it, or one sheet prints brackets in one section only. */
  it('prints a link in a highlight as the word a reader sees', () => {
    const html = buildProspectHtml(sheet({ highlights: ['Gamle [[Stavanger|die Altstadt]]'] }));

    expect(html).toContain('<li>Gamle die Altstadt</li>');
  });

  it('omits the section for a note that claims nothing', () => {
    expect(buildProspectHtml(sheet({ highlights: [] }))).not.toContain('class="highlights"');
  });

  it('escapes a highlight somebody typed markup into', () => {
    const html = buildProspectHtml(sheet({ highlights: ['<script>alert(1)</script>'] }));

    expect(html).not.toContain('<script>');
  });

  it('escapes a description somebody typed markup into', () => {
    expect(buildProspectHtml(sheet({ description: '<script>alert(1)</script>' }))).not.toContain(
      '<script>'
    );
  });
});

/**
 * The top of the page, per subject.
 *
 * The line that carries a note's description into the sheet was wrong for six
 * of the seven subjects and every markup test passed, which is the fourth time
 * this week a join between two tested halves went unseen (note 45). It is a
 * function of its own now, and this is what asks it.
 */
describe('the header a subject makes', () => {
  it('carries the description of every kind, not just a ship', async () => {
    const { prospectHeader } = await import('../src/places/ui/export-prospect');
    const { aVehicle } = await import('./fixtures');
    const note = (title: string) => ({
      file: { path: `${title}.md`, basename: title },
      title,
      description: 'A line.',
      image: null,
      gallery: [],
    });

    const subjects = [
      { kind: 'vehicle', vehicle: aVehicle('Ship', { description: 'A line.' }) },
      { kind: 'place', place: { ...note('Tower'), kind: 'landmark' } },
      { kind: 'city', city: note('Basel') },
      { kind: 'state', state: note('Aargau') },
      { kind: 'country', country: note('Schweiz') },
    ] as unknown as Parameters<typeof prospectHeader>[0][];

    for (const subject of subjects) {
      expect(prospectHeader(subject).description).toBe('A line.');
    }
  });

  it('names each subject by its own title', async () => {
    const { prospectHeader } = await import('../src/places/ui/export-prospect');
    const country = { file: { path: 'S.md' }, title: 'Schweiz', description: null } as never;

    expect(prospectHeader({ kind: 'country', country }).title).toBe('Schweiz');
  });
});

/**
 * What the printer does to this page, which is not what the browser does to it.
 *
 * The prospect was extracted from the trip document (note 43, phase 4) and took
 * its `section()` with it, wrapper markup and all. It did not take the rule that
 * makes the wrapper mean something, and nothing here looked at the stylesheet,
 * so the sheet shipped emitting four `.section-head` boxes no engine was told to
 * keep whole. Thomas found it on paper, twice, both times "Kurz gesagt" at the
 * foot of one page and its prose at the top of the next.
 */
describe('the prospect on paper', () => {
  /** Every section filled, so the page carries the headings a real subject gives it. */
  function full(over: Partial<Prospect> = {}): Prospect {
    return sheet({
      overview: paragraphs('A paragraph about the place.'),
      highlights: ['Worth the detour.'],
      cabins: [{ name: 'Polar Aussenkabine', description: null, picture: null }],
      facts: [{ label: 'Dauer', value: '3 Stunden' }],
      gallery: [{ src: 'a.jpg', caption: null }],
      trips: [{ title: 'Nordkap', when: '2027' }],
      ...over,
    });
  }

  const css = /<style>([\s\S]*?)<\/style>/.exec(buildProspectHtml(full()))?.[1] ?? '';

  /** The declarations of one rule, whitespace collapsed. Null when there is no such rule. */
  function rule(selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?:^|[;}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    return found === undefined ? null : found.replace(/\s+/g, ' ').trim();
  }

  /**
   * The trip document's test says why this asserts markup rather than
   * `break-after: avoid` on the heading: that declaration passed a test while
   * the defect was live, because headless Chromium honours it and the engine
   * that printed the real PDF does not. Here it asserts both halves of the
   * mechanism, since this sheet had one of them and not the other.
   */
  it('binds every heading to a block, and the wrapper carries the rule', () => {
    const html = buildProspectHtml(full());
    const headings = html.match(/<h2>/g) ?? [];
    expect(headings.length).toBeGreaterThan(3);

    // No heading stands on its own: each one opens a wrapper.
    const wrapped = html.match(/<div class="section-head"><h2>/g) ?? [];
    expect(wrapped).toHaveLength(headings.length);

    // And the wrapper carries the property an engine cannot decline.
    expect(rule('.section-head')).toMatch(/break-inside:\s*avoid/);
  });

  /**
   * The summary is two boxes so that the heading can keep a paragraph and the
   * rest can break. An excursion's summary is an operator's own page of prose,
   * and pinning a page of prose together ends page one early to make room.
   */
  it('keeps one paragraph with the summary heading and lets the rest break', () => {
    const html = buildProspectHtml(
      full({ overview: paragraphs('Der erste Absatz.', 'Der zweite.', 'Der dritte.') })
    );

    expect(html).toContain(
      '<div class="section-head"><h2>In short</h2>' +
        '<div class="overview prose"><p>Der erste Absatz.</p></div></div>'
    );
    expect(html).toContain(
      '<div class="overview prose"><p>Der zweite.</p><p>Der dritte.</p></div>'
    );
    expect(rule('.overview')).toBeNull();
  });

  /**
   * Only the first block joins the heading. A catalogue of twelve cabins in one
   * unbreakable box is a box taller than the page, which an engine resolves by
   * breaking it anyway, and the section would start on a fresh page for nothing.
   */
  it('glues only the first block to the heading', () => {
    const cabin = (name: string) => ({ name, description: null, picture: null });
    const html = buildProspectHtml(
      full({ cabins: [cabin('Polar Aussenkabine'), cabin('Arctic Suite')] })
    );

    // The heading opens the wrapper and the first cabin is immediately inside it.
    expect(html).toContain('<div class="section-head"><h2>Categories</h2><div class="cabin">');
    // The wrapper closes after that one cabin, and the rest follow outside it.
    expect(html).toMatch(/<\/div><\/div><div class="cabin">/);
  });
});

/**
 * A link typed anywhere a prospect prints a note's own words.
 *
 * The summary was resolved by the core and everything around it was not, so
 * the same link printed two ways on one page depending on which field it had
 * been typed into. These are the three fields on this sheet that are somebody
 * writing rather than something formatted.
 */
describe('a wikilink on the page', () => {
  it('prints the subtitle as a reader wants to read it', () => {
    const html = buildProspectHtml(sheet({ description: 'Ein Tag in [[Stavanger]]' }));

    expect(html).toContain('<div class="subtitle">Ein Tag in Stavanger</div>');
    expect(html).not.toContain('[[');
  });

  it('prints a category description the same way', () => {
    const html = buildProspectHtml(
      sheet({
        cabins: [
          { name: 'Polar Aussenkabine', description: 'Blick auf [[Nordkap]]', picture: null },
        ],
      })
    );

    expect(html).toContain('Blick auf Nordkap');
    expect(html).not.toContain('[[');
  });

  it('prints a picture caption the same way', () => {
    const html = buildProspectHtml(
      sheet({ gallery: [{ src: 'a.jpg', caption: 'Abends in [[Tromso]]' }] })
    );

    expect(html).toContain('<figcaption>Abends in Tromso</figcaption>');
    expect(html).not.toContain('[[');
  });
});
