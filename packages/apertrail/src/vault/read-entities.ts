/**
 * The travel board, read out of Obsidian's vault.
 *
 * One delegation to `board-reader.ts` through `hostFor()`, plus the one input
 * the ports do not carry: which day notes link to which places, which only
 * Obsidian's resolved-link cache knows (see day-visits.ts). The property-name
 * mappings are re-exported so every caller keeps importing from here.
 */
import { App, TFile } from 'obsidian';
import { formatDayTitle } from '@technosoftware/trail-core';
import { APERtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { readDayVisits } from './day-visits';
import { readTravelBoardFrom } from './board-reader';
import type { TravelBoard } from './types';

export {
  bookingProperties,
  excursionProperties,
  photoSpotPropertyNames,
  tripPropertyNames,
  vehicleProperties,
} from './board-reader';

/**
 * `today` is a parameter rather than read from the clock inside, so the
 * date-derived Travel Status fallback (see trip-note.ts's
 * effectiveTravelStatus()) is deterministic under test. Callers in the UI
 * omit it and get the real today.
 */
export function readTravelBoard(
  app: App,
  settings: APERtrailSettings,
  today: string = formatDayTitle(new Date())
): TravelBoard<TFile> {
  return readTravelBoardFrom(hostFor(app), settings, readDayVisits(app), today);
}
