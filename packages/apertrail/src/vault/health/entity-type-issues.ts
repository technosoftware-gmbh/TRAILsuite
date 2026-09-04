/**
 * Scans APERtrail's eleven entity folders for notes whose `type:`
 * frontmatter is missing or disagrees with the folder they sit in.
 *
 * Every one of the eleven folders maps to exactly one entity type, which is
 * the unambiguous case this kind of check handles well: there is always a
 * confident suggestion, never a guess.
 *
 * The nine travel folders expect a fixed literal; the two CRM folders
 * expect whatever `personTypeValue` and `companyTypeValue` hold, since a
 * vault points those at what its own notes already say. A CRM folder whose
 * type value has been cleared is skipped rather than scanned: with no
 * expected value there is nothing to suggest, and flagging every note in
 * the folder would be noise rather than a finding.
 *
 * The longest-match rule below is not incidental. In a typical vault the
 * folders are nested under module roots (`.../Places/Cities`,
 * `.../CRM/People`), and a user is free to point two of them at
 * overlapping paths -- or at a root itself. Scoring each file against
 * every folder it falls under and keeping the most specific match is what
 * stops a Landmark note from being judged against a broader, less specific
 * configuration.
 *
 * This is the one folder-and-type scan that cannot be trail-core's
 * `readNotesOfType()`: that answers "which notes ARE this kind", and the
 * whole point here is the notes that are not. What it does share is the
 * verdict -- `matchesType()` decides whether a note already counts, so the
 * check can never offer to "fix" a note the readers are perfectly happy
 * with, which is what a second, stricter copy of the rule here would do to
 * every `type:` the property editor has turned into a list.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { isInTripBookingsFolder } from '../../trips/trip-folder';
import { isUnderFolder, matchesType, readString, stampModified, stripWikilink } from 'trail-core';
import { frontmatterOf } from '../../shared/vault-host';

export type EntityFolderLocation =
  | 'trips'
  | 'bookings'
  | 'countries'
  | 'states'
  | 'cities'
  | 'accommodation'
  | 'fnb'
  | 'landmarks'
  | 'locations'
  | 'photoSpots'
  | 'persons'
  | 'companies';

export interface EntityTypeIssue {
  file: TFile;
  location: EntityFolderLocation;
  /** The note's current value under the configured type property, or null if absent/blank. */
  currentType: string | null;
  /** A string rather than a TravelEntityType: the two CRM locations expect a configured value, not a literal from the fixed vocabulary. */
  suggestedType: string;
  reason: 'missing' | 'mismatch';
}

interface LocationConfig {
  location: EntityFolderLocation;
  folder: string;
  expectedType: string;
}

function locationConfigs(settings: APERtrailSettings): LocationConfig[] {
  const configs: LocationConfig[] = [
    { location: 'trips', folder: settings.tripsFolder, expectedType: 'trip' },
    // Nested under the Trips folder by default, which the longest-match rule
    // below handles: a booking note is judged against the bookings folder
    // rather than against the trips folder it also sits under.
    { location: 'bookings', folder: settings.bookingsFolder, expectedType: 'booking' },
    { location: 'countries', folder: settings.countriesFolder, expectedType: 'country' },
    { location: 'states', folder: settings.statesFolder, expectedType: 'state' },
    { location: 'cities', folder: settings.citiesFolder, expectedType: 'city' },
    {
      location: 'accommodation',
      folder: settings.accommodationFolder,
      expectedType: 'accommodation',
    },
    { location: 'fnb', folder: settings.fnbFolder, expectedType: 'fnb' },
    { location: 'landmarks', folder: settings.landmarksFolder, expectedType: 'landmark' },
    { location: 'locations', folder: settings.locationsFolder, expectedType: 'location' },
    { location: 'photoSpots', folder: settings.photoSpotsFolder, expectedType: 'photospot' },
    // Configured rather than literal, and trimmed here so a value saved
    // with stray whitespace still compares equal to what a note carries.
    { location: 'persons', folder: settings.personsFolder, expectedType: settings.personTypeValue },
    {
      location: 'companies',
      folder: settings.companiesFolder,
      expectedType: settings.companyTypeValue,
    },
  ];
  // Trimmed once, here, so a type value saved with stray whitespace still
  // compares equal to what a note actually carries.
  return configs.map((config) => ({ ...config, expectedType: config.expectedType.trim() }));
}

