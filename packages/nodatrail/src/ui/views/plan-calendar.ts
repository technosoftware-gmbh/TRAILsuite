/**
 * A period drawn as days rather than as lists: the week's seven columns and
 * the month's calendar grid.
 *
 * **A calendar shows appointments.** The meetings written in each day's note
 * are listed in full; the tasks, deadlines and money that fall on that day are
 * one muted line counting them. They were listed in full to begin with, and a
 * month of a real vault answered that: a cell read
 * `20260801_AQUILANA VERSICHERUNGEN_1040433796`, twelve of them on one Monday,
 * and the calendar had become a list of invoice filenames with a date attached.
 * The count says which days are loaded, which is the question a month is asked;
 * the day view has the detail, which is where it is acted on.
 *
 * **These are for seeing, not for doing.** The stacked sections in
 * plan-sections.ts carry every action a row has in the view it belongs to --
 * tick, move, close with a reason, edit, archive, mark paid, open the
 * document. None of that survives a column two hundred pixels wide, and four
 * icon buttons crushed against a title would be worse than none. So a cell
 * here is a line of text that opens its note, a week is what is coming, and
 * the day level is where the week is worked through. That division is the
 * design rather than a limitation of it.
 *
 * The pure half -- which days, which cells, what falls on each -- is
 * plan/day-buckets.ts. This file only draws.
 */
import { formatDayTitle, isoWeekOf, parseDayTitle, placingDay } from 'trail-core';
import type { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { eachDay, monthGrid, weekRows, type GridDay } from '../../plan/day-buckets';
import { bandOf, isWorkday, type Band } from '../../plan/day-bands';
import { goalsDueInPeriod, projectsDueInPeriod, tasksInPeriod } from '../../plan/rollup';
import { spendInPeriod } from '../../finance/spend';
import { activeDisplayLocale } from '../kit/format';
import type { PeriodRange, PeriodSectionData, PeriodSectionDeps } from './plan-sections';
import { findDayEntry } from '../../plan/read-day';
import type { NODAtrailSettings } from '../../settings/types';
import type { DayEntryRecord } from '../../plan/read-day';
import type { DayMeetings } from '../../plan/read-schedule-range';
import type { ScheduleEntry } from '../../plan/read-schedule';

/** How much of each kind falls on one day. The calendar counts these; it does not list them. */
interface DayCounts {
  task: number;
  deadline: number;
  money: number;
}

/**
 * How much of each kind falls on each day.
 *
 * Counts rather than rows, and that is the whole shape of this view. The
 * calendar lists meetings and counts everything else, so nothing here needs a
 * title, an icon or an amount -- which also means it does no per-row frontmatter
 * lookup, thirty-one days at a time.
 *
 * The day is a different field per kind: a task is placed by scheduled-or-due,
 * a deadline by its deadline, a spend item by its date. That is why this is
 * three passes rather than one generic one.
 */
function countsByDay(
  days: readonly string[],
  data: PeriodSectionData,
  deps: PeriodSectionDeps,
  range: PeriodRange
): Map<string, DayCounts> {
  const counts = new Map<string, DayCounts>(
    days.map((iso) => [iso, { task: 0, deadline: 0, money: 0 }])
  );
  const add = (day: string | null, kind: keyof DayCounts): void => {
    if (day === null) return;
    const bucket = counts.get(day);
    if (bucket) bucket[kind] += 1;
  };

  for (const task of tasksInPeriod(data.tasks, range)) add(placingDay(task), 'task');
  for (const goal of goalsDueInPeriod(data.para.goals, range)) add(goal.note.deadline, 'deadline');
  for (const project of projectsDueInPeriod(data.para.projects, range)) {
    add(project.note.deadline, 'deadline');
  }

  const spend = spendInPeriod({
    purchases: data.finance.purchases,
    bills: data.finance.bills,
    recurring: data.finance.recurring,
    from: range.from,
    to: range.to,
    today: data.today,
    dueSoonDays: deps.getSettings().billDueSoonDays,
  });
  for (const item of spend) add(item.date, 'money');

  return counts;
}

/**
 * The one muted line under a cell's meetings: how much else falls on that day.
 *
 * Counts rather than rows, which is the trade this view makes. A month cell is
 * a seventh of a row and a task title is a sentence; the count answers "is this
 * day loaded" without pretending to answer "with what". Kinds with nothing on
 * the day are left out entirely rather than shown as a zero.
 */
function summaryOf(counts: DayCounts | undefined): string {
  if (!counts) return '';
  return (
    [
      [counts.task, 'plan.countTasks'],
      [counts.deadline, 'plan.countDeadlines'],
      [counts.money, 'plan.countMoney'],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, key]) => t(key, { count: n }))
    .join(' \u00b7 ');
}

