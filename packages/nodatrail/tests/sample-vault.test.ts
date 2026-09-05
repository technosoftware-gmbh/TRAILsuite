/**
 * The sample notes, written into a vault and read back by the real readers.
 *
 * This package had no `tests/sample-vault.test.ts` before this one, so nothing
 * was replaced.
 *
 * **Nothing below compares note text to a string it expects.** A hand-authored
 * note whose heading, marker or wikilink is subtly wrong looks perfectly
 * ordinary in Markdown and renders as an empty view, which is the whole failure
 * this suite exists for. So every claim goes through the reader that will read
 * the note in production: `readParaBoard`, `readSchedule`, `readTasks`,
 * `readFinanceBoard`, `readLedger`, `readBudgets`, `measureMonth`,
 * `readCrmBoard`, and trail-core's own `readSummary` and `readSplit`. The
 * exceptions are deliberate and are about the file rather than about its
 * meaning: whether a fence is present, and whether every wikilink in the set
 * names a note the set contains.
 *
 * ## The harness is a real YAML round trip, and that is the point
 *
 * Every note is serialised by a real YAML writer standing in for Obsidian's and
 * parsed back by a real YAML reader, so what a reader sees here is what Obsidian
 * would hand it rather than the object the seeder built. A stub that handed the
 * frontmatter object straight back would see none of the difference.
 *
 * ## The clock
 *
 * Every date in this set is relative to `now`, so the suite runs the whole thing
 * against several clocks rather than one: a Thursday in the middle of a month,
 * the first of a month (where every posting is floored onto day one), and a
 * Sunday (where the working week has to be the week that just ran rather than
 * the one starting tomorrow). Each of those broke something while this was being
 * written.
 */
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

/**
 * The `obsidian` module this suite runs against.
 *
 * `stringifyYaml` is a real YAML writer standing in for the host's. `TFile` and
 * `TFolder` are real classes because `read-folders.ts` tells a folder from a
 * note with `instanceof`, and a test that could not make an object pass that
 * check would be testing the empty branch. The factory is hoisted above every
 * import in this file, so everything it needs is built inside it.
 */
