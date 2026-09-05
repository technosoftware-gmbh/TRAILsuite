/**
 * Putting imported meetings into day notes.
 *
 * **One read and one write per note, whatever a day holds.** A week of a busy
 * calendar is thirty meetings across seven notes, and thirty separate rewrites
 * would be thirty chances for a concurrent edit to be lost -- the lesson
 * `ledger/import-write.ts` already records for postings. So the day's lines are
 * assembled first and appended in one pass.
 *
 * **The line is the dialog's line.** `entryLines` composes it from the same
 * `DayEntryDraft` the capture dialog fills in, rather than from a template
 * written here, so an imported meeting is indistinguishable from a typed one:
 * it carries the configured marker, it round-trips through the editing dialog,
 * and every reader downstream already understands it. That indistinguishability
 * is not a nicety, it is §D of the import design -- the derived key only works
 * because an imported line and a typed one are the same thing.
 *
 * Nothing is written for a proposal the plan did not mark `writes`. Deciding
 * that here as well would be two places holding one rule.
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import {
  parseDayTitle,
  splitFrontmatterBlock,
  type CalendarProposal,
  type PriorLine,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { emptyDraft, entryLines, headingsFor } from './add-to-day';
import type { Attendance } from './read-schedule';
import { appendUnderHeading, replaceLines } from './day-body';
import { findDayEntry } from './read-day';
import { notePathFor } from './paths';
import { openOrCreatePeriodNote } from './write-period';

export interface CalendarWriteResult {
  /** Lines written. */
  written: number;
  /** Lines already in a note whose marker was corrected in place. */
  updated: number;
  /**
   * Lines whose marker should have been corrected and could not be, because
   * the line says something the dialog cannot reproduce or because two lines
   * on the day are indistinguishable. Named so a caller can say which, rather
   * than reporting a number that quietly does not add up.
   */
  refused: PriorLine[];
  /** Day notes touched, some of which did not exist a moment ago. */
  notes: number;
  /** What was written, so the caller can say it plainly rather than count it again. */
  lines: PriorLine[];
}

/**
 * What a `PARTSTAT` means for the line.
 *
 * `ACCEPTED` and "not invited at all" both come out empty, because to somebody
 * reading the day they are one thing: it is on, and you are going. An answer
 * the file does not give reads as unanswered, which is RFC 5545's own default
 * and is what an invitation sitting in an inbox actually is.
 */
export function attendanceOf(partstat: string): Attendance {
  switch (partstat.trim().toUpperCase()) {
    case 'DECLINED':
      return 'declined';
    case 'TENTATIVE':
      return 'tentative';
    case 'NEEDS-ACTION':
      return 'unanswered';
    default:
      return '';
  }
}

/**
 * What a line already in a note says was answered, back in the file's own
 * vocabulary.
 *
 * The inverse of `attendanceOf`, and it lives beside it so the two cannot
 * drift. The plan compares a line's answer against the export's, and a
 * comparison between two vocabularies is a mapping waiting to disagree with
 * itself.
 *
 * A line carrying the ordinary meeting marker says nothing about an answer:
 * it is a meeting you wrote down, or one you accepted, and the empty string is
 * what the plan reduces both of those to.
 */
export function partstatOf(attendance: Attendance): string {
  switch (attendance) {
    case 'declined':
      return 'DECLINED';
    case 'tentative':
      return 'TENTATIVE';
    case 'unanswered':
      return 'NEEDS-ACTION';
    default:
      return '';
  }
}

/** The meeting line a proposal becomes. */
export function linesFor(
  settings: NODAtrailSettings,
  proposals: readonly CalendarProposal[]
): string[] {
  return proposals.flatMap((proposal) =>
    entryLines(settings, {
      ...emptyDraft('meeting'),
      text: proposal.summary,
      startTime: proposal.from,
      endTime: proposal.to,
      attendance: attendanceOf(proposal.partstat),
    })
  );
}

/**
 * Writes every proposal the plan marked, and says what it did.
 *
 * Day notes are created as they are needed, with frontmatter and no body --
 * `openOrCreatePeriodNote`'s rule, and the schedule heading appears only
 * because the first meeting needs it. A calendar import that seeded headings
 * into a month of empty days would be doing to a vault exactly what that
 * function exists to refuse.
 */
