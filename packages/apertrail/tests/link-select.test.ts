/**
 * The dropdown that names another note. The row around it belongs to the
 * caller, so what is checked here is the control and nothing else.
 *
 * Driven through the fake DOM rather than left to a manual click, for the
 * reason tests/fake-dom.ts records: an editor control with no test is where
 * two features once shipped on a green suite.
 */
import { describe, expect, it } from 'vitest';
import { fakeEl, FakeEl } from './fake-dom';
import { CREATE_NEW_VALUE, renderLinkSelect } from '../src/ui/components/link-select';

function host(): FakeEl {
  return fakeEl('div');
}

function optionValues(select: FakeEl): string[] {
  return select.children.map((child) => child.attrs.value);
}

function change(select: FakeEl, value: string): void {
  select.value = value;
  for (const fn of select.listeners.change ?? []) fn();
}

function render(overrides: Partial<Parameters<typeof renderLinkSelect>[1]> = {}) {
  const picked: string[] = [];
  const container = host();
  const select = renderLinkSelect(container as unknown as HTMLElement, {
    titles: ['Brugg', 'Stavanger'],
    value: '',
    noneLabel: 'None',
    onChange: (title) => picked.push(title),
    ...overrides,
  }) as unknown as FakeEl;
  return { select, picked };
}

describe('renderLinkSelect', () => {
  it('offers none, then the notes that exist', () => {
    const { select } = render();
    expect(optionValues(select)).toEqual(['', 'Brugg', 'Stavanger']);
    expect(select.value).toBe('');
  });

  it('reports the title that was picked', () => {
    const { select, picked } = render();
    change(select, 'Stavanger');
    expect(picked).toEqual(['Stavanger']);
  });

  /**
   * The rule worth having a test for: a place whose city note was renamed
   * still says that city, and a dropdown that quietly dropped the value
   * would erase the link the next time anything else on the note was saved.
   */
  it('still offers a value the vault no longer has, and keeps it selected', () => {
    const { select } = render({ value: 'Kristiansund' });
    expect(optionValues(select)).toEqual(['', 'Kristiansund', 'Brugg', 'Stavanger']);
    expect(select.value).toBe('Kristiansund');
  });

  it('offers no way to create one when nothing can act on it', () => {
    const { select } = render({ createLabel: 'New city...' });
    expect(optionValues(select)).not.toContain(CREATE_NEW_VALUE);
  });

  it('offers the create entry last, after every note', () => {
    const { select } = render({ createLabel: 'New city...', onCreateNew: () => {} });
    expect(optionValues(select)).toEqual(['', 'Brugg', 'Stavanger', CREATE_NEW_VALUE]);
  });

  /** Choosing "create one" is not choosing a link, and a cancelled dialog must leave the field as it was found. */
  it('restores the previous choice before opening the dialog, and reports nothing', () => {
    let opened = 0;
    const { select, picked } = render({
      value: 'Brugg',
      createLabel: 'New city...',
      onCreateNew: () => {
        opened += 1;
      },
    });

    change(select, CREATE_NEW_VALUE);

    expect(opened).toBe(1);
    expect(select.value).toBe('Brugg');
    expect(picked).toEqual([]);
  });

  it('adopts a note the dialog created, keeping the create entry last', () => {
    const { select, picked } = render({
      createLabel: 'New city...',
      onCreateNew: (adopt) => adopt('Kopenhagen'),
    });

    change(select, CREATE_NEW_VALUE);

    expect(optionValues(select)).toEqual([
      '',
      'Brugg',
      'Stavanger',
      'Kopenhagen',
      CREATE_NEW_VALUE,
    ]);
    expect(select.value).toBe('Kopenhagen');
    expect(picked).toEqual(['Kopenhagen']);
  });

  it('ignores a dialog that came back with nothing', () => {
    const { select, picked } = render({
      value: 'Brugg',
      createLabel: 'New city...',
      onCreateNew: (adopt) => adopt('   '),
    });

    change(select, CREATE_NEW_VALUE);

    expect(select.value).toBe('Brugg');
    expect(picked).toEqual([]);
  });
});
