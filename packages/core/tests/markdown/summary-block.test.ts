/**
 * The summary block a note opens with.
 *
 * The shape is not invented here. It is the one already in these vaults,
 * written by hand in NODAtrail's CN-1097838 and in APERtrail's Shongololo trip
 * before either plugin offered the field, and the first test holds the format
 * to it: a note a dialog makes and a note Stefan made have to be the same file.
 *
 * The rest are about what a save is allowed to touch, which is the expensive
 * question here. A summary is body text, and everything under it -- tasks,
 * meeting links, an itinerary block, whatever somebody typed -- is body text
 * the dialog never saw.
 *
 * This suite is the merge of the two the plugins carried before the format was
 * promoted. Both cases are kept, because they are different notes: one has
 * markdown headings under the summary and the other has fenced blocks, and the
 * splice has to leave both exactly as it found them.
 */
import { describe, expect, it } from 'vitest';
import {
  countSummaries,
  findSummaryBlock,
  readSummary,
  summaryBody,
  withSummary,
} from '../../src/markdown/summary-block.js';

/** What CN-1097838 holds under its frontmatter, exactly. */
const BY_HAND = [
  '',
  '---',
  '',
  '> [!SUMMARY]+',
  '> Automatic Reconstitution of PT Rec not triggered after upgrade to SW 2.5.0 even though',
  '> the liquid volume was below the minima defined.',
  '',
].join('\n');

const TEXT =
  'Automatic Reconstitution of PT Rec not triggered after upgrade to SW 2.5.0 even though\nthe liquid volume was below the minima defined.';

/** A trip note's body: the summary, then the two blocks it renders. */
const TRIP_BODY = [
  '',
  '---',
  '',
  '> [!SUMMARY]+',
  '> Eine Zugreise durch das suedliche Afrika.',
  '',
  '```travel-itinerary',
  '```',
  '',
  '```apt-trip-costs',
  '```',
  '',
].join('\n');

describe('the block a new note opens with', () => {
  it('is the one already in the vault', () => {
    // `createTypedNote` wraps a body in the newline either side.
    expect(`\n${summaryBody(TEXT)}\n`).toBe(BY_HAND);
  });

  it('is nothing at all when the box was left empty', () => {
    expect(summaryBody('   ')).toBe('');
  });
});

describe('reading a summary back', () => {
  it('gives the text without its quoting', () => {
    expect(readSummary(BY_HAND)).toBe(TEXT);
  });

  /**
   * The opener is the callout's marker, not the note's words.
   *
   * Invisible until it is wrong: a reader written by hand against the same
   * note keeps the `[!SUMMARY]+` line and prints it as the first words of the
   * overview, which is exactly what a throwaway script did on the day this
   * moved into the core.
   */
  it('leaves the callout marker out of the text', () => {
    expect(readSummary(BY_HAND)).not.toContain('[!SUMMARY]');
    expect(readSummary(BY_HAND).startsWith('Automatic')).toBe(true);
  });

  it('is empty for a note that has none', () => {
    expect(readSummary('\n## Notes\n\n- a line\n')).toBe('');
  });

  it('takes the rule as part of the block', () => {
    expect(findSummaryBlock(BY_HAND.split('\n'))?.from).toBe(1);
  });

  /**
   * A rule somebody put between two pieces of their own text is theirs. Only
   * the one the note opens with belongs to the summary.
   */
  it('leaves a rule further down out of it', () => {
    const body = ['', '## Notes', '', '---', '', '> [!SUMMARY]+', '> late', ''];

    expect(findSummaryBlock(body)?.from).toBe(5);
  });
});

