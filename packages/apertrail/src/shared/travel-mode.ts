/**
 * How a mode of travel is shown: its icon and its name.
 *
 * `mode` is free text on the way in -- both a leg and a vehicle read whatever
 * the note says, and only the editors constrain it to TRIP_LEG_MODES -- so
 * both functions here answer for a value nobody recognises. That is the whole
 * reason they exist: `t()` returns the key path when a key is missing, so
 * translating a hand-written `mode: ferry` through the label table directly
 * printed `modals.tripEditor.mode.ferry` on the page.
 *
 * The mode itself is never translated into the note. It stays an English
 * identifier in the frontmatter, exactly as lang/I18nManager.ts promises.
 */
import { t } from '../lang/I18nManager';
import { TRIP_LEG_MODES } from '../trips/trip-note';

const MODE_ICONS: Record<string, string> = {
  train: 'train-front',
  plane: 'plane',
  car: 'car',
  bus: 'bus',
  boat: 'ship',
  other: 'route',
};

/** 'route' for an unset or unrecognised mode, which is also what `other` reads as: a journey with nothing said about how. */
export function travelModeIcon(mode: string | null | undefined): string {
  return (mode && MODE_ICONS[mode]) || 'route';
}

/**
 * The translated name, or the note's own word when it is not one of the six.
 *
 * Null rather than an empty string for an unset mode, so a caller building a
 * list of chips can drop it with a `filter` rather than a length check.
 */
export function travelModeLabel(mode: string | null | undefined): string | null {
  const value = mode?.trim();
  if (!value) return null;
  return (TRIP_LEG_MODES as readonly string[]).includes(value)
    ? t(`modals.tripEditor.mode.${value}`)
    : value;
}
