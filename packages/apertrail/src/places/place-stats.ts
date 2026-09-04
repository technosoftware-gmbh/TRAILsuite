/**
 * The Places half of the dashboard's derived stats: countries visited,
 * landmarks visited, and photo spots captured, each against its total.
 *
 * Takes a whole TravelBoard for the same reason trips/trip-stats.ts does:
 * countries-visited is derived from the trips that stop in them, so this
 * needs more than the places themselves.
 */
import { countryVisitInfo } from './country-visited';
import { captureState } from './photo-spot-note';
import { TravelBoard } from '../vault/types';

export interface PlaceDashboardStats {
  countriesVisitedCount: number;
  countriesTotalCount: number;
  landmarksVisitedCount: number;
  landmarksTotalCount: number;
  /** A photo spot counts as captured when every motif it names has been shot -- see the tile's own note in ui/place-stats-row.ts. */
  photoSpotsCapturedCount: number;
  photoSpotsTotalCount: number;
}

export function computePlaceStats(board: TravelBoard): PlaceDashboardStats {
  const countriesVisitedCount = board.countries.filter(
    (country) => countryVisitInfo(country, board).visited
  ).length;
  const landmarks = board.places.filter((place) => place.kind === 'landmark');
  const photoSpots = board.places.filter((place) => place.kind === 'photospot');

  return {
    countriesVisitedCount,
    countriesTotalCount: board.countries.length,
    landmarksVisitedCount: landmarks.filter((l) => l.visited).length,
    landmarksTotalCount: landmarks.length,
    // Captured, not visited. Being at a spot is not getting the picture,
    // and the whole point of the field is that the two come apart. A spot
    // with no motifs written down yet is not counted as captured: there is
    // nothing there to have captured.
    photoSpotsCapturedCount: photoSpots.filter(
      (spot) => spot.photoSpot !== null && captureState(spot.photoSpot) === 'full'
    ).length,
    photoSpotsTotalCount: photoSpots.length,
  };
}
