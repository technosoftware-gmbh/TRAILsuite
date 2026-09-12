/**
 * Closes a task and records why.
 *
 * **Beside ticking rather than instead of it.** Most tasks close without
 * anything worth saying, and a dialog in front of every one of them would be a
 * tax on the fifty that need nothing to serve the two that do. So the checkbox
 * stays exactly as fast as it was and this is a second action next to it.
 *
 * The comment is written as indented lines under the task and the task line
 * itself is only ticked, so every other reader of that line in the vault sees
 * what it always saw. See trail-core's `tasks/comment.ts` for why the format is
 * not a field of our own.
 *
 * An existing comment is offered for editing rather than replaced blind: a task
 * closed, reopened and closed again is the case where somebody has already
 * written the useful sentence.
 */
import { App, Notice } from 'obsidian';
import { taskComment, type TaskStatus } from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { closeTaskWithComment } from '../../tasks/write-tasks';
import type { VaultTask } from '../../tasks/read-tasks';
import { FormModal } from './form-modal';

export interface CloseTaskDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  today: () => Date;
  onChanged: () => void;
}

export class CloseTaskModal extends FormModal {
  private comment = '';
  /** `done` or `cancelled`: the two ways a task stops being open. */
  private status: TaskStatus = 'done';

  constructor(
    private readonly deps: CloseTaskDeps,
    private readonly task: VaultTask
  ) {
    super(deps.app);
  }

  protected heading(): string {
    return t('plan.closeTask');
  }

  protected override async load(): Promise<void> {
    // Read from the file rather than from the scanned task, which carries the
    // line and not what is under it.
    this.comment = taskComment(await this.app.vault.read(this.task.file), this.task) ?? '';
  }

  protected fields(container: HTMLElement): void {
    this.hint(container, this.task.text);

    this.select(
      container,
      t('common.status'),
      [
        ['done', t('plan.closeDone')],
        ['cancelled', t('plan.closeCancelled')],
      ],
      () => this.status,
      (value) => (this.status = value as TaskStatus)
    );

    this.multiline(
      container,
      t('plan.closeComment'),
      t('plan.closeCommentHint'),
      () => this.comment,
      (value) => (this.comment = value)
    );
  }

  protected async submit(): Promise<void> {
    const changed = await closeTaskWithComment(
      this.deps.app,
      this.deps.getSettings(),
      this.task,
      this.comment,
      this.deps.today(),
      this.status
    );

    // False means the note moved on under the view that scanned it, which is
    // worth saying rather than closing on silence and leaving somebody to
    // wonder why nothing happened.
    if (!changed) new Notice(t('plan.closeTaskStale'));
    this.deps.onChanged();
  }
}
