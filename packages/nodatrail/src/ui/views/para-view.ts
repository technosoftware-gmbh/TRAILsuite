/**
 * The PARA view: areas, the goals under each, and the projects under those.
 *
 * One tree rather than four lists, because the question this answers is "what
 * am I responsible for and what is happening in it", and four lists make the
 * reader do the joining.
 *
 * The archive is behind a switch rather than a separate view. An archived note
 * is the same note in a different folder, and giving it its own screen would
 * suggest otherwise.
 */
import type { TFile } from 'obsidian';
import { byUrgency } from 'trail-core';
import { t } from '../../lang/I18nManager';
import {
  byPriority,
  goalsInArea,
  projectsForGoal,
  projectsInArea,
  resourcesInArea,
  type ParaBoard,
} from '../../para/board';
import { goalIsAchieved, projectIsCompleted } from '../../para/types';
import { groupByStatus, opensByDefault } from '../../para/status-groups';
import { liveOnly, readParaBoard } from '../../para/read-para';
import {
  checkbox,
  chip,
  emptyState,
  foldableGroup,
  row,
  rowIconAction,
  section,
  stat,
  statRow,
} from '../kit/elements';
import { openTaskCounts, tasksAbout } from '../../para/project-tasks';
import { readTasks, type VaultTask } from '../../tasks/read-tasks';
import { completeTask } from '../../tasks/write-tasks';
import { day } from '../kit/format';
import { NodaView } from './base-view';
import { PARA_VIEW_TYPE } from './view-types';

export class ParaView extends NodaView {
  private showArchived = false;
  /**
   * The projects whose task list is open, by title.
   *
   * Opened rather than closed, so the tree still reads as a tree and a project
   * with fourteen open tasks does not bury the one under it. Not persisted:
   * this is a reading posture, the same call the ledger's folded groups make.
   */
  private readonly expanded = new Set<string>();
  /**
   * The status groups somebody has folded open or shut, against their default.
   *
   * Held as the exceptions rather than as the state, so a group added later
   * arrives at its own default rather than shut because a set did not know
   * about it. Keyed by the goal or area the group sits under and the status,
   * because the same status appears once per goal and folding Laufend under one
   * goal must not fold it under the next. Not persisted, for the reason in
   * `status-groups.ts`.
   */
  private readonly toggled = new Set<string>();
  /** Every open task in the vault's plan folders, read once per render. */
  private tasks: VaultTask[] = [];
  private counts = new Map<string, number>();

  getViewType(): string {
    return PARA_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('para.title');
  }

  getIcon(): string {
    return 'layers';
  }

  protected toolbarActions() {
    return [
      { label: t('commands.newArea'), icon: 'plus', onClick: () => this.deps.openNewArea() },
      { label: t('commands.newGoal'), icon: 'target', onClick: () => this.deps.openNewGoal() },
      {
        label: t('commands.newProject'),
        icon: 'square-kanban',
        onClick: () => this.deps.openNewProject(),
      },
      {
        label: t('para.showArchived'),
        icon: this.showArchived ? 'archive-restore' : 'archive',
        onClick: () => {
          this.showArchived = !this.showArchived;
          void this.render();
        },
      },
    ];
  }

  protected async renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    // Read once per render and shared by every project row. Asking per project
    // would re-scan the plan folders once for each of them.
    this.tasks = await readTasks(this.deps.app, settings);
    this.counts = openTaskCounts(this.tasks);

    const all = readParaBoard(this.deps.app, settings);
    const board = this.showArchived ? all : liveOnly(all);

    const strip = statRow(this.body);
    stat(strip, t('para.areas'), String(board.areas.length));
    stat(strip, t('para.goals'), String(board.goals.length));
    stat(strip, t('para.projects'), String(board.projects.length));
    stat(strip, t('para.resources'), String(board.resources.length));

    if (board.areas.length === 0) {
      emptyState(this.body, t('para.noAreas'));
      return Promise.resolve();
    }

    for (const area of [...board.areas].sort(byPriority)) {
      this.renderArea(area, board);
    }

