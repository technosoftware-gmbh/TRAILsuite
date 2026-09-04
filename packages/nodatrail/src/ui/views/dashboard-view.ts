/**
 * The life dashboard: what you are responsible for, what is due, what is open,
 * and where the month stands.
 *
 * A view over everything else rather than a module of its own, which is why it
 * was built last. It reads the PARA board, the finance board and the tasks in
 * one pass, and it is the only surface in this plugin built from pictures.
 *
 * The shape, top to bottom: a greeting, the four figures, then **areas, goals
 * and projects as picture strips** -- PARA's own order, from what is permanent
 * to what is finishable -- then today's periods, what is due, what is owed, and
 * this month's budget.
 *
 * A "this week" section drawn by the plan view's own code was built and then
 * removed, once it was on screen next to the rest. It listed the tasks that are
 * already under "due soon" and the money already under "bills", so on a full
 * week it repeated two sections above it and on an empty one it was a third
 * heading saying nothing. The plan view is one toolbar button away and has five
 * levels; this had one. `plan-sections.ts` stays where it is -- it is the plan
 * view's own now, and the extraction cost nothing to keep.
 *
 * **Selecting an area narrows the goal and project strips.** That is the one
 * piece of state this view holds and it is not persisted: see `para-strips.ts`.
 *
 * The active-projects list the strip replaced is gone. Two lists of the same
 * projects on one screen is one of them going stale in somebody's memory.
 */
import {
  accountLabel,
  billStatus,
  byUrgency,
  countTasks,
  isOutstanding,
  periodTitle,
  sumByCurrency,
  type PeriodLevel,
} from 'trail-core';
import type { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { type ParaBoard } from '../../para/board';
import { projectIsActive } from '../../para/types';
import { liveOnly, readParaBoard } from '../../para/read-para';
import { readFinanceBoard, type FinanceBoard } from '../../finance/read-finance';
import { measureMonth } from '../../ledger/budget-month';
import { overdueTasks } from '../../plan/rollup';
import { readTasks, type VaultTask } from '../../tasks/read-tasks';
import { completeTask } from '../../tasks/write-tasks';
import { categoryLabel } from '../../shared/categories';
import { projectDefaultImages } from '../../para/default-image-file';
import { checkbox, emptyState, row, rowAction, section, stat, statRow } from '../kit/elements';
import { day, money, relativeDay } from '../kit/format';
import { dashboardGrid } from '../dashboard/cards';
import {
  imageResolver,
  renderAreaStrip,
  renderGoalStrip,
  renderProjectStrip,
  type StripDeps,
} from '../dashboard/para-strips';
import { NodaView } from './base-view';
import { DASHBOARD_VIEW_TYPE } from './view-types';

/**
 * How many outstanding bills the dashboard lists before it starts counting.
 *
 * Eight fills a screen without becoming the finance view. Whatever it is set
 * to, the line below the list says what fell past it: see `renderBills`.
 */
const BILL_LIMIT = 8;

/** Which greeting the hour calls for. Three bands, because a fourth would be a distinction nobody makes. */
function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return t('dashboard.greetingMorning');
  if (hour < 18) return t('dashboard.greetingAfternoon');
  return t('dashboard.greetingEvening');
}

