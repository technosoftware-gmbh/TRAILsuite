/**
 * The vault-write side of photo spot notes -- and (the part that matters
 * most) what an edit leaves alone. photo-spot-note.test.ts covers the
 * frontmatter object; this covers the file.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
  stringifyYaml: (obj: Record<string, unknown>) =>
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { createPhotoSpotNote } from '../src/vault/create-entities';
import {
  ensurePhotoSpotBlock,
  PhotoSpotInput,
  photoSpotToInput,
  updatePhotoSpotNote,
} from '../src/places/write-photo-spot';
import { APT_PHOTO_SPOT_BLOCK_LANG } from '../src/places/photo-spot-block-lang';
import { TravelPlace } from '../src/vault/types';
import { makeFakeVault } from './fake-vault';

const settings = DEFAULT_SETTINGS;
const NOW = new Date(2026, 7, 7, 10, 30);

function spotInput(overrides: Partial<PhotoSpotInput> = {}): PhotoSpotInput {
  return {
    timezone: null,
    openingHours: null,
    entryFee: null,
    accessibility: 'unknown',
    parking: null,
    transit: [],
    motifs: [],
    samples: [],
    ...overrides,
  };
}

/** A fake whose processFrontMatter mutates a real object, so the clear-then-apply behaviour is observable. */
function vaultWithFrontmatter(frontmatter: Record<string, unknown>) {
  const file = { path: 'Photo Spots/Neuchatel.md', basename: 'Neuchatel' } as never;
  const app = {
    fileManager: {
      processFrontMatter: async (
        _f: unknown,
        fn: (fm: Record<string, unknown>) => void
      ): Promise<void> => {
        fn(frontmatter);
      },
    },
  } as never;
  return { app, file, frontmatter };
}

describe('createPhotoSpotNote', () => {
  it('seeds the photo spot block so the note renders from the moment it exists', async () => {
    const { app, created } = makeFakeVault();
    const file = await createPhotoSpotNote(app, settings, 'Creux du Van');
    expect(file.path).toBe(`${settings.photoSpotsFolder}/Creux du Van.md`);
    expect(created[0].content).toContain('```' + APT_PHOTO_SPOT_BLOCK_LANG);
  });

  // The related-trips block answers "when was I here"; the photo spot
  // block answers "what am I here to shoot". A spot wants both.
  it('keeps the related-trips block alongside it', async () => {
    const { app, created } = makeFakeVault();
    await createPhotoSpotNote(app, settings, 'Creux du Van');
    expect(created[0].content).toContain('```travel-related-trips');
  });

  it('does not put the photo spot block on the other place types', async () => {
    const { app, created } = makeFakeVault();
    const { createLandmarkNote } = await import('../src/vault/create-entities');
    await createLandmarkNote(app, settings, 'Schloss Brandis');
    expect(created[0].content).not.toContain(APT_PHOTO_SPOT_BLOCK_LANG);
  });
});

