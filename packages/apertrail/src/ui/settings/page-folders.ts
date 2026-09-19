/**
 * The folders sub-page: where APERtrail's notes live.
 *
 * Laid out in the three modules the vault is -- Trips, Places and CRM -- each
 * with its root folder first and its sub-folders under it, because that is
 * the shape `settings/types.ts` gives them: a module moves as a unit, and a
 * sub-folder can still be repointed on its own where one vault organizes that
 * one differently.
 */
import { App } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { renderFolderField } from '../components/folder-field';
import { sectionCard, toggleRow } from './rows';

type FolderKey =
  | 'tripsFolder'
  | 'archiveFolder'
  | 'tripsArchiveFolder'
  | 'bookingsFolder'
  | 'tripBookingsSubfolder'
  | 'exportsSubfolder'
  | 'placesFolder'
  | 'countriesFolder'
  | 'statesFolder'
  | 'citiesFolder'
  | 'accommodationFolder'
  | 'fnbFolder'
  | 'landmarksFolder'
  | 'locationsFolder'
  | 'photoSpotsFolder'
  | 'vehiclesFolder'
  | 'excursionsFolder'
  | 'crmFolder'
  | 'personsFolder'
  | 'companiesFolder';

interface FolderModule {
  heading: string;
  intro: string;
  folders: { key: FolderKey; label: string }[];
}

const MODULES: FolderModule[] = [
  {
    heading: 'settings.folders.tripsHeading',
    intro: 'settings.folders.tripsIntro',
    folders: [
      { key: 'tripsFolder', label: 'settings.folders.trips' },
      { key: 'bookingsFolder', label: 'settings.folders.bookings' },
      { key: 'tripBookingsSubfolder', label: 'settings.folders.tripBookingsSubfolder' },
      { key: 'exportsSubfolder', label: 'settings.folders.exportsSubfolder' },
    ],
  },
  {
    heading: 'settings.folders.placesHeading',
    intro: 'settings.folders.placesIntro',
    folders: [
      { key: 'placesFolder', label: 'settings.folders.places' },
      { key: 'countriesFolder', label: 'settings.folders.countries' },
      { key: 'statesFolder', label: 'settings.folders.states' },
      { key: 'citiesFolder', label: 'settings.folders.cities' },
      { key: 'accommodationFolder', label: 'settings.folders.accommodation' },
      { key: 'fnbFolder', label: 'settings.folders.fnb' },
      { key: 'landmarksFolder', label: 'settings.folders.landmarks' },
      { key: 'locationsFolder', label: 'settings.folders.locations' },
      { key: 'photoSpotsFolder', label: 'settings.folders.photoSpots' },
      // A vehicle is not a place, and its folder hangs off the Places root all
      // the same: every folder here is derived from one of the three module
      // roots, which is what keeps a module relocatable as a unit, and a
      // fourth root for one note type would buy nothing.
      { key: 'vehiclesFolder', label: 'settings.folders.vehicles' },
      // Nor is an excursion a place, and it hangs off the same root for the
      // same reason the vehicle does.
      { key: 'excursionsFolder', label: 'settings.folders.excursions' },
    ],
  },
  {
    heading: 'settings.folders.crmHeading',
    intro: 'settings.folders.crmIntro',
    folders: [
      { key: 'crmFolder', label: 'settings.folders.crm' },
      { key: 'personsFolder', label: 'settings.folders.persons' },
      { key: 'companiesFolder', label: 'settings.folders.companies' },
    ],
  },
];

/** The archive's own two, rendered outside MODULES so the year toggle can sit with them. */
const ARCHIVE_FOLDERS: { key: FolderKey; label: string }[] = [
  { key: 'archiveFolder', label: 'settings.folders.archive' },
  { key: 'tripsArchiveFolder', label: 'settings.folders.tripsArchive' },
];

/**
 * How many rows the page holds, for the row on the root page.
 *
 * The three beyond the modules are the root folder field at the top and the
 * archive card at the bottom, which is not a module: it holds one kind of note
 * today and is rendered on its own so its year toggle can sit with the two
 * folders it governs.
 */
export const FOLDER_COUNT =
  MODULES.reduce((total, module) => total + module.folders.length, 0) + 1 + 3;

export function renderFoldersPage(
  containerEl: HTMLElement,
  app: App,
  settings: APERtrailSettings,
  save: () => Promise<void>
): void {
  const parent = sectionCard(containerEl, undefined, t('settings.folders.intro'));

  renderFolderField(
    parent,
    app,
    t('settings.folders.root.name'),
    t('settings.folders.root.desc'),
    settings.rootFolder,
    t('settings.folders.root.placeholder'),
    async (value) => {
      settings.rootFolder = value;
      await save();
    }
  );

  for (const module of MODULES) {
    const card = sectionCard(containerEl, t(module.heading), t(module.intro));

    for (const folder of module.folders) {
      renderFolderField(
        card,
        app,
        t(`${folder.label}.name`),
        t(`${folder.label}.desc`),
        settings[folder.key],
        t(`${folder.label}.placeholder`),
        async (value) => {
          settings[folder.key] = value;
          await save();
        }
      );
    }
  }

  // Last, and a card of its own rather than a fourth module: where a retired
  // trip goes is a question about the vault as a whole, not about the Trips
  // module, and the year toggle has to sit with the two folders it governs.
  const archive = sectionCard(
    containerEl,
    t('settings.folders.archiveHeading'),
    t('settings.folders.archiveIntro')
  );
  for (const folder of ARCHIVE_FOLDERS) {
    renderFolderField(
      archive,
      app,
      t(`${folder.label}.name`),
      t(`${folder.label}.desc`),
      settings[folder.key],
      t(`${folder.label}.placeholder`),
      async (value) => {
        settings[folder.key] = value;
        await save();
      }
    );
  }
  toggleRow(
    archive,
    {
      name: t('settings.folders.archiveYearFolders.name'),
      desc: t('settings.folders.archiveYearFolders.desc'),
    },
    () => settings.archiveYearFolders,
    async (value) => {
      settings.archiveYearFolders = value;
      await save();
    }
  );
}
