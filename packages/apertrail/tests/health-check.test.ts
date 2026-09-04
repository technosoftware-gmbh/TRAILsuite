/**
 * The entity-type health check over the eleven entity folders.
 *
 * Two rules carry the weight here. The folders are nested under shared
 * roots, so without the longest-match rule a note would be judged against
 * whichever configured folder happened to be checked first rather than the
 * most specific one containing it. And the two CRM folders expect a
 * configured type value rather than a literal, so a cleared value has to
 * mean "skip this folder" rather than "flag everything in it".
 *
 * The third thing worth pinning down is that this check agrees with the
 * readers about what counts: both ask trail-core's `matchesType()`, so a
 * note the gallery happily shows is never offered up here as broken.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { applyEntityType, scanEntityTypeIssues } from '../src/vault/health/entity-type-issues';
import { makeFakeVault, FakeNote } from './fake-vault';

const P = 'Places';
const TR = 'Trips';
const PEOPLE = DEFAULT_SETTINGS.personsFolder;
const COMPANIES = DEFAULT_SETTINGS.companiesFolder;

function scan(notes: FakeNote[], overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  const { app } = makeFakeVault(notes);
  return scanEntityTypeIssues(app, { ...DEFAULT_SETTINGS, ...overrides });
}

describe('entity type check over Travel folders', () => {
  it('flags a note whose type disagrees with its folder, and says which type it should be', () => {
    const issues = scan([
      { path: `${P}/Landmarks/Schloss Brandis.md`, frontmatter: { type: 'fnb' } },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('landmarks');
    expect(issues[0].reason).toBe('mismatch');
    expect(issues[0].currentType).toBe('fnb');
    expect(issues[0].suggestedType).toBe('landmark');
  });

  it('flags a Travel note with no type at all', () => {
    const issues = scan([{ path: `${P}/Cities/Basel.md`, frontmatter: {} }]);
    expect(issues[0].reason).toBe('missing');
    expect(issues[0].suggestedType).toBe('city');
  });

  it('leaves correctly typed notes alone across all nine folders', () => {
    expect(
      scan([
        { path: `${TR}/A.md`, frontmatter: { type: 'trip' } },
        { path: `${P}/Countries/B.md`, frontmatter: { type: 'country' } },
        { path: `${P}/States/C.md`, frontmatter: { type: 'state' } },
        { path: `${P}/Cities/D.md`, frontmatter: { type: 'city' } },
        { path: `${P}/Accommodation/E.md`, frontmatter: { type: 'accommodation' } },
        { path: `${P}/Food & Beverages/F.md`, frontmatter: { type: 'fnb' } },
        { path: `${P}/Landmarks/G.md`, frontmatter: { type: 'landmark' } },
        { path: `${P}/Locations/H.md`, frontmatter: { type: 'location' } },
        { path: `${P}/Photo Spots/I.md`, frontmatter: { type: 'photospot' } },
      ])
    ).toEqual([]);
  });

  // Bookings sit UNDER the Trips folder, so this is the case the
  // longest-match rule exists for: without it a booking note would be judged
  // against the trips folder it also falls under and offered `trip`.
  it('judges a booking against its own folder rather than the Trips folder above it', () => {
    const issues = scan([{ path: `${TR}/Bookings/SBB.md`, frontmatter: { type: 'trip' } }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('bookings');
    expect(issues[0].suggestedType).toBe('booking');
  });

  it('leaves a correctly typed booking alone', () => {
    expect(scan([{ path: `${TR}/Bookings/SBB.md`, frontmatter: { type: 'booking' } }])).toEqual([]);
  });

  // A photo spot folder name contains a space, which the other eight
  // (bar "Food & Beverages") do not -- worth its own case, since the
  // longest-match rule compares raw path prefixes.
  it('suggests photospot for a mistyped note in the Photo Spots folder', () => {
    const issues = scan([
      { path: `${P}/Photo Spots/Creux du Van.md`, frontmatter: { type: 'landmark' } },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('photoSpots');
    expect(issues[0].suggestedType).toBe('photospot');
  });

  /**
   * A `type:` the property editor has turned into a list, or written as a
   * link, is what read-entities.ts reads as a match, so flagging it here
   * would offer to "fix" a note that is already showing up correctly -- and
   * accepting that fix would rewrite the user's list down to a scalar.
   */
  it('leaves a list-shaped or wikilink type alone, exactly as the readers do', () => {
    expect(
      scan([
        { path: `${P}/Cities/Basel.md`, frontmatter: { type: ['city', 'draft'] } },
        { path: `${P}/Cities/Bern.md`, frontmatter: { type: '[[city]]' } },
      ])
    ).toEqual([]);
  });

  it('reports a list-shaped type that is genuinely wrong as a mismatch, not as missing', () => {
    const issues = scan([{ path: `${P}/Cities/Basel.md`, frontmatter: { type: ['location'] } }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe('mismatch');
    expect(issues[0].currentType).toBe('location');
  });

  it('checks a note against its most specific folder, not a broader one it also sits under', () => {
    // The loose note sits directly in the root, which is not itself a
    // configured location, so it is not scanned at all -- while the city
    // note one level deeper is judged against Cities specifically.
    const issues = scan([
      { path: `${P}/Some Loose Note.md`, frontmatter: { type: 'trip' } },
      { path: `${P}/Cities/Basel.md`, frontmatter: { type: 'location' } },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('cities');
    expect(issues[0].suggestedType).toBe('city');
  });
});

describe('entity type check over CRM folders', () => {
  it('leaves correctly typed people and companies alone', () => {
    expect(
      scan([
        { path: `${PEOPLE}/Gaby.md`, frontmatter: { type: 'person' } },
        { path: `${COMPANIES}/RhB.md`, frontmatter: { type: 'company' } },
      ])
    ).toEqual([]);
  });

  it('flags a company note filed under People, and suggests the person value', () => {
    const issues = scan([{ path: `${PEOPLE}/Acme AG.md`, frontmatter: { type: 'company' } }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('persons');
    expect(issues[0].reason).toBe('mismatch');
    expect(issues[0].suggestedType).toBe('person');
  });

  it('flags a CRM note with no type at all', () => {
    const issues = scan([{ path: `${COMPANIES}/Basel Tourismus.md`, frontmatter: {} }]);
    expect(issues[0].location).toBe('companies');
    expect(issues[0].reason).toBe('missing');
    expect(issues[0].suggestedType).toBe('company');
  });

  /**
   * The CRM type values are settings, not literals, so the check has to
   * compare against what the vault configured rather than against the word
   * "person". A vault whose notes say `type: Kontakt` is correct, not
   * broken.
   */
  it('judges CRM notes against the configured type value, not a hardcoded one', () => {
    const notes = [
      { path: `${PEOPLE}/Rita.md`, frontmatter: { type: 'Kontakt' } },
      { path: `${PEOPLE}/Otto.md`, frontmatter: { type: 'person' } },
    ];
    const issues = scan(notes, { personTypeValue: 'Kontakt' });
    expect(issues).toHaveLength(1);
    expect(issues[0].file.basename).toBe('Otto');
    expect(issues[0].suggestedType).toBe('Kontakt');
  });

  /**
   * Clearing the type value says "I keep no such notes". With nothing
   * expected there is nothing to suggest, so the folder is skipped rather
   * than every note in it being reported against an empty string.
   */
  it('skips a CRM folder whose type value has been cleared', () => {
    const notes = [{ path: `${PEOPLE}/Gaby.md`, frontmatter: { type: 'whatever' } }];
    expect(scan(notes, { personTypeValue: '' })).toEqual([]);
    expect(scan(notes, { personTypeValue: '   ' })).toEqual([]);
  });

  it('skips a CRM folder left blank', () => {
    const notes = [{ path: `${PEOPLE}/Gaby.md`, frontmatter: { type: 'whatever' } }];
    expect(scan(notes, { personsFolder: '' })).toEqual([]);
  });

  /**
   * The two families must not judge each other: a Person note is not a
   * broken travel entity, and a Landmark is not a broken person. Folder
   * matching already keeps them apart, and this is the case that would
   * notice if that ever stopped being true.
   */
  it('never judges a CRM note against a travel type, or the reverse', () => {
    const issues = scan([
      { path: `${PEOPLE}/Gaby.md`, frontmatter: { type: 'person' } },
      { path: `${P}/Landmarks/Munot.md`, frontmatter: { type: 'landmark' } },
      { path: `${COMPANIES}/RhB.md`, frontmatter: { type: 'company' } },
    ]);
    expect(issues).toEqual([]);
  });

  it('reports travel locations before CRM ones, so the review list reads the same way the vault does', () => {
    const issues = scan([
      { path: `${PEOPLE}/Gaby.md`, frontmatter: {} },
      { path: `${TR}/A.md`, frontmatter: {} },
      { path: `${COMPANIES}/RhB.md`, frontmatter: {} },
    ]);
    expect(issues.map((i) => i.location)).toEqual(['trips', 'persons', 'companies']);
  });
});

/**
 * Applying a suggestion rewrites an existing note, so it is a modification
 * and stamps `modified` -- in the same frontmatter pass, rather than a
 * second one over the same file.
 */
describe('applyEntityType', () => {
  const NOW = new Date(2026, 7, 12, 9, 15);

  function vaultWithFrontmatter(frontmatter: Record<string, unknown>) {
    let passes = 0;
    const app = {
      fileManager: {
        processFrontMatter: async (
          _f: unknown,
          fn: (fm: Record<string, unknown>) => void
        ): Promise<void> => {
          passes += 1;
          fn(frontmatter);
        },
      },
    } as never;
    const issue = { file: { path: 'Places/Cities/Basel.md' } } as never;
    return { app, issue, frontmatter, passCount: () => passes };
  }

  it('writes the new type and stamps modified in one pass', async () => {
    const { app, issue, frontmatter, passCount } = vaultWithFrontmatter({ type: 'fnb' });
    await applyEntityType(app, DEFAULT_SETTINGS, issue, 'city', NOW);
    expect(frontmatter.type).toBe('city');
    expect(frontmatter.modified).toBe('2026-08-12T09:15');
    expect(passCount()).toBe(1);
  });

  it('never invents created on the note it repairs', async () => {
    const { app, issue, frontmatter } = vaultWithFrontmatter({ type: 'fnb' });
    await applyEntityType(app, DEFAULT_SETTINGS, issue, 'city', NOW);
    expect('created' in frontmatter).toBe(false);
  });

  it('leaves an existing created stamp alone', async () => {
    const { app, issue, frontmatter } = vaultWithFrontmatter({
      type: 'fnb',
      created: '2024-03-01T08:00',
    });
    await applyEntityType(app, DEFAULT_SETTINGS, issue, 'city', NOW);
    expect(frontmatter.created).toBe('2024-03-01T08:00');
  });

  it('stamps nothing when the modified property name has been cleared', async () => {
    const { app, issue, frontmatter } = vaultWithFrontmatter({ type: 'fnb' });
    await applyEntityType(app, { ...DEFAULT_SETTINGS, modifiedProperty: '' }, issue, 'city', NOW);
    expect(frontmatter.type).toBe('city');
    expect(Object.keys(frontmatter)).toEqual(['type']);
  });
});
