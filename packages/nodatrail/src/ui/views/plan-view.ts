/**
 * The plan view: one period at a time, at any of the five levels, with what
 * falls inside it.
 *
 * The rollup is recomputed on every render and written nowhere. A rollup
 * written into a period note is a rollup that is wrong the next morning.
 */
import {
  formatDayTitle,
  parseDayTitle,
  periodRange,
  shiftPeriod,
  startOfPeriod,
  type PeriodLevel,
} from '@technosoftware/trail-core';
import { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { liveOnly, readParaBoard } from '../../para/read-para';
import { readFinanceBoard } from '../../finance/read-finance';
import { periodName } from '../../plan/labels';
import { notePathFor } from '../../plan/paths';
import { openDeferMenu } from '../../plan/defer-menu';
import { readDayEntries, type DayEntryRecord } from '../../plan/read-day';
import { readTasks } from '../../tasks/read-tasks';
import type { NODAtrailSettings } from '../../settings/types';
import { emptyState, row, section, tabs, toolbarButton } from '../kit/elements';
import {
  renderPeriodDeadlines,
  renderPeriodMoney,
  renderPeriodTasks,
  type PeriodSectionDeps,
} from './plan-sections';
import { renderPlanDaySchedule, renderPlanMonth, renderPlanWeek } from './plan-calendar';
import { eachDay, monthGrid } from '../../plan/day-buckets';
import { readScheduleRange } from '../../plan/read-schedule-range';
import { CloseTaskModal } from '../modals/close-task-modal';
import { NodaView } from './base-view';
import { PLAN_VIEW_TYPE } from './view-types';

/**
 * The levels this view offers, which is not every level the plugin has.
 *
 * `PERIOD_LEVELS` in the core is still all five, and quarterly and yearly notes
 * keep their paths, their type values, their folders and their Open commands.
 * What they lost is a tab here: a quarter of tasks is a list nobody reads, and
 * two tabs you pass over on the way to Monthly cost more attention than the
 * view they lead to is worth. Removing the level rather than the tab would have
 * meant the plugin no longer understanding notes that already exist.
 */
const PLAN_LEVELS = ['day', 'week', 'month'] as const satisfies readonly PeriodLevel[];

/** The subset this view can be on. Narrower than PeriodLevel so a tab that no longer exists cannot be reached by a stale field. */
type PlanLevel = (typeof PLAN_LEVELS)[number];

/** `11:00 - 12:00`, `ab 11:00`, `bis 12:00`, or nothing. Spaced for reading, unlike the note's own form. */

export class PlanView extends NodaView {
  private level: PlanLevel = 'week';
  private anchor: Date | null = null;

  getViewType(): string {
    return PLAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('plan.title');
  }

  getIcon(): string {
    return 'calendar-days';
  }

  /** The period being shown. Null anchor means today, so opening the view lands on now. */
  private date(): Date {
    return startOfPeriod(this.level, this.anchor ?? this.deps.today());
  }

  protected toolbarActions() {
    return [
      {
        label: t('day.add'),
        icon: 'calendar-plus',
        // The period on screen, so a capture made while looking at a week goes
        // into the week unless a day is named.
        onClick: () => this.deps.openAddToDay({ level: this.level, date: this.date() }),
      },
      {
        label: t('calendar.import'),
        // The same icon the ledger view's import carries. Both mean "bring a
        // file in", and a second icon for one idea is a second thing to learn.
        icon: 'download',
        onClick: () => this.deps.openImportCalendar(),
      },
      { label: t('common.today'), icon: 'calendar-check', onClick: () => this.go(null) },
      {
        label: t('period.previous'),
        icon: 'chevron-left',
        onClick: () => this.go(shiftPeriod(this.level, this.date(), -1)),
      },
      {
        label: t('period.next'),
        icon: 'chevron-right',
        onClick: () => this.go(shiftPeriod(this.level, this.date(), 1)),
      },
    ];
  }

  private go(date: Date | null): void {
    this.anchor = date;
    void this.render();
  }

  /**
   * Jumping several periods at once.
   *
   * That is the one movement the retired navigation block offered and that
   * previous/next does not, and it is why the block could go.
   *
   * **One date input for all five levels.** Pick any day and the view lands on
   * the period containing it, because `startOfPeriod` already answers "which
   * week is this date in". The alternative was five level-appropriate pickers,
   * and two of the five are traps: a quarter has no native input at all, and an
   * ISO week's week-year disagrees with the calendar year at a boundary, which
   * is the whole reason the weekly path template spells `{GGGG}` rather than
   * `{YYYY}`. A date has neither problem.
   *
   * Native rather than drawn, so it is the iPad's own date wheel on an iPad.
   */
  private jumpField(header: HTMLElement, date: Date): void {
    const jump = header.createEl('input', { cls: 'nod-plan-jump', type: 'date' });
    jump.value = formatDayTitle(date);
    jump.setAttribute('aria-label', t('period.jump'));
    jump.addEventListener('change', () => {
      // A cleared field is not a date and not a request to go anywhere. Left
      // where it was rather than falling back to today, which would make
      // clearing the box look like pressing Today.
      const picked = parseDayTitle(jump.value);
      if (picked) this.go(picked);
    });
  }

  /**
   * The day's own entries, split between the two halves of the day layout.
   *
   * The meetings go beside the tasks, because those two are what a day is:
   * what you have to attend and what you have to do. Thoughts go below with
   * the deadlines and the money -- they are a record of the day rather than a
   * plan for it.
   *
   * The old note here said a week of meetings "wants a cache rather than seven
   * more reads". It is now read for a whole month instead, and cheaply: see
   * plan/read-schedule-range.ts, which measures why.
   *
   * Nothing here writes, and nothing here is clickable to a time: an entry
   * opens the note it is written in, which is where it is edited.
   */
  private async renderSchedule(
    main: HTMLElement,
    rest: HTMLElement,
    date: Date,
    settings: NODAtrailSettings
  ): Promise<void> {
    const path = notePathFor(settings, 'day', date);
    const file = this.deps.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;

    const { meetings, thoughts } = await readDayEntries(this.deps.app, settings, file);

    // The meetings in the bands the week draws them in, rather than as a plain
    // list: the two are views of one day, and a marker that showed what you
    // answered in the week and nothing at all in the day was the wrong way
    // round -- the day is where you look before walking into the room.
    if (meetings.length > 0) {
      const list = section(main, t('day.scheduleLabel'));
      renderPlanDaySchedule(list, meetings, settings, (entry) => {
        if (!entry.editable) {
          void this.deps.openNote(file);
          return;
        }
        this.deps.openEditDayEntry(file, entry, () => void this.render());
      });
    }

    this.renderEntries(rest, t('day.thoughtsLabel'), thoughts, file);
  }

  /**
   * One section of the day note's entries.
   *
   * **A row is only clickable to the editor when its line round-trips.** An
   * entry carrying something the dialog has no field for opens the note
   * instead, and says so: rewriting it would drop what the dialog cannot hold,
   * quietly, in somebody's records.
   */
  private renderEntries(
    body: HTMLElement,
    title: string,
    entries: readonly DayEntryRecord[],
    file: TFile
  ): void {
    if (entries.length === 0) return;

    const list = section(body, title);
    for (const entry of entries) {
      row(list, {
        title: entry.label || entry.links.join(', '),
        subtitle: entry.editable ? entry.links.join(', ') : t('day.readOnly'),
        onClick: () =>
          entry.editable
            ? this.deps.openEditDayEntry(file, entry, () => void this.render())
            : void this.deps.openNote(file),
      });
    }
  }

  /**
   * The kicker, the period's name, and the controls on one line.
   *
   * An `h1` rather than the `h2` this had, and the name of the period rather
   * than a heading saying "Plan": the tab already says which view this is, so
   * the largest thing on screen should say which period you are looking at.
   * The path underneath is the note the Open button leads to, kept because it
   * is the only place the view says where a period is actually written.
   */
  private renderHeader(body: HTMLElement, date: Date, settings: NODAtrailSettings): void {
    const header = body.createDiv({ cls: 'nod-plan-header' });

    const line = header.createDiv({ cls: 'nod-plan-kicker' });
    line.createSpan({ cls: 'nod-plan-kicker-mark', text: '/' });
    line.createSpan({ text: t('plan.title') });

    const main = header.createDiv({ cls: 'nod-plan-headline' });
    main.createEl('h1', { cls: 'nod-plan-name', text: periodName(this.level, date) });

    const controls = main.createDiv({ cls: 'nod-plan-controls' });
    this.jumpField(controls, date);
    toolbarButton(controls, t('common.open'), 'file-text', () => {
      void this.deps.openPeriod(this.level, date);
    });

    header.createSpan({ cls: 'nod-plan-path', text: notePathFor(settings, this.level, date) });
  }

  protected async renderBody(): Promise<void> {
    const settings = this.deps.getSettings();
    const date = this.date();

    const body = tabs(
      this.body,
      PLAN_LEVELS.map((level) => t(`period.${level}`)),
      PLAN_LEVELS.indexOf(this.level),
      (index) => {
        this.level = PLAN_LEVELS[index] ?? 'week';
        void this.render();
      }
    );

    this.renderHeader(body, date, settings);

    const range = periodRange(this.level, date);
    const para = liveOnly(readParaBoard(this.deps.app, settings));
    const finance = readFinanceBoard(this.deps.app, settings);
    const tasks = await readTasks(this.deps.app, settings);

    const data = { tasks, para, finance, range, today: date };
    // Annotated rather than inferred: the callbacks below take their parameter
    // types from this, and without it every one of them is an implicit `any`.
    const deps: PeriodSectionDeps = {
      app: this.deps.app,
      getSettings: this.deps.getSettings,
      openNote: (file) => void this.deps.openNote(file),
      onChanged: () => void this.render(),
      // The same actions PARA and the money views put on these rows. The
      // plan view is a digest of what is due, and a digest you can only read
      // sends somebody to another view to do the obvious thing.
      openEditGoal: (goal) => this.deps.openEditGoal(goal),
      openEditProject: (project) => this.deps.openEditProject(project),
      archivePara: (file, archived) => this.deps.archivePara(file, archived),
      openMarkPaid: (bill) => this.deps.openMarkPaid(bill),
      openEditBill: (bill) => this.deps.openEditBill(bill),
      openEditPurchase: (purchase) => this.deps.openEditPurchase(purchase),
      openEditRecurring: (recurring) => this.deps.openEditRecurring(recurring),
      openDocument: (value) => this.deps.openDocument(value),
      // The same dialog the day view opens on a row. A meeting seen in the
      // week is one somebody wants to move or rename there and then.
      openEditDayEntry: (file, entry, onDone) => this.deps.openEditDayEntry(file, entry, onDone),
      closeWithComment: (task) =>
        void new CloseTaskModal(
          {
            app: this.deps.app,
            getSettings: this.deps.getSettings,
            today: this.deps.today,
            onChanged: () => void this.render(),
          },
          task
        ).openLoaded(),
      defer: (event, task) =>
        openDeferMenu(
          event,
          {
            app: this.deps.app,
            getSettings: this.deps.getSettings,
            today: this.deps.today,
            onChanged: () => void this.render(),
          },
          task,
          this.level,
          date
        ),
    };

    // Week and month are calendars: they list each day's meetings and count
    // everything else. A whole month of schedules is read here in one pass and
    // handed down -- plan/read-schedule-range.ts says why that is affordable.
    if (this.level !== 'day') {
      const days =
        this.level === 'week'
          ? eachDay(range.from, range.to)
          : monthGrid(date).map((cell) => cell.iso);
      const meetings = await readScheduleRange(this.deps.app, settings, days);

      if (this.level === 'week') renderPlanWeek(body, data, deps, this.deps.today(), meetings);
      else renderPlanMonth(body, data, deps, date, this.deps.today(), meetings);
      return;
    }

    // The day is split: what you have to attend and what you have to do, side
    // by side and given the width, with the rest of the period beneath them.
    // The sections themselves are unchanged, which is the point -- every row
    // keeps the actions it has, which is exactly what a calendar cell cannot.
    // The frame the week column and the month cell already carry, on the
    // panels of the day itself. A view whose whole subject is one day should
    // say whether that day is today, and it was the only one of the three not
    // saying so.
    const isToday = formatDayTitle(date) === formatDayTitle(this.deps.today());
    const main = body.createDiv({ cls: 'nod-plan-day-main' });
    main.toggleClass('nod-plan-day-main--today', isToday);
    const rest = body.createDiv({ cls: 'nod-plan-day-rest' });
    rest.toggleClass('nod-plan-day-rest--today', isToday);

    await this.renderSchedule(main, rest, date, settings);

    // The three sections are placed rather than drawn in a row, because tasks
    // belong in the top half and the other two below. The empty sentence is
    // this caller's job for the same reason renderPeriodSections() made it
    // its own: only all of them being silent is what it is about.
    let anything = renderPeriodTasks(main, data, deps);
    anything = renderPeriodDeadlines(rest, data, deps) || anything;
    anything = renderPeriodMoney(rest, data, deps) || anything;
    if (!anything && main.childElementCount === 0 && rest.childElementCount === 0) {
      emptyState(body, t('plan.nothingInPeriod'));
    }
  }
}
