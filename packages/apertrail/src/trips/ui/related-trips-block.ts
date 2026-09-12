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
import {
  relatedTrips,
  tripsCovering,
  tripsOnVehicle,
  tripsWithExcursion,
  tripsWithPerson,
} from '../related-trips';
import { exportProspect, ProspectSubject } from '../../places/ui/export-prospect';
import { PlaceEditorModal } from '../../places/ui/place-editor-modal';
import { RegionEditorModal, regionEdit } from '../../places/ui/region-editor-modal';
import { ExcursionEditorModal } from '../../places/ui/excursion-editor-modal';
import { excursionToInput } from '../../places/excursion-note';
import { coverInputOf } from '../../ui/components/cover-fields';
import { EditableRegion } from '../../vault/editable';
import { VehicleEditorModal } from '../../places/ui/vehicle-editor-modal';
import { vehicleToInput } from '../../places/vehicle-note';
import { BLOCK_ACTION_LABELS, subjectActions } from '../related-trips-actions';
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

/**
 * Which question this note is the subject of, or null when it is neither, so
 * the block can say "no trips yet" rather than "wrong note".
 *
 * It carries the note itself rather than a string, because the block now does
 * two things with the answer: pick the trips, and offer the export. A person
 * is the one subject with no prospect -- a page about somebody, printed from
 * their address and their tags, is not a thing this plugin should make.
 */
type BlockSubject = ProspectSubject | { kind: 'person' };

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
  const place = board.places.find((p) => p.file.path === sourcePath);
  if (place) return { kind: 'place', place };
  const city = board.cities.find((c) => c.file.path === sourcePath);
  if (city) return { kind: 'city', city };
  // A State and a Country came later than the rest, when every note with a
  // card in the gallery got a prospect: without them the block is where four
  // of the seven exports live and three have no button anywhere.
  const state = board.states.find((x) => x.file.path === sourcePath);
  if (state) return { kind: 'state', state };
  const country = board.countries.find((x) => x.file.path === sourcePath);
  if (country) return { kind: 'country', country };
  // A vehicle answers the same question a place does, from the other side:
  // "which trips sailed on this ship". One more subject rather than a second
  // block, which is the rule a Person note already set.
  const vehicle = board.vehicles.find((v) => v.file.path === sourcePath);
  if (vehicle) return { kind: 'vehicle', vehicle };
  // And an excursion answers it from a third side: "which trips took this
  // tour". Same block, same rule.
  const excursion = board.excursions.find((x) => x.file.path === sourcePath);
  if (excursion) return { kind: 'excursion', excursion };
  const crmBoard = readCrmBoard(app, settings);
  return crmBoard.persons.some((person) => person.file.path === sourcePath)
    ? { kind: 'person' }
    : null;
}

/**
 * The names that count as "here" for a City, a State or a Country.
 *
 * No trip names a State, and a Country is named in frontmatter rather than
 * stopped at, so the question has to be asked of the cities underneath. The
 * same set the prospect builds its own trips section from -- said twice
 * because the two callers reach it from different sides, and a shared helper
 * would have to take a union neither of them has to hand.
 */
function regionTitles(subject: { kind: 'city' | 'state' | 'country' } & BlockSubject): string[] {
  if (subject.kind === 'city') return [subject.city.title];
  if (subject.kind === 'state') return subject.state.cities.map((city) => city.title);
  return [
    subject.country.title,
    ...subject.country.states.flatMap((state) => state.cities.map((city) => city.title)),
  ];
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
  /** Redraws every view after the cover dialog writes, so a new picture shows without a reload. Optional: a caller that renders nothing else needs none. */
  refresh?: () => void;
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

  // This block is where every editor and every export on these note types is
  // reached from. None of them has a block of its own -- a country has no
  // editor at all -- so a command without a button here is a command nobody
  // finds. The trip document shipped without its button once and it showed
  // the same afternoon; the ship's cabins shipped without one and it took
  // two entity types and a real vault before anybody went looking.
  const actions = subjectActions(subject.kind);
  if (actions.length > 0) {
    const row = el.createDiv({ cls: 'apt-related-trips-actions' });
    for (const action of actions) {
      const button = row.createEl('button', {
        cls: 'apt-itinerary-edit',
        text: t(BLOCK_ACTION_LABELS[action]),
      });
      button.addEventListener('click', () => {
        if (subject.kind === 'person') return;
        // Reached for the kinds `KINDS_WITH_EDITOR` names, and the narrowing
        // below says which ones to the compiler rather than to a comment: a
        // kind added to that list without a branch here draws a button that
        // does nothing, which is the defect this whole block exists to avoid.
        if (action === 'edit') {
          if (subject.kind === 'place') {
            new PlaceEditorModal(
              app,
              settings,
              subject.place.kind,
              () => deps.refresh?.(),
              subject.place
            ).open();
            return;
          }
          if (subject.kind === 'excursion') {
            new ExcursionEditorModal(app, settings, () => deps.refresh?.(), {
              file: subject.excursion.file,
              title: subject.excursion.title,
              input: excursionToInput(subject.excursion),
              cover: coverInputOf(subject.excursion),
            }).open();
            return;
          }
          if (subject.kind === 'vehicle') {
            new VehicleEditorModal(
              app,
              settings,
              subject.vehicle.file,
              vehicleToInput(subject.vehicle),
              coverInputOf(subject.vehicle),
              () => deps.refresh?.()
            ).open();
            return;
          }
          const region: EditableRegion | null =
            subject.kind === 'city'
              ? { kind: 'city', record: subject.city }
              : subject.kind === 'state'
                ? { kind: 'state', record: subject.state }
                : subject.kind === 'country'
                  ? { kind: 'country', record: subject.country }
                  : null;
          if (region) {
            new RegionEditorModal(
              app,
              settings,
              region.kind,
              () => deps.refresh?.(),
              regionEdit(region)
            ).open();
          }
          return;
        }
        void exportProspect(app, settings, subject);
      });
    }
  }

  const title = titleFromPath(sourcePath);
  const visits =
    subject.kind === 'person'
      ? tripsWithPerson(board, title)
      : subject.kind === 'vehicle'
        ? tripsOnVehicle(board, title)
        : subject.kind === 'excursion'
          ? tripsWithExcursion(board, title)
          : subject.kind === 'place'
            ? relatedTrips(board, title)
            : tripsCovering(board, regionTitles(subject));
  if (visits.length === 0) {
    el.createDiv({
      cls: 'apt-itinerary-empty',
      text:
        subject.kind === 'person'
          ? t('relatedTrips.emptyPerson')
          : subject.kind === 'vehicle'
            ? t('relatedTrips.emptyVehicle')
            : subject.kind === 'excursion'
              ? t('relatedTrips.emptyExcursion')
              : t('relatedTrips.empty'),
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