vi.mock('obsidian', async () => {
  const { stringify } = await import('yaml');

  class TFolder {
    path = '';
    name = '';
    children: unknown[] = [];
  }

  class TFile {
    path = '';
    basename = '';
    name = '';
    extension = 'md';
    parent: { path: string } | null = null;
  }

  return {
    normalizePath: (path: string) => path.split('/').filter(Boolean).join('/'),
    stringifyYaml: (value: Record<string, unknown>) =>
      stringify(value, { defaultKeyType: 'PLAIN', lineWidth: 0 }),
    TFile,
    TFolder,
    Notice: class {},
    Modal: class {},
    Setting: class {},
  };
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App, stringifyYaml, TFile, TFolder } from 'obsidian';
import {
  planSampleVault,
  readSplit,
  readSummary,
  sampleFolders,
  sampleVaultWritable,
  sampleWriteCount,
  splitFrontmatterBlock,
  startOfPeriod,
  type SampleNote,
} from '@technosoftware/trail-core';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { mergeSettings } from '../src/settings/validate';
import { FOREIGN_TITLES, sampleNotes } from '../src/sample/notes';
import { carriesBlock, sampleFolderContents } from '../src/sample/read-folders';
import { SampleVaultRefusedError, writeSampleVault } from '../src/sample/write';
import { NOD_SPENDING_BLOCK_LANG } from '../src/crm/spending-block-lang';
import { readParaBoard } from '../src/para/read-para';
import { projectAreaTitle } from '../src/para/board';
import { readSchedule } from '../src/plan/read-schedule';
import { headingsFor } from '../src/plan/add-to-day';
import { noteTitleFor, notePathFor } from '../src/plan/paths';
import { readTasks } from '../src/tasks/read-tasks';
import { readFinanceBoard } from '../src/finance/read-finance';
import { readBudgets, readLedger } from '../src/ledger/read-ledger';
import { measureMonth } from '../src/ledger/budget-month';
import { readCrmBoard } from '../src/crm/read-crm-board';

const settings = DEFAULT_SETTINGS;

/** A Thursday in the middle of a month, so nothing depends on how a week or a month falls. */
const NOW = new Date(2026, 8, 17, 9, 0);

// ---------------------------------------------------------------------------
// The fake vault
// ---------------------------------------------------------------------------

interface FakeVault {
  app: App;
  /** Every note in the vault, by path. */
  files: Map<string, string>;
}

/**
 * A vault that stores note text and parses frontmatter out of it on demand.
 *
 * Storing text rather than a frontmatter object is what makes this a round trip:
 * everything a reader sees has been through a writer and back through a parser,
 * so a value whose YAML form does not survive the trip arrives at the reader the
 * way a vault would give it rather than the way the seeder built it.
 */
function makeVault(initial: { path: string; text: string }[] = []): FakeVault {
  const files = new Map<string, string>(initial.map((note) => [note.path, note.text]));
  const folders = new Set<string>();

  const register = (path: string): void => {
    const cut = path.lastIndexOf('/');
    let folder = cut === -1 ? '' : path.slice(0, cut);
    while (folder) {
      folders.add(folder);
      const up = folder.lastIndexOf('/');
      folder = up === -1 ? '' : folder.slice(0, up);
    }
  };
  for (const path of files.keys()) register(path);

  const fileFor = (path: string): TFile => {
    const file = new TFile();
    const cut = path.lastIndexOf('/');
    file.path = path;
    file.name = path.slice(cut + 1);
    file.basename = file.name.replace(/\.md$/, '');
    file.extension = 'md';
    // Only the path, which is the one member of a parent anything here reads.
    // Cast because the real `TFolder` declares six more that a fake vault has no
    // way to supply and nothing under test asks for.
    file.parent = { path: cut === -1 ? '' : path.slice(0, cut) } as TFolder;
    return file;
  };

  const frontmatterOf = (path: string): Record<string, unknown> => {
    const header = splitFrontmatterBlock(files.get(path) ?? '').header;
    if (!header) return {};
    const parsed: unknown = parseYaml(header.replace(/^---\n/, '').replace(/---\n$/, ''));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  };

  const folderFor = (path: string): TFolder | null => {
    if (!folders.has(path)) return null;
    const folder = new TFolder();
    folder.path = path;
    folder.name = path.slice(path.lastIndexOf('/') + 1);
    folder.children = [...files.keys()]
      .filter((notePath) => notePath.slice(0, notePath.lastIndexOf('/')) === path)
      .map(fileFor);
    return folder;
  };

  const app = {
    vault: {
      getMarkdownFiles: () => [...files.keys()].map(fileFor),
      getFileByPath: (path: string) => (files.has(path) ? fileFor(path) : null),
      getAbstractFileByPath: (path: string) => (files.has(path) ? fileFor(path) : folderFor(path)),
      getFolderByPath: folderFor,
      // Intermediate levels included: the core's `createNote` asks for the note's
      // own folder and nothing above it, and every money and plan folder in this
      // set is nested two or three deep.
      createFolder: (path: string) => {
        register(`${path}/x`);
        folders.add(path);
        return Promise.resolve();
      },
      create: (path: string, content: string) => {
        files.set(path, content);
        register(path);
        return Promise.resolve(fileFor(path));
      },
      read: (file: TFile) => Promise.resolve(files.get(file.path) ?? ''),
      cachedRead: (file: TFile) => Promise.resolve(files.get(file.path) ?? ''),
      append: (file: TFile, content: string) => {
        files.set(file.path, (files.get(file.path) ?? '') + content);
        return Promise.resolve();
      },
      modify: (file: TFile, content: string) => {
        files.set(file.path, content);
        return Promise.resolve();
      },
      process: (file: TFile, edit: (markdown: string) => string) => {
        files.set(file.path, edit(files.get(file.path) ?? ''));
        return Promise.resolve('');
      },
    },
    metadataCache: {
      getFileCache: (file: TFile) => ({ frontmatter: frontmatterOf(file.path) }),
    },
    fileManager: {
      processFrontMatter: (file: TFile, edit: (fm: Record<string, unknown>) => void) => {
        const text = files.get(file.path) ?? '';
        const { body } = splitFrontmatterBlock(text);
        const front = frontmatterOf(file.path);
        edit(front);
        // The host's own writer, exactly as Obsidian's `processFrontMatter`
        // re-serialises with the same one it wrote the note with.
        files.set(file.path, `---\n${stringifyYaml(front).trimEnd()}\n---\n${body}`);
        return Promise.resolve();
      },
    },
  } as unknown as App;

  return { app, files };
}

/** Seeds a fresh vault the way the command does: plan against what is there, then write. */
async function seed(
  now: Date = NOW,
  existing: { path: string; text: string }[] = []
): Promise<{ vault: FakeVault; notes: SampleNote[] }> {
  const vault = makeVault(existing);
  const notes = sampleNotes(settings, now);
  const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));
  await writeSampleVault(vault.app, settings, plan, now);
  return { vault, notes };
}

