/**
 * What the company dropdown offers, and why it cannot simply ask the vault.
 *
 * Obsidian indexes a new note asynchronously. A form that writes a Company note
 * and redraws immediately asks a metadata cache that has not heard of it yet,
 * and gets the list it had a moment ago. That is what happened: the company was
 * created, the note was on disk, and the dropdown did not have it.
 *
 * The rule under test is the fix: offer the union of what the cache knows and
 * what this form made, so the dropdown never depends on how fast a disk is.
 */
import { describe, expect, it } from 'vitest';

/** The rule itself, kept here rather than reached through Obsidian's UI classes. */
function offered(cached: readonly string[], made: readonly string[]): string[] {
  const titles = new Set(cached);
  for (const title of made) titles.add(title);
  return [...titles].sort((a, b) => a.localeCompare(b));
}

describe('the companies a form offers', () => {
  it('includes one the cache has not indexed yet', () => {
    // The cache still holds yesterday's list; the form knows better.
    expect(offered(['Musterversicherung'], ['Swisscom'])).toEqual([
      'Musterversicherung',
      'Swisscom',
    ]);
  });

  it('does not list a company twice once the cache catches up', () => {
    expect(offered(['Musterversicherung', 'Swisscom'], ['Swisscom'])).toEqual([
      'Musterversicherung',
      'Swisscom',
    ]);
  });

  it('sorts them, so a name added mid-form is where somebody looks for it', () => {
    expect(offered(['Zurich', 'Musterversicherung'], ['Migros'])).toEqual([
      'Migros',
      'Musterversicherung',
      'Zurich',
    ]);
  });

  it('is just the vault when the form has made nothing', () => {
    expect(offered(['Musterversicherung'], [])).toEqual(['Musterversicherung']);
  });

  it('is just what was made when the vault holds nothing', () => {
    // A first company in a fresh vault, which is the very first thing somebody
    // entering a month of invoices does.
    expect(offered([], ['Musterversicherung'])).toEqual(['Musterversicherung']);
  });
});
