/**
 * The legacy child lists, and the one thing that is still read out of them.
 *
 * A Country's `states:` and a State's `cities:` stopped being the source of
 * the hierarchy: read-entities.ts derives both from the `country:`/`state:`
 * link on the child. That makes almost every entry in an existing list a
 * harmless duplicate, and exactly one class of entry a silent loss -- the
 * one the child does not agree with. These tests pin down that this check
 * reports that class and stays quiet about everything else, because a
 * migration warning that fires on every tidy vault is one nobody reads.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.split('/').filter(Boolean).join('/'),
}));

import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { scanChildListIssues, unreproducedChildren } from '../src/vault/health/child-list-issues';
import { makeFakeVault } from './fake-vault';

const settings = DEFAULT_SETTINGS;

describe('unreproducedChildren', () => {
  it('says nothing about an entry the child agrees with', () => {
    expect(unreproducedChildren('Aargau', ['Brugg'], () => 'Aargau')).toEqual([]);
  });

  it('separates a link to nothing from a note naming somebody else', () => {
    const parents: Record<string, string | null> = { Brugg: 'Aargau', Chur: 'Graubuenden' };
    expect(
      unreproducedChildren('Aargau', ['Brugg', 'Chur', 'Nowhere'], (child) =>
        child in parents ? parents[child] : undefined
      )
    ).toEqual([
      { child: 'Chur', problem: 'notLinkedBack', actualParent: 'Graubuenden' },
      { child: 'Nowhere', problem: 'unknown', actualParent: null },
    ]);
  });

  it('reports a child naming no parent at all, with no parent to name', () => {
    expect(unreproducedChildren('Aargau', ['Brugg'], () => null)).toEqual([
      { child: 'Brugg', problem: 'notLinkedBack', actualParent: null },
    ]);
  });

  it('counts a child listed twice once', () => {
    expect(unreproducedChildren('Aargau', ['Brugg', 'Brugg'], () => undefined)).toHaveLength(1);
  });
});

describe('scanChildListIssues', () => {
  it('stays silent on a vault whose lists agree with their children', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.countriesFolder}/Switzerland.md`,
        frontmatter: { type: 'country', states: ['[[Aargau]]'] },
      },
      {
        path: `${settings.statesFolder}/Aargau.md`,
        frontmatter: { type: 'state', country: '[[Switzerland]]', cities: ['[[Brugg]]'] },
      },
      {
        path: `${settings.citiesFolder}/Brugg.md`,
        frontmatter: { type: 'city', country: '[[Switzerland]]', state: '[[Aargau]]' },
      },
    ]);

    expect(scanChildListIssues(app, settings)).toEqual([]);
  });

  it('reports the entry a town does not name back, and says what it names instead', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.statesFolder}/Aargau.md`,
        frontmatter: { type: 'state', cities: ['[[Chur]]'] },
      },
      {
        path: `${settings.statesFolder}/Graubuenden.md`,
        frontmatter: { type: 'state' },
      },
      {
        path: `${settings.citiesFolder}/Chur.md`,
        frontmatter: { type: 'city', state: '[[Graubuenden]]' },
      },
    ]);

    const issues = scanChildListIssues(app, settings);
    expect(issues).toHaveLength(1);
    expect(issues[0].file.basename).toBe('Aargau');
    expect(issues[0].property).toBe(settings.citiesProperty);
    expect(issues[0].child).toBe('Chur');
    expect(issues[0].problem).toBe('notLinkedBack');
    expect(issues[0].actualParent).toBe('Graubuenden');
  });

  it('reports a listed province that does not exist, on the country note', () => {
    const { app } = makeFakeVault([
      {
        path: `${settings.countriesFolder}/Norway.md`,
        frontmatter: { type: 'country', states: ['[[Moere og Romsdal]]'] },
      },
    ]);

    const issues = scanChildListIssues(app, settings);
    expect(issues).toHaveLength(1);
    expect(issues[0].property).toBe(settings.statesProperty);
    expect(issues[0].problem).toBe('unknown');
  });

  it('follows the configured property names rather than the default ones', () => {
    const custom = { ...settings, citiesProperty: 'orte' };
    const { app } = makeFakeVault([
      {
        path: `${settings.statesFolder}/Aargau.md`,
        frontmatter: { type: 'state', orte: ['[[Nowhere]]'], cities: ['[[AlsoNowhere]]'] },
      },
    ]);

    const issues = scanChildListIssues(app, custom);
    expect(issues.map((issue) => issue.child)).toEqual(['Nowhere']);
  });
});
