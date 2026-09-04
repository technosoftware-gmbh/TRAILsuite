/**
 * Dragging a meal onto a day.
 *
 * Two implementations, because there is no one API that works on both.
 * Desktop uses HTML5 drag-and-drop, which also gets dragging a meal note in
 * from the file explorer for free. Mobile cannot: setting `draggable` there
 * suppresses touch scrolling without providing a working drag, so it is a
 * long press plus touch events and a ghost element that follows the finger.
 */
import { App, Platform, TFile } from 'obsidian';

export type DropPayload = { kind: 'entry'; id: string } | { kind: 'meal'; path: string };

/**
 * Where the drop happened, in viewport coordinates.
 *
 * Passed through so a caller can anchor a popover to the point a card landed
 * at. A card is not on screen until the repaint that follows the drop, so
 * anchoring to the card itself is not available at this moment.
 */
export interface DropPoint {
  x: number;
  y: number;
}

export type DropHandler = (payload: DropPayload, day: string | undefined, at: DropPoint) => void;

/** How long a press has to last before it is a drag rather than a tap. */
const LONG_PRESS_MS = 500;

/** How far above the finger the ghost sits, so the card is not under the thumb. */
const GHOST_OFFSET_Y = 60;
const GHOST_OFFSET_X = 10;

/**
 * Connects a column element to its handler.
 *
 * A WeakMap rather than a property on the element, because `touchend` fires on
 * the document and has to hit-test its way back to a column: it finds an
 * element, not a closure. Weak so a column removed by a re-render is collected
 * with its handler.
 */
const handlers = new WeakMap<HTMLElement, DropHandler>();

interface ActiveDrag {
  payload: DropPayload;
  origin: HTMLElement;
  ghost: HTMLElement;
}

let dragging: ActiveDrag | null = null;

function columnAt(x: number, y: number): HTMLElement | null {
  return activeDocument.elementFromPoint(x, y)?.closest<HTMLElement>('[data-day]') ?? null;
}

function highlight(column: HTMLElement | null): void {
  activeDocument
    .querySelectorAll('.culi-mpv-drop-active')
    .forEach((element) => element.removeClass('culi-mpv-drop-active'));
  column?.addClass('culi-mpv-drop-active');
}

function endDrag(): void {
  if (!dragging) return;
  dragging.ghost.remove();
  dragging.origin.removeClass('culi-mpv-card--dragging');
  highlight(null);
  dragging = null;

  activeDocument.removeEventListener('touchmove', onTouchMove);
  activeDocument.removeEventListener('touchend', onTouchEnd);
  activeDocument.removeEventListener('touchcancel', endDrag);
}

function onTouchMove(event: TouchEvent): void {
  if (!dragging) return;
  // Only suppresses scrolling once a drag is actually under way, which is why
  // the listener is non-passive and why it is added on long press rather than
  // on touchstart.
  event.preventDefault();

  const touch = event.touches[0];
  dragging.ghost.setCssProps({
    left: `${touch.clientX - GHOST_OFFSET_X}px`,
    top: `${touch.clientY - GHOST_OFFSET_Y}px`,
  });
  highlight(columnAt(touch.clientX, touch.clientY));
}

function onTouchEnd(event: TouchEvent): void {
  if (!dragging) return;
  // Suppresses the synthetic click browsers fire after a touch sequence, which
  // would otherwise open the meal the moment it was dropped.
  event.preventDefault();

  const touch = event.changedTouches[0];
  const column = columnAt(touch.clientX, touch.clientY);
  const handler = column ? handlers.get(column) : undefined;
  if (column && handler) {
    handler(dragging.payload, column.dataset.day || undefined, {
      x: touch.clientX,
      y: touch.clientY,
    });
  }

  endDrag();
}

