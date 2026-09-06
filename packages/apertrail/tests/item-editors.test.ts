/**
 * The item editors, driven rather than read.
 *
 * These had no test at all. The boundary this package drew put "App-dependent
 * DOM building" out of scope, which was defensible while an editor was four
 * fields written once -- and stopped being defensible the moment two features
 * were shipped through them on a green suite. "Variante hinzufügen doesn't
 * work" was reported from real use, and nothing here could have said so.
 *
 * What is tested is the behaviour, not the markup: a click adds a row, the
 * first one takes the line's own price over, ticking one unticks the rest.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async () => (await import('./fake-dom')).obsidianMock());

import { buttonLabelled, control, resetSettings, rowsNamed } from './fake-dom';
import { LegEditorModal, StopEditorModal } from '../src/trips/ui/item-editor-modals';
import { emptyChoice } from '../src/trips/ui/itinerary-block';
import { TripLegInput } from '../src/trips/trip-note';
import { t } from '../src/lang/I18nManager';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { aLegInput, aStopInput } from './fixtures';
import { makeFakeVault } from './fake-vault';

const ADD = () => t('modals.tripEditor.addVariant');
const NAME = () => t('modals.tripEditor.variantName');
const OPTIONAL = () => t('modals.tripEditor.optional');

beforeEach(() => {
  resetSettings();
  vi.restoreAllMocks();
});

/**
 * The editor works on a copy of what it was handed, so every assertion here
 * reads what Save hands back rather than the object passed in. That is not a
 * detail of the test: an editor that mutated the caller's line would be
 * editing the board the itinerary is still rendering from.
 */
function openLeg(over: Partial<TripLegInput> = {}) {
  const value = aLegInput({ carrier: 'Hurtigruten', cost: 4479, currency: 'CHF', ...over });
  const saved: TripLegInput[] = [];
  const modal = new LegEditorModal(
    makeFakeVault().app,
    DEFAULT_SETTINGS,
    value,
    (result) => saved.push(result),
    ['Thomas'],
    null
  );
  modal.open();

  const save = (): TripLegInput => {
    buttonLabelled(t('modals.tripEditor.save'))?.click?.();
    const result = saved[saved.length - 1];
    if (!result) throw new Error('the editor saved nothing');
    return result;
  };
  return { modal, value, saved, save };
}

describe('adding a price to a leg', () => {
  it('offers the button', () => {
    openLeg();

    expect(buttonLabelled(ADD())).toBeDefined();
  });

  /** The report: clicking it did nothing. */
  it('adds a row when the button is clicked', () => {
    openLeg();
    const before = rowsNamed(NAME()).length;

    buttonLabelled(ADD())?.click?.();

    expect(rowsNamed(NAME()).length).toBe(before + 1);
  });

  /**
   * Every row of a variant is identically labelled, so a second set appearing
   * under the first reads as nothing having happened -- which is how a working
   * button got reported as broken. The number is what tells them apart.
   */
  it('numbers each one', () => {
    openLeg();

    buttonLabelled(ADD())?.click?.();
    buttonLabelled(ADD())?.click?.();

    expect(rowsNamed(t('modals.tripEditor.variantNumber', { number: 1 }))).toHaveLength(1);
    expect(rowsNamed(t('modals.tripEditor.variantNumber', { number: 2 }))).toHaveLength(1);
  });

  /**
   * A price already typed is the price of one of these. Leaving it above would
   * be a number nothing reads, and clearing it without moving it would lose it.
   */
  it('moves the leg own figure into the first one', () => {
    const { save } = openLeg();

    buttonLabelled(ADD())?.click?.();
    const leg = save();

    expect(leg.variants[0]?.cost).toBe(4479);
    expect(leg.variants[0]?.currency).toBe('CHF');
    expect(leg.cost).toBeNull();
  });

  it('leaves the second one empty rather than copying the first', () => {
    const { save } = openLeg();

    buttonLabelled(ADD())?.click?.();
    buttonLabelled(ADD())?.click?.();
    const leg = save();

    expect(leg.variants).toHaveLength(2);
    expect(leg.variants[1]?.cost).toBeNull();
  });

  /** A set of alternatives with two ticks is not a choice. */
  it('unticks the others when one is chosen', () => {
    const { save } = openLeg();
    buttonLabelled(ADD())?.click?.();
    buttonLabelled(ADD())?.click?.();

    // Each tick re-renders, so the rows are looked up again rather than held
    // across the change -- exactly as a reader clicking twice would find them.
    rowsNamed(NAME())[0]
      ?.controls.find((c) => c.kind === 'toggle')
      ?.change?.(true as never);
    rowsNamed(NAME())[1]
      ?.controls.find((c) => c.kind === 'toggle')
      ?.change?.(true as never);

    expect(save().variants.map((variant) => variant.chosen)).toEqual([false, true]);
  });

  it('hands the variants back on save', () => {
    const { saved } = openLeg();
    buttonLabelled(ADD())?.click?.();

    buttonLabelled(t('modals.tripEditor.save'))?.click?.();

    expect((saved[0] as { variants: unknown[] }).variants).toHaveLength(1);
  });
});

describe('a fresh line does not inherit another line variants', () => {
  /**
   * The itinerary block's three drafts all take their empty choice from one
   * place. It was a constant, and spreading a constant copies its array by
   * reference: a price added to one new line was on every new line made after
   * it. A fresh object per call is the fix, and this is the check that it is
   * still a fresh object.
   */
  it('gives every draft its own list', () => {
    expect(emptyChoice().variants).not.toBe(emptyChoice().variants);
  });

  /**
   * The drafts spread one shared constant, and a spread copies an array by
   * reference: adding a price to one new line put it on every new line made
   * afterwards, for the rest of the session.
   */
  it('starts empty however many were added to the line before it', () => {
    const saved: { variants: unknown[] }[] = [];
    const open = (placeTitle: string): void => {
      const modal = new StopEditorModal(
        makeFakeVault().app,
        DEFAULT_SETTINGS,
        aStopInput({ placeTitle }),
        (result) => saved.push(result),
        ['Thomas'],
        null
      );
      modal.open();
    };

    open('Tromsø');
    buttonLabelled(ADD())?.click?.();
    buttonLabelled(t('modals.tripEditor.save'))?.click?.();

    open('Alta');
    buttonLabelled(t('modals.tripEditor.save'))?.click?.();

    expect(saved[0]?.variants).toHaveLength(1);
    expect(saved[1]?.variants).toHaveLength(0);
  });
});

describe('marking a line optional', () => {
  it('offers the switch on a leg', () => {
    openLeg();

    expect(rowsNamed(OPTIONAL())).toHaveLength(1);
  });

  /** The second switch is meaningless until the first is on, and is not drawn. */
  it('offers the taken switch only once it is optional', () => {
    const { save } = openLeg();
    expect(rowsNamed(t('modals.tripEditor.optionalChosen'))).toHaveLength(0);

    control(OPTIONAL(), 'toggle')?.change?.(true as never);

    expect(rowsNamed(t('modals.tripEditor.optionalChosen'))).toHaveLength(1);
    expect(save().optional).toBe(true);
  });

  /** Turning it off must leave nothing behind that a later reader would take for a decision. */
  it('clears taken when it stops being optional', () => {
    const { save } = openLeg({ optional: true, chosen: true });

    control(OPTIONAL(), 'toggle')?.change?.(false as never);

    expect(save().chosen).toBe(false);
  });
});
