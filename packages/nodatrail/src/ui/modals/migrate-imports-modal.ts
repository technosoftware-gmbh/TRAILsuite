/**
 * The preview for the one-off move of archived imports out of the documents
 * folder.
 *
 * `shared/migrate-imports.ts` explains what moved and why. This is the dialog
 * in front of it, modelled on `repair-times-modal.ts` for that file's stated
 * reason: nothing happens until the list has been read and a button pressed.
 * The reason applies here too, if less sharply -- this moves files somebody has
 * had in their vault for a year, and it renames them on the way.
 *
 * **Old name and new name on one line.** The rename is the part that is hard to
 * picture from a sentence, and reading the two off separate columns a summary
 * apart is how a wrong one gets waved through.
 */
import { Modal, Notice, Setting, type App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { emptyState } from '../kit/elements';
import {
  planImportMigration,
  runImportMigration,
  type ImportMove,
} from '../../shared/migrate-imports';

export interface MigrateImportsDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  onMigrated: () => void;
}

export class MigrateImportsModal extends Modal {
  private moves: readonly ImportMove[] = [];
  private busy = false;

  constructor(private readonly deps: MigrateImportsDeps) {
    super(deps.app);
  }

  override onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('nod-import-modal');

    contentEl.createEl('h2', { text: t('imports.migrate.title') });
    this.moves = planImportMigration(this.deps.app, this.deps.getSettings()).moves;

    const body = contentEl.createDiv({ cls: 'nod-import-body' });
    const footer = contentEl.createDiv({ cls: 'nod-import-footer' });

    if (this.moves.length === 0) {
      // Said rather than shown, and it is the ordinary answer: a vault that
      // never imported anything, and every vault once this has been run.
      emptyState(body, t('imports.migrate.nothing'));
    } else {
      body.createEl('p', {
        cls: 'nod-import-summary',
        text: t('imports.migrate.intro', { count: String(this.moves.length) }),
      });
      body.createEl('p', { cls: 'nod-import-note', text: t('imports.migrate.stamps') });
      this.renderMoves(body);
    }

    this.renderFooter(footer);
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private renderMoves(parent: HTMLElement): void {
    parent.createEl('h3', {
      text: t('imports.migrate.heading', { count: String(this.moves.length) }),
    });

    for (const move of this.moves) {
      const line = parent.createDiv({ cls: 'nod-import-row nod-import-ready' });
      line.createSpan({
        cls: 'nod-import-text',
        text: `${nameOf(move.from)} -> ${nameOf(move.to)}`,
      });
      line.createSpan({ cls: 'nod-import-note', text: move.folder });
    }
  }

  private renderFooter(footer: HTMLElement): void {
    new Setting(footer)
      .addButton((button) => button.setButtonText(t('common.close')).onClick(() => this.close()))
      .addButton((button) => {
        button
          .setButtonText(t('imports.migrate.button', { count: String(this.moves.length) }))
          .setCta()
          .setDisabled(this.moves.length === 0 || this.busy)
          .onClick(() => {
            void this.migrate();
          });
      });
  }

  private async migrate(): Promise<void> {
    if (this.busy || this.moves.length === 0) return;
    this.busy = true;

    const result = await runImportMigration(this.deps.app, this.moves);

    const said = [t('imports.migrate.done', { count: String(result.moved) })];
    // Named rather than counted. A file that would not move is one somebody has
    // to go and look at, and a number does not say which.
    if (result.failed.length > 0) {
      said.push(t('imports.migrate.failed', { files: result.failed.join(', ') }));
    }
    new Notice(said.join('\n'));

    this.deps.onMigrated();
    this.close();
  }
}

/** The last segment of a path, which is the half of it that changed. */
function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
