/**
 * The four PARA creation forms.
 *
 * One file rather than four, because they are the same form with different
 * middles: a title, the area or goal it belongs to, a status, a priority and a
 * deadline. Splitting them would be four files of imports around six fields.
 *
 * Each writes a note and never touches it again, exactly like the sibling
 * plugins' creators. The links are offered as dropdowns over what is actually
 * in the vault, so a form cannot produce a link that resolves to nothing.
 *
 * **Everything below the title is in `paraFields()`, separate from
 * `fields()`.** The edit forms in `edit-para-modals.ts` subclass these and show
 * everything except the title, because renaming is Obsidian's own operation and
 * a PARA note is joined to its neighbours by title. That split is what lets the
 * edit forms be a subclass rather than a second copy of the same six fields,
 * drifting from this one the day either is touched.
 *
 * **The image is a path typed or pasted rather than picked.** A file picker
 * would be better and is not what this is: the value goes straight into
 * `image:`, and Obsidian's own property editor is where somebody would
 * otherwise be typing the same string. A vault path and a wikilink both
 * resolve, because `resolveImageFile` accepts either, so pasting what Obsidian
 * puts on the clipboard for an attachment works without anybody being told that
 * it does. It is last on each of the three forms that has it, because it is the
 * field nobody fills in while creating a note and the one they come back for.
 * Resources have none: they have no card to appear on.
 */
import { App, Notice, TFile } from 'obsidian';

import {
  createArea,
  createGoal,
  createProject,
  createResource,
  EMPTY_COMMON,
} from '../../para/create';
import { readAreas, readGoals } from '../../para/read-para';
import { t } from '../../lang/I18nManager';
import type { NODAtrailSettings } from '../../settings/types';
import { formatDayTitle, summaryBody } from 'trail-core';
import { PARA_STATUSES, type ParaStatus } from '../../para/types';
import { datesAfterStatus } from '../../para/status-dates';
import { FormModal } from './form-modal';
import { numberPriorityField } from './priority-field';
import { summaryField } from './summary-field';
import { imageField } from './image-field';
import { attachPendingImage, emptyImage, type ImageChoice } from '../../para/image-file';

export interface CreateDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  onCreated: (file: TFile) => void;
}

/** A blank box means no property at all, not a property holding nothing. */
function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** `[value, label]` pairs, with an explicit "none" first where the field is optional. */
function optional(titles: readonly string[]): [string, string][] {
  return [['', t('common.none')], ...titles.map((title): [string, string] => [title, title])];
}

export class NewAreaModal extends FormModal {
  protected title = '';
  protected priority: number | null = null;
  protected summary = '';
  protected image: ImageChoice = emptyImage();

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
  }

  protected heading(): string {
    return t('commands.newArea');
  }

  protected override blocker(): string | null {
    return this.title.trim() === '' ? t('common.needsTitle') : null;
  }

  protected fields(container: HTMLElement): void {
    this.text(
      container,
      t('types.area'),
      () => this.title,
      (value) => (this.title = value)
    );
    this.paraFields(container);
  }

  protected paraFields(container: HTMLElement): void {
    numberPriorityField(
      container,
      () => this.priority,
      (value) => (this.priority = value)
    );
    summaryField(
      container,
      () => this.summary,
      (value) => (this.summary = value)
    );
    imageField(container, {
      app: this.deps.app,
      get: () => this.image,
      set: (choice) => (this.image = choice),
      refresh: () => this.rerender(),
    });
  }

  protected async submit(): Promise<void> {
    const file = await createArea(
      this.deps.app,
      this.deps.getSettings(),
      this.title.trim(),
      { ...EMPTY_COMMON, priority: this.priority, image: trimmedOrNull(this.image.path) },
      this.deps.now(),
      summaryBody(this.summary)
    );
    new Notice(t('notices.noteCreated', { title: file.basename }));
    // The note exists now, so its folder does: an image picked from the
    // machine goes beside it and the path is written back. Nothing happens
    // for an image referenced from the vault, which was already recorded.
    await attachPendingImage(this.deps.app, this.deps.getSettings(), file, this.image);
    this.deps.onCreated(file);
  }
}

/**
 * What a goal form and a project form have in common.
 *
 * They had all of it twice: the same six fields declared in each class and the
 * same status dropdown built in each. One is not a base class for its own sake
 * -- it is here because the status now *fills a date*, and that rule had to be
 * written twice or written once.
 */
