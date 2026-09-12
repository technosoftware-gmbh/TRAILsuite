/**
 * Recognising a period note from its title.
 *
 * By title rather than by folder, because a note moved out of its folder is
 * still recognisably a week note. The folder question is the health check's;
 * this one is "which command applies to the note in front of me".
 *
 * **The five period shapes cannot collide with each other**, which is what
 * `detectPeriodLevel` relies on: `2026`, `2026-08`, `2026-Q3`, `2026-W34` and
 * `2026-08-22` are distinguishable on sight. That is a narrower claim than it
 * used to read here, and the difference matters.
 *
 * **A journal note takes the month shape exactly.** `journalTitleFor()` writes
 * `2026-09` and so does the monthly period note, in different folders, so this
 * function reports a journal note as a month note. Known and left alone: every
 * fix reverses something. Gating on the folder would give up the line above;
 * renaming journal notes would rename a vault's existing ones, and nothing
 * migrates a vault automatically.
 *
 * What it costs today is one command. `removeNavigationCommand` uses this as its
 * gate, so **Remove navigation block** offers itself over a journal note, where
 * running it does nothing: `stripNavigationBlock` consumes only nav-shaped lines
 * at the very top of a body, and a journal note starts with postings. A command
 * appearing where it should not, rather than a note being changed.
 *
 * The same collision makes a hand-typed `[[2026-09]]` ambiguous, since wikilinks
 * resolve by basename and never by path. Nothing writes such a link any more --
 * the navigation block that once wrote `[[2026-07|Monthly]]` is stripped rather
 * than rebuilt -- but a vault migrated from that scheme still carries them.
 */
import { detectPeriodLevel, parsePeriodTitle, type PeriodLevel } from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { noteTitleFor } from './paths';

export interface DetectedPeriod {
  level: PeriodLevel;
  date: Date;
}

/**
 * The period a note title names, or null.
 *
 * The settings are taken to **narrow** the answer, never to widen it: after
 * reading the title's own shape, the result is checked against what this
 * vault's template would have produced for that date, and a mismatch is
 * reported as no period at all rather than as a period a command would then act
 * on.
 *
 * So a vault that renames its day notes to `Day {YYYY}-{MM}-{DD}` does not get
 * them recognised under the new name -- `detectPeriodLevel` runs on the raw
 * title first and knows five fixed shapes -- it gets them recognised nowhere,
 * and the period commands go quiet on them. That fails safe, which is the right
 * direction, but it is a narrowing rather than a translation and the signature
 * makes the two easy to confuse. `tests/detect-period-note.test.ts` pins it.
 */
export function detectPeriodNote(
  settings: NODAtrailSettings,
  title: string
): DetectedPeriod | null {
  const level = detectPeriodLevel(title);
  if (!level) return null;

  const date = parsePeriodTitle(level, title);
  if (!date) return null;

  return noteTitleFor(settings, level, date) === title ? { level, date } : null;
}