describe('updatePhotoSpotNote', () => {
  it('leaves frontmatter it does not own completely alone', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'photospot',
      country: '[[Switzerland]]',
      city: '[[Neuchâtel]]',
      geoLocation: ['46.9899', '6.9293'],
      rating: 5,
      icon: 'camera',
      created: '2026-08-04T16:29',
    });

    await updatePhotoSpotNote(
      app,
      settings,
      file,
      spotInput({ parking: 'Parkhaus du Seyon' }),
      NOW
    );

    expect(frontmatter.type).toBe('photospot');
    expect(frontmatter.country).toBe('[[Switzerland]]');
    expect(frontmatter.geoLocation).toEqual(['46.9899', '6.9293']);
    expect(frontmatter.rating).toBe(5);
    expect(frontmatter.icon).toBe('camera');
    expect(frontmatter.created).toBe('2026-08-04T16:29');
    expect(frontmatter.parking).toBe('Parkhaus du Seyon');
  });

  /**
   * The rule this is really guarding: `visited` and `lastVisit` can be
   * DERIVED from the trips that stopped here rather than written in the
   * note. A writer that cleared and rewrote them would turn a derived
   * value into a written one as a side effect of ticking off a motif.
   */
  it('never touches visited or lastVisit, which may be derived rather than written', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'photospot' });
    await updatePhotoSpotNote(app, settings, file, spotInput(), NOW);
    expect('visited' in frontmatter).toBe(false);
    expect('lastVisit' in frontmatter).toBe(false);
  });

  it('clears a key it owns when the new value is empty, rather than letting it linger', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'photospot',
      motifs: [{ name: 'Schloss', role: 'main' }],
      parking: 'Parkhaus du Seyon',
    });
    await updatePhotoSpotNote(app, settings, file, spotInput(), NOW);
    expect('motifs' in frontmatter).toBe(false);
    expect('parking' in frontmatter).toBe(false);
  });

  it('stamps modified on every write', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'photospot' });
    await updatePhotoSpotNote(app, settings, file, spotInput(), NOW);
    expect(frontmatter.modified).toBe('2026-08-07T10:30');
  });

  // An edit reports when the note changed; it never guesses when it began.
  it('never invents created on a spot that has none', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'photospot' });
    await updatePhotoSpotNote(app, settings, file, spotInput(), NOW);
    expect('created' in frontmatter).toBe(false);
  });

  it('leaves an existing created stamp exactly as it was', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({
      type: 'photospot',
      created: '2024-03-01T08:00',
    });
    await updatePhotoSpotNote(app, settings, file, spotInput(), NOW);
    expect(frontmatter.created).toBe('2024-03-01T08:00');
  });

  it('stamps nothing when the modified property name has been cleared', async () => {
    const { app, file, frontmatter } = vaultWithFrontmatter({ type: 'photospot' });
    await updatePhotoSpotNote(app, { ...settings, modifiedProperty: '' }, file, spotInput(), NOW);
    expect('modified' in frontmatter).toBe(false);
    expect(Object.keys(frontmatter)).not.toContain('');
  });
});

/**
 * The repair path. It appends to a note that already exists, so it is a
 * modification -- but a call made straight after creation finds the block
 * creation already seeded and writes nothing, which is what keeps rule
 * "creation does not stamp modified" true without a flag.
 */
describe('ensurePhotoSpotBlock', () => {
  function vaultWithBody(body: string) {
    const frontmatter: Record<string, unknown> = { type: 'photospot' };
    const appended: string[] = [];
    const file = { path: 'Photo Spots/Neuchatel.md', basename: 'Neuchatel' } as never;
    const app = {
      vault: {
        read: async () => body,
        append: async (_f: unknown, text: string) => {
          appended.push(text);
        },
      },
      fileManager: {
        processFrontMatter: async (
          _f: unknown,
          fn: (fm: Record<string, unknown>) => void
        ): Promise<void> => {
          fn(frontmatter);
        },
      },
    } as never;
    return { app, file, frontmatter, appended };
  }

  it('appends the block and stamps modified on a note that lacks it', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody('---\ntype: photospot\n---\n');
    expect(await ensurePhotoSpotBlock(app, settings, file, NOW)).toBe(true);
    expect(appended).toHaveLength(1);
    expect(frontmatter.modified).toBe('2026-08-07T10:30');
  });

  it('writes nothing at all when the block is already there, as it is right after creation', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody(
      '```' + APT_PHOTO_SPOT_BLOCK_LANG + '\n```\n'
    );
    expect(await ensurePhotoSpotBlock(app, settings, file, NOW)).toBe(false);
    expect(appended).toHaveLength(0);
    expect('modified' in frontmatter).toBe(false);
  });
});

describe('photoSpotToInput', () => {
  function placeWith(photoSpot: TravelPlace['photoSpot']): TravelPlace {
    return { kind: 'photospot', photoSpot } as unknown as TravelPlace;
  }

  // This is what makes "add the first motif to a spot created last month"
  // the same code path as editing an existing one.
  it('gives an empty but valid input for a spot that carries no photography keys yet', () => {
    const input = photoSpotToInput(placeWith(null));
    expect(input.motifs).toEqual([]);
    expect(input.samples).toEqual([]);
    expect(input.accessibility).toBe('unknown');
  });

  it('keeps a motif whose name never parsed, as an empty string rather than a dropped row', () => {
    const input = photoSpotToInput(
      placeWith({
        timezone: null,
        openingHours: null,
        entryFee: null,
        accessibility: 'unknown',
        parking: null,
        transit: [],
        samples: [],
        motifs: [
          {
            name: null,
            role: 'secondary',
            geoLocation: null,
            direction: null,
            light: [],
            season: [],
            lens: null,
            gear: [],
            technique: null,
            note: null,
            captured: false,
            capturedOn: null,
          },
        ],
      })
    );
    expect(input.motifs).toHaveLength(1);
    expect(input.motifs[0].name).toBe('');
  });
});
