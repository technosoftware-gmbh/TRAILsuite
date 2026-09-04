/**
 * The one dialog for putting something into a day note.
 *
 * **This is the point of the whole feature**, so it is worth saying what it is
 * for: writing a day should not mean writing markdown. Nobody types `- [ ]`, a
 * wikilink, an emoji or a date marker. They pick a kind, type a sentence, and
 * optionally name what it is about.
 *
 * Four kinds, and the kind decides the section. The fields under it change with
 * it, which is why the form redraws when it moves -- the same reason the
 * invoice form redraws on its direction control.
 *
 * **The note is created if missing and is not opened afterwards.** The same
 * call the booking dialogs made, for the same reason: a dialog that opens a
 * note is a dialog you close twice, and the whole point of this one is that
 * capturing something costs almost nothing.
 */
import { App, Notice, Setting, TFile } from 'obsidian';
import {
  endOfPeriod,
  formatDayTitle,
  parseDayTitle,
  splitFrontmatterBlock,
  type PeriodLevel,
} from 'trail-core';
import { t } from '../lang/I18nManager';
import { FormModal } from '../ui/modals/form-modal';
import { NewProjectModal } from '../ui/modals/new-para-modals';
import { taskPriorityField } from '../ui/modals/priority-field';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { liveOnly, readParaBoard } from '../para/read-para';
import type { NODAtrailSettings } from '../settings/types';
import { appendUnderHeading, replaceLines } from './day-body';
import { openOrCreatePeriodNote } from './write-period';
import type { DayEntryRecord } from './read-day';
import { listEditor } from '../ui/kit/list-editor';
import { activeDisplayLocale } from '../ui/kit/format';
import {
  DAY_ENTRY_KINDS,
  emptyFollowUp,
  emptyDraft,
  entryLines,
  headingsFor,
  type DayEntryDraft,
  type DayEntryKind,
} from './add-to-day';
import type { Attendance } from './read-schedule';

export interface AddToDayDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  now: () => Date;
  today: () => Date;
}

/**
 * The period a capture starts from, which is the period the view was showing.
 *
 * Absent means today, which is what the command and the ribbon mean: they are
 * reachable from anywhere and have no period behind them.
 */
export interface CaptureTarget {
  level: PeriodLevel;
  date: Date;
}

export class AddToDayModal extends FormModal {
  private draft: DayEntryDraft;
  private day: string;
  /** Projects made from this form, which the metadata cache has not indexed yet. */
  private readonly createdContexts: string[] = [];

  /**
   * The entry being edited, and the note it is in.
   *
   * Absent for a new entry, which is the ordinary case. When present, the day
   * is fixed: moving an entry to another day is a different operation from
   * correcting one, and offering both in one dialog would make a mistyped date
   * into a silently moved entry.
   */
  constructor(
    private readonly deps: AddToDayDeps,
    private readonly editing?: { file: TFile; entry: DayEntryRecord; onDone: () => void },
    private readonly target: CaptureTarget = { level: 'day', date: deps.today() }
  ) {
    super(deps.app);
    this.draft = editing ? { ...editing.entry.draft } : emptyDraft();
    // **Blank at week and month level, and that is the feature.** The date
    // field decides where the entry lands: name a day and it goes into that
    // day's note, leave it empty and it goes into the period's note with the
    // period's last day as its deadline. Monday morning produces both -- the
    // meetings are on days and the week's work is not on one yet.
    this.day = editing
      ? (editing.file.basename ?? formatDayTitle(deps.today()))
      : target.level === 'day'
        ? formatDayTitle(target.date)
        : '';
  }

  protected heading(): string {
    return this.editing ? t('day.edit') : t('day.add');
  }

  /**
   * Deleting, offered only while editing.
   *
   * A meeting goes with its children, because they were captured as one thing
   * and a note left behind under nothing would be an orphan nobody could place.
   */
  protected override extraButtons(): {
    label: string;
    warning: boolean;
    run: () => Promise<void>;
  }[] {
    if (!this.editing) return [];
    return [
      {
        label: t('common.delete'),
        warning: true,
        run: async () => {
          const target = this.editing;
          if (!target) return;
          await this.rewrite(target.file, target.entry, []);
          new Notice(t('day.deleted'));
          target.onDone();
        },
      },
    ];
  }

