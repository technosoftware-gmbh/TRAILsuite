/**
 * APERtrail plugin entry point -- Trips/Countries/States/Cities/
 * Accommodation/FnB/Landmarks/Locations/Photo spots. See
 * docs/design/travel-module-plan.md for the design this is built from,
 * docs/design/photo-spots.md for the photo spot type on top of it, and
 * docs/design/dashboard-split-and-crm.md for the split into a dashboard per
 * module and for the later fold of both of them into the gallery.
 */
import { Plugin } from 'obsidian';
import { I18nManager, t } from './lang/I18nManager';
import { APERtrailSettings } from './settings/types';
import { APERtrailSettingsStore } from './settings/store';
import { APERtrailSettingTab } from './settings/settings-tab';
import { findOrOpenLeaf } from './shared/open-leaf';
import { EntityTypeCheckModal } from './vault/health/entity-type-check-modal';
import {
  TravelGalleryView,
  TRAVEL_GALLERY_VIEW_TYPE,
  GalleryTypeFilter,
} from './ui/gallery/travel-gallery-view';
import { TripEditorModal } from './trips/ui/trip-editor-modal';
import { NewCountryModal } from './places/ui/new-country-modal';
import { NewStateModal } from './places/ui/new-state-modal';
import { NewCityModal } from './places/ui/new-city-modal';
import { NewPlaceModal } from './places/ui/new-place-modal';
import { NewVehicleModal } from './places/ui/new-vehicle-modal';
import { VehicleCabinsModal } from './places/ui/vehicle-cabins-modal';
import { vehicleToInput } from './places/vehicle-note';
import { NewCrmEntityModal } from './crm/ui/new-crm-entity-modal';
import { TravelPlace, TravelTrip, TravelVehicle } from './vault/types';
import { readTravelBoard } from './vault/read-entities';
import { exportPhotoSpotSheet } from './places/ui/export-photo-spot';
import { exportTripDocument } from './trips/ui/export-trip-document';
import { registerTravelItineraryBlock } from './trips/ui/itinerary-block';
import { registerRelatedTripsBlock } from './trips/ui/related-trips-block';
import { registerPhotoSpotBlock } from './places/ui/photo-spot-block';
import { registerTripCostsBlock } from './trips/ui/trip-costs-block';
import { NewBookingModal } from './trips/ui/new-booking-modal';
import { SampleVaultModal } from './sample/ui/sample-vault-modal';

export default class APERtrailPlugin extends Plugin {
  settingsStore!: APERtrailSettingsStore;
  private ribbonIcon!: HTMLElement;

  /**
   * The live settings object. A method rather than a `settings` getter:
   * Obsidian's own Plugin declares a `settings` property, and overriding a
   * property with an accessor is an error.
   */
  getSettings(): APERtrailSettings {
    return this.settingsStore.settings;
  }

