/**
 * Dependency interface injected into TravelGalleryView, so the view never
 * reaches for the live plugin instance and can be exercised with plain
 * callbacks.
 *
 * The creation callbacks arrived when the two dashboards folded into this
 * view: they were the Places dashboard's action bar, and there is no longer
 * anywhere else for them to be.
 */
import { APERtrailSettings } from '../../settings/types';
import { TravelTrip } from '../../vault/types';
import { EditableEntity } from '../../vault/editable';

export interface TravelGalleryViewDeps {
  getSettings: () => APERtrailSettings;
  openFile: (path: string) => void;
  /** Trips were the one entity with an edit surface. See main.ts's openEditTripModal(). */
  openEditTripModal: (trip: TravelTrip) => void;
  /**
   * Everything else with an editor: the five place kinds, the three that hold
   * the hierarchy together, and whatever the next phase adds. One callback
   * rather than one per kind, so a new kind is a member of `EditableEntity`
   * and nothing here.
   */
  openEditModal: (subject: EditableEntity) => void;
  /**
   * The page a note prints, from the card rather than from the note.
   *
   * Two callbacks rather than one, because they are two documents: a prospect
   * is one page about one note, a trip document is the route across a dozen.
   * The same six notes take a prospect as take an editor, which is why this
   * one takes the same union.
   */
  exportProspect: (subject: EditableEntity) => void;
  exportTripDocument: (trip: TravelTrip) => void;
  openNewTripModal: () => void;
  openNewCountryModal: () => void;
  openNewStateModal: () => void;
  openNewCityModal: () => void;
  openNewAccommodationModal: () => void;
  openNewFnbModal: () => void;
  openNewLandmarkModal: () => void;
  openNewLocationModal: () => void;
  openNewPhotoSpotModal: () => void;
  openNewVehicleModal: () => void;
  openNewExcursionModal: () => void;
}
