/**
 * Removing the navigation block from the top of a period note.
 *
 * It used to write one. Two lines, the chain upwards and the siblings either
 * side:
 *
 *   ⏮️[[2026|Yearly]] > [[2026-Q3|Quarterly]] > [[2026-07|Monthly]]⏭️
 *
 *   ⬅️[[2026-07-20|Juli 20, 2026]] < Juli 21, 2026 > [[2026-07-22|Juli 22, 2026]]➡️
 *
 * **The block was how you moved between periods before the plan view existed.**
 * The view now has the five levels, previous and next, Today, and a date picker
 * that jumps to any period at any level. What is left in the note is 365 pairs
 * of links a year that all have to be right and that nobody reads.
 *
 * So the writer strips instead of rebuilding, and the finder is what survives:
 * recognising a block by its shape at the top of the body is the part that was
 * hard and the part these tests pin. `docs/design/day-notes.md` has the
 * reasoning.
 *
 * **It removes the block's own lines and the blank lines around them, and
 * stops.** The vault's week notes carry a `---` on the line after the block,
 * and that rule is part of the migrated content rather than part of the block.
 * Taking it would be taking somebody's formatting while claiming to remove
 * navigation.
 *
 * Pure.
 */
/** A line that is part of a navigation block rather than content. */
function isNavLine(line: string): boolean {
  return /[\u{23EE}\u{23ED}\u{2B05}\u{27A1}]/u.test(line);
}

/**
 * The body with its navigation block removed, or unchanged.
 *
 * The block is the run of nav lines and blank lines at the very top of the
 * body. Scanning stops at the first line that is neither, so a `---` rule, a
 * heading or a paragraph ends it and nothing below is read, let alone touched.
 *
 * **A body with no block is returned byte for byte**, leading blank lines
 * included. The old writer consumed those on its way to putting a block in;
 * there is nothing to put in any more, and trimming somebody's file is not this
 * function's business.
 */
export function stripNavigationBlock(body: string): string {
  const lines = body.split('\n');

  let end = 0;
  let sawNav = false;
  while (end < lines.length) {
    const line = lines[end] ?? '';
    if (line.trim() === '') {
      end += 1;
      continue;
    }
    if (!isNavLine(line)) break;

    sawNav = true;
    end += 1;
  }

  if (!sawNav) return body;
  return lines.slice(end).join('\n');
}

/** True when a body already carries a navigation block at the top. */
export function hasNavigationBlock(body: string): boolean {
  for (const line of body.split('\n')) {
    if (line.trim() === '') continue;
    return isNavLine(line);
  }
  return false;
}