export class DashboardView extends NodaView {
  /**
   * The area the strips below it are narrowed to, or null for all of them.
   *
   * Held here and nowhere else. A filter that survived a restart would be a
   * dashboard quietly showing a third of the vault, and the first symptom
   * would be a goal somebody was sure they had written.
   */
  private selectedArea: string | null = null;

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('dashboard.title');
  }

  getIcon(): string {
    return 'brain-circuit';
  }

  /**
   * The four other views, then the health check.
   *
   * The creation buttons are not here: they sit on the strip each one creates
   * into, where the thing being made is on screen beside the button that makes
   * it. A toolbar carrying every action of every section is a toolbar nobody
   * reads twice.
   */
  protected toolbarActions() {
    return [
      { label: t('dashboard.openPara'), icon: 'layers', onClick: () => this.deps.openPara() },
      // Beside PARA rather than at the end: the strip below is the short answer
      // to "what am I working on" and this is the long one.
      {
        label: t('projects.title'),
        icon: 'square-kanban',
        onClick: () => this.deps.openProjects(),
      },
      {
        label: t('dashboard.openPlan'),
        icon: 'calendar-days',
        onClick: () => this.deps.openPlan(),
      },
      // Between the plan and the money, which is where it belongs in both
      // senses: a person or a company is who the plan involves and who the
      // money goes to, and this is the one view neither of its neighbours
      // reaches.
      { label: t('crm.title'), icon: 'users', onClick: () => this.deps.openCrm() },
      { label: t('dashboard.openFinance'), icon: 'wallet', onClick: () => this.deps.openFinance() },
      {
        label: t('dashboard.openLedger'),
        icon: 'book-open-text',
        onClick: () => this.deps.openLedger(),
      },
      {
        label: t('commands.runHealthCheck'),
        icon: 'stethoscope',
        onClick: () => this.deps.openHealthCheck(),
      },
    ];
  }

  /** What the three strips need. Rebuilt per render, because the resolver holds an app. */
  private stripDeps(): StripDeps {
    return {
      app: this.deps.app,
      imageOf: imageResolver(this.deps.app),
      // Built once per render rather than per card: the alternative is listing
      // one folder a hundred times to answer a hundred projects.
      defaultProjectImage: projectDefaultImages(this.deps.app, this.deps.getSettings()),
      openNote: (file) => void this.deps.openNote(file),
      onSelectArea: (title) => {
        this.selectedArea = title;
        void this.render();
      },
      editArea: (area) => this.deps.openEditArea(area),
      editGoal: (goal) => this.deps.openEditGoal(goal),
      editProject: (project) => this.deps.openEditProject(project),
      newArea: () => this.deps.openNewArea(),
      newGoal: () => this.deps.openNewGoal(),
      newProject: () => this.deps.openNewProject(),
    };
  }

  protected async renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    const today = this.deps.today();

    const para = liveOnly(readParaBoard(this.deps.app, settings));
    const finance = readFinanceBoard(this.deps.app, settings);
    const tasks = await readTasks(this.deps.app, settings);

    this.body.createEl('h2', {
      cls: 'nod-greeting',
      text: `${greeting(this.deps.now())}. ${day(periodTitle('day', today))}`,
    });

    this.renderStats(para, finance, tasks, today);

    // An area whose note was deleted or renamed while the filter was set would
    // otherwise narrow all three strips to nothing, with no card left to click
    // to get back. Falling back to all of them is the recoverable answer.
    if (this.selectedArea && !para.areas.some((area) => area.title === this.selectedArea)) {
      this.selectedArea = null;
    }

    const strips = this.stripDeps();
    const grid = dashboardGrid(this.body);
    renderAreaStrip(grid, para.areas, this.selectedArea, strips);
    renderGoalStrip(grid, para, this.selectedArea, strips);
    renderProjectStrip(grid, para, this.selectedArea, strips);

    this.renderToday(today);
    this.renderTasks(tasks, today);
    this.renderBills(finance, today, settings.billDueSoonDays);
    await this.renderBudget(today);
  }

  private renderStats(
    para: ParaBoard<TFile>,
    finance: FinanceBoard,
    tasks: readonly VaultTask[],
    today: Date
  ): void {
    const counts = countTasks(tasks, today);
    const settings = this.deps.getSettings();
    const outstanding = finance.bills.filter((bill) =>
      isOutstanding(billStatus(bill, today, settings.billDueSoonDays))
    );
    const owed = sumByCurrency(outstanding, settings.homeCurrency);

    const strip = statRow(this.body);
    stat(strip, t('dashboard.openTasks'), String(counts.open));
    stat(
      strip,
      t('dashboard.overdue'),
      String(counts.overdue),
      counts.overdue > 0 ? 'warn' : undefined
    );
    stat(
      strip,
      t('dashboard.activeProjects'),
      String(para.projects.filter((project) => projectIsActive(project.note)).length)
    );
    stat(
      strip,
      t('dashboard.outstandingBills'),
      [...owed.entries()].map(([code, amount]) => money(amount, code)).join('  ') || '-',
      outstanding.length > 0 ? 'warn' : 'good'
    );
  }

  private renderToday(today: Date): void {
    const body = section(this.body, t('dashboard.today'));
    const levels: PeriodLevel[] = ['day', 'week', 'month'];

    for (const level of levels) {
      row(body, {
        title: periodTitle(level, today),
        subtitle: t(`period.${level}`),
        icon: 'calendar',
        onClick: () => void this.deps.openPeriod(level, today),
      });
    }
  }

  private renderTasks(tasks: readonly VaultTask[], today: Date): void {
    const settings = this.deps.getSettings();
    const overdue = overdueTasks(tasks, today);
    const soon = tasks
      .filter((task) => task.due !== null && !overdue.includes(task))
      .filter((task) => task.status === 'todo' || task.status === 'inProgress')
      .sort(byUrgency)
      .slice(0, 8);

    const body = section(this.body, t('dashboard.dueSoon'));
    const shown = [...overdue.sort(byUrgency), ...soon].slice(0, 12);

    if (shown.length === 0) {
      emptyState(body, t('dashboard.nothingDue'));
      return;
    }

    for (const task of shown) {
      const line = row(body, {
        title: task.text,
        subtitle: task.file.basename,
        trailing: relativeDay(task.due, today),
        trailingTone: overdue.includes(task) ? 'warn' : 'muted',
        onClick: () => void this.deps.openNote(task.file),
      });

      // The checkbox is inserted before the text rather than appended, so the
      // row reads the way a task list does, and its click is stopped from
      // reaching the row, which would open the note instead of ticking it.
      const box = checkbox(line.createDiv({ cls: 'nod-row-lead' }), false, () => {
        void completeTask(this.deps.app, settings, task, today).then(() => this.render());
      });
      box.addEventListener('click', (event) => event.stopPropagation());
      line.prepend(box.parentElement);
    }
  }

  private renderBills(finance: FinanceBoard, today: Date, dueSoonDays: number): void {
    const outstanding = finance.bills
      .map((bill) => ({ bill, status: billStatus(bill, today, dueSoonDays) }))
      .filter(({ status }) => isOutstanding(status))
      .sort((a, b) => (a.bill.dueDate ?? '').localeCompare(b.bill.dueDate ?? ''));

    const body = section(this.body, t('finance.bills'), {
      label: t('commands.newBill'),
      icon: 'plus',
      onClick: () => this.deps.openNewBill(),
    });

    if (outstanding.length === 0) {
      emptyState(body, t('finance.noBills'));
      return;
    }

    // A dashboard that listed forty bills would be a finance view wearing the
    // wrong hat, so the list is capped -- but a cap that says nothing is worse
    // than no cap at all. The figure in the stat strip above counts every
    // outstanding bill, so a silently truncated list disagrees with it and
    // reads as if it were the whole picture. Twelve bills against a stat of
    // CHF 1478.87 showed eight of them, coming to 1173.10, with nothing on the
    // page admitting the difference.
    const shown = outstanding.slice(0, BILL_LIMIT);
    const hidden = outstanding.slice(BILL_LIMIT);

    for (const { bill, status } of shown) {
      const line = row(body, {
        title: bill.title,
        subtitle: [bill.companyTitle, categoryLabel(bill.category)].filter(Boolean).join(' - '),
        trailing: money(bill.amount, bill.currency),
        trailingTone: status === 'overdue' ? 'warn' : 'muted',
        icon: this.noteIcon(bill.file, 'receipt'),
        onClick: () => void this.deps.openNote(bill.file),
      });
      // The dashboard is where an outstanding bill is actually noticed, so the
      // action that clears it belongs here as much as in the finance view.
      rowAction(line, t('finance.markPaid'), () => this.deps.openMarkPaid(bill));
    }

    if (hidden.length === 0) return;

    // What was left out, and what it comes to, so the two figures on this
    // screen add up. Opening the finance view is the way to the rest of them.
    const rest = sumByCurrency(
      hidden.map(({ bill }) => bill),
      this.deps.getSettings().homeCurrency
    );
    row(body, {
      title: t('dashboard.moreBills', { count: hidden.length }),
      trailing: [...rest.entries()].map(([code, amount]) => money(amount, code)).join('  '),
      trailingTone: 'muted',
      icon: 'ellipsis',
      onClick: () => this.deps.openFinance(),
    });
  }

  /**
   * This month against the plan.
   *
   * Asynchronous where the rest of the dashboard is not, because the figures
   * come from the postings rather than from frontmatter. Only the three totals
   * and the worst overruns: a dashboard that listed fifty accounts would be a
   * budget view wearing the wrong hat.
   */
  private async renderBudget(today: Date): Promise<void> {
    const body = section(this.body, t('dashboard.thisMonthsBudget'));
    const measured = await measureMonth(this.deps.app, this.deps.getSettings(), today);

    if (!measured) {
      emptyState(body, t('dashboard.noBudget'));
      return;
    }

    const { measure } = measured;
    const currency = measured.budget.currency ?? this.deps.getSettings().homeCurrency;
    const left = measure.plannedTotal - measure.actualTotal;

    const strip = statRow(body);
    stat(strip, t('finance.planned'), money(measure.plannedTotal, currency));
    stat(strip, t('finance.actual'), money(measure.actualTotal, currency));
    stat(strip, t('finance.variance'), money(left, currency), left < 0 ? 'warn' : 'good');

    // The three worst overruns, and nothing that is merely on plan. What a
    // dashboard is for is the figure somebody has to do something about.
    const over = [...measure.rows, ...measure.unbudgeted]
      .filter((line) => line.left < 0)
      .sort((a, b) => a.left - b.left)
      .slice(0, 3);

    for (const line of over) {
      row(body, {
        title: line.account ? accountLabel(line.account) : String(line.number),
        subtitle: `${money(line.actual, currency)} / ${money(line.planned, currency)}`,
        trailing: money(line.left, currency),
        trailingTone: 'warn',
      });
    }

    row(body, {
      title: measured.budget.title,
      subtitle: t('finance.budget'),
      icon: this.noteIcon(measured.budget.file, 'wallet'),
      onClick: () => void this.deps.openNote(measured.budget.file),
    });
  }
}
