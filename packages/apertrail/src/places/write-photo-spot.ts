/**
 * Vault-write side of a photo spot's photography frontmatter -- see
 * places/photo-spot-note.ts for the pure build/parse logic this wraps.
 *
 * Kept out of create-entities.ts for the same reason write-trip.ts is:
 * creating a photo spot is the plain place-note path the other four kinds
 * take, but a photo spot also has an EDIT path. Motifs, samples and access
 * details are filled in over time, in the block, long after the note was
 * created, and that path brings a requirement plain creation does not:
 * never clobber the note body, which for a real spot is where the prose
 * and the trivia callout live.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { formatDateTimeStamp } from '@technosoftware/trail-core';
import { touchModified } from '../vault/note-stamps';
import { APT_PHOTO_SPOT_BLOCK_LANG } from './photo-spot-block-lang';
import { TravelPlace } from '../vault/types';
import {
  buildPhotoSpotFrontmatter,
  photoSpotPropertyNames,
  PhotoSpotAccessibility,
  PhotoSpotFrontmatterInput,
  photoSpotManagedKeys,
  PhotoSpotMotifInput,
  PhotoSpotSampleInput,
  PhotoSpotTransitInput,
} from './photo-spot-note';

export interface PhotoSpotInput {
  timezone: string | null;
  openingHours: string | null;
  entryFee: string | null;
  accessibility: PhotoSpotAccessibility;
  parking: string | null;
  transit: PhotoSpotTransitInput[];
  motifs: PhotoSpotMotifInput[];
  samples: PhotoSpotSampleInput[];
}

/** The body a photo spot note carries so its block renders from the moment it exists -- see create-entities.ts, which seeds this at creation. */
export function photoSpotBlockBody(): string {
  return `\n\`\`\`${APT_PHOTO_SPOT_BLOCK_LANG}\n\`\`\`\n`;
}

/**
 * A photo spot read back from the vault, as the input shape the writer
 * takes -- so a caller that only wants to toggle one motif's `captured`
 * can round-trip everything else unchanged rather than rebuilding it field
 * by field. Used by the block's per-item editing.
 *
 * A place that is not a photo spot, or one whose note carries none of the
 * photography keys yet, comes back as an empty-but-valid input rather than
 * null. That is what makes "add the first motif to a spot created last
 * month" the same code path as editing an existing one.
 */
export function photoSpotToInput(place: TravelPlace): PhotoSpotInput {
  const spot = place.photoSpot;
  if (!spot) {
    return {
      timezone: null,
      openingHours: null,
      entryFee: null,
      accessibility: 'unknown',
      parking: null,
      transit: [],
      motifs: [],
      samples: [],
    };
  }

  return {
    timezone: spot.timezone,
    openingHours: spot.openingHours,
    entryFee: spot.entryFee,
    accessibility: spot.accessibility,
    parking: spot.parking,
    transit: spot.transit.map((row) => ({ ...row })),
    // name is non-null on the input side; a motif whose name never parsed
    // keeps an empty string so an edit elsewhere on the spot does not
    // silently drop the broken row. Same treatment a stop with an
    // unresolved place link gets in tripToInput().
    motifs: spot.motifs.map((motif) => ({
      name: motif.name ?? '',
      role: motif.role,
      geoLocation: motif.geoLocation ? [...motif.geoLocation] : null,
      direction: motif.direction,
      light: [...motif.light],
      season: [...motif.season],
      lens: motif.lens,
      gear: [...motif.gear],
      technique: motif.technique,
      note: motif.note,
      captured: motif.captured,
      capturedOn: motif.capturedOn,
    })),
    samples: spot.samples.map((sample) => ({
      image: sample.image ?? '',
      motifName: sample.motifName,
      light: sample.light,
      exposure: sample.exposure,
      credit: sample.credit,
    })),
  };
}

function frontmatterInput(
  settings: APERtrailSettings,
  input: PhotoSpotInput,
  now: Date | null
): PhotoSpotFrontmatterInput {
  return {
    properties: photoSpotPropertyNames(settings),
    ...input,
    modified: now ? formatDateTimeStamp(now) : null,
  };
}

/**
 * Updates an existing photo spot note in place through
 * processFrontMatter(), so the body survives an edit untouched.
 *
 * Stale keys are cleared before the new values are applied rather than
 * Object.assign-ing over the top, because buildPhotoSpotFrontmatter() only
 * ever emits the keys that SHOULD currently be present: a motif list
 * emptied during this edit would otherwise linger from before it. Only the
 * keys this schema owns are cleared (photoSpotManagedKeys), so the note's
 * country, city, rating, visited flag, `icon:`, `image:` and everything
 * else a user hand-added are left exactly as they were. See that
 * function's own comment for why `visited` in particular is off limits.
 *
 * `created` is one of those untouched keys, and deliberately so: the photo
 * spot schema neither emits it nor manages it, so a spot keeps the stamp
 * create-entities.ts wrote when the note was made, however often it is
 * edited afterwards. See vault/note-stamps.ts.
 */
export async function updatePhotoSpotNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  input: PhotoSpotInput,
  now: Date = new Date()
): Promise<TFile> {
  const properties = photoSpotPropertyNames(settings);
  const yaml = buildPhotoSpotFrontmatter(frontmatterInput(settings, input, now));
  const managed = photoSpotManagedKeys(properties);

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, yaml);
  });

  return file;
}

/**
 * Appends the photo spot block to a note that has none -- for spots
 * created before the block existed, or written by hand. Returns false
 * (writing nothing) when the note already has one, so this is safe to call
 * unconditionally after an edit. Mirrors ensureItineraryBlock(), including
 * why appending stamps `modified` with no flag to suppress it: creation
 * seeds this block into the note's initial content (create-entities.ts), so
 * a call made straight after creation finds it and writes nothing. Only a
 * note that genuinely lacked the block reaches the append, and that is a
 * repair of an older note.
 */
export async function ensurePhotoSpotBlock(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  now: Date = new Date()
): Promise<boolean> {
  const existing = await app.vault.read(file);
  if (existing.includes(`\`\`\`${APT_PHOTO_SPOT_BLOCK_LANG}`)) return false;
  await app.vault.append(file, photoSpotBlockBody());
  await touchModified(app, settings, file, now);
  return true;
}
