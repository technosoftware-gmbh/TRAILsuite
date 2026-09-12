/**
 * Four names, two formats, and the fifth level nobody writes.
 *
 * One vocabulary is the point: a project called "Hoch" and a task called "Hoch"
 * have to mean the same thing, even though one records a number and the other
 * records an emoji the Obsidian Tasks plugin owns.
 *
 * **Reading stays wider than writing.** The task format has five levels and
 * these write four. A line somebody else marked `lowest` still has to answer to
 * something, or a form would show an empty box and erase the marker on the next
 * save -- so it reads as `low`, which is the nearest true thing.
 *
 * **And the numbers start at 1 for a reason.** A note already carrying 5 or
 * more is a note ordered by hand, and it keeps sorting after every named level
 * and keeps working. That is what lets four names arrive without rewriting
 * anybody's notes.
 */
import { describe, expect, it } from 'vitest';
import { TASK_PRIORITIES } from '../src/tasks/types.js';
import {
  PRIORITY_LEVELS,
  priorityLevelOf,
  priorityNumber,
  priorityTask,
  taskPriorityLevel,
} from '../src/priority/priority.js';

describe('the four levels', () => {
  it('run from most important to least', () => {
    expect([...PRIORITY_LEVELS]).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('number 1 to 4, so a hand-ordered note keeps sorting after them', () => {
    expect(PRIORITY_LEVELS.map(priorityNumber)).toEqual([1, 2, 3, 4]);
  });

  it('number in the same order as they are named', () => {
    // A sort by number has to agree with the order the words imply, or
    // "Kritisch" would sort below "Niedrig" and nobody would trust either.
    const numbers = PRIORITY_LEVELS.map(priorityNumber);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });

  it('each map to a task priority the format knows', () => {
    for (const level of PRIORITY_LEVELS) {
      expect(TASK_PRIORITIES).toContain(priorityTask(level));
    }
  });

  it('map to four different ones, so no two levels collide', () => {
    expect(new Set(PRIORITY_LEVELS.map(priorityTask)).size).toBe(PRIORITY_LEVELS.length);
  });
});

describe('reading a number back', () => {
  it('recognises the four it writes', () => {
    for (const level of PRIORITY_LEVELS) {
      expect(priorityLevelOf(priorityNumber(level))).toBe(level);
    }
  });

  it('says nothing for a number outside them', () => {
    // 5..8 is this vault's eight areas, ordered by hand. Claiming one of those
    // was "Niedrig" would be inventing a decision nobody made.
    for (const value of [0, 5, 8, 99]) expect(priorityLevelOf(value)).toBeNull();
    expect(priorityLevelOf(null)).toBeNull();
  });
});

describe('reading a task priority back', () => {
  it('recognises the four it writes', () => {
    for (const level of PRIORITY_LEVELS) {
      expect(taskPriorityLevel(priorityTask(level))).toBe(level);
    }
  });

  it('reads the fifth as the nearest one it has', () => {
    // Written by the Tasks plugin, not by us. An empty box here would erase
    // the marker the next time somebody saved the line.
    expect(taskPriorityLevel('lowest')).toBe('low');
  });

  it('answers for every level the format has, so nothing falls through', () => {
    for (const priority of TASK_PRIORITIES) {
      expect(taskPriorityLevel(priority)).not.toBeNull();
    }
  });

  it('says nothing for a task that states none', () => {
    expect(taskPriorityLevel(null)).toBeNull();
  });
});