export async function writeCalendarImport(
  app: App,
  settings: NODAtrailSettings,
  proposals: readonly CalendarProposal[],
  now: Date
): Promise<CalendarWriteResult> {
  const byDay = new Map<string, CalendarProposal[]>();
  for (const proposal of proposals) {
    if (!proposal.writes) continue;
    const held = byDay.get(proposal.day);
    if (held) held.push(proposal);
    else byDay.set(proposal.day, [proposal]);
  }

  const headings = headingsFor(settings, 'meeting');
  const host = hostFor(app);
  const result: CalendarWriteResult = { written: 0, updated: 0, refused: [], notes: 0, lines: [] };

  // The corrections first, and per day, because both halves rewrite the same
  // note and the append below reads it immediately before writing: doing the
  // corrections afterwards would be working from a body captured before the
  // append and would drop it.
  await updateAnswers(app, settings, proposals, result);

  // In date order, so a run that fails part way through has filled the days
  // before the failure rather than a scattering of them.
  for (const day of [...byDay.keys()].sort()) {
    const date = parseDayTitle(day);
    const forDay = byDay.get(day) ?? [];
    if (date === null || forDay.length === 0) continue;

    const lines = linesFor(settings, forDay);
    if (lines.length === 0) continue;

    const file: TFile = await openOrCreatePeriodNote(app, settings, 'day', date, now);
    // Read immediately before the write, not when the plan was made: the note
    // may have been created a moment ago by this very run, and a body captured
    // earlier would overwrite whatever had been added meanwhile.
    const text = await host.vault.read(file);
    const { header, body } = splitFrontmatterBlock(text);
    await host.vault.modify(file, `${header}${appendUnderHeading(body, headings, lines)}`);
    await touchModified(app, settings, file);

    result.notes += 1;
    result.written += lines.length;
    for (const proposal of forDay) {
      result.lines.push({ uid: proposal.uid, day: proposal.day, key: proposal.key });
    }
  }

  return result;
}

/**
 * Corrects the marker on lines already in a note, and nothing else about them.
 *
 * **The one write in this feature that touches a line somebody already has.**
 * Everything else appends. It exists because the derived key deliberately
 * ignores the marker -- keying on it would offer every declined meeting again
 * as new -- so an answer given after the import has no other way into the note.
 * That is not an edge case: reviewing the week's meetings and declining what
 * you will not attend is a Monday morning, every Monday.
 *
 * Three guards, and each of them refuses rather than guesses:
 *
 * - The line is found by its day, time and text, and only when exactly one
 *   line matches. Two identical meetings on a day give no way to say which.
 * - The record must be `editable`, meaning composing it back reproduces the
 *   line character for character. A line carrying something the dialog has no
 *   field for is left alone, because rewriting it would drop what the dialog
 *   cannot hold.
 * - Only the marker changes. The draft is the one read out of the note, with
 *   `attendance` replaced, so the day, the time, the text, the context and
 *   every child line are the note's own.
 */
async function updateAnswers(
  app: App,
  settings: NODAtrailSettings,
  proposals: readonly CalendarProposal[],
  result: CalendarWriteResult
): Promise<void> {
  const byDay = new Map<string, CalendarProposal[]>();
  for (const proposal of proposals) {
    if (proposal.status !== 'answer-changed' || !proposal.updates) continue;
    const held = byDay.get(proposal.day);
    if (held) held.push(proposal);
    else byDay.set(proposal.day, [proposal]);
  }

  const host = hostFor(app);
  for (const day of [...byDay.keys()].sort()) {
    const date = parseDayTitle(day);
    if (date === null) continue;
    const path = notePathFor(settings, 'day', date);
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) continue;

    for (const proposal of byDay.get(day) ?? []) {
      // Read inside the loop, not outside it. Each correction shifts nothing
      // -- a marker swap keeps the line count -- but the record's positions
      // come from a read, and a second correction on the same note has to be
      // measured against what the first one left.
      const record = await findDayEntry(app, settings, file, {
        from: proposal.from,
        to: proposal.to,
        text: proposal.summary,
      });
      if (!record?.editable) {
        result.refused.push({ uid: proposal.uid, day: proposal.day, key: proposal.key });
        continue;
      }

      const lines = entryLines(settings, {
        ...record.draft,
        attendance: attendanceOf(proposal.partstat),
      });
      const text = await host.vault.read(file);
      const { header, body } = splitFrontmatterBlock(text);
      await host.vault.modify(
        file,
        `${header}${replaceLines(body, record.from, record.to, lines)}`
      );
      await touchModified(app, settings, file);
      result.updated += 1;
    }
  }
}
