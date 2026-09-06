/**
 * Renders, and edits, a Trip note's itinerary from its own frontmatter, as
 * a `travel-itinerary` fenced code block in the note body.
 *
 * A code block rather than a dedicated ItemView: the block re-computes on
 * every render so it can never go stale against the note it lives in, it
 * works in reading mode, it sits
 * directly above whatever prose the vault owner has written about the
 * trip, and it needs no leaf management or metadataCache subscription.
 * See docs/design/trip-model-redesign.md §5.1.
 *
 * This block is also where a trip's itinerary is EDITED. The trip editor
 * originally owned every stop, night and leg, which meant a ten-stop trip
 * opened a dialog of roughly fifty form rows that re-rendered wholesale on
 * each change -- unusable, and reported as such. Editing one item at a
 * time, in place, from the itinerary you are already reading, keeps every
 * dialog to four or five fields regardless of how long the trip is. The
 * trip editor keeps only what belongs to the trip as a whole.
 *
 * Every mutation below follows the same path: take the whole trip as a
 * TripInput (tripToInput), change one item, write the whole thing back
 * through updateTripNote. That keeps one save path responsible for the
 * note -- there is no partial write that could leave frontmatter
 * half-updated -- and it costs nothing, since a trip is a handful of
 * small lists.
 *
 * The block takes no arguments; it renders the trip it is *in*, found from
 * the rendering context's own file path.
 */
import { App, MarkdownPostProcessorContext, MarkdownRenderChild, Notice, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import {
  dateTimeDatePart,
  dateTimeTimePart,
  formatDayTitle,
  parseDayTitle,
  parseGeoPoint,
} from '@technosoftware/trail-core';
import { readTravelBoard } from '../../vault/read-entities';
import { DuplicateTripModal } from './duplicate-trip-modal';
import { moveInList } from '../../shared/reorder';
import { itineraryDays, ItineraryDayGroup, spannedDates } from '../itinerary-days';
import { clockTime, endpointDate, RelativeEndpoint } from '../relative-days';
import { legClock, legWhen } from '../journey-text';
import { legsArrivingOn } from '../leg-arrivals';
import { cabinDescription } from '../../places/vehicle-note';
import { countsInPlan, lineFigure } from '../costs/line-variants';
import { insertDayBefore, removeDay } from '../day-shift';
import {
  dayAnchor,
  ScheduleConflict,
  scheduleConflicts,
  ShotListEntry,
  tripShotList,
} from '../trip-light';
import { sunBandSegments } from '../../shared/sun-band';
import { renderLightChip, renderRelationBadge } from '../../places/ui/light-badges';
import { renderChip } from '../../ui/components/chip';
import { photoSpotToInput, updatePhotoSpotNote } from '../../places/write-photo-spot';
import { bookingsForPlace, bookingsForReference, chipAmounts } from '../costs/booking-match';
import { legRoute } from '../costs/estimates';
import { CostUnit, lineCost, LineCost, lineTravellers } from '../costs/line-cost';
import { BookingPreset, NewBookingModal } from './new-booking-modal';
import { exportTripDocument } from './export-trip-document';
import { TravelBooking, TravelVehicle } from '../../vault/types';
import { resolveImageFile } from '../../ui/components/image-resolve';
import { hour12For } from '../../shared/clock';
import { formatDistanceIn } from '../../shared/units';
import { stopMotif } from '../trip-light';
import { TRAVEL_ITINERARY_BLOCK_LANG, TripInput, tripToInput, updateTripNote } from '../write-trip';
import {
  ParsedTripLineChoice,
  TripLegInput,
  TripLineChoiceInput,
  TripNightInput,
  TripStopInput,
} from '../trip-note';
import { TravelPlace, TravelStopTargetKind, TravelTrip, TravelTripStop } from '../../vault/types';
import {
  DayEditorModal,
  LegEditorModal,
  NightEditorModal,
  StopEditorModal,
} from './item-editor-modals';
import { formatMediumDate, formatMoney } from '../../shared/display';

export { TRAVEL_ITINERARY_BLOCK_LANG };

/**
 * Any itinerary line that can carry a figure of its own.
 *
 * The three differ in everything else and in nothing here, which is why one
 * shape covers them. The stay's dates are optional because only a stay has
 * any.
 */
interface PricedLine extends ParsedTripLineChoice {
  cost: number | null;
  currency: string | null;
  costUnit: CostUnit;
  persons: string[];
  checkIn?: string | null;
  checkOut?: string | null;
}

/**
 * The sum behind a computed estimate, in words: "CHF 890.00 per person x 2".
 *
 * A multiplier of one says only what the figure is per, since there is no
 * arithmetic to show. A per-night figure on a stay with no dates says so
 * rather than quietly counting the stay once.
 */
function costWorking(figure: LineCost, currency: string): string {
  const unit = `${formatMoney(figure.unitAmount ?? 0, currency)} ${t(`costs.unit.${figure.unit}`)}`;
  const sum =
    figure.multiplier === 1 ? unit : t('costs.working', { unit, multiplier: figure.multiplier });
  const needsNights = figure.unit === 'night' || figure.unit === 'personNight';
  return needsNights && figure.nights === null ? `${sum} (${t('costs.nightsUnknown')})` : sum;
}

const KIND_ICONS: Record<TravelStopTargetKind, string> = {
  city: 'building-2',
  accommodation: 'bed',
  fnb: 'utensils',
  landmark: 'landmark',
  location: 'map-pin',
  photospot: 'camera',
};

/** A duration as someone would say it: minutes below an hour, hours and minutes above. */
function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return t('itinerary.minutes', { minutes: total });
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0
    ? t('itinerary.hours', { hours })
    : t('itinerary.hoursMinutes', { hours, minutes: rest });
}

const MODE_ICONS: Record<string, string> = {
  train: 'train-front',
  plane: 'plane',
  car: 'car',
  bus: 'bus',
  boat: 'ship',
  other: 'route',
};

function formatDate(value: string): string {
  const parsed = parseDayTitle(dateTimeDatePart(value));
  return parsed ? formatMediumDate(parsed) : value;
}

/**
 * What a day header says.
 *
 * The date once the trip has one, with the day number beside it, because on a
 * planned twelve-day trip "Tag 3" is how somebody refers to it and the date is
 * how they find it in a calendar. A day nobody can date yet says only its
 * number, and a group with neither says so rather than pretending.
 */
function dayHeading(group: ItineraryDayGroup): string {
  const number = group.number === null ? null : t('itinerary.dayNumber', { number: group.number });
  // "1. Tag: Pretoria", which is how a brochure names a day and how somebody
  // refers to it out loud. The date comes after both, because it is what you
  // look something up by rather than what you call it.
  const named = number && group.title ? `${number}: ${group.title}` : (number ?? group.title);
  if (group.date === null) return named ?? t('itinerary.undatedDay');
  return named ? `${named} · ${formatDate(group.date)}` : formatDate(group.date);
}

