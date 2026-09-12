/**
 * The order projects are read in, and which groups open by themselves.
 *
 * Two things worth pinning that a screenshot of one goal would not show.
 *
 * The order is attention order rather than the lifecycle order the dropdown
 * offers, so it has to be stated somewhere that fails when it drifts. And every
 * status has to be in it: one added to `PARA_STATUSES` and forgotten here would
 * put every project in that status out of sight, with nothing on screen to say
 * where they went.
 */
import { describe, expect, it } from 'vitest';
import {
  STATUS_ORDER,
  groupByStatus,
  opensByDefault,
  ordersEveryStatus,
} from '../src/para/status-groups';
import { PARA_STATUSES, type ParaStatus } from '../src/para/types';

const project = (title: string, status: ParaStatus) => ({ title, status });

describe('the reading order', () => {
  it('starts with the work in flight and ends with the work that is over', () => {
    expect([...STATUS_ORDER]).toEqual([
      'ongoing',
      'planned',
      'backlog',
      'blocked',
      'done',
      'review',
      'closed',
      'removed',
    ]);
  });

  it('holds every status exactly once', () => {
    expect(ordersEveryStatus()).toBe(true);
    expect(STATUS_ORDER.length).toBe(new Set(STATUS_ORDER).size);
    expect(STATUS_ORDER.length).toBe(PARA_STATUSES.length);
  });

  it('opens the three that are still to be done and shuts the five that are not', () => {
    expect(STATUS_ORDER.filter(opensByDefault)).toEqual(['ongoing', 'planned', 'backlog']);
    expect(STATUS_ORDER.filter((status) => !opensByDefault(status))).toEqual([
      'blocked',
      'done',
      'review',
      'closed',
      'removed',
    ]);
  });
});

describe('grouping projects', () => {
  it('puts the groups in reading order, whatever order the projects came in', () => {
    const groups = groupByStatus(
      [
        project('a', 'done'),
        project('b', 'backlog'),
        project('c', 'ongoing'),
        project('d', 'planned'),
      ],
      (item) => item.status
    );

    expect(groups.map((group) => group.status)).toEqual(['ongoing', 'planned', 'backlog', 'done']);
  });

  /**
   * The rule that makes a shut group worth having: a header always has
   * something behind it, so its count is never zero.
   */
  it('leaves out a status nothing is in', () => {
    const groups = groupByStatus([project('a', 'ongoing')], (item) => item.status);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.title)).toEqual(['a']);
  });

  it('keeps every project, and each in exactly one group', () => {
    const projects = PARA_STATUSES.map((status) => project(status, status));
    const groups = groupByStatus(projects, (item) => item.status);

    expect(groups.flatMap((group) => group.items)).toHaveLength(projects.length);
    expect(groups).toHaveLength(PARA_STATUSES.length);
  });

  it('reads a legacy status through the same grouping as its modern word', () => {
    // `paused` notes read as `blocked` before they ever reach here, so a
    // project on the old vocabulary lands in the Blockiert group rather than
    // in a group of its own.
    const groups = groupByStatus(
      [project('old', 'blocked'), project('new', 'blocked')],
      (item) => item.status
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('has nothing to group when there are no projects', () => {
    expect(groupByStatus([], (item: { status: ParaStatus }) => item.status)).toEqual([]);
  });
});
