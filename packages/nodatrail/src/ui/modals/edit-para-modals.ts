/**
 * The three PARA creation forms, over notes that already exist.
 *
 * An area, a goal and a project all get corrected: a priority reconsidered, a
 * deadline moved, a goal reassigned to the area it turned out to belong to, and
 * above all a picture chosen after the note was written, because nobody has one
 * ready at the moment they decide to care about something.
 *
 * Each is the creation form with the title turned off and the submit rerouted,
 * exactly as `edit-money-modals.ts` does it, rather than a second copy of the
 * same six fields that drifts from the first one the day either is touched.
 *
 * **The title is not offered.** Renaming is Obsidian's operation and it has
 * links to update. It matters more here than for money: a goal names its area
 * by title and a project names its goals by title, so a dialog that renamed an
 * area would quietly orphan everything under it.
 *
 * **The resource has no edit form**, because it has no card on the dashboard to
 * reach one from. When it gets one, this is the file it belongs in.
 *
 * **The summary is read from the note's body**, which is why these three are
 * opened through `openLoaded()` rather than `open()`. It is also the one field
 * here whose save writes body text; `para/summary-file.ts` says what that write
 * is allowed to touch.
 */
import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import { formatDayTitle } from 'trail-core';
import { t } from '../../lang/I18nManager';
import { fileImageChoice } from '../../para/image-file';
import type { NODAtrailSettings } from '../../settings/types';
import type { AreaRecord, GoalRecord, ProjectRecord } from '../../para/board';
import { writeAreaEdits, writeGoalEdits, writeProjectEdits } from '../../para/edit-para';
import { loadSummary, writeSummary } from '../../para/summary-file';
import { createdAt } from '../../shared/note-stamps';
import { frontmatterOf } from '../../shared/vault-host';
import { NewAreaModal, NewGoalModal, NewProjectModal } from './new-para-modals';

export interface EditParaDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onSaved: () => void;
}

/** The shape the creation forms want, from the shape an edit has. */
function creationDeps(deps: EditParaDeps) {
  return {
    app: deps.app,
    getSettings: deps.getSettings,
    now: deps.now,
    onCreated: () => deps.onSaved(),
  };
}

/**
 * The day a note says it was created, for a form that shows it and will not
 * write it.
 *
 * Read from the note rather than from the record beside it: `created` is a
 * shared stamp on every note this plugin writes, not a PARA property, so it is
 * not on `ParsedGoal` or `ParsedProject`. Null for a note whose stamp is
 * missing or unreadable, which shows as an empty box -- honest, since that is
 * exactly what the note says.
 */
function createdOnOf(deps: EditParaDeps, file: TFile): string | null {
  const created = createdAt(frontmatterOf(deps.app, file), deps.getSettings());
  return created ? formatDayTitle(created) : null;
}

/** A blank box means no property, which is the same rule the creation forms keep. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export class EditAreaModal extends NewAreaModal {
  constructor(
    private readonly editDeps: EditParaDeps,
    private readonly area: AreaRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.title = area.title;
    this.priority = area.note.priority;
    this.image = { path: area.note.image ?? '', outside: null };
  }

  /** The note being edited, which is what decides where its image is filed. */
  private noteFile(): TFile {
    return this.area.file;
  }

  protected override heading(): string {
    return `${t('types.area')}: ${this.area.title}`;
  }

  /** Everything the creation form has, minus the title. */
  protected override fields(container: HTMLElement): void {
    this.paraFields(container);
  }

  /** The summary lives in the note's text, so it is read before the form is drawn. */
  protected override async load(): Promise<void> {
    this.summary = await loadSummary(this.editDeps.app, this.noteFile());
  }

  /** A note that exists is already named, so the creation form's blocker does not apply. */
  protected override blocker(): string | null {
    return null;
  }

  protected override async submit(): Promise<void> {
    // The note already exists, so an image picked from the machine can be
    // filed into its folder before the edit is written. On the creation forms
    // this has to happen after the note is made; here it happens before, and
    // either way the path recorded is the one the file ended up at.
    this.image = {
      path: await fileImageChoice(
        this.editDeps.app,
        this.editDeps.getSettings(),
        this.noteFile().path,
        this.image
      ),
      outside: null,
    };
    await writeAreaEdits(this.editDeps.app, this.editDeps.getSettings(), this.area.file, {
      priority: this.priority,
      image: orNull(this.image.path),
    });
    await writeSummary(this.editDeps.app, this.noteFile(), this.summary);
    new Notice(t('notices.noteUpdated', { title: this.area.title }));
    this.editDeps.onSaved();
  }
}

export class EditGoalModal extends NewGoalModal {
  constructor(
    private readonly editDeps: EditParaDeps,
    private readonly goal: GoalRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.title = goal.title;
    this.priority = goal.note.priority;
    this.image = { path: goal.note.image ?? '', outside: null };
    this.done = goal.note.achieved;
    this.closed = goal.note.closed;
    this.areaTitle = goal.note.areaTitle ?? '';
    this.status = goal.note.status;
    this.deadline = goal.note.deadline;
    this.createdOn = createdOnOf(editDeps, goal.file);
  }

