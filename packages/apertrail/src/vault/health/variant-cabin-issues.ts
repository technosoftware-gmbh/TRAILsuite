/**
 * A leg's variant naming a cabin the ship does not list.
 *
 * The catalogue lives on the vehicle and the price lives on the leg, so a
 * variant that names a cabin borrows its description from the ship at render
 * time (see trips/costs/line-variants.ts and places/vehicle-note.ts). Spelling
 * it differently on the two sides is a typo whose only symptom is a
 * description that quietly does not appear, which is why the leg editor
 * suggests the ship's own cabin names -- and a suggestion is not a
 * requirement, so the typo is still reachable.
 *
 * **Only when nothing else says it**, and this is the whole rule:
 *
 * - A variant carrying its own `description:` loses nothing by not matching.
 *   The description is what the borrowing was for, and it already has one.
 *   A leg deliberately priced for something the ship does not sell -- a
 *   suite bought through an agent, a category renamed since -- is a normal
 *   note and not a mistake.
 * - A ship with no cabins written down yet borrows nothing to anybody, so
 *   warning there would report every variant on every leg for as long as the
 *   catalogue stayed empty. That is the empty-filter failure again: a check
 *   that fires on the ordinary state of a half-filled vault is a check
 *   somebody turns off.
 *
 * A warning with no fix, like every other check in this folder: which cabin
 * was meant is a question only the person who typed it can answer.
 *
 * Pure and taking parsed trips, so it is testable without a vault.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip, TravelVehicle } from '../types';
import { readTravelBoard } from '../read-entities';

export interface VariantCabinWarning {
  /** The ship the leg is taken on, as the leg names her. */
  vehicleTitle: string;
  /** What the variant calls itself, which is the half that has to change. */
  variantName: string;
  /** Where on the trip to look: the leg's route, or its carrier, or its place in the list. */
  legLabel: string;
}

export type VariantCabinIssue = VariantCabinWarning & { file: TFile; tripTitle: string };

/** The same matching rule `cabinDescription()` uses, down to the trim and the case fold: a stricter copy here would warn about variants the itinerary has already matched. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/** Enough of a leg to find it in a list of them: where it goes, else who runs it, else its position. */
function legLabel(leg: TravelTrip['transport'][number], index: number): string {
  const route = [leg.from ?? leg.origin, leg.to ?? leg.destination]
    .filter((part): part is string => !!part)
    .join(' - ');
  return route || leg.carrier || leg.reference || `#${index + 1}`;
}

export function variantCabinWarnings(
  trip: TravelTrip,
  vehiclesByTitle: Map<string, TravelVehicle>
): VariantCabinWarning[] {
  const warnings: VariantCabinWarning[] = [];

  trip.transport.forEach((leg, index) => {
    const title = leg.vehicleTitle?.trim();
    if (!title) return;
    const vehicle = vehiclesByTitle.get(title);
    if (!vehicle || vehicle.cabins.length === 0) return;

    const known = new Set(vehicle.cabins.map((cabin) => key(cabin.name)).filter((n) => n !== ''));
    for (const variant of leg.variants) {
      const name = variant.name?.trim();
      if (!name || variant.description) continue;
      if (known.has(key(name))) continue;
      warnings.push({ vehicleTitle: title, variantName: name, legLabel: legLabel(leg, index) });
    }
  });

  return warnings;
}

/** Every trip in the vault, in path order, with the variants that name a cabin their ship does not have. */
export function scanVariantCabinIssues(app: App, settings: APERtrailSettings): VariantCabinIssue[] {
  const board = readTravelBoard(app, settings);
  const byTitle = new Map(board.vehicles.map((vehicle) => [vehicle.title, vehicle]));

  const issues: VariantCabinIssue[] = [];
  for (const trip of board.trips) {
    for (const warning of variantCabinWarnings(trip, byTitle)) {
      issues.push({ ...warning, file: trip.file, tripTitle: trip.title });
    }
  }

  return issues.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
