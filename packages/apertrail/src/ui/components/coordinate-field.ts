/**
 * A latitude and longitude, as one string.
 *
 * Lived in places/ui/photo-spot-editor-modals.ts until the place editor
 * needed the same pair, which is the second consumer that makes it a shared
 * module. It stays inside this package rather than moving into the core: it
 * is how a control reads what somebody pasted, not a statement about a note
 * or a fact about the world.
 */

/** "46.9895, 6.9243", as pasted from a map view. Two fields would be more precise and nobody pastes in two halves. */
export function formatCoordinatePair(pair: [string, string] | null): string {
  return pair ? `${pair[0]}, ${pair[1]}` : '';
}

/**
 * The pair back out, or null for anything that is not two numbers.
 *
 * Kept as the strings that were typed rather than parsed to numbers: a
 * coordinate written to five decimal places should still say five decimal
 * places when it is read back, and Number() would decide that for itself.
 */
export function parseCoordinatePair(raw: string): [string, string] | null {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length !== 2) return null;
  if (!Number.isFinite(Number(parts[0])) || !Number.isFinite(Number(parts[1]))) return null;
  return [parts[0], parts[1]];
}
