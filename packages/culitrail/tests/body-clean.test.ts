/**
 * What the meal view removes from the body it renders, and what it leaves
 * alone.
 *
 * Both halves matter. Removing too little shows the title and the photo
 * twice; removing too much silently deletes a line of somebody's meal from
 * the screen while the note still holds it, which is far harder to notice.
 */
import { describe, expect, it } from 'vitest';
import { stripRedundantBodyContent } from '../src/meals/parser/body-clean';
import { splitTrailingSections } from '../src/meals/parser/trailing-sections';

const on = (extra: Record<string, string> = {}) => ({ cleanNoteBody: true, ...extra });

describe('stripRedundantBodyContent', () => {
  it('removes the title heading the view already shows', () => {
    const body = '# Mushroom Risotto\n\nA weeknight version.';
    expect(stripRedundantBodyContent(body, on({ title: 'Mushroom Risotto' }))).toBe(
      'A weeknight version.'
    );
  });

  it('leaves the title alone when it is used as a real sub-heading', () => {
    // A `##` of the same name is a section somebody wrote, not the note
    // repeating its own name at the top.
    const body = '## Mushroom Risotto\n\nA weeknight version.';
    expect(stripRedundantBodyContent(body, on({ title: 'Mushroom Risotto' }))).toBe(body);
  });

  it('removes the hero image embed in either syntax', () => {
    expect(
      stripRedundantBodyContent('![[risotto.jpg]]\n\nText', on({ imageValue: 'risotto.jpg' }))
    ).toBe('Text');
    expect(
      stripRedundantBodyContent('![Dish](risotto.jpg)\n\nText', on({ imageValue: 'risotto.jpg' }))
    ).toBe('Text');
  });

  it('removes the embed even when the note aliases or anchors it', () => {
    expect(
      stripRedundantBodyContent('![[risotto.jpg|400]]\n\nText', on({ imageValue: 'risotto.jpg' }))
    ).toBe('Text');
  });

  it('matches the hero image by target, not by how it was written', () => {
    // The frontmatter says `![[risotto.jpg]]`, the body says `![[risotto.jpg]]`
    // with an alias. Both name the same file.
    expect(
      stripRedundantBodyContent('![[risotto.jpg|hero]]', on({ imageValue: '![[risotto.jpg]]' }))
    ).toBe('');
  });

  it('leaves a different image alone', () => {
    const body = '![[plating.jpg]]';
    expect(stripRedundantBodyContent(body, on({ imageValue: 'risotto.jpg' }))).toBe(body);
  });

  it('leaves an image mentioned inside a sentence alone', () => {
    // Whole-line matches only. Removing the line would take the sentence with
    // it, which is a silent edit to what somebody wrote.
    const body = 'Plate it like this ![[risotto.jpg]] and serve.';
    expect(stripRedundantBodyContent(body, on({ imageValue: 'risotto.jpg' }))).toBe(body);
  });

  it('does nothing at all when the setting is off', () => {
    const body = '# Mushroom Risotto\n\n![[risotto.jpg]]\n\nText';
    expect(
      stripRedundantBodyContent(body, {
        cleanNoteBody: false,
        title: 'Mushroom Risotto',
        imageValue: 'risotto.jpg',
      })
    ).toBe(body);
  });

  it('closes the gap the removed lines leave behind', () => {
    const body = '# Risotto\n\n![[risotto.jpg]]\n\n\nFirst paragraph.';
    expect(
      stripRedundantBodyContent(body, on({ title: 'Risotto', imageValue: 'risotto.jpg' }))
    ).toBe('First paragraph.');
  });

  it('survives an image path full of regex characters', () => {
    // A real attachment name: parentheses from a duplicate download.
    const body = '![[photo (1).jpg]]\n\nText';
    expect(stripRedundantBodyContent(body, on({ imageValue: 'photo (1).jpg' }))).toBe('Text');
  });
});

describe('splitTrailingSections', () => {
  const body = '## Notes\n\nRests better overnight.\n\n## Source\n\nA cookbook.';

  it('splits on headings and keeps each body', () => {
    expect(splitTrailingSections(body)).toEqual([
      { heading: 'Notes', body: 'Rests better overnight.' },
      { heading: 'Source', body: 'A cookbook.' },
    ]);
  });

  it('treats a deeper heading as its own section rather than nesting it', () => {
    // These become cards, and a card is a better unit than a hierarchy
    // nobody asked for.
    const nested = '## Notes\n\nTop.\n\n### Detail\n\nInner.';
    expect(splitTrailingSections(nested).map((section) => section.heading)).toEqual([
      'Notes',
      'Detail',
    ]);
  });

  it('drops the headings the caller excludes, case-insensitively', () => {
    expect(splitTrailingSections(body, ['notes']).map((s) => s.heading)).toEqual(['Source']);
  });

  it('takes the sub-sections of an excluded section with it', () => {
    // The failure this pins, seen in a real vault: the reheating section has one
    // sub-heading per appliance, and a flat split offered `## Steamer` back as a
    // card of its own. The dish then showed its appliance twice, once rendered
    // properly and once as a card of raw `[temp:: 95 °C]` text.
    const nested = [
      '# Reheating',
      '',
      '## Steamer',
      '[temp:: 95 °C] [time:: 25 min]',
      '',
      '## Oven',
      'Heat it.',
      '',
      '# Notes',
      'Kept.',
    ].join('\n');

    expect(splitTrailingSections(nested, ['Reheating']).map((s) => s.heading)).toEqual(['Notes']);
  });

  it('ends the exclusion at a sibling heading, not at the end of the note', () => {
    const nested = '## Reheating\n\n### Steamer\nHot.\n\n## Notes\nKept.';
    expect(splitTrailingSections(nested, ['reheating']).map((s) => s.heading)).toEqual(['Notes']);
  });

  it('does not swallow a section another feature renders, however deep its heading', () => {
    // `## Eating History` under a `# Reheating` is one level deeper, so the
    // exclusion would take it too and the log would leave the page. Naming it as
    // an end-of-exclusion heading is what keeps it.
    const nested = [
      '# Reheating',
      '## Steamer',
      'Hot.',
      '## Eating History',
      '- 2025-12-11',
      '## Notes',
      'Kept.',
    ].join('\n');

    expect(
      splitTrailingSections(nested, ['Reheating'], ['Eating History']).map((s) => s.heading)
    ).toEqual(['Eating History', 'Notes']);
  });

  it('ignores a blank exclusion rather than dropping everything', () => {
    // The eating-history heading setting can be empty, and an empty exclusion
    // must not match every section.
    expect(splitTrailingSections(body, ['', '   ']).map((s) => s.heading)).toEqual([
      'Notes',
      'Source',
    ]);
  });

  it('keeps a section that has a heading but no content', () => {
    expect(splitTrailingSections('## Notes')).toEqual([{ heading: 'Notes', body: '' }]);
  });

  it('is empty for text with no headings at all', () => {
    expect(splitTrailingSections('Just a trailing paragraph.')).toEqual([]);
  });
});
