/**
 * The sample notes, written into a vault and read back by the real parsers.
 *
 * This package had no `sample-vault.test.ts` before this one, so nothing was
 * replaced. What it replaces in spirit is `docs/design/sample-vault.md`, which
 * described a vault that was never shipped and that no test could reach: the
 * claims in its "what each folder demonstrates" table are asserted here
 * instead, against the notes the command actually writes.
 *
 * **Nothing below compares note text to a string it expects.** A hand-authored
 * note whose heading or wikilink is subtly wrong looks perfectly fine in
 * Markdown and renders as an empty view, so every assertion goes through the
 * reader that will read the note in production: `readTravelBoard`,
 * `readCrmBoard`, `parsePhotoSpotRecord` by way of the place reader, and
 * trail-core's own `readSummary`. The two exceptions are deliberate and are
 * about the file rather than about its meaning: whether a fenced block is
 * present, and whether every wikilink in the set names a note the set contains.
 *
 * ## The harness is a real YAML round trip, and that is the point
 *
 * Every note is serialised by a real YAML writer and parsed back by a real YAML
 * reader, so what a reader sees here is what Obsidian would hand it rather than
 * the object the seeder built. That is what gives the datetime assertions
 * teeth: a value handed over as a native `Date` is written as a bare timestamp
 * and comes back as something other than the string it left as, which is
 * exactly the sharp edge docs/design/data-model.md describes. A stub that
 * handed the frontmatter object straight back would see none of it.
 */
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

/**
 * The `obsidian` module the whole suite runs against.
 *
 * `stringifyYaml` is a real YAML writer standing in for the host's, and the two
 * rules it models are the two that matter to the notes below. **A string is
 * quoted**, which is what `trip-note.ts` relies on in so many words when it
 * says a datetime leaves as a quoted string. **A `Date` is not**: it is written
 * as a bare YAML timestamp, which is the whole reason the plugin never hands
 * the writer one. A stand-in that quoted a Date too would make the sharp edge
 * unreachable and the assertion about it unfailable.
 *
 * `TFile` is a real class rather than a thrower, because `read-folders.ts`
 * tells a folder's notes from its subfolders by `instanceof` and a test that
 * could not make an object pass that check would be testing the empty branch.
 * The factory is hoisted above every import in this file, so everything it
 * needs is built inside it.
 */
vi.mock('obsidian', async () => {
  const { stringify, Scalar } = await import('yaml');

  /** A Date, as a scalar the writer will not quote. Anything else is left for `stringify` to judge. */
  const bareTimestamps = (value: unknown): unknown => {
    if (value instanceof Date) {
      const scalar = new Scalar(value.toISOString());
      scalar.type = 'PLAIN';
      return scalar;
    }
    if (Array.isArray(value)) return value.map(bareTimestamps);
    if (value && typeof value === 'object' && !(value instanceof Scalar)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, bareTimestamps(entry)])
      );
    }
    return value;
  };

  class TFile {
    path = '';
    basename = '';
    name = '';
    extension = 'md';
    parent: { path: string } = { path: '' };

    constructor(path?: string) {
      if (path === undefined) return;
      const cut = path.lastIndexOf('/');
      this.path = path;
      this.name = path.slice(cut + 1);
      this.basename = this.name.replace(/\.md$/, '');
      this.parent = { path: cut === -1 ? '' : path.slice(0, cut) };
    }
  }

  return {
    normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
    stringifyYaml: (obj: Record<string, unknown>) =>
      stringify(bareTimestamps(obj), {
        defaultStringType: 'QUOTE_DOUBLE',
        defaultKeyType: 'PLAIN',
        lineWidth: 0,
      }),
    TFile,
    Notice: class {},
  };
});