    // Goals and projects that reach no area at all would otherwise be
    // invisible, which is the failure mode this whole view exists to avoid.
    this.renderOrphans(board);
    return Promise.resolve();
  }

  private renderArea(area: ParaBoard<TFile>['areas'][number], board: ParaBoard<TFile>): void {
    const title = area.title;
    const goals = goalsInArea(title, board.goals).sort(byPriority);
    const projects = projectsInArea(title, board.projects, board.goals);
    const resources = resourcesInArea(title, board.resources);

    const body = section(this.body, title, {
      label: t('common.edit'),
      icon: 'pencil',
      // Icon alone: this header repeats once per area, so the word appeared
      // five or ten times down a screen whose rows say everything else in
      // icons. Reported as exactly that inconsistency.
      iconOnly: true,
      onClick: () => this.deps.openEditArea(area),
    });
    if (area.archived) chip(body, t('para.archived'), 'muted');

    if (goals.length === 0 && projects.length === 0) {
      emptyState(body, t('para.noGoals'));
    }

    for (const goal of goals) {
      const achieved = goalIsAchieved(goal.note);
      const goalRow = row(body, {
        title: goal.title,
        subtitle: t(`status.para.${goal.note.status}`),
        trailing: day(goal.note.achieved ?? goal.note.deadline),
        trailingTone: achieved ? 'good' : 'muted',
        icon: this.noteIcon(goal.file, 'target'),
        onClick: () => void this.deps.openNote(goal.file),
      });
      this.editAction(goalRow, () => this.deps.openEditGoal(goal));
      this.archiveAction(goalRow, goal.file, goal.archived);

      this.renderProjectGroups(
        body,
        `goal:${goal.title}`,
        projectsForGoal(goal.title, board.projects)
      );
    }

    // A project reaching this area through no goal of its own, which is what an
    // explicit `area:` on a project is for.
    const direct = projects.filter(
      (project) => !goals.some((goal) => project.note.goalTitles.includes(goal.title))
    );
    // Namespaced, because an area and a goal may carry the same title and
    // their two Laufend groups are not the same group.
    this.renderProjectGroups(body, `area:${title}`, direct);

    for (const resource of resources) {
      row(body, {
        title: resource.title,
        subtitle: resource.note.topic ?? '',
        icon: this.noteIcon(resource.file, 'book-open'),
        onClick: () => void this.deps.openNote(resource.file),
      });
    }
  }

  /**
   * A goal's projects, one foldable group per status they are in.
   *
   * **Empty statuses are not groups.** A goal with two projects shows two
   * headers rather than eight, and a header therefore always has something
   * behind it -- which is what makes a shut one worth reading: the count on it
   * is the answer.
   *
   * The count is drawn whether the group is open or shut. A folded group that
   * had stopped saying how many are in it would be a fold with no purpose, the
   * same rule the ledger's report groups keep.
   *
   * `owner` is the goal or the area the group hangs under, already namespaced
   * by the caller: the same status appears once per goal, and folding Laufend
   * under one goal must not fold it under the next.
   */
  private renderProjectGroups(
    parent: HTMLElement,
    owner: string,
    projects: readonly ParaBoard<TFile>['projects'][number][]
  ): void {
    for (const group of groupByStatus(projects, (project) => project.note.status)) {
      const key = `${owner}\u0000${group.status}`;
      // The set holds the exceptions, so a default-open group is folded when it
      // has been toggled and a default-shut one is open when it has.
      const folded = this.toggled.has(key) === opensByDefault(group.status);

      const wrapper = foldableGroup(parent, {
        name: t(`status.para.${group.status}`),
        trailing: String(group.items.length),
        folded,
        onToggle: () => {
          if (this.toggled.has(key)) this.toggled.delete(key);
          else this.toggled.add(key);
          void this.render();
        },
      });

      if (folded) continue;
      for (const project of [...group.items].sort(byPriority)) {
        this.renderProject(wrapper, project);
      }
    }
  }

  private renderProject(parent: HTMLElement, project: ParaBoard<TFile>['projects'][number]): void {
    const done = projectIsCompleted(project.note);
    const line = row(parent, {
      title: project.title,
      subtitle: t(`status.para.${project.note.status}`),
      trailing: day(project.note.completed ?? project.note.deadline),
      trailingTone: done ? 'good' : 'muted',
      icon: this.noteIcon(project.file, 'square-kanban'),
      onClick: () => void this.deps.openNote(project.file),
    });
    this.editAction(line, () => this.deps.openEditProject(project));
    this.archiveAction(line, project.file, project.archived);
    line.addClass('nod-row-nested');
    if (project.archived) chip(line, t('para.archived'), 'muted');

    // What is still open for this project, which for a job that collects tasks
    // from several meetings is the only way to see it: the tasks themselves are
    // scattered across as many day notes as there were meetings.
    const open = this.counts.get(project.title.trim().toLowerCase()) ?? 0;
    if (open === 0) return;

    const shown = this.expanded.has(project.title);
    const badge = chip(line, t('para.openTasks', { count: open }), shown ? undefined : 'muted');
    badge.addClass('nod-chip-button');
    badge.addEventListener('click', (event) => {
      // Stopped from reaching the row, which would open the note instead.
      event.stopPropagation();
      if (shown) this.expanded.delete(project.title);
      else this.expanded.add(project.title);
      void this.render();
    });

    if (shown) this.renderProjectTasks(parent, project.title);
  }

  /**
   * The pencil on a row, which opens the note's edit dialog.
   *
   * **The three dialogs existed and nothing called them.** They were built,
   * wired into the deps object and typed in `view-deps.ts`, and no view and no
   * command ever opened one -- so every property on an area, a goal or a
   * project could only be changed in Obsidian's own property editor. Correct
   * code standing where it could never run, which is the shape this repository
   * keeps meeting.
   *
   * The click is stopped from reaching the row, which would open the note
   * instead. The row keeps that as its own action, because reading the note is
   * the commoner thing to want.
   */
  private editAction(line: HTMLElement, open: () => void): void {
    rowIconAction(line, 'pencil', t('common.edit'), open);
  }

  /**
   * Filing a note away from the row it is on, or bringing it back.
   *
   * With around a hundred projects a year, archiving has to be a click where
   * somebody already is. It was only ever a command over the note in front of
   * you, which means opening each finished project to file it -- and a folder
   * that fills up instead.
   */
  private archiveAction(line: HTMLElement, file: TFile, archived: boolean): void {
    // Two icons rather than one that changes meaning: an archive box with an
    // arrow coming back out says "undo this" without the tooltip having to.
    rowIconAction(
      line,
      archived ? 'archive-restore' : 'archive',
      t(archived ? 'para.unarchiveNote' : 'para.archiveNote'),
      () => this.deps.archivePara(file, archived)
    );
  }

  /** One project's open tasks, tickable where they stand. */
  private renderProjectTasks(parent: HTMLElement, title: string): void {
    const settings = this.deps.getSettings();
    for (const task of tasksAbout(this.tasks, title).sort(byUrgency)) {
      const line = row(parent, {
        title: task.text,
        subtitle: task.file.basename,
        trailing: day(task.due ?? task.scheduled),
        trailingTone: 'muted',
        onClick: () => void this.deps.openNote(task.file),
      });
      line.addClass('nod-row-task');
      const box = checkbox(line.createDiv({ cls: 'nod-row-lead' }), false, () => {
        void completeTask(this.deps.app, settings, task, this.deps.today()).then(
          () => void this.render()
        );
      });
      box.addEventListener('click', (event) => event.stopPropagation());
      line.prepend(box.parentElement);
    }
  }

  /** Goals with no area, and projects that reach none. */
  private renderOrphans(board: ParaBoard<TFile>): void {
    const goals = board.goals.filter(
      (goal) =>
        goal.note.areaTitle === null ||
        !board.areas.some(
          (area) => area.title.toLowerCase() === goal.note.areaTitle?.trim().toLowerCase()
        )
    );
    if (goals.length === 0) return;

    const body = section(this.body, t('common.unknown'));
    for (const goal of goals) {
      row(body, {
        title: goal.title,
        subtitle: goal.note.areaTitle ?? t('common.none'),
        icon: this.noteIcon(goal.file, 'target'),
        trailingTone: 'warn',
        onClick: () => void this.deps.openNote(goal.file),
      });
    }
  }
}
