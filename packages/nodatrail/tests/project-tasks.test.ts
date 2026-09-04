/**
 * Which open tasks belong to a project.
 *
 * A task says what it is about by carrying a wikilink, which the core's parser
 * already pulls off the line. So this is a grouping over something that
 * already exists rather than a new format -- and it is what makes a job note
 * worth keeping: a job that collects tasks from four Friday meetings has them
 * scattered across four day notes, and this is the only way to ask what is
 * still open for it.
 *
 * Two rules carry it. **Only open tasks count**, because the question is what
 * is left rather than what happened. And **a link is matched by title,
 * case-insensitively**, which is how everything else in this suite identifies
 * a note -- so a project keeps its tasks when it is moved between folders, and
 * loses them when it is renamed, exactly as Obsidian's own links do.
 */
import { describe, expect, it } from 'vitest';
import { parseTaskLine, type ParsedTask } from 'trail-core';
import { openTaskCounts, tasksAbout } from '../src/para/project-tasks';

const parse = (line: string): ParsedTask => parseTaskLine(line);

const TASKS = [
  parse('- [ ] Simulator-Update testen [[PMQ Reconstitution]] 📅 2026-09-04'),
  parse('- [ ] Kunden zurückrufen [[PMQ Reconstitution]]'),
  parse('- [x] Logs geprüft [[PMQ Reconstitution]]'),
  parse('- [ ] Dias sortieren [[Alte Dias einscannen]]'),
  parse('- [ ] Ohne Bezug'),
];

describe('the tasks about one thing', () => {
  it('finds the open ones naming it', () => {
    expect(tasksAbout(TASKS, 'PMQ Reconstitution').map((task) => task.text)).toEqual([
      'Simulator-Update testen [[PMQ Reconstitution]]',
      'Kunden zurückrufen [[PMQ Reconstitution]]',
    ]);
  });

  it('leaves out the ones already done', () => {
    // The question is what is left, not what happened.
    expect(tasksAbout(TASKS, 'PMQ Reconstitution')).toHaveLength(2);
  });

  it('matches the title however it was capitalised', () => {
    expect(tasksAbout(TASKS, 'pmq reconstitution')).toHaveLength(2);
    expect(tasksAbout(TASKS, '  PMQ Reconstitution  ')).toHaveLength(2);
  });

  it('finds nothing for a blank title, rather than everything', () => {
    // The fail-safe direction: a project whose title failed to read must not
    // claim every task in the vault. It falls out of the core dropping empty
    // link targets rather than out of a guard here -- see the note in
    // `tasksAbout`, where the guard was removed for being unable to fire.
    expect(tasksAbout(TASKS, '')).toEqual([]);
    expect(tasksAbout(TASKS, '   ')).toEqual([]);
  });

  it('does not match a title that merely contains the name', () => {
    expect(tasksAbout(TASKS, 'PMQ')).toEqual([]);
  });
});

describe('the counts a view shows per row', () => {
  it('agrees with the list, for every title in it', () => {
    // Two implementations of one question, so this is the test that keeps them
    // honest: the badge must never say a number the list cannot produce.
    const counts = openTaskCounts(TASKS);
    for (const title of ['PMQ Reconstitution', 'Alte Dias einscannen', 'Ohne Bezug']) {
      expect(counts.get(title.toLowerCase()) ?? 0).toBe(tasksAbout(TASKS, title).length);
    }
  });

  it('counts a task naming the same note twice only once', () => {
    // One task about one thing, however many times the line mentions it.
    const twice = [parse('- [ ] x [[Job]] und nochmal [[Job]]')];
    expect(openTaskCounts(twice).get('job')).toBe(1);
  });

  it('counts a task under each different note it names', () => {
    const both = [parse('- [ ] x [[Job A]] [[Job B]]')];
    const counts = openTaskCounts(both);
    expect(counts.get('job a')).toBe(1);
    expect(counts.get('job b')).toBe(1);
  });

  it('knows nothing about a title with no open tasks', () => {
    expect(openTaskCounts(TASKS).get('ohne bezug')).toBeUndefined();
  });
});
