/**
 * The release notes, shown inside Obsidian.
 *
 * The text is the package's own CHANGELOG.md, imported as a string at build
 * time rather than retyped into a translation table: a "what's new" panel
 * that disagrees with the changelog is worse than no panel at all, and this
 * one cannot. Nothing here reaches the network, which is also why the notes
 * are bundled rather than fetched from GitHub.
 *
 * Only the newest few releases are shown. A changelog grows without limit and
 * the question this answers is what changed recently; the link at the bottom
 * is for the rest of it.
 */
import { App, Component, MarkdownRenderer, Modal, Setting } from 'obsidian';
import changelog from '../../../CHANGELOG.md';
import { recentReleases } from './whats-new-releases';
import { t } from '../../lang/I18nManager';
import { LINKS } from '../../settings/links';

export class WhatsNewModal extends Modal {
  /**
   * A component of its own rather than the plugin, because what is being
   * loaded and unloaded here is this modal's rendered markdown: handing
   * `MarkdownRenderer` the plugin would leave every child it registers alive
   * until the plugin itself unloads.
   */
  private readonly renderHost = new Component();

  constructor(
    app: App,
    private readonly version: string
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('nod-whats-new');
    this.renderHost.load();

    this.setTitle(t('settings.releaseNotes') + ' ' + this.version);

    const body = contentEl.createDiv({ cls: 'nod-whats-new-body' });
    const releases = recentReleases(changelog);

    if (releases.length === 0) {
      body.createEl('p', { text: t('health.allClear') });
    }

    for (const release of releases) {
      void MarkdownRenderer.render(
        this.app,
        release,
        body.createDiv({ cls: 'nod-whats-new-release' }),
        '',
        this.renderHost
      );
    }

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText(t('common.close'))
        .setCta()
        .onClick(() => this.close())
    );

    const footer = contentEl.createEl('p', { cls: 'nod-settings-note' });
    const link = footer.createEl('a', {
      text: t('settings.releaseNotes'),
      href: LINKS.releases,
    });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener');
  }

  onClose(): void {
    this.renderHost.unload();
    this.contentEl.empty();
  }
}
