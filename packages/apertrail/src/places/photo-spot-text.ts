/**
 * A photo spot as words: the strings the block draws and the field sheet
 * prints, in one place so the two say the same thing.
 *
 * Everything here is text and icon NAMES rather than DOM, which is what
 * lets an HTML export reuse it without dragging Obsidian's rendering along.
 * The block was the only consumer while it was the only surface; the export
 * made a second one, and two copies of "8.9 km SSW of the anchor" would
 * have drifted in wording before they drifted in arithmetic.
 */
import { compassPoint, parseDayTitle, SunTimes } from 'trail-core';
import { t } from '../lang/I18nManager';
import { formatDistanceIn, UnitSystem } from '../shared/units';
import { shortUrl } from '../shared/short-url';
import { TravelPlace } from '../vault/types';
import { ParsedPhotoSpot, ParsedPhotoSpotMotif } from './photo-spot-note';
import { formatMediumDate, formatMonthName } from '../shared/display';

/**
 * One Lucide icon per transit mode. Modes are free text on read (a
 * hand-written note may say `ferry`), so an unknown value falls back to a
 * neutral marker rather than rendering nothing: the row's detail text is
 * the useful part, and losing it to an unrecognized icon name would be a
 * bad trade.
 */
const TRANSIT_ICONS: Record<string, string> = {
  rail: 'train-front',
  bus: 'bus',
  tram: 'tram-front',
  boat: 'ship',
  cablecar: 'cable-car',
  foot: 'footprints',
  car: 'car',
};

/** Gear values we have an icon for. Everything else keeps its raw text and gets the generic one -- an ND filter written as `nd1000` is already language-neutral and needs no help. */
export const GEAR_ICONS: Record<string, string> = {
  tripod: 'move-vertical',
  polarizer: 'circle',
  filter: 'circle',
  remote: 'radio',
  flash: 'zap',
  drone: 'send',
};

/** Gear values with a translated label. Anything else renders verbatim, which is the honest fallback for a vocabulary the user owns. */
const TRANSLATED_GEAR = new Set(['tripod', 'polarizer', 'filter', 'remote', 'flash', 'drone']);

const ACCESSIBILITY_ICONS: Record<string, string> = {
  full: 'accessibility',
  partial: 'accessibility',
  none: 'ban',
  unknown: 'help-circle',
};

/** The zone the runtime is in, for saying so when a note names none. An environment with no Intl at all falls back to a name nobody will mistake for a real zone. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || t('photoSpot.unknownTimeZone');
  } catch {
    return t('photoSpot.unknownTimeZone');
  }
}

/** A stored date value as a reader sees it, falling back to the raw text for anything that does not parse. */
export function formatDayValue(value: string): string {
  const parsed = parseDayTitle(value.slice(0, 10));
  return parsed ? formatMediumDate(parsed) : value;
}

/**
 * A compass token in the reader's own language.
 *
 * The whole point, not its letters. Composing "SSW" out of three translated
 * letters works in German, where only E changes, and it is wrong wherever
 * the words are not letter-shaped or run in a different order: Chinese
 * writes southwest as 西南, west first. Sixteen strings per locale is the
 * only shape that can be right everywhere.
 *
 * An unknown point falls back to the raw token rather than to a key path,
 * which is what an English abbreviation reads as anyway.
 */
export function localizedCompass(point: string): string {
  const key = `photoSpot.compass.${point}`;
  const token = t(key);
  return token === key ? point : token;
}

export function gearLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return TRANSLATED_GEAR.has(key) ? t(`photoSpot.gear.${key}`) : raw.trim();
}

/**
 * Months as a compact range where they are consecutive, a list where they
 * are not. "May - Aug" is what a photographer says; "5, 6, 7, 8" is what
 * the note stores, and printing the storage would be a small daily tax.
 */
