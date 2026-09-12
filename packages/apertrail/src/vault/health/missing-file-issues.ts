/**
 * References to files the vault does not have.
 *
 * A picture, a gallery entry, a cabin's photograph, a ship's deck plan: every
 * one of them is a value in frontmatter naming another file, and every reader
 * of one treats a value it cannot resolve exactly as it treats no value at
 * all. That is the right behaviour at render time -- a card with a broken
 * image draws the empty slot rather than a broken-image icon -- and it means
 * the failure is completely silent.
 *
 * It has already cost a real vault: a `_ressources` folder with one letter too
 * many hid a ship's hero image, two cabin pictures and every `<img>` on an
 * exported brochure, and nothing anywhere said so. See note 40.
 *
 * A warning and never an error, and with no `apply` half: what a path was
 * meant to say is a question only the person who typed it can answer, and a
 * plugin guessing at the nearest filename is how a vault gets a wrong picture
 * instead of no picture.
 *
 * The rule half is pure and takes a resolver, so it is testable without a
 * vault; the scan half walks the same boards every other surface reads.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../../settings/types';
import { readCrmBoard } from '../../crm/read-crm';
import { frontmatterOf } from '../../shared/vault-host';
import { resolveReference } from '../../shared/vault-file';
import { readTravelBoard } from '../read-entities';

/** One value in one note that names another file. */
export interface FileReference {
  /** The frontmatter property it came from, so the row can say where to look. */
  property: string;
  value: string;
  /**
   * Which entry of a list it was, when it came from one: a cabin's name, a
   * gallery caption. Null for a plain single-valued property, where the
   * property name alone already says everything.
   */
  detail: string | null;
}

export type MissingFileIssue = FileReference & { file: TFile };

/** What a value turned out to be. `url` is a deliberate answer, not a failure: a value pointing out of the vault is not a file, and is not a mistake. */
export type ReferenceKind = 'url' | 'file' | 'missing';

/**
 * The references that point at nothing.
 *
 * An empty or whitespace value is not a broken reference, it is an absent
 * one, and every reader here already treats it that way. Warning about it
 * would report the ordinary state of most notes.
 */
export function missingReferences(
  references: FileReference[],
  resolve: (value: string) => ReferenceKind
): FileReference[] {
  return references.filter((reference) => {
    const value = reference.value.trim();
    if (value === '') return false;
    return resolve(value) === 'missing';
  });
}

/**
 * Every file reference in the vault that resolves to nothing, in path order.
 *
 * `image` is read straight from frontmatter rather than from the board,
 * because that is how the card reads it: it is a property of every entity
 * type the plugin draws, and only the trip and the vehicle carry it in a
 * parsed shape.
 */
export function scanMissingFileIssues(app: App, settings: APERtrailSettings): MissingFileIssue[] {
  const board = readTravelBoard(app, settings);
  const crmBoard = readCrmBoard(app, settings);

  const byFile = new Map<TFile, FileReference[]>();
  const add = (
    file: TFile,
    property: string,
    value: string | null,
    detail: string | null
  ): void => {
    if (!value) return;
    const existing = byFile.get(file);
    if (existing) existing.push({ property, value, detail });
    else byFile.set(file, [{ property, value, detail }]);
  };

  const everyEntity = [
    ...board.trips,
    ...board.countries,
    ...board.states,
    ...board.cities,
    ...board.places,
    ...board.vehicles,
    ...crmBoard.persons,
    ...crmBoard.companies,
  ];
  for (const entity of everyEntity) {
    const raw = frontmatterOf(app, entity.file)?.[settings.imageProperty];
    if (typeof raw === 'string') add(entity.file, settings.imageProperty, raw, null);
  }

  // Every one of these carries `image:` and `gallery:` in the same two
  // properties (vault/read-cover.ts), so the galleries are one loop rather
  // than one per type. It was two types when this check was written.
  for (const entity of everyEntity) {
    for (const picture of 'gallery' in entity ? entity.gallery : []) {
      add(entity.file, settings.tripGalleryProperty, picture.image, picture.caption);
    }
  }

  for (const vehicle of board.vehicles) {
    for (const cabin of vehicle.cabins) {
      add(vehicle.file, settings.vehicleCabinsProperty, cabin.image, cabin.name);
    }
    add(vehicle.file, settings.vehicleDeckPlanProperty, vehicle.deckPlan, null);
  }

  // A photo spot's samples are a picture list like any other, and a sample
  // whose frame has gone missing is exactly the failure this check is for.
  for (const place of board.places) {
    for (const sample of place.photoSpot?.samples ?? []) {
      add(place.file, settings.samplesProperty, sample.image, sample.motifName);
    }
  }

  const issues: MissingFileIssue[] = [];
  for (const [file, references] of byFile) {
    const missing = missingReferences(references, (value) => resolveReference(app, value).kind);
    for (const reference of missing) {
      issues.push({ ...reference, file });
    }
  }

  return issues.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
