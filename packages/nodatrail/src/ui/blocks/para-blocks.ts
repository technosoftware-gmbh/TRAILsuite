/**
 * `nod-projects`: the projects beneath the note this block is in.
 *
 * Put in an area note it lists everything that lands in that area, however it
 * got there. Put in a goal note it lists what advances that goal. The note's own
 * title is what decides, so the block takes no arguments at all in the common
 * case and cannot be pointed at the wrong thing by a copy-paste.
 */
import { MarkdownPostProcessorContext } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { byPriority, projectsForGoal, projectsInArea } from '../../para/board';
import { liveOnly, readParaBoard } from '../../para/read-para';
import { projectIsCompleted } from '../../para/types';
import { emptyState, row } from '../kit/elements';
import { day } from '../kit/format';
import { blockArgs, hostNote, type BlockDeps } from './context';
import { noteIcon } from '../kit/note-icon';

export function renderProjectsBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): void {
  const args = blockArgs(source);
  const host = hostNote(deps.app, context);
  const title = args.get('area') ?? args.get('goal') ?? host?.basename ?? '';

  element.addClass('nod-block');
  if (!title) {
    emptyState(element, t('para.noProjects'));
    return;
  }

  const settings = deps.getSettings();
  const board = liveOnly(readParaBoard(deps.app, settings));
  // Both questions are asked, because the block does not know which kind of
  // note it is in and answering the wrong one silently would be worse than
  // answering both.
  const projects = [
    ...projectsForGoal(title, board.projects),
    ...projectsInArea(title, board.projects, board.goals),
  ]
    .filter(
      (project, index, all) => all.findIndex((other) => other.title === project.title) === index
    )
    .sort(byPriority);

  if (projects.length === 0) {
    emptyState(element, t('para.noProjects'));
    return;
  }

  for (const project of projects) {
    row(element, {
      title: project.title,
      subtitle: t(`status.para.${project.note.status}`),
      trailing: day(project.note.completed ?? project.note.deadline),
      trailingTone: projectIsCompleted(project.note) ? 'good' : 'muted',
      icon: noteIcon(deps.app, project.file, settings.iconProperty, 'square-kanban'),
      onClick: () => void deps.openNote(project.file),
    });
  }
}
