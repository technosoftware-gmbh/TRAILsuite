/**
 * A comma-separated setting as a list.
 *
 * Its own module rather than a function in defaults.ts, because the vault
 * readers need it and defaults.ts pulls in the translation manager, which
 * imports `obsidian`. `tests/host-free.test.ts` is what notices if it moves back.
 */

/** A comma-separated setting as a list, blanks dropped. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}
