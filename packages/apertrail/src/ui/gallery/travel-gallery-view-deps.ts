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

export interface TravelGalleryViewDeps {
  getSettings: () => APERtrailSettings;
  openFile: (path: string) => void;
  /** Trips are the one entity with an edit surface -- see main.ts's openEditTripModal(). */
  openEditTripModal: (trip: TravelTrip) => void;
  openNewTripModal: () => void;
  openNewCountryModal: () => void;
  openNewStateModal: () => void;
  openNewCityModal: () => void;
  openNewAccommodationModal: () => void;
  openNewFnbModal: () => void;
  openNewLandmarkModal: () => void;
  openNewLocationModal: () => void;
  openNewPhotoSpotModal: () => void;
}
