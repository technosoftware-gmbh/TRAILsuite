/**
 * Changing a PARA note that already exists.
 *
 * The same contract as `finance/edit-money.ts`, and for the same reason:
 * **only the properties the form shows are written.** Everything else on the
 * note is left exactly as it was, including properties NODAtrail has no setting
 * for. Somebody who put their own field on an area should not lose it to a
 * dialog that thinks it knows the whole note.
 *
 * **The title is not changed here.** Renaming is Obsidian's own operation and
 * it has links to keep in step; a dashboard that quietly renamed files is one
 * nobody trusts with a folder. It matters more for PARA than for money,
 * because a goal and a project are joined to their area by title.
 *
 * **A blank field removes its property rather than writing it empty.** A note
 * that never had `deadline:` and one carrying `deadline:` with nothing after it
 * read the same to a person and differently to a parser, and the absent one is
 * what "no deadline" actually looks like.
 */
import { App, TFile } from 'obsidian';
import { wikilinkValue } from 'trail-core';
import { hostFor } from '../shared/vault-host';
import { touchModified } from '../shared/note-stamps';
import type { NODAtrailSettings } from '../settings/types';
import type { ParaCommon, ParsedGoal, ParsedProject } from './types';

/** What the area form can change. An area has no status and no deadline, deliberately. */
export type AreaEdits = Pick<ParaCommon, 'image' | 'priority'>;

/**
 * What the goal form can change.
 *
 * **`done` and `closed` are fields now, not stamps.** They were described here
 * as stamped by the act rather than typed, and that was true when marking a
 * goal achieved was the only way to set one. The status still fills them -- see
 * `status-dates.ts` -- but it fills the field on the form, where the day can be
 * corrected before saving, because the day of the action and the day of the
 * record routinely differ.
 */
export type GoalEdits = Pick<
  ParsedGoal,
  'image' | 'priority' | 'areaTitle' | 'status' | 'deadline' | 'closed'
> & { done: string | null };

/** What the project form can change, on the same terms. */
export type ProjectEdits = Pick<
  ParsedProject,
  'image' | 'priority' | 'areaTitle' | 'goalTitles' | 'status' | 'deadline' | 'closed'
> & { done: string | null };

export async function writeAreaEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: AreaEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.imageProperty, edits.image);
    write(frontmatter, settings.priorityProperty, edits.priority);
  });

  await touchModified(app, settings, file);
}

export async function writeGoalEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: GoalEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.imageProperty, edits.image);
    write(frontmatter, settings.priorityProperty, edits.priority);
    write(frontmatter, settings.goalAreaProperty, wikilinkOrNull(edits.areaTitle));
    // The status is a fixed vocabulary rather than free text, so it is always
    // written: a goal with no status is not a state this plugin recognises.
    write(frontmatter, settings.goalStatusProperty, edits.status);
    write(frontmatter, settings.deadlineProperty, edits.deadline);
    // A null clears the property, which is what a status moved back off Done
    // means: the note must not go on asserting a day it was finished on.
    write(frontmatter, settings.achievedProperty, edits.done);
    write(frontmatter, settings.closedProperty, edits.closed);
  });

  await touchModified(app, settings, file);
}

export async function writeProjectEdits(
  app: App,
  settings: NODAtrailSettings,
  file: TFile,
  edits: ProjectEdits
): Promise<void> {
  await hostFor(app).frontmatter.process(file, (frontmatter) => {
    write(frontmatter, settings.imageProperty, edits.image);
    write(frontmatter, settings.priorityProperty, edits.priority);
    write(frontmatter, settings.projectAreaProperty, wikilinkOrNull(edits.areaTitle));
    write(frontmatter, settings.projectStatusProperty, edits.status);
    write(frontmatter, settings.deadlineProperty, edits.deadline);
    write(frontmatter, settings.completedProperty, edits.done);
    write(frontmatter, settings.closedProperty, edits.closed);
    writeList(
      frontmatter,
      settings.projectGoalsProperty,
      edits.goalTitles.map((title) => wikilinkValue(title))
    );
  });

  await touchModified(app, settings, file);
}

/** Writes a value, or removes the property when there is none. */
function write(
  frontmatter: Record<string, unknown>,
  property: string,
  value: string | number | null
): void {
  const key = property.trim();
  if (!key) return;
  if (value === null || value === '') delete frontmatter[key];
  else frontmatter[key] = value;
}

/**
 * The same rule for a list.
 *
 * An empty list is removed rather than written as `[]`, which is what
 * `buildProjectFrontmatter` already does on creation: an empty list says
 * nothing that an absent property does not, and the two spellings would give
 * one project note two shapes depending on how it was made.
 */
function writeList(
  frontmatter: Record<string, unknown>,
  property: string,
  values: readonly string[]
): void {
  const key = property.trim();
  if (!key) return;
  if (values.length === 0) delete frontmatter[key];
  else frontmatter[key] = [...values];
}

function wikilinkOrNull(title: string | null): string | null {
  return title ? wikilinkValue(title) : null;
}
