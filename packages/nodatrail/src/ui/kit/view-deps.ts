/**
 * What every NODAtrail view needs from the plugin, as an interface.
 *
 * The views take this rather than the `Plugin` itself, which is what keeps them
 * out of the plugin's own type and makes each one constructible in isolation.
 * It is also the seam the modals are opened through, so a view never imports a
 * modal it does not draw.
 */
import { App, TFile } from 'obsidian';
import type {
  AccountBudgetRecord,
  BillRecord,
  Posting,
  PurchaseRecord,
  RecurringRecord,
} from 'trail-core';
import type { NODAtrailSettings } from '../../settings/types';
import type { AreaRecord, GoalRecord, ProjectRecord } from '../../para/board';
import type { DayEntryRecord } from '../../plan/read-day';
import type { PeriodLevel } from 'trail-core';

export interface ViewDeps {
  app: App;
  getSettings: () => NODAtrailSettings;
  /** Local midnight today. Injected so a view can be pointed at a fixed day. */
  today: () => Date;
  /** The current moment, for a stamp. */
  now: () => Date;
  openFile: (path: string) => Promise<void>;
  openNote: (file: TFile) => Promise<void>;
  /**
   * The four other views, so one can send somebody to another.
   *
   * Opened through the deps rather than by a view importing a sibling view:
   * a view that knew how to construct another would be a view that could not
   * be built on its own, which is the whole point of this interface.
   */
  openPara: () => void;
  openPlan: () => void;
  openCrm: () => void;
  openFinance: () => void;
  openLedger: () => void;
  openNewArea: () => void;
  openNewGoal: () => void;
  openNewProject: () => void;
  openNewPurchase: () => void;
  openNewBill: () => void;
  openNewRecurring: () => void;
  openNewBudget: () => void;
  openNewPerson: () => void;
  openNewCompany: () => void;
  /** The edit form for a Person or a Company, from a list rather than from the note. */
  openEditCrm: (
    kind: 'person' | 'company',
    note: { file: TFile; title: string; frontmatter: Record<string, unknown> }
  ) => void;
  /** The same form over a note that exists, for each PARA note that has a card. */
  openEditArea: (area: AreaRecord<TFile>) => void;
  openEditGoal: (goal: GoalRecord<TFile>) => void;
  openEditProject: (project: ProjectRecord<TFile>) => void;
  /** The project dashboard: every project as a card, filtered and searched. */
  openProjects: () => void;
  /**
   * Files a note away, or brings it back.
   *
   * On the row rather than only in the command palette: with a hundred
   * projects a year, archiving one has to be a click where you already are or
   * the folder it should be leaving fills up instead.
   */
  archivePara: (file: TFile, archived: boolean) => void;
  /** The two list-of-maps editors, which are the only notes NODAtrail reopens. */
  openEditPurchaseItems: (purchase: PurchaseRecord<TFile>) => void;
  openEditBudgetLines: (budget: AccountBudgetRecord<TFile>) => void;
  /** The commonest thing that happens to a bill, and the one that decides what is owed. */
  openMarkPaid: (bill: BillRecord<TFile>) => void;
  /** The same form over a note that exists, for each of the three money notes. */
  openEditBill: (bill: BillRecord<TFile>) => void;
  openEditPurchase: (purchase: PurchaseRecord<TFile>) => void;
  openEditRecurring: (recurring: RecurringRecord<TFile>) => void;
  /** The three ways into the ledger, from its own toolbar. */
  /** Correcting a line already in a journal note, from the statement it shows up wrong in. */
  openEditPosting: (file: TFile, entry: readonly Posting[]) => void;
  /**
   * Opens the paper a note points at: the invoice PDF, the receipt.
   *
   * Takes the property's value rather than a file, because that value is what
   * the note holds and it may name nothing -- a document moved out of the vault
   * leaves a property behind, and finding that out is this call's job rather
   * than every caller's.
   */
  openDocument: (value: string) => void;
  openImportStatement: () => void;
  /** The same dialog, opened on a statement the vault already keeps. */
  openArchivedStatement: (opening: { text: string; name: string; account: number }) => void;
  openNewAccount: () => void;
  openNewPosting: () => void;
  openAccountSetup: () => void;
  openHealthCheck: () => void;
  openPeriod: (level: 'day' | 'week' | 'month' | 'quarter' | 'year', date: Date) => Promise<void>;
  /**
   * The capture dialog.
   *
   * The target is the period a view was showing, which decides where an entry
   * with no date lands. Omitted means today, which is what the command and the
   * ribbon mean: they are reachable from anywhere.
   */
  openAddToDay: (target?: { level: PeriodLevel; date: Date }) => void;
  /** The same dialog over an entry already in a note. `onDone` redraws the view that opened it. */
  openEditDayEntry: (file: TFile, entry: DayEntryRecord, onDone: () => void) => void;
  /** The calendar import's preview. It writes into day notes, so it belongs beside the capture dialog. */
  openImportCalendar: () => void;
}
