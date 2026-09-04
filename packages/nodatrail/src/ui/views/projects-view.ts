/**
 * The project dashboard: every project as a card, narrowed and grouped.
 *
 * The Life dashboard's project strip answers "what am I working on" and holds
 * the ongoing and planned ones only. The PARA view answers "what is under this
 * goal" and puts a project where its goal is. Neither answers **"where is that
 * project"** at a hundred a year, which is what this view is for: four filters,
 * a search over the title, and the same status groups the PARA view folds.
 *
 * **The same cards as the Life dashboard**, through the same `heroCard` and the
 * same `projectPicture`. A second card that looked nearly like the first would
 * be a second place to fix a picture bug, and this repository has met that
 * shape often enough.
 *
 * **Nothing here is remembered.** The filters, the search and the fold state
 * all reset when the view is closed, which is the call the Life dashboard's area
 * filter already makes and for the reason written there: a filter that survived
 * a restart is a view that silently shows a third of the vault, and the first
 * symptom is a project somebody is certain they created.
 */
import type { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import {
  byPriority,
  byPriorityThenDeadline,
  type ParaBoard,
  type ProjectRecord,
} from '../../para/board';
import { liveOnly, readParaBoard } from '../../para/read-para';
import { emptyProjectFilter, filterProjects, isFiltering } from '../../para/project-filter';
import { groupByStatus, opensByDefault } from '../../para/status-groups';
import { PARA_STATUSES } from '../../para/types';
import { projectDefaultImages } from '../../para/default-image-file';
import { cardStrip, dashboardCard, dashboardGrid, heroCard } from '../dashboard/cards';
import { imageResolver, paraMeta, projectPicture } from '../dashboard/para-strips';
import { emptyState, filterBar, filterSearch, filterSelect, foldableGroup } from '../kit/elements';
import { NodaView } from './base-view';
import { PROJECTS_VIEW_TYPE } from './view-types';

export class ProjectsView extends NodaView {
  private filter = emptyProjectFilter();
  private showArchived = false;
  /** The status groups toggled against their default. See `status-groups.ts`. */
  private readonly toggled = new Set<string>();
  /** True while a keystroke is redrawing, so the box can take the cursor back. */
  private searching = false;

  getViewType(): string {
    return PROJECTS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('projects.title');
  }

  getIcon(): string {
    return 'square-kanban';
  }

  protected toolbarActions() {
    return [
      {
        label: t('commands.newProject'),
        icon: 'plus',
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
      // Only while something is narrowed. A permanent Clear button on an
      // unfiltered view is a button that does nothing, which is the shape this
      // repository keeps having to delete.
      ...(isFiltering(this.filter)
        ? [
            {
              label: t('projects.clearFilters'),
              icon: 'list-restart',
              onClick: () => {
                this.filter = emptyProjectFilter();
                void this.render();
              },
            },
          ]
        : []),
    ];
  }

  protected renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    const all = readParaBoard(this.deps.app, settings);
    const board = this.showArchived ? all : liveOnly(all);

    this.renderFilters(board);

    const matching = filterProjects(board.projects, board.goals, this.filter);

    if (board.projects.length === 0) {
      emptyState(this.body, t('para.noProjects'));
      return Promise.resolve();
    }
    if (matching.length === 0) {
      emptyState(this.body, t('projects.noneMatch'));
      return Promise.resolve();
    }

    this.renderGroups(matching);
    return Promise.resolve();
  }

  /**
   * The four questions, in the order a project is found by.
   *
   * Area then goal then status then name, which is broad to narrow. The goal
   * list is every goal rather than the goals in the chosen area: narrowing it
   * would mean a goal disappearing from under the cursor when the area above it
   * changed, and the pairing that matches nothing is a legible answer rather
   * than a broken one.
   */
  private renderFilters(board: ParaBoard<TFile>): void {
    const bar = filterBar(this.body);
    const areas = [...board.areas].sort(byPriority).map((area) => area.title);
    const goals = [...board.goals].sort(byPriorityThenDeadline).map((goal) => goal.title);

    filterSelect(
      bar,
      t('finance.area'),
      [['', t('common.all')], ...areas.map((title): [string, string] => [title, title])],
      this.filter.areaTitle,
      (value) => {
        this.filter = { ...this.filter, areaTitle: value };
        void this.render();
      }
    );

    filterSelect(
      bar,
      t('para.goals'),
      [['', t('common.all')], ...goals.map((title): [string, string] => [title, title])],
      this.filter.goalTitle,
      (value) => {
        this.filter = { ...this.filter, goalTitle: value };
        void this.render();
      }
    );

    filterSelect(
      bar,
      t('common.status'),
      [
        ['', t('common.all')],
        ...PARA_STATUSES.map((status): [string, string] => [status, t(`status.para.${status}`)]),
      ],
      this.filter.status ?? '',
      (value) => {
        const status = PARA_STATUSES.find((candidate) => candidate === value) ?? null;
        this.filter = { ...this.filter, status };
        void this.render();
      }
    );

    const search = filterSearch(
      bar,
      t('projects.search'),
      t('projects.searchHint'),
      this.filter.search,
      (value) => {
        this.filter = { ...this.filter, search: value };
        this.searching = true;
        void this.render();
      }
    );

    // The redraw that a keystroke caused rebuilt this box, so the cursor is
    // put back where it was. Only after a keystroke: focusing on every render
    // would steal the cursor from whatever somebody was actually doing.
    if (this.searching) {
      this.searching = false;
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  /** One foldable group per status, in attention order, empty statuses left out. */
  private renderGroups(projects: readonly ProjectRecord<TFile>[]): void {
    const settings = this.deps.getSettings();
    const strips = {
      imageOf: imageResolver(this.deps.app),
      defaultProjectImage: projectDefaultImages(this.deps.app, settings),
    };

    for (const group of groupByStatus(projects, (project) => project.note.status)) {
      const folded = this.toggled.has(group.status) === opensByDefault(group.status);

      const wrapper = foldableGroup(this.body, {
        name: t(`status.para.${group.status}`),
        trailing: String(group.items.length),
        folded,
        onToggle: () => {
          if (this.toggled.has(group.status)) this.toggled.delete(group.status);
          else this.toggled.add(group.status);
          void this.render();
        },
      });

      if (folded) continue;

      const grid = dashboardGrid(wrapper);
      const card = dashboardCard(grid, 12);
      const strip = cardStrip(card);

      for (const project of [...group.items].sort(byPriorityThenDeadline)) {
        heroCard(strip, {
          title: project.title,
          ...projectPicture(project, strips),
          fallbackIcon: 'square-kanban',
          meta: paraMeta(project.note.priority, project.note.deadline),
          onClick: () => void this.deps.openNote(project.file),
          onEdit: { label: t('common.edit'), run: () => this.deps.openEditProject(project) },
        });
      }
    }
  }
}
