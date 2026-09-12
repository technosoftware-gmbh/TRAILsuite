/**
 * The gallery's chip vocabulary: which entity types the grid shows, what
 * order their chips read in, which label each one carries, and which of them
 * answer none of the place facets.
 *
 * Split out of travel-gallery-view.ts so it can be checked without a live
 * Obsidian `ItemView`. That is not a technicality: the chip order was a
 * hand-typed array beside a hand-typed label map, and this package has
 * already shipped one bug of exactly that shape (a folder key missing from
 * the list in settings.test.ts that existed to catch it). Here the two lists
 * are checked against each other and against the type itself, so an entity
 * type added to the gallery and forgotten in one of them fails a test rather
 * than going quietly missing from the filter row.
 *
 * Bookings are the one travel type excluded. The gallery is image-first and
 * answers "where have I been"; a booking has no image, is not a place, and a
 * chip returning a grid of grey cards would make the gallery worse rather
 * than more complete. Its evidence lives in the trip's costs block instead.
 * See docs/design/trip-budget-and-bookings.md 7.5.
 */
import { CrmEntityType } from '../../crm/entity-types';
import { TravelEntityType } from '../../vault/entity-types';

export type GalleryTypeFilter = 'all' | Exclude<TravelEntityType, 'booking'> | CrmEntityType;

/**
 * The chips, left to right: everything, then a trip, then the places from
 * the widest down to the most specific, then what you travelled on, then who
 * you travelled with. Place kinds keep the order gallery-order.ts sorts them
 * in, so the default grid reads the way the filter row does.
 */
export const GALLERY_TYPE_FILTER_ORDER: GalleryTypeFilter[] = [
  'all',
  'trip',
  'country',
  'state',
  'city',
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
  'vehicle',
  'excursion',
  'person',
  'company',
];

export const TYPE_FILTER_LABEL_KEYS: Record<GalleryTypeFilter, string> = {
  all: 'galleryView.filters.all',
  trip: 'galleryView.filters.trip',
  country: 'galleryView.filters.country',
  state: 'galleryView.filters.state',
  city: 'galleryView.filters.city',
  accommodation: 'galleryView.filters.accommodation',
  fnb: 'galleryView.filters.fnb',
  landmark: 'galleryView.filters.landmark',
  location: 'galleryView.filters.location',
  photospot: 'galleryView.filters.photospot',
  vehicle: 'galleryView.filters.vehicle',
  excursion: 'galleryView.filters.excursion',
  person: 'galleryView.filters.person',
  company: 'galleryView.filters.company',
};

/**
 * Chips whose rows carry no country, no visit and no rating.
 *
 * `renderCommonFacets` builds its dropdowns from the rows in scope, so for
 * these types not one of the three is drawn -- which is why they can be in
 * the gallery at all. What it does not handle is a value carried IN from
 * another chip: pick Transport while "visited" is set and the grid is empty
 * with nothing on screen saying why. That is what the view clears against
 * this list.
 *
 * A list rather than a check over the rows in scope, because it has to
 * answer before the rows are built, and an empty folder would otherwise make
 * a type look facet-less for exactly as long as it stayed empty.
 */
export const TYPES_WITHOUT_PLACE_FACETS: GalleryTypeFilter[] = [
  'vehicle',
  // An excursion is the awkward one here and belongs on the list anyway. It
  // DOES have a country, unlike a ship, and its rows carry one so the `all`
  // chip can still filter on it. It answers neither of the other two: nothing
  // rates a tour on this note and nothing marks one visited, so drawing all
  // three dropdowns for its chip would offer two that empty the grid.
  'excursion',
  'person',
  'company',
];

/** Whether the three common facets mean anything for this chip. `all` answers yes: the grid then holds rows that do carry them. */
export function answersPlaceFacets(type: GalleryTypeFilter): boolean {
  return !TYPES_WITHOUT_PLACE_FACETS.includes(type);
}
