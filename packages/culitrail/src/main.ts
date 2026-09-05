/**
 * CULItrail plugin entry point.
 *
 * Owns the load order, the views, and the surface that reaches them (ribbon,
 * commands, settings tab).
 *
 * The one code block it registers, `culi-related-orders`, renders inside a Person
 * or Company note that another plugin created. That is deliberate: a CRM note is
 * shared, and each plugin answers its own question inside it without owning it.
 */
import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { companyHasRole, currentWeekTitle } from '@technosoftware/trail-core';
import { I18nManager, t } from './lang/I18nManager';
import { CULItrailSettings, type DashboardActivityRangeWeeks } from './settings/types';
import { CULItrailSettingsStore } from './settings/store';
import { findOrOpenLeaf } from './shared/open-leaf';
import { suppressAutoOpenOnce } from './meals/lifecycle/auto-open';
import { registerFolderClick } from './meals/lifecycle/folder-click';
import { registerAutoOpen, registerContextMenu } from './meals/lifecycle/register-lifecycle';
import { EditMealModal } from './meals/editor/view/edit-modal';
import { NewMealModal } from './meals/editor/view/new-meal-modal';
import { registerCommands } from './commands';
import { SampleVaultModal } from './sample/ui/sample-vault-modal';
import { CULItrailSettingTab } from './settings/view/settings-tab';
import { Ribbon } from './ui/ribbon';
import { DashboardViewDeps } from './ui/dashboard/deps';
import { DashboardView } from './ui/dashboard/dashboard-view';
import { GalleryViewDeps } from './meals/gallery/deps';
import { GalleryView } from './meals/gallery/gallery-view';
import { eligiblePersons, resolveActivePerson } from './crm/persons';
import { readCompanies, readPersons } from './crm/read-crm';
import { SupplierLinesModal, SupplierLinesPicker } from './crm/supplier-lines-modal';
import { addEntry } from './planning/meal-plan/actions';
import { entriesForMeal, type EntryScope } from './planning/meal-plan/entries';
import { mealPlanNotePath } from './planning/meal-plan/note-path';
import { syncMealPlanWeek } from './planning/meal-plan/sync';
import { PlanMealModal, type PlannedSlot } from './planning/view/plan-meal-modal';
import { MealPickerModal, type Picked } from './planning/view/meal-picker';
import { MealPlanViewDeps, PlanNoteViewDeps } from './planning/view/deps';
import { MealPlanView } from './planning/view/meal-plan-view';
import { PlanNoteView } from './planning/view/plan-note-view';
import { openDeliveryEditor } from './deliveries/view/edit-delivery';
import { DeliveryNoteViewDeps } from './deliveries/view/deps';
import { DeliveryNoteView } from './deliveries/view/delivery-note-view';
import { readOrders } from './orders/read-orders';
import { allPersonTitles } from './orders/view/edit-order';
import { OrderNoteViewDeps, OrderViewDeps } from './orders/view/deps';
import { OrderNoteView } from './orders/view/order-note-view';
import { OrdersView } from './orders/view/order-view';
import { registerRelatedOrdersBlock } from './orders/view/related-orders-block';
import { MealViewDeps } from './meals/view/deps';
import { addEatingRecord } from './meals/history/write-history';
import { MarkEatenModal } from './meals/history/view/mark-eaten-modal';
import { MealView } from './meals/view/meal-view';
import {
  DASHBOARD_VIEW_TYPE,
  GALLERY_VIEW_TYPE,
  MEAL_PLAN_VIEW_TYPE,
  ORDERS_VIEW_TYPE,
  MEAL_PLAN_NOTE_VIEW_TYPE,
  ORDER_NOTE_VIEW_TYPE,
  DELIVERY_NOTE_VIEW_TYPE,
  MEAL_VIEW_TYPE,
} from './meals/view-types';

export default class CULItrailPlugin extends Plugin {
  settingsStore!: CULItrailSettingsStore;

