/**
 * The settings page shell: one scrolling page of sections, plus sub-pages a
 * row can drill into.
 *
 * It replaces the six-tab strip. Tabs put every group of settings at the same
 * distance from the eye, which is only fair when the groups are equally
 * important, and CULItrail's are not: the folders and the seventy-odd
 * frontmatter names are set once when a vault is adopted and then left alone
 * for years, while a dozen switches are the only rows anybody comes back for.
 * Six tabs also meant six places to look for the row you half remember, and
 * the property rows were spread across four of them.
 *
 * So the page shows the switches, and the long lists sit one click away behind
 * a row that says how many settings are in there.
 *
 * Which sub-page is open is deliberately not persisted, and is reset when the
 * page closes: it is where somebody is looking right now, not a preference.
 */
import { PluginSettingTab, setIcon } from 'obsidian';
import { t } from '../../lang/I18nManager';

/** What a section or a sub-page can ask the shell to do. */
export interface SettingsNavigator {
  /** Opens a sub-page by id. An unknown id leaves the page where it is. */
  open: (pageId: string) => void;
  /** Back to the root page. */
  back: () => void;
  /** Redraws whatever is open, for a row whose value changes which rows exist. */
  refresh: () => void;
}

export interface SettingsSubPage {
  id: string;
  /** A function rather than a string, so the title follows a locale change. */
  title: () => string;
  render: (containerEl: HTMLElement, nav: SettingsNavigator) => void;
}

export type RootRenderer = (containerEl: HTMLElement, nav: SettingsNavigator) => void;

export abstract class CULItrailSettingsPage extends PluginSettingTab {
  private renderRoot: RootRenderer | null = null;
  private subPages: SettingsSubPage[] = [];
  private openPageId: string | null = null;

  protected setRoot(render: RootRenderer): void {
    this.renderRoot = render;
  }

  protected setSubPages(pages: SettingsSubPage[]): void {
    this.subPages = pages;
  }

  display(): void {
    this.render();
  }

  hide(): void {
    this.openPageId = null;
    super.hide();
  }

  /**
   * The one repaint, called by `display()` and by every navigation.
   *
   * Separate from `display()` so nothing inside this class has to call the
   * method Obsidian has deprecated; the override above stays, because that is
   * still how the app asks a settings tab to draw itself.
   */
  protected render(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('culi-settings');

    const nav = this.buildNavigator();
    const page = this.subPages.find((candidate) => candidate.id === this.openPageId);

    if (!page) {
      this.renderRoot?.(containerEl, nav);
      return;
    }

    this.renderBackHeader(containerEl, page.title());
    page.render(containerEl.createDiv({ cls: 'culi-settings-panel' }), nav);
  }

  /** The sub-page header: back to the root, and the name of where you are. */
  private renderBackHeader(containerEl: HTMLElement, title: string): void {
    const header = containerEl.createDiv({ cls: 'culi-settings-subheader' });

    const back = header.createEl('button', {
      cls: 'culi-settings-back',
      attr: { 'aria-label': t('settings.nav.back') },
    });
    setIcon(back.createSpan({ cls: 'culi-settings-back-icon' }), 'chevron-left');
    back.createSpan({ text: t('settings.nav.back') });
    back.addEventListener('click', () => {
      this.openPageId = null;
      this.render();
    });

    header.createDiv({ cls: 'culi-settings-subtitle', text: title });
  }

  private buildNavigator(): SettingsNavigator {
    return {
      open: (pageId: string) => {
        this.openPageId = pageId;
        this.render();
        // A sub-page opened from halfway down the root page would otherwise
        // start wherever the click left the scroll.
        this.containerEl.scrollTop = 0;
      },
      back: () => {
        this.openPageId = null;
        this.render();
      },
      refresh: () => this.render(),
    };
  }
}