import { App, stringifyYaml, TFile } from 'obsidian';
import {
  planSampleVault,
  readSummary,
  sampleFolders,
  sampleVaultWritable,
  splitFrontmatterBlock,
  type SampleNote,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { sampleNotes } from '../src/sample/notes';
import { sampleFolderContents } from '../src/sample/read-folders';
import { SampleVaultRefusedError, writeSampleVault } from '../src/sample/write';
import { readTravelBoard } from '../src/vault/read-entities';
import { readCrmBoard } from '../src/crm/read-crm';
import { crmPropertyNames } from '../src/crm/crm-note';
import { captureState, primaryMotif } from '../src/places/photo-spot-note';
import { TRAVEL_RELATED_TRIPS_BLOCK_LANG } from '../src/trips/related-trips-block-lang';
import { APT_PHOTO_SPOT_BLOCK_LANG } from '../src/places/photo-spot-block-lang';
import { TRAVEL_ITINERARY_BLOCK_LANG } from '../src/trips/write-trip';
import { APT_TRIP_COSTS_BLOCK_LANG } from '../src/trips/costs/trip-costs-block-lang';

const settings = DEFAULT_SETTINGS;

/** A fixed clock, so the created stamp and the derived trip status are the same on every run. */
const NOW = new Date('2026-03-01T08:00:00');
/** The day the board is read on: after the Rovos trip and before the Aargau weekend. */
const TODAY = '2026-03-01';

interface FakeVault {
  app: App;
  /** Every note in the vault, by path. */
  files: Map<string, string>;
}

/**
 * A vault that stores note text and parses frontmatter out of it on demand.
 *
 * Storing text rather than a frontmatter object is what makes this a round trip:
 * everything a reader sees has been through the writer and back through a
 * parser, so a value the seeder handed over as a `Date`, or one the writer left
 * unquoted, arrives at the reader in whatever shape YAML actually gives it.
 */
function makeVault(initial: { path: string; text: string }[] = []): FakeVault {
  const files = new Map<string, string>(initial.map((note) => [note.path, note.text]));
  const folders = new Set<string>();

  const register = (path: string): void => {
    const cut = path.lastIndexOf('/');
    let folder = cut === -1 ? '' : path.slice(0, cut);
    while (folder) {
      folders.add(folder);
      const up = folder.lastIndexOf('/');
      folder = up === -1 ? '' : folder.slice(0, up);
    }
  };
  for (const path of files.keys()) register(path);

  const fileFor = (path: string): TFile => new (TFile as unknown as new (p: string) => TFile)(path);

  const frontmatterOf = (path: string): Record<string, unknown> => {
    const header = splitFrontmatterBlock(files.get(path) ?? '').header;
    if (!header) return {};
    const parsed: unknown = parseYaml(header.replace(/^---\n/, '').replace(/---\n$/, ''));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  };

  const app = {
    vault: {
      getMarkdownFiles: () => [...files.keys()].map(fileFor),
      getFileByPath: (path: string) => (files.has(path) ? fileFor(path) : null),
      getAbstractFileByPath: (path: string) =>
        files.has(path) ? fileFor(path) : folders.has(path) ? { path } : null,
      getFolderByPath: (path: string) => {
        if (!folders.has(path)) return null;
        const children = [...files.keys()]
          .filter((notePath) => notePath.slice(0, notePath.lastIndexOf('/')) === path)
          .map(fileFor);
        return { path, children };
      },
      createFolder: async (path: string) => {
        folders.add(path);
      },
      create: async (path: string, content: string) => {
        files.set(path, content);
        register(path);
        return fileFor(path);
      },
      read: async (file: TFile) => files.get(file.path) ?? '',
      cachedRead: async (file: TFile) => files.get(file.path) ?? '',
      append: async (file: TFile, content: string) => {
        files.set(file.path, (files.get(file.path) ?? '') + content);
      },
      modify: async (file: TFile, content: string) => {
        files.set(file.path, content);
      },
    },
    metadataCache: {
      getFileCache: (file: TFile) => ({ frontmatter: frontmatterOf(file.path) }),
    },
    fileManager: {
      processFrontMatter: async (file: TFile, edit: (fm: Record<string, unknown>) => void) => {
        const text = files.get(file.path) ?? '';
        const { body } = splitFrontmatterBlock(text);
        const front = frontmatterOf(file.path);
        edit(front);
        // The host's own writer, exactly as Obsidian's `processFrontMatter`
        // re-serialises with the same one it wrote the note with.
        files.set(file.path, `---\n${stringifyYaml(front).trimEnd()}\n---\n${body}`);
      },
    },
  } as unknown as App;

  return { app, files };
}

/** Seeds a fresh vault the way the command does: plan against what is there, then write. */
async function seed(
  existing: { path: string; text: string }[] = []
): Promise<{ vault: FakeVault; notes: SampleNote[] }> {
  const vault = makeVault(existing);
  const notes = sampleNotes(settings, NOW);
  const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));
  await writeSampleVault(vault.app, settings, plan, NOW);
  return { vault, notes };
}

