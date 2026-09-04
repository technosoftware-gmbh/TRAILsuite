/**
 * A section of steps as the meal view shows them: a numbered list per group,
 * each step rendered as Markdown.
 *
 * Steps are `<li>` elements of a real `<ol>` rather than manually numbered
 * text, so the numbers stay right when a step is long enough to wrap and when
 * a screen reader announces the list.
 *
 * The only caller left is the reheating section, one group per appliance. It
 * stays a renderer of its own rather than being folded into that file because
 * the group-and-step shape is the note format's, and the reheating section is
 * about which heading and which icon.
 */
import { App, Component, MarkdownRenderer, setIcon } from 'obsidian';
import type { StepGroup } from '../types';

/** What a step section calls itself. */
export interface StepSectionOptions {
  title: string;
  icon: string;
  /** The section's own class, so two step sections can be told apart in CSS. */
  sectionClass?: string;
}

export async function renderStepsSection(
  container: HTMLElement,
  app: App,
  component: Component,
  sourcePath: string,
  groups: StepGroup[],
  options: StepSectionOptions
): Promise<void> {
  const section = container.createDiv({
    cls: ['culi-section', options.sectionClass ?? 'culi-steps-section'],
  });

  const header = section.createDiv({ cls: 'culi-section-header' });
  setIcon(header.createSpan({ cls: 'culi-section-icon' }), options.icon);
  header.createSpan({ cls: 'culi-section-title', text: options.title });

  for (const group of groups) {
    if (group.steps.length === 0) continue;

    let stepContainer = section;
    if (group.heading) {
      const groupEl = section.createDiv({ cls: 'culi-step-group' });
      const groupHeader = groupEl.createDiv({
        // The heading's own depth travels into the class, so a `####`
        // sub-sub-heading reads as subordinate to the `###` above it rather
        // than as its equal.
        cls: ['culi-group-header', `culi-heading-level-${group.headingLevel}`],
        text: group.heading,
      });
      groupHeader.addEventListener('click', () =>
        groupEl.toggleClass('culi-collapsed', !groupEl.hasClass('culi-collapsed'))
      );
      stepContainer = groupEl.createDiv({ cls: 'culi-group-steps' });
    }

    const list = stepContainer.createEl('ol', { cls: 'culi-step-list' });
    for (const step of group.steps) {
      const item = list.createEl('li', { cls: 'culi-step' });
      await MarkdownRenderer.render(app, step, item, sourcePath, component);
    }
  }
}
