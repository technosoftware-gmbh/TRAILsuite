/**
 * APERtrail's home view, and its only one: the greeting, the creation
 * buttons, the stat tiles, and a filterable grid over every entity type the
 * plugin knows, travel and CRM alike.
 *
 * It began as the "browse all" destination behind every dashboard section's
 * footer button. On 2 September 2026 the two dashboards folded into it. Each
 * had turned into a launcher for this view -- every stat tile and every
 * section footer opened it -- and a strip capped at six cards under a heading
 * counting forty is a worse answer than the grid it was linking to. What the
 * dashboards genuinely carried came with them: the greeting, the tiles, and
 * the per-type orderings in ui/dashboard/travel-entity-sort.ts, which are the
 * grid's default sort rather than a fourth thing to choose.
 *
 * The tiles filter the grid in place. Nothing here opens a second view, which
 * is the whole point of there being one.
 *
 * Deliberately manual-refresh only: travel notes don't change often enough to
 * justify a live metadataCache subscription.
 */
import { ItemView, TFile, WorkspaceLeaf, prepareFuzzySearch } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { renderEntityCard } from '../components/entity-card';
import { readTravelBoard } from '../../vault/read-entities';
import { APERtrailSettings } from '../../settings/types';
import { committedForCard } from '../../trips/costs/totals';
import { TravelEntityType } from '../../vault/entity-types';
import { CrmEntityType } from '../../crm/entity-types';
import { readCrmBoard } from '../../crm/read-crm';
import { companyMetaItems, personMetaItems } from '../../crm/ui/crm-entity-meta';
import {
  isTravelStatusValue,
  TRAVEL_STATUS_VALUES,
  TravelStatusValue,
} from '../../trips/trip-note';
import { TravelBoard, TravelPhotoSpotDetail, TravelTrip } from '../../vault/types';
import {
  cityMetaItems,
  countryMetaItems,
  placeMetaItems,
  stateMetaItems,
  tripMetaItems,
} from '../dashboard/travel-entity-meta';
import { TravelGalleryViewDeps } from './travel-gallery-view-deps';
import { renderGreeting } from '../components/greeting';
import { DashboardActionButton, renderDashboardActionBar } from '../dashboard/dashboard-action-bar';
import { createStatsRow } from '../dashboard/stat-card';
import { renderTripStatsRow } from '../../trips/ui/trip-stats-row';
import { renderPlaceStatsRow } from '../../places/ui/place-stats-row';
import { computeTripStats } from '../../trips/trip-stats';
import { computePlaceStats } from '../../places/place-stats';
import { compareByRank, defaultGalleryRanks } from './gallery-order';
import { CrmBoard } from '../../crm/types';
import {
  captureState,
  PhotoSpotCaptureState,
  PHOTO_SPOT_ACCESSIBILITY_VALUES,
  PHOTO_SPOT_LIGHT_WINDOWS,
} from '../../places/photo-spot-note';
import { formatMonthName } from '../../shared/display';

export const TRAVEL_GALLERY_VIEW_TYPE = 'apertrail-gallery-view';

/** Spans both modules: the gallery is the one view that does not belong to a single one. */
/**
 * Bookings are excluded on purpose.
 *
 * The gallery is image-first and answers "where have I been". A booking has
 * no image, is not a place, and a tenth chip returning a grid of grey cards
 * would make the gallery worse rather than more complete. Its evidence lives
 * in the trip's costs block instead. See
 * docs/design/trip-budget-and-bookings.md §7.5.
 */
export type GalleryTypeFilter = 'all' | Exclude<TravelEntityType, 'booking'> | CrmEntityType;

/**
 * A gallery row. The facet fields below are null/empty for entity types
 * that don't carry them (a Country has no rating, a State no visit) --
 * an active facet then excludes those rows, which is the honest answer:
 * "places I've visited" should not list a country.
 */
interface TravelGalleryEntry {
  file: TFile;
  title: string;
  type: TravelEntityType | CrmEntityType;
  rating: number | null;
  metaItems: ReturnType<typeof tripMetaItems>;
  /** Set on Trip entries only -- the Trip-specific facets read these, and every other entity type is excluded when one is active. */
  trip: TravelTrip | null;
  /** Set on photo spot entries only, same arrangement as `trip` above. */
  photoSpot: TravelPhotoSpotDetail | null;
  countryTitle: string | null;
  /** null where the entity type has no notion of being visited. */
  visited: boolean | null;
  lastVisit: string | null;
  tags: string[];
}

