/**
 * Every edit dialog can be opened from somewhere.
 *
 * The bug this exists for: `EditAreaModal`, `EditGoalModal` and
 * `EditProjectModal` were written, wired into the view deps object and typed in
 * `view-deps.ts` -- and no view and no command ever called one. Three dialogs
 * that could not be opened, so every property on an area, a goal or a project
 * could only be changed in Obsidian's own property editor.
 *
 * Nothing failed. Nothing warned. The types were satisfied, because a dep that
 * is never called is still a dep that exists. That is what makes this worth a
 * test rather than a fix: **the compiler cannot see the difference between a
 * seam and a dead end.**
 *
 * The rule: a dep whose name begins `openEdit` or `openNew` has to be called
 * from a view, not merely defined.
 *
 * It found a fourth on its first run. `openNewResource` was declared and
 * handed to every view and called by none -- creating a resource has its own
 * command, so the feature worked and the seam was dead weight. It is gone,
 * which is the other way to satisfy this test and the right one when nothing
 * wants the seam.
 *
 * The second half of the file is the same kind of gap one step further in. A
 * form with a field read out of a note's body has to be opened through
 * `openLoaded()`; opened with plain `open()` it compiles, it draws, and its
 * summary box comes up empty -- and saving then writes that emptiness over the
 * text. Nothing would fail. The note would just quietly lose its summary.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** The opener deps a view may use, as `view-deps.ts` declares them. */
function declaredOpeners(): string[] {
  const source = readFileSync(join(SRC, 'ui', 'kit', 'view-deps.ts'), 'utf8');
  return [...source.matchAll(/^\s*(open(?:Edit|New)[A-Za-z]*)[?]?:/gm)].map((m) => m[1]);
}

/** Every `this.deps.<name>(` and `deps.<name>(` call anywhere in the source. */
function calledOpeners(): Set<string> {
  const called = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    if (file.endsWith(join('ui', 'kit', 'view-deps.ts'))) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bdeps\.(open[A-Za-z]*)\s*\(/g)) called.add(match[1]);
  }
  return called;
}

describe('the openers a view is given', () => {
  it('are all actually called by something', () => {
    const called = calledOpeners();
    const orphans = declaredOpeners().filter((name) => !called.has(name));
    expect(orphans).toEqual([]);
  });

  it('includes the three that were dead, so this test is about them', () => {
    // If these ever left `view-deps.ts`, the test above would pass by having
    // nothing to check.
    const declared = declaredOpeners();
    expect(declared).toContain('openEditArea');
    expect(declared).toContain('openEditGoal');
    expect(declared).toContain('openEditProject');
  });

  it('finds the calls in the PARA view, which is where they belong', () => {
    const view = readFileSync(join(SRC, 'ui', 'views', 'para-view.ts'), 'utf8');
    expect(view).toContain('this.deps.openEditArea(');
    expect(view).toContain('this.deps.openEditGoal(');
    expect(view).toContain('this.deps.openEditProject(');
  });
});

/** The classes that read part of themselves out of a note before they are drawn. */
function formsThatLoad(): string[] {
  const names: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (!/protected override async load\(/.test(line)) return;
      const opener = lines
        .slice(0, index)
        .reverse()
        .find((earlier) => /^export class /.test(earlier));
      const name = /^export class (\w+)/.exec(opener ?? '')?.[1];
      if (name) names.push(name);
    });
  }
  return names;
}

/**
 * Every `new Name(...)` in the source, with whatever is chained onto it.
 *
 * The construction is taken to the end of the line its closing bracket sits on,
 * rather than to the next `;`. These are entries in an object literal and end
 * in a comma, so reading to the semicolon swept in the two openers below and
 * every one of them looked like it called `openLoaded`. The first version of
 * this test passed against a deliberately broken `main.ts` for exactly that
 * reason.
 */
function constructions(name: string): string[] {
  const statements: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(new RegExp(`new ${name}\\(`, 'g'))) {
      const open = source.indexOf('(', match.index);
      let depth = 0;
      let close = open;
      for (; close < source.length; close++) {
        if (source[close] === '(') depth++;
        if (source[close] === ')' && --depth === 0) break;
      }
      const end = source.indexOf('\n', close);
      statements.push(source.slice(match.index, end === -1 ? undefined : end));
    }
  }
  return statements;
}

describe('a form that reads a field out of a note', () => {
  /**
   * Listed rather than counted, so a new form that reads from a note has to be
   * added here deliberately. That is the point: the check below is only worth
   * anything while somebody notices a fourth arriving, and `CloseTaskModal` is
   * exactly that -- it loads a task's existing comment, and opened with plain
   * `open()` its box would come up empty and saving would write the emptiness
   * over what was there.
   */
  it('is the forms this test is about', () => {
    expect(formsThatLoad().sort()).toEqual([
      'CloseTaskModal',
      'EditAreaModal',
      'EditGoalModal',
      'EditProjectModal',
    ]);
  });

  it('is never opened with plain open()', () => {
    const plain = formsThatLoad().flatMap((name) =>
      constructions(name)
        .filter((statement) => !statement.includes('.openLoaded('))
        .map((statement) => `${name}: ${statement.split('\n')[0]}`)
    );

    expect(plain).toEqual([]);
  });

  it('is constructed somewhere, so there is something to check', () => {
    for (const name of formsThatLoad()) expect(constructions(name).length).toBeGreaterThan(0);
  });
});
