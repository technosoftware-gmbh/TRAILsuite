/**
 * Clicking the meal folder in the file explorer opens the gallery.
 *
 * The one piece of CULItrail that reaches into Obsidian's own UI rather than
 * its API, because there is no event for "a folder was clicked". The decision
 * is a plain function so the part worth arguing about is testable, and the
 * registration below is kept as thin as a DOM listener can be.
 */
import { Component } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { foldersFor } from '../../vault/entity-types';

/** A folder path with any leading or trailing slashes removed. */
function normalizeFolder(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, '');
}

export interface FolderClickScope {
  enabled: boolean;
  /** Whether a folder *inside* a meal folder counts too. */
  includeSubfolders: boolean;
  mealFolders: string[];
}

export function folderClickScope(settings: CULItrailSettings): FolderClickScope {
  return {
    enabled: settings.openGalleryOnFolderClick,
    includeSubfolders: settings.openGalleryOnFolderClickSubfolders,
    mealFolders: foldersFor(settings, 'meal'),
  };
}

/**
 * Whether clicking this folder should open the gallery.
 *
 * A blank configured folder never matches, the same rule every reader
 * follows. Here it matters twice over: the explorer's vault-root element
 * carries an empty path, so a blank setting matching it would open the
 * gallery on every click anywhere in the tree.
 */
export function shouldOpenGalleryForFolder(folderPath: string, scope: FolderClickScope): boolean {
  return galleryFolderForClick(folderPath, scope) !== undefined;
}

/**
 * What the gallery's folder filter should be set to for this click.
 *
 * `undefined` means the click was not on a meal folder and nothing should
 * happen. `null` means open the gallery unfiltered, which is what clicking a
 * meal root does: filtering to that root would look like a no-op and would
 * actually hide anything in `additionalMealFolders`. A subfolder gives its
 * own path, so clicking `Meals/Baking` opens the gallery showing baking.
 */
export function galleryFolderForClick(
  folderPath: string,
  scope: FolderClickScope
): string | null | undefined {
  if (!scope.enabled) return undefined;

  const clicked = normalizeFolder(folderPath);
  if (clicked === '') return undefined;

  for (const folder of scope.mealFolders) {
    const target = normalizeFolder(folder);
    if (target === '') continue;
    if (clicked === target) return null;
    if (scope.includeSubfolders && clicked.startsWith(`${target}/`)) return clicked;
  }

  return undefined;
}

/**
 * The folder path an explorer click landed on, or null.
 *
 * Read off the nearest `.nav-folder-title`, which is where Obsidian puts
 * `data-path`. Walking up from the target rather than matching it directly is
 * what makes a click on the folder's name, its collapse chevron or the
 * padding around either behave the same.
 */
export function folderPathFromClick(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const title = target.closest<HTMLElement>('.nav-folder-title');
  return title?.dataset.path ?? null;
}

export interface FolderClickDeps {
  getSettings: () => CULItrailSettings;
  /** `null` opens the gallery unfiltered; a path narrows it to that folder. */
  openGallery: (folder: string | null) => void;
}

/**
 * Watches the explorer for clicks on a meal folder.
 *
 * One listener on the document rather than one per folder element, because
 * the explorer builds and discards its rows as the tree scrolls and folds,
 * and anything bound to a row would be bound to an element that no longer
 * exists a moment later.
 *
 * The click is not consumed: the folder still expands. Swallowing it would
 * mean this setting quietly took the explorer's own behaviour away, which is
 * not what somebody enabling a shortcut asked for.
 */
export function registerFolderClick(host: Component, deps: FolderClickDeps): void {
  host.registerDomEvent(activeDocument, 'click', (event: MouseEvent) => {
    const path = folderPathFromClick(event.target);
    if (path === null) return;

    const folder = galleryFolderForClick(path, folderClickScope(deps.getSettings()));
    if (folder !== undefined) deps.openGallery(folder);
  });
}
