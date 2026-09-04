/**
 * The sections after the instructions, as buttons that open their content.
 *
 * Buttons rather than cards laid out inline, because these sections vary
 * wildly in length between vaults and one long Notes section would otherwise
 * push the instructions off the screen on every meal that has one.
 */
import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import { BaseModal } from '../../ui/base-modal';
import type { TrailingSection } from '../parser/trailing-sections';
import { sectionBar, sectionButton } from './section-bar';

/** Shows one trailing section's Markdown, rendered, in the shared modal shell. */
class SectionModal extends BaseModal {
  constructor(
    app: App,
    private readonly section: TrailingSection,
    private readonly sourcePath: string,
    private readonly owner: Component
  ) {
    super(app);
  }

  getTitle(): string {
    return this.section.heading;
  }

  async renderBody(body: HTMLElement): Promise<void> {
    // Rendered against the meal's own path so a relative link or an embed
    // inside the section resolves the way it does in the note.
    await MarkdownRenderer.render(this.app, this.section.body, body, this.sourcePath, this.owner);
  }

  renderFooter(): void {
    // Nothing to confirm. The modal is a reader, and Obsidian's own close
    // button is the only action it needs.
  }
}

export function renderTrailingSectionButtons(
  container: HTMLElement,
  app: App,
  component: Component,
  file: TFile,
  sections: TrailingSection[]
): void {
  if (sections.length === 0) return;

  const bar = sectionBar(container);
  for (const section of sections) {
    sectionButton(bar, {
      icon: 'file-text',
      label: section.heading,
      onClick: () => new SectionModal(app, section, file.path, component).open(),
    });
  }
}
