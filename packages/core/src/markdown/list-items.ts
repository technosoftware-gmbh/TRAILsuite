/**
 * The list shapes a note body uses: bullets, numbered steps, and the
 * `- **Label:** value` row.
 *
 * Clean-room, written from the note format. See `sections.ts` for why that is
 * stated rather than assumed.
 *
 * App-free.
 */

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
/** `- **Protein (g):** 4.1g`, the shape a nutrition row takes. */
const LABELLED = /^\s*[-*+]\s+\*\*(.+?):?\*\*:?\s*(.*)$/;

/** The text of every bullet, in order. Lines that are not bullets are skipped. */
export function bulletItems(lines: readonly string[]): string[] {
  return lines
    .map((line) => BULLET.exec(line)?.[1]?.trim() ?? null)
    .filter((text): text is string => text !== null && text !== '');
}

/** The text of every numbered item, in order, without its number. */
export function numberedItems(lines: readonly string[]): string[] {
  return lines
    .map((line) => NUMBERED.exec(line)?.[1]?.trim() ?? null)
    .filter((text): text is string => text !== null && text !== '');
}

/** Either shape, for a section whose author was not consistent about which they used. */
export function listItems(lines: readonly string[]): string[] {
  return lines
    .map((line) => (NUMBERED.exec(line)?.[1] ?? BULLET.exec(line)?.[1])?.trim() ?? null)
    .filter((text): text is string => text !== null && text !== '');
}

export interface LabelledValue {
  label: string;
  /** '' when the row carries a label and nothing after it, which is a real state rather than an absence. */
  value: string;
}

/**
 * The `- **Label:** value` rows of a section.
 *
 * A row whose value is blank is kept, with `value: ''`. In the vault this was
 * written for, `- **Sodium:**` with nothing after it means the figure is not
 * known, and dropping the row would say the nutrient does not exist.
 */
export function labelledValues(lines: readonly string[]): LabelledValue[] {
  const values: LabelledValue[] = [];

  for (const line of lines) {
    const match = LABELLED.exec(line);
    if (!match) continue;

    const label = (match[1] ?? '').trim();
    if (label) values.push({ label, value: (match[2] ?? '').trim() });
  }
  return values;
}
