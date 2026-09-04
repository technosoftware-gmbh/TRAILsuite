/**
 * The settings page: one scrolling page of sections, and four sub-pages.
 *
 * It used to be six tabs over about a hundred and twenty settings, grouped by
 * the feature that read them. That grouping put the rows nobody edits twice
 * (seventy-odd frontmatter names, eleven folders) at the same distance from
 * the eye as the dozen switches somebody actually comes back for, and it split
 * the property rows across four tabs, so "what does this plugin call the field
 * my notes already have?" had four places to be answered.
 *
 * Now the switches are the page, and the long lists are one row away:
 *
 *   Vault setup    Folders >           11 folders
 *                  Property keys >     83 keys, locked
 *                  what each setting currently matches, counted
 *   Meal view      headings, rendering, tags, Header badges >, Appliances >
 *   Planning       eating history
 *   Orders         currency, legacy prefix, eligible people
 *   Browsing       dashboard, ribbon icons, what opens itself
 *   About          credits, licence, version
 *
 * The shell (settings-page.ts) owns the navigation; this file owns what is on
 * each page and nothing else. `docs/design/settings-reference.md` documents the
 * same grouping, so the page and the reference can be read side by side.
 */
import { App, Plugin } from 'obsidian';
import { t } from '../../lang/I18nManager';
import type { ForeignImportResult } from '../foreign-settings-import';
import type { CULItrailSettings } from '../types';
import { CULItrailSettingsPage, SettingsSubPage } from './settings-page';
import type { RowContext } from './rows';
import { renderApplianceEditor } from './editors/appliance-editor';
import { renderBadgeEditor } from './editors/badge-editor';
import { renderFoldersPage } from './pages/folders';
import { renderPropertyKeysPage } from './pages/property-keys';
import { renderAboutSection } from './sections/about';
import { renderBrowsingSection } from './sections/browsing';
import { renderHeaderSection } from './sections/header';
import { renderMealViewSection, APPLIANCES_PAGE_ID, BADGES_PAGE_ID } from './sections/meal-view';
import { renderOrdersSection } from './sections/orders';
import { renderPlanningSection } from './sections/planning';
import { FOLDERS_PAGE_ID, PROPERTY_KEYS_PAGE_ID, renderVaultSection } from './sections/vault';

/** What a section or a page is given. Not the plugin: they render rows and save them. */
export interface SettingsTabContext extends RowContext {
  app: App;
  settings: CULItrailSettings;
  /** The manifest, for the About section. Read live rather than duplicated into strings. */
  manifest: Plugin['manifest'];
  /**
   * What the fresh-install CRM adoption found, or null when it did not run.
   *
   * Here for the one status line that reports it. A vault whose CRM settings
   * came from another plugin has no other way to find that out, and "why does
   * this say Personen when I never typed that" is the question it answers.
   */
  foreignImport: ForeignImportResult | null;
}

export interface SettingsTabDeps {
  getSettings: () => CULItrailSettings;
  saveSettings: () => Promise<void>;
  /** Read from the settings store, which keeps it after load for exactly this. */
  getForeignImport: () => ForeignImportResult | null;
}

export class CULItrailSettingTab extends CULItrailSettingsPage {
  constructor(
    private readonly plugin: Plugin,
    private readonly deps: SettingsTabDeps
  ) {
    super(plugin.app, plugin);

    this.setRoot((container, nav) => {
      const context = this.context();

      renderHeaderSection(container, this.app, this.plugin.manifest);
      renderVaultSection(container, context, nav.open);
      renderMealViewSection(container, context, nav.open);
      renderPlanningSection(container, context);
      renderOrdersSection(container, context);
      renderBrowsingSection(container, context);
      renderAboutSection(container, this.plugin.manifest);
    });

    this.setSubPages(this.buildSubPages());
  }

  /**
   * The settings object is read inside each renderer rather than captured here:
   * a page is redrawn after a save, and a stale reference would show the value
   * the page opened with.
   */
  private buildSubPages(): SettingsSubPage[] {
    return [
      {
        id: FOLDERS_PAGE_ID,
        title: () => t('settings.vault.folders.name'),
        render: (container) => renderFoldersPage(container, this.context()),
      },
      {
        id: PROPERTY_KEYS_PAGE_ID,
        title: () => t('settings.vault.properties.name'),
        render: (container) => renderPropertyKeysPage(container, this.context()),
      },
      {
        id: BADGES_PAGE_ID,
        title: () => t('settings.badges.title'),
        render: (container) => renderBadgeEditor(container, this.context()),
      },
      {
        id: APPLIANCES_PAGE_ID,
        title: () => t('settings.reheating.appliances'),
        render: (container) => renderApplianceEditor(container, this.context()),
      },
    ];
  }

  private context(): SettingsTabContext {
    return {
      app: this.app,
      settings: this.deps.getSettings(),
      manifest: this.plugin.manifest,
      foreignImport: this.deps.getForeignImport(),
      save: () => this.deps.saveSettings(),
      refresh: () => this.render(),
    };
  }
}
