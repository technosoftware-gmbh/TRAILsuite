/**
 * Putting a trip's stops into day notes.
 *
 * **One read and one write per note**, the rule `write-calendar-import.ts`
 * already carries and for the same reason: a day gaining four stops in four
 * separate rewrites is four chances for a concurrent edit to be lost.
 *
 * **The line is the dialog's line.** `entryLines` composes it from the same
 * `DayEntryDraft` the capture dialog fills in, so a seeded stop and a typed
 * meeting are the same thing. That is not tidiness: the derived key works only
 * while they are, and a second way of composing the line would be a second
 * thing to keep in step with the marker setting, the editing dialog and every
 * reader downstream.
 *
 * **The trip is the context link.** A seeded line names the trip it came from
 * and nothing else, which is what ties the day to the trip and what §F.3 will
 * later read back. The place and the people are carried on the proposal and are
 * not written yet: they belong on child lines, and the format does not have
 * them until section D.5 of the design ships.
 *
 * Nothing is written for a proposal the plan did not mark `writes`. Deciding
 * that here as well would be two places holding one rule.
 */
import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import { parseDayTitle, splitFrontmatterBlock } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import { emptyDraft, entryLines, headingsFor } from './add-to-day';
import { appendUnderHeading } from './day-body';
import { openOrCreatePeriodNote } from './write-period';
import type { TripProposal } from './trip-import-plan';

export interface TripWriteResult {
  /** Lines written. */
  written: number;
  /** Day notes touched, some of which did not exist a moment ago. */
  notes: number;
  /** The days, in order, so a caller can say which rather than count them again. */
  days: string[];
}

/** The meeting line a proposal becomes. */
export function linesFor(
  settings: NODAtrailSettings,
  proposals: readonly TripProposal[]
): string[] {
  return proposals.flatMap((proposal) =>
    entryLines(settings, {
      ...emptyDraft('meeting'),
      text: proposal.text,
      context: proposal.trip,
      startTime: proposal.from,
      endTime: proposal.to,
    })
  );
}

/**
 * Writes every proposal the plan marked, and says what it did.
 *
 * Day notes are created as they are needed, with frontmatter and no body --
 * `openOrCreatePeriodNote`'s rule. The schedule heading appears because the
 * first stop of that day needed it, never because a trip's whole span was
 * seeded with headings nobody asked for.
 */
export async function writeTripImport(
  app: App,
  settings: NODAtrailSettings,
  proposals: readonly TripProposal[],
  now: Date
): Promise<TripWriteResult> {
  const byDay = new Map<string, TripProposal[]>();
  for (const proposal of proposals) {
    if (!proposal.writes || !proposal.day) continue;
    const held = byDay.get(proposal.day);
    if (held) held.push(proposal);
    else byDay.set(proposal.day, [proposal]);
  }

  const headings = headingsFor(settings, 'meeting');
  const host = hostFor(app);
  const result: TripWriteResult = { written: 0, notes: 0, days: [] };

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
    result.days.push(day);
  }

  return result;
}
