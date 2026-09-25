/**
 * The interchange export, end to end on disk: the sample notes written into a
 * temporary folder as files, read back through `scripts/interchange/fs-host.ts`,
 * turned into APERtrail's families and the raw manifest, and checked by the
 * core's report. Also the day-note link index the export builds in place of
 * Obsidian's resolved-link cache.
 *
 * No `vi.mock('obsidian')`: the stub the config aliases it to throws on any
 * call, so an export that reached into Obsidian fails here.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  interchangeReport,
  sectionFile,
  vaultManifest,
  type SampleNote,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { sampleNotes } from '../src/sample/notes';
import { APERTRAIL_FAMILIES, apertrailFamilies } from '../src/interchange/sections';
import { diskVault } from '../scripts/interchange/fs-host';
import { dayVisitsOnDisk } from '../scripts/interchange/link-index';

const settings = DEFAULT_SETTINGS;
const META = { sourceVersion: 'test', generatedAt: '2026-09-25T12:00:00.000Z' };
const root = mkdtempSync(join(tmpdir(), 'apertrail-interchange-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, text: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text, 'utf8');
}

function noteText(note: SampleNote): string {
  const typeKey = settings.typePropertyName.trim() || 'type';
  const frontmatter = note.typeValue
    ? { [typeKey]: note.typeValue, ...note.properties }
    : note.properties;
  return `---\n${stringifyYaml(frontmatter, { lineWidth: 0 })}---\n${note.body}`;
}

const notes = sampleNotes(settings, new Date(2026, 8, 17, 9, 0));
for (const note of notes) write(`${note.folder}/${note.title}.md`, noteText(note));
// What macOS does to a name with an umlaut: stored decomposed on disk.
write('Loose/Müsli.md', 'A note no plugin parses.');
// Hidden from Obsidian, so hidden from the export.
write('.hidden/Hidden.md', 'not in the vault');
write('.trash/Deleted.md', 'gone');

describe('the APERtrail interchange export', () => {
  const disk = diskVault(root);

  it('reads the vault the way Obsidian presents it', () => {
    const paths = disk.host.vault.markdownFiles().map((file) => file.path);
    expect(paths).toContain('Loose/Müsli.md');
    expect(paths.some((path) => path.startsWith('.'))).toBe(false);
    expect(disk.unparsable).toEqual([]);
  });

  it('writes every family, as plain JSON, and accounts for every note', async () => {
    const families = apertrailFamilies(disk.host, settings, new Map(), '2026-09-17');
    expect(Object.keys(families)).toEqual([...APERTRAIL_FAMILIES]);
    for (const family of [
      'trip',
      'country',
      'city',
      'place',
      'vehicle',
      'excursion',
      'person',
      'company',
    ] as const) {
      expect(families[family].length, family).toBeGreaterThan(0);
    }

    const section = sectionFile('apertrail', META, families);
    // The board is a cycle in memory. If a pointer had not become a ref, this
    // would throw rather than compare.
    expect(JSON.parse(JSON.stringify(section))).toEqual(section);
    // And the pointers are there, as paths the vault holds.
    const stops = families.trip.flatMap((entry) => entry.record.stops as { target: unknown }[]);
    expect(stops.some((stop) => typeof (stop.target as { ref?: unknown })?.ref === 'string')).toBe(
      true
    );

    const manifest = await vaultManifest(disk.host, META);
    expect(manifest.notes).toHaveLength(notes.length + 1);

    const report = interchangeReport(manifest, [section]);
    expect(report.missingFromVault).toEqual([]);
    expect(report.claimedTwice).toEqual([]);
    expect(report.danglingRefs).toEqual([]);
    expect(report.unrecognised).toContain('Loose/M\u00fcsli.md');
  });

  it('hands over people and companies with their roles, which the gallery does not show', () => {
    const families = apertrailFamilies(disk.host, settings, new Map(), '2026-09-17');
    const roles = [...families.person, ...families.company].flatMap(
      (entry) => entry.record.roles as string[]
    );
    expect(roles).toEqual(expect.arrayContaining(['traveller', 'eater', 'carrier']));
    for (const entry of families.person) {
      expect(Object.keys(entry.record).sort()).toEqual(
        ['address', 'description', 'email', 'mobile', 'roles', 'tags', 'title'].sort()
      );
    }
  });

  it('refuses to write', async () => {
    await expect(async () => disk.host.vault.create('x.md', '')).rejects.toThrow('does not write');
  });
});

describe('the day-note link index', () => {
  const dayRoot = mkdtempSync(join(tmpdir(), 'apertrail-day-links-'));
  afterAll(() => rmSync(dayRoot, { recursive: true, force: true }));
  const put = (path: string, text: string): void => {
    mkdirSync(dirname(join(dayRoot, path)), { recursive: true });
    writeFileSync(join(dayRoot, path), text, 'utf8');
  };
  put('Places/Cities/Z\u00fcrich.md', '');
  put('Places/Food/Gifth\u00fcttli.md', '');
  put(
    'Plan/Days/2026-09-20.md',
    'Lunch at [[Gifth\u00fcttli|the hut]], then [[Places/Cities/Z\u00fcrich#Old town]]. [[Gifth\u00fcttli]] again.'
  );
  put('Plan/Days/2026-09-21.md', '---\nplace: "[[Z\u00fcrich]]"\n---\n[[Nowhere]]');
  put('Notes/Not a day.md', '[[Z\u00fcrich]]');

  it('resolves titles, paths, aliases and headings, once per day, from day notes only', async () => {
    const visits = await dayVisitsOnDisk(diskVault(dayRoot).host);
    expect(Object.fromEntries(visits)).toEqual({
      'Places/Cities/Z\u00fcrich.md': ['2026-09-20', '2026-09-21'],
      'Places/Food/Gifth\u00fcttli.md': ['2026-09-20'],
    });
  });
});
