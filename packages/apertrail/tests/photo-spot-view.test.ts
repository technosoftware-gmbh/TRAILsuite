/**
 * The photo spot block's non-DOM logic: motif order, which samples belong
 * to which motif, and how far each motif sits from the note's anchor. The
 * rendering itself is App-dependent DOM building and is left untested, the
 * same boundary itinerary-block.test.ts draws.
 */
import { describe, expect, it } from 'vitest';
import { orderedMotifs, photoSpotView } from '../src/places/photo-spot-view';
import {
  ParsedPhotoSpot,
  ParsedPhotoSpotMotif,
  ParsedPhotoSpotSample,
} from '../src/places/photo-spot-note';

function motif(
  name: string | null,
  overrides: Partial<ParsedPhotoSpotMotif> = {}
): ParsedPhotoSpotMotif {
  return {
    name,
    role: 'secondary',
    geoLocation: null,
    direction: null,
    light: [],
    season: [],
    lens: null,
    gear: [],
    technique: null,
    note: null,
    captured: false,
    capturedOn: null,
    ...overrides,
  };
}

function sample(motifName: string | null, image = 'frame.jpg'): ParsedPhotoSpotSample {
  return { image, motifName, light: null, exposure: null, credit: null };
}

function spot(overrides: Partial<ParsedPhotoSpot> = {}): ParsedPhotoSpot {
  return {
    timezone: null,
    openingHours: null,
    entryFee: null,
    accessibility: 'unknown',
    parking: null,
    transit: [],
    motifs: [],
    samples: [],
    ...overrides,
  };
}

describe('orderedMotifs', () => {
  it('promotes the main motif to the front', () => {
    const ordered = orderedMotifs(
      spot({ motifs: [motif('Pavillon'), motif('Schloss', { role: 'main' })] })
    );
    expect(ordered.map((m) => m.name)).toEqual(['Schloss', 'Pavillon']);
  });

  // Their order in the note is the order the person who wrote it put them
  // in, and on a real spot that tends to encode a route.
  it('leaves the secondaries in note order rather than sorting them', () => {
    const ordered = orderedMotifs(spot({ motifs: [motif('Steg'), motif('Grat'), motif('Bucht')] }));
    expect(ordered.map((m) => m.name)).toEqual(['Steg', 'Grat', 'Bucht']);
  });
});

describe('photoSpotView samples', () => {
  it('files each sample under the motif it names', () => {
    const view = photoSpotView(
      spot({
        motifs: [motif('Schloss'), motif('Pavillon')],
        samples: [sample('Pavillon', 'a.jpg'), sample('Schloss', 'b.jpg')],
      }),
      null
    );
    expect(view.sections[0].samples.map((s) => s.image)).toEqual(['b.jpg']);
    expect(view.sections[1].samples.map((s) => s.image)).toEqual(['a.jpg']);
    expect(view.looseSamples).toEqual([]);
  });

  // The name is typed twice, once on the motif and once on the sample.
  // Expecting those to match byte for byte would fail on a stray capital.
  it('matches motif names case-insensitively and ignoring surrounding space', () => {
    const view = photoSpotView(
      spot({
        motifs: [motif('Château de Neuchâtel')],
        samples: [sample('  château de neuchâtel ')],
      }),
      null
    );
    expect(view.sections[0].samples).toHaveLength(1);
    expect(view.looseSamples).toEqual([]);
  });

  it('keeps an unmatched sample under the spot rather than dropping the frame', () => {
    const view = photoSpotView(
      spot({ motifs: [motif('Schloss')], samples: [sample('Schlos'), sample(null)] }),
      null
    );
    expect(view.sections[0].samples).toEqual([]);
    expect(view.looseSamples).toHaveLength(2);
  });

  it('does not match a nameless motif against a nameless sample', () => {
    const view = photoSpotView(spot({ motifs: [motif(null)], samples: [sample(null)] }), null);
    expect(view.sections[0].samples).toEqual([]);
    expect(view.looseSamples).toHaveLength(1);
  });
});

describe('photoSpotView offsets', () => {
  const anchor: [string, string] = ['46.9899', '6.9293'];

  it('measures a motif that carries its own coordinates', () => {
    const view = photoSpotView(
      spot({ motifs: [motif('Pavillon', { geoLocation: ['46.9161', '6.8419'] })] }),
      anchor
    );
    expect(view.sections[0].offset?.km).toBeCloseTo(10.55, 1);
    expect(view.sections[0].offset?.compass).toBe('SW');
  });

  it('has no offset for a motif that inherits the note coordinates', () => {
    const view = photoSpotView(spot({ motifs: [motif('Schloss')] }), anchor);
    expect(view.sections[0].offset).toBeNull();
  });

  it('has no offset when the note itself has no anchor to measure from', () => {
    const view = photoSpotView(
      spot({ motifs: [motif('Pavillon', { geoLocation: ['46.9161', '6.8419'] })] }),
      null
    );
    expect(view.sections[0].offset).toBeNull();
  });

  // Two coordinates pasted off a map at different zoom levels differ by
  // tens of metres for the same spot, so a bearing there is noise.
  it('treats a motif within 50 m of the anchor as being at it', () => {
    const view = photoSpotView(
      spot({ motifs: [motif('Schloss', { geoLocation: ['46.99', '6.9293'] })] }),
      anchor
    );
    expect(view.sections[0].offset).toBeNull();
  });
});