  protected override blocker(): string | null {
    return this.draft.text.trim() === '' ? t('common.incomplete') : null;
  }

  protected fields(container: HTMLElement): void {
    // The day first, because it is the note this is going into and everything
    // below it is what goes in. Yesterday evening's meeting belongs in
    // yesterday's note, and asking afterwards would mean re-reading the form.
    // Not offered while editing: moving an entry to another day is a different
    // operation from correcting one, and one date field doing both turns a
    // mistyped digit into a silently moved entry.
    if (!this.editing) {
      this.date(
        container,
        t('common.date'),
        () => this.day,
        (value) => (this.day = value ?? '')
      );
      if (this.target.level !== 'day') {
        this.hint(container, t('day.blankDay', { period: this.periodName() }));
      }
    }

    // Above the fields it decides, and it redraws them: a due date left over
    // from a task would otherwise still be set on a meeting, where nothing
    // shows it and nothing writes it.
    this.select(
      container,
      t('day.kind'),
      DAY_ENTRY_KINDS.map((kind): [string, string] => [kind, t(`day.kinds.${kind}`)]),
      () => this.draft.kind,
      (value) => {
        const next = (DAY_ENTRY_KINDS as readonly string[]).includes(value)
          ? (value as DayEntryKind)
          : 'task';
        if (next === this.draft.kind) return;
        // The text survives the switch and nothing else does. Somebody who
        // typed a sentence and then realised it was a meeting rather than a
        // task should not have to type it again.
        const { text, context } = this.draft;
        this.draft = { ...emptyDraft(next), text, context };
        this.rerender();
      }
    );

    if (this.draft.kind === 'meeting') {
      this.time(
        container,
        t('day.from'),
        () => this.draft.startTime,
        (value) => (this.draft.startTime = value)
      );
      this.time(
        container,
        t('day.until'),
        () => this.draft.endTime,
        (value) => (this.draft.endTime = value)
      );
      this.attendanceField(container);
    }

    this.text(
      container,
      t('day.text'),
      () => this.draft.text,
      (value) => (this.draft.text = value)
    );

    // One dropdown over projects and areas together, not two. The note it
    // points at says which it is, which is what "identified by folder and type
    // together" means -- and it is the same reason the entry writes a bare
    // wikilink rather than the word "Projekt".
    this.contextField(container);

    if (this.draft.kind === 'task') {
      this.date(
        container,
        t('finance.dueDate'),
        () => this.draft.due,
        (value) => (this.draft.due = value)
      );
      taskPriorityField(
        container,
        () => this.draft.priority,
        (value) => (this.draft.priority = value)
      );
    }

    if (this.draft.kind === 'meeting') {
      this.multiline(
        container,
        t('day.meetingNotes'),
        t('day.perLine'),
        () => this.draft.notes,
        (value) => (this.draft.notes = value)
      );
      this.followUpRows(container);
    }
  }

  /**
   * The project or area an entry is about, and a way out of the dialog when it
   * does not exist yet.
   *
   * **The plus button is the point.** A job that came out of a meeting an hour
   * ago has no project note, and leaving the dialog to write one loses
   * everything typed so far -- the same reason the invoice form's company
   * picker has one. What it creates is a project, because a job is a project:
   * a series of tasks with an outcome and an end.
   */
  /**
   * Whether you are going, which decides the marker the line carries.
   *
   * Here rather than only on the importer, for two reasons. An imported
   * meeting must be able to come back through this dialog unchanged, or it
   * stops reproducing its own line and goes read-only -- and the one you most
   * want to edit is the one you declined. And an answer given after the import
   * has no other way into the note: the importer keys a meeting on its day,
   * time and text, so re-importing a week recognises a declined meeting as one
   * it already wrote and leaves the marker as it found it. Changing it is a
   * person's job, and this is where they do it.
   */
  private attendanceField(container: HTMLElement): void {
    const choices: [Attendance, string][] = [
      ['', t('day.attendance.going')],
      ['tentative', t('day.attendance.tentative')],
      ['unanswered', t('day.attendance.unanswered')],
      ['declined', t('day.attendance.declined')],
    ];
    new Setting(container).setName(t('day.attendance.label')).addDropdown((dropdown) => {
      for (const [value, label] of choices) dropdown.addOption(value, label);
      dropdown.setValue(this.draft.attendance);
      dropdown.onChange((value) => (this.draft.attendance = value as Attendance));
    });
  }

