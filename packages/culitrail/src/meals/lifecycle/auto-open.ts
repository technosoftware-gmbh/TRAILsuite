/**
 * Whether a Markdown note should be swapped for one of CULItrail's own views,
 * and the short-lived suppression that lets somebody say no.
 *
 * Kind-agnostic: a meal note becoming the meal view and an order note
 * becoming the invoice are the same decision with a different subject, and one
 * suppression window serves both, because a leaf can only be showing one of
 * them at a time.
 *
 * The decision is separated from the Obsidian wiring on purpose. It has four
 * inputs and one genuinely subtle case, and the wiring around it is
 * event-plumbing that no test can exercise.
 */
import { scheduleOnce } from '../../shared/timers';

/**
 * Paths recently switched to Markdown **deliberately**, by the "Open current
 * as Markdown" command or a view's own escape hatch.
 *
 * Without this, the listeners convert the leaf straight back and the escape
 * hatch appears not to work at all.
 *
 * A timed set rather than a consume-once flag, and that is the subtle part:
 * **a single `setViewState()` fires both `file-open` and
 * `active-leaf-change`**. A flag cleared by the first would be gone before
 * the second arrived, and the second would convert the leaf back. A short
 * window covers both without having to know which order they come in or
 * whether both always fire.
 */
const suppressedPaths = new Set<string>();

/** How long a deliberate switch to Markdown is respected. Long enough to outlast both events, short enough that a later genuine open still converts. */
const SUPPRESSION_MS = 500;

export function suppressAutoOpenOnce(path: string, timeoutMs = SUPPRESSION_MS): void {
  suppressedPaths.add(path);
  scheduleOnce(() => suppressedPaths.delete(path), timeoutMs);
}

export function isAutoOpenSuppressed(path: string): boolean {
  return suppressedPaths.has(path);
}

/** Test seam. Production never needs this: entries expire on their own. */
export function clearAutoOpenSuppression(): void {
  suppressedPaths.clear();
}

export interface AutoOpenContext {
  /** False when the setting for this view is off, which disables the whole behaviour. */
  autoOpenEnabled: boolean;
  /** The path of the file in the active Markdown view, or null when the active view is not one. */
  activeMarkdownPath: string | null;
  /**
   * Whether that file is a note this view renders, decided by the caller
   * through the ordinary folder-and-type rule. Kind-agnostic here on purpose:
   * this module has no business knowing which kinds exist.
   */
  isSubject: boolean;
  /** Whether that path was recently switched to Markdown on purpose. */
  suppressed: boolean;
}

/**
 * The whole decision, in one place.
 *
 * Every branch returns false for a reason worth keeping distinct rather than
 * collapsing into one condition, because each corresponds to a different
 * thing somebody might report as "the meal view stopped opening".
 */
export function shouldOpenInOwnView(context: AutoOpenContext): boolean {
  if (!context.autoOpenEnabled) return false;
  // Not a Markdown view at all: already one of our views, or a dashboard, or
  // a PDF. Converting anything here would fight whatever is showing.
  if (context.activeMarkdownPath === null) return false;
  if (context.suppressed) return false;
  return context.isSubject;
}