/**
 * What a click on a meeting in the week or the month does.
 *
 * The editor when the line can be found and rewritten, the note otherwise. A
 * meeting seen in the week is a meeting somebody wants to move or rename there
 * and then, and sending them to the day note to do it is sending them away from
 * the thing they were looking at.
 *
 * **Three ways it declines, and all three open the note instead.** The view has
 * no editor to open (a block embedded in a note); the line cannot be told apart
 * from another on the same day, or is not a meeting at all -- see
 * `findDayEntry`; or the line says something the dialog has no field for, in
 * which case rewriting it would quietly drop what the dialog cannot hold. That
 * last rule is the day view's, and it does not get weaker for being reached
 * from a different screen.
 */
async function openMeeting(
  entry: ScheduleEntry,
  file: TFile,
  deps: PeriodSectionDeps
): Promise<void> {
  const edit = deps.openEditDayEntry;
  if (edit) {
    const record = await findDayEntry(deps.app, deps.getSettings(), file, entry);
    if (record?.editable) {
      edit(file, record, () => deps.onChanged());
      return;
    }
  }
  deps.openNote(file);
}

/** A meeting: its time, then what it is. */
function meetingLine(
  parent: HTMLElement,
  entry: ScheduleEntry,
  onClick: () => void,
  note = ''
): void {
  const line = parent.createDiv({ cls: 'nod-plan-entry nod-plan-entry--meeting' });
  // Drawn, and drawn faintly. A meeting you declined is still an hour somebody
  // else has booked and still the reason nothing else is in that slot, so
  // hiding it would make the day read as freer than it is. Muted rather than
  // absent is the difference between "not yours" and "not there".
  line.toggleClass('nod-plan-entry--declined', entry.attendance === 'declined');
  if (entry.from) {
    line.createSpan({ cls: 'nod-plan-entry-time', text: entry.from });
  } else {
    // A dot where the time would be, so an untimed meeting still lines up with
    // the timed ones above it rather than starting at the margin.
    line.createSpan({ cls: 'nod-plan-entry-dot' });
  }
  line.createSpan({
    cls: 'nod-plan-entry-text',
    text: entry.text || entry.links.join(', '),
  });
  if (note) line.createSpan({ cls: 'nod-plan-entry-note', text: note });
  line.setAttr('role', 'button');
  line.setAttr('tabindex', '0');
  line.addEventListener('click', () => onClick());
  line.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  });
}

/**
 * The most rows a band is ever given, however busy the week.
 *
 * Six, because that is a morning nobody would call quiet and because the point
 * of the week is to see the shape of five days at once: a column tall enough to
 * hold every meeting of the worst Thursday of the year makes the other four
 * days mostly empty space, and then the week no longer fits on a screen at all.
 */
export const BAND_MAX_ROWS = 6;

/**
 * How many rows a band gets, given what each day of the week holds.
 *
 * The busiest day, capped. A constant would leave four blank rows under a
 * quiet week's afternoons; the busiest day uncapped would make one bad
 * Thursday set the height of the whole screen.
 */
export function bandRows(counts: readonly number[]): number {
  return Math.min(Math.max(0, ...counts), BAND_MAX_ROWS);
}

/**
 * How a day's meetings divide into the rows it has: how many are drawn, and
 * how many are only counted.
 *
 * **The count takes a row.** A band showing "+2 more" therefore shows one
 * fewer meeting than a band that fits, and that is the point: a band that drew
 * its rows *and* a line underneath would be one row taller than the four
 * beside it, which is the thing all of this exists to prevent.
 */
export function bandSplit(total: number, rows: number): { shown: number; hidden: number } {
  if (total <= rows) return { shown: total, hidden: 0 };
  const shown = Math.max(0, rows - 1);
  return { shown, hidden: total - shown };
}

/**
 * A fixed-height list of meetings.
 *
 * **Every day gets the same number of rows for the same band**, so five columns
 * stand the same height and the bands line up across them. That alignment is
 * what makes the grid readable as a timetable rather than as five lists side by
 * side, and before this a busy Thursday made every other column look like a
 * short day.
 *
 * The height is the busiest day's count rather than a constant, capped. A fixed
 * six would leave four blank rows under a quiet week's afternoons, which is the
 * same problem wearing the other hat.
 *
 * **An entry that does not fit is counted, never dropped in silence.** The
 * count takes a row of its own, so a day showing it shows one fewer meeting --
 * which is the price of the columns agreeing, and it is paid in the one place a
 * person can see that it was paid.
 */
