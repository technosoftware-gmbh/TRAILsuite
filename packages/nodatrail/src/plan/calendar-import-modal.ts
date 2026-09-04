/**
 * The calendar import's preview, which is the feature.
 *
 * Modelled on `ledger/import-modal.ts`, and for the same stated reason: *"An
 * import that wrote first and explained afterwards would be one nobody dares
 * run on a second month."* An `.ics` export routinely holds a year of events,
 * most of them already in the notes, so every line is shown with what would
 * happen to it and nothing is written until a button is pressed.
 *
 * **No checkboxes.** A row's inclusion is its status, exactly as it is in the
 * statement import: `new` and `changed-upstream` are written, everything else
 * is shown and skipped. A per-row override would be a second place holding the
 * rule the plan already holds.
 *
 * Three things it shows that a simpler preview would not, each because the
 * design doc worked out that leaving it off is how somebody gets surprised:
 *
 * - **the days it will touch**, not the range it was given, because an event
 *   starting on 28 September writes into October (§I.1);
 * - **the gap** since the last import of this source, because a straddling
 *   event belongs to the earlier range only and falls down a gap silently
 *   (§I.3);
 * - **series whose rules it cannot read**, because their dates would be wrong
 *   rather than absent, and wrong is the one that is not noticed (§F.1).
 *
 * The file is read from the machine with an `<input type="file">`, which is
 * what the statement import and the document field already do. An `.ics` lands
 * in a downloads folder, not in a vault.
 */
import { Modal, Notice, Setting, type App } from 'obsidian';
import {
  addDays,
  calendarOwner,
  expandEvents,
  formatDayTitle,
  parseDayTitle,
  parseIcs,
  planCalendarImport,
  type CalendarImportPlan,
  type CalendarProposal,
  type ExistingEntry,
  type MissingLine,
  type IcsEvent,
} from 'trail-core';
import { t } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import { archiveCalendar, priorImportsOf } from './calendar-archive';
import { eachDay } from './day-buckets';
import { readScheduleRange } from './read-schedule-range';
import { pendingChecks, writeMissingChecks } from './missing-checks';
import { vaultZone } from './vault-zone';
import { attendanceOf, partstatOf, writeCalendarImport } from './write-calendar-import';

export interface CalendarImportDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  today: () => Date;
  onImported: () => void;
}

/** Monday of the week a date falls in. */
function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/**
 * What the button says, which has to name everything the press would do.
 *
 * Three shapes rather than one with zeroes in it: "0 Termine, 3 Aufgaben" is a
 * sentence nobody writes, and the case where there is nothing to import and
 * something to note down is the one this was got wrong on.
 */
function buttonText(lines: number, checks: number): string {
  if (checks === 0) return t('calendar.write', { count: String(lines) });
  if (lines === 0) return t('calendar.writeChecks', { count: String(checks) });
  return t('calendar.writeAndCheck', { count: String(lines), checks: String(checks) });
}

export class ImportCalendarModal extends Modal {
  private fileText = '';
  private fileName = '';
  private from = '';
  private to = '';
  private events: IcsEvent[] = [];
  private plan: CalendarImportPlan | null = null;
  /**
   * The reminders this run would write, worked out with the plan rather than at
   * the write.
   *
   * The button is the reason. An import where every meeting is already present
   * but one has gone from the export still has something to do, and a footer
   * counting only the lines it would add would sit there disabled saying there
   * was nothing -- which is exactly what it did until somebody ran that case.
   */
  private checks: MissingLine[] = [];
  private body: HTMLElement | null = null;
  private busy = false;

  constructor(private readonly deps: CalendarImportDeps) {
    super(deps.app);
  }

  override onOpen(): void {
    // The current week, Monday to Sunday. The smallest range worth running, it
    // matches the view the plan is used in, and a first import that puts seven
    // days in a vault is one somebody can check by reading it.
    const monday = mondayOf(this.deps.today());
    this.from = formatDayTitle(monday);
    this.to = formatDayTitle(addDays(monday, 6));
    this.render();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('nod-import-modal');

    contentEl.createEl('h2', { text: t('calendar.import') });
    this.renderChooser(contentEl);

    this.body = contentEl.createDiv({ cls: 'nod-import-body' });
    void this.replan();
  }

