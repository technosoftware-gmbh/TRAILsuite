/**
 * The body sections CULItrail owns, by their configured names.
 *
 * One list, because two parsers need the same answer to the same question: **is
 * this heading a section some other feature renders?** A section that belongs to
 * another feature must never be absorbed into the one being parsed, whatever the
 * heading levels in the note happen to be.
 *
 * That is not a theoretical tidiness. The eating-history writer emits `##
 * Eating History` while a vault's other sections are written `#`, so a
 * `# Reheating` pasted above it makes Eating History a *deeper* heading inside
 * the reheating section. Without this list the reheating parser read it as an
 * appliance called "Eating History" and rendered the log as a reheating
 * instruction.
 *
 * App-free.
 */
import type { CULItrailSettings } from '../../settings/types';

export function reservedSectionHeadings(settings: CULItrailSettings): string[] {
  return [
    settings.notesHeading,
    settings.nutritionHeading,
    settings.micronutrientHeading,
    settings.eatingHistoryHeading,
    settings.reheatingHeading,
  ]
    .map((heading) => heading.trim())
    .filter((heading) => heading !== '');
}

/**
 * The headings the meal view presents itself, and therefore never offers back
 * as a trailing-section card.
 *
 * A different question from `reservedSectionHeadings` above, and the difference
 * matters. That list is about parsing: which headings end another section. This
 * one is about rendering: a section the view draws in a shape of its own must
 * not *also* appear as a card of raw Markdown, because then the same content is
 * on screen twice and one of the two copies looks like a bug.
 *
 * **The two per-100 g headings are on it, and they were not before.** Nothing
 * rendered those figures, so offering the section as a card was the only way to
 * see them at all, and `mobile/info-panel.ts` said so in as many words. The
 * breakdown card renders them now, translated and in declaration order, so an
 * unmigrated note would otherwise show its label twice: once as the card and
 * once as `- **Sodium:** 1g`. The editor already deletes both sections on save,
 * so nothing is being hidden that the plugin does not own.
 *
 * `notesHeading` is deliberately absent: nothing renders a Notes section, so
 * its card is the only place that content appears.
 */
export function renderedSectionHeadings(settings: CULItrailSettings): string[] {
  return [
    settings.eatingHistoryHeading,
    settings.reheatingHeading,
    settings.nutritionHeading,
    settings.micronutrientHeading,
  ]
    .map((heading) => heading.trim())
    .filter((heading) => heading !== '');
}

/** True when a heading names one of those sections, compared the way headings are elsewhere. */
export function isReservedHeading(heading: string, reserved: string[]): boolean {
  const text = heading.trim().toLowerCase();
  return reserved.some((name) => name.toLowerCase() === text);
}
