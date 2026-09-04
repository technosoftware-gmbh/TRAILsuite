/**
 * Reveals an existing leaf of a view type, or opens one.
 *
 * The singleton-leaf pattern every CULItrail view follows: opening the
 * dashboard or the gallery a second time reveals the tab that is already
 * there rather than stacking duplicates.
 */
import { App, TFile, WorkspaceLeaf } from 'obsidian';

/**
 * @param filePath
 *   Omit for a singleton view (dashboard, gallery, grocery, meal plan,
 *   orders). Pass it for a file-backed view such as the meal view, so an
 *   existing tab showing *that* meal is reused rather than a tab showing a
 *   different one being hijacked.
 * @param newLeafMode
 *   Where a new leaf goes when none exists. Irrelevant when one is reused.
 *   Defaults to a new tab, matching what a ribbon icon or a command should
 *   do. Pass `false` for a caller that should behave like clicking a file in
 *   the explorer and replace the current leaf instead.
 */
export async function findOrOpenLeaf(
  app: App,
  viewType: string,
  filePath?: string,
  newLeafMode: boolean | 'tab' = 'tab'
): Promise<WorkspaceLeaf> {
  const existing = filePath
    ? app.workspace
        .getLeavesOfType(viewType)
        .find((leaf) => (leaf.view as { file?: TFile }).file?.path === filePath)
    : app.workspace.getLeavesOfType(viewType)[0];

  if (existing) {
    void app.workspace.revealLeaf(existing);
    return existing;
  }

  const leaf = app.workspace.getLeaf(newLeafMode);
  await leaf.setViewState({
    type: viewType,
    ...(filePath ? { state: { file: filePath } } : {}),
    active: true,
  });
  void app.workspace.revealLeaf(leaf);
  return leaf;
}