/**
 * When a leg or a stay happens, whichever way it says so.
 *
 * Dates once the trip has a departure to resolve them against, and "Day 1 →
 * Day 2" before that. Legs and stays sit in bands with no day header above
 * them, so this line is the only thing telling them apart -- which is why an
 * undated trip cannot simply print nothing here.
 */
function formatWhenSpan(
  from: RelativeEndpoint,
  to: RelativeEndpoint,
  departure: string | null
): string | null {
  const dates = [endpointDate(from, departure), endpointDate(to, departure)].filter(
    (date): date is string => date !== null
  );
  if (dates.length > 0) {
    return [...new Set(dates)].map((date) => formatDate(date)).join(' → ');
  }

  const days = [from.day, to.day].filter((day): day is number => day !== null);
  if (days.length === 0) return null;
  return [...new Set(days)].map((day) => t('itinerary.dayNumber', { number: day })).join(' → ');
}

/** "09:30 - 11:30", "from 12:00", "until 13:30", or null when a stop carries no time at all. */
function formatTimeRange(stop: Pick<TravelTripStop, 'day' | 'from' | 'to'>): string | null {
  // A relative stop carries a bare clock time where an absolute one carries a
  // datetime; `clockTime` reads both, which is what lets one gutter serve a
  // trip before and after it is planned.
  const from =
    stop.day === null ? (stop.from ? dateTimeTimePart(stop.from) : null) : clockTime(stop.from);
  const to = stop.day === null ? (stop.to ? dateTimeTimePart(stop.to) : null) : clockTime(stop.to);
  if (from && to) return `${from} - ${to}`;
  if (from) return t('itinerary.fromTime', { time: from });
  if (to) return t('itinerary.untilTime', { time: to });
  return null;
}

/** The day a capture happened: the trip's own day when it is in the past, today when the trip is still ahead. */
function capturedDay(stopDay: string | null): string {
  const today = formatDayTitle(new Date());
  return stopDay && stopDay <= today ? stopDay : today;
}

export interface ItineraryBlockDeps {
  getSettings: () => APERtrailSettings;
  openFile: (path: string) => void;
  openEditTripModal: (trip: TravelTrip) => void;
}

interface RowAction {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function renderRowActions(row: HTMLElement, actions: RowAction[]): void {
  const wrap = row.createDiv({ cls: 'apt-itinerary-actions-inline' });
  for (const action of actions) {
    const btn = wrap.createDiv({
      cls: 'apt-itinerary-action-btn',
      attr: { role: 'button', tabindex: '0', 'aria-label': action.label, title: action.label },
    });
    setIcon(btn, action.icon);
    btn.toggleClass('is-disabled', action.disabled === true);
    if (action.disabled) continue;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      action.onClick();
    });
  }
}

function renderAddButton(container: HTMLElement, label: string, onClick: () => void): void {
  const btn = container.createEl('button', { cls: 'apt-itinerary-add-btn', text: `+ ${label}` });
  btn.addEventListener('click', () => onClick());
}

/**
 * One rendered block, for one trip.
 *
 * A MarkdownRenderChild rather than a bare render function, because the
 * block has to redraw when the note's metadata changes and that
 * subscription needs a lifecycle. Obsidian tears the child down when the
 * block is re-rendered or the leaf closes, taking the listener with it.
 *
 * The subscription is not optional polish: writing frontmatter and
 * redrawing immediately reads STALE data. processFrontMatter() resolves
 * once the file is written, but app.metadataCache updates asynchronously
 * afterwards -- so a redraw fired from the write's own .then() renders the
 * frontmatter as it was before the edit. That is exactly the reported
 * symptom: a new stop only appeared after switching away from the note and
 * back, which forced a re-render late enough for the cache to have caught
 * up. Redrawing on the cache's own 'changed' event instead removes the
 * race rather than papering over it with a delay.
 */
/**
 * What a freshly added line says about its own choices: nothing yet.
 *
 * Named rather than typed out at each of the three drafts, so a fourth field
 * on the shape is a compile error in one place rather than three silent
 * defaults.
 *
 * **A function rather than a constant, and that is the whole point.** Spreading
 * a shared constant copies its array by reference, so every draft would have
 * held the same `variants` array: a price added to one new line would have
 * turned up on every line created after it, for the rest of the session. A
 * fresh object each call cannot do that.
 */
export function emptyChoice(): TripLineChoiceInput {
  return { variants: [], optional: false, chosen: false };
}

class ItineraryRenderer extends MarkdownRenderChild {
  constructor(
    private readonly app: App,
    private readonly el: HTMLElement,
    private readonly sourcePath: string,
    private readonly deps: ItineraryBlockDeps
  ) {
    super(el);
  }

  /**
   * The photo spot notes this block is currently showing something about.
   *
   * The shot list can tick a motif off, which writes to a SPOT note rather
   * than to the trip, so the trip's own path is no longer the only file
   * whose changes this block has to notice.
   */
  private shownSpotPaths = new Set<string>();

  /** This trip's bookings, refreshed on each render, so a row can say what it cost without reading the vault again. */
  private bookings: TravelBooking[] = [];

  /** The currency a figure with none of its own is in: the trip's, then the setting. Refreshed with the bookings. */
  private tripCurrency = '';

