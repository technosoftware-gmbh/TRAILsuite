/**
 * Splitting a note body into its `#` headed sections.
 *
 * Clean-room: written from the shape of the notes in the vault this serves, not
 * from any existing parser. That matters here specifically. The plugins' own
 * meal parser descends from a GPL-3.0 codebase and cannot be relicensed, so
 * this module exists to give an MIT package the same job done from the format
 * rather than from that source.
 *
 * Deliberately domain-free. It knows about headings and lines; which heading
 * holds the reheating steps is the caller's vocabulary, not this file's.
 *
 * App-free.
 */

export interface MarkdownSection {
  /** How many `#` the heading carried. 1 for `# Reheating`, 2 for `## Eating History`. */
  level: number;
  heading: string;
  /** The lines under it, up to the next heading of any level. Blank lines kept. */
  lines: string[];
}

/** Anything before the first heading: the note's own opening paragraph. */
export interface MarkdownBody {
  intro: string;
  sections: MarkdownSection[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * A body as its intro and a flat list of sections, in document order.
 *
 * Flat rather than nested, because a nested tree would have to decide what to do
 * with a `###` under a `#` with no `##` between them, and every caller here reads
 * sections by name rather than by walking. `level` is carried so a caller can
 * group if it needs to.
 *
 * **A repeated heading yields a repeated section**, rather than being merged.
 * Two meals in the vault this was written against carry their reheating
 * sections four times over, from a writer that appended where it meant to
 * replace. Merging would hide that; showing it back is how it gets noticed.
 */
export function splitSections(body: string): MarkdownBody {
  const sections: MarkdownSection[] = [];
  const intro: string[] = [];
  let current: MarkdownSection | null = null;

  for (const line of body.split('\n')) {
    const match = HEADING.exec(line.trim());

    if (match) {
      current = { level: match[1]?.length ?? 1, heading: (match[2] ?? '').trim(), lines: [] };
      sections.push(current);
      continue;
    }

    if (current) current.lines.push(line);
    else intro.push(line);
  }

  return { intro: intro.join('\n').trim(), sections };
}

/**
 * Every section with a given heading, matched without regard to case or
 * surrounding space.
 *
 * Returns a list because a heading can repeat. A caller that wants one section
 * takes the first and is choosing to ignore the rest, which is a different thing
 * from not knowing there were more.
 */
export function sectionsNamed(body: MarkdownBody, heading: string): MarkdownSection[] {
  const wanted = heading.trim().toLowerCase();
  return body.sections.filter((section) => section.heading.toLowerCase() === wanted);
}

/** Every line of every section with a given heading, concatenated in document order. */
export function linesUnder(body: MarkdownBody, heading: string): string[] {
  return sectionsNamed(body, heading).flatMap((section) => section.lines);
}

/** A section's own lines, or one of its subsections' lines, in document order. */
export interface SectionGroup {
  /** null for the lines that sat directly under the parent heading. */
  heading: string | null;
  lines: string[];
}

/**
 * A section broken into its own lines and each subsection under it.
 *
 * The shape a body actually takes when somebody groups a list: `# Reheating`
 * holding nothing itself, then `## Stroganoff` and `## Spaetzli` holding the
 * bullets. Reading only the parent's own lines returns nothing for those, which
 * is the bug this exists to prevent, and measuring against the vault it was
 * written for is how it was caught: 9 meals appeared to have steps where
 * 14 have them.
 *
 * Stops at the next heading of the same level or shallower, so a following
 * `# Instructions` does not get swept in.
 */
export function groupsUnder(body: MarkdownBody, heading: string): SectionGroup[] {
  const wanted = heading.trim().toLowerCase();
  const groups: SectionGroup[] = [];

  for (let i = 0; i < body.sections.length; i++) {
    const section = body.sections[i];
    if (!section || section.heading.toLowerCase() !== wanted) continue;

    groups.push({ heading: null, lines: section.lines });

    for (let j = i + 1; j < body.sections.length; j++) {
      const next = body.sections[j];
      if (!next || next.level <= section.level) break;
      groups.push({ heading: next.heading, lines: next.lines });
    }
  }

  return groups;
}

/** The same lines, flattened, for a caller that does not care how they were grouped. */
export function linesUnderTree(body: MarkdownBody, heading: string): string[] {
  return groupsUnder(body, heading).flatMap((group) => group.lines);
}
