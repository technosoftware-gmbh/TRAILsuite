/**
 * The four things that can be quietly wrong with a booking.
 *
 * All warnings, never errors, and none of them carries a fix: what a
 * booking's trip was meant to be, and which of two notes sharing a reference
 * is the duplicate, are answers only the person who wrote them has. The same
 * arrangement photo-spot-issues.ts has beside this file.
 *
 * The rule half is pure and takes parsed bookings, so it is testable without
 * a vault. See docs/design/trip-budget-and-bookings.md §9.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { ParsedBooking } from '../../trips/costs/booking-note';
import { readTravelBoard } from '../read-entities';

export type BookingWarning =
  | { kind: 'unattached' }
  | { kind: 'noCurrency' }
  | { kind: 'strangerOnTheSplit'; person: string }
  | { kind: 'duplicateReference'; reference: string; other: string };

export interface BookingIssue {
  file: TFile;
  title: string;
  warning: BookingWarning;
}

/** What one booking is measured against: the trips that exist, and who is on the one it names. */
export interface BookingContext {
  /** Every trip title in the vault, so an unattached booking can be told from a mistyped one. */
  tripTitles: Set<string>;
  /** Participants per trip title. A trip with none narrows nothing, so a booking naming anybody is fine. */
  participantsByTrip: Map<string, Set<string>>;
  /** Trip currencies by title, for the currency chain. */
  currencyByTrip: Map<string, string | null>;
  /** The setting, the last link in that chain. */
  homeCurrency: string;
}

export function bookingWarnings(booking: ParsedBooking, context: BookingContext): BookingWarning[] {
  const warnings: BookingWarning[] = [];

  // A booking that names no trip at all is not broken: it may be one
  // somebody is still writing. A booking that names a trip nothing answers
  // to is a link into nowhere, and its money is in no total.
  if (booking.tripTitle && !context.tripTitles.has(booking.tripTitle)) {
    warnings.push({ kind: 'unattached' });
  }

  // A figure with no currency anywhere in the chain cannot be added to
  // anything. It only fires when there IS a figure: an unpriced booking is
  // an ordinary half-filled note.
  if (booking.amount !== null) {
    const fromTrip = booking.tripTitle
      ? (context.currencyByTrip.get(booking.tripTitle) ?? null)
      : null;
    if (!booking.currency && !fromTrip && !context.homeCurrency.trim()) {
      warnings.push({ kind: 'noCurrency' });
    }
  }

  const participants = booking.tripTitle
    ? context.participantsByTrip.get(booking.tripTitle)
    : undefined;
  if (participants && participants.size > 0) {
    for (const person of booking.forTitles) {
      if (!participants.has(person)) {
        warnings.push({ kind: 'strangerOnTheSplit', person });
      }
    }
  }

  return warnings;
}

/**
 * Every booking in the vault, with what each one earns.
 *
 * The duplicate-reference check lives here rather than in the pure half
 * because it is about a pair of notes rather than about one: two bookings
 * sharing a reference is usually a note somebody created twice, and
 * occasionally a payment split across two cards, which is why it warns and
 * never offers to merge anything.
 */
export function scanBookingIssues(app: App, settings: APERtrailSettings): BookingIssue[] {
  const board = readTravelBoard(app, settings);

  const context: BookingContext = {
    tripTitles: new Set(board.trips.map((trip) => trip.title)),
    participantsByTrip: new Map(
      board.trips.map((trip) => [trip.title, new Set(trip.personTitles)])
    ),
    currencyByTrip: new Map(board.trips.map((trip) => [trip.title, trip.currency])),
    homeCurrency: settings.homeCurrency,
  };

  const issues: BookingIssue[] = [];
  const byReference = new Map<string, string>();

  for (const booking of board.bookings) {
    for (const warning of bookingWarnings(booking, context)) {
      issues.push({ file: booking.file, title: booking.title, warning });
    }

    const reference = booking.reference?.trim();
    if (!reference) continue;
    const seen = byReference.get(reference);
    if (seen) {
      issues.push({
        file: booking.file,
        title: booking.title,
        warning: { kind: 'duplicateReference', reference, other: seen },
      });
    } else {
      byReference.set(reference, booking.title);
    }
  }

  return issues.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
