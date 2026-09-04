/**
 * The settings page: one scrolling root page with three sub-pages a click away.
 *
 * The root carries the plugin block, vault setup, the display preferences and
 * About. The three long lists live one click away: **Folders**, laid out as
 * four module sections so it reads the way the vault does, **Property keys**,
 * every frontmatter name grouped by the note type that carries it, and
 * **Import rules**, which is a list of rows somebody adds to rather than a
 * value somebody types.
 *
 * This shell owns the drill-down and nothing else. The rows live in
 * `src/ui/settings/`, and a property row is never built by hand, which is what
 * keeps the read-only lock in one place.
 */
import { App, PluginSettingTab, Setting } from 'obsidian';
import type NODAtrailPlugin from '../main';
import { t } from '../lang/I18nManager';
import { formatRates, parseRates } from '../shared/rates';
import { LINKS } from './links';
import { renderFolderPage } from '../ui/settings/page-folders';
import { renderPropertyKeysPage } from '../ui/settings/page-property-keys';
import { renderImportRulesPage } from '../ui/settings/page-import-rules';
import { linkRow, navRow, sectionCard, textRow, toggleRow } from '../ui/settings/rows';
import { renderFolderField } from '../ui/components/folder-field';

type Page = 'root' | 'folders' | 'properties' | 'importRules';

export class NODAtrailSettingTab extends PluginSettingTab {
  private page: Page = 'root';

  constructor(
    app: App,
    private readonly plugin: NODAtrailPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    this.render();
  }

  /**
   * The one repaint, called by `display()` and by every navigation.
   *
   * Separate from `display()` so that nothing inside this class calls a method
   * Obsidian has deprecated, which is what the lint rule is objecting to when
   * a settings tab repaints itself.
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('nod-settings');

    if (this.page === 'folders')
      return this.renderSubPage(t('settings.folders.heading'), (el) =>
        renderFolderPage(el, {
          app: this.app,
          settings: this.plugin.getSettings(),
          save: () => this.save(),
        })
      );

    if (this.page === 'properties') {
      return this.renderSubPage(t('settings.properties.heading'), (el) =>
        renderPropertyKeysPage(el, {
          settings: this.plugin.getSettings(),
          save: () => this.save(),
          refresh: () => this.render(),
        })
      );
    }

    if (this.page === 'importRules') {
      return this.renderSubPage(t('settings.importRules.heading'), (el) =>
        renderImportRulesPage(el, {
          settings: this.plugin.getSettings(),
          save: () => this.save(),
          refresh: () => this.render(),
        })
      );
    }

    this.renderRoot();
  }

  /** Leaving the page resets the drill-down, so reopening settings starts at the top. */
  hide(): void {
    this.page = 'root';
  }

  private save(): Promise<void> {
    return this.plugin.settingsStore.save();
  }

  private open(page: Page): void {
    this.page = page;
    this.render();
  }

  private renderSubPage(title: string, body: (el: HTMLElement) => void): void {
    new Setting(this.containerEl)
      .setName(title)
      .setHeading()
      .addButton((button) =>
        button
          .setButtonText(t('common.close'))
          .setTooltip(t('common.close'))
          .onClick(() => this.open('root'))
      );

    body(this.containerEl.createDiv({ cls: 'nod-settings-page' }));
  }