  async onload(): Promise<void> {
    // Localization first: every command name and view built below resolves
    // its label through t() synchronously, so the catalogue has to be in
    // place before any of that runs.
    //
    // Which leaves the language setting in a chicken-and-egg spot, because
    // the settings store resolves LOCALIZED folder defaults and so cannot
    // run before the catalogue does. The saved value is therefore read raw,
    // here, and the store re-reads it a moment later with everything else.
    // Getting this order wrong is invisible in an English vault and seeds a
    // German one with English folder names it can never rename by itself.
    const saved = (await this.loadData()) as { language?: string } | null;
    I18nManager.init(this);
    await I18nManager.getInstance().initialize(saved?.language);

    this.settingsStore = new APERtrailSettingsStore(this);
    await this.settingsStore.load();

    this.registerView(
      TRAVEL_GALLERY_VIEW_TYPE,
      (leaf) =>
        new TravelGalleryView(leaf, {
          getSettings: () => this.getSettings(),
          openFile: (path) => this.openFile(path),
          openEditTripModal: (trip) => this.openEditTripModal(trip),
          openNewTripModal: () => this.openNewTripModal(),
          openNewCountryModal: () => this.openNewCountryModal(),
          openNewStateModal: () => this.openNewStateModal(),
          openNewCityModal: () => this.openNewCityModal(),
          openNewAccommodationModal: () => this.openNewAccommodationModal(),
          openNewFnbModal: () => this.openNewFnbModal(),
          openNewLandmarkModal: () => this.openNewLandmarkModal(),
          openNewLocationModal: () => this.openNewLocationModal(),
          openNewPhotoSpotModal: () => this.openNewPhotoSpotModal(),
        })
    );

    // Two ids for one view, and both stay: `open-dashboard` is the oldest
    // command this plugin has and `open-gallery` is what the dashboards'
    // "Browse all" was bound to, and a command id is what a user's own hotkey
    // points at. Retiring either would silently unbind it. The
    // `open-places-dashboard` id is gone because nothing it could open is
    // left -- a hotkey bound to it stops working, which is the honest signal.
    this.addCommand({
      id: 'open-dashboard',
      name: t('commands.openDashboard'),
      callback: () => void this.activateTravelGalleryView(),
    });
    this.addCommand({
      id: 'open-gallery',
      name: t('commands.openGallery'),
      callback: () => void this.activateTravelGalleryView(),
    });
    this.addCommand({
      id: 'new-trip',
      name: t('commands.newTrip'),
      callback: () => this.openNewTripModal(),
    });
    this.addCommand({
      id: 'new-country',
      name: t('commands.newCountry'),
      callback: () => this.openNewCountryModal(),
    });
    this.addCommand({
      id: 'new-state',
      name: t('commands.newState'),
      callback: () => this.openNewStateModal(),
    });
    this.addCommand({
      id: 'new-city',
      name: t('commands.newCity'),
      callback: () => this.openNewCityModal(),
    });
    this.addCommand({
      id: 'new-accommodation',
      name: t('commands.newAccommodation'),
      callback: () => this.openNewAccommodationModal(),
    });
    this.addCommand({
      id: 'new-fnb',
      name: t('commands.newFnb'),
      callback: () => this.openNewFnbModal(),
    });
    this.addCommand({
      id: 'new-landmark',
      name: t('commands.newLandmark'),
      callback: () => this.openNewLandmarkModal(),
    });
    this.addCommand({
      id: 'new-location',
      name: t('commands.newLocation'),
      callback: () => this.openNewLocationModal(),
    });
    this.addCommand({
      id: 'new-photo-spot',
      name: t('commands.newPhotoSpot'),
      callback: () => this.openNewPhotoSpotModal(),
    });
    this.addCommand({
      id: 'new-vehicle',
      name: t('commands.newVehicle'),
      callback: () => this.openNewVehicleModal(),
    });
    // A checkCallback for the reason the photo spot sheet has one: a cabin
    // catalogue is meaningless anywhere but in a vehicle note.
    this.addCommand({
      id: 'edit-vehicle-cabins',
      name: t('commands.editVehicleCabins'),
      checkCallback: (checking: boolean) => {
        const vehicle = this.activeVehicle();
        if (!vehicle) return false;
        if (!checking) {
          new VehicleCabinsModal(
            this.app,
            this.getSettings(),
            vehicle.file,
            vehicleToInput(vehicle),
            () => this.refreshAllViews()
          ).open();
        }
        return true;
      },
    });
    // A checkCallback rather than a callback: the command is meaningless
    // anywhere but in a photo spot note, and an entry in the palette that
    // answers "this note is not a photo spot" is worse than no entry.
    this.addCommand({
      id: 'export-photo-spot-sheet',
      name: t('commands.exportPhotoSpotSheet'),
      checkCallback: (checking: boolean) => {
        const place = this.activePhotoSpot();
        if (!place) return false;
        if (!checking) {
          void exportPhotoSpotSheet(this.app, this.getSettings(), place, new Date());
        }
        return true;
      },
    });
    // A checkCallback for the same reason the photo spot sheet has one: a trip
    // document is meaningless anywhere but in a trip note.
    this.addCommand({
      id: 'export-trip-document',
      name: t('commands.exportTripDocument'),
      checkCallback: (checking: boolean) => {
        const trip = this.activeTrip();
        if (!trip) return false;
        if (!checking) void exportTripDocument(this.app, this.getSettings(), trip);
        return true;
      },
    });
    this.addCommand({
      id: 'new-booking',
      name: t('commands.newBooking'),
      callback: () => this.openNewBookingModal(),
    });
    this.addCommand({
      id: 'new-person',
      name: t('commands.newPerson'),
      callback: () => this.openNewPersonModal(),
    });
    this.addCommand({
      id: 'new-company',
      name: t('commands.newCompany'),
      callback: () => this.openNewCompanyModal(),
    });
    this.addCommand({
      id: 'check-entity-types',
      name: t('health.entityTypeCheck.command'),
      callback: () => this.openEntityTypeCheck(),
    });
    this.addCommand({
      id: 'create-sample-vault',
      name: t('commands.createSampleVault'),
      callback: () => this.openSampleVaultModal(),
    });

    registerTravelItineraryBlock(
      this.app,
      {
        getSettings: () => this.getSettings(),
        openFile: (path) => this.openFile(path),
        openEditTripModal: (trip) => this.openEditTripModal(trip),
      },
      (lang, handler) => this.registerMarkdownCodeBlockProcessor(lang, handler)
    );

    registerRelatedTripsBlock(
      this.app,
      {
        getSettings: () => this.getSettings(),
        openFile: (path) => this.openFile(path),
      },
      (lang, handler) => this.registerMarkdownCodeBlockProcessor(lang, handler)
    );

    // Read-only for now, so it needs no openFile/edit callbacks -- the
    // block links nothing yet and edits nothing. See photo-spot-block.ts.
    registerPhotoSpotBlock(this.app, { getSettings: () => this.getSettings() }, (lang, handler) =>
      this.registerMarkdownCodeBlockProcessor(lang, handler)
    );

    registerTripCostsBlock(
      this.app,
      {
        getSettings: () => this.getSettings(),
        openFile: (path) => this.openFile(path),
      },
      (lang, handler) => this.registerMarkdownCodeBlockProcessor(lang, handler)
    );

    this.setUpRibbonIcon();
    this.addSettingTab(new APERtrailSettingTab(this.app, this));
  }