  private renderChooser(parent: HTMLElement): void {
    new Setting(parent).setName(t('calendar.file')).then((setting) => {
      const input = setting.controlEl.createEl('input', { type: 'file' });
      input.accept = '.ics,text/calendar';
      input.addEventListener('change', () => {
        const picked = input.files?.[0];
        if (!picked) return;
        void picked.text().then((text) => {
          this.fileText = text;
          this.fileName = picked.name;
          void this.replan();
        });
      });
    });

    const range = new Setting(parent).setName(t('calendar.from'));
    const start = range.controlEl.createEl('input', { type: 'date' });
    start.value = this.from;
    range.controlEl.createSpan({ cls: 'nod-import-note', text: t('calendar.to') });
    const end = range.controlEl.createEl('input', { type: 'date' });
    end.value = this.to;

    const changed = () => {
      this.from = start.value;
      this.to = end.value;
      void this.replan();
    };
    start.addEventListener('change', changed);
    end.addEventListener('change', changed);

    const presets = new Setting(parent);
    const monday = mondayOf(this.deps.today());
    const set = (first: Date, last: Date) => {
      this.from = formatDayTitle(first);
      this.to = formatDayTitle(last);
      start.value = this.from;
      end.value = this.to;
      void this.replan();
    };
    presets.addButton((button) =>
      button.setButtonText(t('calendar.thisWeek')).onClick(() => set(monday, addDays(monday, 6)))
    );
    presets.addButton((button) =>
      button
        .setButtonText(t('calendar.nextWeek'))
        .onClick(() => set(addDays(monday, 7), addDays(monday, 13)))
    );
    presets.addButton((button) =>
      button.setButtonText(t('calendar.thisMonth')).onClick(() => {
        const now = this.deps.today();
        set(
          new Date(now.getFullYear(), now.getMonth(), 1),
          new Date(now.getFullYear(), now.getMonth() + 1, 0)
        );
      })
    );
  }

  /**
   * Reads the file, asks the vault what it already holds, and redraws.
   *
   * The vault is re-read on every pass rather than once when the file was
   * picked. A range changed after the fact covers different notes, and a plan
   * made against the wrong days would offer meetings that are already there.
   */
  private async replan(): Promise<void> {
    const body = this.body;
    if (!body) return;
    body.empty();

    const settings = this.deps.getSettings();
    if (this.fileText.trim() === '' || !parseDayTitle(this.from) || !parseDayTitle(this.to)) {
      body.createEl('p', { cls: 'nod-import-summary', text: t('calendar.chooseFile') });
      return;
    }

    this.events = parseIcs(this.fileText);
    if (this.events.length === 0) {
      body.createEl('p', { cls: 'nod-import-warn', text: t('calendar.nothingRead') });
      this.plan = null;
      return;
    }

    // Whose calendar this is, from the file's own X-WR-CALNAME. It is what
    // lets the import pick your ATTENDEE line out of the thirty on a meeting,
    // and being asked for your own address by a program reading your own
    // calendar is a poor way to start.
    const expansion = expandEvents(this.events, this.from, this.to, calendarOwner(this.fileText));
    const history = await priorImportsOf(this.deps.app, settings, this.fileName);
    const existing = await this.existingLines(settings, expansion.occurrences);

    this.plan = planCalendarImport(expansion, {
      from: this.from,
      to: this.to,
      existing,
      history,
      zone: vaultZone(),
    });
    this.checks = await pendingChecks(
      this.deps.app,
      settings,
      this.plan.missing,
      formatDayTitle(this.deps.today())
    );

    this.renderSummary(body, this.plan);
    this.renderRows(body, this.plan);
    this.renderMissing(body, this.plan);
    this.renderFooter(body, this.plan);
  }