  /**
   * Everything that wants telling when a render is stale.
   *
   * A plain set of callbacks rather than an event bus: there is one publisher
   * and a handful of subscribers, all inside this plugin, and a bus would add
   * a layer whose only job is to forget to unsubscribe.
   */
  private readonly changeListeners = new Set<() => void>();

  /**
   * The ribbon icons.
   *
   * Held because they are built once and toggled by class rather than added
   * and removed: Obsidian's ribbon can redraw an icon it was told to drop.
   */
  private ribbon: Ribbon | null = null;

  /**
   * The live settings object. A method rather than a `settings` getter:
   * Obsidian's own Plugin declares a `settings` property, and overriding a
   * property with an accessor is an error.
   *
   * Everything downstream takes this as a `getSettings: () => CULItrailSettings`
   * callback rather than a snapshot, so a settings change is picked up on the
   * next render without anything having to be rewired.
   */
  getSettings(): CULItrailSettings {
    return this.settingsStore.settings;
  }

  async onload(): Promise<void> {
    // Localization first. Every command name, view label and settings row
    // built later resolves its text through t() synchronously, and the
    // locale-aware folder defaults the settings store is about to use resolve
    // through it too, so the catalogue has to be in place before either.
    I18nManager.init(this);
    await I18nManager.getInstance().initialize();

    // Settings second, because everything after this point takes a
    // getSettings() callback.
    this.settingsStore = new CULItrailSettingsStore(this);
    await this.settingsStore.load();

    // The meal view, and the events that route a meal note into it.
    this.registerView(MEAL_VIEW_TYPE, (leaf) => new MealView(leaf, this.mealViewDeps()));
    this.registerView(GALLERY_VIEW_TYPE, (leaf) => new GalleryView(leaf, this.galleryViewDeps()));
    this.registerView(
      MEAL_PLAN_VIEW_TYPE,
      (leaf) => new MealPlanView(leaf, this.mealPlanViewDeps())
    );
    this.registerView(
      MEAL_PLAN_NOTE_VIEW_TYPE,
      (leaf) => new PlanNoteView(leaf, this.planNoteViewDeps())
    );
    this.registerView(ORDERS_VIEW_TYPE, (leaf) => new OrdersView(leaf, this.orderViewDeps()));
    this.registerView(
      ORDER_NOTE_VIEW_TYPE,
      (leaf) => new OrderNoteView(leaf, this.orderNoteViewDeps())
    );
    this.registerView(
      DELIVERY_NOTE_VIEW_TYPE,
      (leaf) => new DeliveryNoteView(leaf, this.deliveryNoteViewDeps())
    );
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.dashboardViewDeps())
    );

    // One registration for both kinds that have a view of their own. The same
    // suppression window and the same two events serve them, because a leaf is
    // showing one note at a time and the escape hatch means the same thing
    // whichever view it came from.
    const lifecycleDeps = {
      getSettings: () => this.getSettings(),
      targets: [
        {
          kind: 'meal' as const,
          viewType: MEAL_VIEW_TYPE,
          isEnabled: (settings: CULItrailSettings) => settings.autoOpenMealView,
          open: (leaf: WorkspaceLeaf, file: TFile) => void this.openAsMeal(leaf, file),
          menuTitle: () => t('lifecycle.contextMenu.openInMealView'),
          menuIcon: 'book-open',
        },
        {
          kind: 'mealPlan' as const,
          viewType: MEAL_PLAN_NOTE_VIEW_TYPE,
          isEnabled: (settings: CULItrailSettings) => settings.autoOpenMealPlanView,
          open: (leaf: WorkspaceLeaf, file: TFile) => void this.openAsPlan(leaf, file),
          menuTitle: () => t('lifecycle.contextMenu.openInPlanView'),
          menuIcon: 'calendar',
        },
        {
          kind: 'order' as const,
          viewType: ORDER_NOTE_VIEW_TYPE,
          isEnabled: (settings: CULItrailSettings) => settings.autoOpenOrderView,
          open: (leaf: WorkspaceLeaf, file: TFile) => void this.openAsOrder(leaf, file),
          menuTitle: () => t('lifecycle.contextMenu.openInOrderView'),
          menuIcon: 'receipt',
        },
        {
          kind: 'delivery' as const,
          viewType: DELIVERY_NOTE_VIEW_TYPE,
          isEnabled: (settings: CULItrailSettings) => settings.autoOpenDeliveryView,
          open: (leaf: WorkspaceLeaf, file: TFile) => void this.openAsDelivery(leaf, file),
          menuTitle: () => t('lifecycle.contextMenu.openInDeliveryView'),
          menuIcon: 'package',
        },
      ],
    };
    registerAutoOpen(this, lifecycleDeps);
    registerContextMenu(this, lifecycleDeps);
    registerFolderClick(this, {
      getSettings: () => this.getSettings(),
      openGallery: (folder) => void this.openGalleryForFolder(folder),
    });

    // The surface, last, once everything it points at exists.
    this.addSettingTab(
      new CULItrailSettingTab(this, {
        getSettings: () => this.getSettings(),
        getForeignImport: () => this.settingsStore.foreignImport,
        saveSettings: async () => {
          await this.settingsStore.save();
          // A settings change can add or remove a ribbon icon, and every open
          // view is now showing something computed from the old settings.
          this.ribbon?.update(this.getSettings());
          this.notifyChanged();
        },
      })
    );

    registerRelatedOrdersBlock(
      this.app,
      {
        getSettings: () => this.getSettings(),
        openFile: (path) => void this.app.workspace.openLinkText(path, '', true),
      },
      (lang, handler) => this.registerMarkdownCodeBlockProcessor(lang, handler)
    );

    this.ribbon = new Ribbon(this, {
      openDashboard: () => void findOrOpenLeaf(this.app, DASHBOARD_VIEW_TYPE),
      openGallery: () => void findOrOpenLeaf(this.app, GALLERY_VIEW_TYPE),
      openMealPlan: () => void findOrOpenLeaf(this.app, MEAL_PLAN_VIEW_TYPE),
    });
    this.ribbon.update(this.getSettings());

    registerCommands(this, {
      getSettings: () => this.getSettings(),
      openDashboard: () => void findOrOpenLeaf(this.app, DASHBOARD_VIEW_TYPE),
      openGallery: () => void findOrOpenLeaf(this.app, GALLERY_VIEW_TYPE),
      openMealPlan: () => void findOrOpenLeaf(this.app, MEAL_PLAN_VIEW_TYPE),
      openOrders: () => void findOrOpenLeaf(this.app, ORDERS_VIEW_TYPE),
      newMeal: () => this.newMeal(),
      newDelivery: () => this.newDelivery(),
      editSupplierLines: () => this.editSupplierLines(),
      planAnyMeal: () => this.planAnyMeal(),
      createSampleVault: () => this.createSampleVault(),
      planMeal: (file) => this.planMeal(file),
      editMeal: (file) => this.editMeal(file),
      openAsMeal: (file) => void this.openAsMeal(this.app.workspace.getLeaf(false), file),
      openAsMarkdown: (file) => void this.editAsMarkdown(this.app.workspace.getLeaf(false), file),
      openAsOrder: (file) => void this.openAsOrder(this.app.workspace.getLeaf(false), file),
      openOrderAsMarkdown: (file) =>
        void this.editAsMarkdown(this.app.workspace.getLeaf(false), file),
      openAsDelivery: (file) => void this.openAsDelivery(this.app.workspace.getLeaf(false), file),
      openDeliveryAsMarkdown: (file) =>
        void this.editAsMarkdown(this.app.workspace.getLeaf(false), file),
      openAsPlan: (file) => void this.openAsPlan(this.app.workspace.getLeaf(false), file),
      openPlanAsMarkdown: (file) =>
        void this.editAsMarkdown(this.app.workspace.getLeaf(false), file),
      // The week on screen when there is one, and this week otherwise. The
      // command is named "this week", and with the meal-plan view open that is
      // the week it is showing -- which is also the only case the command
      // exists for, since a week nobody is looking at has nothing to reconcile.
      // It resynced the current calendar week whichever week was on screen.
      resyncWeek: () =>
        void this.syncMealPlanWeek(
          this.getSettings().state.mealPlanViewedWeek || currentWeekTitle()
        ),
    });
  }

  /** The slice of the plugin the meal view is allowed to see. */
  private mealViewDeps(): MealViewDeps {
    return {
      getSettings: () => this.getSettings(),
      saveSettings: () => this.settingsStore.save(),
      editAsMarkdown: (leaf, file) => void this.editAsMarkdown(leaf, file),
      planMeal: (file) => this.planMeal(file),
      editMeal: (file) => this.editMeal(file),
      markEaten: (file) => this.markEaten(file),
      openMealPlan: () => void findOrOpenLeaf(this.app, MEAL_PLAN_VIEW_TYPE),
      // Any week, not just the one on screen. The question the button answers
      // is "is this already planned", and a meal on next Tuesday is planned
      // whichever week the meal-plan view happens to be showing.
      isPlanned: (file) => entriesForMeal(this.getSettings().state.mealPlan, file.path).length > 0,
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
    };
  }

  /** The slice of the plugin the gallery is allowed to see. */
  private galleryViewDeps(): GalleryViewDeps {
    return {
      getSettings: () => this.getSettings(),
      saveGalleryState: async (state) => {
        this.settingsStore.settings.gallerySavedState = state;
        await this.settingsStore.save();
      },
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      // A new tab rather than replacing the gallery: somebody browsing a
      // library expects to come back to it.
      openMeal: (file) => void findOrOpenLeaf(this.app, MEAL_VIEW_TYPE, file.path),
      planMeal: (file) => this.planMeal(file),
      // The gallery is where a library is browsed, so it is where one is added
      // to. The dashboard used to carry this button and no longer does.
      newMeal: () => this.newMeal(),
    };
  }

  /** The slice of the plugin the meal-plan view is allowed to see. */
  private mealPlanViewDeps(): MealPlanViewDeps {
    return {
      getSettings: () => this.getSettings(),
      saveSettings: () => this.settingsStore.save(),
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      syncWeek: (week) => this.syncMealPlanWeek(week),
      openMeal: (path) => void findOrOpenLeaf(this.app, MEAL_VIEW_TYPE, path),
      openWeekNote: (week, person) => {
        const path = mealPlanNotePath(this.getSettings(), week, person);
        if (path) void this.app.workspace.openLinkText(path, '', true);
      },
    };
  }

  /** The slice of the plugin a plan note rendered as its week is allowed to see. */
  private planNoteViewDeps(): PlanNoteViewDeps {
    return {
      getSettings: () => this.getSettings(),
      saveSettings: () => this.settingsStore.save(),
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      syncWeek: (week) => this.syncMealPlanWeek(week),
      openMeal: (path) => void findOrOpenLeaf(this.app, MEAL_VIEW_TYPE, path),
      editAsMarkdown: (leaf, file) => void this.editAsMarkdown(leaf, file),
    };
  }

  /** The slice of the plugin the orders view is allowed to see. */
  private orderViewDeps(): OrderViewDeps {
    return {
      getSettings: () => this.getSettings(),
      // Separate from a general save, exactly like the gallery's, so the view
      // can persist its toolbar and nothing else.
      saveOrdersState: async (state) => {
        this.settingsStore.settings.ordersSavedState = state;
        await this.settingsStore.save();
      },
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      // Through Obsidian's own link resolution, so a meal named in an order
      // opens even after it has been moved or renamed.
      openByTitle: (title, fromPath) => void this.app.workspace.openLinkText(title, fromPath, true),
    };
  }

  /**
   * The slice of the plugin one order note is allowed to see.
   *
   * The list view's deps plus the escape hatch back to Markdown, which only a
   * view that replaces Obsidian's own rendering needs.
   */
  private orderNoteViewDeps(): OrderNoteViewDeps {
    return {
      ...this.orderViewDeps(),
      editAsMarkdown: (leaf, file) => void this.editAsMarkdown(leaf, file),
    };
  }

  /**
   * The slice of the plugin one delivery note is allowed to see.
   *
   * Narrower than the order note's: a delivery has no list view, so there is no
   * toolbar state for it to persist.
   */
  private deliveryNoteViewDeps(): DeliveryNoteViewDeps {
    return {
      getSettings: () => this.getSettings(),
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      openByTitle: (title, fromPath) => void this.app.workspace.openLinkText(title, fromPath, true),
      editAsMarkdown: (leaf, file) => void this.editAsMarkdown(leaf, file),
    };
  }

  /**
   * The slice of the plugin the dashboard is allowed to see.
   *
   * The widest of these, because the dashboard is the one view that spans all
   * four areas. It is still a list of callbacks: it can ask for a gallery, it
   * does not decide how one opens.
   */
  private dashboardViewDeps(): DashboardViewDeps {
    return {
      getSettings: () => this.getSettings(),
      saveSettings: () => this.settingsStore.save(),
      subscribeToChanges: (onChange) => {
        this.changeListeners.add(onChange);
        return () => this.changeListeners.delete(onChange);
      },
      syncWeek: (week) => this.syncMealPlanWeek(week),
      openGallery: () => void findOrOpenLeaf(this.app, GALLERY_VIEW_TYPE),
      openMealPlan: () => void findOrOpenLeaf(this.app, MEAL_PLAN_VIEW_TYPE),
      openOrders: () => void findOrOpenLeaf(this.app, ORDERS_VIEW_TYPE),
      openMeal: (path) => void findOrOpenLeaf(this.app, MEAL_VIEW_TYPE, path),
      planAnyMeal: () => this.planAnyMeal(),
      planMeal: (file) => this.planMeal(file),
      // Only for the empty-vault card. The button that used to sit in the top
      // bar is the gallery's now; a vault with no meals has no gallery worth
      // sending anybody to.
      newMeal: () => this.newMeal(),
      searchMeals: (query) => void this.searchMeals(query),
      setViewedMealPlanWeek: (week) => void this.setViewedWeek('mealPlanViewedWeek', week),
      setActivityRange: (weeks) => void this.setActivityRange(weeks),
    };
  }

  /**
   * Opens the gallery filtered to a search.
   *
   * The query goes into the gallery's own saved state rather than being passed
   * as an argument, so the gallery's search box shows what was searched for and
   * one set of rules decides what a search matches.
   */
  private async searchMeals(query: string): Promise<void> {
    this.settingsStore.settings.gallerySavedState.search = query;
    await this.settingsStore.save();
    await findOrOpenLeaf(this.app, GALLERY_VIEW_TYPE);
    this.notifyChanged();
  }

  /** Remembers which week a dashboard card is browsing. The same field the full view uses. */
  private async setViewedWeek(field: 'mealPlanViewedWeek', week: string): Promise<void> {
    this.settingsStore.settings.state[field] = week;
    await this.settingsStore.save();
    this.notifyChanged();
  }

  private async setActivityRange(weeks: DashboardActivityRangeWeeks): Promise<void> {
    this.settingsStore.settings.dashboardActivityRangeWeeks = weeks;
    await this.settingsStore.save();
    this.notifyChanged();
  }

  /** Reconciles one week's meal-plan notes into state. */
  private async syncMealPlanWeek(week: string): Promise<void> {
    const settings = this.getSettings();
    const result = await syncMealPlanWeek(this.app, settings, week);
    if (!result.changed) return;

    settings.state.mealPlan = result.entries;

    await this.settingsStore.save();
    this.notifyChanged();
  }

  /**
   * Opens the gallery from a file-explorer click, narrowed to what was
   * clicked.
   *
   * The folder filter is part of the gallery's persisted state, so this does
   * overwrite whatever folder filter was last set by hand. That is the point
   * of the feature rather than a side effect of it: clicking a folder that
   * then showed a different folder's meals would be worse.
   *
   * The leaf is replaced rather than a tab opened, because this was a click in
   * the file explorer and that is what every other click there does.
   */
  private async openGalleryForFolder(folder: string | null): Promise<void> {
    this.settingsStore.settings.gallerySavedState.folder = folder;
    await this.settingsStore.save();
    await findOrOpenLeaf(this.app, GALLERY_VIEW_TYPE, undefined, false);
    this.notifyChanged();
  }

  /**
   * Plans one meal, from the meal view rather than from the meal plan.
   *
   * The week and the person are the ones the meal-plan view is set to, read
   * the same way it reads them, so planning from here and planning from there
   * can never land in two different places.
   *
   * The week is synced before the entry is added. Without it, a week nothing
   * has opened yet would have the new meal pushed onto a state that has never
   * seen that week's note, and the next sync would find an entry state
   * claims and the note already holds.
   */
  /**
   * Records a cook against a meal.
   *
   * The write is awaited only inside the callback, so the modal closes on click
   * rather than sitting open while an attachment is copied into the vault.
   */
  private markEaten(file: TFile): void {
    const settings = this.getSettings();
    new MarkEatenModal(this.app, file, settings, (result) => {
      void addEatingRecord(this.app, file, settings, {
        date: result.date,
        note: result.note,
        personLink: result.personLink,
        rating: result.rating,
      }).then(() => this.notifyChanged());
    }).open();
  }

  private planMeal(file: TFile): void {
    this.planPicked({ kind: 'meal', file });
  }

  /**
   * Asks which day and slot, then writes it.
   *
   * Takes what the picker returns rather than a file, so a meal note and a
   * typed-out label go down the same path. The week and the person are the
   * ones the meal-plan view is set to: a second place to choose them would be
   * a second answer to "whose plan am I looking at".
   */
  private planPicked(picked: Picked): void {
    const settings = this.getSettings();
    const eligible = eligiblePersons(readPersons(this.app, settings), settings.eligiblePersonTags);
    const scope: EntryScope = {
      week: settings.state.mealPlanViewedWeek || currentWeekTitle(),
      person: resolveActivePerson(eligible, settings.state.mealPlanActivePerson),
    };

    const title = picked.kind === 'meal' ? picked.file.basename : picked.label;

    new PlanMealModal(this.app, title, scope, (slot) => {
      void this.addPlannedMeal(picked, scope, slot);
    }).open();
  }

  private async addPlannedMeal(
    picked: Picked,
    scope: EntryScope,
    slot: PlannedSlot
  ): Promise<void> {
    await this.syncMealPlanWeek(scope.week);

    const settings = this.getSettings();
    const title = picked.kind === 'meal' ? picked.file.basename : picked.label;
    const entry = await addEntry(this.app, settings, scope, {
      mealPath: picked.kind === 'meal' ? picked.file.path : '',
      label: picked.kind === 'label' ? picked.label : undefined,
      day: slot.day,
      meal: slot.meal,
    });

    if (!entry) {
      new Notice(t('planning.planMeal.failed'));
      return;
    }

    await this.settingsStore.save();
    this.notifyChanged();
    new Notice(t('planning.planMeal.added', { name: title, week: scope.week }));
  }

  /**
   * Asks for a name, makes the note, and opens the editor on it.
   *
   * The editor is reused rather than duplicated: everything a meal has is
   * already a field there, and a second form for the same note would be a
   * second place for those fields to drift. All this adds is the one thing the
   * editor cannot ask, because it edits a note and a note needs a name to be.
   */
  newMeal(): void {
    new NewMealModal(this.app, this.getSettings(), (file) => {
      this.notifyChanged();
      this.editMeal(file);
    }).open();
  }

  /**
   * Picks a supplier, then edits the ranges it publishes.
   *
   * Narrowed to the companies that do meals, the same filter the supplier
   * dropdown uses, so this does not become a list of every company the vault
   * has ever paid.
   */
  editSupplierLines(): void {
    const settings = this.getSettings();
    const companies = readCompanies(this.app, settings)
      .filter((company) => companyHasRole(company.roles, settings.mealSupplierRole))
      .map((company) => ({ file: company.file, title: company.title }));

    if (companies.length === 0) {
      new Notice(t('meals.lines.noSuppliers'));
      return;
    }

    new SupplierLinesPicker(this.app, companies, (company) => {
      new SupplierLinesModal(this.app, company.file, company.title, settings, () =>
        this.notifyChanged()
      ).open();
    }).open();
  }

  /**
   * Records a box that arrived, from the command palette.
   *
   * The orders view has its own button for this; the command exists so the box
   * can be logged from wherever somebody happens to be when they unpack it.
   */
  newDelivery(): void {
    const settings = this.getSettings();
    openDeliveryEditor(
      this.app,
      settings,
      readOrders(this.app, settings, allPersonTitles(this.app, settings)),
      () => this.notifyChanged()
    );
  }

  /**
   * Opens the staged meal editor.
   *
   * A method rather than a call site, because the meal view's header, the
   * pane menu and the command palette all want it and none of them should
   * have to know how a saved edit reaches the open views.
   */
  editMeal(file: TFile): void {
    new EditMealModal(this.app, file, this.getSettings(), () => this.notifyChanged()).open();
  }

  /**
   * Plans something without starting from a meal.
   *
   * The picker first, then the same day-and-slot question a meal planned from
   * its own note asks. What it offers is what the meal-plan view's own picker
   * offers, including the typed-out label for an evening that is not a meal
   * note at all, because a plan made from the dashboard and a plan made from
   * the week grid should not be able to hold different things.
   */
  private planAnyMeal(): void {
    new MealPickerModal(this.app, this.getSettings(), (picked) => this.planPicked(picked)).open();
  }

  /**
   * Writes the sample notes, after showing what they would be.
   *
   * `new Date()` is passed in rather than read inside the content, so the two
   * seeded weeks are the week just gone and the week somebody is actually in.
   */
  private createSampleVault(): void {
    new SampleVaultModal(this.app, this.getSettings(), new Date(), () =>
      this.notifyChanged()
    ).open();
  }

  /** Tells every open view its data may be stale. */
  private notifyChanged(): void {
    for (const listener of this.changeListeners) listener();
  }

  /** Converts a leaf into the meal view, keeping the file it is showing. */
  private async openAsMeal(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    await leaf.setViewState({ type: MEAL_VIEW_TYPE, state: { file: file.path } });
  }

  /** Converts a leaf into the order note's invoice, keeping the file it is showing. */
  private async openAsPlan(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    await leaf.setViewState({ type: MEAL_PLAN_NOTE_VIEW_TYPE, state: { file: file.path } });
  }

  private async openAsOrder(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    await leaf.setViewState({ type: ORDER_NOTE_VIEW_TYPE, state: { file: file.path } });
  }

  /** Converts a leaf into the delivery note's document, keeping the file it is showing. */
  private async openAsDelivery(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    await leaf.setViewState({ type: DELIVERY_NOTE_VIEW_TYPE, state: { file: file.path } });
  }

  /**
   * Opens a note this plugin renders as plain Markdown.
   *
   * The suppression is what makes it stick: without it the auto-open handler
   * sees a Markdown leaf showing a meal or an order and converts it straight
   * back, so the pencil button would appear to do nothing at all.
   */
  private async editAsMarkdown(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    suppressAutoOpenOnce(file.path);
    await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source' } });
  }

  onunload(): void {
    // Everything registered through Plugin's own register* helpers is torn
    // down by Obsidian. I18nManager holds a static singleton, which is not,
    // so it gets cleared by hand: leaving it behind would let a reload find a
    // manager pointing at the previous plugin instance's app.
    I18nManager.unload();
  }
}
