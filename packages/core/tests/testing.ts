/**
 * Small readers for test code, where a fixture guarantees more than the type does.
 *
 * Not a test file: vitest collects `*.test.ts` only, so this is compiled and
 * imported like any other module.
 */

/**
 * The value, or a failed test.
 *
 * For a reader that returns `T | null` where the fixture guarantees one. The
 * two cheap answers are both wrong here: `!` silences the compiler and turns an
 * absence into a confusing property-of-undefined crash further on, and `?.`
 * turns it into an assertion that quietly passes. This fails where the value is
 * read, naming what was missing.
 */
export function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} was expected to be present`);
  return value;
}
