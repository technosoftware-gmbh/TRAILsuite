import { describe, expect, it } from 'vitest';
import {
  byPriority,
  goalsInArea,
  projectAreaTitle,
  projectsForGoal,
  projectsInArea,
  resourcesInArea,
  unresolvedLinks,
  type GoalRecord,
  type ProjectRecord,
} from '../src/para/board';
import type { ParsedGoal, ParsedProject } from '../src/para/types';

function goal(title: string, areaTitle: string | null, priority: number | null = null): GoalRecord {
  const note: ParsedGoal = {
    image: null,
    priority,
    archived: null,
    areaTitle,
    status: 'ongoing',
    deadline: null,
    achieved: null,
    closed: null,
  };
  return { file: {}, title, note, archived: false };
}

function project(
  title: string,
  goalTitles: string[],
  areaTitle: string | null = null
): ProjectRecord {
  const note: ParsedProject = {
    image: null,
    priority: null,
    archived: null,
    goalTitles,
    areaTitle,
    status: 'ongoing',
    deadline: null,
    completed: null,
    closed: null,
  };
  return { file: {}, title, note, archived: false };
}

const GOALS = [
  goal('Intensivierung des Hobbies Fotografie!', 'Hobbies', 4),
  goal('Meine Cardiofitness ist auf 30 gestiegen!', 'Gesundheit', 2),
  goal('Ohne Bereich', null),
];

describe('projectAreaTitle', () => {
  it('derives the area through the goal, which is what the vault relies on', () => {
    const dias = project('Alte Dias einscannen', ['Intensivierung des Hobbies Fotografie!']);
    expect(projectAreaTitle(dias, GOALS)).toBe('Hobbies');
  });

  it('lets a stated area beat the derived one', () => {
    const stated = project('X', ['Intensivierung des Hobbies Fotografie!'], 'Finanzen');
    expect(projectAreaTitle(stated, GOALS)).toBe('Finanzen');
  });

  it('resolves the goal link case-insensitively, the way Obsidian does', () => {
    const lower = project('X', ['intensivierung des hobbies fotografie!']);
    expect(projectAreaTitle(lower, GOALS)).toBe('Hobbies');
  });

  it('skips a goal that names no area and takes the next one that does', () => {
    const both = project('X', ['Ohne Bereich', 'Meine Cardiofitness ist auf 30 gestiegen!']);
    expect(projectAreaTitle(both, GOALS)).toBe('Gesundheit');
  });

  it('answers nothing for a project that reaches no area at all', () => {
    expect(projectAreaTitle(project('X', []), GOALS)).toBeNull();
    expect(projectAreaTitle(project('X', ['Ein gelöschtes Ziel']), GOALS)).toBeNull();
  });
});

describe('grouping', () => {
  const projects = [
    project('Alte Dias einscannen', ['Intensivierung des Hobbies Fotografie!']),
    project('365 Tage', ['Intensivierung des Hobbies Fotografie!']),
    project('Direkt', [], 'Finanzen'),
  ];

  it('finds the goals in an area', () => {
    expect(goalsInArea('Hobbies', GOALS).map((record) => record.title)).toEqual([
      'Intensivierung des Hobbies Fotografie!',
    ]);
  });

  it('finds the projects for a goal', () => {
    expect(
      projectsForGoal('Intensivierung des Hobbies Fotografie!', projects).map((r) => r.title)
    ).toEqual(['Alte Dias einscannen', '365 Tage']);
  });

  it('finds the projects that land in an area, however they got there', () => {
    expect(projectsInArea('Hobbies', projects, GOALS)).toHaveLength(2);
    expect(projectsInArea('Finanzen', projects, GOALS).map((r) => r.title)).toEqual(['Direkt']);
  });

  it('finds nothing in an area nothing points at', () => {
    expect(projectsInArea('Rentenplanung', projects, GOALS)).toEqual([]);
    expect(resourcesInArea('Rentenplanung', [])).toEqual([]);
  });
});

describe('byPriority', () => {
  it('sorts a stated priority ahead of an unstated one', () => {
    const sorted = [goal('C', null), goal('A', null, 3), goal('B', null, 1)]
      .sort(byPriority)
      .map((record) => record.title);
    expect(sorted).toEqual(['B', 'A', 'C']);
  });

  it('breaks a tie by title, so the order never wobbles between renders', () => {
    const sorted = [goal('B', null, 1), goal('A', null, 1)].sort(byPriority).map((r) => r.title);
    expect(sorted).toEqual(['A', 'B']);
  });
});

describe('unresolvedLinks', () => {
  it('reports a goal link that resolves to nothing', () => {
    const projects = [project('X', ['Ein gelöschtes Ziel', 'Ohne Bereich'])];
    const broken = unresolvedLinks(projects, (note) => note.goalTitles, GOALS);

    expect(broken).toHaveLength(1);
    expect(broken[0]?.target).toBe('Ein gelöschtes Ziel');
  });

  it('reports nothing when every link resolves', () => {
    expect(unresolvedLinks([project('X', ['Ohne Bereich'])], (n) => n.goalTitles, GOALS)).toEqual(
      []
    );
  });
});
