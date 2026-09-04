/**
 * The id markers this plugin has written under its three names.
 *
 * An eating-history line carries its identity in an HTML comment, because a Markdown
 * bullet has nowhere else to put one. That marker has been written three ways:
 * `rb-id` by Recipe Box, `cul-id` by CULInode, and `culi-id` since the rename
 * to CULItrail. All three are still in vaults, and a reader that knows only the
 * newest one does not fail loudly -- it reads the line as unidentified, which
 * shows the entry twice once its frontmatter record is read as well, and edits
 * a copy instead of the entry.
 *
 * So the rename is only finished if the old markers still resolve. These tests
 * are what says so.
 */
import { describe, expect, it } from 'vitest';
import { applyEatingSection } from '../src/meals/history/section-merge';
import { parseEatingHistorySection } from '../src/meals/parser/eating-history';
import { readEatingFields } from '../src/planning/meal-plan/meal-suffix';
import type { EatingRecord } from '../src/meals/history/types';

const HEADING = 'Eating History';

function record(over: Partial<EatingRecord> = {}): EatingRecord {
  return {
    id: 'c1',
    date: '2026-07-23T11:45',
    personLink: '[[Erika Muster]]',
    rating: 4,
    note: 'Sehr gut',
    ...over,
  };
}

describe('eating-history lines written before the rename', () => {
  for (const marker of ['rb-id', 'cul-id', 'culi-id']) {
    it(`upgrades a \`${marker}\` line in place rather than writing a second one`, () => {
      const before = [`## ${HEADING}`, `- **2026-07-23:** 11:45 · Erika <!--${marker}:c1-->`].join(
        '\n'
      );

      const after = applyEatingSection(before, HEADING, [record()], new Map());

      expect(after.match(/c1/g) ?? []).toHaveLength(1);
      expect(after).toContain('culi-id:c1');
    });
  }

  it('reads all three markers back out of a section', () => {
    const section = [
      '- 2026-07-23 11:45 · Erika <!--rb-id:a-->',
      '- 2026-07-24 12:00 · Erika <!--cul-id:b-->',
      '- 2026-07-25 12:15 · Erika <!--culi-id:c-->',
    ].join('\n');

    expect(parseEatingHistorySection(section).map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('meal-plan lines written before the rename', () => {
  for (const marker of ['rb-id', 'cul-id', 'culi-id']) {
    it(`keeps the identity of a \`${marker}\` line`, () => {
      const suffix = ` #meal/lunch [time:: 11:30] <!--${marker}:mig-b274-->`;
      expect(readEatingFields(suffix).id).toBe('mig-b274');
    });
  }
});