describe('saving a summary', () => {
  it('returns the same body when nothing changed', () => {
    expect(withSummary(BY_HAND, TEXT)).toBe(BY_HAND);
  });

  it('changes the callout and nothing else', () => {
    const body = `${BY_HAND}## Notes\n\n- checked with support\n`;
    const saved = withSummary(body, 'Reconstitution does not trigger.');

    expect(saved).toContain('> Reconstitution does not trigger.');
    expect(saved).not.toContain('liquid volume');
    expect(saved.endsWith('## Notes\n\n- checked with support\n')).toBe(true);
  });

  /** The same promise, for a body whose text under the summary is fenced blocks. */
  it('leaves the blocks of a trip note where they are', () => {
    const saved = withSummary(TRIP_BODY, 'Zwoelf Tage im Zug.');

    expect(saved).toContain('> Zwoelf Tage im Zug.');
    expect(saved.endsWith('```travel-itinerary\n```\n\n```apt-trip-costs\n```\n')).toBe(true);
  });

  it('puts a first summary above what the note already holds', () => {
    const saved = withSummary('\n## Notes\n\n- a line\n', 'What this is about.');

    expect(saved.split('\n')).toEqual([
      '',
      '---',
      '',
      '> [!SUMMARY]+',
      '> What this is about.',
      '',
      '## Notes',
      '',
      '- a line',
      '',
    ]);
  });

  it('puts a first summary above a note that is only blocks', () => {
    const saved = withSummary('\n```travel-itinerary\n```\n', 'Neu.');

    expect(saved).toBe('\n---\n\n> [!SUMMARY]+\n> Neu.\n\n```travel-itinerary\n```\n');
  });

  it('takes the rule with it when the summary is cleared', () => {
    const body = `${BY_HAND}## Notes\n`;

    expect(withSummary(body, '')).toBe('\n## Notes\n');
  });

  it('leaves a note that never had one alone', () => {
    const body = '\n## Notes\n\n- a line\n';

    expect(withSummary(body, '  ')).toBe(body);
  });

  /** A paragraph break in the box must not split the callout in two. */
  it('keeps a two-paragraph summary in one callout', () => {
    const saved = withSummary(BY_HAND, 'First.\n\nSecond.');

    expect(saved).toContain('> First.\n>\n> Second.');
    expect(readSummary(saved)).toBe('First.\n\nSecond.');
  });
});

/**
 * What the opening line of an existing block is allowed to become, which is
 * nothing.
 *
 * The block this file composes is the canonical one, and until every entity
 * type had an editor the only notes it wrote back were notes it had written.
 * Now a form saves a note somebody typed: `> [!summary]` in a German vault,
 * a callout collapsed on purpose, a title over it. Normalising all three on
 * the first save would be a dialog restyling lines it was not opened to
 * change, and a sync showing an edit nobody made.
 */
describe('the opener an existing block keeps', () => {
  const bodyWith = (opener: string): string => `\n---\n\n${opener}\n> Alt.\n\n## Notizen\n`;

  it('keeps the spelling the note used', () => {
    expect(withSummary(bodyWith('> [!summary]'), 'Neu.')).toContain('> [!summary]\n> Neu.');
  });

  it('leaves a collapsed callout collapsed', () => {
    expect(withSummary(bodyWith('> [!SUMMARY]-'), 'Neu.')).toContain('> [!SUMMARY]-\n> Neu.');
  });

  it('keeps a title somebody gave it', () => {
    expect(withSummary(bodyWith('> [!summary] Zusammenfassung'), 'Neu.')).toContain(
      '> [!summary] Zusammenfassung\n> Neu.'
    );
  });

  /** The rule is part of the block for removal and none of the edit's business otherwise. */
  it('leaves the rule and the blank lines above the callout as it found them', () => {
    const body = '\n---\n\n\n> [!summary]\n> Alt.\n';

    expect(withSummary(body, 'Neu.')).toBe('\n---\n\n\n> [!summary]\n> Neu.\n');
  });

  it('still gives a note that had none the canonical block', () => {
    expect(withSummary('\n## Notizen\n', 'Neu.')).toContain('> [!SUMMARY]+\n> Neu.');
  });

  it('leaves the rest of the note where it was', () => {
    expect(withSummary(bodyWith('> [!summary]'), 'Neu.')).toContain('\n## Notizen\n');
  });
});

/**
 * How many blocks a note holds, which is a question only because the answer is
 * sometimes two and nothing about such a note looks wrong.
 */
describe('countSummaries', () => {
  it('counts the one a normal note has', () => {
    expect(countSummaries(BY_HAND)).toBe(1);
  });

  it('counts none in a note nobody has summarized', () => {
    expect(countSummaries('\n## Notizen\n')).toBe(0);
  });

  it('counts both when somebody pasted twice', () => {
    const body = '\n> [!SUMMARY]+\n> Erst.\n\n> [!summary]\n> Dann.\n';

    expect(countSummaries(body)).toBe(2);
  });
});