/** Every title the seeded set contains, which is what a wikilink has to resolve against. */
function seededTitles(notes: readonly SampleNote[]): Set<string> {
  return new Set(notes.map((note) => note.title));
}

describe('the sample notes', () => {
  const notes = sampleNotes(settings, NOW);

  it('is sixteen notes across the folders the default settings name', () => {
    expect(notes).toHaveLength(16);
    expect(sampleFolders(notes)).toEqual([
      'Places/Countries',
      'Places/States',
      'Places/Cities',
      'Places/Accommodation',
      'Places/Food & Beverages',
      'Places/Landmarks',
      'Places/Locations',
      'Places/Photo Spots',
      // A trip is a folder of its own, named after the trip: see trip-folder.ts.
      'Trips/Rovos Rail 2026',
      'Trips/Aargau Weekend',
      'CRM/People',
      'CRM/Companies',
    ]);
  });

  it('gives every note a folder and a type value, so none of them is invisible to its own reader', () => {
    for (const note of notes) {
      expect(note.folder.trim(), note.title).not.toBe('');
      expect(note.typeValue.trim(), note.title).not.toBe('');
    }
  });

  it('marks the CRM notes as shared and nothing else', () => {
    // Sharing is what stops the run refusing over a sibling's note, so it has
    // to stay confined to the folders more than one plugin actually writes: a
    // stray flag on a Trips or Places note would quietly disarm the refusal
    // rule on a folder holding somebody's real work.
    expect(notes.filter((note) => note.shared).map((note) => note.title)).toEqual([
      'Stefan',
      'Erika',
      'Rovos Rail Charters',
    ]);
    for (const note of notes.filter((note) => note.shared)) {
      expect([settings.personsFolder, settings.companiesFolder], note.title).toContain(note.folder);
    }
  });

  it('resolves every wikilink it writes to a note it also writes', () => {
    const titles = seededTitles(notes);
    const written = notes.map((note) => JSON.stringify(note.properties) + note.body).join('\n');

    const targets = [...written.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) =>
      m[1].trim()
    );
    expect(targets.length).toBeGreaterThan(10);
    expect([...new Set(targets)].filter((target) => !titles.has(target))).toEqual([]);
  });

  it('hands the writer no native Date, so nothing with a clock time can lose it', () => {
    // The failure this guards is invisible in the note and in the diff: a Date
    // is serialised unquoted, read back as a Date, and truncated to a day.
    const walk = (value: unknown, where: string): void => {
      expect(value, where).not.toBeInstanceOf(Date);
      if (Array.isArray(value)) value.forEach((entry, i) => walk(entry, `${where}[${i}]`));
      else if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) walk(entry, `${where}.${key}`);
      }
    };
    for (const note of notes) walk(note.properties, note.title);
  });

  it('writes no visited or lastVisit except on the one note that means to', () => {
    // Both are derived from the trips that stop at a place. The exception is
    // Brugg, where an explicit value is there to show that an explicit value
    // wins over the derived one.
    const carrying = notes
      .filter(
        (note) =>
          settings.visitedProperty in note.properties ||
          settings.lastVisitProperty in note.properties
      )
      .map((note) => note.title);
    expect(carrying).toEqual(['Brugg']);
  });
});

