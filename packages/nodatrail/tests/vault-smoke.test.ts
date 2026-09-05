/**
 * The parsers, run over a real vault.
 *
 * Unit tests check the shapes this package expects. This checks the shapes a
 * vault actually holds, which is a different question and the one that has
 * caught every reader bug worth catching in this suite. It runs only when
 * `NODATRAIL_VAULT` points at a vault, and skips otherwise, so nobody's clone
 * depends on somebody else's notes.
 *
 *   NODATRAIL_VAULT=/path/to/Vault npm test
 *
 * It reads and asserts. It writes nothing, ever.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { detectPeriodLevel, readStamp, scanTasks } from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';
import type { NODAtrailSettings } from '../src/settings/types';
import { parseArea, parseGoal, parseProject } from '../src/para/parse';
import { commonProperties, goalProperties, projectProperties } from '../src/para/properties';
import { projectAreaTitle, type GoalRecord, type ProjectRecord } from '../src/para/board';

const VAULT = process.env.NODATRAIL_VAULT;
const available = VAULT !== undefined && VAULT !== '' && existsSync(VAULT);

interface Note {
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Every markdown note under a folder, with its frontmatter parsed the way Obsidian would. */
function notesUnder(root: string, folder: string): Note[] {
  // Guarded rather than assumed: `describe.skipIf` still runs its callback to
  // collect the test names, so this is called even when there is no vault.
  if (!root) return [];

  const start = join(root, folder);
  if (!existsSync(start)) return [];

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return entry.endsWith('.md') ? [full] : [];
    });

  return walk(start).map((path) => {
    const text = readFileSync(path, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
    let frontmatter: Record<string, unknown> = {};

    if (match) {
      try {
        const parsed: unknown = parseYaml(match[1] ?? '');
        if (parsed && typeof parsed === 'object') frontmatter = parsed as Record<string, unknown>;
      } catch {
        // A note somebody is midway through editing. Read as body, which is
        // what `splitFrontmatterBlock` does with an unterminated block.
      }
    }

    return {
      path,
      title: (path.split('/').pop() ?? '').replace(/\.md$/, ''),
      frontmatter,
      body: match ? text.slice(match[0].length) : text,
    };
  });
}

/**
 * The settings this vault is configured with, rather than the shipped ones.
 *
 * This is the difference between a suite that reads notes and one that reads
 * nothing. The defaults are English -- `1 Areas`, `2 Goals`, `3 Projects`,
 * `0 Plan` -- and the only vault this has ever been pointed at is German:
 * `1 Bereiche`, `2 Ziele`, `3 Projekte`, `0 Planung`. Every folder resolved to
 * a path that does not exist, `notesUnder` returned `[]` for each, and six of
 * the seven tests below loop over their notes and so passed over nothing. Only
 * the first one, which asserts that something was found at all, said so.
 *
 * Read through `mergeSettings` rather than off the file, because that is what
 * the plugin loads: a partial, older or hand-edited `data.json` then resolves
 * here exactly as it does at runtime, which is the shape this suite exists to
 * test against.
 *
 * A vault with no plugin data falls back to the defaults. That is a fresh
 * install, where the defaults are the truth.
 *
 * The configuration folder is found rather than named. It is `.obsidian` in
 * every vault anybody has made, and it is a setting, so the one place that
 * would break is somebody's renamed one -- and that person is exactly who this
 * suite is for.
 */
function pluginDataPath(root: string): string | null {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name, 'plugins', 'nodatrail', 'data.json');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function settingsFor(root: string): NODAtrailSettings {
  const path = root ? pluginDataPath(root) : null;
  if (!path) return DEFAULT_SETTINGS;
  try {
    return mergeSettings(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    // Obsidian is mid-write, or somebody has been editing it by hand. The
    // defaults are wrong for this vault but they are readable, and the test
    // below reports what it looked in rather than just that it found nothing.
    return DEFAULT_SETTINGS;
  }
}

describe.skipIf(!available)('the real vault', () => {
  const root = VAULT ?? '';
  const S = settingsFor(root);

  const areas = notesUnder(root, S.areasFolder);
  const goals = notesUnder(root, S.goalsFolder);
  const projects = notesUnder(root, S.projectsFolder);
  const plan = notesUnder(root, S.planRootFolder);

  it('finds the PARA notes where this vault says they are', () => {
    // Named folders in the failure message, because the way this fails is that
    // a folder was renamed or a setting points somewhere else, and "expected 0
    // to be greater than 0" does not say which of the four.
    expect(areas.length, S.areasFolder).toBeGreaterThan(0);
    expect(goals.length, S.goalsFolder).toBeGreaterThan(0);
    expect(projects.length, S.projectsFolder).toBeGreaterThan(0);
    expect(plan.length, S.planRootFolder).toBeGreaterThan(0);
  });

  it('reads every area', () => {
    for (const note of areas) {
      const area = parseArea(note.frontmatter, commonProperties(S));
      expect(note.frontmatter[S.typePropertyName]).toBe(S.areaTypeValue);
      expect(area.priority, note.title).not.toBeNull();
    }
  });

  it('reads every goal, and each one names an area that exists', () => {
    const titles = new Set(areas.map((note) => note.title.toLowerCase()));

    for (const note of goals) {
      const goal = parseGoal(note.frontmatter, goalProperties(S));
      expect(goal.areaTitle, note.title).not.toBeNull();
      expect(titles.has(goal.areaTitle?.toLowerCase() ?? ''), note.title).toBe(true);
    }
  });

  it('derives every project area through its goals', () => {
    const goalRecords: GoalRecord[] = goals.map((note) => ({
      file: {},
      title: note.title,
      archived: false,
      note: parseGoal(note.frontmatter, goalProperties(S)),
    }));
    const projectRecords: ProjectRecord[] = projects.map((note) => ({
      file: {},
      title: note.title,
      archived: false,
      note: parseProject(note.frontmatter, projectProperties(S)),
    }));

    for (const project of projectRecords) {
      expect(projectAreaTitle(project, goalRecords), project.title).not.toBeNull();
    }
  });

  it('recognises every plan note title as a period', () => {
    const unrecognised = plan
      .map((note) => note.title)
      .filter((title) => detectPeriodLevel(title) === null);
    expect(unrecognised).toEqual([]);
  });

  it('reads every stamp the vault carries, in whichever shape it carries it', () => {
    const unreadable: string[] = [];

    for (const note of [...areas, ...goals, ...projects, ...plan]) {
      for (const key of [S.createdProperty, S.modifiedProperty]) {
        const value = note.frontmatter[key];
        if (value === undefined || value === null) continue;
        // A frontmatter value is `unknown`, and only a string is worth
        // quoting back: anything else is a shape the reader was never going
        // to accept and stringifies to nothing a reader could act on.
        if (readStamp(value) === null) {
          const shown = typeof value === 'string' ? value : typeof value;
          unreadable.push(`${note.title}: ${key} = ${shown}`);
        }
      }
    }
    expect(unreadable).toEqual([]);
  });

  it('scans every note for tasks without throwing', () => {
    for (const note of [...areas, ...goals, ...projects, ...plan]) {
      expect(() => scanTasks(note.body)).not.toThrow();
    }
  });
});
