/**
 * The meal view: a meal note rendered as something to order and reheat.
 *
 * A `TextFileView` rather than a plain `ItemView`, because Obsidian then
 * hands it the file's text and treats the tab as the file itself: navigation,
 * the file menu, "Open in default app" and the star of the tab all behave the
 * way they do for a Markdown note. The view never writes `this.data` back,
 * which is what makes it safe to be a read-only presentation of an editable
 * note.
 */
import { Menu, Notice, setIcon, TextFileView, TFile, WorkspaceLeaf } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { frontmatterOf } from '../../shared/vault-scan';
import { renderImageCard } from '../../ui/images';
import { makeLightboxable } from '../../ui/lightbox';
import { MEAL_VIEW_TYPE } from '../view-types';
import { buildWarnings } from '../safety/warnings';
import { renderWarnings } from '../safety/view/warning-row';
import { renderBadgeChips, renderTagRow } from './badge-row';
import { renderPriceLine } from './price-line';
import { currencyFor } from '../view-model/currency';
import { formatPrice } from '../view-model/format-price';
import { renderSupplierLine } from './supplier-line';
import { planBadges } from '../view-model/badge-display';
import { headerStrip } from '../view-model/header-strip';
import { renderStatStrip } from '../../ui/stat-strip';
import { readEatingEventsFor } from '../../planning/meal-plan/eating-events';
import { buildLayoutContext } from './build-context';
import { readSupplierReheating } from '../reheating/read-supplier';
import type { MealViewDeps } from './deps';
import { getMealLayoutRenderer, resolveMealLayoutId } from './layouts/registry';

export class MealView extends TextFileView {
  private unsubscribe: (() => void) | null = null;

  /**
   * Which render is the current one.
   *
   * Three things ask this view to redraw -- `setViewData` when the note's text
   * changes, the metadata cache when its frontmatter does, and the plugin's own
   * change signal -- and saving from the staged editor trips at least two of
   * them within a few milliseconds. See `render()` for what that used to do.
   */
  private renderToken = 0;

