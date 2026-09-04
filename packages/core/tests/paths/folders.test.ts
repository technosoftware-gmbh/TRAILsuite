/**
 * Vault paths as strings.
 *
 * The case worth reading twice is the asymmetry between `isUnderFolder` and
 * `isUnderAnyFolder` for a blank folder: one means the vault root, the other
 * means nothing was configured.
 */
import { describe, expect, it } from 'vitest';
import {
  folderOfPath,
  isUnderAnyFolder,
  isUnderFolder,
  joinFolder,
  normalizePath,
  relativeFolderPath,
  sanitizeTitle,
} from '../../src/paths/folders';

describe('normalizePath', () => {
  it('strips leading, trailing and repeated separators', () => {
    expect(normalizePath('/Cooking//Recipes/')).toBe('Cooking/Recipes');
    expect(normalizePath('Cooking/./Recipes')).toBe('Cooking/Recipes');
  });

  it('accepts a backslash path and a blank', () => {
    expect(normalizePath('Cooking\\Recipes')).toBe('Cooking/Recipes');
    expect(normalizePath('')).toBe('');
    expect(normalizePath('/')).toBe('');
  });
});

describe('joinFolder', () => {
  it('joins, and tolerates a blank on either side', () => {
    expect(joinFolder('4 Resources', 'Cooking')).toBe('4 Resources/Cooking');
    expect(joinFolder('', 'Cooking')).toBe('Cooking');
    expect(joinFolder('Cooking', '')).toBe('Cooking');
    expect(joinFolder('', '')).toBe('');
  });

  it('never produces a leading slash from an empty root', () => {
    // An empty root folder means the vault root, which is the shape a plugin
    // ships in. A leading slash there is a path no vault resolves.
    expect(joinFolder('', 'CRM/People').startsWith('/')).toBe(false);
  });
});

describe('isUnderFolder', () => {
  it('matches a file at any depth', () => {
    expect(isUnderFolder('Cooking/Recipes/Pasta.md', 'Cooking')).toBe(true);
    expect(isUnderFolder('Cooking/Recipes/Pasta.md', 'Cooking/Recipes')).toBe(true);
  });

  it('does not match a folder that merely shares a prefix', () => {
    // The bug this shape exists to avoid.
    expect(isUnderFolder('Recipes Archive/Old.md', 'Recipes')).toBe(false);
  });

  it('treats a blank folder as the vault root', () => {
    expect(isUnderFolder('Anything.md', '')).toBe(true);
  });

  it('is false for a sibling', () => {
    expect(isUnderFolder('Travel/Trips/A.md', 'Cooking')).toBe(false);
  });
});

describe('isUnderAnyFolder', () => {
  it('matches any of the folders given', () => {
    expect(isUnderAnyFolder('Cooking/Recipes/A.md', ['Travel', 'Cooking'])).toBe(true);
  });

  it('treats an empty list as nowhere, not everywhere', () => {
    // The asymmetry with isUnderFolder: a feature with no folder configured
    // should find nothing rather than the whole vault.
    expect(isUnderAnyFolder('Anything.md', [])).toBe(false);
    expect(isUnderAnyFolder('Anything.md', ['', '  '])).toBe(false);
  });
});

describe('folderOfPath', () => {
  it('returns the containing folder, or blank at the root', () => {
    expect(folderOfPath('Cooking/Recipes/Pasta.md')).toBe('Cooking/Recipes');
    expect(folderOfPath('Pasta.md')).toBe('');
  });
});

describe('relativeFolderPath', () => {
  it('returns the subfolder below the root', () => {
    expect(relativeFolderPath('Travel/Cities/Europe/Basel.md', 'Travel/Cities')).toBe('Europe');
  });

  it('returns blank for a file directly in the root', () => {
    expect(relativeFolderPath('Travel/Cities/Basel.md', 'Travel/Cities')).toBe('');
  });

  it('returns the whole folder when there is no root', () => {
    expect(relativeFolderPath('Travel/Cities/Basel.md', '')).toBe('Travel/Cities');
  });

  it('never produces a path with .. in it for a file outside the root', () => {
    const relative = relativeFolderPath('Cooking/Recipes/A.md', 'Travel');
    expect(relative).toBe('Cooking/Recipes');
    expect(relative).not.toContain('..');
  });
});

describe('sanitizeTitle', () => {
  it('replaces only the separator', () => {
    expect(sanitizeTitle('Salt & Pepper: a study')).toBe('Salt & Pepper: a study');
    expect(sanitizeTitle('Sweet/Sour')).toBe('Sweet-Sour');
  });

  it('trims', () => {
    expect(sanitizeTitle('  Pasta  ')).toBe('Pasta');
  });
});
