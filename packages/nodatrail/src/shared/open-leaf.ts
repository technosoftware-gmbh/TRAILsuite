/** Reuses an existing leaf of a given view type, or opens a new tab. */
import { App, WorkspaceLeaf } from 'obsidian';

export async function findOrOpenLeaf(app: App, viewType: string): Promise<WorkspaceLeaf> {
  const existing = app.workspace.getLeavesOfType(viewType)[0];
  if (existing) {
    void app.workspace.revealLeaf(existing);
    return existing;
  }

  const leaf = app.workspace.getLeaf('tab');
  await leaf.setViewState({ type: viewType, active: true });
  void app.workspace.revealLeaf(leaf);
  return leaf;
}