  private renderRoot(): void {
    const settings = this.plugin.getSettings();

    const plugin = sectionCard(this.containerEl, t('settings.title'));
    new Setting(plugin)
      .setName(t('settings.version'))
      .setDesc(this.plugin.manifest.version)
      .addButton((button) =>
        button.setButtonText(t('settings.releaseNotes')).onClick(() => this.plugin.showWhatsNew())
      );
    linkRow(plugin, { name: t('settings.support') }, [
      { label: t('settings.support'), href: LINKS.issues, icon: 'bug' },
      { label: t('settings.contact'), href: LINKS.support, icon: 'mail' },
    ]);

    const vault = sectionCard(this.containerEl, t('settings.vault.heading'));
    renderFolderField(
      vault,
      this.app,
      t('settings.vault.rootFolder'),
      t('settings.vault.rootFolderDesc'),
      settings.rootFolder,
      '',
      async (value) => {
        settings.rootFolder = value;
        await this.save();
      }
    );
    toggleRow(
      vault,
      { name: t('settings.vault.showRibbonIcon'), desc: t('settings.vault.showRibbonIconDesc') },
      () => settings.showRibbonIcon,
      async (value) => {
        settings.showRibbonIcon = value;
        await this.save();
        this.plugin.refreshRibbonIcon();
      }
    );

    const week = sectionCard(this.containerEl, t('settings.display.weekHeading'));
    toggleRow(
      week,
      {
        name: t('settings.display.workdaysOnly'),
        desc: t('settings.display.workdaysOnlyDesc'),
      },
      () => settings.weekWorkdaysOnly,
      async (value) => {
        settings.weekWorkdaysOnly = value;
        await this.save();
      }
    );
    textRow(
      week,
      { name: t('settings.display.lunchStart') },
      () => settings.weekLunchStart,
      async (value) => {
        settings.weekLunchStart = value.trim();
        await this.save();
      }
    );
    textRow(
      week,
      { name: t('settings.display.lunchEnd'), desc: t('settings.display.lunchDesc') },
      () => settings.weekLunchEnd,
      async (value) => {
        settings.weekLunchEnd = value.trim();
        await this.save();
      }
    );

    const nav = sectionCard(this.containerEl);
    navRow(nav, {
      name: t('settings.folders.openPage'),
      desc: t('settings.folders.description'),
      open: () => this.open('folders'),
    });
    navRow(nav, {
      name: t('settings.properties.openPage'),
      desc: t('settings.properties.description'),
      open: () => this.open('properties'),
    });
    navRow(nav, {
      name: t('settings.importRules.openPage'),
      desc: t('settings.importRules.description'),
      open: () => this.open('importRules'),
    });

    const display = sectionCard(this.containerEl, t('settings.display.heading'));
    textRow(
      display,
      { name: t('settings.display.homeCurrency'), desc: t('settings.display.homeCurrencyDesc') },
      () => settings.homeCurrency,
      async (value) => {
        settings.homeCurrency = value.toUpperCase();
        await this.save();
      }
    );
    textRow(
      display,
      { name: t('settings.display.displayLocale'), desc: t('settings.display.displayLocaleDesc') },
      () => settings.displayLocale,
      async (value) => {
        settings.displayLocale = value.trim();
        await this.save();
        this.render();
      }
    );
    textRow(
      display,
      { name: t('settings.display.rates'), desc: t('settings.display.ratesDesc') },
      () => formatRates(settings.exchangeRates),
      async (value) => {
        settings.exchangeRates = parseRates(value);
        await this.save();
      }
    );
    textRow(
      display,
      {
        name: t('settings.display.currencyOptions'),
        desc: t('settings.display.currencyOptionsDesc'),
      },
      () => settings.currencyOptions,
      async (value) => {
        settings.currencyOptions = value;
        await this.save();
      }
    );
    new Setting(display)
      .setName(t('settings.display.dueSoonDays'))
      .setDesc(t('settings.display.dueSoonDaysDesc'))
      .addSlider((slider) =>
        slider
          .setLimits(0, 60, 1)
          .setValue(settings.billDueSoonDays)
          .onChange((value) => {
            settings.billDueSoonDays = value;
            void this.save();
          })
      );
    textRow(
      display,
      { name: t('settings.display.categories'), desc: t('settings.display.categoriesDesc') },
      () => settings.expenseCategories,
      async (value) => {
        settings.expenseCategories = value;
        await this.save();
      }
    );
    textRow(
      display,
      { name: t('settings.display.taskFolders'), desc: t('settings.display.taskFoldersDesc') },
      () => settings.taskFolders,
      async (value) => {
        settings.taskFolders = value;
        await this.save();
      }
    );

    const about = sectionCard(this.containerEl, t('settings.about'));
    about.createEl('p', { cls: 'nod-settings-note', text: t('settings.aboutBody') });
    linkRow(about, { name: t('plugin.name') }, [
      { label: 'technosoftware.com', href: LINKS.homepage, icon: 'globe' },
      { label: 'GitHub', href: LINKS.repository, icon: 'github' },
    ]);
  }
}
