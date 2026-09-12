/**
 * The parsers, run over a real vault.
 *
 * Unit tests check the shapes this package expects. This checks the shapes a
 * vault actually holds, which is a different question and the one that has
 * caught every reader bug worth catching. It runs only when `APERTRAIL_VAULT`
 * points at a vault and skips otherwise, so nobody's clone depends on
 * somebody else's notes.
 *
 *   APERTRAIL_VAULT=/path/to/Vault npm run test --workspace packages/apertrail
 *
 * It reads and asserts. It writes nothing, ever.
 *
 * **The trap this suite is built around, and NODAtrail's copy records the same
 * one.** The settings are read from the vault's own `data.json`, but a folder
 * key the vault never saved falls back to a default -- and the localized
 * defaults need an initialized I18nManager, which in a test process resolves
 * to ENGLISH. Point this at a German vault and `Plätze/Ausflüge` is looked for
 * at `Plätze/Excursions`, every scan returns nothing, and a suite that only
 * looped over what it found would pass over an empty set. NODAtrail's copy
 * shipped exactly that way and six of its seven tests were vacuous.
 *
 * So the first real assertion here does not loop. It scans the WHOLE vault for
 * each `type:` value and compares that against what `readTravelBoard` managed
 * to read, and reports any note the vault types and the reader missed, with
 * the folder it looked in. That answers "is this suite pointed at anything"
 * and "is a folder setting wrong" and "is a note misfiled" in one line each,
 * and none of the three can hide.
 *
 * `APERTRAIL_LOCALE=de` sets the locale before the defaults are resolved, for
 * a vault whose folders are localized and whose `data.json` never recorded
 * them. Saving the settings page once in Obsidian writes them and makes it
 * unnecessary.
 *
 * **Paths are normalized to NFC, and that is not housekeeping.** macOS and
 * iCloud store filenames DECOMPOSED, so `Restaurant Gifthüttli.md` on disk is
 * `u` plus a combining diaeresis while the `[[Restaurant Gifthüttli]]` typed
 * into a note is the precomposed character. They are different strings and
 * every wikilink to a non-ASCII title fails to resolve. Obsidian normalizes to
 * NFC before anything sees a filename, so the plugin never meets this; a
 * harness reading the filesystem directly meets it immediately, and the first
 * run of this suite reported a perfectly good link as broken. A harness that
 * does not normalize the way Obsidian normalizes is not reading the vault the
 * plugin reads.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// read-entities names 'obsidian' for types only, but its module graph reaches
// the real package through shared/vault-host.ts. The package ships types and
// no runtime, hence the mock -- the same one every reader test here uses.
vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { matchesType } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';
import { I18nManager } from '../src/lang/I18nManager';
import type { APERtrailSettings } from '../src/settings/types';
import { TRAVEL_ENTITY_TYPES, TravelEntityType } from '../src/vault/entity-types';
import { readTravelBoard } from '../src/vault/read-entities';
import { makeFakeVault } from './fake-vault';

const VAULT = process.env.APERTRAIL_VAULT;
const available = VAULT !== undefined && VAULT !== '' && existsSync(VAULT);
const ROOT = VAULT ?? '';

interface Note {
  /** Vault-relative, which is what every folder setting is written in. */
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
}

/**
 * Every markdown note in the vault, with its frontmatter parsed the way
 * Obsidian would.
 *
 * `_resources` and `_exports` are skipped: the first is attachments and the
 * second holds sheets this plugin wrote, and neither is a note anybody typed.
 */
function everyNote(root: string): Note[] {
  if (!root) return [];

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '_resources' || entry.name === '_exports') {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
  };

  return walk(root).map((full) => {
    const text = readFileSync(full, 'utf8');
    const match = /^---\n([\s\S]*?)\n---/.exec(text);
    let frontmatter: Record<string, unknown> = {};
    if (match) {
      try {
        const parsed: unknown = parseYaml(match[1] ?? '');
        if (parsed && typeof parsed === 'object') frontmatter = parsed as Record<string, unknown>;
      } catch {
        // A note somebody is midway through editing reads as no frontmatter,
        // which is what an unterminated block means to Obsidian too.
      }
    }
    // NFC, because Obsidian hands every path and basename over that way and
    // the filesystem here may not. See the note at the top of this file.
    const path = full.slice(root.length + 1).normalize('NFC');
    return { path, title: (path.split('/').pop() ?? '').replace(/\.md$/, ''), frontmatter };
  });
}

