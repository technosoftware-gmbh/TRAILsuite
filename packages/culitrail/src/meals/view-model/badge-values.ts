/**
 * What each header badge should say, and how the row is laid out.
 *
 * Separated from the DOM that renders it so it can be tested: a badge that
 * silently renders nothing is exactly the kind of failure that survives
 * review, and the alias, formula and array handling here is where it would
 * come from.
 *
 * Shared with the exporter, whose plain-text badge summary has to say the same
 * thing the chips do.
 *
 * App-free.
 */
import { t } from '../../lang/I18nManager';
import { evaluateExpr } from '../../shared/expr-eval';
import { findValue, stripWikilink } from '@technosoftware/trail-core';
import type { BadgeType, CULItrailSettings, CustomBadge } from '../../settings/types';
import { readEatingHistoryProperty } from '../parser/eating-history';
import type { EatingEntry } from '../types';
import { mealMetaAliases } from '../parser/meal-meta';
import { eatingStreakValue } from './eating-streak';
import { formatIsoDate } from './format-date';
import { formatMinutes } from './format-time';

/**
 * A built-in badge's label follows the locale; a user-defined one is shown as
 * written.
 *
 * `label` wins when both are present, which is what makes "edit a built-in's
 * label" work: the editor sets `label`, and the translation key stays behind
 * it, unused but intact, so clearing the override restores the localized text
 * rather than leaving the badge blank.
 */
export function badgeLabel(badge: CustomBadge): string {
  if (badge.label) return badge.label;
  return badge.labelKey ? t(badge.labelKey) : '';
}

/**
 * Renders one raw frontmatter value as badge text.
 *
 * A boolean is a badge that is either present or absent rather than one
 * showing "true": a favorite meal shows a star, an unfavorited one shows
 * nothing at all.
 */
function normalizeValue(raw: unknown, valueType: string): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'boolean') return raw ? '' : null;
  if (valueType === 'minutes' && typeof raw === 'number') return formatMinutes(raw) || null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;

  const text = String(raw).trim();

  // A date renders in the reader's own locale format. The note keeps its
  // unambiguous ISO form; only the badge is localized.
  const asDate = formatIsoDate(text);
  if (asDate !== text) return asDate;

  return stripWikilink(text);
}

/**
 * Looks a badge's property up through the same alias chain the meal view
 * uses for that field.
 *
 * Without this, a badge configured for `prepTime` shows nothing on a note
 * that says `prep:`, while the meta banner beside it shows the value fine.
 * Two parts of one header disagreeing about the same note is worse than
 * either being wrong on its own.
 */
function resolvePropertyValue(
  property: string,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings
): unknown {
  const aliases = mealMetaAliases(settings);
  const groups = Object.values(aliases);

  const group = groups.find((variants) =>
    variants.some((variant) => variant.toLowerCase() === property.toLowerCase())
  );

  return group ? findValue(frontmatter, ...group) : findValue(frontmatter, property);
}

/**
 * The dates a streak counts, in the order they should be looked for.
 *
 * The plans first, when the caller has read them. Cook history lives there
 * since the August 2026 migration, and the frontmatter property this used to
 * read alone is empty on every meal that went through it – so a badge asking
 * frontmatter only had silently stopped appearing on all 126.
 *
 * The property is still read behind it, because a vault that has not been
 * migrated keeps its log there and this badge should work in both.
 */
function eatingDatesFor(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  cooks: EatingEntry[] | undefined
): string[] {
  if (cooks && cooks.length > 0) return cooks.map((entry) => entry.date);

  return readEatingHistoryProperty(frontmatter[settings.eatingHistoryFrontmatterProperty]).map(
    (entry) => entry.date
  );
}

/**
 * A computed badge's text, or null when it has nothing to say.
 *
 * The caller passes the same log whichever surface is rendering – the gallery
 * card reads it off the entry it already built, the meal view off its
 * context – so a meal cannot show two different streaks in two places. That
 * was the reason this used to insist on frontmatter alone; the plans serve it
 * now, and serve it to both.
 *
 * The unit is translated at render rather than carried as the badge's `suffix`.
 * A suffix is a persisted string, so a built-in shipping with one would freeze
 * "weeks" into `data.json` in whatever language the vault was in on its first
 * save. Same hazard as the label, same answer. See §G.1.
 */
