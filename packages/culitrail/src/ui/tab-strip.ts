/**
 * A tab bar and the panels under it, with swipe.
 *
 * All panels stay in the layout and visibility is a class rather than
 * `display: none`, so the wrapper always holds the height of the tallest one.
 * A wrapper that resized on every tab change would make the whole page jump
 * under a thumb that is already mid-gesture.
 */
import { Component, setIcon } from 'obsidian';

export interface TabDefinition {
  /** The label. Omit for an icon-only tab, which is how a fourth tab fits on a phone. */
  label?: string;
  /** A Lucide icon. Required when there is no label, since a blank tab cannot be pressed on purpose. */
  icon?: string;
  /** Read by a screen reader, and required for an icon-only tab. */
  ariaLabel?: string;
  /**
   * Called the first time this tab is opened.
   *
   * For a panel whose content costs something to produce. A tab nobody opens
   * should not read the disk.
   */
  onFirstOpen?: (panel: HTMLElement) => void;
}

export interface TabStrip {
  /** The panel bodies, in the order the tabs were given. Fill them after creating the strip. */
  panels: HTMLElement[];
  /** Switches to a tab by index, as the "read more" link in a description does. */
  activate(index: number): void;
  /** The panel wrapper, for a caller that wants to scroll it into view. */
  wrapper: HTMLElement;
}

export function createTabStrip(
  container: HTMLElement,
  component: Component,
  definitions: TabDefinition[]
): TabStrip {
  const bar = container.createDiv({ cls: 'culi-tab-bar' });
  const wrapper = container.createDiv({ cls: 'culi-tab-panels-wrapper' });

  const tabs: HTMLElement[] = [];
  const panels: HTMLElement[] = [];
  const opened = new Set<number>();

  definitions.forEach((definition, index) => {
    const tab = bar.createEl('button', {
      cls: definition.label ? 'culi-tab-btn' : 'culi-tab-btn culi-tab-btn--icon',
      text: definition.label,
      attr: definition.ariaLabel ? { 'aria-label': definition.ariaLabel } : {},
    });
    if (definition.icon) setIcon(tab.createSpan(), definition.icon);
    tabs.push(tab);
    panels.push(wrapper.createDiv({ cls: 'culi-tab-panel' }));
    tab.addEventListener('click', () => activate(index));
  });

  function activate(index: number): void {
    panels.forEach((panel, i) => panel.toggleClass('culi-tab-panel--active', i === index));
    tabs.forEach((tab, i) => tab.toggleClass('culi-tab-active', i === index));

    // The underline is positioned from the tab's measured box rather than from
    // its index, because the tabs are not all the same width: a label tab
    // flexes and an icon tab does not.
    const active = tabs[index];
    if (active) {
      bar.setCssProps({
        '--culi-tab-indicator-left': `${active.offsetLeft}px`,
        '--culi-tab-indicator-width': `${active.offsetWidth}px`,
      });
    }

    if (!opened.has(index)) {
      opened.add(index);
      definitions[index]?.onFirstOpen?.(panels[index]);
    }
  }

  attachSwipe(wrapper, component, {
    count: definitions.length,
    current: () => tabs.findIndex((tab) => tab.hasClass('culi-tab-active')),
    activate,
  });

  activate(0);

  return { panels, activate, wrapper };
}

/** Below this many pixels a movement is a tap that wandered, not a swipe. */
const SWIPE_DISTANCE = 40;
/** Beyond this, the finger was dragging rather than flicking. */
const SWIPE_TIME_MS = 400;
/** Movement before the gesture commits to an axis. */
const AXIS_LOCK = 8;
/** How much more horizontal than vertical a movement has to be to count as a swipe. */
const AXIS_BIAS = 1.5;

interface SwipeTarget {
  count: number;
  current: () => number;
  activate: (index: number) => void;
}

/**
 * Horizontal swipe between tabs, without breaking vertical scrolling.
 *
 * The gesture locks to an axis after the first few pixels and only then
 * starts preventing default. Deciding earlier would swallow the scroll of a
 * long ingredients list; deciding later would let Obsidian's own sidebar
 * gesture fire first.
 */
function attachSwipe(container: HTMLElement, component: Component, target: SwipeTarget): void {
  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let axis: 'horizontal' | 'vertical' | null = null;

  const onStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startedAt = Date.now();
    axis = null;
  };

  const onMove = (event: TouchEvent): void => {
    if (axis === 'vertical') return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - startX);
    const dy = Math.abs(touch.clientY - startY);

    if (axis === null && (dx > AXIS_LOCK || dy > AXIS_LOCK)) {
      axis = dx >= dy * AXIS_BIAS ? 'horizontal' : 'vertical';
    }

    if (axis === 'horizontal') {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  const onEnd = (event: TouchEvent): void => {
    if (axis !== 'horizontal') return;
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < SWIPE_DISTANCE || Date.now() - startedAt > SWIPE_TIME_MS) return;

    const current = target.current();
    if (current < 0) return;
    const next = dx < 0 ? Math.min(current + 1, target.count - 1) : Math.max(current - 1, 0);
    if (next !== current) target.activate(next);
  };

  // Added directly rather than through `registerDomEvent`, which cannot pass
  // listener options: `touchmove` has to be non-passive to call
  // preventDefault(), and `touchstart` is passive so it never delays a scroll.
  // The cleanup below is what `registerDomEvent` would otherwise have given.
  container.addEventListener('touchstart', onStart, { passive: true });
  container.addEventListener('touchmove', onMove, { passive: false });
  container.addEventListener('touchend', onEnd, { passive: true });

  component.register(() => {
    container.removeEventListener('touchstart', onStart);
    container.removeEventListener('touchmove', onMove);
    container.removeEventListener('touchend', onEnd);
  });
}