abstract class ParaStatusModal extends FormModal {
  /**
   * The moment the note records as its creation.
   *
   * A chosen day rather than this one when the form named it, because a note is
   * routinely made after the thing it records began -- the fifteen projects
   * already running when this vault started tracking them all began before it.
   * Written at midnight, which is the shape the rest of this vault's `created`
   * stamps already have.
   */
  protected creationMoment(fallback: Date): Date {
    if (!this.createdOn) return fallback;
    const chosen = new Date(`${this.createdOn}T00:00:00`);
    return Number.isNaN(chosen.getTime()) ? fallback : chosen;
  }

  protected title = '';
  protected areaTitle = '';
  /** Everything new starts in the backlog: written down, not yet decided on. */
  protected status: ParaStatus = 'backlog';
  protected priority: number | null = null;
  protected deadline: string | null = null;
  /** The day the work finished, and the day it was accepted. Filled by the status, editable here. */
  protected done: string | null = null;
  protected closed: string | null = null;
  /** Correctable, because a note is routinely made after the thing it records began. */
  protected createdOn: string | null = null;
  /** The note's own opening text, which lives in the body rather than in a property. */
  protected summary = '';
  protected image: ImageChoice = emptyImage();

  protected abstract today(): Date;

  /**
   * The status dropdown, which fills the date its new value is the record of.
   *
   * Filled and shown rather than written silently: the field is on this same
   * form, pre-filled with today, and saving is what commits it. The day of the
   * action and the day of the record routinely differ -- a project finished on
   * Friday has its status moved on Monday.
   */
  protected statusField(container: HTMLElement): void {
    this.select(
      container,
      t('common.status'),
      PARA_STATUSES.map((status): [string, string] => [status, t(`status.para.${status}`)]),
      () => this.status,
      (value) => {
        const next = PARA_STATUSES.find((candidate) => candidate === value) ?? this.status;
        const dates = datesAfterStatus(
          { done: this.done, closed: this.closed },
          this.status,
          next,
          formatDayTitle(this.today())
        );
        this.status = next;
        this.done = dates.done;
        this.closed = dates.closed;
        // Redrawn so the date the move just filled is on screen to be
        // corrected, which is the whole point of filling it rather than
        // writing it.
        this.rerender();
      }
    );
  }

  /**
   * Whether the creation date can still be typed.
   *
   * True while the note is being made, because a note is routinely written
   * after the thing it records began. False once it exists: see `shownDate`.
   */
  protected createdIsEditable(): boolean {
    return true;
  }

  /** The four dates a form shows, in the order work reaches them. */
  protected dateFields(container: HTMLElement): void {
    if (this.createdIsEditable()) {
      this.date(
        container,
        t('para.created'),
        () => this.createdOn,
        (value) => (this.createdOn = value)
      );
    } else {
      this.shownDate(container, t('para.created'), () => this.createdOn);
    }
    this.date(
      container,
      t('para.deadline'),
      () => this.deadline,
      (value) => (this.deadline = value)
    );
    this.date(
      container,
      t('para.done'),
      () => this.done,
      (value) => (this.done = value)
    );
    this.date(
      container,
      t('para.closed'),
      () => this.closed,
      (value) => (this.closed = value)
    );
  }
}

export class NewGoalModal extends ParaStatusModal {
  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
  }

  protected today(): Date {
    return this.deps.now();
  }

  protected heading(): string {
    return t('commands.newGoal');
  }

  protected override blocker(): string | null {
    return this.title.trim() === '' ? t('common.needsTitle') : null;
  }

  protected fields(container: HTMLElement): void {
    this.text(
      container,
      t('types.goal'),
      () => this.title,
      (value) => (this.title = value)
    );
    this.paraFields(container);
  }

  protected paraFields(container: HTMLElement): void {
    const areas = readAreas(this.deps.app, this.deps.getSettings())
      .filter((area) => !area.archived)
      .map((area) => area.title);

    this.select(
      container,
      t('finance.area'),
      optional(areas),
      () => this.areaTitle,
      (value) => (this.areaTitle = value)
    );
    this.statusField(container);
    numberPriorityField(
      container,
      () => this.priority,
      (value) => (this.priority = value)
    );
    this.dateFields(container);
    summaryField(
      container,
      () => this.summary,
      (value) => (this.summary = value)
    );
    imageField(container, {
      app: this.deps.app,
      get: () => this.image,
      set: (choice) => (this.image = choice),
      refresh: () => this.rerender(),
    });
  }

  protected async submit(): Promise<void> {
    const file = await createGoal(
      this.deps.app,
      this.deps.getSettings(),
      this.title.trim(),
      {
        ...EMPTY_COMMON,
        priority: this.priority,
        image: trimmedOrNull(this.image.path),
        areaTitle: this.areaTitle || null,
        status: this.status,
        deadline: this.deadline,
        achieved: this.done,
        closed: this.closed,
      },
      this.creationMoment(this.deps.now()),
      summaryBody(this.summary)
    );
    new Notice(t('notices.noteCreated', { title: file.basename }));
    // The note exists now, so its folder does: an image picked from the
    // machine goes beside it and the path is written back. Nothing happens
    // for an image referenced from the vault, which was already recorded.
    await attachPendingImage(this.deps.app, this.deps.getSettings(), file, this.image);
    this.deps.onCreated(file);
  }
}

