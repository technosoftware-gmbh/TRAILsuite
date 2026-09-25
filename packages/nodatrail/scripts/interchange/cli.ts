/**
 * The pieces of an interchange export that are about the command line rather
 * than about a vault: arguments, the plugin's saved settings, and writing files.
 *
 * **A copy of this file lives in APERtrail's `scripts/interchange/`**, for the
 * reason fs-host.ts gives. Change both.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';

export interface ExportArgs {
  vault: string;
  out: string;
  flags: Set<string>;
}

/** `<vault> <out> [--flag ...]`, with the out folder refused when it sits inside the vault. */
export function exportArgs(argv: readonly string[], usage: string): ExportArgs {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  if (positional.length !== 2) {
    process.stderr.write(`${usage}\n`);
    process.exit(2);
  }

  const vault = realpathSync(resolve(positional[0]));
  const out = resolve(positional[1]);
  // Writing the export into the vault would put two thousand notes' worth of
  // JSON beside the notes, synced to every device and indexed by Obsidian. The
  // export reads a vault; it never adds to one.
  const inside = relative(vault, out);
  if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) {
    process.stderr.write(`Refusing to write into the vault: ${out}\n`);
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  return { vault, out, flags };
}

/**
 * The plugin's saved settings, raw, or `{}` for a vault that never saved any.
 *
 * The configuration folder is found rather than named: it is `.obsidian` in
 * every vault anybody has made, and it is a setting.
 */
export function savedSettings(vault: string, pluginId: string): unknown {
  for (const entry of readdirSync(vault, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('.')) continue;
    const candidate = join(vault, entry.name, 'plugins', pluginId, 'data.json');
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8')) as unknown;
  }
  return {};
}

/**
 * Folder settings that name a folder the vault does not have.
 *
 * Reported rather than fatal. An unused feature leaves its folder unmade, and
 * that is fine; a misresolved one is the reason a whole family comes out empty,
 * and this is the line that says which.
 */
export function missingFolders(settings: object, folders: Set<string>): string[] {
  return (
    Object.entries(settings)
      // `areasArchiveFolder` and its siblings name a folder under the archive
      // root rather than one in the vault, so a path check would misreport them.
      .filter(
        ([key, value]) =>
          key.endsWith('Folder') && !/.ArchiveFolder$/.test(key) && typeof value === 'string'
      )
      // Blank and `/` both mean the vault root, which always exists.
      .map(([key, value]) => [key, (value as string).trim().replace(/^\/+|\/+$/g, '')] as const)
      .filter(([, folder]) => folder !== '' && !folders.has(folder.normalize('NFC')))
      .map(([key, folder]) => `${key} = ${folder}`)
  );
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/** The version the launcher read out of manifest.json. */
export function sourceVersion(): string {
  return process.env.TRAIL_SOURCE_VERSION ?? 'unknown';
}
