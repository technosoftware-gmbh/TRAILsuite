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
import {
  NODATRAIL_FAMILIES,
  NODATRAIL_LINES,
  nodatrailFamilies,
  nodatrailLines,
} from '../src/interchange/sections';
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
    for (const family of ['area', 'project', 'account', 'journal', 'budget', 'period'] as const) {
      expect(families[family].length, family).toBeGreaterThan(0);
    }

    const lines = await nodatrailLines(disk.host, settings);
    expect(Object.keys(lines)).toEqual([...NODATRAIL_LINES]);
    expect(lines.task.length).toBeGreaterThan(0);
    const section = sectionFile('nodatrail', META, families, lines);
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

  it('reads a day note the way the plan view does, with every link resolved to its note', async () => {
    const { period } = await nodatrailFamilies(disk.host, settings);
    const days = period.filter((entry) => entry.record.level === 'day');
    expect(days.length).toBeGreaterThan(0);

    const schedule = days.flatMap(
      (entry) => entry.record.schedule as { text: string; context: unknown; start: string }[]
    );
    const kickoff = schedule.find((entry) => entry.text.startsWith('Week kickoff'));
    expect(kickoff?.start).toBe('08:30');
    const context = kickoff?.context as { title: string; note: { ref: string } | null };
    expect(context.title).not.toBe('');
    expect(context.note?.ref).toMatch(/\.md$/);

    const thoughts = days.flatMap((entry) => entry.record.thoughts as { kind: string }[]);
    expect(thoughts.map((entry) => entry.kind)).toEqual(expect.arrayContaining(['idea', 'note']));
  });

  it("puts a follow-up inside its meeting's line range, which is how an importer pairs them", async () => {
    const { period } = await nodatrailFamilies(disk.host, settings);
    const { task } = await nodatrailLines(disk.host, settings);
    const day = period.find((entry) =>
      (entry.record.schedule as { text: string }[]).some((one) =>
        one.text.startsWith('Week kickoff')
      )
    );
    const kickoff = (
      day?.record.schedule as { text: string; lines: { from: number; to: number } }[]
    ).find((one) => one.text.startsWith('Week kickoff'));
    const followUp = task.find(
      (line) =>
        line.path === day?.path && (line.record.text as string).startsWith('Open the year budget')
    );
    expect(followUp).toBeDefined();
    expect(followUp.line).toBeGreaterThanOrEqual(kickoff.lines.from);
    expect(followUp.line).toBeLessThan(kickoff.lines.to);
    // And the numbers are into the file, frontmatter included, as the vault holds it.
    const text = await disk.host.vault.read(disk.host.vault.getFile(day.path));
    const fileLines = text.split('\n');
    expect(fileLines[followUp.line]).toBe(followUp.record.raw);
    expect(fileLines[kickoff.lines.from]).toContain('Week kickoff');
  });

  it('claims a journal note once, though it carries a month title', async () => {
    const families = await nodatrailFamilies(disk.host, settings);
    const journals = new Set(families.journal.map((entry) => entry.path));
    expect(families.period.some((entry) => journals.has(entry.path))).toBe(false);
  });

  it('refuses to write', async () => {
    await expect(async () => disk.host.vault.create('x.md', '')).rejects.toThrow('does not write');
  });
});
