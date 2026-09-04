/**
 * A small floating popover for putting a meal slot on an entry.
 *
 * Shown after a drop, when the entry that has just landed carries no slot. A
 * dropped meal almost always wants one, and asking for it there and then is
 * cheaper than making somebody find the card's menu afterwards.
 *
 * Only the four slots, and deliberately no free-text field beside them: the
 * four are a fixed vocabulary that the grid columns and the grocery
 * attribution both key off, and a fifth value invented at a drop site would
 * have nowhere to appear. See the architecture note in CLAUDE.md.
 *
 * Positioned by hand rather than through Obsidian's `Menu`, because it anchors
 * to the point a card was dropped at, which a menu cannot do.
 */
import { MEAL_SLOT_KEYS, mealSlotLabel, type MealSlotKey } from '../../lang/vocabulary';
import { t } from '../../lang/I18nManager';

/** Where the popover points. A drop gives a point; a button gives itself. */
export type PopoverAnchor =
  { kind: 'point'; x: number; y: number } | { kind: 'element'; element: HTMLElement };

/** Clearance kept from the viewport edge, and between the popover and its anchor. */
const MARGIN = 8;

export function showMealSlotPopover(
  anchor: PopoverAnchor,
  onChoose: (slot: MealSlotKey | undefined) => void
): void {
  // On `activeDocument`, not `document`: Obsidian can put a leaf in a separate
  // window, and a popover appended to the main document would open there.
  const popover = activeDocument.body.createDiv({ cls: 'culi-meal-slot-popover' });

  const dismiss = (): void => {
    popover.remove();
    activeDocument.removeEventListener('pointerdown', onOutside, true);
  };

  const choose = (slot: MealSlotKey | undefined): void => {
    dismiss();
    onChoose(slot);
  };

  const close = popover.createEl('button', {
    cls: 'culi-meal-slot-close',
    text: '×',
    attr: { 'aria-label': t('planning.slotPopover.dismiss') },
  });
  close.addEventListener('click', dismiss);

  popover.createDiv({ cls: 'culi-meal-slot-label', text: t('planning.slotPopover.question') });

  const chips = popover.createDiv({ cls: 'culi-meal-slot-chips' });
  for (const slot of MEAL_SLOT_KEYS) {
    const chip = chips.createEl('button', {
      cls: 'culi-meal-slot-chip',
      text: mealSlotLabel(slot),
    });
    chip.addEventListener('click', () => choose(slot));
  }

  // Leaving the slot unset is a real answer: a meal planned for a day without
  // saying which meal is something the model supports, so there is a way to say
  // it that is not "dismiss and hope".
  const skip = popover.createEl('button', {
    cls: 'culi-meal-slot-skip',
    text: t('planning.slotPopover.anytime'),
  });
  skip.addEventListener('click', () => choose(undefined));

  popover.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    dismiss();
  });

  function onOutside(event: PointerEvent): void {
    if (!popover.contains(event.target as Node)) dismiss();
  }

  position(popover, anchor);

  // Deferred by a tick, or the pointerup that ends the drag which opened this
  // would be seen as a click outside it and close it immediately.
  window.setTimeout(() => activeDocument.addEventListener('pointerdown', onOutside, true), 0);
}

/**
 * Puts the popover next to its anchor, flipping it above when it would run off
 * the bottom.
 *
 * Measured after a frame, because the size is not known until it is in the
 * document, and hidden until then so it is not seen jumping into place.
 */
function position(popover: HTMLElement, anchor: PopoverAnchor): void {
  popover.setCssProps({ position: 'fixed', visibility: 'hidden', top: '0', left: '0' });

  window.requestAnimationFrame(() => {
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;

    const rect = anchor.kind === 'element' ? anchor.element.getBoundingClientRect() : null;
    let x = rect ? rect.left : (anchor as { x: number }).x;
    let y = rect ? rect.bottom + MARGIN : (anchor as { y: number }).y + MARGIN;

    if (x + width > window.innerWidth - MARGIN) {
      x = Math.max(MARGIN, window.innerWidth - width - MARGIN);
    }
    if (y + height > window.innerHeight - MARGIN) {
      y = rect ? rect.top - height - MARGIN : (anchor as { y: number }).y - height - MARGIN;
    }

    popover.setCssProps({
      left: `${Math.max(MARGIN, x)}px`,
      top: `${Math.max(MARGIN, y)}px`,
      visibility: '',
    });
  });
}