  /**
   * The note exists, so its creation date is a fact rather than a field.
   *
   * Shown because a back-dated project is only recognisable as one from this
   * date, and not writable because nothing here writes `created`: it is
   * stamped once and never rewritten, and an editable box would promise a save
   * that does not happen.
   */
  protected override createdIsEditable(): boolean {
    return false;
  }

  /** The note being edited, which is what decides where its image is filed. */
  private noteFile(): TFile {
    return this.goal.file;
  }

  protected override heading(): string {
    return `${t('types.goal')}: ${this.goal.title}`;
  }

  protected override fields(container: HTMLElement): void {
    this.paraFields(container);
  }

  /** The summary lives in the note's text, so it is read before the form is drawn. */
  protected override async load(): Promise<void> {
    this.summary = await loadSummary(this.editDeps.app, this.noteFile());
  }

  protected override blocker(): string | null {
    return null;
  }

  protected override async submit(): Promise<void> {
    // The note already exists, so an image picked from the machine can be
    // filed into its folder before the edit is written. On the creation forms
    // this has to happen after the note is made; here it happens before, and
    // either way the path recorded is the one the file ended up at.
    this.image = {
      path: await fileImageChoice(
        this.editDeps.app,
        this.editDeps.getSettings(),
        this.noteFile().path,
        this.image
      ),
      outside: null,
    };
    await writeGoalEdits(this.editDeps.app, this.editDeps.getSettings(), this.goal.file, {
      priority: this.priority,
      image: orNull(this.image.path),
      done: this.done,
      closed: this.closed,
      areaTitle: orNull(this.areaTitle),
      status: this.status,
      deadline: this.deadline,
    });
    await writeSummary(this.editDeps.app, this.noteFile(), this.summary);
    new Notice(t('notices.noteUpdated', { title: this.goal.title }));
    this.editDeps.onSaved();
  }
}

export class EditProjectModal extends NewProjectModal {
  constructor(
    private readonly editDeps: EditParaDeps,
    private readonly project: ProjectRecord<TFile>
  ) {
    super(creationDeps(editDeps));
    this.title = project.title;
    this.priority = project.note.priority;
    this.image = { path: project.note.image ?? '', outside: null };
    this.done = project.note.completed;
    this.closed = project.note.closed;
    // The creation form offers one goal; a note may already name several. The
    // first is what the dropdown can show, and the rest are carried through
    // `submit()` untouched rather than dropped by a form that only had room
    // for one of them.
    this.goalTitle = project.note.goalTitles[0] ?? '';
    this.areaTitle = project.note.areaTitle ?? '';
    this.status = project.note.status;
    this.deadline = project.note.deadline;
    this.createdOn = createdOnOf(editDeps, project.file);
  }

  /**
   * The note exists, so its creation date is a fact rather than a field.
   *
   * Shown because a back-dated project is only recognisable as one from this
   * date, and not writable because nothing here writes `created`: it is
   * stamped once and never rewritten, and an editable box would promise a save
   * that does not happen.
   */
  protected override createdIsEditable(): boolean {
    return false;
  }

  /** The note being edited, which is what decides where its image is filed. */
  private noteFile(): TFile {
    return this.project.file;
  }

  protected override heading(): string {
    return `${t('types.project')}: ${this.project.title}`;
  }

  protected override fields(container: HTMLElement): void {
    this.paraFields(container);
  }

  /** The summary lives in the note's text, so it is read before the form is drawn. */
  protected override async load(): Promise<void> {
    this.summary = await loadSummary(this.editDeps.app, this.noteFile());
  }

  protected override blocker(): string | null {
    return null;
  }

  protected override async submit(): Promise<void> {
    // The note already exists, so an image picked from the machine can be
    // filed into its folder before the edit is written. On the creation forms
    // this has to happen after the note is made; here it happens before, and
    // either way the path recorded is the one the file ended up at.
    this.image = {
      path: await fileImageChoice(
        this.editDeps.app,
        this.editDeps.getSettings(),
        this.noteFile().path,
        this.image
      ),
      outside: null,
    };
    await writeProjectEdits(this.editDeps.app, this.editDeps.getSettings(), this.project.file, {
      priority: this.priority,
      image: orNull(this.image.path),
      done: this.done,
      closed: this.closed,
      areaTitle: orNull(this.areaTitle),
      goalTitles: this.goalTitles(),
      status: this.status,
      deadline: this.deadline,
    });
    await writeSummary(this.editDeps.app, this.noteFile(), this.summary);
    new Notice(t('notices.noteUpdated', { title: this.project.title }));
    this.editDeps.onSaved();
  }

  /**
   * The goals this project keeps.
   *
   * The dropdown holds one. A note naming three must not come back naming one,
   * so the choice replaces the first and the others are carried across as they
   * were. Clearing the dropdown clears the list, which is the only way this
   * form can say "no goals" at all.
   */
  private goalTitles(): string[] {
    const chosen = this.goalTitle.trim();
    if (!chosen) return [];
    const rest = this.project.note.goalTitles.slice(1).filter((title) => title !== chosen);
    return [chosen, ...rest];
  }
}