  /**
   * The meeting lines the vault holds on every day this import could touch.
   *
   * The days come from the expansion rather than from the range, for the same
   * reason the preview reports them: an event starting on the last day of the
   * range has lines outside it, and reading only the range would offer those
   * days a meeting they already have.
   */
  private async existingLines(
    settings: NODAtrailSettings,
    occurrences: readonly { date: string; endDate: string | null }[]
  ): Promise<ExistingEntry[]> {
    let last = this.to;
    for (const occurrence of occurrences) {
      if (occurrence.endDate !== null && occurrence.endDate > last) last = occurrence.endDate;
    }

    const held = await readScheduleRange(this.deps.app, settings, eachDay(this.from, last));
    const out: ExistingEntry[] = [];
    for (const [day, meetings] of held) {
      for (const entry of meetings.entries) {
        // Stated as a PARTSTAT rather than as this plugin's own word for it,
        // because the plan compares it against the file's value and one
        // vocabulary is what makes that a comparison rather than a mapping.
        out.push({
          day,
          from: entry.from,
          text: entry.text,
          partstat: partstatOf(entry.attendance),
        });
      }
    }
    return out;
  }

  private renderSummary(parent: HTMLElement, plan: CalendarImportPlan): void {
    const summary = parent.createDiv({ cls: 'nod-import-summary' });
    summary.createEl('p', {
      text: t('calendar.summary', {
        file: this.fileName,
        events: String(this.events.length),
        lines: String(plan.proposals.length),
        write: String(plan.toWrite),
        update: String(plan.toUpdate),
        present: String(plan.alreadyPresent),
        attention: String(plan.needsAttention),
      }),
    });

    const first = plan.days.at(0);
    const last = plan.days.at(-1);
    if (first !== undefined && last !== undefined) {
      summary.createEl('p', {
        text: t('calendar.touches', { count: String(plan.days.length), first, last }),
      });
      // §I.1 out loud. The obvious mental model of a range is that nothing
      // happens outside it, and an import that said "this week" and then made
      // a note in October would be a surprise in somebody's vault.
      if (first < this.from || last > this.to) {
        summary.createEl('p', { cls: 'nod-import-note', text: t('calendar.outsideRange') });
      }
    }

    if (plan.gap) {
      summary.createEl('p', {
        cls: 'nod-import-warn',
        text: t('calendar.gap', { from: plan.gap.from, last: plan.gap.to }),
      });
    }

    if (plan.unsupported.length > 0) {
      const parts = [...new Set(plan.unsupported.flatMap((series) => series.parts))].sort();
      summary.createEl('p', {
        cls: 'nod-import-warn',
        text: t('calendar.unsupported', {
          count: String(plan.unsupported.length),
          parts: parts.join(', '),
        }),
      });
    }

    if (plan.truncated.length > 0) {
      summary.createEl('p', {
        cls: 'nod-import-warn',
        text: t('calendar.truncated', { count: String(plan.truncated.length) }),
      });
    }
  }

  private renderRows(parent: HTMLElement, plan: CalendarImportPlan): void {
    const list = parent.createDiv({ cls: 'nod-import-list' });
    for (const proposal of plan.proposals) {
      const line = list.createDiv({ cls: 'nod-import-row' });
      // Written out rather than assembled: a class name built in a template
      // literal is one the stylesheet check cannot see, and a rule nobody can
      // prove is used is a rule nobody dares delete.
      if (proposal.writes || proposal.status === 'answer-changed') {
        line.addClass('nod-import-ready');
      } else if (proposal.status === 'already-present') line.addClass('nod-import-skipped');
      else line.addClass('nod-import-attention');

      line.createSpan({ cls: 'nod-import-date', text: proposal.day });
      line.createSpan({ cls: 'nod-import-time', text: spanOf(proposal) });
      line.createSpan({ cls: 'nod-import-text', text: proposal.summary });

      const notes = [statusOf(proposal), answerOf(proposal), proposal.location];
      if (proposal.span) {
        notes.push(
          t('calendar.spanOf', {
            index: String(proposal.span.index),
            count: String(proposal.span.count),
          })
        );
      }
      line.createSpan({ cls: 'nod-import-note', text: notes.filter(Boolean).join(' · ') });
    }
  }

