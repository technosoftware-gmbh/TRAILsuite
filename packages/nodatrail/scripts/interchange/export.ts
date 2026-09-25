/**
 * `npm run interchange -- <vault> <out> [--manifest]`
 *
 * Writes `nodatrail.json`: NODAtrail's families, parsed. With `--manifest` it
 * also writes `vault.json`, every note raw, and `report.md`, which reads every
 * section file already in `<out>` and says whether anything was dropped. The
 * root `scripts/export-interchange.sh` runs APERtrail's export first and this
 * one last for that reason.
 *
 * NODAtrail writes the manifest because most notes no plugin parses yet are its
 * own (the periodic notes), not because the manifest is NODAtrail's format: it
 * is the core's.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatInterchangeReport,
  interchangeReport,
  sectionFile,
  vaultManifest,
  INTERCHANGE_FORMAT,
  VAULT_SOURCE,
  type SectionFile,
} from '@technosoftware/trail-core';
import { mergeSettings } from '../../src/settings/validate';
import { nodatrailFamilies, nodatrailLines } from '../../src/interchange/sections';
import { diskVault } from './fs-host';
import {
  exportArgs,
  missingFolders,
  readJson,
  savedSettings,
  sourceVersion,
  writeJson,
} from './cli';

const USAGE = 'npm run interchange -- <vault> <out> [--manifest]';

async function main(): Promise<void> {
  const { vault, out, flags } = exportArgs(process.argv.slice(2), USAGE);
  const disk = diskVault(vault);
  const settings = mergeSettings(savedSettings(vault, 'nodatrail'));
  const meta = { sourceVersion: sourceVersion(), generatedAt: new Date().toISOString() };

  for (const line of missingFolders(settings, disk.folders)) {
    process.stderr.write(`nodatrail: folder not in vault: ${line}\n`);
  }
  for (const path of disk.unparsable) {
    process.stderr.write(`nodatrail: frontmatter does not parse, read as none: ${path}\n`);
  }

  writeJson(
    join(out, 'nodatrail.json'),
    sectionFile(
      'nodatrail',
      meta,
      await nodatrailFamilies(disk.host, settings),
      await nodatrailLines(disk.host, settings)
    )
  );

  if (!flags.has('--manifest')) return;

  const manifest = await vaultManifest(disk.host, meta);
  writeJson(join(out, 'vault.json'), manifest);

  // Every section file in the folder, whichever plugin wrote it, so a
  // CULItrail file dropped in beside these counts as well.
  const sections = readdirSync(out)
    .filter((name) => name.endsWith('.json') && name !== 'vault.json')
    .map((name) => readJson(join(out, name)) as SectionFile)
    .filter((file) => file.format === INTERCHANGE_FORMAT && file.source !== VAULT_SOURCE);
  const report = interchangeReport(manifest, sections);

  writeJson(join(out, 'report.json'), report);
  const text = formatInterchangeReport(report);
  writeFileSync(join(out, 'report.md'), text, 'utf8');
  process.stdout.write(text);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error);
  process.stderr.write(`${message}
`);
  process.exit(1);
});