  onunload(): void {
    I18nManager.unload();
  }

  // Built once and shown/hidden via a CSS class rather than added and
  // removed on every settings change: Obsidian has no removeRibbonIcon(),
  // so the alternative would be holding on to the element and detaching it
  // by hand, which is the same thing with more ways to leak.
  //
  // One icon, and now there is only one view for it to open.
  private setUpRibbonIcon(): void {
    this.ribbonIcon = this.addRibbonIcon(
      'map',
      t('ribbon.dashboardTooltip'),
      () => void this.activateTravelGalleryView()
    );
    this.refreshRibbonIcon();
  }

  private refreshRibbonIcon(): void {
    this.ribbonIcon.toggleClass('apt-ribbon-hidden', !this.getSettings().showRibbonIcon);
  }

  /**
   * The photo spot the active note is, or null.
   *
   * Read through the board rather than by looking at the file's folder, so
   * the "folder AND type" rule decides here as it does everywhere else: a
   * note that merely sits in the Photo Spots folder is not one.
   */
  private activeTrip(): TravelTrip | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const board = readTravelBoard(this.app, this.getSettings());
    return board.trips.find((candidate) => candidate.file.path === file.path) ?? null;
  }

  private activePhotoSpot(): TravelPlace | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const board = readTravelBoard(this.app, this.getSettings());
    const place = board.places.find(
      (candidate) => candidate.kind === 'photospot' && candidate.file.path === file.path
    );
    return place ?? null;
  }

  openNewVehicleModal(): void {
    new NewVehicleModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  private activeVehicle(): TravelVehicle | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const board = readTravelBoard(this.app, this.getSettings());
    return board.vehicles.find((candidate) => candidate.file.path === file.path) ?? null;
  }

  openNewBookingModal(tripTitle: string | null = null): void {
    new NewBookingModal(this.app, this.getSettings(), { tripTitle }, () =>
      this.refreshAllViews()
    ).open();
  }

  private openFile(path: string): void {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    void this.app.workspace.getLeaf('tab').openFile(file);
  }

  /** Opens (reusing the singleton leaf) the plugin's one view. The ribbon icon and both open-* commands go through this. */
  async activateTravelGalleryView(typeFilter?: GalleryTypeFilter, search?: string): Promise<void> {
    const leaf = await findOrOpenLeaf(this.app, TRAVEL_GALLERY_VIEW_TYPE);
    if (typeFilter !== undefined && leaf.view instanceof TravelGalleryView) {
      leaf.view.applyTypeFilter(typeFilter);
    }
    if (search !== undefined && leaf.view instanceof TravelGalleryView) {
      leaf.view.applySearchFilter(search);
    }
  }

  /** Re-reads the vault and redraws every currently-open view -- called after any creation modal writes a new note. */
  private refreshAllViews(): void {
    this.app.workspace.getLeavesOfType(TRAVEL_GALLERY_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof TravelGalleryView) view.refresh();
    });
  }

  openEntityTypeCheck(): void {
    new EntityTypeCheckModal(this.app, this.getSettings()).open();
  }

  /** The sample notes, previewed before anything is written. Refreshes the views afterwards, like every other creation path. */
  openSampleVaultModal(): void {
    new SampleVaultModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  openNewTripModal(): void {
    new TripEditorModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  /**
   * Opens the same modal in edit mode -- Trips are the only entity with an
   * edit surface, since a trip is built up while it's planned and filled in
   * again after it happens. Reached from a Trip card's actions menu and from
   * the itinerary block's own edit button.
   */
  openEditTripModal(trip: TravelTrip): void {
    new TripEditorModal(this.app, this.getSettings(), () => this.refreshAllViews(), trip).open();
  }

  openNewCountryModal(): void {
    new NewCountryModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  openNewStateModal(): void {
    new NewStateModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  openNewCityModal(): void {
    new NewCityModal(this.app, this.getSettings(), () => this.refreshAllViews()).open();
  }

  openNewAccommodationModal(): void {
    new NewPlaceModal(this.app, this.getSettings(), 'accommodation', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewFnbModal(): void {
    new NewPlaceModal(this.app, this.getSettings(), 'fnb', () => this.refreshAllViews()).open();
  }

  openNewLandmarkModal(): void {
    new NewPlaceModal(this.app, this.getSettings(), 'landmark', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewLocationModal(): void {
    new NewPlaceModal(this.app, this.getSettings(), 'location', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewPhotoSpotModal(): void {
    new NewPlaceModal(this.app, this.getSettings(), 'photospot', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewPersonModal(): void {
    new NewCrmEntityModal(this.app, this.getSettings(), 'person', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewCompanyModal(): void {
    new NewCrmEntityModal(this.app, this.getSettings(), 'company', () =>
      this.refreshAllViews()
    ).open();
  }

  async saveSettings(): Promise<void> {
    await this.settingsStore.save();
    this.refreshRibbonIcon();
  }
}
