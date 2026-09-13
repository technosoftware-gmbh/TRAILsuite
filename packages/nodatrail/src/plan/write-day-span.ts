/**
 * Writing one line into every day of a range, and taking it out again.
 *
 * **One read and one write per note**, the rule `write-calendar-import.ts`
 * already states for the same job and for the same reason: a fortnight is
 * fourteen notes, and fourteen separate rewrites of one note would be fourteen
 * chances to lose a concurrent edit.
 *
 * **The line is the dialog's line.** `entryLines` composes it from the same
 * `DayEntryDraft` a single-day capture fills in, so a day inside a span holds a
 * line indistinguishable from one somebody typed there. That is what
 * `day-span.ts` depends on to find the span again, and it is the same property
 * the calendar import is built on.
 *
 * **A day that already says this is left alone.** Saving the same span twice --
 * correcting the end date, or pressing the button again because nothing
 * appeared to happen -- must not leave two lines on the days that overlap. The
 * check is the line itself rather than a record of what was written, which is
 * this plugin's usual answer and is the only one that stays true when somebody
 * deletes a day by hand afterwards.
 */
import { TFile, type App } from 'obsidian';
import {
  addDays,
  formatDayTitle,
  parseDayTitle,
  splitFrontmatterBlock,
} from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import type { NODAtrailSettings } from '../settings/types';
import { entryLines, headingsFor, type DayEntryDraft } from './add-to-day';
import { appendUnderHeading, replaceLines } from './day-body';
import type { SpanDay } from './day-span';
import { openOrCreatePeriodNote } from './write-period';

export interface SpanWriteResult {
  /** Day notes the line was added to. */
  written: number;
  /** Days that already said it, and were left as they were. */
  skipped: number;
}

/** Every ISO day from `from` to `to`, inclusive, or empty when either is not a day. */
export function daysOfSpan(from: string, to: string): string[] {
  const first = parseDayTitle(from);
  const last = parseDayTitle(to);
  if (!first || !last || last.getTime() < first.getTime()) return [];

  const out: string[] = [];
  for (let day = first; day.getTime() <= last.getTime(); day = addDays(day, 1)) {
    out.push(formatDayTitle(day));
    if (out.length > 400) break;
  }
  return out;
}

/**
 * Writes the draft into every day of the range.
 *
 * Day notes are created as they are needed, with frontmatter and no body --
 * `openOrCreatePeriodNote`'s rule -- and the heading appears only because a
 * line needs it. A fortnight's holiday that seeded headings into fourteen empty
 * days would be doing to a vault exactly what that function exists to refuse.
 *
 * In date order, so a run that fails part way through has filled the days
 * before the failure rather than a scattering of them.
 */
export async function writeDaySpan(
  app: App,
  settings: NODAtrailSettings,
  draft: DayEntryDraft,
  from: string,
  to: string,
  now: Date
): Promise<SpanWriteResult> {
  const result: SpanWriteResult = { written: 0, skipped: 0 };
  const host = hostFor(app);
  const headings = headingsFor(settings, draft.kind);

  for (const day of daysOfSpan(from, to)) {
    const date = parseDayTitle(day);
    if (!date) continue;

    // Dated with its own day, not with the span's first. Every line in the
    // range stands on its own, which is what makes one of them editable in
    // isolation and the whole thing findable again.
    const lines = entryLines(settings, draft, day);
    if (lines.length === 0) continue;

    const file: TFile = await openOrCreatePeriodNote(app, settings, 'day', date, now);
    // Read immediately before the write, not when the range was chosen: the
    // note may have been created a moment ago by this very run.
    const text = await host.vault.read(file);
    const { header, body } = splitFrontmatterBlock(text);

    if (holds(body, lines)) {
      result.skipped += 1;
      continue;
    }

    await host.vault.modify(file, `${header}${appendUnderHeading(body, headings, lines)}`);
    await touchModified(app, settings, file);
    result.written += 1;
  }

  return result;
}

/** Whether the body already carries these lines, consecutively and as written. */
function holds(body: string, lines: readonly string[]): boolean {
  const rows = body.split('\n');
  for (let at = 0; at + lines.length <= rows.length; at += 1) {
    if (lines.every((line, index) => rows[at + index] === line)) return true;
  }
  return false;
}

export interface SpanEditResult {
  /** Days rewritten, or emptied when the lines were none. */
  changed: number;
  /** Days left alone because the note had moved under the preview, by day. */
  refused: string[];
}

/**
 * Replaces each day's line with `lines`, or removes it when `lines` is empty.
 *
 * **Every note is re-read and its entry re-located rather than trusted**, the
 * rule the single-day editor already keeps: the positions came from a walk that
 * may be seconds old, and writing to a remembered index would overwrite
 * whatever had taken that line.
 *
 * **A day that has moved is refused and named, and the others still go.** The
 * single-day editor throws instead, which is right when there is one note and
 * nothing has happened yet; here, stopping half way through a fortnight would
 * leave a span that is partly the old text and partly the new, with nothing
 * saying where the seam is. Running it again from the day it names is the fix,
 * and that is a thing somebody can do.
 */
export async function rewriteDaySpan(
  app: App,
  settings: NODAtrailSettings,
  days: readonly SpanDay[],
  lines: readonly string[]
): Promise<SpanEditResult> {
  const result: SpanEditResult = { changed: 0, refused: [] };
  const host = hostFor(app);

  for (const day of days) {
    const text = await host.vault.read(day.file);
    const { header, body } = splitFrontmatterBlock(text);

    const current = body.split('\n').slice(day.record.from, day.record.to);
    const original = entryLines(settings, day.record.draft);
    const moved =
      current.length !== original.length || current.some((line, index) => line !== original[index]);
    if (moved) {
      result.refused.push(day.day);
      continue;
    }

    await host.vault.modify(
      day.file,
      `${header}${replaceLines(body, day.record.from, day.record.to, lines)}`
    );
    await touchModified(app, settings, day.file);
    result.changed += 1;
  }

  return result;
}
