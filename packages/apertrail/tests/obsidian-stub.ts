/**
 * A resolvable stand-in for the `obsidian` package, which ships type
 * definitions and no runtime at all (its package.json declares `"main": ""`).
 *
 * vitest.config.mts aliases `obsidian` here so the specifier resolves the same
 * way from this plugin's own source and from the linked `trail-core`, whose
 * Obsidian adapter imports `stringifyYaml`. Without the alias, Vite rewrites
 * the core's import to an optional-peer-dependency stub of its own, and a
 * suite's `vi.mock('obsidian')` never reaches it.
 *
 * Nothing here is meant to run. Every suite that reaches Obsidian runtime
 * mocks the module itself; this only gives the mock something to replace, and
 * throws a nameable error rather than an undefined-is-not-a-function if a
 * suite ever forgets.
 */
function unmocked(name: string): never {
  throw new Error(`obsidian.${name}() called without vi.mock('obsidian') in the suite.`);
}

export const stringifyYaml = (): never => unmocked('stringifyYaml');
export const normalizePath = (): never => unmocked('normalizePath');

/**
 * A stand-in class for `instanceof TFile`, which `image-upload.ts` uses to read
 * back the path `createBinary` actually wrote.
 *
 * A class rather than a thrower, because the check is the point: a test that
 * could not make an object pass it would be testing the fallback branch and
 * calling it the main one.
 */
export class TFile {
  path = '';
  basename = '';
  extension = '';
  stat = { mtime: 0, ctime: 0, size: 0 };
}