describe('the seeded vault, read back', () => {
  it('parses as two countries, one state, three cities, five places and two trips', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);

    expect(board.countries.map((c) => c.title)).toEqual(['South Africa', 'Switzerland']);
    expect(board.states.map((s) => s.title)).toEqual(['Aargau']);
    expect(board.cities.map((c) => c.title)).toEqual(['Brugg', 'Cape Town', 'Pretoria']);
    expect(board.places.map((p) => p.title)).toEqual([
      'Aare Riverside Path',
      'Cafe Fahrwerk',
      'Signal Hill',
      'Table Bay Lodge',
      'Table Mountain',
    ]);
    expect(board.trips.map((t) => t.title)).toEqual(['Aargau Weekend', 'Rovos Rail 2026']);
  });

  it('resolves the country / state / city cycle in both directions', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);

    const switzerland = board.countries.find((c) => c.title === 'Switzerland');
    const southAfrica = board.countries.find((c) => c.title === 'South Africa');
    const aargau = board.states[0];
    const brugg = board.cities.find((c) => c.title === 'Brugg');
    const capeTown = board.cities.find((c) => c.title === 'Cape Town');

    expect(switzerland?.states.map((s) => s.title)).toEqual(['Aargau']);
    // Bern is not in this vault, so Switzerland names no capital rather than
    // naming a city it does not have.
    expect(switzerland?.capital).toBeNull();
    expect(southAfrica?.capital?.title).toBe('Pretoria');

    expect(aargau.country?.title).toBe('Switzerland');
    expect(aargau.cities.map((c) => c.title)).toEqual(['Brugg']);

    expect(brugg?.country?.title).toBe('Switzerland');
    expect(brugg?.state?.title).toBe('Aargau');
    // The optional middle level, absent here and none the worse for it.
    expect(capeTown?.state).toBeNull();
    expect(capeTown?.country?.title).toBe('South Africa');
  });

  it('is happy with a city that carries nothing but its type and its country', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);
    const pretoria = board.cities.find((c) => c.title === 'Pretoria');

    expect(pretoria?.country?.title).toBe('South Africa');
    expect(pretoria?.state).toBeNull();
    expect(pretoria?.geoLocation).toBeNull();
  });

  it('keeps the clock time on every datetime, through a real YAML round trip', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);
    const rovos = board.trips.find((t) => t.title === 'Rovos Rail 2026');

    expect(rovos?.departure).toBe('2026-02-09T09:00');
    expect(rovos?.return).toBe('2026-02-14T18:30');

    const table = rovos?.stops.find((stop) => stop.placeTitle === 'Table Mountain');
    expect(table?.from).toBe('2026-02-13T13:00');
    expect(table?.to).toBe('2026-02-13T16:00');

    const outbound = rovos?.transport.find((leg) => leg.direction === 'outbound');
    expect(outbound?.from).toBe('2026-02-09T09:00');
    expect(outbound?.to).toBe('2026-02-12T11:30');

    // The weekend's dates too, since a trip with no structure is exactly the
    // one whose two properties nobody would notice going wrong.
    const weekend = board.trips.find((t) => t.title === 'Aargau Weekend');
    expect(weekend?.departure).toBe('2026-10-17T09:12');
    expect(weekend?.return).toBe('2026-10-18T17:40');
  });

  it('reads a finished trip whole: stops, a rated stop, nights, legs, people and money', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);
    const rovos = board.trips.find((t) => t.title === 'Rovos Rail 2026');

    expect(rovos?.effectiveStatus).toBe('Over');
    expect(rovos?.reviewStatus).toBe('Reviewed');
    expect(rovos?.rating).toBe(5);
    expect(rovos?.personTitles).toEqual(['Stefan', 'Erika']);
    expect(rovos?.days.map((day) => day.day)).toEqual([1, 4]);

    // Every stop resolves to a note in the set rather than to a dangling link.
    expect(rovos?.stops.map((stop) => stop.target?.title)).toEqual([
      'Pretoria',
      'Table Mountain',
      'Signal Hill',
    ]);
    expect(rovos?.stops.map((stop) => stop.targetKind)).toEqual(['city', 'landmark', 'photospot']);
    expect(rovos?.stops.find((stop) => stop.placeTitle === 'Table Mountain')?.rating).toBe(5);
    // The motif a stop names has to match a motif the spot actually carries.
    const spot = board.places.find((place) => place.title === 'Signal Hill');
    const named = rovos?.stops.find((stop) => stop.motifName !== null)?.motifName;
    expect(spot?.photoSpot?.motifs.map((motif) => motif.name)).toContain(named);

    const night = rovos?.nights[0];
    expect(night?.accommodation?.title).toBe('Table Bay Lodge');
    expect(night?.checkIn).toBe('2026-02-12');
    expect(night?.checkOut).toBe('2026-02-14');
    expect(night?.costUnit).toBe('night');

    expect(rovos?.transport.map((leg) => leg.direction)).toEqual(['outbound', 'inbound']);
    // A carrier written as a wikilink reads down to its title, the same way a
    // plain-text one stands as typed.
    expect(rovos?.transport[0].carrier).toBe('Rovos Rail Charters');
    expect(rovos?.transport[1].carrier).toBe('Swiss');
    expect(rovos?.transport[0].costUnit).toBe('person');

    expect(rovos?.currency).toBe('CHF');
    expect(rovos?.budget.map((line) => line.category)).toEqual([
      'transport',
      'accommodation',
      'activity',
      'food',
    ]);
    expect(rovos?.rates).toEqual([{ currency: 'ZAR', rate: 0.048 }]);
  });

  it('gives the trip that says almost nothing a status anyway', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);
    const weekend = board.trips.find((t) => t.title === 'Aargau Weekend');

    // Nothing was written into the note, and the reader still has an answer.
    expect(weekend?.travelStatus).toBeNull();
    expect(weekend?.effectiveStatus).toBe('Planned');
    expect(weekend?.stops).toEqual([]);
    expect(weekend?.nights).toEqual([]);
    expect(weekend?.transport).toEqual([]);
    expect(weekend?.cities.map((c) => c.title)).toEqual(['Brugg']);
  });

  it('reads the photo spot whole, motifs and access details alike', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);
    const spot = board.places.find((place) => place.title === 'Signal Hill')?.photoSpot;

    expect(spot).not.toBeNull();
    expect(spot?.timezone).toBe('Africa/Johannesburg');
    expect(spot?.accessibility).toBe('partial');
    expect(spot?.openingHours).toBe('24h');
    expect(spot?.parking).not.toBeNull();
    expect(spot?.transit).toHaveLength(1);
    expect(spot?.transit[0].mode).toBe('car');

    expect(spot?.motifs).toHaveLength(2);
    for (const motif of spot?.motifs ?? []) {
      expect(motif.name, 'every motif needs a name to be pointed at').not.toBeNull();
      expect(motif.geoLocation, motif.name ?? '').not.toBeNull();
      expect(motif.direction, motif.name ?? '').not.toBeNull();
      expect(motif.light.length, motif.name ?? '').toBeGreaterThan(0);
      expect(motif.season.length, motif.name ?? '').toBeGreaterThan(0);
      expect(motif.lens, motif.name ?? '').not.toBeNull();
      expect(motif.gear.length, motif.name ?? '').toBeGreaterThan(0);
    }

    // One captured and one not, which is the pair the capture state needs to
    // have anything to say.
    expect(spot ? captureState(spot) : null).toBe('partial');
    expect(spot ? primaryMotif(spot)?.name : null).toBe('City bowl from the saddle');
    expect(spot?.motifs.filter((motif) => motif.captured)).toHaveLength(1);
  });

  it('derives the visits it can, and lets the one explicit value win where it cannot', async () => {
    const { vault } = await seed();
    const board = readTravelBoard(vault.app, settings, TODAY);

    // Stops on a finished trip are the evidence, and nothing was written into
    // these notes to say so.
    const capeTown = board.cities.find((c) => c.title === 'Cape Town');
    const table = board.places.find((p) => p.title === 'Table Mountain');
    expect(board.cities.find((c) => c.title === 'Pretoria')?.visitedFromTrips).toBe(true);
    expect(table?.visited).toBe(true);
    expect(table?.lastVisit).toBe('2026-02-13');
    // Cape Town is on the trip but is not itself a stop, so nothing derives.
    expect(capeTown?.visitedFromTrips).toBe(false);

    // Brugg is the exception: no trip stops there, and the note says so itself.
    const brugg = board.cities.find((c) => c.title === 'Brugg');
    expect(brugg?.visitedFromTrips).toBe(false);
    expect(brugg?.visited).toBe(true);
    expect(brugg?.lastVisit).toBe('2019-06-08');
  });

  it('reads the two people and the company on the shared CRM terms', async () => {
    const { vault } = await seed();
    const board = readCrmBoard(vault.app, settings);

    expect(board.persons.map((p) => p.title)).toEqual(['Erika', 'Stefan']);
    for (const person of board.persons) {
      expect(person.tags, person.title).toEqual(['Family']);
      expect(person.email, person.title).toBe(`${person.title.toLowerCase()}@example.invalid`);
    }

    expect(board.companies.map((c) => c.title)).toEqual(['Rovos Rail Charters']);
    expect(board.companies[0].tags).toEqual(['Travel']);
    expect(board.companies[0].website).toBe('https://rovos-charters.example');
    expect(board.companies[0].phone).toBe('+27 12 555 0142');
  });

  it('writes the roles both plugins agree on, under the property the contract names', async () => {
    // APERtrail displays no roles and therefore does not read them, so this is
    // checked at the note rather than through its board: the key has to be
    // there for the plugin that does read it.
    const { vault } = await seed();
    const properties = crmPropertyNames(settings);
    const stefan = vault.files.get(`${settings.personsFolder}/Stefan.md`) ?? '';
    const front = parseYaml(
      splitFrontmatterBlock(stefan)
        .header.replace(/^---\n/, '')
        .replace(/---\n$/, '')
    ) as Record<string, unknown>;

    expect(front[properties.typePropertyName]).toBe(settings.personTypeValue);
    expect(front[settings.personRolesProperty]).toEqual(['traveller', 'eater']);
  });

  it('gives every note the blocks it needs to render as more than frontmatter', async () => {
    const { vault, notes } = await seed();

    const textOf = (note: SampleNote): string =>
      vault.files.get(`${note.folder}/${note.title}.md`) ?? '';

    // Every note that declares a block carries it, which is what makes the
    // append path on a second plugin's run a repair rather than the norm.
    for (const note of notes.filter((n) => n.ensureBlock !== undefined)) {
      expect(textOf(note), note.title).toContain(`\`\`\`${note.ensureBlock}`);
    }

    const spot = notes.find((note) => note.title === 'Signal Hill');
    expect(textOf(spot)).toContain(`\`\`\`${APT_PHOTO_SPOT_BLOCK_LANG}`);
    expect(textOf(spot)).toContain(`\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}`);

    for (const trip of notes.filter((note) => note.typeValue === 'trip')) {
      expect(textOf(trip), trip.title).toContain(`\`\`\`${TRAVEL_ITINERARY_BLOCK_LANG}`);
      expect(textOf(trip), trip.title).toContain(`\`\`\`${APT_TRIP_COSTS_BLOCK_LANG}`);
    }

    // The overview is body text rather than a property, and trail-core's own
    // reader is what a form and an export both use to find it.
    const rovos = notes.find((note) => note.title === 'Rovos Rail 2026');
    const overview = readSummary(splitFrontmatterBlock(textOf(rovos)).body);
    expect(overview).toContain('Pride of Africa');
  });

  it('leaves no date or datetime unquoted in any note it writes', async () => {
    // The sharp edge, checked against the file rather than against the reader:
    // an unquoted `2026-02-13T09:00` is parsed by Obsidian as a native Date and
    // arrives back with its clock time gone. Every one of these values is a
    // string on the way out, and the host's writer quotes a string. A `Date`
    // handed to the writer instead would appear here as a bare timestamp.
    const { vault, notes } = await seed();

    for (const note of notes) {
      const header = splitFrontmatterBlock(
        vault.files.get(`${note.folder}/${note.title}.md`) ?? ''
      ).header;
      const bare = [...header.matchAll(/:\s+(\d{4}-\d{2}-\d{2}\S*)/g)].map((m) => m[1]);
      expect(bare, note.title).toEqual([]);
    }
  });

  it('stamps created on every note, and modified on none of them', async () => {
    const { vault, notes } = await seed();

    for (const note of notes) {
      const text = vault.files.get(`${note.folder}/${note.title}.md`) ?? '';
      const front = parseYaml(
        splitFrontmatterBlock(text)
          .header.replace(/^---\n/, '')
          .replace(/---\n$/, '')
      ) as Record<string, unknown>;
      expect(front[settings.createdProperty], note.title).toBe('2026-03-01T08:00');
      expect(front[settings.modifiedProperty], note.title).toBeUndefined();
    }
  });
});

