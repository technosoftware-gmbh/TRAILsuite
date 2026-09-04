/**
 * How to reheat an ordered meal, one group per appliance.
 *
 * A thin adapter over the step renderer rather than a section of its own: the
 * reheating steps then read exactly as any other run of steps does, because
 * they *are* steps as far as the renderer is concerned.
 */
import { App, Component } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { CULItrailSettings } from '../../settings/types';
import type { ReheatInstruction } from '../reheating/types';
import type { StepGroup } from '../types';
import { renderStepsSection } from './steps-section';

/**
 * One group per appliance, headed by the appliance.
 *
 * Level 3 for every group, matching what a note writes as `###` under a `##`
 * section, so the headings sit at the same visual weight as any other group's.
 */
function asGroups(instructions: ReheatInstruction[]): StepGroup[] {
  return instructions.map((instruction) => ({
    heading: instruction.label,
    headingLevel: 3,
    steps: instruction.steps,
  }));
}

export async function renderReheatingSection(
  container: HTMLElement,
  app: App,
  component: Component,
  sourcePath: string,
  instructions: ReheatInstruction[],
  settings: CULItrailSettings
): Promise<void> {
  if (instructions.length === 0) return;

  await renderStepsSection(container, app, component, sourcePath, asGroups(instructions), {
    // The configured heading, so the section calls itself whatever the notes
    // call it, and a translated fallback when that setting has been cleared.
    title: settings.reheatingHeading.trim() || t('meals.reheating.title'),
    // `flame` rather than `microwave`: the latter is a recent Lucide addition
    // and Obsidian bundles a pinned version, so on an older install `setIcon`
    // would find nothing and render an empty span. An icon that silently fails
    // to appear has already shipped in this plugin twice; the icons used
    // elsewhere here are all long-standing ones and this stays in that set.
    icon: 'flame',
    sectionClass: 'culi-reheating-section',
  });
}
