/**
 * What an area, a goal, a project and a resource say.
 *
 * These stay in NODAtrail rather than moving to `trail-core`, and the line is
 * worth stating because the money formats went the other way. A bill is a
 * record of a transaction: the note is evidence, and its meaning must not drift
 * between releases. A project note is this product's model of how work is
 * organised, in the same way a trip is APERtrail's model of a journey, and the
 * core's own working notes name that as the example of a schema that does not
 * move.
 *
 * Pure: no Obsidian import, so parsing is testable without a vault.
 */

/**
 * How a goal stands.
 *
 * The vault this was designed against only ever writes `ongoing`; the other
 * three are what it needs next. A fixed vocabulary rather than a setting, for
 * the reason APERtrail's travel statuses are one: the views and the counts key
 * off these exact strings, and a vault that renamed one would have silently
 * emptied a column.
 */
/**
 * One vocabulary for goals and projects, in the order work moves through it.
 *
 * `backlog` is where everything new starts: something written down and not yet
 * decided on. `done` is a claim that the work is finished, `review` is that
 * claim waiting on somebody else, and `closed` is the end. `removed` is the
 * thing abandoned rather than finished, which is a different fact and worth
 * keeping apart from it.
 *
 * **Goals and projects share the list**, which they did not before: a goal was
 * `achieved` and a project `completed`, two words for one idea and two type
 * guards to keep in step. One vocabulary is one translation set and one place
 * to change it. `backlog` and `review` sit oddly on a goal, and nothing makes
 * anybody use them.
 *
 * The order here is the order the statuses are offered in, and it is the
 * workflow rather than the alphabet.
 */
export const PARA_STATUSES = [
  'backlog',
  'planned',
  'ongoing',
  'blocked',
  'done',
  'review',
  'closed',
  'removed',
] as const;
export type ParaStatus = (typeof PARA_STATUSES)[number];

/**
 * What the old vocabulary's words mean in the new one.
 *
 * **Read, never written.** A note saying `paused` keeps saying it until
 * somebody edits that note, and it reads as `blocked` everywhere in the
 * meantime. That is what lets eight statuses arrive without rewriting
 * anybody's notes, and it is the same rule the badge rename in CULItrail
 * follows.
 *
 * `completed` and `achieved` both become `done` rather than `closed`: they were
 * a claim that the work was finished, and the new list has a word for exactly
 * that. Reading them as `closed` would be deciding, on somebody's behalf, that
 * a thing they called finished had also been accepted.
 */
const LEGACY_STATUSES: Readonly<Record<string, ParaStatus>> = Object.freeze({
  paused: 'blocked',
  completed: 'done',
  achieved: 'done',
  dropped: 'removed',
});

/** A stored value as one of the eight, or null when it is none of them. */
export function readParaStatus(value: unknown): ParaStatus | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  const known = PARA_STATUSES.find((status) => status === trimmed);
  return known ?? LEGACY_STATUSES[trimmed] ?? null;
}

/** Kept as the two names the rest of the code already uses. */
export const GOAL_STATUSES = PARA_STATUSES;
export type GoalStatus = ParaStatus;
export const PROJECT_STATUSES = PARA_STATUSES;
export type ProjectStatus = ParaStatus;

export function isGoalStatus(value: unknown): value is GoalStatus {
  return readParaStatus(value) !== null;
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return readParaStatus(value) !== null;
}

/** What every PARA note carries, whatever kind it is. */
export interface ParaCommon {
  /** As written. An image path or an embed, resolved by the UI and kept verbatim here. */
  image: string | null;
  /** Low number first. Null where the note states none, which sorts after every stated one. */
  priority: number | null;
  /** The day it was archived. Written when a note is moved into the archive, and only then. */
  archived: string | null;
}

/**
 * An area: a standard to be maintained rather than an outcome to be reached.
 *
 * **No status, deliberately.** An area with one would be a project wearing the
 * wrong hat, and the moment there is a status somebody will want a deadline
 * too.
 */
export type ParsedArea = ParaCommon;

export interface ParsedGoal extends ParaCommon {
  areaTitle: string | null;
  status: GoalStatus;
  deadline: string | null;
  /** The day it was reached. Beats `status`, because typing a date is a stronger claim than leaving a dropdown alone. */
  achieved: string | null;
  /** The day it was accepted and over, which is routinely a different day. */
  closed: string | null;
}

export interface ParsedProject extends ParaCommon {
  goalTitles: string[];
  /**
   * Optional. An explicit value wins over the area derived through the
   * project's goals, which is the suite's rule everywhere a value can be both
   * stated and derived.
   */
  areaTitle: string | null;
  status: ProjectStatus;
  deadline: string | null;
  /** The day the work was finished: a claim. */
  completed: string | null;
  /** The day it was accepted and over, which is routinely a different day. */
  closed: string | null;
}

export interface ParsedResource extends ParaCommon {
  areaTitle: string | null;
  topic: string | null;
  source: string | null;
  tags: string[];
}

/**
 * Over: nothing further is wanted from anybody.
 *
 * **`done` and `review` are not here, and that is the decision.** Done is a
 * claim the work is finished and Review is that claim waiting on somebody, so
 * both still want something -- and a project sitting at Done for three weeks
 * because nobody reviewed it is exactly the state worth seeing. Only `closed`
 * and `removed` drop out of the lists and go green.
 */
export function isFinishedStatus(status: ParaStatus): boolean {
  return status === 'closed' || status === 'removed';
}

/**
 * True when a goal counts as reached.
 *
 * **The date no longer overrides the status.** It used to: an `achieved:` date
 * meant reached whatever the status said, which under eight values would make
 * a goal at Review read as over. The date is a record of *when* the work
 * finished; the status is what says whether the thing is finished.
 */
export function goalIsAchieved(goal: Pick<ParsedGoal, 'status' | 'achieved'>): boolean {
  return isFinishedStatus(goal.status);
}

/** True when a project counts as finished, on the same terms. */
export function projectIsCompleted(project: Pick<ParsedProject, 'status' | 'completed'>): boolean {
  return isFinishedStatus(project.status);
}

/**
 * Still being worked on.
 *
 * Narrower than "not finished": a thing in the backlog has not been started and
 * one that is blocked cannot be, so neither is work in progress. `done` and
 * `review` are not active either -- the work is over even where the paperwork
 * is not.
 */
export function projectIsActive(project: Pick<ParsedProject, 'status' | 'completed'>): boolean {
  return project.status === 'ongoing' || project.status === 'planned';
}

/** The same question of a goal. */
export function goalIsActive(goal: Pick<ParsedGoal, 'status' | 'achieved'>): boolean {
  return goal.status === 'ongoing' || goal.status === 'planned';
}
