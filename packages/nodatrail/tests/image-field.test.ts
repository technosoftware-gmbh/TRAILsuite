/**
 * Where a PARA note's image goes.
 *
 * The vault convention, which all 178 images already in the one this was built
 * for follow: `<the note's own folder>/_resources/<file>`. It is also what
 * Obsidian's `attachmentFolderPath` of `./_resources` means, so an image filed
 * by the form and one dragged in by hand land in the same place.
 *
 * **The rule that separates this from the document filing beside it: an image
 * already in the vault is referenced, never moved.** An invoice belongs to one
 * bill; an image can be on several notes at once, and `image:` holds a plain
 * path rather than a wikilink, so a rename Obsidian would follow for a link may
 * leave another note's path pointing at nothing. Referencing costs a file
 * sitting somewhere untidy; moving costs a picture vanishing from a note nobody
 * was editing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { emptyImage, imageFolderFor } from '../src/para/image-file';
import { imageLabel, isImageFile } from '../src/para/image-file';

const source = readFileSync(join(__dirname, '..', 'src', 'para', 'image-file.ts'), 'utf8');

describe('the folder an image belongs in', () => {
  it('is _resources under the note own folder', () => {
    expect(imageFolderFor(DEFAULT_SETTINGS, '1 Bereiche/8 Beruf/Beruf.md')).toBe(
      '1 Bereiche/8 Beruf/_resources'
    );
    expect(
      imageFolderFor(DEFAULT_SETTINGS, '3 Projekte/Fotografie/365 Tage, jeden Tag ein Bild.md')
    ).toBe('3 Projekte/Fotografie/_resources');
  });

  it('matches what the vault already does', () => {
    // Read off a real note: `1 Bereiche/5 Hobbies/Hobbies.md` carries
    // `image: 1 Bereiche/5 Hobbies/_resources/Hobbies.png`.
    const note = '1 Bereiche/5 Hobbies/Hobbies.md';
    const existing = '1 Bereiche/5 Hobbies/_resources/Hobbies.png';
    expect(existing.startsWith(`${imageFolderFor(DEFAULT_SETTINGS, note)}/`)).toBe(true);
  });

  it('falls back to the note own folder when the subfolder is blank', () => {
    // Blank is a real answer for a vault that keeps its pictures beside its
    // notes, and it must not produce a path beginning with a slash.
    const settings = { ...DEFAULT_SETTINGS, imageSubfolder: '' };
    expect(imageFolderFor(settings, '1 Bereiche/8 Beruf/Beruf.md')).toBe('1 Bereiche/8 Beruf');
  });

  it('handles a note at the vault root without a leading slash', () => {
    expect(imageFolderFor(DEFAULT_SETTINGS, 'Beruf.md')).toBe('_resources');
  });

  it('defaults to what Obsidian own attachment setting says', () => {
    expect(DEFAULT_SETTINGS.imageSubfolder).toBe('_resources');
  });
});

describe('what the picker offers', () => {
  const file = (extension: string) => ({ extension }) as never;

  it('offers pictures and nothing else', () => {
    for (const good of ['png', 'jpg', 'JPEG', 'webp', 'svg', 'avif']) {
      expect(isImageFile(file(good))).toBe(true);
    }
    for (const bad of ['md', 'pdf', 'eml', 'txt', 'zip']) {
      expect(isImageFile(file(bad))).toBe(false);
    }
  });

  it('shows a pending file by name and a chosen one by path', () => {
    expect(imageLabel({ path: 'a/b/c.png', outside: null })).toBe('a/b/c.png');
    expect(imageLabel({ path: '', outside: { name: 'Scan.png' } as File })).toBe('Scan.png');
    expect(imageLabel(emptyImage())).toBe('');
  });
});

describe('what it refuses to do', () => {
  it('never renames a file that is already in the vault', () => {
    // The whole difference from the document filing. `fileManager.renameFile`
    // is what moves a document; nothing here may call it.
    expect(source).not.toContain('renameFile');
    expect(source).not.toContain('fileVaultDocument');
  });

  it('writes in only what came from outside the vault', () => {
    expect(source).toContain('if (choice.outside)');
    expect(source).toContain('return choice.path.trim();');
  });
});