export class NewProjectModal extends ParaStatusModal {
  protected goalTitle = '';

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
  }

  protected today(): Date {
    return this.deps.now();
  }

  protected heading(): string {
    return t('commands.newProject');
  }

  protected override blocker(): string | null {
    return this.title.trim() === '' ? t('common.needsTitle') : null;
  }

  protected fields(container: HTMLElement): void {
    this.text(
      container,
      t('types.project'),
      () => this.title,
      (value) => (this.title = value)
    );
    this.paraFields(container);
  }

  protected paraFields(container: HTMLElement): void {
    const settings = this.deps.getSettings();
    const goals = readGoals(this.deps.app, settings)
      .filter((goal) => !goal.archived)
      .map((goal) => goal.title);
    const areas = readAreas(this.deps.app, settings)
      .filter((area) => !area.archived)
      .map((area) => area.title);

    this.select(
      container,
      t('para.goals'),
      optional(goals),
      () => this.goalTitle,
      (value) => (this.goalTitle = value)
    );
    // The area is offered as well as the goal, for a project that serves none.
    // Left empty it stays empty, and the area is derived through the goal.
    this.select(
      container,
      t('finance.area'),
      optional(areas),
      () => this.areaTitle,
      (value) => (this.areaTitle = value)
    );
    this.statusField(container);
    numberPriorityField(
      container,
      () => this.priority,
      (value) => (this.priority = value)
    );
    this.dateFields(container);
    summaryField(
      container,
      () => this.summary,
      (value) => (this.summary = value)
    );
    imageField(container, {
      app: this.deps.app,
      get: () => this.image,
      set: (choice) => (this.image = choice),
      refresh: () => this.rerender(),
    });
  }

  protected async submit(): Promise<void> {
    const file = await createProject(
      this.deps.app,
      this.deps.getSettings(),
      this.title.trim(),
      {
        ...EMPTY_COMMON,
        priority: this.priority,
        image: trimmedOrNull(this.image.path),
        goalTitles: this.goalTitle ? [this.goalTitle] : [],
        areaTitle: this.areaTitle || null,
        status: this.status,
        deadline: this.deadline,
        completed: this.done,
        closed: this.closed,
      },
      this.creationMoment(this.deps.now()),
      summaryBody(this.summary)
    );
    new Notice(t('notices.noteCreated', { title: file.basename }));
    // The note exists now, so its folder does: an image picked from the
    // machine goes beside it and the path is written back. Nothing happens
    // for an image referenced from the vault, which was already recorded.
    await attachPendingImage(this.deps.app, this.deps.getSettings(), file, this.image);
    this.deps.onCreated(file);
  }
}

export class NewResourceModal extends FormModal {
  private title = '';
  private summary = '';
  private areaTitle = '';
  private topic = '';
  private source = '';

  constructor(private readonly deps: CreateDeps) {
    super(deps.app);
  }

  protected heading(): string {
    return t('commands.newResource');
  }

  protected override blocker(): string | null {
    return this.title.trim() === '' ? t('common.needsTitle') : null;
  }

  protected fields(container: HTMLElement): void {
    const areas = readAreas(this.deps.app, this.deps.getSettings())
      .filter((area) => !area.archived)
      .map((area) => area.title);

    this.text(
      container,
      t('types.resource'),
      () => this.title,
      (value) => (this.title = value)
    );
    this.select(
      container,
      t('finance.area'),
      optional(areas),
      () => this.areaTitle,
      (value) => (this.areaTitle = value)
    );
    this.text(
      container,
      t('finance.category'),
      () => this.topic,
      (value) => (this.topic = value)
    );
    this.text(
      container,
      t('finance.document'),
      () => this.source,
      (value) => (this.source = value)
    );
    summaryField(
      container,
      () => this.summary,
      (value) => (this.summary = value)
    );
  }

  protected async submit(): Promise<void> {
    const file = await createResource(
      this.deps.app,
      this.deps.getSettings(),
      this.title.trim(),
      {
        ...EMPTY_COMMON,
        areaTitle: this.areaTitle || null,
        topic: this.topic.trim() || null,
        source: this.source.trim() || null,
        tags: [],
      },
      this.deps.now(),
      summaryBody(this.summary)
    );
    new Notice(t('notices.noteCreated', { title: file.basename }));
    this.deps.onCreated(file);
  }
}
