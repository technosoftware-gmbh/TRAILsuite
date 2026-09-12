/**
 * The pill the UI kit repeats everywhere: a label, sometimes an icon,
 * sometimes a modifier class. Extracted from the photo spot block when the
 * itinerary started drawing the same shape, because two copies of a chip
 * drift in padding first and in meaning second.
 */
import { setIcon } from 'obsidian';

export function renderChip(
  container: HTMLElement,
  text: string,
  icon?: string,
  cls?: string
): void {
  const chip = container.createSpan({ cls: cls ? `apt-chip ${cls}` : 'apt-chip' });
  if (icon) setIcon(chip.createSpan({ cls: 'apt-chip-icon' }), icon);
  chip.createSpan({ text });
}
