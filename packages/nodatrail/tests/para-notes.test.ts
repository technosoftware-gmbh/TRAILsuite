/**
 * The PARA note formats, checked against the shapes the target vault actually
 * holds rather than against invented ones.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { parseArea, parseGoal, parseProject, parseResource } from '../src/para/parse';
import {
  buildAreaFrontmatter,
  buildGoalFrontmatter,
  buildProjectFrontmatter,
  buildResourceFrontmatter,
} from '../src/para/write';
import {
  commonProperties,
  goalProperties,
  projectProperties,
  resourceProperties,
  typeProperties,
} from '../src/para/properties';
import { goalIsAchieved, projectIsActive, projectIsCompleted } from '../src/para/types';

const S = DEFAULT_SETTINGS;

describe('an area note, as the vault writes one', () => {
  const area = parseArea(
    {
      type: 'area',
      image: '1 Bereiche/1 Gesundheit/_resources/Gesundheit.png',
      priority: 1,
      created: '[[2026-07-13]]',
      modified: '2026-08-04T14:05',
      icon: 'ra-health',
    },
    commonProperties(S)
  );

  it('reads the image path verbatim, broken or not', () => {
    // That path points at the German folder names the vault used before it was
    // renamed, so it resolves to nothing. Reporting it is the health check's
    // job; silently repairing it here would be editing somebody's note.
    expect(area.image).toBe('1 Bereiche/1 Gesundheit/_resources/Gesundheit.png');
  });

  it('reads the priority', () => {
    expect(area.priority).toBe(1);
  });

  it('ignores the icon, and leaves it on the note', () => {
    // The fixture still carries `icon: 'ra-health'` on purpose. It used to be
    // parsed into a field of the record and written back out, and nothing ever
    // rendered it -- the setting, the parse and the write branch were all
    // reachable and all pointless. The icon is now read straight off the file
    // where a row is drawn (ui/kit/note-icon.ts), for every note type rather
    // than for PARA alone, so the record has no business holding one.
    //
    // What matters is that it survives. A PARA edit goes through
    // processFrontMatter, which leaves properties the form does not show
    // exactly as they were, and the round-trip below is the proof that
    // building frontmatter from a parsed record does not invent one either.
    expect('icon' in area).toBe(false);
  });

  it('is not archived', () => {
    expect(area.archived).toBeNull();
  });

  it('round-trips', () => {
    const frontmatter = buildAreaFrontmatter(
      typeProperties(S, S.areaTypeValue),
      commonProperties(S),
      area
    );
    expect(frontmatter.type).toBe('area');
    expect(frontmatter.icon).toBeUndefined();
    expect(parseArea(frontmatter, commonProperties(S))).toEqual(area);
  });
});

describe('a goal note', () => {
  const goal = parseGoal(
    {
      type: 'goal',
      area: '[[Gesundheit]]',
      status: 'ongoing',
      priority: 2,
      deadline: null,
      achieved: null,
    },
    goalProperties(S)
  );

  it('reads the area link', () => {
    expect(goal.areaTitle).toBe('Gesundheit');
  });

  it('reads a blank deadline as nothing rather than as a date', () => {
    expect(goal.deadline).toBeNull();
    expect(goal.achieved).toBeNull();
  });

  it('reads an unknown status as backlog, so a typo never hides a goal', () => {
    // Backlog rather than ongoing, because backlog is what a note that has
    // not said anything means: written down, not yet decided on. Either way
    // the point is that a typo lands somewhere visible.
    expect(parseGoal({ status: 'in Arbeit' }, goalProperties(S)).status).toBe('backlog');
    expect(parseGoal({}, goalProperties(S)).status).toBe('backlog');
  });

  it('translates the old vocabulary on the way in', () => {
    // Read, never written: a note keeps saying `paused` until somebody edits
    // it, and reads as `blocked` everywhere in the meantime. This is what let
    // eight statuses arrive without rewriting anybody's notes.
    const at = (status: string) => parseGoal({ status }, goalProperties(S)).status;
    expect(at('paused')).toBe('blocked');
    expect(at('achieved')).toBe('done');
    expect(at('dropped')).toBe('removed');
    expect(at('completed')).toBe('done');
  });

  it('no longer lets an achieved date beat the status word', () => {
    // It used to. Under eight statuses that would make a goal at Review read
    // as over, so the date is now a record of *when* the work finished and the
    // status alone says *whether* it is finished.
    const stale = parseGoal({ status: 'ongoing', achieved: '2026-06-19' }, goalProperties(S));
    expect(goalIsAchieved(stale)).toBe(false);
    expect(stale.achieved).toBe('2026-06-19');
  });

  it('counts closed and removed as reached, and done and review as not yet', () => {
    // Done is a claim and Review is that claim waiting on somebody, so both
    // still want something. A goal sitting at Done because nobody reviewed it
    // is exactly the state worth seeing.
    const at = (status: string) => goalIsAchieved(parseGoal({ status }, goalProperties(S)));
    expect(at('closed')).toBe(true);
    expect(at('removed')).toBe(true);
    expect(at('done')).toBe(false);
    expect(at('review')).toBe(false);
  });

  it('round-trips', () => {
    const frontmatter = buildGoalFrontmatter(
      typeProperties(S, S.goalTypeValue),
      goalProperties(S),
      goal
    );
    expect(frontmatter.area).toBe('[[Gesundheit]]');
    expect(parseGoal(frontmatter, goalProperties(S))).toEqual(goal);
  });
});

describe('a project note, as the vault writes one', () => {
  const project = parseProject(
    {
      type: 'project',
      image: '3 Projekte/Fotografie/_resources/AlteDiasEinscannen.jpeg',
      status: 'completed',
      priority: 1,
      goals: ['[[Intensivierung des Hobbies Fotografie!]]'],
      deadline: '2026-06-30',
      completed: '2026-06-19',
    },
    projectProperties(S)
  );

  it('reads the goals list', () => {
    expect(project.goalTitles).toEqual(['Intensivierung des Hobbies Fotografie!']);
  });

  it('has no area of its own, which is the normal case', () => {
    expect(project.areaTitle).toBeNull();
  });

  it('reads the old completed as done, which is a claim rather than the end', () => {
    // `completed` becomes `done`, not `closed`: it was a claim that the work
    // was finished, and reading it as closed would decide on somebody's behalf
    // that what they called finished had also been accepted.
    expect(project.status).toBe('done');
    expect(projectIsCompleted(project)).toBe(false);
    expect(projectIsActive(project)).toBe(false);
  });

  it('is finished once it is closed', () => {
    const closed = { ...project, status: 'closed' as const };
    expect(projectIsCompleted(closed)).toBe(true);
    expect(projectIsActive(closed)).toBe(false);
  });

  it('reads a single unwrapped goal link as a one-entry list', () => {
    const one = parseProject({ goals: '[[Ein Ziel]]' }, projectProperties(S));
    expect(one.goalTitles).toEqual(['Ein Ziel']);
  });

  it('ignores a stray sentence in the goals list rather than inventing a goal', () => {
    const strays = parseProject({ goals: ['noch offen'] }, projectProperties(S));
    expect(strays.goalTitles).toEqual([]);
  });

  it('counts a planned project as active and a paused one as not', () => {
    expect(projectIsActive(parseProject({ status: 'planned' }, projectProperties(S)))).toBe(true);
    expect(projectIsActive(parseProject({ status: 'paused' }, projectProperties(S)))).toBe(false);
    expect(projectIsActive(parseProject({ status: 'dropped' }, projectProperties(S)))).toBe(false);
  });

  it('round-trips', () => {
    const frontmatter = buildProjectFrontmatter(
      typeProperties(S, S.projectTypeValue),
      projectProperties(S),
      project
    );
    expect(frontmatter.goals).toEqual(['[[Intensivierung des Hobbies Fotografie!]]']);
    expect(parseProject(frontmatter, projectProperties(S))).toEqual(project);
  });

  it('writes no goals property at all for a project that serves none', () => {
    const frontmatter = buildProjectFrontmatter(
      typeProperties(S, S.projectTypeValue),
      projectProperties(S),
      { ...project, goalTitles: [] }
    );
    expect(frontmatter).not.toHaveProperty('goals');
  });
});

describe('a resource note', () => {
  const resource = parseResource(
    {
      type: 'resource',
      area: '[[Finanzen]]',
      topic: 'Steuern',
      source: 'https://www.estv.admin.ch',
      tags: ['steuern', 'referenz'],
    },
    resourceProperties(S)
  );

  it('reads its fields', () => {
    expect(resource.areaTitle).toBe('Finanzen');
    expect(resource.topic).toBe('Steuern');
    expect(resource.tags).toEqual(['steuern', 'referenz']);
  });

  it('reads a comma-separated tag string, which is what an imported note holds', () => {
    const imported = parseResource({ tags: 'steuern, referenz' }, resourceProperties(S));
    expect(imported.tags).toEqual(['steuern', 'referenz']);
  });

  it('round-trips', () => {
    const frontmatter = buildResourceFrontmatter(
      typeProperties(S, S.resourceTypeValue),
      resourceProperties(S),
      resource
    );
    expect(parseResource(frontmatter, resourceProperties(S))).toEqual(resource);
  });
});

describe('a vault that spells its properties differently', () => {
  it('reads them under the configured names', () => {
    const properties = { ...goalProperties(S), areaProperty: 'bereich', statusProperty: 'stand' };
    const goal = parseGoal({ bereich: '[[Gesundheit]]', stand: 'paused' }, properties);

    expect(goal.areaTitle).toBe('Gesundheit');
    expect(goal.status).toBe('blocked');
  });
});
