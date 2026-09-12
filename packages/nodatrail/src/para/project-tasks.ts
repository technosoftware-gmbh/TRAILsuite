/**
 * Which open tasks name a project or an area.
 *
 * A task says what it is about by carrying a wikilink, which the core's parser
 * already pulls off the line -- so this is a grouping rather than a new format.
 * Nothing is written and nothing is stored: the answer is recomputed on every
 * render, like every other rollup here.
 *
 * **This is what makes a job note worth keeping.** A job that comes out of a
 * Friday meeting collects tasks from several meetings over several weeks, and
 * without this there is no way to ask what is still open for it -- the tasks
 * are scattered across as many day notes as there were meetings.
 *
 * Matched on the link target, case-insensitively and with any heading or block
 * anchor already stripped by the parser. A link is a note title, and a title is
 * how everything else in this suite identifies a note.
 */
import { isOpen, type ParsedTask } from '@technosoftware/trail-core';

/** Open tasks naming this title. */
export function tasksAbout<T extends ParsedTask>(tasks: readonly T[], title: string): T[] {
  const wanted = title.trim().toLowerCase();
  // No guard on a blank title, and that is deliberate rather than missing. The
  // core drops empty link targets when it parses a line, so no task can carry
  // one, and a blank title therefore matches nothing on its own -- which is the
  // fail-safe direction and the answer a guard would have produced. Removing
  // the guard broke no test, which is how it was found: correct code standing
  // somewhere it could never run is the shape this repository keeps meeting.
  return tasks.filter(
    (task) => isOpen(task) && task.links.some((link) => link.trim().toLowerCase() === wanted)
  );
}

/**
 * How many open tasks each title has, for a view that shows a count per row.
 *
 * Built once per render rather than by calling `tasksAbout` per project: a
 * hundred projects over a few hundred tasks is a hundred passes, and the view
 * that wants this draws every project it has.
 */
export function openTaskCounts(tasks: readonly ParsedTask[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!isOpen(task)) continue;
    // A task naming the same note twice counts once: it is one task about one
    // thing, however many times the line mentions it.
    for (const link of new Set(task.links.map((value) => value.trim().toLowerCase()))) {
      if (link) counts.set(link, (counts.get(link) ?? 0) + 1);
    }
  }
  return counts;
}
