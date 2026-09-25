/**
 * `npm run interchange -- <vault> <out>`
 *
 * Writes `apertrail.json`: APERtrail's families, parsed, with every pointer
 * between notes as a path. The raw notes and the report are written by
 * NODAtrail's export, which the root `scripts/export-interchange.sh` runs after
 * this one.
 */
import { join } from 'node:path';
import { formatDayTitle, sectionFile } from '@technosoftware/trail-core';
import { mergeSettings } from '../../src/settings/validate';
import { apertrailFamilies } from '../../src/interchange/sections';
import { diskVault } from './fs-host';
import { dayVisitsOnDisk } from './link-index';
import { exportArgs, missingFolders, savedSettings, sourceVersion, writeJson } from './cli';

const USAGE = 'npm run interchange -- <vault> <out>';

async function main(): Promise<void> {
  const { vault, out } = exportArgs(process.argv.slice(2), USAGE);
  const disk = diskVault(vault);
  const settings = mergeSettings(savedSettings(vault, 'apertrail'));
  const now = new Date();
  const meta = { sourceVersion: sourceVersion(), generatedAt: now.toISOString() };

  for (const line of missingFolders(settings, disk.folders)) {
    process.stderr.write(`apertrail: folder not in vault: ${line}\n`);
  }
  for (const path of disk.unparsable) {
    process.stderr.write(`apertrail: frontmatter does not parse, read as none: ${path}\n`);
  }

  const families = apertrailFamilies(
    disk.host,
    settings,
    await dayVisitsOnDisk(disk.host),
    formatDayTitle(now)
  );
  writeJson(join(out, 'apertrail.json'), sectionFile('apertrail', meta, families));
  process.stdout.write(
    `apertrail: ${Object.entries(families)
      .map(([family, entries]) => `${entries.length} ${family}`)
      .join(', ')}\n`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