/**
 * The most specific (longest folder path) config a file falls under, or null if
 * it's outside every configured location.
 *
 * **A booking inside a trip's own folder is judged as a booking**, before the
 * longest-match rule runs. Since a trip became a folder, such a note sits at
 * `Trips/Shongololo/Bookings/X.md`: under the trips folder, and under no
 * bookings folder at all, because the configured one is a fixed path that does
 * not contain it. Without this every one of them would be reported on the next
 * vault check as a trip note carrying the wrong type -- a whole category of
 * false findings, on the first run after the folder change shipped.
 */
function bestMatch(
  file: TFile,
  configs: LocationConfig[],
  settings: APERtrailSettings
): LocationConfig | null {
  if (
    isInTripBookingsFolder(file.path, settings) &&
    isUnderFolder(file.path, settings.tripsFolder)
  ) {
    return configs.find((config) => config.location === 'bookings') ?? null;
  }

  let best: LocationConfig | null = null;
  for (const config of configs) {
    if (!config.folder.trim()) continue; // unconfigured location -- nothing to scan
    // A CRM location whose type value has been cleared: there is no
    // expected value, so there is nothing this check could suggest.
    if (!config.expectedType) continue;
    if (!isUnderFolder(file.path, config.folder)) continue;
    if (!best || config.folder.length > best.folder.length) best = config;
  }
  return best;
}

/**
 * The note's own type value as text, for the report and the suggestion row.
 *
 * Reads the same shapes `matchesType()` accepts, so a note whose `type:` is
 * a list or a wikilink is reported as carrying the wrong value rather than
 * as carrying none. Getting that wrong would not just misword a row: the
 * two reasons are what the modal offers to do about it.
 */
function currentTypeValue(
  frontmatter: Record<string, unknown>,
  propertyName: string
): string | null {
  const raw = frontmatter[propertyName];
  const candidates = Array.isArray(raw) ? (raw as unknown[]) : [raw];

  for (const candidate of candidates) {
    const text = readString(candidate);
    if (text !== null) return stripWikilink(text);
  }
  return null;
}

export function scanEntityTypeIssues(app: App, settings: APERtrailSettings): EntityTypeIssue[] {
  const propertyName = settings.typePropertyName.trim() || 'type';
  const configs = locationConfigs(settings);
  const issues: EntityTypeIssue[] = [];

  for (const file of app.vault.getMarkdownFiles()) {
    const config = bestMatch(file, configs, settings);
    if (!config) continue;

    const frontmatter = frontmatterOf(app, file) ?? {};
    if (matchesType(frontmatter, propertyName, config.expectedType)) continue;

    const current = currentTypeValue(frontmatter, propertyName);
    issues.push({
      file,
      location: config.location,
      currentType: current,
      suggestedType: config.expectedType,
      reason: current === null ? 'missing' : 'mismatch',
    });
  }

  // Stable, predictable order for the review modal: by location (in the
  // same order the locations are configured above), then by path.
  const locationOrder = configs.map((c) => c.location);
  issues.sort((a, b) => {
    const locDiff = locationOrder.indexOf(a.location) - locationOrder.indexOf(b.location);
    if (locDiff !== 0) return locDiff;
    return a.file.path.localeCompare(b.file.path);
  });

  return issues;
}

/**
 * Rewrites one note's `type:` to the value the check suggested.
 *
 * That is an edit of an existing note, so it stamps `modified` in the same
 * processFrontMatter pass rather than a second one: two passes over a file
 * for a single logical fix would be two vault writes and two cache
 * invalidations. `created` is left alone, here as everywhere else -- see
 * vault/note-stamps.ts.
 */
export async function applyEntityType(
  app: App,
  settings: APERtrailSettings,
  issue: EntityTypeIssue,
  newType: string,
  now: Date = new Date()
): Promise<void> {
  const propertyName = settings.typePropertyName.trim() || 'type';
  const trimmed = newType.trim();
  if (!trimmed) return;
  await app.fileManager.processFrontMatter(issue.file, (fm) => {
    const record = fm as Record<string, unknown>;
    record[propertyName] = trimmed;
    stampModified(record, settings, now);
  });
}
