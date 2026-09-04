/**
 * The gallery: every meal in scope as a grid, with search, filters and
 * sort.
 *
 * An `ItemView` rather than a file-backed one, because it is about the
 * library rather than about any one note. It re-renders on any vault change,
 * so a rating or a favorite set from the meal view is reflected here
 * without anybody refreshing anything.
 */
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { frontmatterOf } from '../../shared/vault-scan';
import type { GallerySavedState } from '../../settings/types';
import { defaultMealImageValue } from '../view-model/hero-image';
import { matchesGalleryFilters } from '../view-model/gallery-filter';
import { sortGalleryEntries } from '../view-model/gallery-sort';
import type { GalleryEntry } from '../view-model/gallery-entry';
import { resolveImagePath } from '../../ui/images';
import { GALLERY_VIEW_TYPE } from '../view-types';
import { buildGalleryEntries } from './build-entries';
import { frontmatterImageSrc, runLazyImagePass } from './card-images';
import type { GalleryViewDeps } from './deps';
import { renderGalleryCard, type GalleryCardHandle } from './gallery-card';
import { renderStatsRow } from './stats-row';
import { renderGalleryToolbar } from './toolbar';
import { TOOLBAR_SEARCH_SELECTOR } from '../../ui/toolbar';

export class GalleryView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private state: GallerySavedState;
  private filterPanelOpen = false;

  /**
   * Bumped on every render and on close.
   *
   * The lazy image pass is asynchronous and outlives the render that started
   * it. Comparing against this is how it learns to stop, rather than
   * finishing a hundred file reads for a grid nobody is looking at any more.
   */
  private generation = 0;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: GalleryViewDeps
  ) {
    super(leaf);
    this.state = { ...deps.getSettings().gallerySavedState };
    this.navigation = true;
  }

  getViewType(): string {
    return GALLERY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('meals.gallery.title');
  }

  getIcon(): string {
    return 'layout-grid';
  }

  onOpen(): Promise<void> {
    this.unsubscribe = this.deps.subscribeToChanges(() => void this.render());
    this.registerEvent(this.app.metadataCache.on('changed', () => void this.render()));
    void this.render();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  /** Narrows the grid to one folder. For the file explorer integration. */
  applyFolderFilter(folder: string): void {
    this.updateState({ ...this.state, folder });
  }

  /**
   * A state change, and whether it is the one that must not disturb the search
   * field.
   *
   * Everything except the search text comes from a control somebody has
   * finished using: a dropdown, a toggle, a sort button. The search text comes
   * from a field they are still typing into, and rebuilding that field under
   * their fingers is what this view spent two fixes failing to work around.
   */
  private updateState(next: GallerySavedState): void {
    const onlySearchChanged =
      next.search !== this.state.search &&
      JSON.stringify({ ...next, search: '' }) === JSON.stringify({ ...this.state, search: '' });

    this.state = next;
    void this.deps.saveGalleryState(next);
    void this.render({ keepToolbar: onlySearchChanged });
  }

  /**
   * Async because building the entries reads note bodies now: whether a dish is
   * eaten or reheated is a filter facet, so it has to be known before the grid
   * is painted. The `generation` guard below already existed for the lazy image
   * pass and covers this too, so a render that started before a newer one does
   * not paint over it.
   */
  private async render(options: { keepToolbar?: boolean } = {}): Promise<void> {
    this.generation++;
    const generation = this.generation;

    const settings = this.deps.getSettings();

    // **Read before anything is torn down.** This reads every meal note's body
    // and takes real time on a library of a few hundred. The old order removed
    // the toolbar first and awaited this with no search field on screen at all,
    // so every keystroke during the read went to a detached element and was
    // lost. That is the "search sometimes does nothing" this view was reported
    // for, and no amount of restoring focus afterwards could fix it: the
    // element the characters went to no longer existed.
    const entries = await buildGalleryEntries(this.app, settings);

    const existing = this.contentEl.querySelector('.culi-gallery-content');
    const results = existing?.querySelector('.culi-gallery-results');

    // A search-driven render keeps the toolbar it was typed into, and replaces
    // only what is below it.
    if (options.keepToolbar && existing && results.instanceOf(HTMLElement)) {
      results.empty();
      this.renderResults(results, entries, settings, generation);
      return;
    }

    const focus = this.captureSearchFocus(existing);
    existing?.remove();

    const content = this.contentEl.createDiv({ cls: 'culi-gallery-content' });

    renderGalleryToolbar(content, {
      entries,
      state: this.state,
      hasAllergenList: settings.myAllergens.length > 0,
      filterPanelOpen: this.filterPanelOpen,
      onChange: (next) => this.updateState(next),
      onToggleFilterPanel: () => {
        this.filterPanelOpen = !this.filterPanelOpen;
        void this.render();
      },
      onAddMeal: () => this.deps.newMeal(),
    });

    this.restoreSearchFocus(content, focus);
    this.renderResults(
      content.createDiv({ cls: 'culi-gallery-results' }),
      entries,
      settings,
      generation
    );
  }

  /** Everything below the toolbar: the count, and the grid or the reason there is none. */
  private renderResults(
    content: HTMLElement,
    entries: GalleryEntry[],
    settings: ReturnType<GalleryViewDeps['getSettings']>,
    generation: number
  ): void {
    const matched = entries.filter((entry) => matchesGalleryFilters(entry, this.state, settings));
    const sorted = sortGalleryEntries(
      matched,
      this.state.sortField,
      this.state.sortDirection,
      settings
    );

    if (sorted.length === 0) {
      // The two empty states are different problems with different fixes:
      // one is a folder or type setting, the other is the filter panel.
      content.createDiv({
        cls: 'culi-gallery-empty',
        text:
          entries.length === 0
            ? t('meals.gallery.emptyNoMeals')
            : t('meals.gallery.emptyNoMatches'),
      });
      return;
    }

    renderStatsRow(content, sorted.length, this.state);
    this.renderGrid(content, sorted, settings, generation);
  }

  private renderGrid(
    content: HTMLElement,
    entries: GalleryEntry[],
    settings: ReturnType<GalleryViewDeps['getSettings']>,
    generation: number
  ): void {
    const grid = content.createDiv({ cls: 'culi-gallery-grid' });
    const needsImage: GalleryCardHandle[] = [];

    for (const entry of entries) {
      const frontmatter = frontmatterOf(this.app, entry.file) ?? {};
      const handle = renderGalleryCard(
        grid,
        this.app,
        entry,
        frontmatter,
        settings,
        (file) => this.deps.openMeal(file),
        {
          planMeal: (file) => this.deps.planMeal(file),
        }
      );

      const src = frontmatterImageSrc(this.app, entry, frontmatter, settings);
      if (src) handle.setImage(src);
      else needsImage.push(handle);
    }

    if (needsImage.length === 0) return;

    // Resolved once for the whole pass rather than per card: it is the same
    // answer every time, and it is only reached by cards where both the
    // frontmatter and the body came up empty.
    const fallback = defaultMealImageValue(settings);
    const fallbackSrc = fallback ? resolveImagePath(this.app, fallback) : null;

    void runLazyImagePass(
      this.app,
      needsImage.map((handle) => handle.file),
      settings,
      (file, src) => {
        needsImage.find((handle) => handle.file.path === file.path)?.setImage(src ?? fallbackSrc);
      },
      () => generation !== this.generation
    );
  }

  /**
   * Remembers where the cursor was in the search field.
   *
   * The toolbar is rebuilt on every render, including the one the debounced
   * search itself triggers, so without this the field loses focus mid-word
   * and the rest of what somebody was typing goes nowhere.
   */
  private captureSearchFocus(previous: Element | null): { start: number; end: number } | null {
    const field = previous?.querySelector(TOOLBAR_SEARCH_SELECTOR);
    if (!field?.instanceOf(HTMLInputElement)) return null;
    if (this.contentEl.ownerDocument.activeElement !== field) return null;
    return { start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 };
  }

  private restoreSearchFocus(
    content: HTMLElement,
    focus: { start: number; end: number } | null
  ): void {
    if (!focus) return;
    const field = content.querySelector(TOOLBAR_SEARCH_SELECTOR);
    if (!field?.instanceOf(HTMLInputElement)) return;
    field.focus();
    field.setSelectionRange(focus.start, focus.end);
  }
}
