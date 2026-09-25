/**
 * The vault readers, run over a host that is not Obsidian.
 *
 * The sample notes are serialised to text with a real YAML writer, parsed back,
 * and handed to the host-free readers through a plain `VaultHost` built here
 * from nothing but two maps. **This suite does not mock `obsidian`**, and the
 * stub the config aliases it to throws on any call, so a reader that reached
 * for Obsidian at runtime would fail here even where the static walk in the
 * root `tests/host-free.test.ts` had been fooled.
 *
 * What it asserts is that the readers find what the sample wrote, not what each
 * record holds: sample-vault.test.ts already checks the content through the
 * Obsidian-facing readers, and those now delegate to the same code.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { SampleNote, VaultFile, VaultHost } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { sampleNotes } from '../src/sample/notes';
import { readParaBoardFrom } from '../src/para/para-reader';
import { readFinanceBoardFrom } from '../src/finance/finance-reader';
import { readBudgetsFrom, readLedgerFrom } from '../src/ledger/ledger-reader';

const settings = DEFAULT_SETTINGS;
const NOW = new Date(2026, 8, 17, 9, 0);

/** A file as a non-Obsidian host would describe one: two strings and nothing else. */
interface PlainFile extends VaultFile {
  path: string;
  basename: string;
}

/** The note as it would sit on disk: a YAML frontmatter block and a body. */
function noteText(note: SampleNote): string {
  const typeKey = settings.typePropertyName.trim() || 'type';
  const frontmatter = note.typeValue
    ? { [typeKey]: note.typeValue, ...note.properties }
    : note.properties;
  return `---\n${stringifyYaml(frontmatter, { lineWidth: 0 })}---\n${note.body}`;
}

/** A read-only host over note texts. Writes throw: a reader has no business making one. */
function plainHost(notes: SampleNote[]): VaultHost<PlainFile> {
  const texts = new Map<string, string>();
  const frontmatter = new Map<string, Record<string, unknown>>();

  for (const note of notes) {
    const path = `${note.folder}/${note.title}.md`;
    const text = noteText(note);
    texts.set(path, text);
    const block = /^---\n([\s\S]*?)\n?---\n/.exec(text);
    frontmatter.set(path, (parseYaml(block?.[1] ?? '') ?? {}) as Record<string, unknown>);
  }

  const fileAt = (path: string): PlainFile => ({
    path,
    basename: (path.split('/').pop() ?? path).replace(/\.md$/, ''),
  });
  const refuse = (): never => {
    throw new Error('A reader wrote to the vault.');
  };

  return {
    vault: {
      read: (file) => Promise.resolve(texts.get(file.path) ?? ''),
      create: refuse,
      modify: refuse,
      append: refuse,
      createFolder: refuse,
      getFile: (path) => (texts.has(path) ? fileAt(path) : null),
      exists: (path) => texts.has(path),
      markdownFiles: () => [...texts.keys()].map(fileAt),
    },
    metadata: { frontmatterOf: (file) => frontmatter.get(file.path) ?? null },
    frontmatter: { process: refuse },
  };
}

const notes = sampleNotes(settings, NOW);
const host = plainHost(notes);

describe('the NODAtrail readers over a plain host', () => {
  it('reads the PARA tree', () => {
    const board = readParaBoardFrom(host, settings);
    expect(board.areas.length).toBeGreaterThan(0);
    expect(board.goals.length).toBeGreaterThan(0);
    expect(board.projects.length).toBeGreaterThan(0);
    expect(board.resources.length).toBeGreaterThan(0);
    // The record carries the host's own file object, not an Obsidian one.
    expect(Object.keys(board.areas[0].file).sort()).toEqual(['basename', 'path']);
  });

  it('reads the money notes', () => {
    const board = readFinanceBoardFrom(host, settings);
    expect(board.purchases.length + board.bills.length + board.recurring.length).toBeGreaterThan(0);
  });

  it('reads the ledger, postings included, with nothing wrong in it', async () => {
    const ledger = await readLedgerFrom(host, settings);
    expect(ledger.accounts.length).toBeGreaterThan(0);
    expect(ledger.journals.length).toBeGreaterThan(0);
    expect(ledger.postings.length).toBeGreaterThan(0);
    expect(ledger.problems).toEqual([]);
    expect(ledger.unknown).toEqual([]);
  });

  it('reads the budget', () => {
    expect(readBudgetsFrom(host, settings).length).toBeGreaterThan(0);
  });
});
