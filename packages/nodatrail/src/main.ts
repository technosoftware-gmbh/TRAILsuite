/**
 * NODAtrail's entry point.
 *
 * Three modules, mirrored in the vault and in `src/`: **Plan** (the periodic
 * notes), **PARA** (areas, goals, projects, resources and the archive) and
 * **Finance** (purchases, bills, recurring costs and budgets). Modules are a
 * layout rather than a runtime abstraction: there is no module registry and no
 * `Component` indirection, and this is the one `Plugin` subclass.
 *
 * It owns the settings store, the four views, the commands, the six code-block
 * processors and the ribbon icon, and constructs the settings tab. See
 * docs/design/architecture.md.
 */
import { Notice, Plugin, TFile } from 'obsidian';
import { PERIOD_LEVELS, type PeriodLevel } from 'trail-core';
import { I18nManager, t } from './lang/I18nManager';
import { NODAtrailSettings } from './settings/types';
import { NODAtrailSettingsStore } from './settings/store';
import { NODAtrailSettingTab } from './settings/settings-tab';
import { DEFAULT_SETTINGS, getLocalizedFolderDefaults } from './settings/defaults';
import { adoptOrderSettings, adoptSiblingSettings } from './settings/foreign-settings-import';
import { now, today } from './shared/clock';
import { findOrOpenLeaf } from './shared/open-leaf';
import {
  archiveNote,
  DestinationExistsError,
  NotArchivableError,
  unarchiveNote,
} from './para/archive';
import { openOrCreatePeriodNote, removeNavigation } from './plan/write-period';
import { AddToDayModal, type AddToDayDeps, type CaptureTarget } from './plan/add-to-day-modal';
import { ImportCalendarModal } from './plan/calendar-import-modal';
import { RepairTimesModal } from './plan/ui/repair-times-modal';
import { notePathFor } from './plan/paths';
import { detectPeriodNote } from './plan/detect';
import { readPurchases } from './finance/read-finance';
import { readBudgets } from './ledger/read-ledger';
import { registerBlocks } from './ui/blocks/register';
import { WhatsNewModal } from './ui/settings/whats-new-modal';
import { HealthCheckModal } from './ui/modals/health-modal';
import { LedgerView } from './ui/views/ledger-view';
import { SeedChartModal } from './ledger/seed-chart';
import { SampleVaultModal } from './sample/ui/sample-vault-modal';
import { ImportStatementModal } from './ledger/import-modal';
import { AccountSetupModal } from './ledger/opening-modal';
import { NewAccountModal } from './ledger/new-account-modal';
import { NewPostingModal } from './ledger/new-posting-modal';
import { EditPostingModal } from './ledger/edit-posting-modal';
import { NewCompanyModal } from './crm/new-company-modal';
import { isNoteOfType } from 'trail-core';
import { hostFor } from './shared/vault-host';
import { NewPersonModal } from './crm/new-person-modal';
import { EditCompanyModal, EditPersonModal, type CrmNote } from './crm/edit-crm-modals';
import type { EditMoneyDeps } from './ui/modals/edit-money-modals';
import {
  EditBillModal,
  EditPurchaseModal,
  EditRecurringModal,
} from './ui/modals/edit-money-modals';
import type { EditParaDeps } from './ui/modals/edit-para-modals';
import { EditAreaModal, EditGoalModal, EditProjectModal } from './ui/modals/edit-para-modals';
import {
  NewAreaModal,
  NewGoalModal,
  NewProjectModal,
  NewResourceModal,
  type CreateDeps,
} from './ui/modals/new-para-modals';
import {
  NewBillModal,
  NewBudgetModal,
  NewPurchaseModal,
  NewRecurringModal,
} from './ui/modals/new-finance-modals';
import {
  EditBudgetLinesModal,
  EditPurchaseItemsModal,
  type EditDeps,
} from './ui/modals/edit-lines-modals';
import { MarkPaidModal } from './ui/modals/mark-paid-modal';
import { DashboardView } from './ui/views/dashboard-view';
import { ParaView } from './ui/views/para-view';
import { ProjectsView } from './ui/views/projects-view';
import { PlanView } from './ui/views/plan-view';
import { FinanceView } from './ui/views/finance-view';
import { CrmView } from './ui/views/crm-view';
import {
  CRM_VIEW_TYPE,
  DASHBOARD_VIEW_TYPE,
  FINANCE_VIEW_TYPE,
  LEDGER_VIEW_TYPE,
  PARA_VIEW_TYPE,
  PROJECTS_VIEW_TYPE,
  PLAN_VIEW_TYPE,
} from './ui/views/view-types';
import { resolveImageFile } from './ui/kit/images';
import type { ViewDeps } from './ui/kit/view-deps';

