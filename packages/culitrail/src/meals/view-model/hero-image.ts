/**
 * Which image a meal shows at the top, decided.
 *
 * Three sources in order: what the frontmatter names, the first image in the
 * body, and the vault-wide default. They are deliberately not equivalent.
 * The first two are real references *in the note*, which means the body
 * cleaner has to know about them so the same picture is not rendered twice.
 * The default is display-only and belongs to no note at all, which is why it
 * is resolved separately and never handed to the cleaner.
 *
 * App-free.
 */
import { findValue } from 'trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { findFirstImageInBody } from '../parser/body-images';
import { mealMetaAliases } from '../parser/meal-meta';

/** The image the frontmatter names, or null. */
export function frontmatterImageValue(
  frontmatter: Record<string, unknown>,
  settings: CULItrailSettings
): string | null {
  const raw = findValue(frontmatter, ...mealMetaAliases(settings).image);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The image the note itself refers to: frontmatter first, then the body.
 *
 * The body fallback is a setting because it is a guess. A note whose first
 * image is a step photo rather than the finished dish would show the wrong
 * one, and a vault that writes its images into frontmatter properly should
 * not have to think about it.
 */
export function resolveHeroImageValue(
  frontmatter: Record<string, unknown>,
  body: string,
  settings: CULItrailSettings
): string | null {
  const stated = frontmatterImageValue(frontmatter, settings);
  if (stated !== null) return stated;
  return settings.useFirstBodyImageWhenFrontmatterEmpty ? findFirstImageInBody(body) : null;
}

/**
 * The configured stand-in for a meal with no image of its own.
 *
 * An empty setting means the feature is off, so a blank string never becomes
 * a broken image. Only reach for this once the note's own sources have come
 * up empty, and never on an export or share path: a picture that is not in
 * the meal should not travel with it.
 */
export function defaultMealImageValue(settings: CULItrailSettings): string | null {
  const trimmed = settings.defaultMealImage.trim();
  return trimmed.length > 0 ? trimmed : null;
}
