/**
 * APERtrail plugin entry point -- Trips/Countries/States/Cities/
 * Accommodation/FnB/Landmarks/Locations/Photo spots. See
 * docs/design/travel-module-plan.md for the design this is built from,
 * docs/design/photo-spots.md for the photo spot type on top of it, and
 * docs/design/dashboard-split-and-crm.md for the split into a dashboard per
 * module and for the later fold of both of them into the gallery.
 */
import { Plugin } from 'obsidian';
import { whenIndexed } from '@technosoftware/trail-core/obsidian';
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
import { RegionEditorModal, regionEdit } from './places/ui/region-editor-modal';
import { assertEveryEditableHandled, EditableEntity, isEditableRegion } from './vault/editable';
import { excursionToInput } from './places/excursion-note';
import { coverInputOf } from './ui/components/cover-fields';
import { PlaceEditorModal } from './places/ui/place-editor-modal';
import { NewVehicleModal } from './places/ui/new-vehicle-modal';
import { ExcursionEditorModal } from './places/ui/excursion-editor-modal';
import { VehicleEditorModal } from './places/ui/vehicle-editor-modal';
import { exportProspect, ProspectSubject } from './places/ui/export-prospect';
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

/** The note behind a subject: all five carry a cover in the same four fields. Mirrors the one in related-trips-block.ts, which reaches it from the other side. */
/** A prospect subject as the editors take it. The two unions describe the same six notes, from the two sides that ask about them. */
function editableOf(subject: ProspectSubject): EditableEntity {
  switch (subject.kind) {
    case 'vehicle':
      return { kind: 'vehicle', record: subject.vehicle };
    case 'excursion':
      return { kind: 'excursion', record: subject.excursion };
    case 'place':
      return { kind: 'place', record: subject.place };
    case 'city':
      return { kind: 'city', record: subject.city };
    case 'state':
      return { kind: 'state', record: subject.state };
    case 'country':
      return { kind: 'country', record: subject.country };
  }
}

/**
 * The other direction, for a surface that starts from the editors' union.
 *
 * A pair with `editableOf`, and kept beside it: the two unions describe the
 * same six notes and the only thing that could go wrong here is one of them
 * gaining a member the other has not. That is a compile error while both
 * switches are exhaustive, which is why neither has a default.
 */
