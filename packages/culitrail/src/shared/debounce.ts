/**
 * Delays a call until the caller stops calling it.
 *
 * For the gallery's search field, where re-rendering a grid of several
 * hundred cards on every keystroke is the difference between a search box
 * that feels instant and one that drops characters.
 *
 * Uses the same window-affine timer as everything else, so a debounced
 * callback in a popped-out window is not torn down when the main one closes.
 */

export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** Drops a pending call. For a view that is closing and should not fire into a dead DOM. */
  cancel(): void;
}

export function debounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
): Debounced<Args> {
  // Deliberately not `shared/timers.ts`: that one schedules and forgets, and
  // a debounce is defined by being able to cancel what it scheduled.
  //
  // The handle is `unknown` because its type differs between the DOM and Node
  // definitions, and both are in play: production runs in a window, the tests
  // run under Node. `clearTimeout` accepts either, so nothing downstream needs
  // to know which one this is.
  let handle: unknown = null;

  const clear = (): void => {
    if (handle === null) return;
    const pending = handle as ReturnType<typeof setTimeout>;
    handle = null;
    if (typeof window !== 'undefined') window.clearTimeout(pending as unknown as number);
    // Node, which means a unit test. There is no window to clear against.
    // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node fallback, explained above
    else clearTimeout(pending);
  };

  const debounced = (...args: Args): void => {
    clear();
    handle =
      typeof window !== 'undefined'
        ? window.setTimeout(() => callback(...args), delayMs)
        : // Node, which means a unit test. There is no window to be affine to.
          // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node fallback, explained above
          setTimeout(() => callback(...args), delayMs);
  };

  debounced.cancel = clear;

  return debounced;
}
