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
import { sectionCard } from './rows';

type FolderKey =
  | 'tripsFolder'
  | 'bookingsFolder'
  | 'tripBookingsSubfolder'
  | 'tripExportsSubfolder'
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
      { key: 'tripExportsSubfolder', label: 'settings.folders.tripExportsSubfolder' },
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

/** How many folder rows the page holds, for the row on the root page. */
export const FOLDER_COUNT = MODULES.reduce((total, module) => total + module.folders.length, 0) + 1;

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
}
