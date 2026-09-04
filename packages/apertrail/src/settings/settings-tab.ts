/**
 * APERtrail's settings page.
 *
 * One scrolling page: the plugin's own block at the top, then Vault setup,
 * then the switches, then About. The two long lists -- the folders and the
 * frontmatter property names -- are sub-pages the Vault setup section drills
 * into, which is what keeps this page short enough to read.
 *
 * The shell (settings-tab-shell.ts) owns the navigation; this file owns what
 * is on each page and nothing else.
 */
import { App } from 'obsidian';
import { APERtrailSettingsPage, SettingsSubPage } from './settings-tab-shell';
import { renderSectionAbout } from './section-about';
import { t } from '../lang/I18nManager';
import type APERtrailPlugin from '../main';
import { renderSectionHeader } from '../ui/settings/section-header';
import {
  FOLDERS_PAGE_ID,
  PROPERTY_KEYS_PAGE_ID,
  renderSectionVault,
} from '../ui/settings/section-folders';
import { renderSectionConfiguration } from '../ui/settings/section-configuration';
import { renderFoldersPage } from '../ui/settings/page-folders';
import { renderPropertyKeysPage } from '../ui/settings/page-property-keys';

export class APERtrailSettingTab extends APERtrailSettingsPage {
  constructor(
    app: App,
    private readonly plugin: APERtrailPlugin
  ) {
    super(app, plugin);

    this.setRoot((containerEl, nav) => {
      renderSectionHeader(containerEl, this.plugin, this.app);

      renderSectionVault(containerEl, this.plugin.getSettings(), nav.open, {
        openEntityTypeCheck: () => this.plugin.openEntityTypeCheck(),
      });

      renderSectionConfiguration(containerEl, this.plugin.getSettings(), this.save, {
        openDashboard: () => void this.plugin.activateTravelGalleryView(),
      });

      renderSectionAbout(this.plugin, containerEl);
    });

    this.setSubPages(this.buildSubPages());
  }

  /**
   * The settings object is read inside each renderer rather than captured
   * here: a page is redrawn after a save, and a stale reference would show
   * the value the page opened with.
   */
  private buildSubPages(): SettingsSubPage[] {
    return [
      {
        id: FOLDERS_PAGE_ID,
        title: () => t('settings.vault.folders.name'),
        render: (containerEl) =>
          renderFoldersPage(containerEl, this.app, this.plugin.getSettings(), this.save),
      },
      {
        id: PROPERTY_KEYS_PAGE_ID,
        title: () => t('settings.vault.properties.name'),
        render: (containerEl, nav) =>
          renderPropertyKeysPage(containerEl, this.plugin.getSettings(), this.save, nav.refresh),
      },
    ];
  }

  private readonly save = async (): Promise<void> => {
    await this.plugin.saveSettings();
  };
}
