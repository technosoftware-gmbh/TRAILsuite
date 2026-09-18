/**
 * The ship brochure, as markup.
 *
 * The pure half only, which is the boundary the trip document's own suite
 * draws: what the page says is worth testing, and reading the vault to fill it
 * in is App-bound work with its own failure modes.
 */
import { describe, expect, it } from 'vitest';
import { type ProseBlock } from '@technosoftware/trail-core';
import { buildProspectHtml, Prospect } from '../src/places/export-prospect';

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
    title: 'MS Trollfjord',
    description: 'The Hurtigruten flagship, rebuilt in 2023.',
    highlights: [],
    overview: paragraphs(
      'Our ship for the Spitsbergen line.',
      'Named after a fjord in the Vesterålen.'
    ),
    meta: ['Hurtigruten', 'Boat'],
    hero: { src: 'data:image/jpeg;base64,AAAA', caption: null },
    cabins: [
      {
        name: 'Polar Aussenkabine',
        description: 'Outside cabin with a window.',
        picture: { src: 'data:image/jpeg;base64,BBBB', caption: null },
      },
      { name: 'Arktis Superior', description: null, picture: null },
    ],
    facts: [
      { label: 'Built', value: '2002' },
      { label: 'Capacity', value: '500' },
    ],
    gallery: [{ src: 'data:image/jpeg;base64,CCCC', caption: 'On deck' }],
    trips: [{ title: 'Nordkap', when: '20 December 2026' }],
    labels: {
      highlights: 'Highlights',
      overview: 'About her',
      cabins: 'The cabins',
      facts: 'In numbers',
      gallery: 'Pictures',
      trips: 'Aboard',
    },
    caveat: 'Everything here comes from this note.',
    footer: 'Generated on 6 September 2026.',
    ...over,
  };
}

describe('the brochure page', () => {
  it('leads with the name and the short description', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('<h1>MS Trollfjord</h1>');
    expect(html).toContain('The Hurtigruten flagship, rebuilt in 2023.');
  });

  it('prints every cabin, with its own picture', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('Polar Aussenkabine');
    expect(html).toContain('Arktis Superior');
    expect(html).toContain('data:image/jpeg;base64,BBBB');
  });

  /**
   * So a catalogue where only some cabins are photographed still reads as one
   * column of text rather than two layouts down the page.
   */
  it('keeps the picture column for a cabin that has none', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('class="noimg"');
  });

  it('prints the facts as rows', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('Built');
    expect(html).toContain('2002');
  });

  it('names the trips that sailed on her', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('Nordkap');
    expect(html).toContain('20 December 2026');
  });

  /** A section a ship says nothing about is left out rather than printed empty. */
  it('omits a section with nothing in it', () => {
    const html = buildProspectHtml(sheet({ gallery: [], trips: [], facts: [], cabins: [] }));

    expect(html).not.toContain('Pictures');
    expect(html).not.toContain('Aboard');
    expect(html).not.toContain('In numbers');
    expect(html).not.toContain('The cabins');
  });

  it('escapes a name somebody typed markup into', () => {
    const html = buildProspectHtml(sheet({ title: '<b>X</b>' }));

    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).not.toContain('<h1><b>X</b></h1>');
  });
});

/**
 * The note's own summary, printed as prose.
 *
 * Beside the one-line `description:` rather than instead of it: the property
 * is the line an operator would put under her name, and the summary is what
 * the note's owner wrote about her. Both, either, or neither.
 */
describe('what the note says about her', () => {
  it('prints the summary as paragraphs under the picture', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('<h2>About her</h2>');
    expect(html).toContain('<p>Our ship for the Spitsbergen line.</p>');
    expect(html).toContain('<p>Named after a fjord in the Vesterålen.</p>');
  });

  it('keeps the short description as the subtitle beside it', () => {
    const html = buildProspectHtml(sheet());

    expect(html).toContain('class="subtitle"');
    expect(html).toContain('The Hurtigruten flagship, rebuilt in 2023.');
  });

  /** A ship nobody has written about prints no heading for the words that are not there. */
  it('omits the section for a ship with no summary', () => {
    const html = buildProspectHtml(sheet({ overview: [] }));

    expect(html).not.toContain('About her');
  });

  it('prints the summary for a ship carrying no description', () => {
    const html = buildProspectHtml(sheet({ description: null }));

    expect(html).not.toContain('class="subtitle"');
    expect(html).toContain('<p>Our ship for the Spitsbergen line.</p>');
  });

  it('escapes prose somebody typed markup into', () => {
    const html = buildProspectHtml(sheet({ overview: paragraphs('<script>alert(1)</script>') }));

    expect(html).not.toContain('<script>');
  });
});
