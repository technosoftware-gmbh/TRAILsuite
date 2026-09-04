/**
 * `created` is stamped once and never rewritten.
 *
 * The rule is old and the reason is in `shared/note-stamps.ts`; this suite is
 * here because a form nearly broke it twice in one week. First the edit dialogs
 * grew an "Erstellt am" box that was never filled -- it came up empty on every
 * project, which read as the date having been lost. It had not been: nothing on
 * the edit path writes the property, so the empty box was a lie the save did
 * not tell.
 *
 * The fix was to fill the box and disable it. That only holds while the write
 * stays as narrow as it is, which is what the first test pins: an edit touches
 * the properties its form shows and leaves `created` exactly as the note has
 * it, whatever shape the note wrote it in.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('obsidian', () => ({ TFile: class {}, stringifyYaml: () => '' }));

const { writeGoalEdits, writeProjectEdits } = await import('../src/para/edit-para');
const { DEFAULT_SETTINGS } = await import('../src/settings/defaults');

const file = { path: '3 Projekte/CN-1097838/CN-1097838.md' } as never;

/** A note as Obsidian hands its frontmatter to a processor. */
function noteWith(properties: Record<string, unknown>) {
  const frontmatter = { ...properties };
  const app = {
    fileManager: {
      processFrontMatter: async (_file: unknown, edit: (fm: Record<string, unknown>) => void) => {
        edit(frontmatter);
      },
    },
  } as never;
  return { app, frontmatter };
}

const PROJECT_EDITS = {
  priority: 2,
  image: null,
  done: null,
  closed: null,
  areaTitle: 'Beruf',
  goalTitles: [],
  status: 'ongoing' as const,
  deadline: '2026-09-30',
};

describe('editing a project', () => {
  it('leaves the creation stamp exactly as the note wrote it', async () => {
    const { app, frontmatter } = noteWith({
      type: 'project',
      created: '2026-07-10T09:14',
      status: 'backlog',
    });

    await writeProjectEdits(app, DEFAULT_SETTINGS, file, PROJECT_EDITS);

    expect(frontmatter.created).toBe('2026-07-10T09:14');
  });

  /**
   * The vault holds three older stamp shapes. None of them is rewritten by an
   * edit either -- a note converts when NODAtrail writes the stamp, and an edit
   * never does.
   */
  it('does not convert an older stamp shape', async () => {
    const { app, frontmatter } = noteWith({ created: '2026-07-25 - 04:50 pm' });

    await writeProjectEdits(app, DEFAULT_SETTINGS, file, PROJECT_EDITS);

    expect(frontmatter.created).toBe('2026-07-25 - 04:50 pm');
  });

  it('writes the properties the form does show', async () => {
    const { app, frontmatter } = noteWith({ created: '2026-07-10T09:14' });

    await writeProjectEdits(app, DEFAULT_SETTINGS, file, PROJECT_EDITS);

    expect(frontmatter[DEFAULT_SETTINGS.projectStatusProperty]).toBe('ongoing');
    expect(frontmatter[DEFAULT_SETTINGS.deadlineProperty]).toBe('2026-09-30');
  });
});

describe('editing a goal', () => {
  it('leaves the creation stamp alone as well', async () => {
    const { app, frontmatter } = noteWith({ created: '2026-01-02T08:00' });

    await writeGoalEdits(app, DEFAULT_SETTINGS, file, {
      priority: null,
      image: null,
      done: null,
      closed: null,
      areaTitle: null,
      status: 'ongoing',
      deadline: null,
    });

    expect(frontmatter.created).toBe('2026-01-02T08:00');
  });
});

/** The edit forms, class by class. */
function editForms(): { name: string; body: string }[] {
  const source = readFileSync(
    join(__dirname, '..', 'src', 'ui', 'modals', 'edit-para-modals.ts'),
    'utf8'
  );
  return source
    .split(/^export class /m)
    .slice(1)
    .map((chunk) => ({ name: /^(\w+)/.exec(chunk)?.[1] ?? '', body: chunk }));
}

describe('a form that shows a date it will not write', () => {
  it('is the goal and project edit forms', () => {
    const shown = editForms()
      .filter((form) => /createdIsEditable\(\): boolean \{\s*return false;/.test(form.body))
      .map((form) => form.name);

    expect(shown).toEqual(['EditGoalModal', 'EditProjectModal']);
  });

  /**
   * The bug this is really about. A disabled box that nothing fills is worse
   * than no box: it says the note has no creation date.
   */
  it('fills it', () => {
    const empty = editForms()
      .filter((form) => /createdIsEditable\(\): boolean \{\s*return false;/.test(form.body))
      .filter((form) => !form.body.includes('this.createdOn = '))
      .map((form) => form.name);

    expect(empty).toEqual([]);
  });
});
