/**
 * Builds each entity type's card meta-row content -- the one part of a card
 * that differs per type, which is why ui/components/entity-card.ts takes it
 * as a parameter. Shared between the dashboard's per-type sections
 * (travel-dashboard-view.ts) and the combined gallery
 * (travel-gallery-view.ts) so an entity reads the same on both.
 */
import { t } from '../../lang/I18nManager';
import { EntityCardMetaItem } from '../components/entity-card';
import { dateTimeDatePart } from '@technosoftware/trail-core';
import { shortUrl } from '../../shared/short-url';
import { capturedMotifCount, primaryMotif } from '../../places/photo-spot-note';
import { TravelCity, TravelCountry, TravelPlace, TravelState, TravelTrip } from '../../vault/types';
import { formatMoney } from '../../shared/display';

/**
 * A different icon when the visit was derived from a trip rather than
 * written into the note ('route' vs 'calendar-check'), so a flag the note
 * itself doesn't carry is visibly explained rather than appearing from
 * nowhere. See vault/visit-derivation.ts.
 */
function visitedMetaItem(
  visited: boolean,
  lastVisit: string | null,
  fromTrips: boolean
): EntityCardMetaItem {
  if (lastVisit) return { icon: fromTrips ? 'route' : 'calendar-check', text: lastVisit };
  return visited
    ? { icon: fromTrips ? 'route' : 'check-circle-2', text: t('dashboard.visited') }
    : { icon: 'circle', text: t('dashboard.notVisited') };
}

/** "City, Country" (or just whichever half is actually resolved) -- the same country/city hierarchy string used on Trip, City, and every place-type card. */
function hierarchyText(city: TravelCity | null, country: TravelCountry | null): string | null {
  const parts = [city?.title, country?.title].filter((x): x is string => !!x);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * `money` is optional and absent for a trip with no bookings, which is most
 * of them: a card that said "0.00" for every trip nobody has priced would be
 * a column of noise. Committed rather than planned-versus-committed, because
 * that comparison is a sentence and a card meta item is a chip.
 */
export function tripMetaItems(
  trip: TravelTrip,
  money?: { committed: number | null; currency: string } | null
): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  if (trip.country) items.push({ icon: 'flag', text: trip.country.title });
  if (trip.departure || trip.return) {
    // Date halves only: a card meta row has no room for clock times, and
    // the itinerary block in the note itself is where those belong.
    const range = [trip.departure, trip.return]
      .filter((d): d is string => !!d)
      .map(dateTimeDatePart)
      .join(' → ');
    items.push({ icon: 'calendar', text: range });
  }
  // effectiveStatus, so a trip that never had a status typed into it
  // still shows one rather than a gap -- see trip-note.ts.
  items.push({ icon: 'activity', text: t(`dashboard.stats.status${trip.effectiveStatus}`) });
  if (trip.personTitles.length > 0) {
    items.push({
      icon: 'users',
      text: t('dashboard.personCount', { count: trip.personTitles.length }),
    });
  }
  if (trip.stops.length > 0) {
    items.push({
      icon: 'route',
      text: t('dashboard.stopCount', { count: trip.stops.length }),
    });
  }
  if (money && money.committed !== null) {
    items.push({ icon: 'receipt', text: formatMoney(money.committed, money.currency) });
  }
  return items;
}

export function countryMetaItems(country: TravelCountry): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  if (country.capital) items.push({ icon: 'landmark', text: country.capital.title });
  if (country.states.length > 0) {
    items.push({
      icon: 'map',
      text: t('dashboard.stateCount', { count: country.states.length }),
    });
  }
  return items;
}

export function stateMetaItems(state: TravelState): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  if (state.country) items.push({ icon: 'flag', text: state.country.title });
  if (state.cities.length > 0) {
    items.push({
      icon: 'building-2',
      text: t('dashboard.cityCount', { count: state.cities.length }),
    });
  }
  return items;
}

export function cityMetaItems(city: TravelCity): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  const parts = [city.state?.title, city.country?.title].filter((x): x is string => !!x);
  if (parts.length > 0) items.push({ icon: 'flag', text: parts.join(', ') });
  items.push(visitedMetaItem(city.visited, city.lastVisit, city.visitedFromTrips));
  return items;
}

export function placeMetaItems(place: TravelPlace): EntityCardMetaItem[] {
  const items: EntityCardMetaItem[] = [];
  const hierarchy = hierarchyText(place.city, place.country);
  if (hierarchy) items.push({ icon: 'map-pin', text: hierarchy });
  const subtype = place.accommodationType ?? place.fnbType;
  if (subtype) items.push({ icon: 'tag', text: subtype });
  // A photo spot's card answers "what do I still owe myself here" before
  // anything else, so the capture count comes ahead of the visit state
  // rather than after it. The main motif's best light rides along, because
  // it is what decides whether a spot fits the day you are planning.
  if (place.kind === 'photospot' && place.photoSpot) {
    const spot = place.photoSpot;
    if (spot.motifs.length > 0) {
      items.push({
        icon: 'camera',
        text: t('photoSpot.capturedCount', {
          captured: capturedMotifCount(spot),
          total: spot.motifs.length,
        }),
      });
    }
    const light = primaryMotif(spot)?.light[0];
    if (light) items.push({ icon: 'sun', text: t(`photoSpot.light.${light}`) });
  }
  items.push(visitedMetaItem(place.visited, place.lastVisit, place.visitedFromTrips));
  // Address and website were sitting in the vault's own place notes,
  // unread by anything. They belong on a card: deciding where to go is
  // exactly when you want them, and the card is where that decision
  // happens. The row scrolls horizontally, so a long address doesn't
  // reflow the card.
  if (place.address) items.push({ icon: 'navigation', text: place.address });
  if (place.website) items.push({ icon: 'link', text: shortUrl(place.website) });
  return items;
}
