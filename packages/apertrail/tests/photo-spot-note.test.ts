/**
 * The pure build/parse half of the photo spot schema. write-photo-spot
 * .test.ts covers what lands on disk; this covers the frontmatter object
 * and, above all, that the two halves agree: most assertions here go
 * through a round trip of the builder's own output rather than a
 * hand-written fixture that could drift from what is really written.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import {
  buildPhotoSpotFrontmatter,
  capturedMotifCount,
  parsePhotoSpotDirection,
  parsePhotoSpotRecord,
  PhotoSpotFrontmatterInput,
  captureState,
  photoSpotManagedKeys,
  PhotoSpotMotifInput,
  photoSpotPropertyNames,
  primaryMotif,
} from '../src/places/photo-spot-note';

const properties = photoSpotPropertyNames(DEFAULT_SETTINGS);

function input(overrides: Partial<PhotoSpotFrontmatterInput> = {}): PhotoSpotFrontmatterInput {
  return {
    properties,
    timezone: null,
    openingHours: null,
    entryFee: null,
    accessibility: 'unknown',
    parking: null,
    transit: [],
    motifs: [],
    samples: [],
    modified: null,
    ...overrides,
  };
}

function motif(overrides: Partial<PhotoSpotMotifInput> = {}): PhotoSpotMotifInput {
  return {
    name: 'Château de Neuchâtel',
    role: 'main',
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

function roundTrip(built: Record<string, unknown>) {
  return parsePhotoSpotRecord({ properties, frontmatter: built });
}

describe('buildPhotoSpotFrontmatter', () => {
  it('writes nothing at all for a spot nobody has filled in yet', () => {
    expect(buildPhotoSpotFrontmatter(input())).toEqual({});
  });

  it('omits optional keys rather than writing them empty', () => {
    const built = buildPhotoSpotFrontmatter(
      input({ motifs: [motif({ name: 'Pavillon', light: ['sunrise'] })] })
    );
    // Two keys on the entry, not twelve nulls.
    const motifs = built.motifs as Record<string, unknown>[];
    expect(Object.keys(motifs[0]).sort()).toEqual(['light', 'name', 'role']);
    expect(built.samples).toBeUndefined();
    expect(built.transit).toBeUndefined();
    expect(built.parking).toBeUndefined();
  });

  it("writes no accessibility key for 'unknown', since that is the absence of an answer", () => {
    expect(buildPhotoSpotFrontmatter(input({ accessibility: 'unknown' })).accessibility).toBe(
      undefined
    );
    expect(buildPhotoSpotFrontmatter(input({ accessibility: 'none' })).accessibility).toBe('none');
  });

  it('writes captured only when true, and capturedOn only alongside it', () => {
    const notYet = buildPhotoSpotFrontmatter(
      input({ motifs: [motif({ captured: false, capturedOn: '2025-06-14' })] })
    );
    expect((notYet.motifs as Record<string, unknown>[])[0].captured).toBeUndefined();
    expect((notYet.motifs as Record<string, unknown>[])[0].capturedOn).toBeUndefined();

    const done = buildPhotoSpotFrontmatter(
      input({ motifs: [motif({ captured: true, capturedOn: '2025-06-14' })] })
    );
    expect((done.motifs as Record<string, unknown>[])[0].captured).toBe(true);
    expect((done.motifs as Record<string, unknown>[])[0].capturedOn).toBe('2025-06-14');
  });

  it('drops a nameless motif: the name is what a sample and the shot list point back at', () => {
    const built = buildPhotoSpotFrontmatter(
      input({ motifs: [motif({ name: '   ' }), motif({ name: 'Pavillon' })] })
    );
    expect((built.motifs as Record<string, unknown>[]).map((m) => m.name)).toEqual(['Pavillon']);
  });

  it('keeps a transit row that has only a detail, since "no direct connection" is worth writing down', () => {
    const built = buildPhotoSpotFrontmatter(
      input({
        transit: [
          { mode: null, detail: 'Keine direkte Bahnanbindung' },
          { mode: null, detail: null },
        ],
      })
    );
    expect(built.transit).toEqual([{ detail: 'Keine direkte Bahnanbindung' }]);
  });
});

describe('parsePhotoSpotRecord', () => {
  it('round-trips a fully populated spot through the builder without losing a field', () => {
    const original = input({
      timezone: 'Europe/Zurich',
      openingHours: '24h',
      entryFee: 'none',
      accessibility: 'partial',
      parking: 'Parkhaus du Seyon',
      transit: [{ mode: 'bus', detail: 'Linie 380, Haltestelle Écuse' }],
      motifs: [
        motif({
          name: 'Château de Neuchâtel',
          role: 'main',
          geoLocation: ['46.9895', '6.9243'],
          direction: 215,
          light: ['golden-hour-evening', 'blue-hour-evening'],
          season: [5, 6],
          lens: '70-200',
          gear: ['tripod'],
          technique: 'Langzeitbelichtung',
          note: 'Vom Chemin de la Boine',
          captured: true,
          capturedOn: '2025-06-14',
        }),
      ],
      samples: [
        {
          image: 'neuchatel-blue.jpg',
          motifName: 'Château de Neuchâtel',
          light: 'blue-hour-evening',
          exposure: '30s, f/11, ISO 100, ND1000',
          credit: 'Stefan',
        },
      ],
    });

    const parsed = roundTrip(buildPhotoSpotFrontmatter(original));

    expect(parsed.timezone).toBe('Europe/Zurich');
    expect(parsed.accessibility).toBe('partial');
    expect(parsed.parking).toBe('Parkhaus du Seyon');
    expect(parsed.transit).toEqual([{ mode: 'bus', detail: 'Linie 380, Haltestelle Écuse' }]);
    expect(parsed.motifs[0]).toEqual(original.motifs[0]);
    expect(parsed.samples[0]).toEqual(original.samples[0]);
  });

  it('reads an absent or unrecognized accessibility as unknown, never as none', () => {
    expect(parsePhotoSpotRecord({ properties, frontmatter: {} }).accessibility).toBe('unknown');
    expect(
      parsePhotoSpotRecord({ properties, frontmatter: { accessibility: 'teilweise' } })
        .accessibility
    ).toBe('unknown');
  });

  it('keeps a nameless motif on read, so a typo stays visible instead of looking like a deletion', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: [{ light: ['sunrise'] }] },
    });
    expect(parsed.motifs).toHaveLength(1);
    expect(parsed.motifs[0].name).toBeNull();
    expect(parsed.motifs[0].light).toEqual(['sunrise']);
  });

  it('treats a motif with no role as secondary rather than as a second headline act', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: [{ name: 'Pavillon' }] },
    });
    expect(parsed.motifs[0].role).toBe('secondary');
  });

  it('discards a light value outside the fixed vocabulary rather than passing it through', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: [{ name: 'X', light: ['sunrise', 'goldene-stunde-abends'] }] },
    });
    expect(parsed.motifs[0].light).toEqual(['sunrise']);
  });

  it('accepts a single scalar where a list is expected, which is what the property editor produces', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: [{ name: 'X', light: 'sunrise', gear: 'tripod' }] },
    });
    expect(parsed.motifs[0].light).toEqual(['sunrise']);
    expect(parsed.motifs[0].gear).toEqual(['tripod']);
  });

  it('drops a month outside 1-12 rather than clamping it: month 13 is a typo, not December', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: [{ name: 'X', season: [5, 13, 0, 'juni', '8'] }] },
    });
    expect(parsed.motifs[0].season).toEqual([5, 8]);
  });

  it('skips a list entry that is not an object rather than coercing it', () => {
    const parsed = parsePhotoSpotRecord({
      properties,
      frontmatter: { motifs: ['Schloss', { name: 'Pavillon' }], samples: 'not-a-list' },
    });
    expect(parsed.motifs.map((m) => m.name)).toEqual(['Pavillon']);
    expect(parsed.samples).toEqual([]);
  });

  it('honours renamed properties on both halves at once', () => {
    const renamed = { ...properties, motifsProperty: 'motive', motifNameField: 'bezeichnung' };
    const built = buildPhotoSpotFrontmatter({
      ...input({ motifs: [motif({ name: 'Pavillon' })] }),
      properties: renamed,
    });
    expect(built.motifs).toBeUndefined();
    expect((built.motive as Record<string, unknown>[])[0].bezeichnung).toBe('Pavillon');
    expect(parsePhotoSpotRecord({ properties: renamed, frontmatter: built }).motifs[0].name).toBe(
      'Pavillon'
    );
  });
});

describe('parsePhotoSpotDirection', () => {
  it('takes degrees as a number or a numeric string', () => {
    expect(parsePhotoSpotDirection(215)).toBe(215);
    expect(parsePhotoSpotDirection('215')).toBe(215);
    expect(parsePhotoSpotDirection(' 65 ')).toBe(65);
  });

  it('normalizes into [0, 360) rather than rejecting a wrapped bearing', () => {
    expect(parsePhotoSpotDirection(360)).toBe(0);
    expect(parsePhotoSpotDirection(400)).toBe(40);
    expect(parsePhotoSpotDirection(-45)).toBe(315);
  });

  it('accepts English compass points', () => {
    expect(parsePhotoSpotDirection('N')).toBe(0);
    expect(parsePhotoSpotDirection('sw')).toBe(225);
    expect(parsePhotoSpotDirection('ENE')).toBe(67.5);
  });

  // The one letter that differs between the two roses, and the reason a
  // German-written vault would otherwise lose every bearing it has.
  it('accepts German compass points, where O is Ost rather than an unknown token', () => {
    expect(parsePhotoSpotDirection('O')).toBe(90);
    expect(parsePhotoSpotDirection('ONO')).toBe(67.5);
    expect(parsePhotoSpotDirection('SSO')).toBe(157.5);
  });

  it('returns null for anything unusable rather than defaulting to north', () => {
    expect(parsePhotoSpotDirection('bergwärts')).toBeNull();
    expect(parsePhotoSpotDirection('')).toBeNull();
    expect(parsePhotoSpotDirection(null)).toBeNull();
    expect(parsePhotoSpotDirection(undefined)).toBeNull();
  });
});

describe('photoSpotManagedKeys', () => {
  // The boundary that keeps a motif edit from writing a derived visit into
  // the note. See the function's own comment.
  it('claims the photography keys and none of the shared place shape', () => {
    const managed = photoSpotManagedKeys(properties);
    expect(managed).toContain('motifs');
    expect(managed).toContain('samples');
    expect(managed).toContain('accessibility');
    for (const key of ['type', 'country', 'city', 'geoLocation', 'rating', 'visited', 'lastVisit'])
      expect(managed).not.toContain(key);
  });
});

describe('captureState', () => {
  const withMotifs = (flags: boolean[]) =>
    roundTrip(
      buildPhotoSpotFrontmatter(
        input({ motifs: flags.map((captured, i) => motif({ name: `M${i}`, captured })) })
      )
    );

  it('reads none, partial and full off the motifs', () => {
    expect(captureState(withMotifs([false, false]))).toBe('none');
    expect(captureState(withMotifs([true, false]))).toBe('partial');
    expect(captureState(withMotifs([true, true]))).toBe('full');
  });

  // A spot whose motifs nobody has written down yet is not a spot you owe
  // pictures at, so it is its own answer rather than folded into "none".
  it('calls a spot with no motifs empty rather than uncaptured', () => {
    expect(captureState(withMotifs([]))).toBe('empty');
  });
});

describe('primaryMotif and capturedMotifCount', () => {
  it('prefers the first main motif', () => {
    const spot = roundTrip(
      buildPhotoSpotFrontmatter(
        input({
          motifs: [
            motif({ name: 'Pavillon', role: 'secondary' }),
            motif({ name: 'Schloss', role: 'main' }),
          ],
        })
      )
    );
    expect(primaryMotif(spot)?.name).toBe('Schloss');
  });

  it('falls back to the first motif when none claims the role, since one unmarked motif is still a motif', () => {
    const spot = roundTrip(
      buildPhotoSpotFrontmatter(input({ motifs: [motif({ name: 'Pavillon', role: 'secondary' })] }))
    );
    expect(primaryMotif(spot)?.name).toBe('Pavillon');
  });

  it('returns null for a spot with no motifs at all', () => {
    expect(primaryMotif(roundTrip({}))).toBeNull();
  });

  it('counts only the motifs actually shot', () => {
    const spot = roundTrip(
      buildPhotoSpotFrontmatter(
        input({
          motifs: [
            motif({ name: 'Schloss', captured: true }),
            motif({ name: 'Pavillon', captured: false }),
          ],
        })
      )
    );
    expect(capturedMotifCount(spot)).toBe(1);
    expect(spot.motifs).toHaveLength(2);
  });
});
