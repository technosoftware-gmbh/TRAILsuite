/**
 * The Obsidian wiring around note detection: auto-opening a note in the view
 * CULItrail has for it, and the file-menu entry that opens one on demand.
 *
 * One registration serves every kind that has such a view, meals and orders
 * today. A second copy of this plumbing per kind would mean two suppression
 * windows, two pairs of event subscriptions and two chances to get the
 * fires-twice case wrong.
 *
 * Deliberately thin. Everything decidable lives in auto-open.ts and
 * vault/read-notes.ts, so what remains here is event registration, which no
 * test can exercise and which therefore should contain as little judgement as
 * possible.
 */
import { App, Component, MarkdownView, Menu, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import { CULItrailSettings } from '../../settings/types';
import { CuliEntityType } from '../../vault/entity-types';
import { isNoteOfType } from '../../vault/read-notes';
import { isAutoOpenSuppressed, shouldOpenInOwnView } from './auto-open';

/**
 * The slice of the plugin this module needs.
 *
 * An interface rather than the plugin class, so the wiring does not depend on
 * the whole of it and the dependency runs one way: lifecycle knows it needs
 * an app, a settings callback and a way to open a note, and nothing else.
 */
export interface LifecycleHost extends Component {
  app: App;
}

/** One kind of note, and the view CULItrail renders it in. */
export interface AutoOpenTarget {
  /** Which notes this view renders, on the ordinary folder-and-type terms. */
  kind: CuliEntityType;
  /** The view type a leaf is converted to, and the one the menu entry hides inside. */
  viewType: string;
  /** Whether the user has asked for this conversion at all. */
  isEnabled: (settings: CULItrailSettings) => boolean;
  open: (leaf: WorkspaceLeaf, file: TFile) => void;
  /** Resolved when the menu opens rather than at registration, so it is translated. */
  menuTitle: () => string;
  menuIcon: string;
}

export interface LifecycleDeps {
  getSettings: () => CULItrailSettings;
  /**
   * Consulted in order, first match wins. A note is one kind, so the order only
   * matters if two kinds ever share a folder and a type value, which the
   * folder-and-type rule already makes a misconfiguration rather than a case to
   * resolve here.
   */
  targets: AutoOpenTarget[];
}

/**
 * Converts a Markdown leaf showing one of our notes into the view for it.
 *
 * Bound to two events, and both are needed. `file-open` covers navigating to
 * a different file inside the leaf that is already active. `active-leaf-change`
 * covers moving focus to a different leaf whose file did not change, which is
 * what a split-pane focus switch onto an existing Markdown tab does. Neither
 * alone covers every way a note ends up in front of somebody.
 *
 * The cost of binding both is that one navigation can fire twice. That is
 * harmless here (the second call finds a leaf that is no longer a
 * MarkdownView and stops) and it is the reason the suppression in
 * auto-open.ts is time-based rather than consume-once.
 */
export function registerAutoOpen(host: LifecycleHost, deps: LifecycleDeps): void {
  const tryConvert = (): void => {
    const settings = deps.getSettings();
    const view = host.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file ?? null;
    if (!view || !file) return;

    // Suppression is asked once rather than per target: it is about this path
    // having just been handed back as Markdown deliberately, whatever it would
    // otherwise have been opened as.
    const suppressed = isAutoOpenSuppressed(file.path);

    for (const target of deps.targets) {
      const decision = shouldOpenInOwnView({
        autoOpenEnabled: target.isEnabled(settings),
        activeMarkdownPath: file.path,
        isSubject: isNoteOfType(host.app, settings, file, target.kind),
        suppressed,
      });

      if (decision) {
        target.open(view.leaf, file);
        return;
      }
    }
  };

  host.registerEvent(host.app.workspace.on('file-open', tryConvert));
  host.registerEvent(host.app.workspace.on('active-leaf-change', tryConvert));
}

/**
 * Adds "Open in meal view" or "Open in order view" to the file menu.
 *
 * The way in when auto-open is off, and the way back when somebody has
 * switched a note to Markdown. Hidden on a leaf that is already showing that
 * view, where it would do nothing. Offered even when the setting is off, which
 * is the case it exists for.
 */
export function registerContextMenu(host: LifecycleHost, deps: LifecycleDeps): void {
  host.registerEvent(
    host.app.workspace.on(
      'file-menu',
      (menu: Menu, file: TAbstractFile, _source: string, leaf?: WorkspaceLeaf) => {
        if (!(file instanceof TFile)) return;
        const settings = deps.getSettings();

        for (const target of deps.targets) {
          if (leaf?.view.getViewType() === target.viewType) continue;
          if (!isNoteOfType(host.app, settings, file, target.kind)) continue;

          menu.addItem((item) =>
            item
              .setTitle(target.menuTitle())
              .setIcon(target.menuIcon)
              .onClick(() => {
                if (leaf) target.open(leaf, file);
              })
          );
          return;
        }
      }
    )
  );
}
