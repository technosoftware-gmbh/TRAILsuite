/**
 * What the four views share: a container, a render on open, and a manual
 * refresh.
 *
 * **Nothing is cached and nothing subscribes.** Each view re-reads the vault on
 * every render, so what it shows can never drift from what is on disk, and it
 * redraws on open, on an explicit refresh, and after a modal writes a note. It
 * does not redraw when you hand edit a note in another tab, which is the
 * deliberate trade the sibling plugins make: the data is never stale, only the
 * pixels can be.
 *
 * The render is asynchronous because reading task lines is. A render that
 * started while another was still running would interleave two passes over one
 * container, so a token guards it: only the newest pass is allowed to paint.
 */
import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { toolbar, toolbarButton } from '../kit/elements';
import { noteIcon } from '../kit/note-icon';
import { t } from '../../lang/I18nManager';
import type { ViewDeps } from '../kit/view-deps';

export abstract class NodaView extends ItemView {
  protected body!: HTMLElement;
  private renderToken = 0;

  constructor(
    leaf: WorkspaceLeaf,
    protected readonly deps: ViewDeps
  ) {
    super(leaf);
  }

  abstract getViewType(): string;
  abstract getDisplayText(): string;
  abstract getIcon(): string;

  /** Draws into `this.body`, which is empty when this is called. */
  protected abstract renderBody(): Promise<void>;

  /**
   * The icon a note names for itself, or the one this view would have drawn.
   *
   * On the base class because four views draw rows over notes and the
   * alternative is the same two lines four times, each free to reach for a
   * different setting.
   */
  protected noteIcon(file: TFile, fallback: string): string {
    return noteIcon(this.app, file, this.deps.getSettings().iconProperty, fallback);
  }

  /** Extra buttons beside Refresh. Drawn left of it, in the order given. */
  protected toolbarActions(): { label: string; icon: string; onClick: () => void }[] {
    return [];
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('nod-view');
    await this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  /** Redraws from the vault. Safe to call at any time; the newest call wins. */
  async render(): Promise<void> {
    const token = ++this.renderToken;
    this.contentEl.empty();

    const bar = toolbar(this.contentEl);
    for (const action of this.toolbarActions()) {
      toolbarButton(bar, action.label, action.icon, action.onClick);
    }
    toolbarButton(bar, t('common.refresh'), 'refresh-cw', () => void this.render());

    const body = this.contentEl.createDiv({ cls: 'nod-view-body' });
    this.body = body;

    await this.renderBody();

    // A newer render started while this one was awaiting the vault. Its own
    // pass has already emptied the container, so this one's output would be
    // appended to a screen it does not belong to.
    if (token !== this.renderToken) body.remove();
  }
}
