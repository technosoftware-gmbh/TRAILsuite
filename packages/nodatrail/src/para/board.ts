/**
 * The PARA tree: areas, the goals under each, and the projects under those.
 *
 * Pure, and generic over the host's file type the way `trail-core`'s records
 * are, so an Obsidian `TFile` flows through structurally without a cast at the
 * boundary and the whole thing is testable with plain objects.
 *
 * **A project's area is derived and never written back.** The vault has no
 * `area:` on a project: a project points at a goal and the goal points at an
 * area. Deriving it means moving a goal to another area re-files every project
 * under it without touching a single project note. An explicit `area:` exists
 * for a project that serves no goal, and an explicit value always wins, which
 * is the rule the whole suite follows for a value that can be both stated and
 * derived.
 */
import { titlesMatch } from 'trail-core';
import type { ParsedArea, ParsedGoal, ParsedProject, ParsedResource } from './types';

/** A parsed note paired with the file it came from. */
export interface ParaRecord<T, F = unknown> {
  file: F;
  title: string;
  note: T;
  /** True when the file sits under the archive folder for its kind. */
  archived: boolean;
}

export type AreaRecord<F = unknown> = ParaRecord<ParsedArea, F>;
export type GoalRecord<F = unknown> = ParaRecord<ParsedGoal, F>;
export type ProjectRecord<F = unknown> = ParaRecord<ParsedProject, F>;
export type ResourceRecord<F = unknown> = ParaRecord<ParsedResource, F>;

export interface ParaBoard<F = unknown> {
  areas: AreaRecord<F>[];
  goals: GoalRecord<F>[];
  projects: ProjectRecord<F>[];
  resources: ResourceRecord<F>[];
}

/** Records indexed by lower-cased title, which is how a wikilink resolves. */
function index<T, F>(records: readonly ParaRecord<T, F>[]): Map<string, ParaRecord<T, F>> {
  const map = new Map<string, ParaRecord<T, F>>();
  for (const record of records) {
    const key = record.title.trim().toLowerCase();
    if (!map.has(key)) map.set(key, record);
  }
  return map;
}

/**
 * Which area a project belongs to.
 *
 * The stated one when the note states one, otherwise the area of the first of
 * its goals that names one. First rather than all: a project serving two goals
 * in two areas is a project somebody should split, and picking one is more
 * useful than reporting none. The order is the note's own, so the answer does
 * not wobble between renders.
 */
export function projectAreaTitle<F>(
  project: ProjectRecord<F>,
  goals: readonly GoalRecord<F>[]
): string | null {
  if (project.note.areaTitle) return project.note.areaTitle;

  const byTitle = index(goals);
  for (const goalTitle of project.note.goalTitles) {
    const goal = byTitle.get(goalTitle.trim().toLowerCase());
    if (goal?.note.areaTitle) return goal.note.areaTitle;
  }
  return null;
}

/** The goals that name an area. */
export function goalsInArea<F>(
  areaTitle: string,
  goals: readonly GoalRecord<F>[]
): GoalRecord<F>[] {
  return goals.filter((goal) => titlesMatch(goal.note.areaTitle, areaTitle));
}

/** The projects that name a goal. */
export function projectsForGoal<F>(
  goalTitle: string,
  projects: readonly ProjectRecord<F>[]
): ProjectRecord<F>[] {
  return projects.filter((project) =>
    project.note.goalTitles.some((title) => titlesMatch(title, goalTitle))
  );
}

/** The projects that land in an area, whether they say so or reach it through a goal. */
export function projectsInArea<F>(
  areaTitle: string,
  projects: readonly ProjectRecord<F>[],
  goals: readonly GoalRecord<F>[]
): ProjectRecord<F>[] {
  return projects.filter((project) => titlesMatch(projectAreaTitle(project, goals), areaTitle));
}

/** The resources that name an area. */
export function resourcesInArea<F>(
  areaTitle: string,
  resources: readonly ResourceRecord<F>[]
): ResourceRecord<F>[] {
  return resources.filter((resource) => titlesMatch(resource.note.areaTitle, areaTitle));
}

/**
 * The order areas are shown in: by priority, then by title.
 *
 * An area with no priority sorts after every area that states one, for the
 * reason an unstated task priority does: saying nothing is a weaker claim than
 * saying a number.
 */
export function byPriority<T extends { priority: number | null }, F>(
  a: ParaRecord<T, F>,
  b: ParaRecord<T, F>
): number {
  const first = a.note.priority ?? Number.MAX_SAFE_INTEGER;
  const second = b.note.priority ?? Number.MAX_SAFE_INTEGER;
  if (first !== second) return first - second;
  return a.title.localeCompare(b.title);
}

/**
 * The order goals and projects are shown in: priority, then deadline, then title.
 *
 * Priority first, because it is the claim somebody made about what matters;
 * the deadline breaks the tie, because among things that matter equally the one
 * due first is the one to look at. Both fall back the same way an area's
 * priority does: **saying nothing sorts after saying something.** A goal with no
 * deadline is not urgent, it is undated, and putting it above one due on Friday
 * would read as the opposite.
 *
 * Title last, so the order is stable rather than whatever the vault listed.
 */
export function byPriorityThenDeadline<
  T extends { priority: number | null; deadline: string | null },
  F,
>(a: ParaRecord<T, F>, b: ParaRecord<T, F>): number {
  const priority =
    (a.note.priority ?? Number.MAX_SAFE_INTEGER) - (b.note.priority ?? Number.MAX_SAFE_INTEGER);
  if (priority !== 0) return priority;

  // ISO days, so a string comparison is a date comparison. The far-future
  // sentinel keeps an undated note below every dated one without inventing a
  // date for it.
  const first = a.note.deadline ?? '9999-12-31';
  const second = b.note.deadline ?? '9999-12-31';
  if (first !== second) return first < second ? -1 : 1;

  return a.title.localeCompare(b.title);
}

/** Records whose link resolves to nothing, for the health check. */
export function unresolvedLinks<T, F>(
  records: readonly ParaRecord<T, F>[],
  linkOf: (note: T) => string[],
  known: readonly { title: string }[]
): { record: ParaRecord<T, F>; target: string }[] {
  const titles = new Set(known.map((entry) => entry.title.trim().toLowerCase()));

  return records.flatMap((record) =>
    linkOf(record.note)
      .filter((target) => !titles.has(target.trim().toLowerCase()))
      .map((target) => ({ record, target }))
  );
}
