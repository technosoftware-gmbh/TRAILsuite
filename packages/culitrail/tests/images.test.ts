/**
 * Turning a meal's `image:` value into a file in the vault.
 *
 * The case that matters is the one that used to fail: an image written as an
 * embed. Obsidian's own "copy link" and its drag-and-drop both produce
 * `![[photo.jpg]]`, and the stripper this resolver sits on only knew
 * `[[photo.jpg]]`, so the exclamation mark travelled all the way into the
 * lookup and matched nothing. The meal rendered its placeholder next to a
 * property that plainly named a picture.
 *
 * `obsidian` is a types-only package, and this is the one module under test
 * that needs `TFile` as a real class rather than as a type, for its
 * `instanceof` guards. A two-line stub is enough for that.
 */
import { describe, expect, it, vi } from 'vitest';
import { TFile, type App } from 'obsidian';
import { resolveImageFile, resolveImagePath } from '../src/ui/images';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));

/**
 * A vault holding one attachment.
 *
 * Both lookups the resolver makes are answered: Obsidian's link resolution,
 * which understands a shortened link naming only the filename, and the direct
 * path lookup behind it.
 */
function vaultWith(path: string): App {
  const name = path.split('/').pop() ?? '';
  const file = Object.assign(Object.create(TFile.prototype) as TFile, {
    path,
    name,
    basename: name.replace(/\.[^.]+$/, ''),
    extension: name.split('.').pop(),
  });

  return {
    metadataCache: {
      getFirstLinkpathDest: (linkpath: string) =>
        linkpath === name || linkpath === path ? file : null,
    },
    vault: {
      getFileByPath: (wanted: string) => (wanted === path ? file : null),
      getResourcePath: (resolved: TFile) => `app://local/${resolved.path}`,
    },
  } as unknown as App;
}

const app = vaultWith('Attachments/photo.jpg');

describe('resolveImageFile', () => {
  it('resolves an embed, which is what Obsidian itself writes', () => {
    expect(resolveImageFile(app, '![[photo.jpg]]')?.path).toBe('Attachments/photo.jpg');
  });

  it('resolves a plain link', () => {
    expect(resolveImageFile(app, '[[photo.jpg]]')?.path).toBe('Attachments/photo.jpg');
  });

  it('resolves an embed carrying a display alias', () => {
    expect(resolveImageFile(app, '![[photo.jpg|thumbnail]]')?.path).toBe('Attachments/photo.jpg');
  });

  it('resolves a bare vault path, which never was a link at all', () => {
    expect(resolveImageFile(app, 'Attachments/photo.jpg')?.path).toBe('Attachments/photo.jpg');
  });

  it('is null for an external URL, which has no file behind it', () => {
    expect(resolveImageFile(app, 'https://example.com/photo.jpg')).toBeNull();
  });

  it('is null for a value naming nothing that exists', () => {
    expect(resolveImageFile(app, '![[missing.jpg]]')).toBeNull();
  });
});

describe('resolveImagePath', () => {
  it('gives an embedded image a resource URL rather than nothing', () => {
    // The bug in one line: this used to be null, so the card fell through to
    // its placeholder for a meal whose picture was sitting right there.
    expect(resolveImagePath(app, '![[photo.jpg]]')).toBe('app://local/Attachments/photo.jpg');
  });

  it('passes an external URL straight through', () => {
    expect(resolveImagePath(app, 'https://example.com/photo.jpg')).toBe(
      'https://example.com/photo.jpg'
    );
  });
});
