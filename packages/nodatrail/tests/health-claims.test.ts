/**
 * The gathering step of the vault check.
 *
 * This is the half that used to sit inside an `App`-bound function and
 * therefore had no test at all. It is where "which folder claims this note" and
 * "what does its type property say" are decided, and both are ordinary data
 * questions that deserve to be asked without a vault.
 */
import { describe, expect, it } from 'vitest';
import {
  claimedFolders,
  claimFor,
  folderNotesOf,
  folderPartOf,
  isUnder,
  stampNotesOf,
  statedTypeOf,
  type ScannedNote,
} from '../src/vault/health/claims';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { stampFindings, typeFindings } from '../src/vault/health/findings';

const S = DEFAULT_SETTINGS;
const CLAIMS = claimedFolders(S);

function note(path: string, frontmatter: Record<string, unknown> = {}): ScannedNote {
  return {
    path,
    title: (path.split('/').pop() ?? '').replace(/\.md$/, ''),
    frontmatter,
  };
}

describe('claimedFolders', () => {
  it('claims the live folder and the archive folder of each PARA kind', () => {
    const folders = CLAIMS.map((claim) => claim.folder);
    expect(folders).toContain('1 Areas');
    expect(folders).toContain('6 Archive/Areas');
    expect(folders).toContain('3 Projects');
    expect(folders).toContain('6 Archive/Projects');
  });

  it('claims the four finance folders', () => {
    const folders = CLAIMS.map((claim) => claim.folder);
    expect(folders).toContain('Finance/Purchases');
    expect(folders).toContain('Finance/Bills');
    expect(folders).toContain('Finance/Recurring');
    expect(folders).toContain('Finance/Budgets');
  });

  it('derives the five period folders from their path templates', () => {
    const folders = CLAIMS.map((claim) => claim.folder);
    expect(folders).toContain('0 Plan/1 Daily');
    expect(folders).toContain('0 Plan/2 Weekly');
    expect(folders).toContain('0 Plan/5 Yearly');
  });

  it('claims seventeen folders in all, which is what the vault sees', () => {
    expect(CLAIMS).toHaveLength(17);
  });

  it('reads longest first, so the most specific claim wins', () => {
    const lengths = CLAIMS.map((claim) => claim.folder.length);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  });

  it('drops a kind whose folder or type value is unconfigured', () => {
    const blankFolder = claimedFolders({ ...S, areasFolder: '' });
    expect(blankFolder.map((c) => c.folder)).not.toContain('1 Areas');

    const blankType = claimedFolders({ ...S, projectTypeValue: '' });
    expect(blankType.map((c) => c.folder)).not.toContain('3 Projects');
  });
});

describe('folderPartOf', () => {
  it('cuts a template at its first token', () => {
    expect(folderPartOf('0 Plan/1 Daily/{YYYY}/{YYYY}-{MM}-{DD}.md')).toBe('0 Plan/1 Daily');
    expect(folderPartOf('0 Plan/5 Yearly/{YYYY}.md')).toBe('0 Plan/5 Yearly');
  });

  it('handles a template with no token at all', () => {
    expect(folderPartOf('Plan/')).toBe('Plan');
    expect(folderPartOf('{YYYY}.md')).toBe('');
  });
});

describe('isUnder and claimFor', () => {
  it('matches a folder and everything beneath it', () => {
    expect(isUnder('1 Areas', '1 Areas')).toBe(true);
    expect(isUnder('1 Areas/6 Finanzen/Finanzen.md', '1 Areas')).toBe(true);
  });

  it('does not let one folder claim a sibling whose name it prefixes', () => {
    // The bug this rules out: `1 Area` claiming `1 Areas/x.md`.
    expect(isUnder('1 Areas/x.md', '1 Area')).toBe(false);
  });

  it('gives an archived project the project claim rather than the archive root', () => {
    const claim = claimFor('6 Archive/Projects/Alte Dias einscannen.md', CLAIMS);
    expect(claim?.typeValue).toBe('project');
  });

  it('answers nothing for a note in a folder nothing claims', () => {
    expect(claimFor('5 Notes/Arbeitgeber/x.md', CLAIMS)).toBeNull();
    expect(claimFor('Eating/Meals/x.md', CLAIMS)).toBeNull();
  });
});

