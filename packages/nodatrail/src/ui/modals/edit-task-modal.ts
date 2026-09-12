/**
 * Editing a task line: what it says, what it is about, when it is due, and how
 * urgent it is.
 *
 * **The four fields and no more.** A task line can carry a recurrence rule, a
 * start date, a scheduled date and markers this suite does not write, and a
 * form offering four boxes cannot hold any of them. So the action is offered
 * only for a line `taskFieldsOf()` can put back exactly, and the caller hides
 * the button for the rest -- see `task-fields.ts` for why refusing is done by
 * composing rather than by inspecting.
 *
 * **A line anywhere in the vault, not an entry in a day note.** The row this
 * opens from is a checkbox line under the configured task folders, which is why
 * it is not the day-entry dialog: that one edits a record read out of one day's
 * own sections and writes by line span. This writes one line, guarded by the
 * text it was scanned as, and leaves the note around it alone.
 */
import { App, Notice } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { readParaBoard, liveOnly } from '../../para/read-para';
import type { VaultTask } from '../../tasks/read-tasks';
import { editTaskLine } from '../../tasks/write-tasks';
import { taskFieldsOf, type EditableTaskFields } from '@technosoftware/trail-core';
import { FormModal } from './form-modal';
import { taskPriorityField } from './priority-field';

export interface EditTaskDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  onChanged: () => void;
}

export class EditTaskModal extends FormModal {
  private readonly fieldsOf: EditableTaskFields;

  constructor(
    private readonly deps: EditTaskDeps,
    private readonly task: VaultTask,
    fields: EditableTaskFields
  ) {
    super(deps.app);
    // A copy, because the caller holds the one it tested and this form is about
    // to edit every field on it. See `copyDraft()` in add-to-day.ts for what
    // sharing one of these costs.
    this.fieldsOf = { ...fields };
  }

  protected heading(): string {
    return t('plan.editTask');
  }

  protected override blocker(): string | null {
    return this.fieldsOf.text.trim() === '' ? t('common.incomplete') : null;
  }

  protected fields(container: HTMLElement): void {
    this.hint(container, this.task.file.basename);

    this.text(
      container,
      t('day.text'),
      () => this.fieldsOf.text,
      (value) => (this.fieldsOf.text = value)
    );

    this.select(
      container,
      t('day.context'),
      this.contextChoices(),
      () => this.fieldsOf.context,
      (value) => (this.fieldsOf.context = value)
    );

    this.date(
      container,
      t('finance.dueDate'),
      () => this.fieldsOf.due || null,
      (value) => (this.fieldsOf.due = value ?? '')
    );

    taskPriorityField(
      container,
      () => this.fieldsOf.priority,
      (value) => (this.fieldsOf.priority = value)
    );
  }

  protected async submit(): Promise<void> {
    const changed = await editTaskLine(
      this.deps.app,
      this.deps.getSettings(),
      this.task,
      this.fieldsOf
    );

    // False is either "nothing to do" or "the note moved on under the view",
    // and the second is worth saying rather than closing on silence and leaving
    // somebody to wonder why their edit is not there. Same message as closing a
    // task, because it is the same situation.
    if (!changed) new Notice(t('plan.closeTaskStale'));
    this.deps.onChanged();
  }

  /**
   * The projects and areas a task may be about.
   *
   * The task's own link is added when the board does not offer it, so a task
   * pointing at a note that is archived, or at one this list does not cover,
   * keeps its link instead of being silently re-filed by a dropdown that could
   * not show it.
   */
  private contextChoices(): [string, string][] {
    const board = liveOnly(readParaBoard(this.deps.app, this.deps.getSettings()));
    const titles = new Set([...board.projects, ...board.areas].map((record) => record.title));
    const own = this.fieldsOf.context.trim();
    if (own) titles.add(own);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    return [['', t('common.none')], ...sorted.map((title): [string, string] => [title, title])];
  }
}

/** The fields, or null when this line is not one a form may edit. */
export function editableTaskFields(task: VaultTask): EditableTaskFields | null {
  return taskFieldsOf(task);
}
