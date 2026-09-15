/**
 * The defaults every sheet-writing plugin ships.
 *
 * `_exports` is pinned because APERtrail's vaults already hold sheets there: a
 * default that moved would file the next export somewhere else and leave the
 * old ones behind without a word.
 */
import { describe, expect, it } from 'vitest';
import { SHEET_CONTRACT, SHEET_CONTRACT_KEYS } from '../src/settings/sheet-contract';

describe('the sheet contract', () => {
  it('keeps the folder APERtrail has always written to', () => {
    expect(SHEET_CONTRACT.exportsSubfolder).toBe('_exports');
  });

  it('signs nothing until somebody is named', () => {
    expect(SHEET_CONTRACT.exportAuthor).toBe('');
  });

  it('lists every key it defines', () => {
    expect([...SHEET_CONTRACT_KEYS].sort()).toEqual(Object.keys(SHEET_CONTRACT).sort());
  });
});
