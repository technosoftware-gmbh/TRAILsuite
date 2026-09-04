/**
 * The contract every meal layout renders against.
 *
 * One context, built once by the view, so three layouts cannot disagree about
 * what the note says. A layout decides arrangement and nothing else: if it
 * finds itself reading frontmatter or splitting the body, that work belongs
 * in the context builder instead.
 */
import type { App, Component, TFile } from 'obsidian';
import type { CULItrailSettings } from '../../../settings/types';
import type { EatingEntry, MealMeta } from '../../types';
import type { SupplierResolution } from '../../reheating/read-supplier';
import type { ReheatInstruction } from '../../reheating/types';
import type { TrailingSection } from '../../parser/trailing-sections';
import type { MealViewDeps } from '../deps';

export type MealLayoutId = 'mobile-tabs' | 'desktop-classic';

export interface MealLayoutContext {
  file: TFile;
  settings: CULItrailSettings;
  frontmatter: Record<string, unknown>;
  meta: MealMeta;
  /** The image to show, already checked to resolve, or null. May be the configured default. */
  imageValue: string | null;
  /** Free text between the frontmatter and the first heading. */
  description: string;
  /** Everything after the reheating section, as titled cards. */
  trailingSections: TrailingSection[];
  /** The cook log from both the frontmatter list and the body section, newest first. */
  eatingHistory: EatingEntry[];
  /** Every appliance offered for this meal, already resolved against its supplier. */
  reheating: ReheatInstruction[];
  /** Who sells it, how that was worked out, and what they charge. */
  supplier: SupplierResolution;
}

export interface MealLayoutArgs {
  container: HTMLElement;
  app: App;
  /** The view, for `MarkdownRenderer.render()` and for DOM events that unregister with it. */
  component: Component;
  deps: MealViewDeps;
  context: MealLayoutContext;
}

export type MealLayoutRenderer = (args: MealLayoutArgs) => Promise<void>;
