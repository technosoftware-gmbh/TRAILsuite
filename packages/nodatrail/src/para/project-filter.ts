/**
 * Narrowing a list of projects to the ones somebody is looking for.
 *
 * Four questions, and a blank answer to any of them asks nothing. That is the
 * opposite of this codebase's usual fail-safe direction, and deliberately so:
 * an unconfigured **setting** must match nothing, because a blank folder that
 * matched everything would claim the vault. An unset **filter** must match
 * everything, because a filter nobody has touched is not a filter.
 *
 * **The area is resolved, not read.** A project names its goals and the goal
 * names the area, so filtering on the property alone would drop every project
 * that reaches its area the way most of them do. `projectsInArea` already knows
 * that rule and is given the goals to walk it.
 *
 * App-free, so every combination can be checked without a vault.
 */
import { projectsInArea, type GoalRecord, type ProjectRecord } from './board';
import type { ParaStatus } from './types';

export interface ProjectFilter {
  /** An area title, or '' for every area. */
  areaTitle: string;
  /** A goal title, or '' for every goal. */
  goalTitle: string;
  /** One status, or null for every status. */
  status: ParaStatus | null;
  /** Matched against the title, ignoring case and surrounding space. */
  search: string;
}

export function emptyProjectFilter(): ProjectFilter {
  return { areaTitle: '', goalTitle: '', status: null, search: '' };
}

/** True when any of the four is asking something, which is what the Clear button needs to know. */
export function isFiltering(filter: ProjectFilter): boolean {
  return (
    filter.areaTitle !== '' ||
    filter.goalTitle !== '' ||
    filter.status !== null ||
    filter.search.trim() !== ''
  );
}

/**
 * The projects a filter admits.
 *
 * The four narrow together rather than in turn: an area and a status both set
 * means projects in that area **and** in that status, which is what a row of
 * dropdowns looks like it does.
 *
 * Search is a substring of the title rather than a fuzzy match. A project here
 * is called `CN-1097838`, and typing `1097` should find it while `CN-97` should
 * not: a fuzzy match would return both and the reader would have to check which
 * they got.
 */
export function filterProjects<F>(
  projects: readonly ProjectRecord<F>[],
  goals: readonly GoalRecord<F>[],
  filter: ProjectFilter
): ProjectRecord<F>[] {
  const byArea = filter.areaTitle
    ? projectsInArea(filter.areaTitle, projects, goals)
    : [...projects];
  const wanted = filter.goalTitle.trim().toLowerCase();
  const needle = filter.search.trim().toLowerCase();

  return byArea.filter((project) => {
    if (filter.status !== null && project.note.status !== filter.status) return false;
    if (wanted && !project.note.goalTitles.some((title) => title.trim().toLowerCase() === wanted)) {
      return false;
    }
    return !needle || project.title.toLowerCase().includes(needle);
  });
}
