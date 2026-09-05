/**
 * A task, on the day of the import, for each meeting that has gone from the
 * export and is still in the notes.
 *
 * §G.6 stands: **the importer does not remove a line.** This is the other way
 * of making that survivable. The section listing what an earlier export offered
 * and this one does not is honest and easy to read past, especially at a
 * month's scale, and a list nobody acts on is a list that stops being read. A
 * task is the plugin's own way of saying "this needs a person", and it is the
 * one thing here that will still be in front of somebody tomorrow.
 *
 * The claim that makes this worth writing at all is `PriorLine`'s: a meeting
 * somebody typed by hand was never in any export, so it can never be reported
 * as having gone from one. Every task written here names a line an earlier
 * export of this same file really did offer.
 *
 * ## One task per meeting, and why not one task with a list
 *
 * A task in this plugin has a text, a context, a due date and a priority, and
 * **no notes field** -- that belongs to meetings. So a task with the meetings
 * indented under it would be an entry the capture dialog could not compose
 * back, and it would be read-only in the day view for ever. The same rule that
 * makes a meeting carrying notes unsafe to rewrite makes a task carrying a list
 * unsafe to offer.
 *
 * The cost is honest and is worth stating: a month import that drops twenty
 * meetings writes twenty tasks. They are real tasks, each ticks off as its line
 * is cleared, and twenty things to tick is a fair account of twenty notes to
 * edit.
 *
 * ## Written once
 *
 * Re-importing the same range must not write a second copy. The guard is the
 * text rather than a record kept anywhere: a task whose line already names both
 * that day and that meeting, **anywhere under the focus heading and whether or
 * not it is ticked**, is one somebody has already been told about. Matching the
 * whole composed line instead would write a fresh copy the moment a box was
 * ticked, which is precisely when the reminder has done its job.
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { parseDayTitle, splitFrontmatterBlock, type MissingLine } from '@technosoftware/trail-core';
import { t } from '../lang/I18nManager';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { emptyDraft, entryLines, headingsFor } from './add-to-day';
import { appendUnderHeading, sectionOf } from './day-body';
import { notePathFor } from './paths';
import { openOrCreatePeriodNote } from './write-period';

export interface MissingCheckResult {
  /** Tasks written. */
  written: number;
  /** Meetings already named by a task in that note, ticked or not. */
  skipped: number;
}

/**
 * The lines a check is for: gone from the export, and still in the notes.
 *
 * A row the vault no longer holds has nothing for anybody to do, and a task
 * asking somebody to look at a line that is not there is worse than no task.
 */
export function needsChecking(missing: readonly MissingLine[]): MissingLine[] {
  return missing.filter((line) => line.entry !== null);
}

/**
 * What the task says.
 *
 * The meeting's own day goes in as a wikilink, inside the text rather than
 * through the draft's `context`: `context` means a project or an area, and a
 * day note is neither. `parseTaskLine` reads a link out of the text anyway, so
 * the task still carries it as a link.
 */
export function checkTaskText(line: MissingLine): string {
  return t('calendar.checkTask', {
    day: `[[${line.day}]]`,
    text: line.entry?.text ?? line.key,
  });
}

/** Whether that meeting is already named by a task under the focus heading. */
function alreadyNamed(section: readonly string[], line: MissingLine): boolean {
  const day = `[[${line.day}]]`;
  const text = (line.entry?.text ?? line.key).trim();
  return section.some((one) => one.includes(day) && one.includes(text));
}

/**
 * The checks a run would write, given what today's note already names.
 *
 * The preview needs this and so does the button: an import where everything is
 * already present but a meeting has gone still has work to do, and a dialog
 * whose only action was disabled would say the opposite. It reads and never
 * creates -- a note that does not exist yet names nothing, so every check is
 * still to write.
 */
export async function pendingChecks(
  app: App,
  settings: NODAtrailSettings,
  missing: readonly MissingLine[],
  today: string
): Promise<MissingLine[]> {
  const wanted = needsChecking(missing);
  const date = parseDayTitle(today);
  if (wanted.length === 0 || date === null) return [];

  const file = app.vault.getAbstractFileByPath(notePathFor(settings, 'day', date));
  const section =
    file instanceof TFile
      ? sectionOf(
          splitFrontmatterBlock(await hostFor(app).vault.read(file)).body,
          headingsFor(settings, 'task')
        )
      : [];

  return wanted.filter((line) => !alreadyNamed(section, line));
}

/**
 * Writes the checks into the day note for `today`, and says what it did.
 *
 * One read and one write, the same rule the rest of this import follows. The
 * note is created when it is not there, because a reminder that depended on
 * somebody having opened today already would go missing on exactly the days
 * nothing else had been captured.
 */
export async function writeMissingChecks(
  app: App,
  settings: NODAtrailSettings,
  missing: readonly MissingLine[],
  today: string,
  now: Date
): Promise<MissingCheckResult> {
  const result: MissingCheckResult = { written: 0, skipped: 0 };
  const wanted = needsChecking(missing);
  const date = parseDayTitle(today);
  if (wanted.length === 0 || date === null) return result;

  const host = hostFor(app);
  const headings = headingsFor(settings, 'task');
  const file: TFile = await openOrCreatePeriodNote(app, settings, 'day', date, now);
  const { header, body } = splitFrontmatterBlock(await host.vault.read(file));
  const section = sectionOf(body, headings);

  const lines: string[] = [];
  for (const line of wanted) {
    if (alreadyNamed(section, line)) {
      result.skipped += 1;
      continue;
    }
    lines.push(
      ...entryLines(settings, { ...emptyDraft('task'), text: checkTaskText(line) }, today)
    );
  }
  if (lines.length === 0) return result;

  await host.vault.modify(file, `${header}${appendUnderHeading(body, headings, lines)}`);
  await touchModified(app, settings, file);
  result.written = lines.length;
  return result;
}
