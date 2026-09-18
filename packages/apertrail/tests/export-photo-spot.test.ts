/**
 * The field sheet's markup.
 *
 * Two things matter here and the rest is layout. Everything that reaches
 * the page is escaped, because a note is user input and a motif called
 * `<script>` must arrive as text. And a sheet stays honest when parts are
 * missing: a spot with no sun times, no samples or no access details prints
 * without those sections rather than with empty ones.
 */
import { describe, expect, it } from 'vitest';
import { buildFieldSheetHtml, FieldSheet, FieldSheetMotif } from '../src/places/export-photo-spot';

function motif(overrides: Partial<FieldSheetMotif> = {}): FieldSheetMotif {
  return {
    name: 'Château de Neuchâtel',
    role: 'Main motif',
    isMain: true,
    coordinates: '46.9895, 6.9243',
    direction: 'Shoots 215° (SW)',
    lens: '70-200',
    season: null,
    gear: ['Tripod'],
    light: [{ label: 'Golden hour, evening', time: '20:42 - 21:29' }],
    relation: 'Side lit',
    technique: null,
    note: 'From the sports centre on Chemin de la Boine.',
    capture: 'Captured 14 June 2025',
    captured: true,
    offset: null,
    samples: [],
    ...overrides,
  };
}

function sheet(overrides: Partial<FieldSheet> = {}): FieldSheet {
  return {
    title: 'Neuchâtel',
    subtitle: 'Switzerland > Neuchâtel',
    rating: 5,
    coordinates: '46.9899, 6.9293',
    zone: 'Europe/Zurich',
    dateLine: 'Light on 14 June 2026',
    sun: [{ label: 'Sunrise', value: '05:31' }],
    polarNote: null,
    motifs: [motif()],
    looseSamples: [],
    logistics: [{ label: 'Parking', value: 'Parking du Seyon' }],
    caveat: 'Geometry, not weather.',
    footer: 'Generated on 21 August 2026.',
    labels: { motifs: 'Motifs', light: 'Light', samples: 'Samples', onSite: 'On site' },
    ...overrides,
  };
}

describe('escaping', () => {
  it('renders a motif name as text rather than as markup', () => {
    const html = buildFieldSheetHtml(
      sheet({ motifs: [motif({ name: '<script>alert(1)</script>' })] })
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // Ampersands are ordinary in an exposure line and in a place name alike.
  it('escapes an ampersand in an ordinary value', () => {
    const html = buildFieldSheetHtml(
      sheet({ logistics: [{ label: 'Food & drink', value: 'Yes' }] })
    );
    expect(html).toContain('Food &amp; drink');
  });

  it('escapes quotes inside an attribute it writes', () => {
    const html = buildFieldSheetHtml(
      sheet({
        motifs: [
          motif({
            samples: [
              { src: 'data:image/jpeg;base64,AAAA', caption: 'a "quoted" frame', exposure: null },
            ],
          }),
        ],
      })
    );
    expect(html).toContain('alt="a &quot;quoted&quot; frame"');
  });
});

describe('a sheet with parts missing', () => {
  it('prints no light section for a spot with no coordinates', () => {
    const html = buildFieldSheetHtml(sheet({ sun: [], dateLine: 'Light on 14 June 2026' }));
    expect(html).not.toContain('Light on 14 June 2026');
  });

  it('prints no access table when nothing about access is written down', () => {
    expect(buildFieldSheetHtml(sheet({ logistics: [] }))).not.toContain('On site');
  });

  // The exposure line is half of what a sample is for, so a frame whose
  // image could not be inlined still prints its caption.
  it('keeps a sample caption when the image could not be inlined', () => {
    const html = buildFieldSheetHtml(
      sheet({
        motifs: [motif({ samples: [{ src: null, caption: 'Blue hour', exposure: '30s, f/11' }] })],
      })
    );
    expect(html).toContain('Blue hour');
    expect(html).toContain('30s, f/11');
    expect(html).toContain('noimg');
  });
});

describe('a sheet with everything', () => {
  it('is one self-contained document, with no external references', () => {
    const html = buildFieldSheetHtml(sheet());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<style>');
    // Nothing may reach the network: the sheet has to work on a phone in a
    // field with no signal, which is the entire point of it.
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/<link/);
    expect(html).not.toContain('<script');
  });

  it('marks the main motif so it reads first on paper', () => {
    const html = buildFieldSheetHtml(
      sheet({
        motifs: [motif(), motif({ name: 'Pavillon', isMain: false, role: 'Secondary motif' })],
      })
    );
    expect(html).toContain('class="motif main"');
    expect(html).toContain('class="motif"');
  });

  it('prints an empty box for a motif still owed, and a filled one for a motif in the bag', () => {
    const html = buildFieldSheetHtml(
      sheet({
        motifs: [
          motif(),
          motif({ name: 'Pavillon', captured: false, capture: 'Not captured yet' }),
        ],
      })
    );
    expect(html).toContain('&#9633; Not captured yet');
    expect(html).toContain('&#9635; Captured 14 June 2025');
  });
});

/**
 * What the printer does to this sheet.
 *
 * The field sheet was the last of the four still asking its headings to stay
 * with `break-after: avoid`, which is the declaration WebKit declines. It
 * takes `section()` now, like the trip document and the prospect, and the rule
 * that makes the wrapper mean anything lives in the shared page style rather
 * than in a copy each sheet keeps.
 */
describe('the field sheet on paper', () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(buildFieldSheetHtml(sheet()))?.[1] ?? '';

  it('binds every heading to a block, and the page style carries the rule', () => {
    const html = buildFieldSheetHtml(sheet());
    const headings = html.match(/<h2>/g) ?? [];
    expect(headings.length).toBeGreaterThan(1);

    const wrapped = html.match(/<div class="section-head"><h2>/g) ?? [];
    expect(wrapped).toHaveLength(headings.length);

    expect(css).toMatch(/\.section-head\s*\{[^}]*break-inside:\s*avoid/);
  });

  /** One motif is a box small enough to move; a catalogue of them is not. */
  it('glues only the first motif to its heading', () => {
    const html = buildFieldSheetHtml(sheet({ motifs: [motif(), motif({ name: 'Le Port' })] }));

    expect(html).toContain('<div class="section-head"><h2>Motifs</h2><section class="motif');
    expect(html).toMatch(/<\/section><\/div><section class="motif/);
  });

  /**
   * The polar note belongs to the sun block: it says why there are no times to
   * print beside it. A sheet with no sun rows prints neither, as it always did.
   */
  it('leaves out the light section, polar note and all, when there are no times', () => {
    const html = buildFieldSheetHtml(sheet({ sun: [], polarNote: 'Midnight sun until 29 July.' }));

    expect(html).not.toContain('Light on 14 June 2026');
    expect(html).not.toContain('Midnight sun');
  });
});