  private contextField(container: HTMLElement): void {
    const setting = new Setting(container).setName(t('day.context'));
    setting.addDropdown((dropdown) => {
      for (const [value, label] of this.contextChoices()) dropdown.addOption(value, label);
      dropdown.setValue(this.draft.context);
      dropdown.onChange((value) => (this.draft.context = value));
    });
    setting.addExtraButton((button) => {
      button
        .setIcon('plus')
        .setTooltip(t('commands.newProject'))
        .onClick(() => {
          new NewProjectModal({
            app: this.deps.app,
            getSettings: this.deps.getSettings,
            now: this.deps.now,
            onCreated: (file) => {
              // Chosen as well as created, so the form carries on where it was.
              // Remembered too: the metadata cache has not indexed the note
              // yet, so the dropdown would otherwise not offer what it just
              // made -- the same lag the company picker works around.
              this.createdContexts.push(file.basename);
              this.draft.context = file.basename;
              this.rerender();
            },
          }).open();
        });
    });
  }

  /**
   * What follows from the meeting: a row each, and each with its own project.
   *
   * **One meeting covers several projects.** Fifteen run in parallel here and
   * every one that moved gets discussed on the Friday, so a single context
   * field on the meeting could never say what each follow-up was about -- and
   * the alternative, before this, was typing `[[Projekt]]` into a text box by
   * hand in a dialog whose whole purpose is that nobody has to.
   *
   * The project carries over from the row above, because several follow-ups
   * for one project in a row is the commonest shape a meeting produces. The
   * date is optional: a row that leaves it takes the meeting's own day.
   */
  private followUpRows(container: HTMLElement): void {
    new Setting(container).setName(t('day.meetingFollowUps')).setDesc(t('day.followUpRows'));

    const choices = this.contextChoices();
    listEditor(container.createDiv(), {
      rows: this.draft.followUps,
      blank: () => emptyFollowUp(this.draft.followUps.at(-1)?.context ?? ''),
      addLabel: t('day.addFollowUp'),
      emptyLabel: t('day.noFollowUps'),
      renderRow: (row, cell) => {
        const setting = new Setting(cell);
        setting.settingEl.addClass('nod-list-setting');

        setting.addText((input) => {
          input.setPlaceholder(t('day.text'));
          input.setValue(row.text);
          // Mutated in place. `listEditor` holds this very array and redraws
          // the whole list, so replacing the row object would edit a copy the
          // editor no longer has -- which is the bug the product-line editor
          // shipped with once.
          input.onChange((value) => (row.text = value));
        });
        setting.addDropdown((dropdown) => {
          for (const [value, label] of choices) dropdown.addOption(value, label);
          dropdown.setValue(row.context);
          dropdown.onChange((value) => (row.context = value));
        });
        setting.addText((input) => {
          input.inputEl.type = 'date';
          input.inputEl.addClass('nod-list-date');
          input.setValue(row.due);
          input.onChange((value) => (row.due = value.trim()));
        });
      },
    });
  }

  /** The live projects and areas, title-sorted, with a blank for an entry about nothing in particular. */
  private contextChoices(): [string, string][] {
    const board = liveOnly(readParaBoard(this.deps.app, this.deps.getSettings()));
    const titles = new Set([...board.projects, ...board.areas].map((record) => record.title));
    for (const made of this.createdContexts) titles.add(made);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    return [['', t('common.none')], ...sorted.map((title): [string, string] => [title, title])];
  }

  /**
   * The day an undated entry in this capture is dated with.
   *
   * The named day, or the last day of the period it is being filed under. Not
   * the period's first day: a period used as a deadline says finished *by*
   * Sunday rather than started on Monday.
   */
  private entryDay(): string {
    const named = parseDayTitle(this.day);
    if (named) return formatDayTitle(named);
    return formatDayTitle(endOfPeriod(this.target.level, this.target.date));
  }

