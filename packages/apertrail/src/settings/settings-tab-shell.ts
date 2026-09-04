/**
 * The settings page shell: one scrolling page of sections, plus sub-pages
 * that a row can drill into.
 *
 * It replaces the tab strip this file used to hold. Tabs put every group of
 * settings at the same distance from the eye, which is only fair when the
 * groups are equally important, and APERtrail's are not: the folders and the
 * frontmatter property names are set once when a vault is adopted and then
 * left alone for years, while the handful of display switches are the only
 * rows anybody comes back for. So the page shows the switches, and hides the
 * long lists one click away behind a row that says how many are in there.
 *
 * The shell owns only the navigation: which sub-page is open, the back
 * header, and the repaint. `settings-tab.ts` supplies the root content and
 * the pages themselves.
 */
import { PluginSettingTab, setIcon } from 'obsidian';
import { t } from '../lang/I18nManager';

/** What a section or a sub-page can ask the shell to do. */
export interface SettingsNavigator {
  /** Opens a sub-page by id. Unknown ids leave the page where it is. */
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

export abstract class APERtrailSettingsPage extends PluginSettingTab {
  private renderRoot: RootRenderer | null = null;
  private subPages: SettingsSubPage[] = [];

  /**
   * Which sub-page is open, or null for the root.
   *
   * Deliberately not persisted, and deliberately reset when the page is
   * closed: it is where somebody is looking right now rather than a
   * preference, and a settings page that reopened three levels down a month
   * later would be answering a question nobody asked.
   */
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
   * method Obsidian has deprecated; the override above stays because that is
   * still how the app asks a settings tab to draw itself.
   */
  private render(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('apt-settings');

    const nav = this.buildNavigator();
    const page = this.subPages.find((candidate) => candidate.id === this.openPageId);

    if (!page) {
      this.renderRoot?.(containerEl, nav);
      return;
    }

    this.renderBackHeader(containerEl, page.title());
    page.render(containerEl, nav);
  }

  /** The sub-page header: back to the root, and the name of where you are. */
  private renderBackHeader(containerEl: HTMLElement, title: string): void {
    const header = containerEl.createDiv({ cls: 'apt-settings-subheader' });

    const back = header.createEl('button', {
      cls: 'apt-settings-back',
      attr: { 'aria-label': t('settings.nav.back') },
    });
    setIcon(back.createSpan({ cls: 'apt-settings-back-icon' }), 'chevron-left');
    back.createSpan({ text: t('settings.nav.back') });
    back.addEventListener('click', () => {
      this.openPageId = null;
      this.render();
    });

    header.createDiv({ cls: 'apt-settings-subtitle', text: title });
  }

  private buildNavigator(): SettingsNavigator {
    return {
      open: (pageId: string) => {
        this.openPageId = pageId;
        this.render();
        // A sub-page opened from halfway down a long root page would
        // otherwise start wherever the click happened to leave the scroll.
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
