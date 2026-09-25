import { describe, expect, it } from 'vitest';
import { linkResolver, linkTargetOf } from '../../src/vault/resolve-link';

const files = [
  { path: 'CRM/People/Anna Muster.md', basename: 'Anna Muster' },
  { path: '3 Projects/Garden/Garden.md', basename: 'Garden' },
  { path: 'Archive/Garden.md', basename: 'Garden' },
  { path: 'Places/Zürich.md', basename: 'Zürich' },
];

describe('linkResolver', () => {
  const resolve = linkResolver(files);

  it('resolves a bare title by folded title', () => {
    expect(resolve('anna muster')?.path).toBe('CRM/People/Anna Muster.md');
    expect(resolve('[[Anna Muster]]')?.path).toBe('CRM/People/Anna Muster.md');
  });

  it('cuts off an alias, a heading and a block reference first', () => {
    expect(resolve('Anna Muster|Anna')?.path).toBe('CRM/People/Anna Muster.md');
    expect(resolve('Anna Muster#Kontakt')?.path).toBe('CRM/People/Anna Muster.md');
    expect(resolve('Anna Muster^abc')?.path).toBe('CRM/People/Anna Muster.md');
  });

  it('resolves a folder/title target by the end of the path', () => {
    expect(resolve('Garden/Garden')?.path).toBe('3 Projects/Garden/Garden.md');
    expect(resolve('Archive/Garden.md')?.path).toBe('Archive/Garden.md');
  });

  it('takes the first by path where two notes share a title', () => {
    expect(resolve('Garden')?.path).toBe('3 Projects/Garden/Garden.md');
  });

  it('resolves nothing it cannot find, and nothing for an empty target', () => {
    expect(resolve('Nobody')).toBeNull();
    expect(resolve('')).toBeNull();
    expect(resolve('[[|alias only]]')).toBeNull();
  });

  it('matches a title whichever way its accents were stored', () => {
    expect(resolve('Zürich')?.path).toBe('Places/Zürich.md');
  });
});

describe('linkTargetOf', () => {
  it('is the target without brackets, alias or heading', () => {
    expect(linkTargetOf('[[Folder/Note#Part|Shown]]')).toBe('Folder/Note');
  });
});