export type TravelGallerySort = 'default' | 'title' | 'rating' | 'lastVisit';

const SORT_LABEL_KEYS: Record<TravelGallerySort, string> = {
  default: 'galleryView.facets.sortDefault',
  title: 'galleryView.facets.sortTitle',
  rating: 'galleryView.facets.sortRating',
  lastVisit: 'galleryView.facets.sortLastVisit',
};

const TYPE_FILTER_LABEL_KEYS: Record<GalleryTypeFilter, string> = {
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
  person: 'galleryView.filters.person',
  company: 'galleryView.filters.company',
};

/** The trip's committed total for its card, from the shared helper, so a card here and the costs block in that trip's note cannot disagree. */
function tripCardMoney(
  board: TravelBoard,
  trip: TravelTrip,
  settings: APERtrailSettings
): { committed: number | null; currency: string } | null {
  if (!settings.budgetEnabled) return null;
  return committedForCard({
    bookings: board.bookings.filter((booking) => booking.tripTitle === trip.title),
    budget: [],
    rates: trip.rates
      .filter((rate) => rate.rate !== null)
      .map((rate) => ({ currency: rate.currency, rate: rate.rate })),
    currency: trip.currency ?? settings.homeCurrency,
  });
}

export class TravelGalleryView extends ItemView {
  private search = '';
  private typeFilter: GalleryTypeFilter = 'all';
  // Trip-only facets, designed in travel-module-plan.md §6 and finally
  // buildable now that trips carry real statuses and participants. Only
  // rendered (and only applied) while the type filter is on Trip -- they
  // are meaningless for a Country, and showing four dead dropdowns on
  // every other filter would be noise.
  private statusFilter: TravelStatusValue | 'all' = 'all';
  private reviewStatusFilter = 'all';
  private personFilter = 'all';
  // Facets that apply to every entity type carrying the underlying field,
  // from travel-module-plan.md §6. Unlike the Trip-only three above these
  // stay applied across a type-filter change, since "everything I've
  // rated 4+ in Switzerland" is a question worth asking of one type and
  // then another.
  // Photo-spot-only facets, cleared on the way out of that type filter for
  // the same reason the Trip ones are: a filter you cannot see is a filter
  // you have forgotten about.
  private lightFilter = 'all';
  private seasonFilter = 'all';
  private captureFilter: 'all' | PhotoSpotCaptureState = 'all';
  private accessibilityFilter = 'all';
  private samplesFilter: 'all' | 'with' = 'all';
  private countryFilter = 'all';
  private visitedFilter: 'all' | 'visited' | 'unvisited' = 'all';
  private minRating = 0;
  private tagFilter = 'all';
  private sort: TravelGallerySort = 'default';

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: TravelGalleryViewDeps
  ) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return TRAVEL_GALLERY_VIEW_TYPE;
  }
  getDisplayText(): string {
    return t('galleryView.displayName');
  }
  getIcon(): string {
    return 'map';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  /** Re-reads the vault and redraws -- called by the plugin's refreshAllTravelViews() after a creation or edit modal closes. */
  refresh(): void {
    this.render();
  }

  /** Called by the stat tiles above the grid, by the type chips, and by the open-gallery command's optional type argument. */
  applyTypeFilter(type: GalleryTypeFilter): void {
    this.typeFilter = type;
    if (type !== 'trip') {
      // Clear the Trip facets on the way out, so switching to Countries
      // and back doesn't silently reapply a filter that has been invisible
      // in the meantime.
      this.statusFilter = 'all';
      this.reviewStatusFilter = 'all';
      this.personFilter = 'all';
    }
    if (type !== 'photospot') {
      this.lightFilter = 'all';
      this.seasonFilter = 'all';
      this.captureFilter = 'all';
      this.accessibilityFilter = 'all';
      this.samplesFilter = 'all';
    }
    this.render();
  }

  /** Called by the open-gallery command when it is given a query to start from. */
  applySearchFilter(search: string): void {
    this.search = search;
    this.render();
  }

  private buildEntries(board: TravelBoard, crmBoard: CrmBoard): TravelGalleryEntry[] {
    const settings = this.deps.getSettings();
    const entries: TravelGalleryEntry[] = [
      ...board.trips.map((trip) => ({
        file: trip.file,
        title: trip.title,
        type: 'trip' as const,
        rating: trip.rating,
        metaItems: tripMetaItems(trip, tripCardMoney(board, trip, settings)),
        trip,
        photoSpot: null,
        countryTitle: trip.country?.title ?? null,
        visited: null,
        lastVisit: null,
        tags: [],
      })),
      ...board.countries.map((country) => ({
        file: country.file,
        title: country.title,
        type: 'country' as const,
        rating: null,
        trip: null,
        photoSpot: null,
        metaItems: countryMetaItems(country),
        countryTitle: country.title,
        visited: null,
        lastVisit: null,
        tags: [],
      })),
      ...board.states.map((state) => ({
        file: state.file,
        title: state.title,
        type: 'state' as const,
        rating: null,
        trip: null,
        photoSpot: null,
        metaItems: stateMetaItems(state),
        countryTitle: state.country?.title ?? null,
        visited: null,
        lastVisit: null,
        tags: [],
      })),
      ...board.cities.map((city) => ({
        file: city.file,
        title: city.title,
        type: 'city' as const,
        rating: null,
        trip: null,
        photoSpot: null,
        metaItems: cityMetaItems(city),
        countryTitle: city.country?.title ?? null,
        visited: city.visited,
        lastVisit: city.lastVisit,
        tags: city.tags,
      })),
      ...board.places.map((place) => ({
        file: place.file,
        title: place.title,
        type: place.kind,
        rating: place.rating,
        metaItems: placeMetaItems(place),
        trip: null,
        photoSpot: place.photoSpot,
        countryTitle: place.country?.title ?? null,
        visited: place.visited,
        lastVisit: place.lastVisit,
        tags: place.tags,
      })),
      // CRM rows carry no rating, no visit and no country, so every facet
      // built on those excludes them -- which is the honest answer, the
      // same one a Country gets from the visited facet.
      ...crmBoard.persons.map((person) => ({
        file: person.file,
        title: person.title,
        type: 'person' as const,
        rating: null,
        metaItems: personMetaItems(person),
        trip: null,
        photoSpot: null,
        countryTitle: null,
        visited: null,
        lastVisit: null,
        tags: person.tags,
      })),
      ...crmBoard.companies.map((company) => ({
        file: company.file,
        title: company.title,
        type: 'company' as const,
        rating: null,
        metaItems: companyMetaItems(company),
        trip: null,
        photoSpot: null,
        countryTitle: null,
        visited: null,
        lastVisit: null,
        tags: company.tags,
      })),
    ];
    return entries.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * One button per creatable type, ordered by how often you reach for it,
   * which is roughly the inverse of how high the entity sits in the
   * geographic hierarchy: Trip, then the five place types, then City, State,
   * Country.
   *
   * Photo spot leads the places: on a planner whose whole point is
   * photography, it is the button reached for first, not fifth. City and
   * State have buttons of their own even though the plan (§7) left them to
   * their commands -- both turn up mid-planning, since a trip's cities: list
   * cannot point at a City note that does not exist yet -- and the ordering
   * carries the "rarely needed" signal instead.
   */
  private actionButtons(): DashboardActionButton[] {
    return [
      { icon: 'plane', label: t('dashboard.newTrip'), onClick: this.deps.openNewTripModal },
      {
        icon: 'camera',
        label: t('dashboard.newPhotoSpot'),
        onClick: this.deps.openNewPhotoSpotModal,
      },
      {
        icon: 'bed',
        label: t('dashboard.newAccommodation'),
        onClick: this.deps.openNewAccommodationModal,
      },
      {
        icon: 'landmark',
        label: t('dashboard.newLandmark'),
        onClick: this.deps.openNewLandmarkModal,
      },
      { icon: 'utensils', label: t('dashboard.newFnb'), onClick: this.deps.openNewFnbModal },
      {
        icon: 'map-pin',
        label: t('dashboard.newLocation'),
        onClick: this.deps.openNewLocationModal,
      },
      { icon: 'building-2', label: t('dashboard.newCity'), onClick: this.deps.openNewCityModal },
      { icon: 'map', label: t('dashboard.newState'), onClick: this.deps.openNewStateModal },
      { icon: 'flag', label: t('dashboard.newCountry'), onClick: this.deps.openNewCountryModal },
    ];
  }

  /** The five tiles the two dashboards used to carry, over the same board the grid below is built from. */
  private renderStats(container: HTMLElement, board: TravelBoard): void {
    const row = createStatsRow(container.createDiv({ cls: 'apt-dashboard-grid' }));
    renderTripStatsRow(row, computeTripStats(board, this.deps.getSettings().homeCurrency), {
      showType: (typeFilter) => this.applyTypeFilter(typeFilter),
      openFile: (file: TFile) => this.deps.openFile(file.path),
    });
    renderPlaceStatsRow(row, computePlaceStats(board), {
      showType: (typeFilter) => this.applyTypeFilter(typeFilter),
    });
  }

  /** Applies the current sort. Title is always the tiebreak, so the order is stable rather than dependent on read order. */
  private sortEntries(
    entries: TravelGalleryEntry[],
    ranks: Map<string, number>
  ): TravelGalleryEntry[] {
    const byTitle = (a: TravelGalleryEntry, b: TravelGalleryEntry): number =>
      a.title.localeCompare(b.title);
    if (this.sort === 'title') return [...entries].sort(byTitle);
    if (this.sort === 'default') {
      return [...entries].sort((a, b) => compareByRank(ranks, a, b));
    }
    return [...entries].sort((a, b) => {
      if (this.sort === 'rating') {
        // Unrated sorts last rather than as zero -- "no opinion yet" is
        // not the same claim as "one star".
        if (a.rating !== null && b.rating !== null && a.rating !== b.rating) {
          return b.rating - a.rating;
        }
        if (a.rating !== null && b.rating === null) return -1;
        if (a.rating === null && b.rating !== null) return 1;
        return byTitle(a, b);
      }
      if (a.lastVisit && b.lastVisit && a.lastVisit !== b.lastVisit) {
        return b.lastVisit.localeCompare(a.lastVisit);
      }
      if (a.lastVisit && !b.lastVisit) return -1;
      if (!a.lastVisit && b.lastVisit) return 1;
      return byTitle(a, b);
    });
  }

  private renderTypeFilters(container: HTMLElement): void {
    const wrap = container.createDiv({ cls: 'apt-gallery-type-filters' });
    const options: GalleryTypeFilter[] = [
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
      'person',
      'company',
    ];
    for (const value of options) {
      const btn = wrap.createEl('button', {
        cls: 'apt-gallery-type-filter-btn',
        text: t(TYPE_FILTER_LABEL_KEYS[value]),
      });
      btn.toggleClass('is-active', this.typeFilter === value);
      btn.addEventListener('click', () => this.applyTypeFilter(value));
    }
  }

  /** One labelled dropdown. Returns the element so callers can set an initial value without threading it through. */
  private facetSelect(
    wrap: HTMLElement,
    allLabel: string,
    values: string[],
    current: string,
    onChange: (value: string) => void
  ): void {
    const select = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
    select.createEl('option', { attr: { value: 'all' }, text: allLabel });
    for (const value of values) select.createEl('option', { attr: { value }, text: value });
    // Round-trip a value that's no longer offered (a country whose last
    // place was retyped, say) rather than silently resetting the filter
    // and showing more than was asked for.
    if (current !== 'all' && !values.includes(current)) {
      select.createEl('option', { attr: { value: current }, text: current });
    }
    select.value = current;
    select.addEventListener('change', () => onChange(select.value));
  }

  /**
   * Facets that apply to any entity type carrying the field. Values come
   * from the entries currently in scope, so the dropdowns only ever offer
   * something that would actually match -- and a facet with nothing to
   * offer isn't rendered at all.
   */
  private renderCommonFacets(container: HTMLElement, entries: TravelGalleryEntry[]): void {
    const wrap = container.createDiv({ cls: 'apt-gallery-facets' });

    const countries = [
      ...new Set(entries.map((e) => e.countryTitle).filter((c): c is string => !!c)),
    ].sort();
    if (countries.length > 1) {
      this.facetSelect(
        wrap,
        t('galleryView.facets.anyCountry'),
        countries,
        this.countryFilter,
        (value) => {
          this.countryFilter = value;
          this.render();
        }
      );
    }

    // Only offered when some entry in scope can actually be visited --
    // filtering Countries and States by visit state would always be empty.
    if (entries.some((e) => e.visited !== null)) {
      const visitedSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      visitedSelect.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anyVisited'),
      });
      visitedSelect.createEl('option', {
        attr: { value: 'visited' },
        text: t('galleryView.facets.visited'),
      });
      visitedSelect.createEl('option', {
        attr: { value: 'unvisited' },
        text: t('galleryView.facets.unvisited'),
      });
      visitedSelect.value = this.visitedFilter;
      visitedSelect.addEventListener('change', () => {
        const value = visitedSelect.value;
        this.visitedFilter = value === 'visited' || value === 'unvisited' ? value : 'all';
        this.render();
      });
    }

    if (entries.some((e) => e.rating !== null)) {
      const ratingSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      ratingSelect.createEl('option', {
        attr: { value: '0' },
        text: t('galleryView.facets.anyRating'),
      });
      for (const value of [1, 2, 3, 4, 5]) {
        ratingSelect.createEl('option', {
          attr: { value: String(value) },
          text: t('galleryView.facets.minRating', { stars: '★'.repeat(value) }),
        });
      }
      ratingSelect.value = String(this.minRating);
      ratingSelect.addEventListener('change', () => {
        this.minRating = Number(ratingSelect.value) || 0;
        this.render();
      });
    }

    const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
    if (tags.length > 0) {
      this.facetSelect(wrap, t('galleryView.facets.anyTag'), tags, this.tagFilter, (value) => {
        this.tagFilter = value;
        this.render();
      });
    }

    const sortSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
    for (const value of Object.keys(SORT_LABEL_KEYS) as TravelGallerySort[]) {
      sortSelect.createEl('option', { attr: { value }, text: t(SORT_LABEL_KEYS[value]) });
    }
    sortSelect.value = this.sort;
    sortSelect.addEventListener('change', () => {
      const value = sortSelect.value;
      // Anything unrecognised lands back on the default rather than on the
      // title, so a stale option in a restored select cannot quietly change
      // what the grid means.
      this.sort =
        value === 'title' || value === 'rating' || value === 'lastVisit' ? value : 'default';
      this.render();
    });
  }

  private applyCommonFacets(entries: TravelGalleryEntry[]): TravelGalleryEntry[] {
    let result = entries;
    if (this.countryFilter !== 'all') {
      result = result.filter((e) => e.countryTitle === this.countryFilter);
    }
    if (this.visitedFilter !== 'all') {
      const want = this.visitedFilter === 'visited';
      result = result.filter((e) => e.visited === want);
    }
    if (this.minRating > 0) {
      result = result.filter((e) => e.rating !== null && e.rating >= this.minRating);
    }
    if (this.tagFilter !== 'all') {
      result = result.filter((e) => e.tags.includes(this.tagFilter));
    }
    return result;
  }

  /** Distinct values actually present on the vault's trips -- an empty dropdown is worse than no dropdown, so a facet with nothing to offer isn't rendered. */
  private renderTripFilters(container: HTMLElement, entries: TravelGalleryEntry[]): void {
    const trips = entries.map((e) => e.trip).filter((t): t is TravelTrip => t !== null);
    const wrap = container.createDiv({ cls: 'apt-gallery-facets' });

    const statusSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
    statusSelect.createEl('option', {
      attr: { value: 'all' },
      text: t('galleryView.facets.anyStatus'),
    });
    for (const status of TRAVEL_STATUS_VALUES) {
      statusSelect.createEl('option', {
        attr: { value: status },
        text: t(`dashboard.stats.status${status}`),
      });
    }
    statusSelect.value = this.statusFilter;
    statusSelect.addEventListener('change', () => {
      this.statusFilter = isTravelStatusValue(statusSelect.value) ? statusSelect.value : 'all';
      this.render();
    });

    const reviewValues = [
      ...new Set(trips.map((t) => t.reviewStatus).filter((v): v is string => !!v)),
    ].sort();
    if (reviewValues.length > 0) {
      const reviewSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      reviewSelect.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anyReviewStatus'),
      });
      for (const value of reviewValues) {
        reviewSelect.createEl('option', { attr: { value }, text: value });
      }
      reviewSelect.value = this.reviewStatusFilter;
      reviewSelect.addEventListener('change', () => {
        this.reviewStatusFilter = reviewSelect.value;
        this.render();
      });
    }

    const personValues = [...new Set(trips.flatMap((t) => t.personTitles))].sort();
    if (personValues.length > 0) {
      const personSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      personSelect.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anyPerson'),
      });
      for (const value of personValues) {
        personSelect.createEl('option', { attr: { value }, text: value });
      }
      personSelect.value = this.personFilter;
      personSelect.addEventListener('change', () => {
        this.personFilter = personSelect.value;
        this.render();
      });
    }
  }

  /**
   * Facets that only mean something for a photo spot. Rendered only while
   * that type filter is on, and each one built from the values actually
   * present in scope, so the row never offers a filter that would match
   * nothing -- the same rule the common facets follow.
   */
  private renderPhotoSpotFilters(container: HTMLElement, entries: TravelGalleryEntry[]): void {
    const spots = entries
      .map((e) => e.photoSpot)
      .filter((spot): spot is TravelPhotoSpotDetail => spot !== null);
    if (spots.length === 0) return;
    const wrap = container.createDiv({ cls: 'apt-gallery-facets' });

    // Offered in the vocabulary's own day order rather than alphabetically:
    // "blue hour, sunrise, golden hour" is the order a photographer thinks
    // in, and sorting it would scatter the morning across the list.
    const lights = PHOTO_SPOT_LIGHT_WINDOWS.filter((window) =>
      spots.some((spot) => spot.motifs.some((motif) => motif.light.includes(window)))
    );
    if (lights.length > 1) {
      const select = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      select.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anyLight'),
      });
      for (const window of lights) {
        select.createEl('option', {
          attr: { value: window },
          text: t(`photoSpot.light.${window}`),
        });
      }
      select.value = this.lightFilter;
      select.addEventListener('change', () => {
        this.lightFilter = select.value;
        this.render();
      });
    }

    const months = [
      ...new Set(spots.flatMap((spot) => spot.motifs.flatMap((motif) => motif.season))),
    ].sort((a, b) => a - b);
    if (months.length > 1) {
      const select = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      select.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anySeason'),
      });
      for (const month of months) {
        select.createEl('option', { attr: { value: String(month) }, text: formatMonthName(month) });
      }
      select.value = this.seasonFilter;
      select.addEventListener('change', () => {
        this.seasonFilter = select.value;
        this.render();
      });
    }

    const select = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
    select.createEl('option', {
      attr: { value: 'all' },
      text: t('galleryView.facets.anyCapture'),
    });
    for (const state of ['full', 'partial', 'none'] as const) {
      select.createEl('option', {
        attr: { value: state },
        text: t(`galleryView.facets.capture.${state}`),
      });
    }
    select.value = this.captureFilter;
    select.addEventListener('change', () => {
      const value = select.value;
      this.captureFilter =
        value === 'full' || value === 'partial' || value === 'none' ? value : 'all';
      this.render();
    });

    const accessibilities = PHOTO_SPOT_ACCESSIBILITY_VALUES.filter(
      (value) => value !== 'unknown' && spots.some((spot) => spot.accessibility === value)
    );
    if (accessibilities.length > 0) {
      const accessSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      accessSelect.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anyAccessibility'),
      });
      for (const value of accessibilities) {
        accessSelect.createEl('option', {
          attr: { value },
          text: t(`photoSpot.accessibilityValue.${value}`),
        });
      }
      accessSelect.value = this.accessibilityFilter;
      accessSelect.addEventListener('change', () => {
        this.accessibilityFilter = accessSelect.value;
        this.render();
      });
    }

    if (spots.some((spot) => spot.samples.length > 0)) {
      const sampleSelect = wrap.createEl('select', { cls: 'apt-gallery-facet-select' });
      sampleSelect.createEl('option', {
        attr: { value: 'all' },
        text: t('galleryView.facets.anySamples'),
      });
      sampleSelect.createEl('option', {
        attr: { value: 'with' },
        text: t('galleryView.facets.withSamples'),
      });
      sampleSelect.value = this.samplesFilter;
      sampleSelect.addEventListener('change', () => {
        this.samplesFilter = sampleSelect.value === 'with' ? 'with' : 'all';
        this.render();
      });
    }
  }

  private applyPhotoSpotFilters(entries: TravelGalleryEntry[]): TravelGalleryEntry[] {
    let result = entries;
    if (this.lightFilter !== 'all') {
      result = result.filter((e) =>
        e.photoSpot?.motifs.some((motif) =>
          (motif.light as readonly string[]).includes(this.lightFilter)
        )
      );
    }
    if (this.seasonFilter !== 'all') {
      const month = Number(this.seasonFilter);
      result = result.filter((e) =>
        e.photoSpot?.motifs.some((motif) => motif.season.includes(month))
      );
    }
    if (this.captureFilter !== 'all') {
      result = result.filter(
        (e) => e.photoSpot && captureState(e.photoSpot) === this.captureFilter
      );
    }
    if (this.accessibilityFilter !== 'all') {
      result = result.filter((e) => e.photoSpot?.accessibility === this.accessibilityFilter);
    }
    if (this.samplesFilter === 'with') {
      result = result.filter((e) => (e.photoSpot?.samples.length ?? 0) > 0);
    }
    return result;
  }

  /**
   * Actions, search, greeting, tiles, chips, facets, grid -- in that order.
   *
   * The order is the one all three plugins share: what you can do, what you
   * can find, then who you are and what day it is, then the content. The
   * tiles sit above the chips because a tile sets the chip; the facets sit
   * below both because which facets exist depends on which chip is active.
   */
  private render(): void {
    // Read the outgoing search box before the redraw discards it: whether it
    // had focus, and where the caret was, are facts about the document that
    // nothing else is left to remember. Filtering happens on every keystroke,
    // so without this the box loses focus after one character.
    const outgoing = this.contentEl.querySelector('.apt-dashboard-search-input');
    const previousSearch = outgoing?.instanceOf(HTMLInputElement) ? outgoing : null;
    const restoreSearchFocus =
      !!previousSearch && this.contentEl.ownerDocument.activeElement === previousSearch;
    const selectionStart = previousSearch?.selectionStart ?? null;
    const selectionEnd = previousSearch?.selectionEnd ?? null;

    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('apt-dashboard-view');

    const searchInput = renderDashboardActionBar(contentEl, {
      searchPlaceholder: t('galleryView.searchPlaceholder'),
      searchValue: this.search,
      onSearch: (query) => {
        this.search = query;
        this.render();
      },
      buttons: this.actionButtons(),
      refreshLabel: t('dashboard.refresh'),
      onRefresh: () => this.render(),
    });
    renderGreeting(contentEl);

    const settings = this.deps.getSettings();
    const board = readTravelBoard(this.app, settings);
    const crmBoard = readCrmBoard(this.app, settings);

    const content = contentEl.createDiv({ cls: 'apt-gallery-content' });
    this.renderStats(content, board);

    this.renderTypeFilters(content);

    if (restoreSearchFocus) {
      searchInput.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        searchInput.setSelectionRange(selectionStart, selectionEnd);
      }
    }

    let entries = this.buildEntries(board, crmBoard);
    if (this.typeFilter !== 'all') {
      entries = entries.filter((e) => e.type === this.typeFilter);
    }
    this.renderCommonFacets(content, entries);
    entries = this.applyCommonFacets(entries);

    if (this.typeFilter === 'trip') {
      this.renderTripFilters(content, entries);
      if (this.statusFilter !== 'all') {
        entries = entries.filter((e) => e.trip?.effectiveStatus === this.statusFilter);
      }
      if (this.reviewStatusFilter !== 'all') {
        entries = entries.filter((e) => e.trip?.reviewStatus === this.reviewStatusFilter);
      }
      if (this.personFilter !== 'all') {
        entries = entries.filter((e) => e.trip?.personTitles.includes(this.personFilter));
      }
    }
    if (this.typeFilter === 'photospot') {
      this.renderPhotoSpotFilters(content, entries);
      entries = this.applyPhotoSpotFilters(entries);
    }
    if (this.search.trim()) {
      const fuzzy = prepareFuzzySearch(this.search.trim());
      entries = entries.filter((e) => fuzzy(e.title) !== null);
    }

    if (entries.length === 0) {
      content.createDiv({ cls: 'apt-gallery-empty', text: t('galleryView.empty') });
      return;
    }

    const grid = content.createDiv({ cls: 'apt-gallery-grid' });
    for (const entry of this.sortEntries(entries, defaultGalleryRanks(board, crmBoard))) {
      renderEntityCard(
        grid,
        this.app,
        entry.file,
        entry.metaItems,
        {
          openEntity: (file) => this.deps.openFile(file.path),
          menuItems: entry.trip
            ? [
                {
                  label: t('itinerary.edit'),
                  icon: 'pencil',
                  onClick: () => this.deps.openEditTripModal(entry.trip),
                },
              ]
            : undefined,
        },
        {
          imageKey: this.deps.getSettings().imageProperty,
          rating: entry.rating,
          subtitle: entry.trip?.subtitle ?? null,
        }
      );
    }
  }
}