  onload(): void {
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file.path === this.sourcePath || this.shownSpotPaths.has(file.path)) this.render();
      })
    );
    this.render();
  }

  /** Reads the board fresh each time, so the block reflects the note rather than any cached copy. */
  private render(): void {
    const { el } = this;
    el.empty();
    el.addClass('apt-itinerary');

    const board = readTravelBoard(this.app, this.deps.getSettings());
    const trip = board.trips.find((candidate) => candidate.file.path === this.sourcePath);

    if (!trip) {
      // The block was pasted somewhere that isn't a Trip note, or the
      // note's type/folder doesn't match the configured Trips folder. Say
      // which, rather than rendering nothing and looking broken.
      el.createDiv({ cls: 'apt-itinerary-empty', text: t('itinerary.notATrip') });
      return;
    }

    // The trip's bookings, so a row can say what it cost without each
    // renderer reading the vault again.
    this.bookings = board.bookings.filter((booking) => booking.tripTitle === trip.title);
    this.tripCurrency = trip.currency ?? this.deps.getSettings().homeCurrency;

    this.renderPersons(trip);
    this.renderStops(trip);
    this.renderTransport(trip);
    this.renderNights(trip);
    this.renderShotList(trip);
    this.renderFooter(trip);
  }

  /**
   * Writes the whole trip back and redraws. Every edit below routes
   * through here rather than writing its own slice -- see this file's
   * header on why one save path is worth the redundant write.
   */
  private save(trip: TravelTrip, mutate: (input: TripInput) => void): void {
    const input = tripToInput(trip);
    mutate(input);
    // No redraw here: the metadataCache 'changed' subscription in onload()
    // does it, once the cache actually reflects the write. Redrawing from
    // this .then() would render pre-edit frontmatter -- see the class doc.
    void updateTripNote(this.app, this.deps.getSettings(), trip.file, input).catch(
      (err: unknown) => {
        new Notice(err instanceof Error ? err.message : t('modals.common.createFailed'));
      }
    );
  }

  private renderPersons(trip: TravelTrip): void {
    if (trip.personTitles.length === 0) return;
    const row = this.el.createDiv({ cls: 'apt-itinerary-persons' });
    setIcon(row.createSpan({ cls: 'apt-itinerary-icon' }), 'users');
    row.createSpan({ text: trip.personTitles.join(', ') });
  }

  private renderStops(trip: TravelTrip): void {
    const groups = itineraryDays(trip.stops, trip.departure, trip.days);

    if (groups.length === 0) {
      const empty = this.el.createDiv({ cls: 'apt-itinerary-empty-row' });
      empty.createSpan({ cls: 'apt-itinerary-empty', text: t('itinerary.empty') });
      renderAddButton(empty, t('itinerary.addStop'), () => this.addStop(trip, null));
      return;
    }

    // Index into trip.stops, tracked across groups so a row's actions can
    // address the underlying list -- groupStopsByDay preserves order but
    // not position, and reordering has to act on the real list.
    // Computed once over the whole list, since the check is about
    // consecutive entries and a day boundary is not a reason to stop
    // looking. Keyed by stop index so a row can find its own warning.
    const conflicts = new Map<number, ScheduleConflict>();
    for (const conflict of scheduleConflicts(trip.stops)) conflicts.set(conflict.index, conflict);

    let index = 0;
    for (const group of groups) {
      const header = this.el.createDiv({ cls: 'apt-itinerary-day-row' });
      header.createSpan({ cls: 'apt-itinerary-day', text: dayHeading(group) });
      // Only a numbered day can be acted on: every one of these is filed under
      // the number, so a group that has none has nothing to name or remove.
      if (group.number !== null) {
        const number = group.number;
        renderRowActions(header, [
          {
            icon: 'pencil',
            label: t('itinerary.editDay'),
            onClick: () => this.editDay(trip, number),
          },
          {
            icon: 'between-horizontal-start',
            label: t('itinerary.insertDay'),
            onClick: () => this.insertDay(trip, number),
          },
          {
            icon: 'trash-2',
            label: t('itinerary.removeDay'),
            onClick: () => this.removeDay(trip, number),
          },
        ]);
      }
      // Each day gets its own add button, carrying that day -- adding a second
      // stop to an existing day shouldn't mean retyping when it is. It passes
      // the whole group rather than a date, so a stop added to day 3 of an
      // undated trip lands on day 3 rather than on nothing.
      renderAddButton(header, t('itinerary.addStop'), () => this.addStop(trip, group));

      // The day's own paragraph, under its header and above its stops, which
      // is where a brochure puts it.
      if (group.note) {
        this.el.createDiv({ cls: 'apt-itinerary-day-note', text: group.note });
      }

      // What ends here. A leg lives in the transport band and is edited
      // there; this is the one line saying the fifteen-day voyage finishes on
      // this day, which the band cannot say because it has no days in it.
      for (const leg of legsArrivingOn(trip.transport, group, trip.departure)) {
        const arrival = this.el.createDiv({ cls: 'apt-itinerary-arrival' });
        setIcon(
          arrival.createSpan({ cls: 'apt-itinerary-arrival-icon' }),
          (leg.mode && MODE_ICONS[leg.mode]) || 'route'
        );
        arrival.createSpan({
          text: t('itinerary.legArrival', {
            leg:
              legRoute(leg, t('itinerary.legJoiner')) ?? leg.carrier ?? t('itinerary.unnamedLeg'),
          }),
        });
      }

      // A backdrop, not a control: where the day's stops actually fall
      // against the day's light. Only drawn for a dated day with a located
      // stop, since neither a missing date nor missing coordinates has a
      // right answer to draw. See docs/design/photo-spots.md §6.1.
      if (this.deps.getSettings().sunTimesEnabled && group.date) {
        const anchor = dayAnchor(group.stops);
        const day = parseDayTitle(group.date);
        if (anchor && day) {
          const band = this.el.createDiv({ cls: 'apt-sunband' });
          for (const segment of sunBandSegments(day, anchor)) {
            const seg = band.createDiv({ cls: `apt-sunband-seg is-${segment.kind}` });
            // A custom property rather than an inline style, per CLAUDE.md:
            // the width is genuinely dynamic (it is the day's own geometry),
            // but the rule that turns it into a flex basis stays in the
            // stylesheet where a theme can see it.
            seg.setCssProps({ '--apt-sunband-share': (segment.end - segment.start).toFixed(6) });
          }
        }
      }

      for (const stop of group.stops) {
        this.renderStopRow(trip, stop, index);
        const conflict = conflicts.get(index);
        if (conflict) this.renderConflictRow(trip, conflict);
        index += 1;
      }
    }
  }

  /**
   * An advisory chip under the stop that cannot be reached in time, naming
   * the one before it and showing what the number is made of.
   *
   * It refuses nothing, reorders nothing and nags about nothing. The plugin
   * cannot know that you have a car, a lift, or a plan; what it can do is
   * make an impossible pair visible at planning time instead of at 19:40 in
   * a car park. Saying "straight line, on foot" out loud is part of that:
   * an unexplained warning is one you learn to ignore.
   */
  private renderConflictRow(trip: TravelTrip, conflict: ScheduleConflict): void {
    const other = trip.stops[conflict.fromIndex];
    const row = this.el.createDiv({ cls: 'apt-itinerary-conflict' });
    setIcon(row.createSpan({ cls: 'apt-itinerary-conflict-icon' }), 'triangle-alert');
    row.createSpan({
      text:
        conflict.gapMinutes < 0
          ? t('itinerary.conflictOverlap', {
              other: other?.placeTitle ?? t('itinerary.conflictPreviousStop'),
              distance: formatDistanceIn(conflict.km, this.deps.getSettings().units),
            })
          : t('itinerary.conflictTooFar', {
              other: other?.placeTitle ?? t('itinerary.conflictPreviousStop'),
              distance: formatDistanceIn(conflict.km, this.deps.getSettings().units),
              walk: formatMinutes(conflict.walkMinutes),
              gap: formatMinutes(conflict.gapMinutes),
            }),
    });
  }

  /**
   * What a photo spot stop is actually for: which motif, in what light, at
   * what time, through which lens.
   *
   * Without this row a stop at a photo spot renders exactly like a stop at
   * a restaurant, and the itinerary of a photography planner looks like
   * every other itinerary until you open a note. Nothing is drawn for any
   * other kind of stop, and nothing is drawn for a spot with no motifs:
   * there is no claim to make about either.
   */
  private renderSpotBadges(body: HTMLElement, stop: TravelTripStop): void {
    if (stop.targetKind !== 'photospot') return;
    const place = stop.target as TravelPlace | null;
    const spot = place?.photoSpot;
    if (!place || !spot) return;

    const motif = stopMotif(spot, stop.motifName);
    if (!motif) return;

    // The stop's own day, not today: an itinerary is usually read before
    // the trip happens, and the light that matters is the light on the day
    // the stop is planned for. A stop with no date at all gets its chips
    // without times rather than times from an arbitrary day.
    const day = parseDayTitle((stop.from ?? '').slice(0, 10));
    const settings = this.deps.getSettings();
    const sun =
      settings.sunTimesEnabled && day
        ? {
            date: day,
            timeZone: spot.timezone ?? undefined,
            hour12: hour12For(settings.clockFormat),
          }
        : null;
    const point = parseGeoPoint(motif.geoLocation) ?? parseGeoPoint(place.geoLocation);

    const badges = body.createDiv({ cls: 'apt-chips apt-itinerary-badges' });
    // Named first, because which picture this stop is for is the thing the
    // row cannot otherwise say.
    if (motif.name) renderChip(badges, motif.name, 'camera');
    if (motif.light.length > 0) renderLightChip(badges, motif.light[0], point, sun);
    renderRelationBadge(badges, motif, point, sun);
    if (motif.lens) renderChip(badges, motif.lens);
  }

  private renderStopRow(trip: TravelTrip, stop: TravelTripStop, index: number): void {
    const row = this.el.createDiv({ cls: 'apt-itinerary-stop' });

    row.createDiv({ cls: 'apt-itinerary-time', text: formatTimeRange(stop) ?? '' });
    setIcon(
      row.createSpan({ cls: 'apt-itinerary-icon' }),
      stop.targetKind ? KIND_ICONS[stop.targetKind] : 'help-circle'
    );

    const body = row.createDiv({ cls: 'apt-itinerary-body' });
    if (stop.target) {
      const link = body.createEl('a', {
        cls: 'apt-itinerary-link',
        text: stop.placeTitle ?? '',
      });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.deps.openFile(stop.target?.file.path ?? '');
      });
    } else if (stop.placeUnresolved) {
      // An unresolved link is shown as unresolved rather than silently
      // omitted -- the parser deliberately keeps these rows so a typo
      // looks like a typo instead of a deletion (see trip-note.ts).
      body.createSpan({
        cls: 'apt-itinerary-unresolved',
        text: stop.placeTitle ?? t('itinerary.unknownPlace'),
      });
    }
    // A stop that names no place at all draws nothing here, and its note
    // below is the whole row. That is a line of a brochure day rather than a
    // visit, and a placeholder over it would be a warning about nothing.
    if (stop.rating !== null && stop.rating > 0) {
      body.createSpan({
        cls: 'apt-itinerary-rating',
        text: '★'.repeat(Math.min(5, Math.round(stop.rating))),
      });
    }
    // A stop whose end time lands on the next day would otherwise read as
    // ending before it started, since the day header above only covers
    // its start date.
    if (spannedDates(stop.from, stop.to).length > 1 && stop.to) {
      body.createDiv({ cls: 'apt-itinerary-note', text: `→ ${formatDate(stop.to)}` });
    }
    if (stop.note) {
      // The note leads the row when there is no place above it: on a brochure
      // day the sentence IS the entry, and setting it in the smaller,
      // greyer style used for an aside would bury the only thing there.
      const placeless = !stop.target && !stop.placeUnresolved;
      body.createDiv({
        cls: placeless ? 'apt-itinerary-line' : 'apt-itinerary-note',
        text: stop.note,
      });
    }

    this.renderSpotBadges(body, stop);
    this.renderVariants(trip, body, stop, (input) => input.stops[index]);
    const stopBookings = bookingsForPlace(this.bookings, stop.placeTitle);
    this.renderCostChips(body, stopBookings, stop, trip.personTitles);
    this.renderOptionalChip(trip, body, stop, (input) => input.stops[index]);

    renderRowActions(row, [
      {
        icon: 'pencil',
        label: t('itinerary.editStop'),
        onClick: () => this.editStop(trip, index),
      },
      ...this.bookAction(trip, stopBookings, stop, {
        title: stop.placeTitle,
        category: 'activity',
        placeTitle: stop.placeTitle,
      }),
      {
        icon: 'arrow-up',
        label: t('modals.tripEditor.moveUp'),
        disabled: index === 0,
        onClick: () => this.moveStop(trip, index, -1),
      },
      {
        icon: 'arrow-down',
        label: t('modals.tripEditor.moveDown'),
        disabled: index === trip.stops.length - 1,
        onClick: () => this.moveStop(trip, index, 1),
      },
      {
        icon: 'trash-2',
        label: t('modals.tripEditor.removeStop'),
        onClick: () =>
          this.save(trip, (input) => {
            input.stops.splice(index, 1);
          }),
      },
    ]);
  }

  /**
   * What this trip still owes you photographically: every motif at every
   * photo spot it stops at, ticked or open.
   *
   * Read straight off the spots rather than stored on the trip, so ticking
   * a motif off in its own note shows up here without a second write. A
   * trip that stops at no photo spot gets no section at all rather than an
   * empty heading. See docs/design/photo-spots.md §6.4.
   */
  private renderShotList(trip: TravelTrip): void {
    const entries = tripShotList(trip);
    this.shownSpotPaths = new Set(entries.map((entry) => entry.spotPath));
    if (entries.length === 0) return;

    const open = entries.filter((entry) => !entry.captured).length;
    const heading = this.el.createDiv({ cls: 'apt-itinerary-band-row' });
    heading.createSpan({
      cls: 'apt-itinerary-band-heading',
      text: t('itinerary.shotList', { open, total: entries.length }),
    });

    const list = this.el.createDiv({ cls: 'apt-itinerary-shotlist' });
    for (const entry of entries) this.renderShotRow(list, entry);
  }

  private renderShotRow(list: HTMLElement, entry: ShotListEntry): void {
    const row = list.createDiv({ cls: 'apt-itinerary-shot' });
    // A button rather than a mark. The moment you know you got the shot is
    // the evening of the day you took it, and the note open in front of you
    // then is the trip, not the spot.
    const mark = row.createEl('button', {
      cls: entry.captured ? 'apt-itinerary-shot-mark is-captured' : 'apt-itinerary-shot-mark',
      attr: {
        'aria-label': entry.captured
          ? t('photoSpot.captured')
          : t('itinerary.markCaptured', { motif: entry.motifName }),
        title: entry.captured
          ? t('photoSpot.captured')
          : t('itinerary.markCaptured', { motif: entry.motifName }),
      },
    });
    setIcon(mark.createSpan({ cls: 'apt-icon-slot' }), entry.captured ? 'check' : 'circle');
    mark.addEventListener('click', () => this.toggleShot(entry));
    row.createSpan({ cls: 'apt-itinerary-shot-name', text: entry.motifName });
    const link = row.createEl('a', { cls: 'apt-itinerary-shot-spot', text: entry.spotTitle });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this.deps.openFile(entry.spotPath);
    });
    if (entry.captured && entry.capturedOn) {
      row.createSpan({ cls: 'apt-itinerary-shot-date', text: formatDate(entry.capturedOn) });
    }
  }

  /**
   * Ticks a motif off, in the spot's own note.
   *
   * Writing into the spot rather than into the trip keeps the rule that no
   * note carries a copy of another note's answer. This is not a derived
   * value being cached: it is a direct edit of the field's owner, made from
   * a different screen.
   *
   * The date stamped is the day the trip was AT the spot when that day has
   * passed, and today otherwise. Recording an old trip should not claim you
   * were there this afternoon.
   */
  private toggleShot(entry: ShotListEntry): void {
    const settings = this.deps.getSettings();
    const board = readTravelBoard(this.app, settings);
    const place = board.places.find((candidate) => candidate.file.path === entry.spotPath);
    if (!place?.photoSpot) return;

    const input = photoSpotToInput(place);
    const key = (name: string | null): string => (name ?? '').trim().toLowerCase();
    const at = input.motifs.findIndex((motif) => key(motif.name) === key(entry.motifName));
    if (at < 0) return;

    const motif = input.motifs[at];
    motif.captured = !motif.captured;
    motif.capturedOn = motif.captured ? capturedDay(entry.stopDay) : null;

    void updatePhotoSpotNote(this.app, settings, place.file, input).catch((err: unknown) => {
      new Notice(err instanceof Error ? err.message : t('photoSpot.saveFailed'));
    });
  }

  /** The line's own arithmetic, done against the trip's people. Redone on every render, stored nowhere. */
  /**
   * What the row's own figure comes to.
   *
   * Through `lineFigure` rather than off the line directly, so a row priced
   * by variant shows the same number the totals counted. A row that showed
   * one cabin's price while the budget counted another's would be the exact
   * failure the money rules exist to prevent.
   */
  private figureFor(line: PricedLine, participants: string[]): LineCost {
    const figure = lineFigure(line);
    return lineCost({
      cost: figure.cost,
      unit: figure.costUnit,
      persons: line.persons,
      participants,
      checkIn: line.checkIn,
      checkOut: line.checkOut,
    });
  }

  /**
   * What a row cost, and the paperwork behind it.
   *
   * Per currency rather than converted: a chip has no room to explain a
   * rate, and a converted figure without its rate is the one thing this
   * feature must not print. The document icon opens the confirmation, which
   * is the whole reason a booking is a note rather than a number.
   */
  private renderCostChips(
    body: HTMLElement,
    bookings: TravelBooking[],
    /** The line itself, where it carries a figure of its own. Shown only while no booking has taken it over. */
    line: PricedLine | null = null,
    participants: string[] = []
  ): void {
    const settings = this.deps.getSettings();
    const figure = line ? this.figureFor(line, participants) : null;
    // A booking on this line supersedes the estimate, which is the same rule
    // the totals use; showing both would be showing one figure twice.
    const pending = bookings.length === 0 ? (figure?.amount ?? null) : null;
    const money = settings.budgetEnabled && (bookings.length > 0 || pending !== null);
    // Naming a subset is the exception, so it is what earns a chip. Everybody
    // on the trip is already named along the top of the itinerary.
    const subset =
      line !== null && line.persons.length > 0 && line.persons.length < participants.length;
    if (!money && !subset) return;

    const row = body.createDiv({ cls: 'apt-chips apt-itinerary-costs' });

    if (subset && line) {
      renderChip(row, t('itinerary.travellers', { count: line.persons.length }), 'users');
    }
    if (!money) return;

    for (const [currency, amount] of chipAmounts(bookings, this.tripCurrency)) {
      renderChip(row, formatMoney(amount, currency), 'receipt');
    }

    // A dashed chip, and it says on hover how it got there: the difference
    // between a figure somebody paid and a figure somebody guessed is the
    // whole point of the plan-against-actual column, and a row must not blur
    // it. The working is spelled out because the multiplication is redone on
    // every render and stored nowhere, so the only defence against a wrong
    // total is being able to read where it came from.
    if (pending !== null && figure && line) {
      // The variant's currency where there is one, since that is where the
      // figure came from.
      const currency = lineFigure(line).currency ?? this.tripCurrency;
      const chip = row.createSpan({ cls: 'apt-chip apt-itinerary-estimate' });
      setIcon(chip.createSpan({ cls: 'apt-chip-icon' }), 'circle-dashed');
      chip.createSpan({ text: formatMoney(pending, currency) });
      // An extra nobody has taken is priced and not planned, and the chip has
      // to say which of the two it is: the same number means different things
      // in a total that counts it and one that does not.
      const kind = countsInPlan(line) ? t('costs.estimateChip') : t('itinerary.optional');
      chip.setAttr('title', `${kind} · ${costWorking(figure, currency)}`);
    }

    for (const booking of bookings) {
      if (!booking.documentPath) continue;
      const file = resolveImageFile(this.app, booking.documentPath);
      const chip = row.createSpan({ cls: 'apt-chip apt-itinerary-document' });
      setIcon(chip.createSpan({ cls: 'apt-chip-icon' }), 'file-text');
      chip.createSpan({ text: t('costs.document') });
      // A document that does not resolve is shown as unresolved rather than
      // hidden: a moved PDF is a thing to fix, not a thing to forget.
      if (!file) {
        chip.addClass('is-unresolved');
        chip.setAttr('title', booking.documentPath);
        continue;
      }
      chip.addClass('is-clickable');
      chip.addEventListener('click', () => this.deps.openFile(file.path));
    }
  }

  /**
   * "Book this", on a line that is still only a plan.
   *
   * Two weeks after pricing a trip you book it, and the thing you have in
   * front of you then is the itinerary rather than the costs block. The
   * preset carries the line's own reference or accommodation, which is what
   * makes the new booking supersede the estimate rather than sit beside it.
   *
   * Returns zero or one action so a row can spread it inline: a line that
   * already has a booking has nothing left to book, and a vault with the
   * budget switched off should not grow a button for it.
   */
  private bookAction(
    trip: TravelTrip,
    bookings: TravelBooking[],
    line: PricedLine,
    preset: Omit<BookingPreset, 'tripTitle' | 'amount' | 'currency' | 'forTitles'>
  ): RowAction[] {
    if (!this.deps.getSettings().budgetEnabled || bookings.length > 0) return [];
    const figure = this.figureFor(line, trip.personTitles);
    return [
      {
        icon: 'receipt',
        label: t('costs.bookThis'),
        onClick: () => {
          new NewBookingModal(this.app, this.deps.getSettings(), {
            ...preset,
            tripTitle: trip.title,
            // The line's total, not its per-person figure: two fares booked
            // together are one booking for the pair of them.
            amount: figure.amount,
            currency: line.currency,
            forTitles: lineTravellers(line.persons, trip.personTitles),
          }).open();
        },
      },
    ];
  }

  private renderTransport(trip: TravelTrip): void {
    const heading = this.el.createDiv({ cls: 'apt-itinerary-band-row' });
    heading.createSpan({
      cls: 'apt-itinerary-band-heading',
      text: t('itinerary.transport'),
    });
    renderAddButton(heading, t('itinerary.addLeg'), () => this.addLeg(trip));

    trip.transport.forEach((leg, index) => {
      const row = this.el.createDiv({ cls: 'apt-itinerary-stop' });
      row.createDiv({ cls: 'apt-itinerary-time', text: legClock(leg, trip.departure) ?? '' });
      setIcon(
        row.createSpan({ cls: 'apt-itinerary-icon' }),
        (leg.mode && MODE_ICONS[leg.mode]) || 'route'
      );
      const direction = t(leg.direction === 'inbound' ? 'itinerary.inbound' : 'itinerary.outbound');
      const body = row.createDiv({ cls: 'apt-itinerary-body' });
      // Where the flight actually goes, first: "Zürich to Pretoria" is what
      // the row is about, and "Outward journey, LX288" is what qualifies it.
      const route = legRoute(leg, t('itinerary.legJoiner'));
      body.createSpan({ text: route ?? direction });
      // The ship's name between the carrier and the reference: Hurtigruten is
      // who runs it and MS Trollfjord is what you are on, and the row reads in
      // that order.
      const detail = [route ? direction : null, leg.carrier, leg.vehicleTitle, leg.reference]
        .filter((part): part is string => !!part)
        .join(' · ');
      if (detail) body.createDiv({ cls: 'apt-itinerary-note', text: detail });
      // A link only where the vault has the note. A ship somebody only typed
      // the name of still reads, in the line above.
      if (leg.vehicle) {
        const open = body.createDiv({ cls: 'apt-itinerary-note' });
        const link = open.createEl('a', {
          cls: 'apt-itinerary-link',
          text: leg.vehicle.title,
        });
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.deps.openFile(leg.vehicle?.file.path ?? '');
        });
      }
      // Transport legs sit in their own band with no day header above
      // them, so without this an outbound leg on the 8th and an inbound
      // one on the 12th render as two bare time ranges on what looks like
      // a single day.
      // The departure day only: the arrival is the `+1` in the time above,
      // which is how a timetable says it and how this used to say it twice.
      const span = legWhen(leg, trip.departure);
      if (span) body.createDiv({ cls: 'apt-itinerary-note', text: span });
      this.renderVariants(trip, body, leg, (input) => input.transport[index], leg.vehicle);
      this.renderOptionalChip(trip, body, leg, (input) => input.transport[index]);
      // A leg has no identity of its own, so it is matched on the reference
      // both sides already carry.
      const legBookings = bookingsForReference(this.bookings, leg.reference);
      this.renderCostChips(body, legBookings, leg, trip.personTitles);

      renderRowActions(row, [
        {
          icon: 'pencil',
          label: t('itinerary.editLeg'),
          onClick: () => this.editLeg(trip, index),
        },
        ...this.bookAction(trip, legBookings, leg, {
          title: route ?? leg.reference ?? direction,
          category: 'transport',
          reference: leg.reference,
        }),
        {
          icon: 'trash-2',
          label: t('modals.tripEditor.removeLeg'),
          onClick: () =>
            this.save(trip, (input) => {
              input.transport.splice(index, 1);
            }),
        },
      ]);
    });
  }

  /**
   * The prices one line can be bought at, and which of them the budget counts.
   *
   * Drawn under the line rather than as lines of their own, because they are
   * one thing: three cabins on the same voyage on the same days is one leg
   * with a decision still open on it, not three legs.
   *
   * The chosen one is marked and every other stays legible, which is the
   * point -- the reason to keep the alternatives in the note is to be able to
   * change your mind with the prices still in front of you. Clicking the
   * chosen one again leaves the choice open, because withdrawing a decision is
   * a thing people do and re-typing four prices to do it is not.
   *
   * `pick` hands back the same line out of a fresh `TripInput`, which is what
   * lets one renderer serve a stop, a stay and a leg: only the caller knows
   * which list its row came from.
   */
  private renderVariants(
    trip: TravelTrip,
    body: HTMLElement,
    line: ParsedTripLineChoice & { currency: string | null },
    pick: (input: TripInput) => TripLineChoiceInput | undefined,
    /**
     * The vehicle this line is taken on, where there is one.
     *
     * A cabin's description is a fact about the ship and is written once, in
     * the ship's own note; the price is a fact about this sailing and is
     * written here. So a variant with no description of its own borrows the
     * catalogue's, at render time and never on disk -- correcting the ship
     * note corrects every trip that ever sailed on it.
     */
    vehicle: TravelVehicle | null = null
  ): void {
    if (line.variants.length === 0) return;

    const settings = this.deps.getSettings();
    const list = body.createDiv({ cls: 'apt-itinerary-options' });

    line.variants.forEach((variant, variantIndex) => {
      const row = list.createDiv({
        cls: variant.chosen ? 'apt-itinerary-option is-chosen' : 'apt-itinerary-option',
      });
      setIcon(
        row.createSpan({ cls: 'apt-itinerary-option-mark' }),
        variant.chosen ? 'circle-check' : 'circle'
      );
      const text = row.createDiv({ cls: 'apt-itinerary-option-body' });
      const head = text.createDiv({ cls: 'apt-itinerary-option-head' });
      head.createSpan({
        cls: 'apt-itinerary-option-name',
        text: variant.name ?? t('itinerary.variantUnnamed', { number: variantIndex + 1 }),
      });
      if (settings.budgetEnabled && variant.cost !== null) {
        head.createSpan({
          cls: 'apt-itinerary-option-price',
          text: formatMoney(variant.cost, variant.currency ?? line.currency ?? this.tripCurrency),
        });
      }
      const description = variant.description ?? cabinDescription(vehicle, variant.name);
      if (description) {
        text.createDiv({ cls: 'apt-itinerary-note', text: description });
      }

      row.setAttr('role', 'button');
      row.setAttr(
        'aria-label',
        variant.chosen ? t('itinerary.variantClear') : t('itinerary.variantChoose')
      );
      row.addEventListener('click', () => {
        this.save(trip, (input) => {
          const target = pick(input);
          if (!target) return;
          // Exactly one, or none: a set of alternatives with two ticks is not
          // a choice, and the reader of the note would have no way to tell
          // which figure the budget used.
          target.variants.forEach((candidate, candidateIndex) => {
            candidate.chosen = candidateIndex === variantIndex && !variant.chosen;
          });
        });
      });
    });

    // Said once, under the list: the budget is counting a figure nobody has
    // picked, and a row that showed a number without saying so would be
    // claiming a decision that has not been made.
    if (!line.variants.some((variant) => variant.chosen)) {
      list.createDiv({ cls: 'apt-itinerary-note', text: t('itinerary.variantAssumed') });
    }
  }

  /**
   * A line that may not happen, and whether it has been taken.
   *
   * A chip rather than a row of its own, and it is the control as well as the
   * label: clicking it is how an offered excursion becomes part of the plan.
   * Nothing is drawn for the ordinary line, which is most of them.
   */
  private renderOptionalChip(
    trip: TravelTrip,
    body: HTMLElement,
    line: ParsedTripLineChoice,
    pick: (input: TripInput) => TripLineChoiceInput | undefined
  ): void {
    if (!line.optional) return;

    const row = body.createDiv({ cls: 'apt-chips apt-itinerary-costs' });
    const chip = row.createSpan({
      cls: line.chosen
        ? 'apt-chip apt-itinerary-optional is-chosen'
        : 'apt-chip apt-itinerary-optional',
    });
    setIcon(
      chip.createSpan({ cls: 'apt-chip-icon' }),
      line.chosen ? 'circle-check' : 'circle-help'
    );
    chip.createSpan({
      text: line.chosen ? t('itinerary.optionalTaken') : t('itinerary.optional'),
    });
    chip.setAttr('role', 'button');
    chip.setAttr(
      'aria-label',
      line.chosen ? t('itinerary.optionalDrop') : t('itinerary.optionalTake')
    );
    chip.addEventListener('click', () => {
      this.save(trip, (input) => {
        const target = pick(input);
        if (!target) return;
        target.chosen = !line.chosen;
      });
    });
  }

  private renderNights(trip: TravelTrip): void {
    const heading = this.el.createDiv({ cls: 'apt-itinerary-band-row' });
    heading.createSpan({
      cls: 'apt-itinerary-band-heading',
      text: t('itinerary.nights'),
    });
    renderAddButton(heading, t('itinerary.addNight'), () => this.addNight(trip));

    trip.nights.forEach((night, index) => {
      const row = this.el.createDiv({ cls: 'apt-itinerary-stop' });
      // Nights carry dates and no clock time, so the gutter (sized and
      // aligned for "09:30 - 11:30") stays empty and the formatted range
      // goes in the body -- a raw ISO pair used to be dumped into the
      // gutter, unformatted and overflowing it.
      row.createDiv({ cls: 'apt-itinerary-time', text: '' });
      setIcon(row.createSpan({ cls: 'apt-itinerary-icon' }), 'bed');
      const body = row.createDiv({ cls: 'apt-itinerary-body' });
      body.createSpan({ text: night.accommodationTitle ?? t('itinerary.unknownPlace') });
      const span = formatWhenSpan(
        { day: night.checkInDay, value: night.checkIn },
        { day: night.checkOutDay, value: night.checkOut },
        trip.departure
      );
      if (span) body.createDiv({ cls: 'apt-itinerary-note', text: span });
      this.renderVariants(trip, body, night, (input) => input.nights[index]);
      const nightBookings = bookingsForPlace(this.bookings, night.accommodationTitle);
      this.renderCostChips(body, nightBookings, night, trip.personTitles);
      this.renderOptionalChip(trip, body, night, (input) => input.nights[index]);

      renderRowActions(row, [
        {
          icon: 'pencil',
          label: t('itinerary.editNight'),
          onClick: () => this.editNight(trip, index),
        },
        ...this.bookAction(trip, nightBookings, night, {
          title: night.accommodationTitle,
          category: 'accommodation',
          placeTitle: night.accommodationTitle,
        }),
        {
          icon: 'trash-2',
          label: t('modals.tripEditor.removeNight'),
          onClick: () =>
            this.save(trip, (input) => {
              input.nights.splice(index, 1);
            }),
        },
      ]);
    });
  }

  /**
   * The two things you do to a trip as a whole.
   *
   * The document button is here rather than only in the palette because the
   * other two sheets both have one -- the cost sheet in its own block, the
   * field sheet in the photo spot block -- and a command with no button is a
   * feature somebody has to be told about. Reported as exactly that: the cost
   * sheet got exported instead, because it was the button that was there.
   *
   * It belongs to this block rather than to the costs block below it. This is
   * the trip's own block, and the document is the trip rather than its money.
   */
  private renderFooter(trip: TravelTrip): void {
    const actions = this.el.createDiv({ cls: 'apt-itinerary-actions' });

    const documentBtn = actions.createEl('button', {
      cls: 'apt-itinerary-export',
      text: t('tripDocument.exportButton'),
    });
    documentBtn.addEventListener('click', () => {
      void exportTripDocument(this.app, this.deps.getSettings(), trip);
    });

    // Beside the export rather than in a menu: a shorter version of a trip is
    // made from the trip, while looking at it, and a command somebody has to
    // know the name of is a feature they have to be told about. Same reasoning
    // as the document button above, and the same defect it was added to fix.
    const duplicateBtn = actions.createEl('button', {
      cls: 'apt-itinerary-duplicate',
      text: t('trip.duplicateButton'),
    });
    duplicateBtn.addEventListener('click', () => {
      const settings = this.deps.getSettings();
      const taken = readTravelBoard(this.app, settings).trips.map((other) => other.title);
      new DuplicateTripModal(this.app, settings, trip, taken, (file) =>
        this.deps.openFile(file.path)
      ).open();
    });

    const editBtn = actions.createEl('button', {
      cls: 'apt-itinerary-edit',
      text: t('itinerary.edit'),
    });
    editBtn.addEventListener('click', () => this.deps.openEditTripModal(trip));
  }

  // ── Mutations ────────────────────────────────────────────────────────

  /**
   * A stop, pre-filled with the day it was added under.
   *
   * The whole group rather than a date: a trip that is still relative has day
   * numbers and no dates, and a stop added to day 3 has to land on day 3. A
   * dated trip fills the date as it always did, and takes the number too,
   * because `groupStopsByDay` derives one for every dated day.
   */
  private addStop(trip: TravelTrip, group: ItineraryDayGroup | null): void {
    const draft: TripStopInput = {
      placeTitle: '',
      // Only when the trip cannot date the day itself: a stop that carries
      // both a day number and a date would be saying the same thing twice,
      // and the day number wins on read, so the date would be the half that
      // silently stopped mattering.
      day: group && group.date === null ? group.number : null,
      from: group?.date ?? null,
      to: null,
      note: null,
      rating: null,
      motifName: null,
      cost: null,
      currency: null,
      // An entry, a guide and a cable car are all quoted per head, so that
      // is what the editor offers first. A hand-written note that says
      // nothing still reads as a total; see costs/line-cost.ts.
      costUnit: 'person',
      persons: [],
      ...emptyChoice(),
    };
    new StopEditorModal(
      this.app,
      this.deps.getSettings(),
      draft,
      (value) => {
        this.save(trip, (input) => {
          input.stops.push(value);
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }

  private editStop(trip: TravelTrip, index: number): void {
    const current = tripToInput(trip).stops[index];
    if (!current) return;
    new StopEditorModal(
      this.app,
      this.deps.getSettings(),
      current,
      (value) => {
        this.save(trip, (input) => {
          input.stops[index] = value;
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }

  private moveStop(trip: TravelTrip, index: number, delta: number): void {
    this.save(trip, (input) => {
      moveInList(input.stops, index, delta);
    });
  }

  /**
   * Names a day, or renames it.
   *
   * The entry is created on demand: a day that has never been named has no
   * entry in the list, which is what "sparse" means, so the editor opens on a
   * blank one and the save decides whether it is worth keeping.
   */
  private editDay(trip: TravelTrip, day: number): void {
    const current = trip.days.find((entry) => entry.day === day) ?? {
      day,
      title: null,
      note: null,
    };
    new DayEditorModal(this.app, this.deps.getSettings(), { ...current }, (value) => {
      this.save(trip, (input) => {
        const at = input.days.findIndex((entry) => entry.day === day);
        // A day emptied of both fields is dropped rather than written blank.
        // `buildTripFrontmatter` would drop it anyway; doing it here as well
        // keeps the list the editor works on the same shape as the note.
        const says = (value.title ?? '').trim() !== '' || (value.note ?? '').trim() !== '';
        if (!says) {
          if (at !== -1) input.days.splice(at, 1);
          return;
        }
        if (at === -1) input.days.push(value);
        else input.days[at] = value;
      });
    }).open();
  }

  /**
   * Takes a day out and moves everything after it up.
   *
   * The stops on it go; a stay or a leg that touched it does not, because
   * deleting a booked flight over a change to the plan is the more expensive
   * of the two mistakes. `day-shift.ts` has the reasoning and the arithmetic.
   */
  private removeDay(trip: TravelTrip, day: number): void {
    this.save(trip, (input) => removeDay(input, day));
  }

  /** Makes room for a day before this one. The new day is empty until something is put on it. */
  private insertDay(trip: TravelTrip, day: number): void {
    this.save(trip, (input) => insertDayBefore(input, day));
  }

  private addNight(trip: TravelTrip): void {
    const draft: TripNightInput = {
      accommodationTitle: '',
      checkInDay: null,
      checkOutDay: null,
      checkIn: null,
      checkOut: null,
      cost: null,
      currency: null,
      // A hotel quotes a room per night, whoever is in it.
      costUnit: 'night',
      persons: [],
      ...emptyChoice(),
    };
    new NightEditorModal(
      this.app,
      this.deps.getSettings(),
      draft,
      (value) => {
        this.save(trip, (input) => {
          input.nights.push(value);
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }

  private editNight(trip: TravelTrip, index: number): void {
    const current = tripToInput(trip).nights[index];
    if (!current) return;
    new NightEditorModal(
      this.app,
      this.deps.getSettings(),
      current,
      (value) => {
        this.save(trip, (input) => {
          input.nights[index] = value;
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }

  private addLeg(trip: TravelTrip): void {
    // Default to whichever direction isn't there yet -- a trip has an
    // outbound before it has an inbound, and two outbound legs is rarer.
    const hasOutbound = trip.transport.some((leg) => leg.direction === 'outbound');
    const draft: TripLegInput = {
      direction: hasOutbound ? 'inbound' : 'outbound',
      mode: null,
      carrier: null,
      vehicleTitle: null,
      day: null,
      toDay: null,
      from: null,
      to: null,
      reference: null,
      origin: null,
      destination: null,
      cost: null,
      currency: null,
      // An airline quotes per passenger, which is the whole reason the unit
      // exists: two people on this leg is two fares.
      costUnit: 'person',
      persons: [],
      ...emptyChoice(),
    };
    new LegEditorModal(
      this.app,
      this.deps.getSettings(),
      draft,
      (value) => {
        this.save(trip, (input) => {
          input.transport.push(value);
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }

  private editLeg(trip: TravelTrip, index: number): void {
    const current = tripToInput(trip).transport[index];
    if (!current) return;
    new LegEditorModal(
      this.app,
      this.deps.getSettings(),
      current,
      (value) => {
        this.save(trip, (input) => {
          input.transport[index] = value;
        });
      },
      trip.personTitles,
      trip.departure
    ).open();
  }
}

/** Builds the block's render child. The caller attaches it to the block's own lifecycle via ctx.addChild(), which is what starts it. */
export function createItineraryRenderer(
  app: App,
  el: HTMLElement,
  sourcePath: string,
  deps: ItineraryBlockDeps
): MarkdownRenderChild {
  return new ItineraryRenderer(app, el, sourcePath, deps);
}

/** The registrar is passed in rather than called here, so the plugin instance owns the registration and Obsidian tears it down with the plugin. */
export function registerTravelItineraryBlock(
  app: App,
  deps: ItineraryBlockDeps,
  register: (
    lang: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
  ) => void
): void {
  register(TRAVEL_ITINERARY_BLOCK_LANG, (_source, el, ctx) => {
    // addChild ties the renderer's event subscription to this block's
    // lifetime, and calls its onload() -- which is what draws it.
    ctx.addChild(createItineraryRenderer(app, el, ctx.sourcePath, deps));
  });
}
