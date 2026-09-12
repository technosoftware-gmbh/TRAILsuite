/**
 * The task editor: the write it makes, and the row that opens it.
 *
 * The parsing and the refusal live in the core now -- `tasks/fields.ts` there,
 * with its own suite -- because the inverse of `composeTaskLine` is a statement
 * about a line format rather than about this plugin. What is left here is the
 * two halves that are NODAtrail's own: the writer that puts a rebuilt line back
 * into a note, and the row that offers the action only for a line the form can
 * put back.
 *
 * **`editTaskLine` is the one writer in `write-tasks.ts` that rebuilds a line
 * rather than patching it**, and it is allowed to only because `taskFieldsOf`
 * refused every line it could not reproduce. A row that skipped that check
 * would be offering to edit a recurrence rule it is about to drop.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTaskLine, taskFieldsOf, type LocatedTask } from '@technosoftware/trail-core';

function task(raw: string): LocatedTask {
  const parsed = parseTaskLine(raw);
  if (!parsed) throw new Error(`not a task line: ${raw}`);
  return { ...parsed, line: 0 };
}

describe('the write, and the row that opens it', () => {
  const writes = readFileSync(join(__dirname, '..', 'src', 'tasks', 'write-tasks.ts'), 'utf8');
  const rows = readFileSync(
    join(__dirname, '..', 'src', 'ui', 'views', 'plan-sections.ts'),
    'utf8'
  );

  it('replaces one line and goes through the same guard as every other write', () => {
    // `replacing()` is `replaceTaskLine`, which refuses when the line at that
    // number is not the one the view scanned.
    const fn = writes.slice(writes.indexOf('export async function editTaskLine'));
    expect(fn.slice(0, fn.indexOf('\n}'))).toContain(
      'replacing(task, composeTaskFields(task, fields))'
    );
  });

  it('offers the action only for a line the form can put back', () => {
    expect(rows).toContain('const editable = deps.editTask ? editableTaskFields(task) : null;');
    expect(rows).toContain('if (deps.editTask && editable) {');
  });

  it('agrees with the core about which of somebody real tasks are editable', () => {
    // A cheap end of the same rule, here rather than in the core because these
    // are the lines this plugin actually writes into a day note.
    expect(taskFieldsOf(task('- [ ] Check with PMQ [[CN-1093467]] 📅 2026-09-11'))).not.toBeNull();
    expect(taskFieldsOf(task('- [ ] Müll rausbringen 🔁 every week 📅 2026-09-14'))).toBeNull();
  });
});
