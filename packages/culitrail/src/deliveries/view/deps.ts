/**
 * What one delivery note rendered as a document is allowed to see.
 *
 * Shaped like `orders/view/deps.ts`'s `OrderNoteViewDeps`, minus the toolbar
 * state: there is no delivery list view to persist one for. Deliveries are
 * reached through the orders view and through their own notes, and this is the
 * slice the note view needs.
 */
import type { TFile, WorkspaceLeaf } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';

export interface DeliveryNoteViewDeps {
  getSettings: () => CULItrailSettings;
  subscribeToChanges: (onChange: () => void) => () => void;
  /** Follows a wikilink from the delivery note it was written in. */
  openByTitle: (title: string, fromPath: string) => void;
  /**
   * Turns this leaf back into plain Markdown, suppressing the auto-open that
   * would otherwise convert it straight back.
   *
   * Takes the leaf rather than looking one up, for the reason the order view's
   * does: the view knows which leaf it is in, and `getMostRecentLeaf()` is
   * unreliable during fast tab sequences.
   */
  editAsMarkdown: (leaf: WorkspaceLeaf, file: TFile) => void;
}
