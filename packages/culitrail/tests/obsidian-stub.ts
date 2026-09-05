/**
 * The runtime slice of `obsidian` that vitest has to resolve.
 *
 * The npm `obsidian` package ships type definitions and no code, so a module
 * importing a *value* from it cannot be loaded under Node. Nothing in `src/`
 * does. `@technosoftware/trail-core/obsidian` does: its adapter is the one file in the core
 * allowed to touch Obsidian, and `src/shared/vault-host.ts` imports it to build
 * a vault host. Aliasing the package to this file is what lets a test drive a
 * real write through that host.
 *
 * Only what the adapter names at module scope is here, and it throws rather
 * than approximating. No test calls it, and a stand-in producing
 * not-quite-YAML would be worse than a failure that says what is missing.
 */

/** Obsidian's YAML writer, which has no Node equivalent worth faking. */
export function stringifyYaml(): string {
  throw new Error('stringifyYaml has no runtime outside Obsidian; see tests/obsidian-stub.ts.');
}

/**
 * Obsidian's path tidier, reimplemented rather than thrown from.
 *
 * **The exception to the rule above, and worth saying why it is one.**
 * `stringifyYaml` throws because a stand-in producing not-quite-YAML would
 * hide a real difference. This is not that: it is path arithmetic with no host
 * behind it, documented as collapsing separators, trimming the ends and
 * normalising to NFC, and a copy of it cannot drift from Obsidian in a way a
 * test would care about.
 *
 * It is here because `freeMealPath` calls it while choosing a filename, and
 * choosing a filename that does not land on an existing note is exactly the
 * part worth testing.
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .normalize('NFC');
}
