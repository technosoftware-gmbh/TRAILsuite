/**
 * What every note's editor shows, in what order, under which words.
 *
 * Reported from the vault with two screenshots side by side: a trip asked for
 * its Untertitel, its Bild, its Hoehepunkte, its Zusammenfassung and its
 * Galerie, in that order; an excursion asked for "Kurz gesagt", then the
 * summary, then the picture, then "Weitere Bilder", and had no highlights at
 * all. Two forms asking one question in two orders under two words is how
 * somebody comes to believe they are two fields.
 *
 * So the order and the labels are asserted rather than described. The labels
 * themselves are one set of keys now, which is what stops the two from
 * drifting apart again: `modals.tripEditor.subtitleField` and its four
 * neighbours do not exist, so a call site reaching for one fails
 * `translation-keys.test.ts` rather than quietly reintroducing a second
 * spelling.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => (await import('./fake-dom')).obsidianMock());

import { control, fakeEl, resetSettings, settings } from './fake-dom';
import { coverFields, coverInputOf } from '../src/ui/components/cover-fields';
import { CoverInput } from '../src/vault/write-cover';
import { t } from '../src/lang/I18nManager';

const SUBTITLE = () => t('modals.noteCover.description');
const PICTURE = () => t('modals.noteCover.image');
const HIGHLIGHTS = () => t('modals.noteCover.highlights');
const SUMMARY = () => t('modals.noteSummary.field');
const GALLERY = () => t('modals.noteCover.gallery');

function emptyCover(over: Partial<CoverInput> = {}): CoverInput {
  return { description: null, image: null, gallery: [], highlights: [], ...over };
}

function draw(value: CoverInput, over: Record<string, unknown> = {}) {
  coverFields(fakeEl() as never, {
    app: {} as never,
    value,
    notePath: () => 'Plätze/Ausflüge/Wikinger.md',
    refresh: () => {},
    summary: { value: '', onChange: () => {} },
    ...over,
  });
}

/** The rows on screen, in the order they were built. */
const rowNames = (): string[] => settings.map((row) => row.name).filter((name) => name !== '');

beforeEach(() => resetSettings());

describe('the order every note is asked about itself in', () => {
  it("is the trip editor's: the line, the picture, the highlights, the summary, the gallery", () => {
    draw(emptyCover());

    const order = rowNames();
    const at = (name: string): number => order.indexOf(name);

    expect(at(SUBTITLE())).toBeGreaterThanOrEqual(0);
    expect(at(SUBTITLE())).toBeLessThan(at(PICTURE()));
    expect(at(PICTURE())).toBeLessThan(at(HIGHLIGHTS()));
    expect(at(HIGHLIGHTS())).toBeLessThan(at(SUMMARY()));
    expect(at(SUMMARY())).toBeLessThan(at(GALLERY()));
  });

  /**
   * A ship carries its own one-line description, written by its own schema and
   * already on its form, so this section leaves that row out. It takes the
   * other four, which is what it did not do before: a ship had no highlights
   * and its summary sat above its picture.
   */
  it('leaves out only the line a ship draws itself', () => {
    draw(emptyCover(), { includeDescription: false });

    const order = rowNames();
    expect(order).not.toContain(SUBTITLE());
    expect(order.indexOf(PICTURE())).toBeLessThan(order.indexOf(HIGHLIGHTS()));
    expect(order.indexOf(HIGHLIGHTS())).toBeLessThan(order.indexOf(SUMMARY()));
  });

  /** Creation has no note to read a summary out of, and the rest of the section still draws. */
  it('draws the highlights for a note with no summary row', () => {
    coverFields(fakeEl() as never, {
      app: {} as never,
      value: emptyCover(),
      notePath: () => '',
      refresh: () => {},
    });

    expect(rowNames()).toContain(HIGHLIGHTS());
    expect(rowNames()).not.toContain(SUMMARY());
  });
});

describe('the highlights box', () => {
  it("shows one line per highlight, in the note's order", () => {
    draw(emptyCover({ highlights: ['Nordkap', 'Hammerfest'] }));

    expect(control(HIGHLIGHTS(), 'textarea')?.value).toBe('Nordkap\nHammerfest');
  });

  it('takes what was typed back as lines', () => {
    const value = emptyCover();
    draw(value);

    control(HIGHLIGHTS(), 'textarea')?.change?.('Nordkap\nHammerfest' as never);

    expect(value.highlights).toEqual(['Nordkap', 'Hammerfest']);
  });

  /**
   * The blank line survives the box and is dropped by the writer. Dropping it
   * here would take it back out from under the cursor the moment somebody
   * pressed return.
   */
  it('leaves a blank line alone while it is being typed', () => {
    const value = emptyCover();
    draw(value);

    control(HIGHLIGHTS(), 'textarea')?.change?.('Nordkap\n' as never);

    expect(value.highlights).toEqual(['Nordkap', '']);
  });
});

describe('the cover a record already has', () => {
  it('carries the highlights across, as a copy', () => {
    const record = {
      description: 'Viking House',
      image: null,
      gallery: [],
      highlights: ['Nordkap'],
    };
    const input = coverInputOf(record);

    input.highlights.push('Hammerfest');

    expect(record.highlights).toEqual(['Nordkap']);
  });
});