/** Every wikilink in a note's frontmatter and body alike. A link inside a property is still a link. */
function linksIn(note: SampleNote): string[] {
  const written = JSON.stringify(note.properties) + note.body;
  return [...written.matchAll(/\[\[([^\]|#]+)/g)].map((match) => (match[1] ?? '').trim());
}

// ---------------------------------------------------------------------------

describe('the sample notes', () => {
  const notes = sampleNotes(settings, NOW);

  it('is twenty-three notes, in the folders the default settings name', () => {
    expect(notes).toHaveLength(23);
    expect(sampleFolders(notes)).toEqual([
      '1 Areas',
      '2 Goals',
      // A project is a folder of its own, named after it: see project-folder.ts.
      '3 Projects/Move the household to double entry',
      '4 Resources',
      '0 Plan/1 Daily/2026',
      '0 Plan/3 Monthly/2026',
      'Finance/Purchases/2026/09',
      'Finance/Bills/2026/09',
      'Finance/Recurring/2026',
      'Finance/Budgets/2026',
      'Finance/Accounts',
      'Finance/Journal/2026',
      'CRM/People',
    ]);
  });

  it('writes no Company note, which is what lets a sibling be seeded beside it', () => {
    // The refusal rule is per target folder, so claiming `CRM/Companies` would
    // refuse the whole run in any vault where APERtrail or CULItrail had
    // already seeded their own company there -- and would make them refuse in a
    // vault seeded by this one. Not claiming it is the interoperability.
    expect(sampleFolders(notes)).not.toContain(settings.companiesFolder);
  });

  it('gives every note a folder and a type value, so none of them is invisible to its own reader', () => {
    for (const note of notes) {
      expect(note.folder.trim(), note.title).not.toBe('');
      expect(note.typeValue.trim(), note.title).not.toBe('');
    }
  });

  it('resolves every wikilink except the two that are meant to reach another plugin', () => {
    const titles = new Set(notes.map((note) => note.title));
    const targets = new Set(notes.flatMap(linksIn));

    expect(targets.size).toBeGreaterThanOrEqual(6);
    // Asserted as a named set rather than by exempting whatever fails to
    // resolve, which would pass just as happily for a link that dangles by
    // mistake.
    expect([...targets].filter((target) => !titles.has(target)).sort()).toEqual(
      [...FOREIGN_TITLES].sort()
    );
  });

  it('links each of the two foreign titles from the note the brief puts it in', () => {
    const from = (title: string): string[] =>
      notes.filter((note) => linksIn(note).includes(title)).map((note) => note.typeValue);

    // A day note's schedule, which is where a meal belongs.
    expect(from('Tom Yum Gai')).toEqual([settings.dayTypeValue]);
    // The journal, and only the journal: a trip's money crosses into the ledger
    // through a posting rather than through a property on a money note.
    expect(from('Rovos Rail 2026')).toEqual([settings.journalTypeValue]);
  });

  it('states no derived value: no project area, and nothing dated the plugin computes', () => {
    const project = notes.find((note) => note.typeValue === settings.projectTypeValue);
    // The project derives its area through its goal. Writing one as well would
    // be the second source of truth the data model is most emphatic about.
    expect(project?.properties[settings.projectAreaProperty]).toBeUndefined();

    // A bill's status is derived from its dates; only `cancelled` is stored.
    const bill = notes.find((note) => note.typeValue === settings.billTypeValue);
    expect(bill?.properties[settings.billStatusProperty]).toBeUndefined();
  });
});

describe('the seeded vault, read back', () => {
  it('reads as one area, one goal, one project and one resource', async () => {
    const { vault } = await seed();
    const board = readParaBoard(vault.app, settings);

    expect(board.areas.map((entry) => entry.title)).toEqual(['Household']);
    expect(board.goals.map((entry) => entry.title)).toEqual(['Close the books every month']);
    expect(board.projects.map((entry) => entry.title)).toEqual([
      'Move the household to double entry',
    ]);
    expect(board.resources.map((entry) => entry.title)).toEqual(['Double entry in one page']);
  });

  it('links the PARA notes the way the data model says, and derives the area it does not state', async () => {
    const { vault } = await seed();
    const board = readParaBoard(vault.app, settings);

    expect(board.goals[0]?.note.areaTitle).toBe('Household');
    expect(board.goals[0]?.note.status).toBe('ongoing');
    expect(board.projects[0]?.note.goalTitles).toEqual(['Close the books every month']);
    expect(board.resources[0]?.note.areaTitle).toBe('Household');
    expect(board.resources[0]?.note.tags).toEqual(['finance', 'reference']);

    // Stated nowhere, and answered anyway: project -> goal -> area.
    expect(board.projects[0]?.note.areaTitle).toBeNull();
    const derived = board.projects[0] ? projectAreaTitle(board.projects[0], board.goals) : null;
    expect(derived).toBe('Household');
  });

  it('opens each PARA note with a summary the core can read back out of the body', async () => {
    const { vault, notes } = await seed();
    const para = new Set([
      settings.areaTypeValue,
      settings.goalTypeValue,
      settings.projectTypeValue,
      settings.resourceTypeValue,
    ]);

    for (const note of notes.filter((entry) => para.has(entry.typeValue))) {
      const text = vault.files.get(`${note.folder}/${note.title}.md`) ?? '';
      // Read through the core's own finder, which is what the form and the
      // exporters use: a callout keyword that is not `SUMMARY`, or a rule in
      // the wrong place, renders identically and reads as nothing.
      expect(readSummary(splitFrontmatterBlock(text).body).length, note.title).toBeGreaterThan(20);
    }
  });

  it('reads a schedule out of every day note, with all four attendance markers among them', async () => {
    const { vault } = await seed();
    const monday = startOfPeriod('week', NOW);
    const headings = headingsFor(settings, 'meeting');

    const attendance: string[] = [];
    for (let offset = 0; offset < 5; offset += 1) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
      const file = vault.app.vault.getFileByPath(notePathFor(settings, 'day', date));
      expect(file, noteTitleFor(settings, 'day', date)).not.toBeNull();

      const entries = await readSchedule(vault.app, settings, file, headings);
      expect(entries.length, noteTitleFor(settings, 'day', date)).toBeGreaterThan(0);

      // A line the parser cannot make sense of is skipped rather than guessed
      // at, so an entry that came back with no text at all is one that half
      // read.
      for (const entry of entries) expect(entry.text, entry.text).not.toBe('');

      // The meetings are the timed ones. The `📝` lines under a meeting come
      // back as entries too, with no time and no attendance, because they are
      // bullets under the schedule heading and that is what the reader is: the
      // view shows them under the meeting they were captured with.
      const timed = entries.filter((entry) => entry.from !== '');
      expect(timed.length, noteTitleFor(settings, 'day', date)).toBeGreaterThan(0);
      for (const entry of timed) {
        expect(entry.from, entry.text).toMatch(/^\d{2}:\d{2}$/);
        expect(entry.to, entry.text).toMatch(/^\d{2}:\d{2}$/);
        attendance.push(entry.attendance);
      }
    }

    // The four markers are settings, and this is the only place a new user sees
    // what each of them looks like.
    expect(new Set(attendance)).toEqual(new Set(['', 'tentative', 'unanswered', 'declined']));
  });

  it('puts the meal link in a schedule entry the parser hands back as a link', async () => {
    const { vault } = await seed();
    const monday = startOfPeriod('week', NOW);
    const wednesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
    const file = vault.app.vault.getFileByPath(notePathFor(settings, 'day', wednesday));

    const entries = await readSchedule(vault.app, settings, file, headingsFor(settings, 'meeting'));
    const dinner = entries.find((entry) => entry.links.includes('Tom Yum Gai'));

    // The link has to survive the reader, not merely be in the file: the marker,
    // the span and the brackets are all stripped on the way, and a line the
    // parser rejected would leave the meal invisible in the day view.
    expect(dinner).toBeDefined();
    expect(dinner?.text).toBe('Dinner at home');
    expect(dinner?.from).toBe('19:00');
    expect(dinner?.to).toBe('20:00');
  });

  it('gives every task it writes a date, so none of them falls in no period at all', async () => {
    const { vault } = await seed();
    const tasks = await readTasks(vault.app, settings);

    // The follow-ups under the meetings are among these: they are checkboxes
    // and `readTasks` finds them, which is why `read-schedule` refuses to read
    // one as a meeting.
    expect(tasks.length).toBeGreaterThanOrEqual(6);
    for (const task of tasks) {
      expect(task.due ?? task.scheduled, task.text).not.toBeNull();
    }

    // The high-priority one, which is what the plan view's urgency sort needs
    // something to sort.
    expect(tasks.some((task) => task.priority !== null)).toBe(true);
  });

  it('reads the four money notes, with the bill still outstanding', async () => {
    const { vault } = await seed();
    const board = readFinanceBoard(vault.app, settings);

    expect(board.purchases).toHaveLength(1);
    expect(board.bills).toHaveLength(1);
    expect(board.recurring).toHaveLength(1);

    const purchase = board.purchases[0];
    expect(purchase?.areaTitle).toBe('Household');
    expect(purchase?.status).toBe('delivered');
    expect(purchase?.items.map((item) => item.name)).toEqual(['Camera bag', 'Memory card, 128 GB']);
    // The stated total and the lines agree, so the health check has nothing to
    // report about the first note anybody opens.
    const computed = purchase?.items.reduce(
      (sum, item) => sum + (item.price ?? 0) * item.quantity,
      0
    );
    expect(computed).toBe(purchase?.amount);

    const bill = board.bills[0];
    expect(bill?.paidDate).toBeNull();
    expect(bill?.account).toBe(4001);
    expect(bill?.direction).toBe('incoming');

    const recurring = board.recurring[0];
    expect(recurring?.cadence).toBe('annual');
    expect(recurring?.status).toBe('active');
    expect(recurring?.account).toBe(4005);
  });

  it('reads one budget for this year, keyed to accounts the chart holds', async () => {
    const { vault } = await seed();
    const budgets = readBudgets(vault.app, settings);
    const ledger = await readLedger(vault.app, settings);

    expect(budgets).toHaveLength(1);
    expect(budgets[0]?.period).toBe('2026');
    expect(budgets[0]?.lines).toHaveLength(3);

    // A line naming an account nothing claims is the row a budget page reports
    // as unbudgeted spending in reverse: planned against nothing measurable.
    for (const line of budgets[0]?.lines ?? []) {
      expect(ledger.byNumber.has(line.account), String(line.account)).toBe(true);
    }
  });

  it('measures the month somebody seeded, planned against actual', async () => {
    const { vault } = await seed();
    const measured = await measureMonth(vault.app, settings, NOW);

    expect(measured).not.toBeNull();
    expect(measured?.measure.plannedTotal).toBeGreaterThan(0);
    expect(measured?.measure.actualTotal).toBeGreaterThan(0);
    // Nothing is unbudgeted: every expense account these postings touch has a
    // line, which is the state a budget page reads as complete.
    expect(measured?.measure.unbudgeted).toEqual([]);
  });

  it('reads six accounts and a journal that parses without a single problem', async () => {
    const { vault } = await seed();
    const ledger = await readLedger(vault.app, settings);

    expect(ledger.accounts.map((account) => account.number)).toEqual([
      1011, 2010, 3010, 4001, 4005, 4007,
    ]);
    expect(ledger.journals).toHaveLength(1);
    expect(ledger.journals[0]?.title).toBe('2026-09');

    // Nothing in the parser throws, so every failure comes back as data. All
    // four of these being empty is the claim.
    expect(ledger.problems).toEqual([]);
    expect(ledger.unknown).toEqual([]);
    expect(ledger.mismatches).toEqual([]);
    expect(ledger.selfPostings).toEqual([]);
  });

  it('balances: every franc debited is a franc credited', async () => {
    const { vault } = await seed();
    const ledger = await readLedger(vault.app, settings);

    // Six postings: five entries, one of which is a split of two legs.
    expect(ledger.postings).toHaveLength(6);

    const debited = ledger.postings
      .filter((posting) => posting.debit !== null)
      .reduce((sum, posting) => sum + posting.amount, 0);
    const credited = ledger.postings
      .filter((posting) => posting.credit !== null)
      .reduce((sum, posting) => sum + posting.amount, 0);

    expect(debited).toBeCloseTo(credited, 2);
    expect(debited).toBeCloseTo(9478.45, 2);
    for (const posting of ledger.postings) {
      expect(posting.debit, posting.text).not.toBeNull();
      expect(posting.credit, posting.text).not.toBeNull();
    }
  });

  it('writes a split the parser expands and the reader recovers as one entry', async () => {
    const { vault } = await seed();
    const ledger = await readLedger(vault.app, settings);

    // `splitOf` carries the header's description, which is how a leg says it was
    // written as part of something bigger.
    const legs = ledger.postings.filter((posting) => posting.splitOf !== null);
    expect(legs).toHaveLength(2);

    const split = readSplit(legs);
    expect(split).not.toBeNull();
    // The side the legs filled comes back blank, which is the shape the header
    // was written in and the thing the expansion loses.
    expect(split?.debit).toBeNull();
    expect(split?.credit).toBe(1011);
    expect(split?.legs.map((leg) => leg.account)).toEqual([4007, 4005]);
    // The legs sum to the header, which is the one thing a split can get wrong
    // and be dropped for.
    expect(split?.amount).toBeCloseTo(1560, 2);
  });

  it('carries the trip into the ledger through the text of two postings and nothing else', async () => {
    const { vault } = await seed();
    const ledger = await readLedger(vault.app, settings);

    const naming = ledger.postings.filter((posting) =>
      `${posting.text} ${posting.splitOf ?? ''}`.includes('[[Rovos Rail 2026]]')
    );
    // Two, because the split's legs each inherit the header's description.
    expect(naming.length).toBeGreaterThanOrEqual(2);
    // No plugin was called and no type was shared: the whole crossing is a
    // wikilink in a line of text on disk.
    expect(naming.every((posting) => posting.currency === settings.homeCurrency)).toBe(true);
  });

  it('fills the sixth column, so a posting names the purchase it settles', async () => {
    const { vault } = await seed();
    const ledger = await readLedger(vault.app, settings);
    const board = readFinanceBoard(vault.app, settings);

    const referenced = ledger.postings.filter((posting) => posting.reference);
    expect(referenced).toHaveLength(1);
    expect(referenced[0]?.reference).toBe(board.purchases[0]?.title);
  });

  it('reads the two people on the shared CRM terms, and no company', async () => {
    const { vault } = await seed();
    const board = readCrmBoard(vault.app, settings);

    expect(board.persons.map((person) => person.title).sort()).toEqual(['Erika', 'Stefan']);
    expect(board.companies).toEqual([]);

    for (const person of board.persons) {
      expect(person.tags, person.title).toEqual(['Family']);
      expect(person.roles, person.title).toEqual(['traveller', 'eater']);
      expect(person.email, person.title).toBe(`${person.title.toLowerCase()}@example.invalid`);
    }
  });

  it('gives each shared note this plugin block and nothing else in its body', async () => {
    const { vault, notes } = await seed();

    // Named rather than filtered. A loop over "the notes that declare a block"
    // passes happily over an empty list, so dropping the declaration would take
    // the assertion with it -- which is exactly the mutation that has to go red.
    const shared = ['Stefan', 'Erika'].map((title) => {
      const found = notes.find((note) => note.title === title);
      expect(found, title).toBeDefined();
      return found;
    });

    for (const note of shared) {
      expect(note.ensureBlock, note.title).toBe(NOD_SPENDING_BLOCK_LANG);

      const text = vault.files.get(`${note.folder}/${note.title}.md`) ?? '';
      expect(carriesBlock(text, NOD_SPENDING_BLOCK_LANG), note.title).toBe(true);
      // The fence and nothing else: a heading repeating the filename would be a
      // line to scroll past, and prose here would be prose the sibling plugins
      // did not agree to.
      expect(splitFrontmatterBlock(text).body.trim()).toBe(
        `\`\`\`${NOD_SPENDING_BLOCK_LANG}\n\`\`\``
      );
    }
  });

  it('stamps created on every note and modified on none of them', async () => {
    const { vault, notes } = await seed();

    for (const note of notes) {
      const text = vault.files.get(`${note.folder}/${note.title}.md`) ?? '';
      const front = parseYaml(
        splitFrontmatterBlock(text)
          .header.replace(/^---\n/, '')
          .replace(/---\n$/, '')
      ) as Record<string, unknown>;

      expect(front[settings.typePropertyName], note.title).toBe(note.typeValue);
      expect(front[settings.createdProperty], note.title).toBe('2026-09-17T09:00');
      // Two identical stamps say nothing one does not.
      expect(front[settings.modifiedProperty], note.title).toBeUndefined();
    }
  });
});

describe('the same set against other clocks', () => {
  /** Every posting lands on or before the clock, and inside its month. */
  async function postingDays(now: Date): Promise<string[]> {
    const { vault } = await seed(now);
    const ledger = await readLedger(vault.app, settings);
    return ledger.postings.map((posting) => posting.date);
  }

  it('floors the ledger onto the first when the vault is seeded on the first', async () => {
    // The case that would otherwise seed a ledger holding the future: counting
    // fourteen days back from the first of the month lands in the month before,
    // which is the month the budget does not measure.
    const days = await postingDays(new Date(2026, 10, 1, 8, 0));
    expect(new Set(days)).toEqual(new Set(['2026-11-01']));
  });

  it('never dates a posting after the clock, and never outside its own month', async () => {
    for (const now of [
      new Date(2026, 8, 17, 9, 0),
      new Date(2026, 10, 1, 8, 0),
      new Date(2026, 1, 3, 22, 0),
      // A Sunday: the working week has to be the one that just ran rather than
      // the one starting tomorrow, which is what makes it an ISO week.
      new Date(2027, 2, 28, 12, 0),
    ]) {
      const days = await postingDays(now);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const month = today.slice(0, 7);

      for (const day of days) {
        expect(day <= today, `${day} after ${today}`).toBe(true);
        expect(day.startsWith(month), `${day} outside ${month}`).toBe(true);
      }
    }
  });

  it('seeds the working week of the ISO week the clock falls in, Sunday included', async () => {
    // 28 March 2027 is a Sunday. Its ISO week began on the 22nd, so the five
    // notes are the 22nd to the 26th and none of them is next week.
    const now = new Date(2027, 2, 28, 12, 0);
    const notes = sampleNotes(settings, now);
    const days = notes
      .filter((note) => note.typeValue === settings.dayTypeValue)
      .map((note) => note.title);

    expect(days).toEqual(['2027-03-22', '2027-03-23', '2027-03-24', '2027-03-25', '2027-03-26']);
  });

  it('reads a schedule and a balanced journal whatever the clock', async () => {
    // The whole point of the relative dates: the same assertions have to hold on
    // a vault seeded on any day, not only on the one this suite picked.
    for (const now of [new Date(2026, 10, 1, 8, 0), new Date(2027, 2, 28, 12, 0)]) {
      const { vault } = await seed(now);
      const ledger = await readLedger(vault.app, settings);

      expect(ledger.problems, String(now)).toEqual([]);
      expect(ledger.unknown, String(now)).toEqual([]);
      const debited = ledger.postings
        .filter((posting) => posting.debit !== null)
        .reduce((sum, posting) => sum + posting.amount, 0);
      const credited = ledger.postings
        .filter((posting) => posting.credit !== null)
        .reduce((sum, posting) => sum + posting.amount, 0);
      expect(debited, String(now)).toBeCloseTo(credited, 2);

      const monday = startOfPeriod('week', now);
      const file = vault.app.vault.getFileByPath(notePathFor(settings, 'day', monday));
      const entries = await readSchedule(
        vault.app,
        settings,
        file,
        headingsFor(settings, 'meeting')
      );
      expect(entries.length, String(now)).toBeGreaterThan(0);
    }
  });
});

describe('planning a run against a vault that is not empty', () => {
  it('plans nothing the second time, because every note is already there', async () => {
    const { vault, notes } = await seed();

    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));
    expect(plan.notes.every((entry) => entry.status === 'exists')).toBe(true);
    expect(plan.notes.some((entry) => entry.augment)).toBe(false);
    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('refuses the whole run over one note it did not put there, and writes nothing', async () => {
    const stranger = `${settings.areasFolder}/Fotografie.md`;
    const vault = makeVault([{ path: stranger, text: '---\ntype: area\n---\n' }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([{ folder: settings.areasFolder, strangers: ['Fotografie'] }]);
    // An area is not a shared folder, so the note goes in `occupied` and nowhere
    // near `shared`. Two lists, and a folder belongs to exactly one of them.
    expect(plan.shared).toEqual([]);
    expect(sampleVaultWritable(plan)).toBe(false);

    await expect(writeSampleVault(vault.app, settings, plan, NOW)).rejects.toBeInstanceOf(
      SampleVaultRefusedError
    );
    // Not one note, not even from the folders that were clear: half a sample
    // vault is the state the refusal exists to prevent.
    expect(vault.files.size).toBe(1);
  });

  it('writes beside a person it does not seed rather than refusing over one', async () => {
    // The case that broke the two siblings the first time all three were run
    // against one vault, and the reason `shared` exists. `CRM/People` is filled
    // by all three plugins and by whoever keeps contacts here, so a person note
    // this plan has never heard of is somebody's colleague rather than evidence
    // of a vault that must not be seeded.
    const path = `${settings.personsFolder}/Hans Bieri.md`;
    const vault = makeVault([{ path, text: '---\ntype: person\ntags:\n  - Work\n---\n' }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.occupied).toEqual([]);
    expect(plan.shared).toEqual([{ folder: settings.personsFolder, others: ['Hans Bieri'] }]);
    expect(sampleVaultWritable(plan)).toBe(true);

    const result = await writeSampleVault(vault.app, settings, plan, NOW);
    expect(result.created).toBe(23);
    expect(result.failed).toEqual([]);

    // Written beside, and the note that was already there is byte for byte what
    // it was: not skipped as an existing sample note, not augmented, not read.
    expect(vault.files.get(path)).toBe('---\ntype: person\ntags:\n  - Work\n---\n');
    expect(
      readCrmBoard(vault.app, settings)
        .persons.map((person) => person.title)
        .sort()
    ).toEqual(['Erika', 'Hans Bieri', 'Stefan']);
  });

  it('marks the Person notes shared and nothing else, so only that folder writes beside', async () => {
    // Read off the notes rather than off the plan, because this is the flag the
    // rule keys on and setting it anywhere else would quietly turn a folder
    // holding somebody's real work into one this command writes into.
    const notes = sampleNotes(settings, NOW);
    const shared = notes.filter((note) => note.shared);

    expect(shared.map((note) => note.title)).toEqual(['Stefan', 'Erika']);
    expect(new Set(shared.map((note) => note.folder))).toEqual(new Set([settings.personsFolder]));
  });

  it('still refuses when a folder this plan fills entirely holds a stranger, shared folder or not', async () => {
    // Both at once, which is the pair worth pinning: a person nobody named is
    // reported and a journal note nobody named refuses. If the shared rule ever
    // widened past the folders that declare it, this is where it would show.
    const vault = makeVault([
      { path: `${settings.personsFolder}/Hans Bieri.md`, text: '---\ntype: person\n---\n' },
      {
        path: `${settings.journalFolder}/2026/2026-08.md`,
        text: '---\ntype: journal\n---\n',
      },
    ]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    expect(plan.shared).toEqual([{ folder: settings.personsFolder, others: ['Hans Bieri'] }]);
    expect(plan.occupied).toEqual([
      { folder: `${settings.journalFolder}/2026`, strangers: ['2026-08'] },
    ]);
    expect(sampleVaultWritable(plan)).toBe(false);

    await expect(writeSampleVault(vault.app, settings, plan, NOW)).rejects.toBeInstanceOf(
      SampleVaultRefusedError
    );
    expect(vault.files.size).toBe(2);
  });

  it('appends its own block to a person another plugin already wrote, and rewrites nothing else', async () => {
    // What a third plugin seeded into the same vault finds: the shared note is
    // there, on the same terms, carrying a block that is not this one's.
    const path = `${settings.personsFolder}/Stefan.md`;
    const existing =
      '---\ntype: person\ntags:\n  - Family\nroles:\n  - traveller\n  - eater\nemail: stefan@example.invalid\n---\n' +
      '\n```travel-related-trips\n```\n';
    const vault = makeVault([{ path, text: existing }]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    const stefan = plan.notes.find((entry) => entry.note.title === 'Stefan');
    expect(stefan?.status).toBe('exists');
    expect(stefan?.augment).toBe(true);

    const result = await writeSampleVault(vault.app, settings, plan, NOW);
    expect(result.created).toBe(22);
    expect(result.augmented).toBe(1);
    expect(result.failed).toEqual([]);

    const after = vault.files.get(path) ?? '';
    // The other plugin's block survives, this one's is added, and the note is
    // still read as a person by the reader that did not write it.
    expect(carriesBlock(after, 'travel-related-trips')).toBe(true);
    expect(carriesBlock(after, NOD_SPENDING_BLOCK_LANG)).toBe(true);
    expect(
      readCrmBoard(vault.app, settings)
        .persons.map((person) => person.title)
        .sort()
    ).toEqual(['Erika', 'Stefan']);
    // An append is a real edit of somebody else's note, and says so.
    expect(after).toContain(settings.modifiedProperty);
  });

  it('leaves a person who already carries this plugin block completely alone', async () => {
    const path = `${settings.personsFolder}/Erika.md`;
    const vault = makeVault([
      {
        path,
        text: `---\ntype: person\n---\n\n\`\`\`${NOD_SPENDING_BLOCK_LANG}\n\`\`\`\n`,
      },
    ]);
    const notes = sampleNotes(settings, NOW);
    const plan = planSampleVault(notes, await sampleFolderContents(vault.app, notes));

    const erika = plan.notes.find((entry) => entry.note.title === 'Erika');
    expect(erika?.status).toBe('exists');
    expect(erika?.augment).toBe(false);
    expect(sampleWriteCount(plan)).toBe(22);
  });

  it('refuses rather than seeding half a vault when a folder setting is empty', async () => {
    // A blank folder is a setting somebody cleared, and the notes reference each
    // other: a partial seed is a screen full of unresolved wikilinks that reads
    // as a broken plugin.
    const blank = mergeSettings({ accountsFolder: '' });
    const plan = planSampleVault(sampleNotes(blank, NOW), []);

    expect(plan.unconfigured.length).toBeGreaterThan(0);
    expect(sampleVaultWritable(plan)).toBe(false);
  });

  it('follows projectFolderPerNote rather than assuming a project has a folder', async () => {
    const flat = mergeSettings({ projectFolderPerNote: false });
    const project = sampleNotes(flat, NOW).find((note) => note.typeValue === flat.projectTypeValue);
    expect(project?.folder).toBe(flat.projectsFolder);
  });
});

describe('the block detector', () => {
  it('answers about a fence rather than about the word', () => {
    expect(carriesBlock('```nod-spending\n```', 'nod-spending')).toBe(true);
    expect(carriesBlock('~~~nod-spending\n~~~', 'nod-spending')).toBe(true);
    // A note that merely mentions the block, which a note documenting it
    // genuinely does. Appending a second fence would be wrong, and so would
    // claiming it already renders one.
    expect(carriesBlock('Paste a nod-spending block here.', 'nod-spending')).toBe(false);
  });
});

describe('the third cooperation route, which the install order makes visible', () => {
  /**
   * The sibling list, read out of the source rather than imported.
   *
   * `SIBLINGS` is private to `foreign-settings-import.ts` and this suite has no
   * business widening its surface to look at it. A static read is enough for the
   * one claim worth making, which is that both siblings are named: a vault that
   * has told CULItrail where `CRM/People` is should not have to tell this plugin
   * too, and a list naming only one would leave half the vaults in the suite
   * answering that question twice.
   */
  it('adopts the shared settings from both siblings rather than only one', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'settings', 'foreign-settings-import.ts'),
      'utf8'
    );
    const list = /const SIBLINGS = \[([^\]]*)\]/.exec(source)?.[1] ?? '';
    const ids = [...list.matchAll(/'([a-z]+)'/g)].map((match) => match[1]);

    expect(ids).toEqual(['apertrail', 'culitrail']);
  });

  it('reads a file rather than a plugin, which is what makes the route sanctioned', () => {
    // The boundary itself, and the reason this is checked in the sample vault's
    // suite: the install order is what makes the adoption visible, and a version
    // of it that reached for `app.plugins.getPlugin()` would couple three
    // packages that may not depend on each other at all.
    const source = readFileSync(
      join(__dirname, '..', 'src', 'settings', 'foreign-settings-import.ts'),
      'utf8'
    );
    // The comments are stripped first, because that file's own header says in
    // so many words that there is no `getPlugin()` call -- and a scan that read
    // the sentence as the thing it denies would fail on a file that is right.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toContain('data.json');
    expect(code).not.toContain('getPlugin');
  });
});