/**
 * The rows for a day's meetings, all opening the editor the same way.
 *
 * The week, the month and the day all draw the same line and all mean the same
 * thing by a click on it, so they build their rows here rather than three
 * times. Before this the day view went through the generic row kit and did not
 * show the marker at all -- a meeting you had declined read in the day exactly
 * like one you were going to, which is the one place it matters most.
 */
function rowsFor(
  entries: readonly ScheduleEntry[],
  file: TFile | undefined,
  deps: PeriodSectionDeps
): MeetingRow[] {
  if (!file) return [];
  // No note: a week column is a seventh of the screen and the context a
  // meeting names is the first thing that would push its own title out of it.
  return entries.map((entry) => ({ entry, onClick: () => void openMeeting(entry, file, deps) }));
}

/** One meeting as a view draws it: what it says, and what a click on it does. */
export interface MeetingRow {
  entry: ScheduleEntry;
  /** A muted aside on the line, for a context or a reason it cannot be edited. */
  note?: string;
  onClick: () => void;
}

function bandList(parent: HTMLElement, rows: readonly MeetingRow[], height: number): void {
  const slot = parent.createDiv({ cls: 'nod-plan-band-slot' });
  // Through setCssProps rather than a class per count: the number comes from
  // the week's own data and there is no set of classes that could cover it.
  slot.setCssProps({ '--nod-band-rows': String(height) });
  if (height === 0) return;

  const { shown, hidden } = bandSplit(rows.length, height);
  for (const row of rows.slice(0, shown)) meetingLine(slot, row.entry, row.onClick, row.note);

  if (hidden > 0) {
    slot.createDiv({
      cls: 'nod-plan-band-more',
      text: t('plan.moreMeetings', { count: hidden }),
    });
  }
}

/**
 * Monday-first weekday abbreviations, in the vault's display locale.
 *
 * Through `activeDisplayLocale()` rather than letting Intl pick, which is the
 * suite-wide rule: a vault set to German should read "Mo Di Mi" on a machine
 * running in English, and the machine's locale is a fact about the laptop
 * rather than about the notes. `tests/display-locale.test.ts` refuses the
 * shortcut, and refused this exact line.
 *
 * Built from a known Monday rather than from a table of seven strings, so no
 * language has to be added anywhere for the header to be right in it.
 * 5 January 2026 is a Monday.
 */
function weekdayNames(): string[] {
  const monday = new Date(2026, 0, 5);
  const locale = activeDisplayLocale();
  return eachDay('2026-01-05', '2026-01-11').map((iso) => {
    const date = parseDayTitle(iso) ?? monday;
    return date.toLocaleDateString(locale, { weekday: 'short' });
  });
}

function dayNumberOf(iso: string): string {
  return String(parseDayTitle(iso)?.getDate() ?? '');
}

/**
 * The week as seven columns.
 *
 * Today is outlined and days already past are dimmed, which is the whole
 * navigational content of the view: where you are in the week, and how much of
 * it is still ahead.
 */
const BANDS: readonly Band[] = ['morning', 'lunch', 'afternoon'];

/**
 * The week as day columns, each split into morning, lunch and afternoon.
 *
 * **All three bands, on every day, whether or not anything is in them.** That
 * is what makes the row of columns a timetable rather than seven lists: nine
 * o'clock on Monday sits level with nine o'clock on Tuesday, and an empty
 * afternoon is a fact about the week worth seeing. It costs a lot of labels
 * over nothing while a calendar is still filling up, which is the trade.
 *
 * A meeting with no time at all sits above the bands rather than being guessed
 * into one. `parseScheduleLine` accepts a bullet with no clock on it, and
 * putting it under MORGEN would be the view inventing a time the note does not
 * claim.
 */
