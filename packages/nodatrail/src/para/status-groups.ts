/**
 * The order projects are read in, and which of those groups open by themselves.
 *
 * **Not `PARA_STATUSES` order.** That list is the lifecycle, from backlog to
 * removed, and it is what the dropdown offers. This one is attention order:
 * what is happening now, then what is about to, then what is waiting, and only
 * then the things that are over. Reading a goal should start with the work in
 * flight rather than with the backlog it came out of.
 *
 * **Three groups open and five stay shut.** With a hundred projects a year the
 * finished ones outnumber the live ones within a quarter, so a view that opened
 * everything would bury the fifteen that matter under the eighty that do not.
 * Blocked is shut with them deliberately: a blocked project is not work in
 * progress, and the badge on its shut group is the reminder that it is there.
 *
 * The fold state a reader chooses is theirs and is not persisted. That is the
 * same call the ledger's report groups make: it is a reading posture, not a
 * setting, and a fold that survived a restart would be a view that silently
 * shows a third of the projects.
 *
 * App-free, so the order and the defaults can be checked without a DOM.
 */
import { PARA_STATUSES, type ParaStatus } from './types';

/** Every status, in the order a reader meets them. */
export const STATUS_ORDER: readonly ParaStatus[] = [
  'ongoing',
  'planned',
  'backlog',
  'blocked',
  'done',
  'review',
  'closed',
  'removed',
];

/** The groups that are open until somebody shuts them. */
const OPEN_BY_DEFAULT: ReadonlySet<ParaStatus> = new Set<ParaStatus>([
  'ongoing',
  'planned',
  'backlog',
]);

export function opensByDefault(status: ParaStatus): boolean {
  return OPEN_BY_DEFAULT.has(status);
}

/** One status and the notes in it. */
export interface StatusGroup<T> {
  status: ParaStatus;
  items: T[];
}

/**
 * The notes grouped by status, in reading order, **empty groups left out**.
 *
 * A goal with two projects should show two groups, not eight, so a status
 * nothing is in is not a group at all. The count on a header is therefore
 * always the number of things behind it and never zero, which is what makes a
 * shut group worth having.
 */
export function groupByStatus<T>(
  items: readonly T[],
  statusOf: (item: T) => ParaStatus
): StatusGroup<T>[] {
  const groups = new Map<ParaStatus, T[]>();
  for (const item of items) {
    const status = statusOf(item);
    const existing = groups.get(status);
    if (existing) existing.push(item);
    else groups.set(status, [item]);
  }

  return STATUS_ORDER.flatMap((status) => {
    const found = groups.get(status);
    return found ? [{ status, items: found }] : [];
  });
}

/**
 * Every status is in the order exactly once.
 *
 * Exported so the check can be a test rather than a comment. A status added to
 * `PARA_STATUSES` and forgotten here would put every project in it out of
 * sight, with nothing to say where they went.
 */
export function ordersEveryStatus(): boolean {
  return (
    STATUS_ORDER.length === PARA_STATUSES.length &&
    PARA_STATUSES.every((status) => STATUS_ORDER.includes(status))
  );
}
