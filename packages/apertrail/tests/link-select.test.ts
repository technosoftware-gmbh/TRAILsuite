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

/**
 * The choice that is a title like any other but has to read as something else.
 *
 * Hamburg's Bundesland is Hamburg, and the value that expresses is the plain
 * title -- so it belongs in this control rather than in a switch beside it,
 * where two controls would write one field and the dialog could show one
 * answer while saving another. What it needs from the control is a label of
 * its own, and not to be offered twice.
 */
describe('renderLinkSelect with a city-state option', () => {
  const extra = { value: 'Hamburg', label: 'Hamburg itself (city-state)' };

  it('offers it under the empty choice, ahead of the real notes', () => {
    const { select } = render({ extraOption: extra });
    expect(optionValues(select)).toEqual(['', 'Hamburg', 'Brugg', 'Stavanger']);
    expect(select.children[1].text).toBe('Hamburg itself (city-state)');
  });

  /**
   * The rule that keeps a value the vault no longer has from being erased
   * would otherwise unshift this one under its bare title, and the note would
   * appear twice: once saying what it means and once not.
   */
  it('does not also offer it as a bare title when it is the current value', () => {
    const { select } = render({ value: 'Hamburg', extraOption: extra });
    expect(optionValues(select)).toEqual(['', 'Hamburg', 'Brugg', 'Stavanger']);
    expect(select.value).toBe('Hamburg');
  });

  it('reports the plain title when it is chosen, because that is what the note says', () => {
    const { select, picked } = render({ extraOption: extra });
    change(select, 'Hamburg');
    expect(picked).toEqual(['Hamburg']);
  });

  /** Picking a real Bundesland afterwards is how a city stops being one, and it needs no second control to say so. */
  it('is left behind by picking an ordinary note', () => {
    const { select, picked } = render({ value: 'Hamburg', extraOption: extra });
    change(select, 'Brugg');
    expect(picked).toEqual(['Brugg']);
  });

  /** A value the vault no longer has is still offered, extra option or not. */
  it('keeps offering a stale value alongside it', () => {
    const { select } = render({ value: 'Preussen', extraOption: extra });
    expect(optionValues(select)).toEqual(['', 'Hamburg', 'Preussen', 'Brugg', 'Stavanger']);
  });
});
