/**
 * The interchange export, end to end on disk: the sample notes written into a
 * temporary folder as files, read back through `scripts/interchange/fs-host.ts`,
 * turned into NODAtrail's families and the raw manifest, and checked by the
 * core's report.
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
import { NODATRAIL_FAMILIES, nodatrailFamilies } from '../src/interchange/sections';
import { diskVault } from '../scripts/interchange/fs-host';

const settings = DEFAULT_SETTINGS;
const META = { sourceVersion: 'test', generatedAt: '2026-09-25T12:00:00.000Z' };
const root = mkdtempSync(join(tmpdir(), 'nodatrail-interchange-'));
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

describe('the NODAtrail interchange export', () => {
  const disk = diskVault(root);

  it('reads the vault the way Obsidian presents it', () => {
    const paths = disk.host.vault.markdownFiles().map((file) => file.path);
    expect(paths).toContain('Loose/Müsli.md');
    expect(paths.some((path) => path.startsWith('.'))).toBe(false);
    expect(disk.unparsable).toEqual([]);
  });

  it('writes every family, as plain JSON, and accounts for every note', async () => {
    const families = await nodatrailFamilies(disk.host, settings);
    expect(Object.keys(families)).toEqual([...NODATRAIL_FAMILIES]);
    for (const family of ['area', 'project', 'account', 'journal', 'budget'] as const) {
      expect(families[family].length, family).toBeGreaterThan(0);
    }

    const section = sectionFile('nodatrail', META, families);
    // A round trip through JSON is the file the app will read; nothing may be
    // lost on the way or refuse to serialise.
    expect(JSON.parse(JSON.stringify(section))).toEqual(section);

    const manifest = await vaultManifest(disk.host, META);
    expect(manifest.notes).toHaveLength(notes.length + 1);

    const report = interchangeReport(manifest, [section]);
    expect(report.missingFromVault).toEqual([]);
    expect(report.claimedTwice).toEqual([]);
    expect(report.danglingRefs).toEqual([]);
    expect(report.unrecognised).toContain('Loose/Müsli.md');
    expect(report.notes - report.unrecognised.length).toBeGreaterThan(0);
  });

  it('refuses to write', async () => {
    await expect(async () => disk.host.vault.create('x.md', '')).rejects.toThrow('does not write');
  });
});
