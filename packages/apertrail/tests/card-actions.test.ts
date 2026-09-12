/**
 * What a gallery card's 3-dot menu offers, and in what order.
 *
 * Pure for the same reason the related-trips block's actions are: an order
 * decided inside DOM building is an order no test can hold to.
 *
 * The suite it replaces guarded the opposite rule about labels. A place's
 * editor had been labelled with the trip's string, so a landmark's card
 * offered "Edit trip", and what was asserted after that was that no two
 * actions answer to the same words. The words themselves were the mistake:
 * the menu is opened on one card, so the card has already said which note it
 * means, and every edit entry says only "Edit" now. What is asserted instead
 * is that the two acts still open different things.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_ACTION_LABELS, cardActions } from '../src/ui/gallery/card-actions';
import { BLOCK_ACTION_LABELS } from '../src/trips/related-trips-actions';
import { enTranslations } from '../src/lang/translations/en';
import { deTranslations } from '../src/lang/translations/de';

describe('cardActions', () => {
  /** Edit, then the page this note prints. The related-trips block reads in the same order. */
  it('gives a trip its editor and its document, in that order', () => {
    expect(cardActions({ isTrip: true, hasEditor: false })).toEqual(['editTrip', 'tripDocument']);
  });

  it('gives everything else its editor and its prospect, in that order', () => {
    expect(cardActions({ isTrip: false, hasEditor: true })).toEqual(['edit', 'prospect']);
  });

  /**
   * A person or a company: this plugin does not shape those notes, and a menu
   * with nothing in it is worse than no menu. Nothing else lands here any
   * more, now that the cover is a section inside each editor rather than a
   * second entry of its own.
   */
  it('offers nothing at all to a note with no editor', () => {
    expect(cardActions({ isTrip: false, hasEditor: false })).toEqual([]);
  });
});

describe('CARD_ACTION_LABELS', () => {
  /**
   * One word for editing, whatever the note. The card names the note; the
   * menu does not have to name it a second time, and four strings for one act
   * are four strings to keep in step.
   */
  it('says the same thing about editing a trip and editing anything else', () => {
    expect(CARD_ACTION_LABELS.editTrip).toBe(CARD_ACTION_LABELS.edit);
  });

  /**
   * The label being shared is what makes this worth stating: the two entries
   * read alike and open different dialogs, so nothing but the action itself
   * tells them apart.
   */
  it('still keeps the two editors as two actions', () => {
    expect(cardActions({ isTrip: true, hasEditor: true })).toEqual([
      'editTrip',
      'tripDocument',
      'edit',
      'prospect',
    ]);
  });

  /** Two documents, so two words: a prospect is one page about one note, a trip document is the route across a dozen. */
  it('keeps the two printed pages apart', () => {
    expect(CARD_ACTION_LABELS.tripDocument).not.toBe(CARD_ACTION_LABELS.prospect);
  });

  /** The same keys the block uses, or a card and a note end up offering one thing under two names. */
  it("borrows the block's own words rather than writing its own", () => {
    expect(CARD_ACTION_LABELS.edit).toBe(BLOCK_ACTION_LABELS.edit);
    expect(CARD_ACTION_LABELS.prospect).toBe(BLOCK_ACTION_LABELS.prospect);
  });

  it('has both locales for every one of them', () => {
    for (const key of Object.values(CARD_ACTION_LABELS)) {
      for (const bundle of [enTranslations, deTranslations]) {
        const value = key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown> | undefined)?.[part],
            bundle
          );
        expect(typeof value, `${key} is missing`).toBe('string');
      }
    }
  });
});

/**
 * Every action the menu can decide on is one the view knows how to draw.
 *
 * A source-reading test, because the alternative could not fail: the mapping
 * from action to callback is DOM building, which this package does not test,
 * and the defect it guards is this repository's own recurring one -- the
 * ship's cabin dialog shipped as a command with no button anywhere and stayed
 * that way through two more entity types. An action added to the union and
 * forgotten in the view is a menu entry that never appears, and nothing else
 * would say so.
 *
 * Adding a member to `CardAction` and not to the view is what this goes red
 * on. It has been done on purpose and watched.
 */
describe('the view draws every action the menu decides on', () => {
  const view = readFileSync(
    join(__dirname, '..', 'src', 'ui', 'gallery', 'travel-gallery-view.ts'),
    'utf8'
  );

  it('has a branch for each, and a label that comes from the map', () => {
    for (const action of Object.keys(CARD_ACTION_LABELS)) {
      expect(view, `no branch for ${action}`).toContain(`action === '${action}'`);
      expect(view, `${action} names its own label`).toContain(`CARD_ACTION_LABELS.${action}`);
    }
  });

  /** A floor rather than a census: a read that found nothing would pass the check above over an empty list. */
  it('has actions to check, so a broken scan cannot pass silently', () => {
    expect(Object.keys(CARD_ACTION_LABELS).length).toBeGreaterThanOrEqual(4);
  });
});
