/**
 * The three picture strips at the top of the life dashboard: areas, then the
 * goals under them, then the projects under those.
 *
 * The order is PARA's own and is the point. An area is a standing
 * responsibility, a goal is a thing you would like to become true, a project is
 * work with an end. Reading down the dashboard is reading from what is
 * permanent to what is finishable.
 *
 * **Clicking an area narrows the two strips below it**, rather than opening the
 * note. That is the one piece of state this view holds, and it is held by the
 * view rather than persisted: a filter that survived a restart would be a
 * dashboard that silently shows a third of the vault, and the first symptom
 * would be a goal somebody was sure they had written.
 *
 * Nothing here is cached. Every render re-reads the board, which is why a note
 * edited in another tab is right the moment this one is refreshed.
 */
import type { App, TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import {
  byPriority,
  byPriorityThenDeadline,
  goalsInArea,
  projectsInArea,
  type AreaRecord,
  type GoalRecord,
  type ParaBoard,
  type ProjectRecord,
} from '../../para/board';
import { goalIsActive, projectIsActive } from '../../para/types';
import { resolveImagePath } from '../kit/images';
import type { DefaultImages } from '../../para/default-image-file';
import { day } from '../kit/format';
import { priorityLevelOf } from 'trail-core';
import { cardHeader, cardStrip, dashboardCard, headerButton, heroCard } from './cards';
import { emptyState } from '../kit/elements';

/**
 * The glyph a note with no picture gets.
 *
 * One per kind rather than one for all three, because the strips are the thing
 * being told apart and a row of identical grey squares tells you nothing about
 * which row you are looking at.
 */
const ICON = { area: 'layers', goal: 'target', project: 'square-kanban' } as const;

export interface StripDeps {
  app: App;
  imageOf: (image: string | null) => string | null;
  /** The family fallback for a project that names no picture. See `para/default-image.ts`. */
  defaultProjectImage: DefaultImages;
  openNote: (file: TFile) => void;
  onSelectArea: (title: string | null) => void;
  editArea: (record: AreaRecord<TFile>) => void;
  editGoal: (record: GoalRecord<TFile>) => void;
  editProject: (record: ProjectRecord<TFile>) => void;
  newArea: () => void;
  newGoal: () => void;
  newProject: () => void;
}

/** The image resolver, bound to an app. Kept as a function so the strips take no `App` of their own. */
export function imageResolver(app: App): (image: string | null) => string | null {
  return (image) => resolveImagePath(app, image);
}

export function renderAreaStrip(
  grid: HTMLElement,
  areas: AreaRecord<TFile>[],
  selected: string | null,
  deps: StripDeps
): void {
  const card = dashboardCard(grid, 12);
  const header = cardHeader(card, t('para.areas'));
  if (selected) {
    headerButton(header, t('dashboard.showAll'), 'list-restart', () => deps.onSelectArea(null));
  }
  headerButton(header, t('commands.newArea'), 'plus', () => deps.newArea());

  if (areas.length === 0) {
    emptyState(card, t('para.noAreas'));
    return;
  }

  const strip = cardStrip(card);
  for (const area of [...areas].sort(byPriority)) {
    heroCard(strip, {
      title: area.title,
      image: deps.imageOf(area.note.image),
      fallbackIcon: ICON.area,
      // The same line goals and projects show. An area has no deadline, so it
      // is the level alone. It printed the raw number until 30 August 2026,
      // which was left over from before priority had names rather than a reason
      // for areas to read differently from everything beside them.
      meta: paraMeta(area.note.priority, null),
      selected: selected === area.title,
      // Selecting rather than opening: the note is one click further on, from
      // the pencil or from the goal it holds. This click is the one that gets
      // used a hundred times a week.
      onClick: () => deps.onSelectArea(selected === area.title ? null : area.title),
      onEdit: { label: t('common.edit'), run: () => deps.editArea(area) },
    });
  }
}

export function renderGoalStrip(
  grid: HTMLElement,
  board: ParaBoard<TFile>,
  selected: string | null,
  deps: StripDeps
): void {
  const all = board.goals.filter((goal) => goalIsActive(goal.note));
  const goals = selected ? goalsInArea(selected, all) : all;

  const card = dashboardCard(grid, 12);
  const header = cardHeader(card, selected ? `${t('para.goals')} -- ${selected}` : t('para.goals'));
  headerButton(header, t('commands.newGoal'), 'plus', () => deps.newGoal());

  if (goals.length === 0) {
    // Two literal calls rather than a ternary inside `t()`: the
    // translation-keys test reads quoted keys out of the source, and a key
    // assembled at a call site is one it cannot check.
    emptyState(card, selected ? t('dashboard.noGoalsInArea') : t('dashboard.noGoals'));
    return;
  }

  const strip = cardStrip(card);
  for (const goal of [...goals].sort(byPriorityThenDeadline)) {
    heroCard(strip, {
      title: goal.title,
      image: deps.imageOf(goal.note.image),
      fallbackIcon: ICON.goal,
      meta: paraMeta(goal.note.priority, goal.note.deadline),
      onClick: () => deps.openNote(goal.file),
      onEdit: { label: t('common.edit'), run: () => deps.editGoal(goal) },
    });
  }
}

export function renderProjectStrip(
  grid: HTMLElement,
  board: ParaBoard<TFile>,
  selected: string | null,
  deps: StripDeps
): void {
  const all = board.projects.filter((project) => projectIsActive(project.note));
  // `projectsInArea` resolves a project that names only its goals: a stated
  // area wins, and a derived one carries where none was stated. A project
  // whose area cannot be worked out at all is left out of a filtered strip
  // rather than shown under every area.
  const projects = selected ? projectsInArea(selected, all, board.goals) : all;

  const card = dashboardCard(grid, 12);
  const header = cardHeader(
    card,
    selected ? `${t('para.projects')} -- ${selected}` : t('para.projects')
  );
  headerButton(header, t('commands.newProject'), 'plus', () => deps.newProject());

  if (projects.length === 0) {
    emptyState(card, selected ? t('dashboard.noProjectsInArea') : t('dashboard.noProjects'));
    return;
  }

  const strip = cardStrip(card);
  for (const project of [...projects].sort(byPriorityThenDeadline)) {
    heroCard(strip, {
      title: project.title,
      ...projectPicture(project, deps),
      fallbackIcon: ICON.project,
      meta: paraMeta(project.note.priority, project.note.deadline),
      onClick: () => deps.openNote(project.file),
      onEdit: { label: t('common.edit'), run: () => deps.editProject(project) },
    });
  }
}

/**
 * What a project card should show where the picture goes.
 *
 * Three answers, and keeping them apart is the point. A note with a picture that
 * resolves shows it. A note with **no** picture takes its family's fallback,
 * which is a convention over the projects folder rather than anything written
 * into the note. A note that names a picture the vault cannot find shows the
 * missing panel with what it named.
 *
 * **A broken value does not fall back**, deliberately. Showing the family
 * default for a project whose own `image:` is wrong would hide the fault behind
 * a picture that looks deliberate, and it is a fault worth seeing: a path that
 * resolves to nothing is usually an attachment that moved.
 */
export function projectPicture(
  project: ProjectRecord<TFile>,
  deps: Pick<StripDeps, 'imageOf' | 'defaultProjectImage'>
): { image: string | null; missingImage?: string } {
  const own = project.note.image?.trim() ?? '';
  if (own) {
    const resolved = deps.imageOf(own);
    return resolved ? { image: resolved } : { image: null, missingImage: own };
  }

  return { image: deps.imageOf(deps.defaultProjectImage(project.title)) };
}

/**
 * The one line under a goal's or a project's title: what it is worth, and when
 * it is due.
 *
 * The same two facts the strip is now sorted by, so the order the cards are in
 * is legible from the cards themselves. A card sorted by something it does not
 * show is a card that looks shuffled.
 *
 * **A priority outside the four levels is shown as its number**, not as a level
 * it is not. A vault may rank a handful of notes by hand rather than grade them,
 * and a note that says 6 should read as 6 rather than be rounded into a word it
 * does not carry. The same rule the priority dropdown keeps.
 *
 * A project used to fall back to naming its goals here. That is gone: the goal
 * is one card to the left in the strip above, and the deadline is the thing a
 * project card is asked about.
 */
export function paraMeta(priority: number | null, deadline: string | null): string {
  const parts: string[] = [];

  if (priority !== null) {
    const level = priorityLevelOf(priority);
    parts.push(level ? t(`priority.${level}`) : String(priority));
  }
  if (deadline) parts.push(`${t('para.deadline')} ${day(deadline)}`);

  return parts.join(' \u00b7 ');
}
