/**
 * The command palette entries.
 *
 * One file rather than one per area, because a command is barely more than a
 * name pointing at something that already exists, and a reader wanting to
 * know what CULItrail can be asked to do should find the whole answer in one
 * place.
 *
 * The commands that act on one note use `checkCallback`, so they simply do not
 * appear when the active note is not of that kind. An entry that appeared and
 * then said "this is not a meal" would be a worse version of the same
 * information.
 */
import { MarkdownView, Plugin, TFile } from 'obsidian';
import { t } from './lang/I18nManager';
import type { CULItrailSettings } from './settings/types';
import type { CuliEntityType } from './vault/entity-types';
import { isNoteOfType } from './vault/read-notes';

export interface CommandActions {
  getSettings: () => CULItrailSettings;
  openDashboard: () => void;
  openGallery: () => void;
  openMealPlan: () => void;
  openOrders: () => void;
  newMeal: () => void;
  newDelivery: () => void;
  /** Picks a supplier and edits the ranges it publishes. */
  editSupplierLines: () => void;
  /** Picks a meal, or names one, and asks which day it goes on. */
  planAnyMeal: () => void;
  /** Previews the sample notes, then writes them. */
  createSampleVault: () => void;
  planMeal: (file: TFile) => void;
  editMeal: (file: TFile) => void;
  openAsMeal: (file: TFile) => void;
  openAsMarkdown: (file: TFile) => void;
  openAsOrder: (file: TFile) => void;
  openOrderAsMarkdown: (file: TFile) => void;
  openAsDelivery: (file: TFile) => void;
  openDeliveryAsMarkdown: (file: TFile) => void;
  openAsPlan: (file: TFile) => void;
  openPlanAsMarkdown: (file: TFile) => void;
  resyncWeek: () => void;
}

/**
 * The file a command about one kind of note would act on.
 *
 * Both view types, because a note can be in front of somebody as one of
 * CULItrail's own views or as plain Markdown, and a command that only worked in
 * one of them would look broken in the other.
 */
function activeNoteOfKind(
  plugin: Plugin,
  settings: CULItrailSettings,
  kind: CuliEntityType
): TFile | null {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  const file = view?.file ?? plugin.app.workspace.getActiveFile();

  if (!file) return null;
  return isNoteOfType(plugin.app, settings, file, kind) ? file : null;
}

export function registerCommands(plugin: Plugin, actions: CommandActions): void {
  const open = (id: string, name: string, callback: () => void): void => {
    plugin.addCommand({ id, name, callback });
  };

  open('open-dashboard', t('commands.openDashboard'), actions.openDashboard);
  open('open-gallery', t('commands.openGallery'), actions.openGallery);
  open('open-meal-plan', t('commands.openMealPlan'), actions.openMealPlan);
  open('open-orders', t('commands.openOrders'), actions.openOrders);
  // Always available, unlike edit-meal, which needs a meal in front of
  // somebody. Making one is the case where there is nothing to have open.
  open('new-meal', t('commands.newMeal'), actions.newMeal);
  // Always available for the same reason: planning starts with wanting to
  // plan something, not with having it in front of you.
  open('plan-a-meal', t('commands.planAMeal'), actions.planAnyMeal);
  // Always available for the same reason new-meal is: recording a box is the
  // case where there is nothing already open to act on.
  open('new-delivery', t('commands.newDelivery'), actions.newDelivery);
  // Always available: a supplier with no meals yet has no meal to open, and
  // its lines are worth entering before the first meal from it, not after.
  open('edit-supplier-lines', t('commands.editSupplierLines'), actions.editSupplierLines);
  open('resync-meal-plan', t('commands.resyncMealPlan'), actions.resyncWeek);
  // Always available, and deliberately not hidden once a vault has notes: the
  // modal is the thing that decides whether seeding is safe, and it can say why
  // it is not far better than an absent command can.
  open('create-sample-vault', t('commands.createSampleVault'), actions.createSampleVault);

  /** A command that only exists while a note of one kind is in front of the user. */
  const onNoteOfKind = (
    kind: CuliEntityType,
    id: string,
    name: string,
    run: (file: TFile) => void
  ): void => {
    plugin.addCommand({
      id,
      name,
      checkCallback: (checking: boolean) => {
        const file = activeNoteOfKind(plugin, actions.getSettings(), kind);
        if (!file) return false;
        if (!checking) run(file);
        return true;
      },
    });
  };

  const onMeal = (id: string, name: string, run: (file: TFile) => void): void =>
    onNoteOfKind('meal', id, name, run);

  onMeal('add-to-meal-plan', t('commands.addToMealPlan'), actions.planMeal);
  onMeal('edit-meal', t('meals.editor.title'), actions.editMeal);

  /**
   * Convert this leaf into one of our views.
   *
   * Only from Markdown. Inside the view itself it would do nothing, and the
   * "open as Markdown" command is the one that applies there.
   */
  const openInOwnView = (
    kind: CuliEntityType,
    id: string,
    name: string,
    run: (file: TFile) => void
  ): void => {
    plugin.addCommand({
      id,
      name,
      checkCallback: (checking: boolean) => {
        const file = activeNoteOfKind(plugin, actions.getSettings(), kind);
        const alreadyConverted =
          plugin.app.workspace.getActiveViewOfType(MarkdownView) === null && file !== null;
        if (!file || alreadyConverted) return false;
        if (!checking) run(file);
        return true;
      },
    });
  };

  openInOwnView('meal', 'open-in-meal-view', t('commands.openInMealView'), actions.openAsMeal);
  onMeal('open-as-markdown', t('commands.openAsMarkdown'), actions.openAsMarkdown);

  openInOwnView('order', 'open-in-order-view', t('commands.openInOrderView'), actions.openAsOrder);
  onNoteOfKind(
    'order',
    'open-order-as-markdown',
    t('commands.openOrderAsMarkdown'),
    actions.openOrderAsMarkdown
  );

  openInOwnView(
    'delivery',
    'open-in-delivery-view',
    t('commands.openInDeliveryView'),
    actions.openAsDelivery
  );
  onNoteOfKind(
    'delivery',
    'open-delivery-as-markdown',
    t('commands.openDeliveryAsMarkdown'),
    actions.openDeliveryAsMarkdown
  );

  openInOwnView('mealPlan', 'open-in-plan-view', t('commands.openInPlanView'), actions.openAsPlan);
  onNoteOfKind(
    'mealPlan',
    'open-plan-as-markdown',
    t('commands.openPlanAsMarkdown'),
    actions.openPlanAsMarkdown
  );
}
