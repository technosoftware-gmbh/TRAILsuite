/**
 * Which picture a meal shows, and where it was found.
 *
 * The resolution order is the point: a wrong answer here shows the wrong
 * photo, or shows the same photo twice once the body cleaner has been given a
 * value that was never in the note.
 */
import { describe, expect, it } from 'vitest';
import { mergeSettings } from '../src/settings/validate';
import { findFirstImageInBody, resolveImageTarget } from '../src/meals/parser/body-images';
import {
  defaultMealImageValue,
  frontmatterImageValue,
  resolveHeroImageValue,
} from '../src/meals/view-model/hero-image';

const settings = mergeSettings({});

describe('resolveImageTarget', () => {
  it('unwraps an embed down to the file it names', () => {
    expect(resolveImageTarget('![[risotto.jpg]]')).toBe('risotto.jpg');
    expect(resolveImageTarget('[[risotto.jpg]]')).toBe('risotto.jpg');
  });

  it('drops an alias and an anchor, which are display rather than target', () => {
    expect(resolveImageTarget('![[risotto.jpg|thumbnail]]')).toBe('risotto.jpg');
    expect(resolveImageTarget('![[risotto.jpg#top]]')).toBe('risotto.jpg');
  });

  it('leaves a plain path alone', () => {
    expect(resolveImageTarget('  Attachments/risotto.jpg  ')).toBe('Attachments/risotto.jpg');
  });
});

describe('findFirstImageInBody', () => {
  it('finds an Obsidian embed', () => {
    expect(findFirstImageInBody('Some text\n\n![[risotto.jpg]]\n')).toBe('risotto.jpg');
  });

  it('finds a Markdown image, which is what an import writes', () => {
    expect(findFirstImageInBody('![Finished dish](Attachments/risotto.jpg)')).toBe(
      'Attachments/risotto.jpg'
    );
  });

  it('drops a Markdown title, which is not part of the path', () => {
    expect(findFirstImageInBody('![alt](risotto.jpg "The finished dish")')).toBe('risotto.jpg');
  });

  it('reads an angle-bracketed destination', () => {
    expect(findFirstImageInBody('![alt](<my photos/risotto.jpg>)')).toBe('my photos/risotto.jpg');
  });

  it('takes the first in reading order, not the first of either syntax', () => {
    expect(findFirstImageInBody('![md](a.jpg)\n\n![[b.jpg]]')).toBe('a.jpg');
    expect(findFirstImageInBody('![[b.jpg]]\n\n![md](a.jpg)')).toBe('b.jpg');
  });

  it('ignores a link that is not an embed', () => {
    expect(findFirstImageInBody('See [the source](https://example.com/risotto)')).toBeNull();
  });

  it('gives the same answer twice in a row', () => {
    // The matcher is a module-level global regex, so its lastIndex survives
    // between calls. Without a reset, the second meal rendered in a session
    // starts its search halfway down the note.
    const body = 'Intro\n\n![[risotto.jpg]]\n\nMore\n\n![[plating.jpg]]';
    expect(findFirstImageInBody(body)).toBe('risotto.jpg');
    expect(findFirstImageInBody(body)).toBe('risotto.jpg');
  });

  it('is null for a body with no image', () => {
    expect(findFirstImageInBody('Just words.')).toBeNull();
  });
});

describe('resolveHeroImageValue', () => {
  const body = '![[from-the-body.jpg]]';

  it('prefers what the frontmatter names', () => {
    expect(resolveHeroImageValue({ image: 'stated.jpg' }, body, settings)).toBe('stated.jpg');
  });

  it('reads the frontmatter through the image alias chain', () => {
    expect(resolveHeroImageValue({ cover: 'stated.jpg' }, body, settings)).toBe('stated.jpg');
  });

  it('falls back to the body when the setting allows it', () => {
    const on = mergeSettings({ useFirstBodyImageWhenFrontmatterEmpty: true });
    expect(resolveHeroImageValue({}, body, on)).toBe('from-the-body.jpg');
  });

  it('does not guess at the body when the setting is off', () => {
    // The fallback is a guess: a note whose first image is a step photo would
    // show the wrong one, and a vault that fills in the property properly
    // should not have to think about it.
    const off = mergeSettings({ useFirstBodyImageWhenFrontmatterEmpty: false });
    expect(resolveHeroImageValue({}, body, off)).toBeNull();
  });

  it('treats a blank frontmatter value as absent rather than as an image', () => {
    const on = mergeSettings({ useFirstBodyImageWhenFrontmatterEmpty: true });
    expect(resolveHeroImageValue({ image: '   ' }, body, on)).toBe('from-the-body.jpg');
    expect(frontmatterImageValue({ image: '   ' }, settings)).toBeNull();
  });

  it('never returns the configured default, which belongs to no note', () => {
    // The hero value is handed to the body cleaner so the same picture is not
    // rendered twice. A default that is not in the note has nothing to strip,
    // and passing it would make the cleaner delete an unrelated line that
    // happened to embed the same file.
    const withDefault = mergeSettings({ defaultMealImage: 'placeholder.png' });
    expect(resolveHeroImageValue({}, '', withDefault)).toBeNull();
    expect(defaultMealImageValue(withDefault)).toBe('placeholder.png');
  });
});

describe('defaultMealImageValue', () => {
  it('treats an empty setting as the feature being off', () => {
    expect(defaultMealImageValue(mergeSettings({ defaultMealImage: '   ' }))).toBeNull();
  });
});
