/**
 * What the orders view needs from the plugin around it.
 *
 * `openByTitle` rather than `openPath`: an order names its meals as
 * wikilinks, and a wikilink resolves by note title. Handing this a path would
 * mean resolving the link twice, differently, in two places.
 */
import type { TFile, WorkspaceLeaf } from 'obsidian';
import type { CULItrailSettings, OrdersSavedState } from '../../settings/types';

export interface OrderViewDeps {
  getSettings: () => CULItrailSettings;
  /**
   * Persists the toolbar's state.
   *
   * Separate from a general save, exactly like the gallery's, so the view can
   * write where somebody left the list and nothing else.
   */
  saveOrdersState: (state: OrdersSavedState) => Promise<void>;
  subscribeToChanges: (onChange: () => void) => () => void;
  /** Follows a wikilink from the order note it was written in. */
  openByTitle: (title: string, fromPath: string) => void;
}

/**
 * What one order note rendered as an invoice needs.
 *
 * The list view's deps plus the escape hatch, because this one replaces
 * Obsidian's own rendering of a note and therefore has to be able to give it
 * back.
 */
export interface OrderNoteViewDeps extends OrderViewDeps {
  /**
   * Turns this leaf back into plain Markdown, suppressing the auto-open that
   * would otherwise convert it straight back.
   *
   * Takes the leaf rather than looking one up. The view knows which leaf it is
   * in, and guessing with `getMostRecentLeaf()` is unreliable during fast tab
   * sequences.
   */
  editAsMarkdown: (leaf: WorkspaceLeaf, file: TFile) => void;
}
