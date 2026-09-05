/**
 * Renders "which trips came here", or "which trips was this person on",
 * inside the note it sits in, as a `travel-related-trips` fenced code block
 * -- the mirror image of trips/ui/itinerary-block.ts, and registered the
 * same way.
 *
 * The fence language stays `travel-related-trips` now that a Person note
 * can carry it too. This is not a new block, it is the same block answering
 * the same shape of question about one more kind of note, and that string
 * is already written into people's vaults.
 *
 * A separate block rather than making the itinerary block polymorphic:
 * the two answer opposite questions ("what did this trip do" vs "who came
 * to this place"), and a block whose meaning changes depending on which
 * note you paste it into would be a puzzle rather than a feature.
 *
 * Like the itinerary block it takes no arguments and reads the note it
 * sits in from the rendering context's own path.
 */
import { App, MarkdownPostProcessorContext, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { dateTimeDatePart, dateTimeTimePart, parseDayTitle } from '@technosoftware/trail-core';
import { readTravelBoard } from '../../vault/read-entities';
import { readCrmBoard } from '../../crm/read-crm';
import { relatedTrips, tripsWithPerson } from '../related-trips';
import { TravelBoard, TravelTrip } from '../../vault/types';

import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../related-trips-block-lang';
import { formatMediumDate } from '../../shared/display';

export { TRAVEL_RELATED_TRIPS_BLOCK_LANG };

const STATUS_ICONS: Record<string, string> = {
  Planned: 'calendar',
  Booked: 'calendar-check',
  Over: 'check-circle-2',
  Cancelled: 'x-circle',
};

/** The note title this block should look up -- the basename of the file it's rendering in. */
function titleFromPath(sourcePath: string): string {
  const name = sourcePath.split('/').pop() ?? sourcePath;
  return name.replace(/\.md$/, '');
}

/** Which question this note is the subject of, or null when it is neither, so the block can say "no trips yet" rather than "wrong note". */
type BlockSubject = 'place' | 'person';

/**
 * The travel board is checked first and the CRM folders are only read when
 * the note is not a place. Nothing is cached anywhere in this plugin, so
 * that ordering keeps the common case -- this block on a place note -- at
 * one folder scan rather than two.
 */
function blockSubject(
  app: App,
  settings: APERtrailSettings,
  board: TravelBoard,
  sourcePath: string
): BlockSubject | null {
  if (
    board.cities.some((c) => c.file.path === sourcePath) ||
    board.places.some((p) => p.file.path === sourcePath)
  ) {
    return 'place';
  }
  const crmBoard = readCrmBoard(app, settings);
  return crmBoard.persons.some((person) => person.file.path === sourcePath) ? 'person' : null;
}

function formatDate(value: string): string {
  const parsed = parseDayTitle(dateTimeDatePart(value));
  return parsed ? formatMediumDate(parsed) : value;
}

/**
 * One row per trip. A participation match passes no stops, which draws the
 * date, status icon, title and status and nothing else -- for "which trips
 * was Gaby on" that is the whole answer, and inventing a per-stop line for
 * a person would claim a precision the data does not have.
 */
function renderVisitRow(
  container: HTMLElement,
  trip: TravelTrip,
  stops: { from: string | null; to: string | null; note: string | null; rating: number | null }[],
  openFile: (path: string) => void
): void {
  const row = container.createDiv({ cls: 'apt-related-trip' });

  const dateEl = row.createDiv({ cls: 'apt-related-trip-date' });
  dateEl.setText(trip.departure ? formatDate(trip.departure) : t('relatedTrips.noDate'));

  setIcon(
    row.createSpan({ cls: 'apt-related-trip-icon' }),
    STATUS_ICONS[trip.effectiveStatus] ?? 'calendar'
  );

  const body = row.createDiv({ cls: 'apt-related-trip-body' });
  const link = body.createEl('a', { cls: 'apt-related-trip-link', text: trip.title });
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openFile(trip.file.path);
  });
  body.createSpan({
    cls: 'apt-related-trip-status',
    text: t(`dashboard.stats.status${trip.effectiveStatus}`),
  });

  // One line per stop: a trip can stop at the same place twice (lunch and
  // then again on the way back), and collapsing those would lose the
  // per-visit notes that are the most useful thing here.
  for (const stop of stops) {
    const from = stop.from ? dateTimeTimePart(stop.from) : null;
    const to = stop.to ? dateTimeTimePart(stop.to) : null;
    const time = from && to ? `${from} - ${to}` : (from ?? to ?? '');
    const parts: string[] = [];
    if (time) parts.push(time);
    if (stop.note) parts.push(stop.note);
    if (parts.length > 0) {
      body.createDiv({ cls: 'apt-related-trip-note', text: parts.join(' - ') });
    }
    if (stop.rating !== null && stop.rating > 0) {
      body.createSpan({
        cls: 'apt-related-trip-rating',
        text: '★'.repeat(Math.min(5, Math.round(stop.rating))),
      });
    }
  }
}

export interface RelatedTripsBlockDeps {
  getSettings: () => APERtrailSettings;
  openFile: (path: string) => void;
}

export function renderRelatedTrips(
  app: App,
  el: HTMLElement,
  sourcePath: string,
  deps: RelatedTripsBlockDeps
): void {
  el.empty();
  el.addClass('apt-related-trips');

  const settings = deps.getSettings();
  const board = readTravelBoard(app, settings);

  const subject = blockSubject(app, settings, board, sourcePath);
  if (!subject) {
    el.createDiv({
      cls: 'apt-itinerary-empty',
      text: t('relatedTrips.notASubject'),
    });
    return;
  }

  const title = titleFromPath(sourcePath);
  const visits = subject === 'person' ? tripsWithPerson(board, title) : relatedTrips(board, title);
  if (visits.length === 0) {
    el.createDiv({
      cls: 'apt-itinerary-empty',
      text: subject === 'person' ? t('relatedTrips.emptyPerson') : t('relatedTrips.empty'),
    });
    return;
  }

  for (const visit of visits) {
    renderVisitRow(el, visit.trip, visit.stops, deps.openFile);
  }
}

/** Same shape as registerTravelItineraryBlock() -- the registrar is passed in so the plugin instance owns the registration. */
export function registerRelatedTripsBlock(
  app: App,
  deps: RelatedTripsBlockDeps,
  register: (
    lang: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
  ) => void
): void {
  register(TRAVEL_RELATED_TRIPS_BLOCK_LANG, (_source, el, ctx) => {
    renderRelatedTrips(app, el, ctx.sourcePath, deps);
  });
}