function resolveDerivedValue(
  derived: string,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  now: Date,
  cooks: EatingEntry[] | undefined
): string | null {
  if (derived !== 'eatingStreak') return null;
  if (!settings.eatingHistoryEnabled) return null;

  const streak = eatingStreakValue(eatingDatesFor(frontmatter, settings, cooks), now);
  return streak === null ? null : t('badges.streakWeeks', { count: streak });
}

/**
 * The values one badge should show.
 *
 * Empty means the badge is not rendered at all. A badge whose property the
 * note does not carry disappears rather than showing an empty chip, which is
 * what lets one badge set serve meals that state wildly different amounts
 * about themselves.
 */
export function resolveBadgeValues(
  badge: CustomBadge,
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  now: Date = new Date(),
  cooks?: EatingEntry[]
): string[] {
  if (badge.derived) {
    const value = resolveDerivedValue(badge.derived, frontmatter, settings, now, cooks);
    return value === null ? [] : [value];
  }

  if (badge.formula) {
    const result = evaluateExpr(badge.formula, frontmatter);
    const normalized = normalizeValue(result, badge.valueType);
    return normalized !== null ? [normalized] : [];
  }

  const raw = resolvePropertyValue(badge.property, frontmatter, settings);
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'boolean') return raw ? [''] : [];

  if (Array.isArray(raw)) {
    const values = raw
      .map((entry) => normalizeValue(entry, badge.valueType))
      .filter((entry): entry is string => entry !== null);

    if (badge.splitArray) return values;
    const joined = values.join(', ');
    return joined ? [joined] : [];
  }

  const value = normalizeValue(raw, badge.valueType);
  return value !== null ? [value] : [];
}

export interface PlannedBadge {
  badge: CustomBadge;
  type: BadgeType;
  label: string;
  values: string[];
}

/**
 * The badge row, decided.
 *
 * Returns an empty list when nothing would render, so the caller can skip the
 * container entirely rather than leaving an empty row taking up space above
 * every meal that carries no metadata.
 *
 * Separators and newlines survive planning even though they hold no value,
 * because they are layout rather than content. They are dropped only when the
 * row as a whole turns out to be empty, which is what stops a meal with no
 * metadata from rendering a row of lonely dividers.
 */
export function planBadgeRow(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings,
  skip?: (badge: CustomBadge) => boolean,
  now: Date = new Date(),
  /** This meal's cooks, when the caller has read the plans. See `eatingDatesFor`. */
  cooks?: EatingEntry[]
): PlannedBadge[] {
  const planned: PlannedBadge[] = [];

  for (const badge of settings.headerBadges) {
    if (!badge.enabled) continue;
    if (skip?.(badge)) continue;

    const type: BadgeType = badge.type ?? 'badge';
    if (type === 'separator' || type === 'newline') {
      planned.push({ badge, type, label: '', values: [] });
      continue;
    }

    if (!badge.derived && !badge.formula && !badge.property) continue;

    const values = resolveBadgeValues(badge, frontmatter, settings, now, cooks);
    if (values.length === 0) continue;

    planned.push({ badge, type, label: badgeLabel(badge), values });
  }

  const hasContent = planned.some((entry) => entry.type === 'badge');
  if (!hasContent) return [];

  return trimLayoutOnly(planned);
}

/**
 * Drops separators and newlines that no longer sit between two badges.
 *
 * A badge disappearing because its property is absent can leave the divider
 * that used to follow it stranded at the start or the end of the row, or
 * doubled up beside another. The row is configured once and rendered against
 * every meal, so this is the normal case rather than a rare one.
 *
 * Exported because splitting the row into chips and cells strands them a second
 * way, and `badge-display.ts` repairs it with this rather than a copy.
 */
export function trimLayoutOnly(planned: PlannedBadge[]): PlannedBadge[] {
  const isLayout = (entry: PlannedBadge): boolean => entry.type !== 'badge';

  const trimmed = [...planned];
  while (trimmed.length > 0 && isLayout(trimmed[0])) trimmed.shift();
  while (trimmed.length > 0 && isLayout(trimmed[trimmed.length - 1])) trimmed.pop();

  return trimmed.filter(
    (entry, index) => !(isLayout(entry) && index > 0 && isLayout(trimmed[index - 1]))
  );
}
