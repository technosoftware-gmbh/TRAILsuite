/**
 * Narrowing the project dashboard to what somebody is looking for.
 *
 * The rule that runs through all of it: **a blank answer asks nothing.** That is
 * the opposite of the direction every setting in this plugin takes, where a
 * blank folder matches nothing so an unconfigured plugin fails safe rather than
 * claiming the vault. A filter is not a setting. One nobody has touched must
 * show everything, or opening the view would show an empty screen.
 *
 * The case worth the most here is the area, because a project usually does not
 * carry one. It reaches its area through its goal, and a filter that read the
 * property alone would silently drop every project filed the normal way.
 */
import { describe, expect, it } from 'vitest';
import {
  emptyProjectFilter,
  filterProjects,
  isFiltering,
  type ProjectFilter,
} from '../src/para/project-filter';
import type { ParaStatus } from '../src/para/types';

const project = (
  title: string,
  status: ParaStatus,
  goalTitles: string[] = [],
  areaTitle: string | null = null
) => ({ title, file: null, archived: false, note: { status, goalTitles, areaTitle } }) as never;

const goal = (title: string, areaTitle: string | null) =>
  ({ title, file: null, archived: false, note: { areaTitle } }) as never;

const GOALS = [goal('Fit werden', 'Gesundheit'), goal('Haus fertig', 'Haus & Wohnen')];

const PROJECTS = [
  project('CN-1097838', 'ongoing', [], 'Beruf'),
  project('CN-1094005', 'blocked', [], 'Beruf'),
  project('Marathon', 'ongoing', ['Fit werden']),
  project('Küche', 'done', ['Haus fertig']),
  project('365 Tage', 'planned', []),
];

const titles = (filter: Partial<ProjectFilter>) =>
  filterProjects(PROJECTS, GOALS, { ...emptyProjectFilter(), ...filter }).map((p) => p.title);

describe('an untouched filter', () => {
  it('shows everything', () => {
    expect(titles({})).toHaveLength(PROJECTS.length);
  });

  it('is not filtering, so there is nothing to clear', () => {
    expect(isFiltering(emptyProjectFilter())).toBe(false);
  });

  it('counts a space-only search as untouched', () => {
    expect(isFiltering({ ...emptyProjectFilter(), search: '   ' })).toBe(false);
    expect(titles({ search: '   ' })).toHaveLength(PROJECTS.length);
  });
});

describe('by area', () => {
  it('finds a project that names its area itself', () => {
    expect(titles({ areaTitle: 'Beruf' })).toEqual(['CN-1097838', 'CN-1094005']);
  });

  /**
   * The case this filter exists to get right. `Marathon` says nothing about an
   * area; it names a goal, and the goal names the area.
   */
  it('finds a project that reaches its area through its goal', () => {
    expect(titles({ areaTitle: 'Gesundheit' })).toEqual(['Marathon']);
  });

  it('leaves out a project that reaches no area at all', () => {
    expect(titles({ areaTitle: 'Beruf' })).not.toContain('365 Tage');
  });
});

describe('by goal and by status', () => {
  it('finds the projects under one goal', () => {
    expect(titles({ goalTitle: 'Haus fertig' })).toEqual(['Küche']);
  });

  it('finds the projects in one status', () => {
    expect(titles({ status: 'ongoing' })).toEqual(['CN-1097838', 'Marathon']);
  });

  /** A row of dropdowns looks like it narrows together, so it does. */
  it('narrows on all of them at once rather than in turn', () => {
    expect(titles({ areaTitle: 'Beruf', status: 'ongoing' })).toEqual(['CN-1097838']);
    expect(titles({ areaTitle: 'Beruf', status: 'done' })).toEqual([]);
  });
});

describe('by name', () => {
  it('matches part of a title, ignoring case', () => {
    expect(titles({ search: 'cn-' })).toEqual(['CN-1097838', 'CN-1094005']);
    expect(titles({ search: '1097' })).toEqual(['CN-1097838']);
  });

  /**
   * A substring rather than a fuzzy match. `CN-97` would find `CN-1097838`
   * under a fuzzy rule, and then a reader has to check which of the two things
   * they asked for they actually got.
   */
  it('does not match letters scattered through a title', () => {
    expect(titles({ search: 'CN-97' })).toEqual([]);
  });

  it('ignores space around what was typed', () => {
    expect(titles({ search: '  marathon  ' })).toEqual(['Marathon']);
  });

  it('finds nothing rather than everything when nothing matches', () => {
    expect(titles({ search: 'zzz' })).toEqual([]);
  });
});
