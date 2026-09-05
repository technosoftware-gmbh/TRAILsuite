/**
 * Turns one photo spot note into a field sheet on disk.
 *
 * The App-bound half of the export: it reads the spot, resolves every
 * string through the same helpers the block draws with, inlines the sample
 * images so the file needs nothing around it, and writes the result into
 * the vault beside the note. `export-photo-spot.ts` turns the result into
 * markup and knows nothing about Obsidian.
 *
 * Two decisions worth stating. The sheet is written INTO the vault rather
 * than offered as a download, because a plugin cannot hand a file to the
 * operating system and a vault is where the user's own files already live.
 * And it overwrites a sheet of the same name without asking: it is a
 * rendering of a note, not a document somebody edits, and a folder full of
 * "Spot 3.html" would be worse than a stale copy replaced.
 */
import { App, Notice, TFile, normalizePath } from 'obsidian';
import {
  lightRelation,
  parseGeoPoint,
  sanitizeTitle,
  SUN_ELEVATIONS,
  sunPosition,
  sunTimes,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TravelPlace } from '../../vault/types';
import { formatClockIn, hour12For } from '../../shared/clock';
import { resolveImageFile } from '../../ui/components/image-resolve';
import {
  buildFieldSheetHtml,
  FieldSheet,
  FieldSheetMotif,
  FieldSheetSample,
} from '../export-photo-spot';
import {
  deviceTimeZone,
  gearLabel,
  logisticsRows,
  motifCapture,
  motifCoordinates,
  motifDirection,
  motifOffset,
  motifSeason,
  sunRows,
} from '../photo-spot-text';
import { ParsedPhotoSpotSample } from '../photo-spot-note';
import { lightWindowRange } from '../solar';
import { MotifSection, photoSpotView } from '../photo-spot-view';
import { formatMediumDate } from '../../shared/display';

/** Longest edge a sample is scaled to before it goes into the file. Enough for a printed 52 mm frame at well over 300 dpi, and small enough that four of them stay a file you can mail. */
const MAX_IMAGE_EDGE = 1400;

/**
 * A sample image as a data URL, downscaled on the way.
 *
 * Downscaling matters more than it looks: a sheet with four straight-out-of
 * camera frames would be forty megabytes, which is not a file anybody sends
 * anywhere. Anything the canvas cannot read (an unusual format, a file that
 * has gone missing) comes back null, and the caption prints without it.
 */
async function inlineImage(app: App, value: string): Promise<string | null> {
  const file = resolveImageFile(app, value);
  if (!file) return null;

  try {
    const bytes = await app.vault.readBinary(file);
    const blob = new Blob([bytes]);
    const bitmap = await createImageBitmap(blob);

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = activeDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    // A sample that cannot be read is not a reason to refuse the sheet.
    return null;
  }
}

async function sheetSample(app: App, sample: ParsedPhotoSpotSample): Promise<FieldSheetSample> {
  return {
    src: sample.image ? await inlineImage(app, sample.image) : null,
    caption: sample.light ? t(`photoSpot.light.${sample.light}`) : (sample.credit ?? null),
    exposure: sample.exposure,
  };
}

async function sheetMotif(
  app: App,
  section: MotifSection,
  context: {
    anchor: { lat: number; lon: number } | null;
    date: Date;
    timeZone: string | undefined;
    hour12: boolean | undefined;
    units: APERtrailSettings['units'];
  }
): Promise<FieldSheetMotif> {
  const { motif } = section;
  const point = parseGeoPoint(motif.geoLocation) ?? context.anchor;

  const light = motif.light.map((window) => {
    const range = point ? lightWindowRange(window, context.date, point.lat, point.lon) : null;
    const clock = (moment: Date): string => formatClockIn(moment, context.timeZone, context.hour12);
    return {
      label: t(`photoSpot.light.${window}`),
      // The same three shapes the block draws: an instant, a span, and a
      // window with no end on this date.
      time: !range
        ? null
        : !range.end
          ? t('photoSpot.lightFrom', { time: clock(range.start) })
          : range.end.valueOf() === range.start.valueOf()
            ? clock(range.start)
            : `${clock(range.start)} - ${clock(range.end)}`,
    };
  });

  let relation: string | null = null;
  if (point && motif.direction !== null && motif.light.length > 0) {
    const first = lightWindowRange(motif.light[0], context.date, point.lat, point.lon);
    if (first) {
      const middle = new Date((first.start.valueOf() + (first.end ?? first.start).valueOf()) / 2);
      const which = lightRelation(
        sunPosition(middle, point.lat, point.lon).azimuth,
        motif.direction
      );
      relation = t(`photoSpot.relation.${which}`);
    }
  }

  const samples: FieldSheetSample[] = [];
  for (const sample of section.samples) samples.push(await sheetSample(app, sample));

  return {
    name: motif.name ?? t('photoSpot.unnamedMotif'),
    role: t(`photoSpot.role.${motif.role}`),
    isMain: motif.role === 'main',
    coordinates: motifCoordinates(motif),
    direction: motifDirection(motif),
    lens: motif.lens,
    season: motifSeason(motif),
    gear: motif.gear.map(gearLabel),
    light,
    relation,
    technique: motif.technique,
    note: motif.note,
    capture: motifCapture(motif),
    captured: motif.captured,
    offset: motifOffset(section.offset, context.units),
    samples,
  };
}

