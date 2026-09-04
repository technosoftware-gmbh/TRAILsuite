/**
 * The Folders sub-page: where each kind of note lives.
 *
 * Laid out as four sections, Plan, PARA, Finance and CRM, so the page reads the
 * way the vault does. A module root moves everything beneath it, and every
 * sub-folder can still be repointed on its own.
 *
 * The five Plan rows are path **templates** rather than folders, so they are
 * plain text rows with the token legend beneath them rather than folder-suggest
 * fields: a folder autocomplete cannot complete `{YYYY}`.
 */
import { App, Setting } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { NODAtrailSettings } from '../../settings/types';
import { renderFolderField } from '../components/folder-field';
import { noteLine, sectionCard, textRow, toggleRow } from './rows';

export interface FolderPageDeps {
  app: App;
  settings: NODAtrailSettings;
  save: () => Promise<void>;
}

type FolderKey = Extract<
  keyof NODAtrailSettings,
  | 'rootFolder'
  | 'planRootFolder'
  | 'areasFolder'
  | 'goalsFolder'
  | 'projectsFolder'
  | 'resourcesFolder'
  | 'archiveFolder'
  | 'financeFolder'
  | 'purchasesFolder'
  | 'billsFolder'
  | 'recurringFolder'
  | 'budgetsFolder'
  | 'accountsFolder'
  | 'journalFolder'
  | 'ordersFolder'
  | 'crmFolder'
  | 'personsFolder'
  | 'companiesFolder'
>;

type SubfolderKey = Extract<
  keyof NODAtrailSettings,
  | 'billSubfolder'
  | 'purchaseSubfolder'
  | 'budgetSubfolder'
  | 'recurringSubfolder'
  | 'journalSubfolder'
>;

type TemplateKey = Extract<
  keyof NODAtrailSettings,
  'dailyPath' | 'weeklyPath' | 'monthlyPath' | 'quarterlyPath' | 'yearlyPath'
>;

