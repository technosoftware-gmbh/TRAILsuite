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

/**
 * A real class, unlike everything else here, because `instanceof TFile` is how
 * this plugin narrows an abstract file and eslint's obsidianmd rules refuse the
 * cast that would avoid it. A stub object cannot satisfy `instanceof`, so the
 * class has to exist for any suite that exercises a path lookup.
 *
 * Only the three members the plugin reads. It is never constructed by Obsidian
 * here -- a test builds one and puts it in a fake vault.
 */
export class TFile {
  path = '';
  basename = '';
  extension = 'md';
}

export const stringifyYaml = (): never => unmocked('stringifyYaml');
export const normalizePath = (): never => unmocked('normalizePath');
