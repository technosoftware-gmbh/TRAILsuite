/**
 * Launches an interchange export: bundles export.ts with esbuild and runs it.
 *
 * Bundled rather than run as TypeScript directly because the plugin source is
 * written for a bundler (extensionless imports) and because it imports
 * `obsidian` in places, a package with types and no runtime. The bundle points
 * `obsidian` at tests/obsidian-stub.ts, the same stand-in vitest uses, which
 * throws if anything actually calls into it: the export reads through the
 * host-free readers, and a call into Obsidian would be a bug worth hearing
 * about loudly.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..', '..');
const outfile = join(tmpdir(), `trail-interchange-${process.pid}-${Date.now()}.mjs`);

await build({
  entryPoints: [join(here, 'export.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  alias: { obsidian: join(pkg, 'tests', 'obsidian-stub.ts') },
  // The bundle includes CommonJS dependencies (yaml) that call require().
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'warning',
});

const version = JSON.parse(readFileSync(join(pkg, 'manifest.json'), 'utf8')).version;
const run = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, TRAIL_SOURCE_VERSION: version },
});
rmSync(outfile, { force: true });
process.exit(run.status ?? 1);