/** The whole sheet as a model, before it is markup. Separate from the writing so a caller could preview it. */
export async function buildFieldSheet(
  app: App,
  settings: APERtrailSettings,
  place: TravelPlace,
  date: Date
): Promise<FieldSheet | null> {
  const spot = place.photoSpot;
  if (!spot) return null;

  const anchor = parseGeoPoint(place.geoLocation);
  const noteZone = spot.timezone?.trim();
  const zone = noteZone ? noteZone : t('photoSpot.deviceTimeZone', { zone: deviceTimeZone() });
  const hour12 = hour12For(settings.clockFormat);
  const view = photoSpotView(spot, place.geoLocation);

  const context = { anchor, date, timeZone: noteZone || undefined, hour12, units: settings.units };

  const motifs: FieldSheetMotif[] = [];
  for (const section of view.sections) motifs.push(await sheetMotif(app, section, context));

  const looseSamples: FieldSheetSample[] = [];
  for (const sample of view.looseSamples) looseSamples.push(await sheetSample(app, sample));

  // No coordinates means no sun, and a sheet that says nothing about light
  // rather than one computed at Null Island.
  const times = anchor ? sunTimes(date, anchor.lat, anchor.lon) : null;
  const sun = times
    ? sunRows(times)
        .filter((row) => row.start !== null)
        .map((row) => ({
          label: row.label,
          value: row.end
            ? `${formatClockIn(row.start, context.timeZone, hour12)} - ${formatClockIn(row.end, context.timeZone, hour12)}`
            : formatClockIn(row.start, context.timeZone, hour12),
        }))
    : [];

  // Only solar noon survived: the sun crossed nothing that day, and its
  // altitude at noon decides which side of the horizon it stayed on.
  const polarNote =
    times && anchor && sun.length <= 1
      ? sunPosition(times.solarNoon, anchor.lat, anchor.lon).altitude > SUN_ELEVATIONS.horizon
        ? t('photoSpot.polarDay')
        : t('photoSpot.polarNight')
      : null;

  const hierarchy = [place.countryTitle, place.cityTitle].filter(Boolean).join(' > ');

  return {
    title: place.title,
    subtitle: hierarchy || null,
    rating: place.rating,
    coordinates: anchor ? `${anchor.lat}, ${anchor.lon}` : null,
    zone: anchor ? zone : null,
    dateLine: t('photoSpot.lightOn', { date: formatMediumDate(date) }),
    sun,
    polarNote,
    motifs,
    looseSamples,
    logistics: logisticsRows(place, spot).map((row) => ({
      label: row.label,
      value: row.value,
    })),
    caveat: t('photoSpot.sunCaveat'),
    footer: t('photoSpot.export.footer', { date: formatMediumDate(new Date()) }),
    labels: {
      motifs: t('photoSpot.motifs'),
      light: t('photoSpot.export.light'),
      samples: t('photoSpot.otherSamples'),
      onSite: t('photoSpot.onSite'),
    },
  };
}

/**
 * Writes the sheet beside its note and says where it went.
 *
 * Beside the note rather than in an export folder of its own: the sheet
 * belongs to the spot, and a folder the plugin invented would be a ninth
 * place for a vault to keep track of. The name carries a suffix so it can
 * never collide with the note itself.
 */
export async function exportPhotoSpotSheet(
  app: App,
  settings: APERtrailSettings,
  place: TravelPlace,
  date: Date
): Promise<void> {
  const sheet = await buildFieldSheet(app, settings, place, date);
  if (!sheet) {
    new Notice(t('photoSpot.notAPhotoSpot'));
    return;
  }

  const folder = place.file.parent?.path ?? '';
  const name = sanitizeTitle(`${place.title} ${t('photoSpot.export.fileSuffix')}`);
  const path = normalizePath(folder ? `${folder}/${name}.html` : `${name}.html`);
  const html = buildFieldSheetHtml(sheet);

  try {
    const existing = app.vault.getFileByPath(path);
    if (existing instanceof TFile) await app.vault.modify(existing, html);
    else await app.vault.create(path, html);
    new Notice(t('photoSpot.export.written', { path }));
  } catch (err) {
    new Notice(err instanceof Error ? err.message : t('photoSpot.export.failed'));
  }
}
