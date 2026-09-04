/**
 * The photo spot block's non-DOM logic: what order motifs render in, which
 * samples belong to which motif, and how far a motif sits from the note's
 * anchor. Pure, so it can be unit-tested -- the rendering itself is
 * App-dependent DOM building and is left untested, the same boundary
 * itinerary-days.ts draws for the itinerary block.
 */
import {
  bearing,
  compassPoint,
  CompassPoint,
  distanceKm,
  GeoPoint,
  parseGeoPoint,
} from 'trail-core';
import { ParsedPhotoSpot, ParsedPhotoSpotMotif, ParsedPhotoSpotSample } from './photo-spot-note';

export interface MotifOffset {
  km: number;
  compass: CompassPoint;
}

export interface MotifSection {
  motif: ParsedPhotoSpotMotif;
  /** Samples naming this motif, in note order. */
  samples: ParsedPhotoSpotSample[];
  /** Distance and direction from the note's own coordinates, or null when the motif has no coordinates of its own or the note has no anchor to measure from. */
  offset: MotifOffset | null;
}

export interface PhotoSpotView {
  sections: MotifSection[];
  /**
   * Samples whose `motif` matches no motif on the note, plus samples with
   * no motif at all. Rendered under the spot rather than dropped: an
   * unmatched name is a typo to notice, and dropping the frame would make
   * it look like the image had gone missing.
   */
  looseSamples: ParsedPhotoSpotSample[];
}

/**
 * Main motif first, then the rest in note order.
 *
 * Only the main one is promoted; the secondaries are NOT sorted among
 * themselves, because their order in the note is the order the person who
 * wrote it put them in, and on a real spot that tends to encode a route.
 */
export function orderedMotifs(spot: ParsedPhotoSpot): ParsedPhotoSpotMotif[] {
  const main = spot.motifs.filter((motif) => motif.role === 'main');
  const rest = spot.motifs.filter((motif) => motif.role !== 'main');
  return [...main, ...rest];
}

function offsetFor(anchor: GeoPoint | null, motif: ParsedPhotoSpotMotif): MotifOffset | null {
  const point = parseGeoPoint(motif.geoLocation);
  if (!anchor || !point) return null;
  const km = distanceKm(anchor, point);
  // Under 50 m the bearing is noise -- two coordinates pasted off a map at
  // different zoom levels differ by that much for the same spot -- so the
  // motif reads as "at the anchor" rather than "31 m ENE of it".
  if (km < 0.05) return null;
  return { km, compass: compassPoint(bearing(anchor, point)) };
}

/**
 * Everything the block needs to lay a spot out, in one pass.
 *
 * Samples are matched to motifs by name, case-insensitively and trimmed:
 * the name is typed twice (once on the motif, once on the sample) and
 * expecting those to match byte for byte would fail on a stray capital.
 */
export function photoSpotView(
  spot: ParsedPhotoSpot,
  anchor: [string, string] | null
): PhotoSpotView {
  const anchorPoint = parseGeoPoint(anchor);
  const motifs = orderedMotifs(spot);

  const key = (name: string | null): string => (name ?? '').trim().toLowerCase();
  const known = new Set(motifs.map((motif) => key(motif.name)).filter((name) => name !== ''));

  return {
    sections: motifs.map((motif) => ({
      motif,
      samples: spot.samples.filter(
        (sample) => key(sample.motifName) !== '' && key(sample.motifName) === key(motif.name)
      ),
      offset: offsetFor(anchorPoint, motif),
    })),
    looseSamples: spot.samples.filter((sample) => {
      const name = key(sample.motifName);
      return name === '' || !known.has(name);
    }),
  };
}
