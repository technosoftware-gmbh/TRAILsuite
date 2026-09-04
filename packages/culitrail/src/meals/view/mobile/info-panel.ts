/**
 * The mobile Info tab: where the meal came from, and whatever prose the note
 * carries outside the ingredients and instructions.
 *
 * The tab exists so the other two can be nothing but the list somebody is
 * eating from.
 *
 * It deliberately no longer holds the nutrition strip. That moved into the header
 * above the tabs, where it is the four figures a shop puts on a product card, and
 * rendering it here as well would show the same numbers twice on one screen. The
 * per-100 g breakdown is a different thing and has a tab of its own, which is
 * also where a note still carrying its `# Nutritional Information` section now
 * reads: that section used to be offered here as a button of raw Markdown,
 * because nothing rendered it.
 */
import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import { t } from '../../../lang/I18nManager';
import { readSourceLink } from '../../view-model/source-link';
import type { MealMeta } from '../../types';

function renderSourceRow(panel: HTMLElement, meta: MealMeta): void {
  const source = readSourceLink(meta.source);
  if (!source) return;

  const row = panel.createDiv({ cls: 'culi-info-source' });
  row.createSpan({ cls: 'culi-label-caps', text: t('meals.mobile.source') });

  if (source.href) {
    row.createEl('a', {
      text: source.label,
      href: source.href,
      attr: { target: '_blank', rel: 'noopener' },
    });
  } else {
    row.createSpan({ text: source.label });
  }
}

export async function renderMobileInfoPanel(
  panel: HTMLElement,
  app: App,
  component: Component,
  file: TFile,
  meta: MealMeta,
  prose: string[]
): Promise<void> {
  renderSourceRow(panel, meta);

  for (const section of prose) {
    if (!section.trim()) continue;
    await MarkdownRenderer.render(app, section, panel, file.path, component);
  }
}