  /**
   * What an earlier export offered and this one does not.
   *
   * Listed and never removed: §G.6. An import that could delete is an import
   * that owns the section, and it does not -- somebody else's hand is on those
   * lines too.
   */
  private renderMissing(parent: HTMLElement, plan: CalendarImportPlan): void {
    if (plan.missing.length === 0) return;

    parent.createEl('h3', { text: t('calendar.missingHeading') });
    for (const gone of plan.missing) {
      const line = parent.createDiv({ cls: 'nod-import-row nod-import-attention' });
      line.createSpan({ cls: 'nod-import-date', text: gone.day });
      line.createSpan({ cls: 'nod-import-text', text: gone.entry?.text ?? gone.key });
      line.createSpan({
        cls: 'nod-import-note',
        text: gone.entry ? t('calendar.missingNote') : t('calendar.missingGone'),
      });
    }
  }

  private renderFooter(parent: HTMLElement, plan: CalendarImportPlan): void {
    const footer = parent.createDiv({ cls: 'nod-import-footer' });
    const lines = plan.toWrite + plan.toUpdate;
    const checks = this.checks.length;

    new Setting(footer).addButton((button) => {
      button
        .setButtonText(buttonText(lines, checks))
        .setCta()
        .setDisabled(lines + checks === 0 || this.busy)
        .onClick(() => {
          void this.write();
        });
    });
  }

  private async write(): Promise<void> {
    const plan = this.plan;
    if (!plan || this.busy) return;
    this.busy = true;

    const settings = this.deps.getSettings();
    const result = await writeCalendarImport(
      this.deps.app,
      settings,
      plan.proposals,
      this.deps.now()
    );
    // After the appends, because it writes into today's note and today may be
    // one of the days just filled. It reads that note's focus section afresh,
    // which is what stops a second import of the same range writing the same
    // reminders twice.
    const checks = await writeMissingChecks(
      this.deps.app,
      settings,
      plan.missing,
      formatDayTitle(this.deps.today()),
      this.deps.now()
    );

    const said: string[] = [];
    // Only when something was written. A run that exists to leave three
    // reminders should not open by announcing nothing.
    if (result.written > 0 || checks.written === 0) {
      said.push(
        t('calendar.added', { count: String(result.written), notes: String(result.notes) })
      );
    }
    if (checks.written > 0) said.push(t('calendar.checked', { count: String(checks.written) }));
    if (checks.skipped > 0) {
      said.push(t('calendar.checkedSkipped', { count: String(checks.skipped) }));
    }
    new Notice(said.join('\n'));

    // After the write, and only after. A file kept for an import that threw
    // would describe something that did not happen -- `archiveStatement`'s own
    // ordering, and its reason. Failing to keep it is reported and does not
    // undo the lines, which are the part that matters: the notes are the
    // record and the archive is what lets the next run compare.
    try {
      const path = await archiveCalendar(
        this.deps.app,
        settings,
        this.fileName,
        this.from,
        this.to,
        this.fileText
      );
      if (path) new Notice(t('calendar.kept', { path }));
    } catch {
      new Notice(t('calendar.kept', { path: '?' }));
    }

    this.deps.onImported();
    this.close();
  }
}

/** `09:00-09:30`, `09:00`, `-17:00`, or nothing at all for an all-day line. */
function spanOf(proposal: CalendarProposal): string {
  if (proposal.from && proposal.to) return `${proposal.from}-${proposal.to}`;
  if (proposal.from) return proposal.from;
  if (proposal.to) return `-${proposal.to}`;
  return '';
}

/** What you answered, for the preview. Empty for a meeting nobody invited you to. */
function answerOf(proposal: CalendarProposal): string {
  const attendance = attendanceOf(proposal.partstat);
  if (attendance === '') return '';
  return t(`calendar.answer.${attendance}`);
}

function statusOf(proposal: CalendarProposal): string {
  switch (proposal.status) {
    case 'new':
      return t('calendar.statusNew');
    case 'already-present':
      return t('calendar.statusPresent');
    case 'answer-changed':
      return t('calendar.statusAnswerChanged');
    case 'changed-upstream':
      return t('calendar.statusChanged', { old: proposal.stale?.text ?? '' });
    case 'edited-here':
      return t('calendar.statusEdited');
    case 'duplicate-in-file':
      return t('calendar.statusDuplicate');
    default:
      return t('calendar.statusUnsupported');
  }
}
