/**
 * The sections a meal note carries after its instructions.
 *
 * Notes, Source, Variations, whatever a vault happens to write. CULItrail does
 * not know what they are and deliberately does not try: everything after the
 * instructions is offered back as a titled section, so a note is never
 * punished for holding something the plugin has no feature for.
 *
 * App-free.
 */

/** A heading of any level, tolerating the closing hashes some editors add. */
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;

export interface TrailingSection {
  heading: string;
  body: string;
}

/**
 * Splits trailing Markdown into its sections.
 *
 * Flat rather than nested: a `###` under a `##` starts a new section rather
 * than becoming part of the one above it. These are shown as separate cards,
 * and a card is a better unit than a hierarchy nobody asked for.
 *
 * **An excluded section takes its sub-sections with it**, which is the one place
 * the flatness is wrong. A caller excludes a heading because it renders that
 * section itself, and the reheating section has one sub-heading per appliance: a
 * flat split offered `## Steamer` back as a card of its own, so a dish showed its
 * appliance twice, once properly and once as a card of raw `[temp:: 95 °C]` text.
 * Cook history has no sub-headings, which is why this went unnoticed.
 *
 * Text before the first heading is dropped, because it has no title to show
 * it under. In practice there is none: the caller passes what followed the
 * instructions section, and the instruction splitter has already taken
 * everything up to the next heading.
 */
export function splitTrailingSections(
  markdown: string,
  exclude: string[] = [],
  /**
   * Headings that end an exclusion even when they sit deeper than it.
   *
   * A section another feature renders must not be swallowed by an excluded one.
   * The eating-history writer emits `## Eating History` while a vault's other sections
   * are `#`, so a `# Reheating` above it puts the log *inside* the reheating
   * section, and swallowing it would take the log off the page.
   */
  endExclusionAt: string[] = []
): TrailingSection[] {
  const excluded = new Set(
    exclude.map((heading) => heading.trim().toLowerCase()).filter((heading) => heading !== '')
  );
  const stops = new Set(
    endExclusionAt
      .map((heading) => heading.trim().toLowerCase())
      .filter((heading) => heading !== '')
  );

  const sections: TrailingSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  /** The level of the excluded section being skipped, or null when not skipping. */
  let skippingUnder: number | null = null;

  const flush = () => {
    if (current) sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
  };

  for (const line of markdown.split('\n')) {
    const match = HEADING_PATTERN.exec(line);
    if (!match) {
      if (current) current.lines.push(line);
      continue;
    }

    const level = match[1].length;
    const heading = match[2].trim();

    flush();
    current = null;

    // A heading deeper than the excluded one belongs to it, unless it names a
    // section something else renders. A heading at the same level or shallower
    // ends the exclusion either way, so a sibling section after it is still
    // offered.
    if (skippingUnder !== null && level > skippingUnder && !stops.has(heading.toLowerCase())) {
      continue;
    }
    skippingUnder = null;

    if (excluded.has(heading.toLowerCase())) {
      skippingUnder = level;
      continue;
    }

    current = { heading, lines: [] };
  }
  flush();

  return sections;
}