  /**
   * Kitchen mode holds a screen wake lock. Deliberately not persisted: it is
   * about what is happening in the kitchen right now, and a vault that
   * reopened with the screen pinned awake would be a battery bug.
   */
  private wakeLock: WakeLockSentinel | null = null;
  private kitchenMode = false;
  private kitchenModeButton: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly deps: MealViewDeps
  ) {
    super(leaf);
    this.navigation = true;
  }

  getViewType(): string {
    return MEAL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('meals.view.untitled');
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, _clear: boolean): void {
    this.data = data;
    void this.render();
  }

  clear(): void {
    this.data = '';
    this.contentEl.empty();
  }

  onOpen(): Promise<void> {
    this.kitchenModeButton = this.addAction('sun-dim', t('meals.view.kitchenModeOff'), () => {
      void this.toggleKitchenMode();
    });

    // Two pencils, deliberately. The square one opens the staged editor,
    // which writes only on Save; the plain one hands over the raw note. They
    // are different enough that folding them into one button would mean
    // guessing which somebody wanted.
    this.addAction('square-pen', t('meals.editor.title'), () => {
      if (this.file) this.deps.editMeal(this.file);
    });

    this.addAction('pencil', t('meals.view.editAsMarkdown'), () => {
      if (this.file) this.deps.editAsMarkdown(this.leaf, this.file);
    });

    // The OS drops a wake lock whenever the app is backgrounded, and does not
    // give it back. Without this, cook mode silently stops working the first
    // time somebody answers a message mid-meal.
    this.registerDomEvent(activeDocument, 'visibilitychange', () => {
      if (activeDocument.visibilityState === 'visible' && this.kitchenMode && !this.wakeLock) {
        void this.requestWakeLock();
      }
    });

    // Metadata changes arrive here too: the favorite heart and the multiplier
    // stepper both write frontmatter, and the view has to catch up with what it
    // just wrote.
    this.registerEvent(
      this.app.metadataCache.on('changed', (file: TFile) => {
        if (file.path === this.file?.path) void this.render();
      })
    );

    this.unsubscribe = this.deps.subscribeToChanges(() => void this.render());
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.releaseWakeLock();
    this.kitchenMode = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    return Promise.resolve();
  }

  onPaneMenu(menu: Menu, source: string): void {
    if (source === 'more-options' && this.file) {
      const file = this.file;
      menu.addItem((item) =>
        item
          .setTitle(t('meals.editor.title'))
          .setIcon('square-pen')
          .onClick(() => this.deps.editMeal(file))
      );
      menu.addItem((item) =>
        item
          .setTitle(t('meals.view.editAsMarkdown'))
          .setIcon('pencil')
          .onClick(() => this.deps.editAsMarkdown(this.leaf, file))
      );
      menu.addSeparator();
    }
    super.onPaneMenu(menu, source);
  }

  private async toggleKitchenMode(): Promise<void> {
    this.kitchenMode = !this.kitchenMode;
    if (this.kitchenMode) {
      await this.requestWakeLock();
      new Notice(t('meals.view.kitchenModeOnNotice'));
    } else {
      this.releaseWakeLock();
      new Notice(t('meals.view.kitchenModeOffNotice'));
    }
    this.paintKitchenModeButton();
  }

  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) {
      new Notice(t('meals.view.wakeLockUnsupported'));
      this.kitchenMode = false;
      this.paintKitchenModeButton();
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      // The lock can be released by the OS rather than by us. Repainting on
      // that event keeps the button honest about whether the screen is
      // actually being held awake.
      this.wakeLock.addEventListener('release', () => this.paintKitchenModeButton());
    } catch {
      new Notice(t('meals.view.wakeLockFailed'));
      this.kitchenMode = false;
      this.paintKitchenModeButton();
    }
  }

  private releaseWakeLock(): void {
    void this.wakeLock?.release();
    this.wakeLock = null;
  }

  private paintKitchenModeButton(): void {
    if (!this.kitchenModeButton) return;
    setIcon(this.kitchenModeButton, this.kitchenMode ? 'sun' : 'sun-dim');
    this.kitchenModeButton.setAttribute(
      'aria-label',
      this.kitchenMode ? t('meals.view.kitchenModeOn') : t('meals.view.kitchenModeOff')
    );
    this.kitchenModeButton.toggleClass('culi-kitchen-mode-active', this.kitchenMode);
  }

  /**
   * Draws the meal.
   *
   * **The container is emptied after the reads, not before, and a render that
   * has been overtaken stops before it touches the screen.** It used to empty
   * first and build afterwards, and the gap between the two is asynchronous:
   * the supplier's reheating text and the eating history are both reads. Two
   * renders starting inside that gap each emptied a container neither had drawn
   * into yet, and then both appended -- so the meal appeared twice, until
   * anything redrew it. Reported after saving a price, which is exactly the
   * moment two of the three triggers fire at once.
   *
   * Emptying late also removes the blank flash while the reads run: the meal
   * that is already on screen stays there until its replacement is ready.
   */
  private async render(): Promise<void> {
    const token = ++this.renderToken;

    if (!this.file) {
      this.contentEl.empty();
      return;
    }

    const settings = this.deps.getSettings();

    // The supplier's reheating boilerplate lives in a company note, and reading a
    // note body is asynchronous. Awaited here rather than inside the context
    // builder, which is deliberately synchronous so its parsing order stays
    // readable. An absent supplier, an absent note and an absent section all
    // arrive as an empty list, which is what makes this one line rather than three.
    const supplierEntries = await readSupplierReheating(
      this.app,
      settings,
      this.file.basename,
      frontmatterOf(this.app, this.file) ?? {}
    );

    // The eating history is in the meal plans, so it is a read too – and one this
    // view has to do for the same reason: the context builder does not go to
    // disk.
    const cooks = settings.eatingHistoryEnabled
      ? await readEatingEventsFor(this.app, settings, this.file.path)
      : [];

    const context = buildLayoutContext(this.app, this.file, this.data, settings, {
      supplierEntries: supplierEntries.entries,
      supplier: supplierEntries.supplier,
      cooks,
    });
    const layoutId = resolveMealLayoutId();

    // Overtaken while reading. The render that overtook this one owns the
    // screen, and everything below would be a second copy of the meal.
    if (token !== this.renderToken) return;

    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: ['culi-meal-view', `culi-layout-${layoutId}`] });

    // The picture belongs beside the facts rather than below the controls: it
    // is one of the facts. A row here, so the header block keeps its own
    // vertical rhythm and the card sits against the top of it.
    const header = root.createDiv({ cls: 'culi-header-row' });
    const title = header.createDiv({ cls: 'culi-title-block' });
    title.createEl('h1', { cls: 'culi-meal-title', text: this.file.basename });

    // The mobile layout builds its own header: the tags, the stars and the
    // badges all reappear inside its native card, sized for a phone. Rendering
    // them here as well showed every one of them twice.
    if (layoutId !== 'mobile-tabs') {
      // Planned once and rendered in two places. The chips sit directly under
      // the title, because what a dish *is* (its diet, and anything else
      // categorical) belongs with its name rather than three rows below it. The
      // figures go under the stars, which is where the whole badge row used to
      // be, so this phase changes what a badge looks like without also moving
      // where the numbers are.
      const badges = planBadges(
        context.frontmatter,
        settings,
        undefined,
        new Date(),
        context.eatingHistory
      );
      renderBadgeChips(title, badges);

      renderTagRow(title, context.meta.tags, settings);

      // Nutrition and the figure badges in one strip. The nutrition half used to
      // live in the meta banner below; see view-model/header-strip.ts for why the
      // two were merged rather than stacked.
      const strip = headerStrip(context.meta, settings, badges.cells);
      renderStatStrip(title, strip.cells, {
        cls: 'culi-badge-strip',
        caption: strip.caption ?? undefined,
      });

      // Directly under the figures, which is where a product card puts it. Not in
      // the meta banner below: that band is controls, and a price is a fact about
      // the dish like its nutrition.
      renderPriceLine(
        title,
        formatPrice(
          context.meta.price,
          currencyFor(context.meta, context.supplier.terms, settings)
        ),
        'culi-header-price'
      );

      // Under the price, because both are facts about buying this meal rather
      // than about eating it. Nothing is shown for a meal whose supplier could
      // not be worked out, which is most of a library that has never ordered.
      renderSupplierLine(title, context.supplier, context.meta.line);

      // Last, so it is the row's second child whatever the header holds. The
      // mobile layout is skipped here because its own card carries the picture.
      if (context.imageValue) renderImageCard(header, this.app, context.imageValue);
    }

    // Above the layout rather than inside it, so both arrangements show the
    // same warnings in the same place and neither has to remember to.
    renderWarnings(root, buildWarnings(context.meta.allergens, settings));

    // No second check after this one. A render that starts while the layout is
    // drawing empties the container first, which detaches `root`; the rest of
    // this pass then writes into a node nobody can see. A guard here would be
    // one that never changes what is on screen.
    await getMealLayoutRenderer(layoutId)({
      container: root,
      app: this.app,
      component: this,
      deps: this.deps,
      context,
    });

    this.makeBodyImagesLightboxable(root);
  }

  /**
   * Makes images inside the rendered Markdown open full-screen.
   *
   * Body images are deliberately rendered small so a photo between two steps
   * does not push the rest of the meal off the screen. The hero image is
   * skipped because `renderImageCard()` has already wired it.
   */
  private makeBodyImagesLightboxable(root: HTMLElement): void {
    const images = root.querySelectorAll<HTMLImageElement>(
      'img:not(.culi-meal-image):not(.culi-lightbox-img)'
    );
    images.forEach((image) => {
      if (image.hasClass('culi-lightbox-trigger')) return;
      makeLightboxable(image);
    });
  }
}