  /** What an entry with no day is filed under, and dated with. */
  private periodName(): string {
    return t('day.byDate', {
      date: endOfPeriod(this.target.level, this.target.date).toLocaleDateString(
        activeDisplayLocale(),
        {
          day: '2-digit',
          month: '2-digit',
        }
      ),
    });
  }

  protected async submit(): Promise<void> {
    const settings = this.deps.getSettings();
    // The day is passed only when capturing. Editing an entry must not date
    // what was already there, and the entry's own lines already carry whatever
    // date they have.
    const lines = entryLines(settings, this.draft, this.editing ? undefined : this.entryDay());
    if (lines.length === 0) return;

    const target = this.editing;
    if (target) {
      // A kind that changed has to move sections, which is a delete and an
      // append rather than a rewrite in place. Done in that order, so a failure
      // between the two leaves the entry missing rather than duplicated: one is
      // a thing somebody notices and retypes, the other is a thing they do not
      // notice at all.
      if (target.entry.kind === this.draft.kind) {
        await this.rewrite(target.file, target.entry, lines);
      } else {
        await this.rewrite(target.file, target.entry, []);
        await this.appendTo(target.file, headingsFor(settings, this.draft.kind), lines);
      }
      await touchModified(this.deps.app, settings, target.file);
      new Notice(t('day.updated'));
      target.onDone();
      return;
    }

    // A named day goes into that day's note. An empty one goes into the note
    // of the period this capture started from, dated with that period's last
    // day -- which is what "must be done this week" means, and what makes it
    // show in the week rather than on a day nobody has chosen yet.
    const named = parseDayTitle(this.day);
    const level = named ? 'day' : this.target.level;
    const date = named ?? this.target.date;
    const file = await openOrCreatePeriodNote(
      this.deps.app,
      settings,
      level,
      date,
      this.deps.now()
    );

    await this.appendTo(file, headingsFor(settings, this.draft.kind), lines);
    await touchModified(this.deps.app, settings, file);
    new Notice(t('day.added'));
  }

  /**
   * Replaces an entry's own lines, or removes them.
   *
   * **The note is re-read and the entry re-located rather than trusted.** The
   * line numbers came from a render that may be minutes old, and a note edited
   * in Obsidian meanwhile would have moved them -- writing to a remembered
   * index would then overwrite whatever had taken that line. If the entry is no
   * longer where it was, this refuses rather than guesses.
   */
  private async rewrite(
    file: TFile,
    entry: DayEntryRecord,
    lines: readonly string[]
  ): Promise<void> {
    const host = hostFor(this.deps.app);
    const text = await host.vault.read(file);
    const { header, body } = splitFrontmatterBlock(text);

    const current = body.split('\n').slice(entry.from, entry.to);
    const original = entryLines(this.deps.getSettings(), entry.draft);
    const moved =
      current.length !== original.length || current.some((line, index) => line !== original[index]);
    if (moved) throw new Error(t('day.moved'));

    await host.vault.modify(file, `${header}${replaceLines(body, entry.from, entry.to, lines)}`);
  }

  /**
   * Reads the note, adds the lines to its body, writes it back.
   *
   * **The frontmatter is split off first.** `appendUnderHeading` is a transform
   * over a body and knows nothing about frontmatter, so handing it the whole
   * file would let a property whose value begins with `#` be matched as a
   * heading -- and would put an entry inside the frontmatter block.
   *
   * Read immediately before the write rather than when the dialog opened: the
   * note may have been created a moment ago by this very submit, and a body
   * captured earlier would be an empty string overwriting whatever had been
   * added meanwhile.
   */
  private async appendTo(
    file: TFile,
    headings: readonly string[],
    lines: readonly string[]
  ): Promise<void> {
    const host = hostFor(this.deps.app);
    const text = await host.vault.read(file);
    const { header, body } = splitFrontmatterBlock(text);
    await host.vault.modify(file, `${header}${appendUnderHeading(body, headings, lines)}`);
  }
}
