/**
 * The repair path for a note written before its type carried the block.
 *
 * A Country or a State made last year has no related-trips fence, so its Edit
 * and Prospekt buttons would never appear however the plugin changes. Adding
 * it when the note is being saved anyway is what reaches those notes without
 * a migration that rewrites a vault nobody asked it to touch.
 *
 * Same shape and same reasoning as `ensureItineraryBlock`, and the assertion
 * that matters is the second one: a call made on a note that already has the
 * block writes nothing at all, so saving a form after changing only a tag
 * must not move `modified` or leave the note rendering two of them.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({ TFile: class {}, stringifyYaml: () => '' }));

import { ensureRelatedTripsBlock, relatedTripsBody } from '../src/vault/related-trips-body';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const settings = DEFAULT_SETTINGS;
const NOW = new Date(2026, 7, 6, 10, 30);

function vaultWithBody(body: string) {
  const frontmatter: Record<string, unknown> = { type: 'country' };
  const appended: string[] = [];
  const file = { path: 'Plätze/Länder/Schweiz.md', basename: 'Schweiz' } as never;
  const app = {
    vault: {
      read: async () => body,
      append: async (_f: unknown, text: string) => {
        appended.push(text);
      },
    },
    fileManager: {
      processFrontMatter: async (
        _f: unknown,
        fn: (fm: Record<string, unknown>) => void
      ): Promise<void> => {
        fn(frontmatter);
      },
    },
  } as never;
  return { app, file, frontmatter, appended };
}

describe('ensureRelatedTripsBlock', () => {
  it('appends the block and stamps modified on a note that lacks it', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody('---\ntype: country\n---\n');

    expect(await ensureRelatedTripsBlock(app, settings, file, NOW)).toBe(true);
    expect(appended).toEqual([relatedTripsBody()]);
    expect(frontmatter.modified).toBe('2026-08-06T10:30');
  });

  it('writes nothing at all when the block is already there', async () => {
    const { app, file, frontmatter, appended } = vaultWithBody(
      '---\ntype: country\n---\n\n```travel-related-trips\n```\n'
    );

    expect(await ensureRelatedTripsBlock(app, settings, file, NOW)).toBe(false);
    expect(appended).toHaveLength(0);
    expect('modified' in frontmatter).toBe(false);
  });

  /** Everything the person wrote is still there: this appends, it does not rewrite. */
  it('leaves the note somebody has been keeping by hand alone', async () => {
    const { app, file, appended } = vaultWithBody('---\ntype: country\n---\n\n# ÜBERBLICK\n');

    await ensureRelatedTripsBlock(app, settings, file, NOW);

    expect(appended[0]).not.toContain('ÜBERBLICK');
  });
});