export default class NODAtrailPlugin extends Plugin {
  settingsStore!: NODAtrailSettingsStore;
  private ribbonIcon: HTMLElement | null = null;
  private captureIcon: HTMLElement | null = null;

  /**
   * The live settings object.
   *
   * A method rather than a `settings` getter: Obsidian's own `Plugin` declares
   * a `settings` member, and overriding a property with an accessor is a type
   * error.
   */
  getSettings(): NODAtrailSettings {
    return this.settingsStore.settings;
  }

  async onload(): Promise<void> {
    // Localization first: every command name and view built below resolves its
    // label through t() synchronously, so the catalogue has to be in place
    // before any of that runs. That leaves the language setting in a
    // chicken-and-egg spot, because the settings store resolves LOCALIZED
    // folder defaults and cannot run before the catalogue does. So the saved
    // value is read raw here and the store re-reads it a moment later with
    // everything else. Getting this order wrong is invisible in an English
    // vault and seeds a German one with folder names it can never rename by
    // itself.
    const saved = (await this.loadData()) as { language?: string } | null;
    I18nManager.init(this);
    await I18nManager.getInstance().initialize(saved?.language);

    this.settingsStore = new NODAtrailSettingsStore(this);
    await this.settingsStore.load();
    if (this.settingsStore.isFreshInstall) await this.seedFreshInstall();
    // Every load, not only the first. See `adoptOrderSettings`: these six are
    // the one group whose shipped value is a guess about another plugin rather
    // than an answer anybody gave, so a vault that has been running since
    // before they existed can still learn them.
    else if (await adoptOrderSettings(this.app, this.getSettings(), DEFAULT_SETTINGS)) {
      await this.settingsStore.save();
    }

    this.registerViews();
    this.registerCommands();
    registerBlocks(this, {
      app: this.app,
      getSettings: () => this.getSettings(),
      today,
      openNote: (file) => this.openNote(file),
      openFile: (path) => this.openFile(path),
    });

    this.addSettingTab(new NODAtrailSettingTab(this.app, this));
    this.refreshRibbonIcon();
  }

  onunload(): void {
    I18nManager.unload();
  }

  // Views ----------------------------------------------------------------

