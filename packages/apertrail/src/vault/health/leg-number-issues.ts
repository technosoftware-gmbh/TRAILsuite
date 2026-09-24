/**
 * A flight whose flight number sits in the booking reference.
 *
 * `reference` held both until a leg got a `number` of its own: the booking
 * code a booking note finds its leg by, and in practice often the flight
 * number, because that was the one field there was. Such a leg prints its
 * flight number as a booking code on the booking sheet and loses it from the
 * Flight column, and the day the real code is typed over it, the number is
 * gone. See docs/design/booking-sheet.md.
 *
 * **Only a flight, and only where the reference reads as a flight number**:
 * an airline's two-character code and one to four digits, `LX1218` or
 * `LH 872`. A booking code is six mixed characters and almost never has that
 * shape; a train number has no shape to test at all, which is why trains are
 * left alone rather than guessed at. A leg that already has a `number`, or
 * flights of its own, is past the question.
 *
 * A warning with no fix, like every other check in this folder. Moving the
 * value would be right for LX1218 and wrong for the one booking code that
 * happens to look like a flight, and only the person who typed it knows which
 * it is.
 *
 * Pure and taking parsed trips, so it is testable without a vault.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip } from '../types';
import { readTravelBoard } from '../read-entities';
import { isFlight } from '../../shared/travel-mode';

export interface LegNumberWarning {
  /** What the reference holds, which is what has to move. */
  reference: string;
  /** Where on the trip to look: the leg's route, or its carrier, or its place in the list. */
  legLabel: string;
}

export type LegNumberIssue = LegNumberWarning & { file: TFile; tripTitle: string };

/** Two characters of airline designator, letters or a letter and a digit, then one to four digits. */
const FLIGHT_NUMBER = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}[A-Z]?$/;

export function looksLikeFlightNumber(value: string): boolean {
  return FLIGHT_NUMBER.test(value.trim().toUpperCase());
}

function legLabel(leg: TravelTrip['transport'][number], index: number): string {
  const route = [leg.origin, leg.destination].filter((part): part is string => !!part).join(' - ');
  return route || leg.carrier || `#${index + 1}`;
}

export function legNumberWarnings(trip: TravelTrip): LegNumberWarning[] {
  const warnings: LegNumberWarning[] = [];
  trip.transport.forEach((leg, index) => {
    if (!isFlight(leg.mode)) return;
    if (leg.number || leg.segments.length > 0) return;
    const reference = leg.reference?.trim();
    if (!reference || !looksLikeFlightNumber(reference)) return;
    warnings.push({ reference, legLabel: legLabel(leg, index) });
  });
  return warnings;
}

/** Every trip in the vault, in path order, with the flights whose number is in the booking reference. */
export function scanLegNumberIssues(app: App, settings: APERtrailSettings): LegNumberIssue[] {
  const issues: LegNumberIssue[] = [];
  for (const trip of readTravelBoard(app, settings).trips) {
    for (const warning of legNumberWarnings(trip)) {
      issues.push({ ...warning, file: trip.file, tripTitle: trip.title });
    }
  }
  return issues.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