export function renderFolderPage(containerEl: HTMLElement, deps: FolderPageDeps): void {
  const { app, settings, save } = deps;

  const folder = (parent: HTMLElement, key: FolderKey, label: string, desc = '') => {
    renderFolderField(parent, app, label, desc, settings[key], '', async (value) => {
      settings[key] = value;
      await save();
    });
  };

  const template = (parent: HTMLElement, key: TemplateKey, label: string) => {
    textRow(
      parent,
      { name: label },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  };

  containerEl.createEl('p', {
    cls: 'nod-settings-intro',
    text: t('settings.folders.description'),
  });

  const vault = sectionCard(containerEl, t('settings.vault.heading'));
  folder(vault, 'rootFolder', t('settings.vault.rootFolder'), t('settings.vault.rootFolderDesc'));

  const plan = sectionCard(containerEl, t('settings.folders.planSection'));
  folder(plan, 'planRootFolder', t('settings.folders.planRootFolder'));
  template(plan, 'dailyPath', t('settings.folders.dailyPath'));
  template(plan, 'weeklyPath', t('settings.folders.weeklyPath'));
  template(plan, 'monthlyPath', t('settings.folders.monthlyPath'));
  template(plan, 'quarterlyPath', t('settings.folders.quarterlyPath'));
  template(plan, 'yearlyPath', t('settings.folders.yearlyPath'));
  noteLine(plan, t('settings.folders.pathTokens'));

  const para = sectionCard(containerEl, t('settings.folders.paraSection'));
  folder(para, 'areasFolder', t('settings.folders.areasFolder'));
  folder(para, 'goalsFolder', t('settings.folders.goalsFolder'));
  folder(para, 'projectsFolder', t('settings.folders.projectsFolder'));
  folder(para, 'resourcesFolder', t('settings.folders.resourcesFolder'));
  folder(para, 'archiveFolder', t('settings.folders.archiveFolder'));

  const finance = sectionCard(containerEl, t('settings.folders.financeSection'));
  folder(finance, 'financeFolder', t('settings.folders.financeFolder'));
  folder(finance, 'purchasesFolder', t('settings.folders.purchasesFolder'));
  folder(finance, 'billsFolder', t('settings.folders.billsFolder'));
  folder(finance, 'recurringFolder', t('settings.folders.recurringFolder'));
  folder(finance, 'budgetsFolder', t('settings.folders.budgetsFolder'));
  folder(finance, 'accountsFolder', t('settings.folders.accountsFolder'));
  folder(finance, 'journalFolder', t('settings.folders.journalFolder'));
  // Somebody else's folder, read and never written. Blank turns the reading off.
  folder(finance, 'ordersFolder', t('settings.folders.ordersFolder'));
  noteLine(finance, t('settings.folders.ordersNote'));
  const subfolders: [SubfolderKey, string][] = [
    ['billSubfolder', t('finance.bills')],
    ['purchaseSubfolder', t('finance.purchases')],
    ['budgetSubfolder', t('finance.budget')],
    ['recurringSubfolder', t('finance.recurring')],
    ['journalSubfolder', t('ledger.journal')],
  ];
  for (const [key, label] of subfolders) {
    textRow(
      finance,
      { name: `${label}: ${t('settings.folders.subfolder')}` },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  }
  noteLine(finance, t('settings.folders.subfolderDesc'));

  textRow(
    finance,
    {
      name: t('settings.folders.documentSubfolder'),
      desc: t('settings.folders.documentSubfolderDesc'),
    },
    () => settings.documentSubfolder,
    async (value) => {
      settings.documentSubfolder = value;
      await save();
    }
  );

  // The four archive sub-folders, beside the folders they mirror. Named here
  // rather than left as literals because this vault archives a hundred
  // projects a year and browses them: see `entity-types.ts`.
  const archiveRow = (
    key:
      | 'areasArchiveFolder'
      | 'goalsArchiveFolder'
      | 'projectsArchiveFolder'
      | 'resourcesArchiveFolder',
    label: string
  ) => {
    textRow(
      para,
      { name: t('settings.folders.archiveSubfolder', { kind: label }) },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  };
  archiveRow('areasArchiveFolder', t('para.areas'));
  archiveRow('goalsArchiveFolder', t('para.goals'));
  archiveRow('projectsArchiveFolder', t('para.projects'));
  archiveRow('resourcesArchiveFolder', t('para.resources'));
  noteLine(para, t('settings.folders.archiveSubfolderDesc'));

  toggleRow(
    para,
    {
      name: t('settings.folders.projectFolderPerNote'),
      desc: t('settings.folders.projectFolderPerNoteDesc'),
    },
    () => settings.projectFolderPerNote,
    async (value) => {
      settings.projectFolderPerNote = value;
      await save();
    }
  );
  toggleRow(
    para,
    {
      name: t('settings.folders.archiveYearFolders'),
      desc: t('settings.folders.archiveYearFoldersDesc'),
    },
    () => settings.archiveYearFolders,
    async (value) => {
      settings.archiveYearFolders = value;
      await save();
    }
  );

  textRow(
    para,
    {
      name: t('settings.folders.imageSubfolder'),
      desc: t('settings.folders.imageSubfolderDesc'),
    },
    () => settings.imageSubfolder,
    async (value) => {
      settings.imageSubfolder = value;
      await save();
    }
  );

  textRow(
    para,
    {
      name: t('settings.folders.projectDefaultImageName'),
      desc: t('settings.folders.projectDefaultImageNameDesc'),
    },
    () => settings.projectDefaultImageName,
    async (value) => {
      settings.projectDefaultImageName = value;
      await save();
    }
  );

  const crm = sectionCard(containerEl, t('settings.folders.crmSection'));
  folder(crm, 'crmFolder', t('settings.folders.crmFolder'));
  folder(crm, 'personsFolder', t('settings.folders.personsFolder'));
  folder(crm, 'companiesFolder', t('settings.folders.companiesFolder'));
  textRow(
    crm,
    {
      name: t('settings.folders.eligiblePersonTags'),
      desc: t('settings.folders.eligiblePersonTagsDesc'),
    },
    () => settings.eligiblePersonTags,
    async (value) => {
      settings.eligiblePersonTags = value;
      await save();
    }
  );
  // Beside the person filter rather than in the Finance section, because all
  // three answer the same question: which of the CRM notes may a picker offer.
  const role = (key: 'billVendorRole' | 'billCustomerRole', name: string, desc: string) => {
    textRow(
      crm,
      { name, desc },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  };
  role(
    'billVendorRole',
    t('settings.folders.billVendorRole'),
    t('settings.folders.billVendorRoleDesc')
  );
  role(
    'billCustomerRole',
    t('settings.folders.billCustomerRole'),
    t('settings.folders.billCustomerRoleDesc')
  );

  // The day note ---------------------------------------------------------
  //
  // On this page rather than the property-keys one because none of these is a
  // property name: they are what the capture dialog writes into the body, and
  // the body is not frontmatter.
  const day = sectionCard(containerEl, t('settings.day.heading'));
  noteLine(day, t('settings.day.description'));

  const dayRow = (
    key: 'dayFocusHeading' | 'dayScheduleHeading' | 'dayNotesHeading',
    name: string,
    placeholder: string
  ) => {
    textRow(
      day,
      { name, desc: t('settings.day.blankUsesDefault', { example: placeholder }) },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  };
  dayRow('dayFocusHeading', t('settings.day.focusHeading'), t('day.headings.focus'));
  dayRow('dayScheduleHeading', t('settings.day.scheduleHeading'), t('day.headings.schedule'));
  dayRow('dayNotesHeading', t('settings.day.notesHeading'), t('day.headings.notes'));

  const markerRow = (
    key:
      | 'dayMeetingMarker'
      | 'dayMeetingTentativeMarker'
      | 'dayMeetingUnansweredMarker'
      | 'dayMeetingDeclinedMarker'
      | 'dayNoteMarker'
      | 'dayIdeaMarker',
    name: string
  ) => {
    textRow(
      day,
      { name },
      () => settings[key],
      async (value) => {
        settings[key] = value;
        await save();
      }
    );
  };
  markerRow('dayMeetingMarker', t('settings.day.meetingMarker'));
  markerRow('dayMeetingTentativeMarker', t('settings.day.tentativeMarker'));
  markerRow('dayMeetingUnansweredMarker', t('settings.day.unansweredMarker'));
  markerRow('dayMeetingDeclinedMarker', t('settings.day.declinedMarker'));
  markerRow('dayNoteMarker', t('settings.day.noteMarker'));
  markerRow('dayIdeaMarker', t('settings.day.ideaMarker'));
  noteLine(day, t('settings.day.markerDesc'));
  noteLine(day, t('settings.day.attendanceDesc'));

  new Setting(containerEl).setName('').setDesc('');
}
