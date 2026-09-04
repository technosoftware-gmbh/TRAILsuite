/**
 * The one place a timer is scheduled.
 *
 * Obsidian's own lint rule wants `window.setTimeout()` rather than the bare
 * global, and it is right to: a view living in a popout window has its own
 * `window`, and a timer scheduled on the main one can be torn down out from
 * under it when that window closes.
 *
 * The rule's problem is that `window` does not exist under Node, so any
 * module calling it directly becomes untestable. Routing every timer through
 * here fixes that once rather than per call site: production gets the
 * window-affine timer the rule asks for, unit tests get a working one, and
 * the single disable comment below sits next to the explanation instead of
 * being scattered.
 */

/**
 * Runs a callback once after a delay.
 *
 * No handle is returned. Nothing in CULItrail cancels a timer, and returning
 * one would mean callers storing an id whose type differs between the DOM and
 * Node type definitions for no benefit.
 */
export function scheduleOnce(callback: () => void, delayMs: number): void {
  if (typeof window !== 'undefined') {
    window.setTimeout(callback, delayMs);
    return;
  }
  // Node, which means a unit test. There is no window to be affine to.
  // eslint-disable-next-line obsidianmd/prefer-window-timers -- Node fallback, explained above
  setTimeout(callback, delayMs);
}