export function renderPlanWeek(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps,
  today: Date,
  meetings: ReadonlyMap<string, DayMeetings>
): void {
  const settings = deps.getSettings();
  const all = eachDay(data.range.from, data.range.to);
  const shown = settings.weekWorkdaysOnly ? all.filter(isWorkday) : all;
  const counts = countsByDay(all, data, deps, data.range);
  const todayIso = formatDayTitle(today);
  const names = weekdayNames();

  // What each band is worth this week, before a single column is drawn. The
  // heights have to agree across the columns, so they cannot be decided while
  // walking them.
  const inBandOn = (iso: string, band: Band): ScheduleEntry[] =>
    (meetings.get(iso)?.entries ?? []).filter(
      (entry) =>
        entry.from !== '' &&
        bandOf(entry.from, settings.weekLunchStart, settings.weekLunchEnd) === band
    );
  const untimedOn = (iso: string): ScheduleEntry[] =>
    (meetings.get(iso)?.entries ?? []).filter((entry) => entry.from === '');

  const untimedRows = bandRows(shown.map((iso) => untimedOn(iso).length));
  const rowsPerBand = new Map<Band, number>(
    BANDS.map((band) => [band, bandRows(shown.map((iso) => inBandOn(iso, band).length))])
  );

  const grid = parent.createDiv({ cls: 'nod-plan-week' });
  for (const iso of shown) {
    const date = parseDayTitle(iso);
    const column = grid.createDiv({ cls: 'nod-plan-day' });
    column.toggleClass('nod-plan-day--today', iso === todayIso);
    column.toggleClass('nod-plan-day--past', iso < todayIso);

    const head = column.createDiv({ cls: 'nod-plan-day-head' });
    const label = head.createSpan({ cls: 'nod-plan-day-name' });
    // Monday is index 0 of the weekday names; getDay() calls Sunday 0.
    label.createSpan({
      cls: 'nod-plan-day-weekday',
      text: names[((date?.getDay() ?? 1) + 6) % 7] ?? '',
    });
    label.createSpan({ cls: 'nod-plan-day-number', text: dayNumberOf(iso) });
    if (iso === todayIso) head.createSpan({ cls: 'nod-plan-now', text: t('common.today') });

    const onDay = meetings.get(iso);
    const body = column.createDiv({ cls: 'nod-plan-day-body' });

    const file = onDay?.file;

    bandList(body, rowsFor(untimedOn(iso), file, deps), untimedRows);

    for (const band of BANDS) {
      // Literal class names, toggled. This package's stylesheet test reads
      // whole names out of single quotes and refuses anything assembled at
      // runtime, on the grounds that a name a scan cannot see is a rule nobody
      // can prove is still used.
      const rule = body.createDiv({ cls: 'nod-plan-band', text: t(`plan.band.${band}`) });
      rule.toggleClass('nod-plan-band--lunch', band === 'lunch');
      bandList(body, rowsFor(inBandOn(iso, band), file, deps), rowsPerBand.get(band) ?? 0);
    }

    // Drawn even when it says nothing, because a day without one would be a
    // column one line shorter than the four beside it -- and the whole point of
    // the heights above is that they agree.
    column.createDiv({ cls: 'nod-plan-day-summary', text: summaryOf(counts.get(iso)) });
  }

  // Nothing the setting hides is lost: what falls on the two days that are not
  // drawn is said under the grid instead. A bill due on a Saturday that simply
  // vanished from the view somebody checks on Friday would be the setting
  // costing more than it saves.
  const hidden = all.filter((iso) => !shown.includes(iso));
  const notes = hidden
    .map((iso) => {
      const parts = [
        (meetings.get(iso)?.entries.length ?? 0) > 0
          ? t('plan.countMeetings', { count: meetings.get(iso)?.entries.length ?? 0 })
          : '',
        summaryOf(counts.get(iso)),
      ].filter(Boolean);
      if (parts.length === 0) return '';
      const date = parseDayTitle(iso);
      return `${names[((date?.getDay() ?? 1) + 6) % 7] ?? ''}: ${parts.join(' \u00b7 ')}`;
    })
    .filter(Boolean);
  if (notes.length > 0) {
    parent.createDiv({ cls: 'nod-plan-weekend', text: notes.join('   ') });
  }
}

/**
 * One day's meetings, in the bands the week draws them in.
 *
 * The same lines, the same markers, the same three bands -- because the day
 * and the week are two views of one thing and a person moving between them
 * should not have to re-learn what a line means. What is different is the
 * space: nothing is capped and nothing is padded, since there are no
 * neighbouring columns to line up with.
 *
 * The records come from the day view's own read, which is fresh, so a click
 * opens the editor with the positions it already holds rather than looking
 * them up again.
 */
/**
 * A day-note record as the line the calendar draws.
 *
 * Pure, and separate from the drawing, because it is the seam where the two
 * views can quietly disagree. The day used to go through the generic row kit,
 * which never saw the marker at all: a meeting you had declined read in the
 * day exactly like one you were going to. Nothing about the DOM could have
 * caught that, and this can.
 *
 * `band` is null for a meeting with no time, which sits above the bands rather
 * than being guessed into one.
 */