export function formatMonths(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const names = sorted.map(formatMonthName);
  const consecutive = sorted.every((month, i) => i === 0 || month === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${names[0]} - ${names[names.length - 1]}`;
  return names.join(', ');
}

/** The motif's own coordinates, as pasted into a map app. Only for a motif that carries a pair of its own: without one the pair is the note's, which the offset line says more usefully. */
export function motifCoordinates(motif: ParsedPhotoSpotMotif): string | null {
  return motif.geoLocation ? `${motif.geoLocation[0]}, ${motif.geoLocation[1]}` : null;
}

/** The bearing, with its compass token from the same sixteen-point rose the distance readout uses, so "shoots SW" and "8.9 km SSW of here" read as one system. */
export function motifDirection(motif: ParsedPhotoSpotMotif): string | null {
  if (motif.direction === null) return null;
  return t('photoSpot.directionValue', {
    degrees: motif.direction,
    compass: localizedCompass(compassPoint(motif.direction)),
  });
}

export function motifSeason(motif: ParsedPhotoSpotMotif): string | null {
  if (motif.season.length === 0) return null;
  return t('photoSpot.seasonValue', { months: formatMonths(motif.season) });
}

/** How far the motif sits from the note's own coordinates, in the reader's units. */
export function motifOffset(
  offset: { km: number; compass: string } | null,
  units: UnitSystem
): string | null {
  if (!offset) return null;
  return t('photoSpot.offsetFromAnchor', {
    distance: formatDistanceIn(offset.km, units),
    compass: localizedCompass(offset.compass),
  });
}

/** Whether a motif is in the bag, as a sentence rather than a flag. */
export function motifCapture(motif: ParsedPhotoSpotMotif): string {
  if (!motif.captured) return t('photoSpot.notCaptured');
  return motif.capturedOn
    ? t('photoSpot.capturedOn', { date: formatDayValue(motif.capturedOn) })
    : t('photoSpot.captured');
}

export interface LogisticsRow {
  icon: string;
  label: string;
  value: string;
  /** A row that exists but says nothing beyond its own label, e.g. a transit mode with no detail. */
  muted?: boolean;
  /** Set on the one row that is a destination rather than a fact: the website. */
  href?: string;
}

/**
 * The rows the printed page's grey box would have, as data.
 *
 * Built before anything is drawn so the section can be skipped entirely
 * when it is empty: a spot whose access nobody has written down should
 * show nothing here rather than six "unknown" rows, which would read as a
 * failed lookup rather than as an unanswered question.
 */
export function logisticsRows(place: TravelPlace, spot: ParsedPhotoSpot): LogisticsRow[] {
  const rows: LogisticsRow[] = [];

  if (place.address)
    rows.push({ icon: 'map-pin', label: t('photoSpot.address'), value: place.address });
  if (spot.parking)
    rows.push({ icon: 'square-parking', label: t('photoSpot.parking'), value: spot.parking });

  for (const row of spot.transit) {
    if (!row.mode && !row.detail) continue;
    const mode = (row.mode ?? '').trim().toLowerCase();
    const known = mode in TRANSIT_ICONS;
    rows.push({
      icon: known ? TRANSIT_ICONS[mode] : 'route',
      label: known ? t(`photoSpot.transit.${mode}`) : (row.mode ?? t('photoSpot.transitLabel')),
      value: row.detail ?? '',
      muted: !row.detail,
    });
  }

  if (spot.openingHours)
    rows.push({ icon: 'clock', label: t('photoSpot.openingHours'), value: spot.openingHours });
  if (spot.entryFee) {
    const free = spot.entryFee.trim().toLowerCase() === 'none';
    rows.push({
      icon: 'ticket',
      label: t('photoSpot.entryFee'),
      value: free ? t('photoSpot.noEntryFee') : spot.entryFee,
    });
  }
  if (spot.accessibility !== 'unknown')
    rows.push({
      icon: ACCESSIBILITY_ICONS[spot.accessibility],
      label: t('photoSpot.accessibility'),
      value: t(`photoSpot.accessibilityValue.${spot.accessibility}`),
    });
  if (place.website) {
    // The host rather than the whole URL, matching what the place cards
    // already show, and a real link rather than text: this is the one row
    // in the band you act on instead of read. A value that does not look
    // like a URL keeps its raw text and gets no link, because shortUrl()
    // hands it back untouched and a hand-written note may hold anything
    // here.
    const looksLikeUrl = /^https?:\/\//i.test(place.website.trim());
    rows.push({
      icon: 'link',
      label: t('photoSpot.website'),
      value: shortUrl(place.website),
      href: looksLikeUrl ? place.website.trim() : undefined,
    });
  }

  return rows;
}

/**
 * The day's boundaries, in the order they happen, as label and instants.
 *
 * A row whose start the sun never reaches on that date comes back with a
 * null start and is dropped by the caller rather than printed as dashes: at
 * 69 degrees north in June there is no sunrise, and a panel full of dashes
 * reads as a failure rather than as a fact about the place.
 */
export function sunRows(
  times: SunTimes
): { label: string; start: Date | null; end: Date | null }[] {
  return [
    {
      label: t('photoSpot.light.blue-hour-morning'),
      start: times.nightEnd,
      end: times.goldenHourMorningStart,
    },
    {
      label: t('photoSpot.light.golden-hour-morning'),
      start: times.goldenHourMorningStart,
      end: times.dayStart,
    },
    { label: t('photoSpot.light.sunrise'), start: times.sunrise, end: null },
    { label: t('photoSpot.solarNoon'), start: times.solarNoon, end: null },
    { label: t('photoSpot.light.sunset'), start: times.sunset, end: null },
    {
      label: t('photoSpot.light.golden-hour-evening'),
      start: times.goldenHourEveningStart,
      end: times.blueHourEveningStart,
    },
    {
      label: t('photoSpot.light.blue-hour-evening'),
      start: times.blueHourEveningStart,
      end: times.nightStart,
    },
  ];
}
