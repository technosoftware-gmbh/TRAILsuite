/**
 * Turning a meal note into the one context every layout renders from.
 *
 * Built once per render, so three layouts cannot disagree about what a note
 * says, and separated from the view so the parsing order below is readable on
 * its own. That order matters: the hero image has to be resolved *before* the
 * body is cleaned, because cleaning removes the embed of whatever image the
 * header is about to show.
 */
import { App, TFile } from 'obsidian';
import type { CULItrailSettings } from '../../settings/types';
import { frontmatterOf } from '../../shared/vault-scan';
import { usableImageValue } from '../../ui/images';
import type { EatingEntry, MealMeta } from '../types';
import { mergeEatingHistory, parseEatingHistorySection } from '../parser/eating-history';
import { stripRedundantBodyContent } from '../parser/body-clean';
import { extractLeadingText, stripFrontmatter } from '../parser/body-sections';
import { readMealMeta } from '../parser/meal-meta';
import { renderedSectionHeadings, reservedSectionHeadings } from '../parser/section-names';
import { splitTrailingSections } from '../parser/trailing-sections';
import { parseReheatSection } from '../reheating/parse-section';
import { NO_SUPPLIER, type SupplierResolution } from '../reheating/read-supplier';
import { resolveReheating } from '../reheating/resolve';
import type { ApplianceEntry } from '../reheating/types';
import { defaultMealImageValue, resolveHeroImageValue } from '../view-model/hero-image';
import type { MealLayoutContext } from './layouts/types';

/**
 * What the caller had to read from another note before this could be built.
 *
 * The supplier's reheating boilerplate lives in a company note, and reading a
 * note body is asynchronous while this function is not. Rather than make the
 * whole context async, the view awaits that one read and hands the result in:
 * the parsing order below is the reason this function exists, and it stays
 * readable when nothing in it goes to disk.
 */
export interface ExternalContext {
  supplierEntries: ApplianceEntry[];
  /**
   * Who sells this meal, resolved by the view.
   *
   * Handed in for the same reason the entries are: resolving a supplier reads
   * the company notes and, failing a stated one, every order note, and this
   * function does not go to disk. Optional so a caller that only wants the
   * body parsed does not have to invent one.
   */
  supplier?: SupplierResolution;
  /**
   * This meal's outings, read from the meal plans by the view.
   *
   * Handed in for the same reason the supplier entries are: the plans are 117
   * notes to read and this function does not go to disk. It is the whole log
   * now – the frontmatter property it used to be merged with was removed from
   * every meal by the August 2026 migration.
   */
  cooks?: EatingEntry[];
}

export function buildLayoutContext(
  app: App,
  file: TFile,
  data: string,
  settings: CULItrailSettings,
  external: ExternalContext = { supplierEntries: [] }
): MealLayoutContext {
  const frontmatter = frontmatterOf(app, file) ?? {};

  // A TextFileView's data can briefly be null between leaf transitions, and
  // every parser below calls string methods on it.
  const rawBody = stripFrontmatter(typeof data === 'string' ? data : '');

  const heroImage = resolveHeroImageValue(frontmatter, rawBody, settings);
  const body = stripRedundantBodyContent(rawBody, {
    cleanNoteBody: settings.cleanNoteBody,
    title: file.basename,
    // The note's own image only. The configured default is applied below,
    // after cleaning, so it is never treated as something to strip.
    imageValue: heroImage ?? undefined,
  });

  // The body goes in as well as the frontmatter, because this is the one reader
  // that has it: a meal written before the per-100 g breakdown moved into
  // properties still keeps it under two headings, and this is what lets such a
  // note show its label rather than nothing.
  const meta = readMealMeta(frontmatter, settings, body.split('\n'));

  // Read from the whole body rather than from what follows the instructions: the
  // section belongs after them by convention, and a note that puts it first is
  // still a note whose reheating instructions should be found.
  const reheating = resolveReheating(
    parseReheatSection(body, settings),
    external.supplierEntries,
    settings
  );

  return {
    file,
    settings,
    frontmatter,
    meta,
    // A reference that does not resolve counts as no image, so a deleted
    // attachment falls through to the default rather than rendering an empty
    // frame the reader cannot explain.
    imageValue: usableImageValue(app, heroImage) ?? defaultMealImageValue(settings),
    description: extractLeadingText(body.split('\n')),
    // Excluded because each of those has a presentation of its own: the log,
    // the reheating card and now the per-100 g breakdown. A section rendered as
    // a generic card *and* as itself appears twice, which is what happens the
    // moment one of them is forgotten, so the list lives in `section-names.ts`
    // beside the parser's own rather than being spelled out here.
    trailingSections: splitTrailingSections(
      body,
      renderedSectionHeadings(settings),
      // So that a section this plugin renders is never swallowed by the excluded
      // reheating section just because its heading is written one level deeper.
      reservedSectionHeadings(settings)
    ),
    eatingHistory: readEatingHistory(body, meta, settings, external.cooks ?? []),
    reheating,
    supplier: external.supplier ?? NO_SUPPLIER,
  };
}

/**
 * The whole log: the plans, plus the two older places a vault may still keep
 * one – the frontmatter list `MealMeta` read, and the section in the body.
 *
 * Three sources rather than two, and the plans are the one that counts. The
 * other two are empty in a vault that has been through the migration and are
 * read anyway, because a vault that has not been through it still has them and
 * `mergeEatingHistory` folds a cook recorded in two places into one by id.
 */
function readEatingHistory(
  body: string,
  meta: MealMeta,
  settings: CULItrailSettings,
  cooks: EatingEntry[]
): EatingEntry[] {
  if (!settings.eatingHistoryEnabled) return [];

  const section = splitTrailingSections(body).find(
    (candidate) =>
      candidate.heading.toLowerCase() === settings.eatingHistoryHeading.trim().toLowerCase()
  );

  return mergeEatingHistory(
    cooks,
    meta.eatingHistory,
    parseEatingHistorySection(section?.body ?? '')
  );
}
