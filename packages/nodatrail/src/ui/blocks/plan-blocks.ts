/**
 * The two blocks that go in a period note.
 *
 * `nod-tasks` lists open tasks matching a small query. `nod-period` is the
 * rollup of section 4.3 of the design: what falls in this period, from every
 * source.
 *
 * Both read the vault on every render and write nothing. A rollup written into
 * a period note is a rollup that is wrong the next morning.
 */
import { MarkdownPostProcessorContext } from 'obsidian';
import {
  byUrgency,
  detectPeriodLevel,
  isDueWithin,
  isOpen,
  isOverdue,
  parsePeriodTitle,
  periodRange,
  type PeriodLevel,
} from 'trail-core';
import { t } from '../../lang/I18nManager';
import { liveOnly, readParaBoard } from '../../para/read-para';
import { readFinanceBoard } from '../../finance/read-finance';
import { spendInPeriod } from '../../finance/spend';
import { goalsDueInPeriod, projectsDueInPeriod, tasksInPeriod } from '../../plan/rollup';
import { readTasks } from '../../tasks/read-tasks';
import { completeTask } from '../../tasks/write-tasks';
import { categoryLabel } from '../../shared/categories';
import { checkbox, emptyState, row } from '../kit/elements';
import { day, money } from '../kit/format';
import { blockArgs, hostNote, type BlockDeps } from './context';
import { noteIcon } from '../kit/note-icon';
import { spendIcon } from '../kit/type-icons';

/**
 * The period a block is for: the note it sits in, or what its `period:`
 * argument names.
 *
 * The note's own title first, because a period note is exactly the case this
 * exists for and reading it from the title means a template never has to fill a
 * date in.
 */
function periodOf(
  deps: BlockDeps,
  args: Map<string, string>,
  context: MarkdownPostProcessorContext
): { level: PeriodLevel; date: Date } | null {
  const stated = args.get('period') ?? hostNote(deps.app, context)?.basename ?? '';
  const level = detectPeriodLevel(stated);
  const date = level ? parsePeriodTitle(level, stated) : null;
  return level && date ? { level, date } : null;
}

export async function renderTasksBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): Promise<void> {
  const settings = deps.getSettings();
  const today = deps.today();
  const args = blockArgs(source);

  element.addClass('nod-block');

  const all = await readTasks(deps.app, settings);
  const period = periodOf(deps, args, context);
  const within = Number(args.get('within') ?? '');

  let tasks = all.filter(isOpen);
  if (args.get('overdue') === 'true') {
    tasks = tasks.filter((task) => isOverdue(task, today));
  } else if (Number.isFinite(within)) {
    tasks = tasks.filter((task) => isOverdue(task, today) || isDueWithin(task, today, within));
  } else if (period) {
    const range = periodRange(period.level, period.date);
    tasks = tasksInPeriod(tasks, range);
  }

  const tag = args.get('tag');
  if (tag) {
    const wanted = tag.replace(/^#/, '').toLowerCase();
    tasks = tasks.filter((task) => task.tags.some((entry) => entry.toLowerCase() === wanted));
  }

  const sorted = tasks.sort(byUrgency);
  if (sorted.length === 0) {
    emptyState(element, t('tasks.noTasks'));
    return;
  }

  for (const task of sorted) {
    const line = row(element, {
      title: task.text,
      subtitle: task.file.basename,
      trailing: day(task.due),
      trailingTone: isOverdue(task, today) ? 'warn' : 'muted',
      onClick: () => void deps.openNote(task.file),
    });

    const box = checkbox(line.createDiv({ cls: 'nod-row-lead' }), false, () => {
      void completeTask(deps.app, settings, task, today).then(() => {
        line.addClass('nod-row-done');
      });
    });
    box.addEventListener('click', (event) => event.stopPropagation());
    line.prepend(box.parentElement);
  }
}

export async function renderPeriodBlock(
  deps: BlockDeps,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext
): Promise<void> {
  const settings = deps.getSettings();
  const today = deps.today();

  element.addClass('nod-block');

  const period = periodOf(deps, blockArgs(source), context);
  if (!period) {
    emptyState(element, t('notices.notAPeriodNote'));
    return;
  }

  const range = periodRange(period.level, period.date);
  const para = liveOnly(readParaBoard(deps.app, settings));
  const finance = readFinanceBoard(deps.app, settings);
  const tasks = tasksInPeriod(await readTasks(deps.app, settings), range).sort(byUrgency);

  const goals = goalsDueInPeriod(para.goals, range);
  const projects = projectsDueInPeriod(para.projects, range);
  const spend = spendInPeriod({
    purchases: finance.purchases,
    bills: finance.bills,
    recurring: finance.recurring,
    from: range.from,
    to: range.to,
    today,
    dueSoonDays: settings.billDueSoonDays,
  });

  if (tasks.length === 0 && goals.length === 0 && projects.length === 0 && spend.length === 0) {
    emptyState(element, t('plan.nothingInPeriod'));
    return;
  }

  for (const task of tasks) {
    row(element, {
      title: task.text,
      subtitle: task.file.basename,
      trailing: day(task.due ?? task.scheduled),
      trailingTone: 'muted',
      icon: 'check-square',
      onClick: () => void deps.openNote(task.file),
    });
  }

  for (const goal of goals) {
    row(element, {
      title: goal.title,
      subtitle: t('types.goal'),
      trailing: day(goal.note.deadline),
      icon: noteIcon(deps.app, goal.file, settings.iconProperty, 'target'),
      onClick: () => void deps.openNote(goal.file),
    });
  }

  for (const project of projects) {
    row(element, {
      title: project.title,
      subtitle: t('types.project'),
      trailing: day(project.note.deadline),
      icon: noteIcon(deps.app, project.file, settings.iconProperty, 'square-kanban'),
      onClick: () => void deps.openNote(project.file),
    });
  }

  for (const item of spend) {
    row(element, {
      title: item.title,
      subtitle: [day(item.date), categoryLabel(item.category)].filter(Boolean).join(' - '),
      trailing: money(item.amount, item.currency),
      trailingTone: item.kind === 'recurring' ? 'muted' : undefined,
      icon: noteIcon(deps.app, item.file, settings.iconProperty, spendIcon(item.kind)),
      onClick: () => void deps.openNote(item.file),
    });
  }
}