  private viewDeps(): ViewDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      today,
      now,
      openFile: (path) => this.openFile(path),
      openNote: (file) => this.openNote(file),
      openPara: () => void this.activate(PARA_VIEW_TYPE),
      openProjects: () => void this.activate(PROJECTS_VIEW_TYPE),
      openPlan: () => void this.activate(PLAN_VIEW_TYPE),
      openFinance: () => void this.activate(FINANCE_VIEW_TYPE),
      openCrm: () => void this.activate(CRM_VIEW_TYPE),
      openLedger: () => void this.activate(LEDGER_VIEW_TYPE),
      openNewArea: () => new NewAreaModal(this.createDeps()).open(),
      openNewGoal: () => new NewGoalModal(this.createDeps()).open(),
      openNewProject: () => new NewProjectModal(this.createDeps()).open(),
      openNewPurchase: () => new NewPurchaseModal(this.quietDeps()).open(),
      openNewBill: () => new NewBillModal(this.quietDeps()).open(),
      openNewRecurring: () => new NewRecurringModal(this.quietDeps()).open(),
      openNewBudget: () => new NewBudgetModal(this.quietDeps()).open(),
      openNewPerson: () => this.openNewCrm('person'),
      openNewCompany: () => this.openNewCrm('company'),
      openEditCrm: (kind, note) => this.openEditCrm(kind, note),
      // Opened through `openLoaded()`: the summary these three show is read
      // from the note's body, and a constructor cannot await.
      openEditArea: (area) => void new EditAreaModal(this.paraEditDeps(), area).openLoaded(),
      openEditGoal: (goal) => void new EditGoalModal(this.paraEditDeps(), goal).openLoaded(),
      openEditProject: (project) =>
        void new EditProjectModal(this.paraEditDeps(), project).openLoaded(),
      archivePara: (file, archived) => this.runArchive(file, archived ? 'unarchive' : 'archive'),
      openEditPurchaseItems: (purchase) =>
        new EditPurchaseItemsModal(this.editDeps(), purchase).open(),
      openEditBudgetLines: (budget) => new EditBudgetLinesModal(this.editDeps(), budget).open(),
      openMarkPaid: (bill) => new MarkPaidModal({ ...this.editDeps(), today }, bill).open(),
      openEditBill: (bill) => new EditBillModal(this.moneyEditDeps(), bill).open(),
      openEditPurchase: (purchase) => new EditPurchaseModal(this.moneyEditDeps(), purchase).open(),
      openEditRecurring: (recurring) =>
        new EditRecurringModal(this.moneyEditDeps(), recurring).open(),
      openEditPosting: (file, entry) => {
        const first = entry[0];
        if (!first) return;
        new EditPostingModal(
          { ...this.createDeps(), onChanged: () => this.refreshViews() },
          // The line the entry starts on, so a leg opens its whole split.
          { file, line: first.entryLine },
          entry
        ).open();
      },
      openDocument: (value) => void this.openDocument(value),
      openImportStatement: () => this.openImportStatement(),
      openArchivedStatement: (opening) => this.openImportStatement(opening),
      openNewAccount: () => new NewAccountModal(this.createDeps()).open(),
      openNewPosting: () => new NewPostingModal(this.quietDeps()).open(),
      openAccountSetup: () => this.openAccountSetup(),
      openHealthCheck: () => this.openHealthCheck(),
      openPeriod: (level, date) => this.openPeriod(level, date),
      openAddToDay: (target) => this.openAddToDay(target),
      openImportCalendar: () => this.openImportCalendar(),
      openEditDayEntry: (file, entry, onDone) =>
        new AddToDayModal(this.dayDeps(), { file, entry, onDone }).open(),
    };
  }

  /**
   * What a creation modal needs, including what to do afterwards.
   *
   * Opening the note it just wrote and redrawing every open view: the second is
   * why the views hold no subscription, and it is the one moment a view can
   * know its data changed without watching the vault.
   */
  /**
   * Creating something without then being taken to it.
   *
   * `createDeps()` opens what it made, which is right for a PARA note: an area
   * or a project is a document somebody is about to write in, and the form
   * collected only its title and a few properties.
   *
   * It is wrong for everything money. A posting is a line appended to a
   * month's journal that usually existed already. An invoice, a purchase, a
   * recurring cost and a budget are notes whose forms collected every field
   * they have, so there is nothing left to type into them. In all of those
   * cases opening the note takes the screen away from somebody part-way
   * through entering the next six -- which is the workflow these forms exist
   * for -- and the list they were entered from shows the new row anyway.
   *
   * The import dialog already worked this way: it writes many postings and
   * opens none, and `EditPostingModal` redraws without opening either. The
   * hand-posting form was the one that did not, and the money notes went on
   * doing it after that was fixed.
   */
  private quietDeps(): CreateDeps {
    return { ...this.createDeps(), onCreated: () => this.refreshViews() };
  }

  /** The same four things the money edit forms take, for the PARA ones. */
  private paraEditDeps(): EditParaDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onSaved: () => this.refreshViews(),
    };
  }

  private moneyEditDeps(): EditMoneyDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onSaved: () => this.refreshViews(),
    };
  }

  private editDeps(): EditDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      onSaved: () => this.refreshViews(),
    };
  }

  private createDeps(): CreateDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onCreated: (file) => {
        void this.openNote(file);
        this.refreshViews();
      },
    };
  }

  private registerViews(): void {
    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this.viewDeps()));
    this.registerView(PARA_VIEW_TYPE, (leaf) => new ParaView(leaf, this.viewDeps()));
    this.registerView(PROJECTS_VIEW_TYPE, (leaf) => new ProjectsView(leaf, this.viewDeps()));
    this.registerView(PLAN_VIEW_TYPE, (leaf) => new PlanView(leaf, this.viewDeps()));
    this.registerView(FINANCE_VIEW_TYPE, (leaf) => new FinanceView(leaf, this.viewDeps()));
    this.registerView(LEDGER_VIEW_TYPE, (leaf) => new LedgerView(leaf, this.viewDeps()));
    this.registerView(CRM_VIEW_TYPE, (leaf) => new CrmView(leaf, this.viewDeps()));
  }

  /** Redraws every open NODAtrail view. Called after anything writes a note. */
  refreshViews(): void {
    for (const type of [
      DASHBOARD_VIEW_TYPE,
      PARA_VIEW_TYPE,
      PROJECTS_VIEW_TYPE,
      PLAN_VIEW_TYPE,
      FINANCE_VIEW_TYPE,
      LEDGER_VIEW_TYPE,
      CRM_VIEW_TYPE,
    ]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const view = leaf.view;
        if (view instanceof DashboardView || view instanceof ParaView) void view.render();
        else if (view instanceof ProjectsView) void view.render();
        else if (view instanceof PlanView || view instanceof FinanceView) void view.render();
        else if (view instanceof CrmView) void view.render();
      }
    }
  }

  private async activate(viewType: string): Promise<void> {
    await findOrOpenLeaf(this.app, viewType);
  }

  // Commands -------------------------------------------------------------

  private registerCommands(): void {
    this.addCommand({
      id: 'open-dashboard',
      name: t('commands.openDashboard'),
      callback: () => void this.activate(DASHBOARD_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-projects',
      name: t('projects.title'),
      callback: () => void this.activate(PROJECTS_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-para',
      name: t('commands.openPara'),
      callback: () => void this.activate(PARA_VIEW_TYPE),
    });
    this.addCommand({
      id: 'add-to-day',
      name: t('day.add'),
      callback: () => this.openAddToDay(),
    });
    this.addCommand({
      id: 'import-calendar',
      name: t('calendar.import'),
      callback: () => this.openImportCalendar(),
    });
    this.addCommand({
      id: 'repair-calendar-times',
      name: t('calendar.repair.title'),
      callback: () => this.openRepairTimes(),
    });
    this.addCommand({
      id: 'open-plan',
      name: t('commands.openPlan'),
      callback: () => void this.activate(PLAN_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-finance',
      name: t('commands.openFinance'),
      callback: () => void this.activate(FINANCE_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-crm',
      name: t('crm.title'),
      callback: () => void this.activate(CRM_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-ledger',
      name: t('commands.openLedger'),
      callback: () => void this.activate(LEDGER_VIEW_TYPE),
    });

    // One command per level, because "open today" and "open this quarter" are
    // different keystrokes somebody binds, not one command with an argument.
    const openLabels: Record<PeriodLevel, string> = {
      day: t('plan.openToday'),
      week: t('plan.openThisWeek'),
      month: t('plan.openThisMonth'),
      quarter: t('plan.openThisQuarter'),
      year: t('plan.openThisYear'),
    };
    for (const level of PERIOD_LEVELS) {
      this.addCommand({
        id: `open-${level}`,
        name: openLabels[level],
        callback: () => void this.openPeriod(level, today()),
      });
    }

    this.addCommand({
      id: 'rebuild-navigation',
      name: t('plan.removeNavigation'),
      checkCallback: (checking) => this.removeNavigationCommand(checking),
    });

    this.addCommand({
      id: 'new-area',
      name: t('commands.newArea'),
      callback: () => new NewAreaModal(this.createDeps()).open(),
    });
    this.addCommand({
      id: 'new-goal',
      name: t('commands.newGoal'),
      callback: () => new NewGoalModal(this.createDeps()).open(),
    });
    this.addCommand({
      id: 'new-project',
      name: t('commands.newProject'),
      callback: () => new NewProjectModal(this.createDeps()).open(),
    });
    this.addCommand({
      id: 'new-resource',
      name: t('commands.newResource'),
      callback: () => new NewResourceModal(this.createDeps()).open(),
    });
    this.addCommand({
      id: 'new-purchase',
      name: t('commands.newPurchase'),
      callback: () => new NewPurchaseModal(this.quietDeps()).open(),
    });
    this.addCommand({
      id: 'new-bill',
      name: t('commands.newBill'),
      callback: () => new NewBillModal(this.quietDeps()).open(),
    });
    this.addCommand({
      id: 'new-recurring',
      name: t('commands.newRecurring'),
      callback: () => new NewRecurringModal(this.quietDeps()).open(),
    });
    this.addCommand({
      id: 'new-budget',
      name: t('commands.newBudget'),
      callback: () => new NewBudgetModal(this.quietDeps()).open(),
    });

    this.addCommand({
      id: 'archive-note',
      name: t('commands.archiveNote'),
      checkCallback: (checking) => this.archiveCommand(checking, 'archive'),
    });
    this.addCommand({
      id: 'unarchive-note',
      name: t('commands.unarchiveNote'),
      checkCallback: (checking) => this.archiveCommand(checking, 'unarchive'),
    });

    // The route that does not depend on a view finding the note first. Opening
    // the note and running the command works for a budget of any period, which
    // is what the finance tab could not do before it listed them all.
    this.addCommand({
      id: 'edit-lines',
      name: t('finance.editLines'),
      checkCallback: (checking) => this.editLinesCommand(checking),
    });

    this.addCommand({
      id: 'seed-chart',
      name: t('ledger.seedChart'),
      callback: () =>
        new SeedChartModal({
          app: this.app,
          getSettings: () => this.getSettings(),
          // What the catalogue actually resolved, not the raw setting. The
          // setting is `auto` in most vaults, which is not `de` and is not
          // `en` either, and comparing it to either one seeded a German vault
          // with an English chart.
          language: () =>
            I18nManager.getInstance().getCurrentLocale().startsWith('de') ? 'de' : 'en',
          now,
          onSeeded: () => this.refreshViews(),
        }).open(),
    });

    this.addCommand({
      id: 'new-company',
      name: t('crm.newCompany'),
      callback: () => this.openNewCrm('company'),
    });

    this.addCommand({
      id: 'new-person',
      name: t('crm.newPerson'),
      callback: () => this.openNewCrm('person'),
    });

    // Also editable from the note itself, which is where somebody already is
    // when they notice the account is wrong. The CRM view is the other way in,
    // for the case of looking for a company rather than being on it.
    this.addCommand({
      id: 'edit-company',
      name: t('crm.editCompany'),
      checkCallback: (checking) => this.editCrmCommand(checking, 'company'),
    });
    this.addCommand({
      id: 'edit-person',
      name: t('crm.editPerson'),
      checkCallback: (checking) => this.editCrmCommand(checking, 'person'),
    });

    this.addCommand({
      id: 'new-posting',
      name: t('ledger.newPosting'),
      callback: () => new NewPostingModal(this.quietDeps()).open(),
    });

    this.addCommand({
      id: 'new-account',
      name: t('ledger.newAccount'),
      callback: () => new NewAccountModal(this.createDeps()).open(),
    });

    this.addCommand({
      id: 'import-statement',
      name: t('ledger.importStatement'),
      callback: () => this.openImportStatement(),
    });

    this.addCommand({
      id: 'opening-balances',
      name: t('ledger.accountSetup'),
      callback: () => this.openAccountSetup(),
    });

    this.addCommand({
      id: 'health-check',
      name: t('commands.runHealthCheck'),
      callback: () => this.openHealthCheck(),
    });

    // Beside the chart seed rather than in a settings page: both write a batch
    // of notes into the vault, and both are things somebody does once.
    this.addCommand({
      id: 'create-sample-vault',
      name: t('commands.createSampleVault'),
      callback: () =>
        new SampleVaultModal({
          app: this.app,
          getSettings: () => this.getSettings(),
          now,
          onWritten: () => this.refreshViews(),
        }).open(),
    });
  }

  /**
   * Archive and unarchive, as one implementation.
   *
   * A `checkCallback` rather than a plain one, so the command does not appear in
   * the palette while the active note is not one NODAtrail can archive. The
   * check is deliberately cheap: it asks whether a file is open, not whether it
   * is a PARA note, because reading frontmatter on every palette keystroke would
   * be paid for by everybody.
   */
  private archiveCommand(checking: boolean, direction: 'archive' | 'unarchive'): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;
    if (checking) return true;

    this.runArchive(file, direction);
    return true;
  }

  /**
   * The move itself, shared by the command and the rows in the PARA view.
   *
   * Does not open the note afterwards when it was archived from a list: the
   * point of filing something away is that you are done looking at it.
   */
  private runArchive(file: TFile, direction: 'archive' | 'unarchive'): void {
    const run = direction === 'archive' ? archiveNote : unarchiveNote;
    void run(this.app, this.getSettings(), file, today())
      .then(() => {
        new Notice(
          t(direction === 'archive' ? 'notices.archived' : 'notices.unarchived', {
            title: file.basename,
          })
        );
        this.refreshViews();
      })
      .catch((error: unknown) => {
        if (error instanceof NotArchivableError) {
          new Notice(t('notices.nothingToArchive'));
        } else if (error instanceof DestinationExistsError) {
          new Notice(t('notices.noteExists', { path: error.path }));
        } else {
          // Anything else came from the vault rather than from the two errors
          // this command raises, and its own message is the only thing worth
          // putting on screen.
          new Notice(error instanceof Error ? error.message : t('notices.nothingToArchive'));
        }
      });
  }

  /**
   * Takes the old navigation block off the active period note.
   *
   * Still offered for one note at a time even though nothing writes a block any
   * more: a vault that was carrying blocks before this shipped has notes nobody
   * is going to edit, and this is how one of them gets cleaned without waiting
   * for a reason to write to it.
   *
   * `detectPeriodNote` still gates it, so the command never offers itself over
   * a note that is not a period note -- a nav-shaped line in somebody's writing
   * is not a navigation block.
   */
  private removeNavigationCommand(checking: boolean): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;

    const period = detectPeriodNote(this.getSettings(), file.basename);
    if (!period) return false;
    if (checking) return true;

    void removeNavigation(this.app, this.getSettings(), file).then((changed) => {
      if (changed) new Notice(t('notices.navigationRemoved'));
    });
    return true;
  }

  private dayDeps(): AddToDayDeps {
    return {
      app: this.app,
      getSettings: () => this.getSettings(),
      now: () => new Date(),
      today: () => new Date(),
    };
  }

  /** The capture dialog, over the period a view was showing or over today. */
  private openAddToDay(target?: CaptureTarget): void {
    new AddToDayModal(this.dayDeps(), undefined, target).open();
  }

  /**
   * The calendar import.
   *
   * Refreshes the views afterwards, unlike the capture dialog beside it: one
   * capture is a line somebody just typed and can see, while an import writes
   * a week across seven notes and the view it was opened from would otherwise
   * still be showing the week before it.
   */
  private openImportCalendar(): void {
    new ImportCalendarModal({
      ...this.dayDeps(),
      onImported: () => this.refreshViews(),
    }).open();
  }

  /**
   * The repair for the meeting times an earlier import wrote at the wrong
   * clock.
   *
   * Registered as a command rather than offered inside the import dialog, and
   * kept beside it: it is a one-off over the whole vault, not a step in an
   * import, and somebody who has already re-imported needs to be able to find
   * it afterwards. Refreshes the views for the import's own reason, only more
   * so -- it rewrites lines across hundreds of day notes.
   */
  private openRepairTimes(): void {
    new RepairTimesModal({
      app: this.app,
      getSettings: () => this.getSettings(),
      onRepaired: () => this.refreshViews(),
    }).open();
  }

  /**
   * Opens the line editor for whichever money note is in front of you.
   *
   * A budget and a purchase are the two notes with a list of maps on them, and
   * this is the one route to their editors that does not go through a view
   * having found the note first. It reads the note rather than searching for
   * it, so a budget for any period is editable the moment it is open.
   */
  /**
   * Edit the CRM note in front of you, when it is one of the right kind.
   *
   * Asked of the active file rather than through a chooser: a command that
   * offered a list would be a second way to find a note the vault already has
   * a dozen ways to find, and it would light up on every note in the vault
   * whether or not editing one made any sense.
   */
  /**
   * Creates a Person or a Company.
   *
   * Opens the note it made, unlike the money forms: a CRM note is a page
   * somebody writes on, and the form collects a handful of its fields.
   */
  private openNewCrm(kind: 'person' | 'company'): void {
    const deps = {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onCreated: (file: TFile) => {
        void this.openNote(file);
        this.refreshViews();
      },
    };
    if (kind === 'company') new NewCompanyModal(deps).open();
    else new NewPersonModal(deps).open();
  }

  /** The edit form for a CRM note somebody picked from a list. */
  private openEditCrm(kind: 'person' | 'company', note: CrmNote): void {
    const deps = {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onSaved: () => this.refreshViews(),
    };
    if (kind === 'company') new EditCompanyModal(deps, note).open();
    else new EditPersonModal(deps, note).open();
  }

  private editCrmCommand(checking: boolean, kind: 'company' | 'person'): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;

    const settings = this.getSettings();
    const query =
      kind === 'company'
        ? { folders: [settings.companiesFolder], typeValue: settings.companyTypeValue }
        : { folders: [settings.personsFolder], typeValue: settings.personTypeValue };
    const host = hostFor(this.app);
    if (!isNoteOfType(host, file, { ...query, typePropertyName: settings.typePropertyName })) {
      return false;
    }
    if (checking) return true;

    const note: CrmNote = {
      file,
      title: file.basename,
      frontmatter: host.metadata.frontmatterOf(file) ?? {},
    };
    const deps = {
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onSaved: () => this.refreshViews(),
    };
    if (kind === 'company') new EditCompanyModal(deps, note).open();
    else new EditPersonModal(deps, note).open();
    return true;
  }

  private editLinesCommand(checking: boolean): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) return false;

    const settings = this.getSettings();
    const budget = readBudgets(this.app, settings).find((note) => note.file.path === file.path);
    const purchase = readPurchases(this.app, settings).find((note) => note.file.path === file.path);
    if (!budget && !purchase) return false;
    if (checking) return true;

    if (budget) new EditBudgetLinesModal(this.editDeps(), budget).open();
    else if (purchase) new EditPurchaseItemsModal(this.editDeps(), purchase).open();
    return true;
  }

  // The rest ------------------------------------------------------------

  /**
   * The import and the setup screen, as methods rather than inline closures.
   *
   * Three callers each: a command, the ledger view's toolbar, and in one case a
   * button on a report. A closure written three times is three chances for one
   * of them to be given the wrong dependencies.
   */
  private openImportStatement(opening?: { text: string; name: string; account: number }): void {
    new ImportStatementModal({
      opening,
      app: this.app,
      getSettings: () => this.getSettings(),
      saveSettings: async (settings) => {
        Object.assign(this.settingsStore.settings, settings);
        await this.settingsStore.save();
      },
      now,
      onImported: () => this.refreshViews(),
    }).open();
  }

  private openAccountSetup(): void {
    new AccountSetupModal({
      app: this.app,
      getSettings: () => this.getSettings(),
      now,
      onSaved: () => this.refreshViews(),
    }).open();
  }

  private openHealthCheck(): void {
    new HealthCheckModal(
      this.app,
      () => this.getSettings(),
      (path) => this.openFile(path)
    ).open();
  }

  /** Opens a period note, creating it if it is not there. */
  async openPeriod(level: PeriodLevel, date: Date): Promise<void> {
    try {
      const file = await openOrCreatePeriodNote(this.app, this.getSettings(), level, date, now());
      await this.openNote(file);
    } catch {
      new Notice(t('notices.folderNotConfigured'));
    }
  }

  /** What a period note's path would be, for a view that wants to show it. */
  periodPath(level: PeriodLevel, date: Date): string {
    return notePathFor(this.getSettings(), level, date);
  }

  /** Adds or removes the ribbon icon to match the setting, without a reload. */
  refreshRibbonIcon(): void {
    if (!this.getSettings().showRibbonIcon) {
      this.ribbonIcon?.remove();
      this.ribbonIcon = null;
      this.captureIcon?.remove();
      this.captureIcon = null;
      return;
    }
    if (this.ribbonIcon) return;

    this.ribbonIcon = this.addRibbonIcon('brain-circuit', t('commands.openDashboard'), () => {
      void this.activate(DASHBOARD_VIEW_TYPE);
    });
    // Under the same setting as the dashboard icon rather than a second one.
    // Somebody who turned the ribbon off meant the ribbon, and two settings for
    // one row of icons is one more question than the question deserves.
    this.captureIcon = this.addRibbonIcon('calendar-plus', t('day.add'), () => {
      this.openAddToDay();
    });
  }

  showWhatsNew(): void {
    new WhatsNewModal(this.app, this.manifest.version).open();
  }

  async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.openNote(file);
  }

  async openNote(file: TFile): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  /**
   * Opens whatever a document property names, or says it names nothing.
   *
   * Resolved through the same lookup the images use, so a value written as a
   * wikilink, as a bare filename or as a full vault path all reach the file.
   * A property pointing at a document somebody has since moved or deleted is
   * the ordinary way this fails, and it is reported rather than ignored: a
   * button that does nothing when pressed reads as a broken button.
   */
  async openDocument(value: string): Promise<void> {
    const file = resolveImageFile(this.app, value);
    if (!file) {
      new Notice(t('finance.documentMissing', { path: value }));
      return;
    }
    await this.openNote(file);
  }

  /**
   * What a fresh install starts from: folder defaults resolved against this
   * vault, and the shared CRM settings adopted from a sibling.
   *
   * **Only on a fresh install.** A vault that has configured anything has
   * answered these questions already, and re-answering them would overwrite the
   * answer.
   */
  private async seedFreshInstall(): Promise<void> {
    const settings = this.getSettings();
    const exists = (path: string) => this.app.vault.getFolderByPath(path) !== null;

    Object.assign(
      settings,
      getLocalizedFolderDefaults(
        {
          rootFolder: settings.rootFolder,
          planRootFolder: settings.planRootFolder,
          financeFolder: settings.financeFolder,
          crmFolder: settings.crmFolder,
        },
        exists
      )
    );

    await adoptSiblingSettings(this.app, settings);
    await this.settingsStore.save();
  }
}
