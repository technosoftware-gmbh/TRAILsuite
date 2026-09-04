/**
 * The two photo spot health warnings from docs/design/photo-spots.md §8.
 *
 * Both are warnings rather than errors, so what matters most here is what
 * they stay QUIET about: a half-filled spot, a sample with no motif name,
 * and a sample whose name differs only by case or spacing from a motif that
 * does exist. A check that fired on any of those would train its reader to
 * ignore it.
 */
import { describe, expect, it } from 'vitest';
import {
  impliedOffsetMinutes,
  photoSpotWarnings,
  timeZoneWarning,
} from '../src/vault/health/photo-spot-issues';
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

describe('more than one main motif', () => {
  it('warns and names every motif claiming the role', () => {
    const warnings = photoSpotWarnings(
      spot({
        motifs: [
          motif('Schloss', { role: 'main' }),
          motif('Pavillon', { role: 'main' }),
          motif('Steg'),
        ],
      })
    );
    expect(warnings).toHaveLength(1);
    const [warning] = warnings;
    expect(warning.kind).toBe('multipleMain');
    if (warning.kind !== 'multipleMain') return;
    expect(warning.names).toEqual(['Schloss', 'Pavillon']);
  });

  it('says nothing about exactly one main, or about none at all', () => {
    expect(photoSpotWarnings(spot({ motifs: [motif('Schloss', { role: 'main' })] }))).toEqual([]);
    expect(photoSpotWarnings(spot({ motifs: [motif('Schloss'), motif('Steg')] }))).toEqual([]);
  });
});

describe('a sample naming a motif that is not there', () => {
  it('warns, and carries the image so the row can name the frame', () => {
    const warnings = photoSpotWarnings(
      spot({ motifs: [motif('Schloss')], samples: [sample('Schlos', 'a.jpg')] })
    );
    expect(warnings).toHaveLength(1);
    const [warning] = warnings;
    expect(warning.kind).toBe('orphanSample');
    if (warning.kind !== 'orphanSample') return;
    expect(warning.motifName).toBe('Schlos');
    expect(warning.image).toBe('a.jpg');
  });

  // The block files samples under motifs case-insensitively and trimmed. A
  // stricter rule here would warn about frames the reader can plainly see
  // sitting under the right motif.
  it('agrees with the block about what counts as a match', () => {
    expect(
      photoSpotWarnings(
        spot({
          motifs: [motif('Château de Neuchâtel')],
          samples: [sample('  château de neuchâtel ')],
        })
      )
    ).toEqual([]);
  });

  // Rendered under the spot on purpose, so it is not a typo to report.
  it('stays quiet about a sample with no motif name at all', () => {
    expect(
      photoSpotWarnings(spot({ motifs: [motif('Schloss')], samples: [sample(null)] }))
    ).toEqual([]);
  });

  it('reports one warning per offending sample rather than one per note', () => {
    const warnings = photoSpotWarnings(
      spot({
        motifs: [motif('Schloss')],
        samples: [sample('Schlos', 'a.jpg'), sample('Pavillon', 'b.jpg')],
      })
    );
    expect(
      warnings.map((warning) => (warning.kind === 'orphanSample' ? warning.image : null))
    ).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('an ordinary, half-filled spot', () => {
  // The state most real notes are in for most of their life.
  it('earns no warnings', () => {
    expect(
      photoSpotWarnings(
        spot({
          motifs: [motif('Schloss', { role: 'main' }), motif('Pavillon')],
          samples: [sample('Schloss')],
        })
      )
    ).toEqual([]);
  });
});

describe('a spot abroad with no timezone', () => {
  const ICELAND = { lat: 64.14, lon: -21.94 };
  const BERN = { lat: 46.95, lon: 7.45 };
  const MADRID = { lat: 40.42, lon: -3.7 };
  // Central European Time, standard rather than summer: minutes east of UTC.
  const DEVICE = 60;

  it('warns, and names the offset the longitude suggests', () => {
    const warning = timeZoneWarning(spot(), ICELAND, DEVICE);
    expect(warning?.kind).toBe('missingTimeZone');
    if (warning?.kind !== 'missingTimeZone') return;
    expect(warning.impliedOffset).toBe('UTC-1');
  });

  // A vault used entirely at home should never see this row, or it becomes
  // a warning on every note and therefore no warning at all.
  it('says nothing about a spot in the same zone as the device', () => {
    expect(timeZoneWarning(spot(), BERN, DEVICE)).toBeNull();
  });

  it('says nothing when the note names a zone, wherever it is', () => {
    expect(timeZoneWarning(spot({ timezone: 'Atlantic/Reykjavik' }), ICELAND, DEVICE)).toBeNull();
  });

  // Without coordinates there is nothing to compare, and a spot nobody has
  // located yet is an ordinary half-filled note.
  it('says nothing about a spot with no coordinates', () => {
    expect(timeZoneWarning(spot(), null, DEVICE)).toBeNull();
  });

  // Spain runs an hour ahead of its own longitude. A threshold tight enough
  // to warn here would warn on every note in a Spanish vault, which is the
  // same as not warning at all.
  it('tolerates a country that runs ahead of its longitude', () => {
    expect(timeZoneWarning(spot(), MADRID, DEVICE)).toBeNull();
  });

  it('reads four minutes of sun per degree', () => {
    expect(impliedOffsetMinutes(7.45)).toBeCloseTo(29.8, 1);
    expect(impliedOffsetMinutes(-21.94)).toBeCloseTo(-87.8, 1);
    expect(impliedOffsetMinutes(139.7)).toBeCloseTo(558.8, 1);
  });
});