function prospectOf(subject: EditableEntity): ProspectSubject {
  switch (subject.kind) {
    case 'vehicle':
      return { kind: 'vehicle', vehicle: subject.record };
    case 'excursion':
      return { kind: 'excursion', excursion: subject.record };
    case 'place':
      return { kind: 'place', place: subject.record };
    case 'city':
      return { kind: 'city', city: subject.record };
    case 'state':
      return { kind: 'state', state: subject.record };
    case 'country':
      return { kind: 'country', country: subject.record };
  }
}

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
          openEditModal: (subject) => this.openEditModal(subject),
          exportProspect: (subject) =>
            void exportProspect(this.app, this.getSettings(), prospectOf(subject)),
          exportTripDocument: (trip) => void exportTripDocument(this.app, this.getSettings(), trip),
          openNewTripModal: () => this.openNewTripModal(),
          openNewCountryModal: () => this.openNewCountryModal(),
          openNewStateModal: () => this.openNewStateModal(),
          openNewCityModal: () => this.openNewCityModal(),
          openNewAccommodationModal: () => this.openNewAccommodationModal(),
          openNewFnbModal: () => this.openNewFnbModal(),
          openNewLandmarkModal: () => this.openNewLandmarkModal(),
          openNewLocationModal: () => this.openNewLocationModal(),
          openNewPhotoSpotModal: () => this.openNewPhotoSpotModal(),
          openNewVehicleModal: () => this.openNewVehicleModal(),
          openNewExcursionModal: () => this.openNewExcursionModal(),
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
    this.addCommand({
      id: 'new-excursion',
      name: t('commands.newExcursion'),
      callback: () => this.openNewExcursionModal(),
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
          new VehicleEditorModal(
            this.app,
            this.getSettings(),
            vehicle.file,
            vehicleToInput(vehicle),
            coverInputOf(vehicle),
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
    // Reaches the same six notes the prospect does, which is not a
    // coincidence: it edits what the prospect prints. Its id still says
    // `cover` because that is what a user's hotkey points at, and the cover
    // is now one section of what it opens.
    this.addCommand({
      id: 'edit-note-cover',
      name: t('commands.editNoteCover'),
      checkCallback: (checking: boolean) => {
        const subject = this.activeProspectSubject();
        if (!subject) return false;
        if (!checking) this.openEditModal(editableOf(subject));
        return true;
      },
    });
    // One command for seven note types rather than seven commands. The id
    // stays `export-vehicle-brochure`: it is what a user's own hotkey points
    // at, and renaming it would silently unbind theirs.
    this.addCommand({
      id: 'export-vehicle-brochure',
      name: t('commands.exportProspect'),
      checkCallback: (checking: boolean) => {
        const subject = this.activeProspectSubject();
        if (!subject) return false;
        if (!checking) void exportProspect(this.app, this.getSettings(), subject);
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
        refresh: () => this.refreshAllViews(),
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

  openNewExcursionModal(): void {
    new ExcursionEditorModal(this.app, this.getSettings(), (path) =>
      this.refreshAllViews(path)
    ).open();
  }

  openNewVehicleModal(): void {
    new NewVehicleModal(this.app, this.getSettings(), (path) => this.refreshAllViews(path)).open();
  }

  private activeVehicle(): TravelVehicle | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const board = readTravelBoard(this.app, this.getSettings());
    return board.vehicles.find((candidate) => candidate.file.path === file.path) ?? null;
  }

  /**
   * What the note in front of you would make a prospect of, or null.
   *
   * Places first: it is much the commonest note to be standing in, and
   * nothing here is cached, so the order decides how much of the vault gets
   * read before the answer comes back.
   */
  private activeProspectSubject(): ProspectSubject | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const board = readTravelBoard(this.app, this.getSettings());

    const place = board.places.find((x) => x.file.path === file.path);
    if (place) return { kind: 'place', place };
    const vehicle = board.vehicles.find((x) => x.file.path === file.path);
    if (vehicle) return { kind: 'vehicle', vehicle };
    const city = board.cities.find((x) => x.file.path === file.path);
    if (city) return { kind: 'city', city };
    const state = board.states.find((x) => x.file.path === file.path);
    if (state) return { kind: 'state', state };
    const country = board.countries.find((x) => x.file.path === file.path);
    if (country) return { kind: 'country', country };
    return null;
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

  /**
   * Re-reads the vault and redraws every currently-open view -- called after
   * any modal writes a note.
   *
   * **After the metadata cache has caught up, not before.** A write resolves
   * when the file is on disk; the cache is re-parsed afterwards, and a gallery
   * redrawn inside that window reads the note it just saved as having no
   * `type` and drops it, because a note is identified by folder and type
   * together. It came back on the next manual refresh, which is what made it
   * look like a drawing fault rather than a timing one.
   *
   * `whenIndexed` waits for one event and unsubscribes, so the gallery stays
   * manual-refresh only as it was built to be. See its own file for why the
   * timeout is a backstop rather than an estimate.
   */
  private refreshAllViews(path?: string): void {
    void whenIndexed(this.app, { path: path ?? null }).then(() => {
      this.app.workspace.getLeavesOfType(TRAVEL_GALLERY_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view;
        if (view instanceof TravelGalleryView) view.refresh();
      });
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
    new TripEditorModal(this.app, this.getSettings(), (path) => this.refreshAllViews(path)).open();
  }

  /**
   * Opens the same modal in edit mode. Reached from a Trip card's actions
   * menu and from the itinerary block's own edit button.
   */
  openEditTripModal(trip: TravelTrip): void {
    new TripEditorModal(
      this.app,
      this.getSettings(),
      (path) => this.refreshAllViews(path),
      trip
    ).open();
  }

  /**
   * Every note with an editor, through one door.
   *
   * The kind comes off the record rather than being passed alongside it: a
   * place already knows which of the five it is, and a second argument saying
   * so again is a second argument that can disagree. A kind added to
   * `EditableEntity` and forgotten here fails to compile, which is the reason
   * the union exists at all.
   */
  openEditModal(subject: EditableEntity): void {
    const refresh = (): void => this.refreshAllViews();
    if (subject.kind === 'place') {
      new PlaceEditorModal(
        this.app,
        this.getSettings(),
        subject.record.kind,
        refresh,
        subject.record
      ).open();
      return;
    }
    if (isEditableRegion(subject)) {
      new RegionEditorModal(
        this.app,
        this.getSettings(),
        subject.kind,
        refresh,
        regionEdit(subject)
      ).open();
      return;
    }
    if (subject.kind === 'excursion') {
      new ExcursionEditorModal(this.app, this.getSettings(), refresh, {
        file: subject.record.file,
        title: subject.record.title,
        input: excursionToInput(subject.record),
        cover: coverInputOf(subject.record),
      }).open();
      return;
    }
    if (subject.kind === 'vehicle') {
      // A ship's editor is the dialog that was called the cabins dialog: the
      // facts and the catalogue in one form, which is what it always was.
      new VehicleEditorModal(
        this.app,
        this.getSettings(),
        subject.record.file,
        vehicleToInput(subject.record),
        coverInputOf(subject.record),
        refresh
      ).open();
      return;
    }
    assertEveryEditableHandled(subject);
  }

  openNewCountryModal(): void {
    new RegionEditorModal(this.app, this.getSettings(), 'country', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewStateModal(): void {
    new RegionEditorModal(this.app, this.getSettings(), 'state', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewCityModal(): void {
    new RegionEditorModal(this.app, this.getSettings(), 'city', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewAccommodationModal(): void {
    new PlaceEditorModal(this.app, this.getSettings(), 'accommodation', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewFnbModal(): void {
    new PlaceEditorModal(this.app, this.getSettings(), 'fnb', (path) =>
      this.refreshAllViews(path)
    ).open();
  }

  openNewLandmarkModal(): void {
    new PlaceEditorModal(this.app, this.getSettings(), 'landmark', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewLocationModal(): void {
    new PlaceEditorModal(this.app, this.getSettings(), 'location', () =>
      this.refreshAllViews()
    ).open();
  }

  openNewPhotoSpotModal(): void {
    new PlaceEditorModal(this.app, this.getSettings(), 'photospot', () =>
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
