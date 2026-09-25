/**
 * The interchange format: records made JSON-safe, the raw manifest, and the
 * report that says whether an export dropped anything.
 */
import { describe, expect, it } from 'vitest';
import {
  familyEntries,
  formatInterchangeReport,
  interchangeReport,
  sectionFile,
  toInterchangeRecord,
  vaultManifest,
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
  type VaultManifest,
} from '../../src/interchange/index';
import { makeFakeVault } from '../vault/fake-host';

const META = { sourceVersion: '0.0.0', generatedAt: '2026-09-25T12:00:00+02:00' };

describe('toInterchangeRecord', () => {
  it('turns a pointer to another note into a ref, which is what ends a cycle', () => {
    const country: Record<string, unknown> = {
      file: { path: 'Places/Norway.md' },
      title: 'Norway',
    };
    const city = { file: { path: 'Places/Bergen.md' }, title: 'Bergen', country };
    country.cities = [city];

    expect(toInterchangeRecord(country)).toEqual({
      title: 'Norway',
      cities: [{ ref: 'Places/Bergen.md' }],
    });
    expect(JSON.stringify(toInterchangeRecord(city))).toBe(
      '{"title":"Bergen","country":{"ref":"Places/Norway.md"}}'
    );
  });

  it('keeps nested plain objects that are not notes', () => {
    const record = { file: { path: 'a.md' }, stops: [{ day: 1, cost: { amount: 5 } }] };
    expect(toInterchangeRecord(record)).toEqual({ stops: [{ day: 1, cost: { amount: 5 } }] });
  });

  it('writes absent values as null rather than dropping the key', () => {
    const record = { file: { path: 'a.md' }, a: undefined, b: Number.NaN, c: new Date('nope') };
    expect(toInterchangeRecord(record)).toEqual({ a: null, b: null, c: null });
  });

  it('writes Maps as objects, Sets as arrays and Dates as ISO strings', () => {
    const record = {
      file: { path: 'a.md' },
      byNumber: new Map([[1000, 'Kasse']]),
      tags: new Set(['x']),
      at: new Date(Date.UTC(2026, 8, 25)),
    };
    expect(toInterchangeRecord(record)).toEqual({
      byNumber: { 1000: 'Kasse' },
      tags: ['x'],
      at: '2026-09-25T00:00:00.000Z',
    });
  });
});

describe('vaultManifest', () => {
  it('carries every note raw, in path order, frontmatter parsed and body split off', async () => {
    const vault = makeFakeVault([
      { path: 'b/Second.md', content: '---\ntype: x\n---\nBody two', frontmatter: { type: 'x' } },
      { path: 'a/First.md', content: 'No frontmatter here' },
    ]);
    const manifest = await vaultManifest(vault.host, META);

    expect(manifest.format).toBe(INTERCHANGE_FORMAT);
    expect(manifest.version).toBe(INTERCHANGE_VERSION);
    expect(manifest.source).toBe('vault');
    expect(manifest.notes).toEqual([
      { path: 'a/First.md', title: 'First', frontmatter: null, body: 'No frontmatter here' },
      { path: 'b/Second.md', title: 'Second', frontmatter: { type: 'x' }, body: 'Body two' },
    ]);
    expect(vault.writes).toEqual([]);
  });
});

describe('interchangeReport', () => {
  const manifest: VaultManifest = {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    source: 'vault',
    ...META,
    notes: [
      'Trips/T.md',
      'Places/Bergen.md',
      'Plan/Days/2026-09-25.md',
      'Plan/Days/2026-09-24.md',
      'Loose.md',
    ].map((path) => ({ path, title: path, frontmatter: null, body: '' })),
  };

  it('accounts for every note: claimed, or listed as carried raw', () => {
    const travel = sectionFile('apertrail', META, {
      trip: familyEntries([{ file: { path: 'Trips/T.md', basename: 'T' } }]),
      city: familyEntries([{ file: { path: 'Places/Bergen.md', basename: 'Bergen' } }]),
    });
    const report = interchangeReport(manifest, [travel]);

    expect(report.notes).toBe(5);
    expect(report.families).toEqual([
      { source: 'apertrail', family: 'trip', count: 1 },
      { source: 'apertrail', family: 'city', count: 1 },
    ]);
    expect(report.unrecognised.sort()).toEqual([
      'Loose.md',
      'Plan/Days/2026-09-24.md',
      'Plan/Days/2026-09-25.md',
    ]);
    expect(report.unrecognisedByFolder).toEqual([
      { folder: 'Plan/Days', count: 2 },
      { folder: '(vault root)', count: 1 },
    ]);
    expect(report.claimedTwice).toEqual([]);
    expect(report.danglingRefs).toEqual([]);
  });

  it('names a double claim, a record outside the vault and a dangling ref', () => {
    const one = sectionFile('a', META, {
      trip: [
        { path: 'Trips/T.md', record: { city: { ref: 'Places/Gone.md' } } },
        { path: 'Trips/Elsewhere.md', record: {} },
      ],
    });
    const two = sectionFile('b', META, { other: [{ path: 'Trips/T.md', record: {} }] });
    const report = interchangeReport(manifest, [one, two]);

    expect(report.claimedTwice).toEqual([{ path: 'Trips/T.md', by: ['a/trip', 'b/other'] }]);
    expect(report.missingFromVault).toEqual([{ path: 'Trips/Elsewhere.md', by: 'a/trip' }]);
    expect(report.danglingRefs).toEqual([{ from: 'Trips/T.md', ref: 'Places/Gone.md' }]);
    expect(formatInterchangeReport(report)).toContain('- dangling: Trips/T.md -> Places/Gone.md');
  });

  it('prints counts, never note content', () => {
    const secret: VaultManifest = {
      ...manifest,
      notes: [{ path: 'x.md', title: 'x', frontmatter: { iban: 'CH00 SECRET' }, body: 'SECRET' }],
    };
    expect(formatInterchangeReport(interchangeReport(secret, []))).not.toContain('SECRET');
  });
});