describe('planning a run against a vault that is not empty', () => {
  it('plans nothing the second time, because every note is already there', async () => {
    const { vault, notes } = await seed();

    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));
    expect(plan.notes.every((entry) => entry.status === 'exists')).toBe(true);
    expect(plan.notes.some((entry) => entry.augment)).toBe(false);
    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  /**
   * The bug the `shared` flag exists for, and it was found by running the three
   * seeders against one vault rather than by reading anything: `CRM/People` is
   * the same two people in all three, but no contract says which companies a
   * vault holds, so whichever plugin ran second met the first one's company and
   * refused everything.
   */
  it('writes beside a company another plugin seeded, rather than refusing over it', async () => {
    const other = `${settings.companiesFolder}/TomTasty AG.md`;
    const vault = makeVault([{ path: other, text: '---\ntype: "company"\n---\n' }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([{ folder: settings.companiesFolder, others: ['TomTasty AG'] }]);
    expect(sampleVaultWritable(plan)).toBe(true);

    const result = await writeSampleVault(vault.app, settings, plan, NOW);
    expect(result.created).toBe(16);
    expect(result.failed).toEqual([]);
    // Written beside, not over: the other plugin's company is exactly as it was.
    expect(vault.files.get(other)).toBe('---\ntype: "company"\n---\n');
    expect(readCrmBoard(vault.app, settings).companies.map((c) => c.title)).toEqual([
      'Rovos Rail Charters',
      'TomTasty AG',
    ]);
  });

  it('reports a stranger in the People folder rather than refusing over that too', async () => {
    // Both CRM folders are shared, not just the one that broke. A vault whose
    // contacts folder holds one more person than these two is not a vault this
    // plugin should decline to help.
    const other = `${settings.personsFolder}/Kim.md`;
    const vault = makeVault([{ path: other, text: '---\ntype: "person"\n---\n' }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([{ folder: settings.personsFolder, others: ['Kim'] }]);
    expect(sampleVaultWritable(plan)).toBe(true);
  });

  it('refuses the whole run over one note it did not put there, and writes nothing', async () => {
    const stranger = `${settings.citiesFolder}/Winterthur.md`;
    const vault = makeVault([{ path: stranger, text: '---\ntype: "city"\n---\n' }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([{ folder: settings.citiesFolder, strangers: ['Winterthur'] }]);
    // A folder nobody shares is still a folder this plugin will not write into
    // over somebody else's note. Only the two CRM folders were softened.
    expect(plan.shared).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(false);

    await expect(writeSampleVault(vault.app, settings, plan, NOW)).rejects.toBeInstanceOf(
      SampleVaultRefusedError
    );
    // Not one note, not even from the folders that were clear: half a sample
    // vault is the state the refusal exists to prevent.
    expect(vault.files.size).toBe(1);
  });

  it('still refuses on a folder nobody shares, even when a shared one is busy too', async () => {
    // The two answers are independent, which is the whole point of the split: a
    // company beside is a fact to report, a landmark in the way is a refusal.
    const vault = makeVault([
      { path: `${settings.companiesFolder}/TomTasty AG.md`, text: '---\ntype: "company"\n---\n' },
      { path: `${settings.landmarksFolder}/Matterhorn.md`, text: '---\ntype: "landmark"\n---\n' },
    ]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([
      { folder: settings.landmarksFolder, strangers: ['Matterhorn'] },
    ]);
    expect(plan.shared).toEqual([{ folder: settings.companiesFolder, others: ['TomTasty AG'] }]);
    expect(sampleVaultWritable(plan)).toBe(false);

    await expect(writeSampleVault(vault.app, settings, plan, NOW)).rejects.toBeInstanceOf(
      SampleVaultRefusedError
    );
    expect(vault.files.size).toBe(2);
  });

  it('appends its own block to a person another plugin already wrote, and rewrites nothing else', async () => {
    // What a second plugin seeded into the same vault finds: the shared note is
    // there, on the same terms, and carries a block that is not this one's.
    const path = `${settings.personsFolder}/Stefan.md`;
    const existing =
      '---\ntype: "person"\ntags:\n  - "Family"\nemail: "stefan@example.invalid"\n---\n' +
      '\n```culi-related-orders\n```\n';
    const vault = makeVault([{ path, text: existing }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    const stefan = plan.notes.find((entry) => entry.note.title === 'Stefan');
    expect(stefan?.status).toBe('exists');
    expect(stefan?.augment).toBe(true);

    const result = await writeSampleVault(vault.app, settings, plan, NOW);
    expect(result.created).toBe(15);
    expect(result.augmented).toBe(1);
    expect(result.failed).toEqual([]);

    const after = vault.files.get(path) ?? '';
    // The other plugin's block survives, this one's is added, and the note is
    // still readable as a person by the reader that did not write it.
    expect(after).toContain('```culi-related-orders');
    expect(after).toContain(`\`\`\`${TRAVEL_RELATED_TRIPS_BLOCK_LANG}`);
    expect(readCrmBoard(vault.app, settings).persons.map((p) => p.title)).toEqual([
      'Erika',
      'Stefan',
    ]);
    // An append is a real edit of somebody else's note, and says so.
    expect(after).toContain(settings.modifiedProperty);
  });
});