export function meetingRowOf(
  record: DayEntryRecord,
  settings: NODAtrailSettings
): { entry: ScheduleEntry; note: string; band: Band | null } {
  return {
    entry: {
      attendance: record.draft.attendance,
      from: record.draft.startTime,
      to: record.draft.endTime,
      text: record.label,
      links: record.links,
    },
    // A line the dialog cannot rewrite says so where it would otherwise say
    // what it is about. Losing that would make it look editable and fail on
    // the click, which is worse than saying it plainly.
    note: record.editable ? record.links.join(', ') : t('day.readOnly'),
    band:
      record.draft.startTime === ''
        ? null
        : bandOf(record.draft.startTime, settings.weekLunchStart, settings.weekLunchEnd),
  };
}

export function renderPlanDaySchedule(
  parent: HTMLElement,
  records: readonly DayEntryRecord[],
  settings: NODAtrailSettings,
  open: (record: DayEntryRecord) => void
): boolean {
  const rows = records.map((record): MeetingRow & { band: Band | null } => ({
    ...meetingRowOf(record, settings),
    onClick: () => open(record),
  }));
  if (rows.length === 0) return false;

  const body = parent.createDiv({ cls: 'nod-plan-day-schedule' });
  const untimed = rows.filter((row) => row.band === null);
  bandList(body, untimed, untimed.length);

  for (const band of BANDS) {
    const inBand = rows.filter((row) => row.band === band);
    // Every band, always, even an empty one. The bands are what makes a day
    // read as a day rather than as a list, and one that came and went with its
    // contents would move the others every time something was added.
    const rule = body.createDiv({ cls: 'nod-plan-band', text: t(`plan.band.${band}`) });
    rule.toggleClass('nod-plan-band--lunch', band === 'lunch');
    bandList(body, inBand, inBand.length);
  }
  return true;
}

/**
 * The month as a calendar grid: weeks down, weekdays across.
 *
 * A cell shows two entries and counts the rest. Three would fit on a desktop
 * and not on an iPad, and a month view is for spotting the busy days rather
 * than for reading them -- the week and the day are one click away and made
 * for that.
 */
export function renderPlanMonth(
  parent: HTMLElement,
  data: PeriodSectionData,
  deps: PeriodSectionDeps,
  monthStart: Date,
  today: Date,
  meetings: ReadonlyMap<string, DayMeetings>
): void {
  const cells = monthGrid(monthStart);
  // The grid runs past both ends of the month, so what falls on those trailing
  // days is fetched over the grid's own span rather than the period's. Without
  // this, 31 August would be drawn as an empty cell in a week that has
  // something on it.
  const gridRange = {
    from: cells[0]?.iso ?? data.range.from,
    to: cells[cells.length - 1]?.iso ?? data.range.to,
  };
  const days = cells.map((cell) => cell.iso);
  const counts = countsByDay(days, data, deps, gridRange);
  const todayIso = formatDayTitle(today);

  const table = parent.createDiv({ cls: 'nod-plan-month' });

  const head = table.createDiv({ cls: 'nod-plan-month-row nod-plan-month-row--head' });
  head.createSpan({ cls: 'nod-plan-week-number' });
  for (const name of weekdayNames()) {
    head.createSpan({ cls: 'nod-plan-weekday', text: name });
  }

  for (const week of weekRows<GridDay>(cells)) {
    const row = table.createDiv({ cls: 'nod-plan-month-row' });
    const first = week[0];
    const firstDate = first ? parseDayTitle(first.iso) : null;
    row.createSpan({
      cls: 'nod-plan-week-number',
      text: firstDate ? String(isoWeekOf(firstDate).week) : '',
    });

    for (const cell of week) {
      const onCount = counts.get(cell.iso);
      const box = row.createDiv({ cls: 'nod-plan-cell' });
      box.toggleClass('nod-plan-cell--outside', !cell.inMonth);
      box.toggleClass('nod-plan-cell--today', cell.iso === todayIso);
      box.createDiv({ cls: 'nod-plan-cell-number', text: dayNumberOf(cell.iso) });

      const onDay = meetings.get(cell.iso);
      // Three, then a counter. A cell is a seventh of a row: the fourth
      // meeting would be the one that makes every row in the month taller.
      if (onDay) {
        for (const row of rowsFor(onDay.entries.slice(0, 3), onDay.file, deps)) {
          meetingLine(box, row.entry, row.onClick);
        }
      }
      const hidden = (onDay?.entries.length ?? 0) - 3;
      if (hidden > 0) box.createDiv({ cls: 'nod-plan-cell-more', text: `+${hidden}` });

      const summary = summaryOf(onCount);
      if (summary) box.createDiv({ cls: 'nod-plan-day-summary', text: summary });
    }
  }
}
