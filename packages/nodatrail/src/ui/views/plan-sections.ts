/**
 * The three things a period contains, as sections any view can draw.
 *
 * They were private methods of the plan view until the life dashboard wanted
 * the same three at its foot. The dashboard then gave them up -- on screen they
 * repeated its own "due soon" and "bills" sections -- so this has one consumer
 * again and is kept anyway, which is worth saying rather than leaving the file
 * looking like an abstraction nobody asked for.
 *
 * Extracting them cost nothing and undoing it would cost a diff: the plan view
 * reads better for having its render loop separate from its three lists, and
 * the next view that wants "what falls inside this period" finds it written
 * down rather than inlined in a view it cannot import from.
 *
 * They stay in this package rather than moving to `trail-core`, and it is worth
 * being clear why: the core holds no view, no DOM and no user-facing string,
 * and every line here is all three.
 *
 * **Each returns whether it drew anything, and draws nothing when empty.** A
 * quiet week is one sentence rather than three empty headings, which is the
 * caller's job to say -- see `renderPeriodSections`.
 */
import type { App, TFile } from 'obsidian';
import {
  billStatus,
  byUrgency,
  type BillRecord,
  type PurchaseRecord,
  type RecurringRecord,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';
import type { ParaBoard } from '../../para/board';
import { goalIsAchieved, projectIsCompleted } from '../../para/types';
import type { FinanceBoard } from '../../finance/read-finance';
import { spendInPeriod, type SourcedSpendItem } from '../../finance/spend';
import { goalsDueInPeriod, projectsDueInPeriod, tasksInPeriod } from '../../plan/rollup';
import { completeTask } from '../../tasks/write-tasks';
import type { VaultTask } from '../../tasks/read-tasks';
import type { DayEntryRecord } from '../../plan/read-day';
import { categoryLabel } from '../../shared/categories';
import type { NODAtrailSettings } from '../../settings/types';
import { checkbox, chip, emptyState, row, rowIconAction, section } from '../kit/elements';
import { day, money } from '../kit/format';
import { noteIcon } from '../kit/note-icon';
import { spendIcon } from '../kit/type-icons';

export interface PeriodRange {
  from: string;
  to: string;
}

/** What these sections need from whichever view is drawing them. */
export interface PeriodSectionDeps {
  /** Absent where a view shows tasks it does not own the period of, which is every caller but the plan view. */
  defer?: (event: MouseEvent, task: VaultTask) => void;
  /** Closing with a reason. Absent where a view has nowhere to open a dialog from. */
  closeWithComment?: (task: VaultTask) => void;
  /**
   * The actions the PARA and money views offer on the same rows.
   *
   * Optional as a group, because a caller that cannot open a dialog should get
   * rows it can read rather than buttons that do nothing. The plan view passes
   * all of them; a block embedded in a note passes none.
   */
  openEditGoal?: (goal: ParaBoard<TFile>['goals'][number]) => void;
  openEditProject?: (project: ParaBoard<TFile>['projects'][number]) => void;
  archivePara?: (file: TFile, archived: boolean) => void;
  openMarkPaid?: (bill: BillRecord<TFile>) => void;
  openEditBill?: (bill: BillRecord<TFile>) => void;
  openEditPurchase?: (purchase: PurchaseRecord<TFile>) => void;
  openEditRecurring?: (recurring: RecurringRecord<TFile>) => void;
  openDocument?: (value: string) => void;
  /**
   * The day-entry editor, over a meeting clicked in the week or the month.
   *
   * Optional with the rest of them: a block embedded in a note has nowhere to
   * open a dialog from, and a row it can read beats a row whose click does
   * nothing. Where it is absent, a meeting opens the note it is written in --
   * which is what every meeting did before this existed.
   */
  openEditDayEntry?: (file: TFile, entry: DayEntryRecord, onDone: () => void) => void;
  app: App;
  getSettings: () => NODAtrailSettings;
  openNote: (file: TFile) => void;
  /** Called after a task is ticked, so the view that drew it can redraw. */
  onChanged: () => void;
}

export interface PeriodSectionData {
  tasks: readonly VaultTask[];
  para: ParaBoard<TFile>;
  finance: FinanceBoard;
  range: PeriodRange;
  today: Date;
}

/**
 * All three, with the empty-period sentence when none of them had anything.
 *
 * The `|| anything` accumulation rather than `&&`-shortcutting is deliberate:
 * every section must run, because each one draws, and only their combined
 * silence is what the sentence is about.
 */
export function renderPeriodSections(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps
): boolean {
  let anything = false;
  anything = renderPeriodTasks(parent, data, deps) || anything;
  anything = renderPeriodDeadlines(parent, data, deps) || anything;
  anything = renderPeriodMoney(parent, data, deps) || anything;

  if (!anything) emptyState(parent, t('plan.nothingInPeriod'));
  return anything;
}

export function renderPeriodTasks(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps
): boolean {
  const inPeriod = tasksInPeriod(data.tasks, data.range).sort(byUrgency);
  if (inPeriod.length === 0) return false;

  const settings = deps.getSettings();
  const body = section(parent, t('plan.tasksInPeriod'));

  for (const task of inPeriod) {
    const line = row(body, {
      title: task.text,
      subtitle: task.file.basename,
      trailing: day(task.due ?? task.scheduled),
      trailingTone: 'muted',
      onClick: () => deps.openNote(task.file),
    });
    // The checkbox goes before the text rather than after it, so the row reads
    // the way a task list does, and its click is stopped from reaching the row,
    // which would open the note instead of ticking the task.
    const box = checkbox(line.createDiv({ cls: 'nod-row-lead' }), false, () => {
      void completeTask(deps.app, settings, task, data.today).then(() => deps.onChanged());
    });
    box.addEventListener('click', (event) => event.stopPropagation());
    line.prepend(box.parentElement);

    // Closing with a reason, beside ticking rather than instead of it. Most
    // tasks close without anything worth saying, and a dialog in front of every
    // one of them would tax the fifty that need nothing to serve the two that
    // do. See ui/modals/close-task-modal.ts.
    if (deps.closeWithComment) {
      // A speech bubble rather than a second tick: the checkbox beside it
      // already means done, and two check marks on one row would be asking
      // somebody to work out which one is which.
      rowIconAction(line, 'message-square', t('plan.closeTask'), () =>
        deps.closeWithComment?.(task)
      );
    }

    // Moving a task to another day, which is the other half of a review: what
    // did not happen today has to go somewhere, and the alternative is opening
    // the note and editing a date by hand.
    //
    // The date moves and the line does not. A task written in Monday's note
    // and deferred to Friday stays in Monday's note; the plan view places it
    // by date and never by which file it is in.
    if (deps.defer) {
      // This one still needs the event: the defer menu opens at the pointer.
      const action = rowIconAction(line, 'calendar-clock', t('plan.defer'), () => {});
      action.addEventListener('click', (event) => deps.defer?.(event, task));
    }
  }
  return true;
}

export function renderPeriodDeadlines(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps
): boolean {
  const goals = goalsDueInPeriod(data.para.goals, data.range);
  const projects = projectsDueInPeriod(data.para.projects, data.range);
  if (goals.length === 0 && projects.length === 0) return false;

  const settings = deps.getSettings();

  const body = section(parent, t('plan.dueInPeriod'));

  // The type AND the status, which is the one place these rows differ from
  // PARA's on purpose: this section mixes goals with projects, so dropping the
  // type to make room for the status would lose which of the two a row is.
  const label = (type: string, status: string): string => `${type} - ${t(`status.para.${status}`)}`;

  for (const goal of goals) {
    const line = row(body, {
      title: goal.title,
      subtitle: label(t('types.goal'), goal.note.status),
      trailing: day(goal.note.achieved ?? goal.note.deadline),
      trailingTone: goalIsAchieved(goal.note) ? 'good' : 'muted',
      icon: noteIcon(deps.app, goal.file, settings.iconProperty, 'target'),
      onClick: () => deps.openNote(goal.file),
    });
    if (goal.archived) chip(line, t('para.archived'), 'muted');
    paraActions(line, deps, goal.file, goal.archived, () => deps.openEditGoal?.(goal));
  }

  for (const project of projects) {
    const line = row(body, {
      title: project.title,
      subtitle: label(t('types.project'), project.note.status),
      trailing: day(project.note.completed ?? project.note.deadline),
      trailingTone: projectIsCompleted(project.note) ? 'good' : 'muted',
      icon: noteIcon(deps.app, project.file, settings.iconProperty, 'square-kanban'),
      onClick: () => deps.openNote(project.file),
    });
    if (project.archived) chip(line, t('para.archived'), 'muted');
    paraActions(line, deps, project.file, project.archived, () => deps.openEditProject?.(project));
  }
  return true;
}

/**
 * Edit and archive on a PARA row, the same pair the PARA view puts there.
 *
 * Each is drawn only when its opener was supplied, rather than drawn and left
 * inert. A button that does nothing is worse than one that is not there: it
 * reads as broken instead of as absent.
 */
function paraActions(
  line: HTMLElement,
  deps: PeriodSectionDeps,
  file: TFile,
  archived: boolean,
  edit: () => void
): void {
  if (deps.openEditGoal || deps.openEditProject) {
    rowIconAction(line, 'pencil', t('common.edit'), edit);
  }
  if (deps.archivePara) {
    rowIconAction(
      line,
      archived ? 'archive-restore' : 'archive',
      t(archived ? 'para.unarchiveNote' : 'para.archiveNote'),
      () => deps.archivePara?.(file, archived)
    );
  }
}

export function renderPeriodMoney(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps
): boolean {
  const items = spendInPeriod({
    purchases: data.finance.purchases,
    bills: data.finance.bills,
    recurring: data.finance.recurring,
    from: data.range.from,
    to: data.range.to,
    today: data.today,
    dueSoonDays: deps.getSettings().billDueSoonDays,
  });
  if (items.length === 0) return false;

  const settings = deps.getSettings();
  const body = section(parent, t('finance.title'));

  for (const item of items) {
    const line = row(body, {
      title: item.title,
      subtitle: [day(item.date), categoryLabel(item.category)].filter(Boolean).join(' - '),
      trailing: money(item.amount, item.currency),
      trailingTone: item.kind === 'recurring' ? 'muted' : undefined,
      icon: noteIcon(deps.app, item.file, settings.iconProperty, spendIcon(item.kind)),
      onClick: () => deps.openNote(item.file),
    });

    // A bill's state is the thing somebody is looking for in a week's list --
    // whether it still has to be paid -- and it is what the money views put on
    // it. Derived here rather than read, the same way those views derive it.
    if (item.kind === 'bill') {
      const state = billStatus(item.record, data.today, settings.billDueSoonDays);
      // Same three tones the finance view uses, with `paid` added: overdue is
      // the one that has to catch an eye in a week's list.
      const tone = state === 'overdue' ? 'warn' : state === 'paid' ? 'good' : 'muted';
      chip(line, t(`status.bill.${state}`), tone);
    }

    moneyActions(line, deps, item);
  }
  return true;
}

/**
 * The actions each kind of money row carries in the view it belongs to.
 *
 * A bill can be marked paid and a purchase cannot, because only one of them is
 * a thing you owe; both can be opened and edited. A recurring cost has no
 * document of its own -- it is a rule rather than a receipt -- so it takes the
 * edit alone.
 *
 * Drawn only where the opener exists, for the same reason as `paraActions`.
 */
function moneyActions(
  line: HTMLElement,
  deps: PeriodSectionDeps,
  item: SourcedSpendItem<TFile>
): void {
  const documents =
    item.kind === 'recurring'
      ? []
      : (item.record.documentPaths ?? []).filter((path) => path !== '');

  if (deps.openDocument && documents.length > 0) {
    const [first] = documents;
    if (first) {
      rowIconAction(line, 'file-text', t('finance.openDocument'), () => deps.openDocument?.(first));
    }
  }

  if (item.kind === 'bill' && deps.openMarkPaid) {
    rowIconAction(line, 'check-check', t('finance.markPaid'), () =>
      deps.openMarkPaid?.(item.record)
    );
  }

  const edit =
    item.kind === 'bill'
      ? deps.openEditBill && (() => deps.openEditBill?.(item.record))
      : item.kind === 'purchase'
        ? deps.openEditPurchase && (() => deps.openEditPurchase?.(item.record))
        : deps.openEditRecurring && (() => deps.openEditRecurring?.(item.record));

  if (edit) rowIconAction(line, 'pencil', t('common.edit'), edit);
}
