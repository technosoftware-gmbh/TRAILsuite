/**
 * What a link on a day entry is named as, and the three ways it is not.
 *
 * The interesting cases here are all refusals. A chip that names the wrong
 * kind is worse than no chip: it is the view stating, in a word, something the
 * note does not say. So the folder-and-type rule is checked from both sides, a
 * link to a note nobody has written yet is checked to be ordinary rather than
 * an error, and the label is checked to fall back to the bare title rather
 * than to a guess.
 */
import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { linkTarget, resolveLink, resolveLinks } from '../src/vault/link-kind';
import { linkChipLabel, linkChipLabels } from '../src/ui/kit/link-chips';

vi.mock('obsidian', () => import('./obsidian-stub'));

const S = DEFAULT_SETTINGS;

/** A vault of paths to frontmatter, resolved by basename the way Obsidian does. */
function appWith(notes: Record<string, Record<string, unknown>>): App {
  const files = Object.keys(notes).map((path) => ({
    path,
    basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''),
  }));

  return {
    vault: { getMarkdownFiles: () => files },
    metadataCache: {
      getFileCache: (file: { path: string }) => ({ frontmatter: notes[file.path] ?? {} }),
      getFirstLinkpathDest: (title: string) =>
        files.find((file) => file.basename === title) ?? null,
    },
  } as unknown as App;
}

describe('linkTarget', () => {
  it('takes the alias and the heading off, because the reader captures them whole', () => {
    expect(linkTarget('Q3 Finanzen')).toBe('Q3 Finanzen');
    expect(linkTarget('Q3 Finanzen|das Budget')).toBe('Q3 Finanzen');
    expect(linkTarget('Q3 Finanzen#Ziele')).toBe('Q3 Finanzen');
    expect(linkTarget('  Q3 Finanzen|das Budget  ')).toBe('Q3 Finanzen');
  });

  it('comes back empty for a value that is only an alias or only a heading', () => {
    // Neither is a link anybody meant to write. Empty is the right answer
    // because `resolveLink` refuses to look one up, where a title guessed out
    // of the remainder would resolve to some unrelated note.
    expect(linkTarget('|alias')).toBe('');
    expect(linkTarget('#Ziele')).toBe('');
  });
});

describe('resolveLink', () => {
  it('names a note that is in the right folder with the right type', () => {
    const app = appWith({
      [`${S.projectsFolder}/Q3 Finanzen.md`]: { type: S.projectTypeValue },
      [`${S.personsFolder}/Anna Muster.md`]: { type: S.personTypeValue },
    });

    expect(resolveLink(app, S, 'Q3 Finanzen')).toEqual({
      title: 'Q3 Finanzen',
      kind: 'project',
      exists: true,
    });
    expect(resolveLink(app, S, 'Anna Muster').kind).toBe('person');
  });

  it('refuses the right type in the wrong folder', () => {
    // The vault's own rule, and the reason it exists: a note saying
    // `type: project` in the resources folder is not claimed by any list, so a
    // chip must not claim it either.
    const app = appWith({
      [`${S.resourcesFolder}/Q3 Finanzen.md`]: { type: S.projectTypeValue },
    });
    expect(resolveLink(app, S, 'Q3 Finanzen')).toEqual({
      title: 'Q3 Finanzen',
      kind: null,
      exists: true,
    });
  });

  it('refuses the right folder with no type at all', () => {
    const app = appWith({ [`${S.projectsFolder}/Q3 Finanzen.md`]: {} });
    expect(resolveLink(app, S, 'Q3 Finanzen').kind).toBeNull();
  });

  it('names an archived project, because archiving is a move and it is still a project', () => {
    const app = appWith({
      [`${S.archiveFolder}/${S.projectsArchiveFolder}/2025/Altes Projekt.md`]: {
        type: S.projectTypeValue,
        archived: '2025-12-31T10:00',
      },
    });
    expect(resolveLink(app, S, 'Altes Projekt').kind).toBe('project');
  });

  it('names a travel note by its type value alone, wherever the vault keeps it', () => {
    // The one place the folder rule does not apply, and deliberately: the
    // twelve travel values are fixed in trail-core rather than configurable, so
    // a note saying `type: fnb` is a restaurant wherever somebody files it.
    // NODAtrail does not know APERtrail's nine place folders and should not
    // learn them to decide the wording of a label.
    const app = appWith({
      'Plätze/Essen & Trinken/Gifthüttli.md': { type: 'fnb' },
      'Irgendwo/Anders/Nordkap.md': { type: 'excursion' },
      'Reisen/Nordkap 2027.md': { type: 'trip' },
    });
    expect(resolveLink(app, S, 'Gifthüttli').kind).toBe('fnb');
    expect(resolveLink(app, S, 'Nordkap').kind).toBe('excursion');
    expect(resolveLink(app, S, 'Nordkap 2027').kind).toBe('trip');
  });

  it('lets this vault win over the shared vocabulary', () => {
    // A vault that renamed its own project type to a travel word gets its own
    // answer: what the plugin is configured for beats what the suite agreed.
    const app = appWith({
      [`${S.projectsFolder}/Nordkap.md`]: { type: 'trip' },
    });
    const settings = { ...S, projectTypeValue: 'trip' };
    expect(resolveLink(app, settings, 'Nordkap').kind).toBe('project');
  });

  it('treats a link to a note nobody has written yet as ordinary', () => {
    // Writing a day note must never wait on writing the notes it mentions.
    expect(resolveLink(appWith({}), S, 'Gifthüttli')).toEqual({
      title: 'Gifthüttli',
      kind: null,
      exists: false,
    });
  });

  it('keeps the order the line spells the links in', () => {
    const app = appWith({
      [`${S.areasFolder}/Beruf.md`]: { type: S.areaTypeValue },
      [`${S.personsFolder}/Anna Muster.md`]: { type: S.personTypeValue },
    });
    expect(
      resolveLinks(app, S, ['Beruf', 'Gifthüttli', 'Anna Muster']).map((one) => one.kind)
    ).toEqual(['area', null, 'person']);
  });
});

describe('linkChipLabel', () => {
  it('falls back to the bare title when nothing names the kind', () => {
    // The whole label, not a colon with nothing in front of it: an unnamed
    // kind must read as the link itself rather than as a broken chip.
    expect(linkChipLabel({ title: 'Gifthüttli', kind: null, exists: true })).toBe('Gifthüttli');
    expect(linkChipLabel({ title: 'Gifthüttli', kind: null, exists: false })).toBe('Gifthüttli');
  });

  it('puts the kind in front of the title when there is one', () => {
    expect(linkChipLabel({ title: 'Q3 Finanzen', kind: 'project', exists: true })).toBe(
      'Project: Q3 Finanzen'
    );
  });

  it('labels every link on a line', () => {
    expect(
      linkChipLabels([
        { title: 'Beruf', kind: 'area', exists: true },
        { title: 'Gifthüttli', kind: null, exists: false },
      ])
    ).toEqual(['Area: Beruf', 'Gifthüttli']);
  });
});