describe('statedTypeOf', () => {
  it('reads a plain value', () => {
    expect(statedTypeOf({ type: 'area' }, 'type')).toBe('area');
  });

  it('reads the first entry of a list, which is what a property editor makes', () => {
    expect(statedTypeOf({ type: ['project', 'draft'] }, 'type')).toBe('project');
  });

  it('unwraps a wikilink, for a vault that keeps a note per type', () => {
    expect(statedTypeOf({ type: '"[[goal]]"'.replace(/"/g, '') }, 'type')).toBe('goal');
  });

  it('reads a missing, blank or non-string type as nothing', () => {
    expect(statedTypeOf({}, 'type')).toBeNull();
    expect(statedTypeOf({ type: '   ' }, 'type')).toBeNull();
    expect(statedTypeOf({ type: 42 }, 'type')).toBeNull();
    expect(statedTypeOf({ type: [] }, 'type')).toBeNull();
  });

  it('reads under the configured property name', () => {
    expect(statedTypeOf({ Art: 'area' }, 'Art')).toBe('area');
  });
});

describe('the two mappings, end to end with the checks', () => {
  const notes = [
    note('0 Plan/4 Quarterly/2026/2026-Q1.md', { type: 'month' }),
    note('0 Plan/1 Daily/2022/2022-05-11.md', {}),
    note('1 Areas/1 Gesundheit/Gesundheit.md', {
      type: 'area',
      created: '[[2026-07-13]]',
      modified: '2026-08-04T14:05',
    }),
    note('3 Projects/Fotografie/365 Tage.md', {
      type: 'project',
      created: '2026-07-14',
      modified: '2026-07-27 - 01:17 pm',
    }),
    // Outside every claimed folder: a free note store and another plugin's tree.
    note('5 Notes/Arbeitgeber/x.md', { created: '[[2026-07-16]]' }),
    note('Eating/Meals/Lasagne.md', { type: 'meal', modified: '2026-07-01 - 09:00 am' }),
  ];

  it('reports the quarter note that says it is a month', () => {
    const findings = typeFindings(folderNotesOf(notes, CLAIMS, S.typePropertyName));
    const quarter = findings.find((f) => f.title === '2026-Q1');

    expect(quarter?.kind).toBe('wrongType');
    expect(quarter?.detail).toBe('month');
    expect(quarter?.expected).toBe('quarter');
  });

  it('reports an old daily note with no type at all, as a different kind of finding', () => {
    const findings = typeFindings(folderNotesOf(notes, CLAIMS, S.typePropertyName));
    expect(findings.find((f) => f.title === '2022-05-11')?.kind).toBe('missingType');
  });

  it('says nothing about notes outside the claimed folders', () => {
    const findings = typeFindings(folderNotesOf(notes, CLAIMS, S.typePropertyName));
    expect(findings.map((f) => f.title)).not.toContain('x');
    expect(findings.map((f) => f.title)).not.toContain('Lasagne');
  });

  it('reports every stamp still in an older shape, and only those', () => {
    const findings = stampFindings(
      stampNotesOf(notes, CLAIMS, S.createdProperty, S.modifiedProperty)
    );

    // Gesundheit for its wikilink `created`, 365 Tage for both of its stamps,
    // which is three findings across two notes. The 2026-Q1 note carries none,
    // and the two unclaimed notes are not read at all.
    expect(findings.map((f) => f.title).sort()).toEqual(['365 Tage', '365 Tage', 'Gesundheit']);
  });

  it('does not read the stamps of a note it does not claim', () => {
    const stamps = stampNotesOf(notes, CLAIMS, S.createdProperty, S.modifiedProperty);
    expect(stamps.map((s) => s.title)).not.toContain('Lasagne');
  });
});
