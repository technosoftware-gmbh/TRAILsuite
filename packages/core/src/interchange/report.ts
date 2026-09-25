/**
 * What an export carried, and what it did not.
 *
 * This is the spike's first exit criterion made mechanical: no note is dropped.
 * A note is either claimed by some plugin's family or listed as unrecognised,
 * and anything that does not add up (a record for a note the vault does not
 * hold, a reference to one, a note two families both claim) is named.
 *
 * App-free.
 */
import type { SectionFile, VaultManifest } from './types.js';

export interface InterchangeReport {
  notes: number;
  /** One row per plugin family, in the order the files were given. */
  families: { source: string; family: string; count: number }[];
  /** One row per line family (tasks), which name a note without claiming it. */
  lines: { source: string; family: string; count: number }[];
  /** Notes no family claimed. Carried raw in `vault.json`, never dropped. */
  unrecognised: string[];
  /** Unrecognised notes counted by their first two folder levels, largest first. */
  unrecognisedByFolder: { folder: string; count: number }[];
  /** A note claimed by more than one family, with every family that claimed it. */
  claimedTwice: { path: string; by: string[] }[];
  /** A record whose note is not in the manifest: two hosts disagreeing about a path. */
  missingFromVault: { path: string; by: string }[];
  /** A `{ ref }` pointing at a path the manifest does not hold. */
  danglingRefs: { from: string; ref: string }[];
}

/** Every `{ ref }` anywhere inside a value. */
function refsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, found);
  } else if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    const ref = (value as { ref?: unknown }).ref;
    if (keys.length === 1 && typeof ref === 'string') found.push(ref);
    else for (const field of Object.values(value)) refsIn(field, found);
  }
  return found;
}

function folderOf(path: string): string {
  const parts = path.split('/');
  return parts.length <= 1
    ? '(vault root)'
    : parts.slice(0, Math.min(2, parts.length - 1)).join('/');
}

export function interchangeReport(
  manifest: VaultManifest,
  sections: readonly SectionFile[]
): InterchangeReport {
  const inVault = new Set(manifest.notes.map((note) => note.path));
  const claims = new Map<string, string[]>();
  const report: InterchangeReport = {
    notes: manifest.notes.length,
    families: [],
    lines: [],
    unrecognised: [],
    unrecognisedByFolder: [],
    claimedTwice: [],
    missingFromVault: [],
    danglingRefs: [],
  };

  for (const section of sections) {
    for (const [family, entries] of Object.entries(section.families)) {
      const by = `${section.source}/${family}`;
      report.families.push({ source: section.source, family, count: entries.length });
      for (const entry of entries) {
        claims.set(entry.path, [...(claims.get(entry.path) ?? []), by]);
        if (!inVault.has(entry.path)) report.missingFromVault.push({ path: entry.path, by });
        for (const ref of refsIn(entry.record)) {
          if (!inVault.has(ref)) report.danglingRefs.push({ from: entry.path, ref });
        }
      }
    }
  }

  // Lines name their note and are checked like records, but claim nothing: a
  // note is recognised by a family or it is carried raw, whatever lines it holds.
  for (const section of sections) {
    for (const [family, entries] of Object.entries(section.lines ?? {})) {
      const by = `${section.source}/${family}`;
      report.lines.push({ source: section.source, family, count: entries.length });
      for (const entry of entries) {
        if (!inVault.has(entry.path)) report.missingFromVault.push({ path: entry.path, by });
        for (const ref of refsIn(entry.record)) {
          if (!inVault.has(ref)) report.danglingRefs.push({ from: entry.path, ref });
        }
      }
    }
  }

  const folders = new Map<string, number>();
  for (const note of manifest.notes) {
    const by = claims.get(note.path);
    if (!by) {
      report.unrecognised.push(note.path);
      folders.set(folderOf(note.path), (folders.get(folderOf(note.path)) ?? 0) + 1);
    } else if (by.length > 1) {
      report.claimedTwice.push({ path: note.path, by });
    }
  }
  report.unrecognisedByFolder = [...folders]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count || (a.folder < b.folder ? -1 : 1));

  return report;
}

/**
 * The report as markdown, for a person to read after a run.
 *
 * Counts only, never a note's content: the report is what gets pasted into an
 * issue or a chat, and the vault behind it is private.
 */
export function formatInterchangeReport(report: InterchangeReport): string {
  const claimed = report.notes - report.unrecognised.length;
  const lines = [
    '# Interchange export',
    '',
    `${report.notes} notes in the vault: ${claimed} recognised, ${report.unrecognised.length} carried raw only.`,
    '',
    '| Source | Family | Records |',
    '| --- | --- | --- |',
    ...report.families.map((row) => `| ${row.source} | ${row.family} | ${row.count} |`),
    '',
  ];
  if (report.lines.length > 0) {
    lines.push(
      '## Lines inside notes',
      '',
      '| Source | Family | Lines |',
      '| --- | --- | --- |',
      ...report.lines.map((row) => `| ${row.source} | ${row.family} | ${row.count} |`),
      ''
    );
  }
  lines.push(
    '## Carried raw only, by folder',
    '',
    '| Folder | Notes |',
    '| --- | --- |',
    ...report.unrecognisedByFolder.map((row) => `| ${row.folder} | ${row.count} |`),
    '',
    '## Checks',
    '',
    `- Notes claimed by two families: ${report.claimedTwice.length}`,
    `- Records for a note the vault does not hold: ${report.missingFromVault.length}`,
    `- References to a note the vault does not hold: ${report.danglingRefs.length}`
  );
  const problems = [
    ...report.claimedTwice.map((row) => `- claimed twice: ${row.path} (${row.by.join(', ')})`),
    ...report.missingFromVault.map((row) => `- not in vault: ${row.path} (${row.by})`),
    ...report.danglingRefs.map((row) => `- dangling: ${row.from} -> ${row.ref}`),
  ];
  if (problems.length > 0) lines.push('', '## Details', '', ...problems);
  return `${lines.join('\n')}\n`;
}