export function makeDraggable(card: HTMLElement, entryId: string): void {
  if (!Platform.isMobile) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (event: DragEvent) => {
      // The entry id, not the meal path: a drag inside the grid moves this
      // specific card, and two cards can hold the same meal.
      event.dataTransfer?.setData('text/plain', entryId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    return;
  }

  // `number` rather than the Node handle type: this path only ever runs in a
  // window, and `window.setTimeout` returns a number there.
  let hold: number | null = null;

  const cancel = (): void => {
    if (hold === null) return;
    window.clearTimeout(hold);
    hold = null;
  };

  card.addEventListener('touchstart', (event: TouchEvent) => {
    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    hold = window.setTimeout(() => {
      hold = null;

      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.addClass('culi-mpv-card--ghost');
      ghost.setCssProps({
        width: `${card.getBoundingClientRect().width}px`,
        left: `${startX - GHOST_OFFSET_X}px`,
        top: `${startY - GHOST_OFFSET_Y}px`,
      });
      activeDocument.body.appendChild(ghost);
      card.addClass('culi-mpv-card--dragging');

      dragging = { payload: { kind: 'entry', id: entryId }, origin: card, ghost };

      // On the document, so the finger may leave the card it started on.
      activeDocument.addEventListener('touchmove', onTouchMove, { passive: false });
      activeDocument.addEventListener('touchend', onTouchEnd);
      activeDocument.addEventListener('touchcancel', endDrag);
    }, LONG_PRESS_MS);
  });

  card.addEventListener('touchend', cancel);
  card.addEventListener('touchcancel', cancel);
}

/**
 * A meal note dragged in from the file explorer.
 *
 * Obsidian sets `text/plain` to an `obsidian://open?...` URI rather than a
 * path, and its own drag manager is often cleared before `drop` fires, so
 * both are tried and the URI is decoded by hand.
 */
function explorerMealPath(app: App, event: DragEvent): string | null {
  const raw = event.dataTransfer?.getData('text/plain')?.trim() ?? '';

  if (raw.endsWith('.md') && !raw.includes('?')) return raw;

  const query = raw.startsWith('obsidian://open?')
    ? raw.slice('obsidian://open?'.length)
    : raw.startsWith('open?')
      ? raw.slice('open?'.length)
      : '';

  if (query) {
    const file = new URLSearchParams(query).get('file');
    if (file) {
      const decoded = decodeURIComponent(file);
      return decoded.endsWith('.md') ? decoded : `${decoded}.md`;
    }
  }

  const dragged = (app as unknown as { dragManager?: { draggable?: { file?: unknown } } })
    .dragManager?.draggable?.file;
  return dragged instanceof TFile && dragged.extension === 'md' ? dragged.path : null;
}

export function makeDropTarget(
  column: HTMLElement,
  day: string | undefined,
  app: App,
  onDrop: DropHandler
): void {
  // Recovered by the touch path's hit-test. Empty string means the queue,
  // which `dataset` cannot express as undefined.
  column.dataset.day = day ?? '';
  handlers.set(column, onDrop);

  // On mobile nothing below fires; every drop arrives through `touchend`.
  if (Platform.isMobile) return;

  column.addEventListener('dragover', (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    column.addClass('culi-mpv-drop-active');
  });

  column.addEventListener('dragleave', (event: DragEvent) => {
    // Only when the pointer has left the column itself rather than moved onto
    // a card inside it, which fires dragleave on the column too.
    if (!column.contains(event.relatedTarget as Node | null)) {
      column.removeClass('culi-mpv-drop-active');
    }
  });

  column.addEventListener('drop', (event: DragEvent) => {
    event.preventDefault();
    column.removeClass('culi-mpv-drop-active');

    const mealPath = explorerMealPath(app, event);
    if (mealPath) {
      onDrop({ kind: 'meal', path: mealPath }, day, { x: event.clientX, y: event.clientY });
      return;
    }

    const id = event.dataTransfer?.getData('text/plain') ?? '';
    if (id) onDrop({ kind: 'entry', id }, day, { x: event.clientX, y: event.clientY });
  });
}