/** Where this vault keeps its plugin data. Found rather than named, because the config folder is itself renameable. */
function pluginDataPath(root: string): string | null {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name, 'plugins', 'apertrail', 'data.json');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function settingsFor(root: string): APERtrailSettings {
  const path = root ? pluginDataPath(root) : null;
  if (!path) return DEFAULT_SETTINGS;
  try {
    return mergeSettings(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    // Obsidian is mid-write, or somebody has been editing it by hand. The
    // defaults are wrong for this vault but they are readable, and the first
    // test reports what it looked in rather than only that it found nothing.
    return DEFAULT_SETTINGS;
  }
}

/** The folder setting each entity type is read out of, for naming one in a failure message. */
const TYPE_FOLDER: Record<TravelEntityType, keyof APERtrailSettings> = {
  trip: 'tripsFolder',
  booking: 'bookingsFolder',
  country: 'countriesFolder',
  state: 'statesFolder',
  city: 'citiesFolder',
  accommodation: 'accommodationFolder',
  fnb: 'fnbFolder',
  landmark: 'landmarksFolder',
  location: 'locationsFolder',
  photospot: 'photoSpotsFolder',
  vehicle: 'vehiclesFolder',
  excursion: 'excursionsFolder',
};

describe.skipIf(!available)('the real vault', () => {
  let settings: APERtrailSettings;
  let notes: Note[];
  let board: ReturnType<typeof readTravelBoard>;
  /** Every note the VAULT types, by type value, regardless of where it sits. */
  let typed: Map<TravelEntityType, Note[]>;

  beforeAll(async () => {
    const locale = process.env.APERTRAIL_LOCALE;
    if (locale) await I18nManager.getInstance().setLocale(locale);

    settings = settingsFor(ROOT);
    notes = everyNote(ROOT);
    const typeProperty = settings.typePropertyName.trim() || 'type';

    typed = new Map(
      TRAVEL_ENTITY_TYPES.map((type) => [
        type,
        notes.filter((note) => matchesType(note.frontmatter, typeProperty, type)),
      ])
    );

    board = readTravelBoard(
      makeFakeVault(notes.map((n) => ({ path: n.path, frontmatter: n.frontmatter }))).app,
      settings
    );
  });

  /**
   * What this suite found, said in the assertion label rather than logged.
   *
   * A green run prints nothing -- the house rule is no console in the suite --
   * so the counts ride on the message, where they appear at the one moment
   * anybody needs them: when the answer is that nothing was found and the
   * question is what was looked for.
   */
  function census(): string {
    return TRAVEL_ENTITY_TYPES.map((type) => `${type}=${typed.get(type)?.length ?? 0}`).join(' ');
  }

  it('is pointed at a vault with notes in it', () => {
    expect(notes.length, ROOT).toBeGreaterThan(0);
    expect(
      typed.get('trip')?.length ?? 0,
      `${ROOT}: no note carries type: trip -- found ${census()}`
    ).toBeGreaterThan(0);
  });

  /**
   * The assertion that cannot be vacuous, and the one worth reading a failure
   * from. Every note the vault types has to be a note the reader read; a note
   * that is typed and missing is either under a folder the settings do not
   * name, or under a folder name that resolved differently here than it does
   * in Obsidian.
   */
  it('reads every note the vault types, from the folder configured for it', () => {
    const read: Record<TravelEntityType, Set<string>> = {
      trip: new Set(board.trips.map((x) => x.file.path)),
      booking: new Set(board.bookings.map((x) => x.file.path)),
      country: new Set(board.countries.map((x) => x.file.path)),
      state: new Set(board.states.map((x) => x.file.path)),
      city: new Set(board.cities.map((x) => x.file.path)),
      accommodation: new Set(
        board.places.filter((p) => p.kind === 'accommodation').map((x) => x.file.path)
      ),
      fnb: new Set(board.places.filter((p) => p.kind === 'fnb').map((x) => x.file.path)),
      landmark: new Set(board.places.filter((p) => p.kind === 'landmark').map((x) => x.file.path)),
      location: new Set(board.places.filter((p) => p.kind === 'location').map((x) => x.file.path)),
      photospot: new Set(
        board.places.filter((p) => p.kind === 'photospot').map((x) => x.file.path)
      ),
      vehicle: new Set(board.vehicles.map((x) => x.file.path)),
      excursion: new Set(board.excursions.map((x) => x.file.path)),
    };

    const missed: string[] = [];
    for (const type of TRAVEL_ENTITY_TYPES) {
      for (const note of typed.get(type) ?? []) {
        if (!read[type].has(note.path)) {
          missed.push(
            `${note.path} is type: ${type}, not read from ${settings[TYPE_FOLDER[type]]}`
          );
        }
      }
    }
    expect(missed, census()).toEqual([]);
  });

  it('resolves every link a trip writes, or names the one it cannot', () => {
    const unresolved: string[] = [];
    for (const trip of board.trips) {
      for (const stop of trip.stops) {
        // A place is allowed to be absent -- a brochure line names nowhere --
        // but a link that was WRITTEN and did not parse is a typo.
        if (stop.placeUnresolved) unresolved.push(`${trip.title}: stop place ${stop.placeTitle}`);
        if (stop.placeTitle && !stop.target) {
          unresolved.push(`${trip.title}: stop place [[${stop.placeTitle}]]`);
        }
        if (stop.excursionTitle && !stop.excursion) {
          unresolved.push(`${trip.title}: excursion [[${stop.excursionTitle}]]`);
        }
      }
      for (const night of trip.nights) {
        if (night.accommodationTitle && !night.accommodation) {
          unresolved.push(`${trip.title}: stay [[${night.accommodationTitle}]]`);
        }
      }
      for (const leg of trip.transport) {
        if (leg.vehicleTitle && !leg.vehicle) {
          unresolved.push(`${trip.title}: vehicle [[${leg.vehicleTitle}]]`);
        }
      }
      if (trip.extendsTitle && !trip.extendsTrip) {
        unresolved.push(`${trip.title}: extends [[${trip.extendsTitle}]]`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  /**
   * The two guards, asserted against real notes rather than a fixture.
   *
   * A cycle is not hypothetical: `extends:` is a plain wikilink and nothing
   * stops somebody pointing two trips at each other by hand.
   */
  it('never lets a trip extend itself, and never walks a chain', () => {
    for (const trip of board.trips) {
      expect(
        trip.extensions.map((e) => e.title),
        trip.title
      ).not.toContain(trip.title);
      for (const extension of trip.extensions) {
        expect(extension.extendsTrip?.title, extension.title).toBe(trip.title);
      }
    }
  });

  /**
   * Every variant that names a cabin has to name one the ship lists.
   *
   * The symptom of getting this wrong is silent -- the description simply does
   * not appear on the sheet -- which is exactly the class of thing a real vault
   * finds and a fixture does not.
   */
  it('matches every cabin a leg names against the ship that lists it', () => {
    const unmatched: string[] = [];
    for (const trip of board.trips) {
      for (const leg of trip.transport) {
        if (!leg.vehicle) continue;
        const known = new Set(leg.vehicle.cabins.map((c) => c.name.trim().toLowerCase()));
        for (const variant of leg.variants) {
          const name = variant.name?.trim();
          if (name && known.size > 0 && !known.has(name.toLowerCase())) {
            unmatched.push(`${trip.title}: "${name}" is not a cabin on ${leg.vehicle.title}`);
          }
        }
      }
    }
    expect(unmatched).toEqual([]);
  });
});
