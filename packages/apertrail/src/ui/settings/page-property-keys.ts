/**
 * The property-keys sub-page: every frontmatter name APERtrail reads or
 * writes, in one place.
 *
 * These rows used to be spread down the folders tab, in two blocks with the
 * CRM ones stranded between the folders and the travel ones. They are the
 * same kind of setting wherever they sit, they are set once when a vault is
 * adopted, and the question they answer -- "what does this plugin call the
 * field my notes already have?" -- is asked about all of them at once or
 * about none of them. So they are one page now, grouped by the note type
 * that carries them, and the page as a whole is one row away on the root.
 *
 * The catalogue below is the page. Adding a property to `settings/types.ts`
 * means adding a line here and a label to both locales, and nothing else.
 *
 * What is deliberately *not* here: the `*Field` settings that name a sub-key
 * inside a list entry (a stop's `place`, a motif's `light`). Those are the
 * shape of a value rather than a property of a note, forty more rows nobody
 * reads, and `docs/design/data-model.md` is where they are documented.
 */
import { t } from '../../lang/I18nManager';
import { APERtrailSettings } from '../../settings/types';
import { TRAVEL_ENTITY_TYPES } from '../../vault/entity-types';
import { renderPropertyLockRow, renderPropertyRow } from './property-row';
import { noteLine, sectionCard } from './rows';

/** Settings whose value is a string, which is every name a note is read by. */
/**
 * The settings a free-text row may write to: the ones typed as plain
 * `string`, not the ones typed as a union OF strings.
 *
 * `string extends T` rather than `T extends string` is what draws that
 * line. A vocabulary field like `clockFormat` passes the second test and
 * fails the first, which is correct: a text box cannot be allowed to write
 * "twelvish" into a setting whose values are fixed.
 */
type StringSettingKey = {
  [K in keyof APERtrailSettings]: string extends APERtrailSettings[K] ? K : never;
}[keyof APERtrailSettings];

interface PropertyField {
  key: StringSettingKey;
  /** The label pair under `settings.properties.fields`, as `<key>.name` / `<key>.desc`. */
  label: string;
}

interface PropertyGroup {
  heading: string;
  intro: string;
  fields: PropertyField[];
  /** A sentence under the group's rows, for what a row cannot say by itself. */
  note?: () => string;
}

/**
 * The groups, in the order a vault is read: what identifies a note, then the
 * fields the place hierarchy shares, then the two note types with structure
 * of their own, then the contacts both plugins share.
 */
const PROPERTY_GROUPS: PropertyGroup[] = [
  {
    heading: 'settings.properties.groups.identification',
    intro: 'settings.properties.groups.identificationIntro',
    fields: [
      { key: 'typePropertyName', label: 'type' },
      { key: 'personTypeValue', label: 'personType' },
      { key: 'companyTypeValue', label: 'companyType' },
    ],
    note: () => t('settings.properties.entityTypesInfo', { types: TRAVEL_ENTITY_TYPES.join(', ') }),
  },
  {
    heading: 'settings.properties.groups.places',
    intro: 'settings.properties.groups.placesIntro',
    fields: [
      { key: 'countryProperty', label: 'country' },
      { key: 'stateProperty', label: 'state' },
      { key: 'cityProperty', label: 'city' },
      { key: 'capitalProperty', label: 'capital' },
      { key: 'statesProperty', label: 'states' },
      { key: 'citiesProperty', label: 'cities' },
      { key: 'geoLocationProperty', label: 'geoLocation' },
      { key: 'addressProperty', label: 'address' },
      { key: 'websiteProperty', label: 'website' },
      { key: 'ratingProperty', label: 'rating' },
      { key: 'visitedProperty', label: 'visited' },
      { key: 'lastVisitProperty', label: 'lastVisit' },
      { key: 'createdProperty', label: 'created' },
      { key: 'modifiedProperty', label: 'modified' },
    ],
  },
  {
    heading: 'settings.properties.groups.trips',
    intro: 'settings.properties.groups.tripsIntro',
    fields: [
      { key: 'departureProperty', label: 'departure' },
      { key: 'returnProperty', label: 'return' },
      { key: 'travelTypeProperty', label: 'travelType' },
      { key: 'travelStatusProperty', label: 'travelStatus' },
      { key: 'reviewStatusProperty', label: 'reviewStatus' },
      { key: 'tripCitiesProperty', label: 'tripCities' },
      { key: 'tripSubtitleProperty', label: 'tripSubtitle' },
      { key: 'imageProperty', label: 'image' },
      { key: 'tripHighlightsProperty', label: 'tripHighlights' },
      { key: 'tripGalleryProperty', label: 'tripGallery' },
      { key: 'personsProperty', label: 'persons' },
      { key: 'tripDaysProperty', label: 'tripDays' },
      { key: 'stopsProperty', label: 'stops' },
      { key: 'nightsProperty', label: 'nights' },
      { key: 'transportProperty', label: 'transport' },
    ],
  },
  {
    heading: 'settings.properties.groups.bookings',
    intro: 'settings.properties.groups.bookingsIntro',
    fields: [
      { key: 'bookingTripProperty', label: 'bookingTrip' },
      { key: 'bookingCategoryProperty', label: 'bookingCategory' },
      { key: 'bookingStatusProperty', label: 'bookingStatus' },
      { key: 'bookingSupplierProperty', label: 'bookingSupplier' },
      { key: 'bookingPlaceProperty', label: 'bookingPlace' },
      { key: 'bookingDateProperty', label: 'bookingDate' },
      { key: 'bookingAmountProperty', label: 'bookingAmount' },
      { key: 'bookingCurrencyProperty', label: 'bookingCurrency' },
      { key: 'bookingReferenceProperty', label: 'bookingReference' },
      { key: 'bookingPayerProperty', label: 'bookingPayer' },
      { key: 'bookingForProperty', label: 'bookingFor' },
      { key: 'bookingDocumentProperty', label: 'bookingDocument' },
      { key: 'tripCurrencyProperty', label: 'tripCurrency' },
      { key: 'budgetProperty', label: 'budget' },
      { key: 'ratesProperty', label: 'rates' },
    ],
  },
  {
    heading: 'settings.properties.groups.bookings',
    intro: 'settings.properties.groups.bookingsIntro',
    fields: [
      { key: 'bookingTripProperty', label: 'bookingTrip' },
      { key: 'bookingCategoryProperty', label: 'bookingCategory' },
      { key: 'bookingStatusProperty', label: 'bookingStatus' },
      { key: 'bookingSupplierProperty', label: 'bookingSupplier' },
      { key: 'bookingPlaceProperty', label: 'bookingPlace' },
      { key: 'bookingDateProperty', label: 'bookingDate' },
      { key: 'bookingAmountProperty', label: 'bookingAmount' },
      { key: 'bookingCurrencyProperty', label: 'bookingCurrency' },
      { key: 'bookingReferenceProperty', label: 'bookingReference' },
      { key: 'bookingPayerProperty', label: 'bookingPayer' },
      { key: 'bookingForProperty', label: 'bookingFor' },
      { key: 'bookingDocumentProperty', label: 'bookingDocument' },
      { key: 'tripCurrencyProperty', label: 'tripCurrency' },
      { key: 'budgetProperty', label: 'budget' },
      { key: 'ratesProperty', label: 'rates' },
    ],
  },
  {
    heading: 'settings.properties.groups.photoSpots',
    intro: 'settings.properties.groups.photoSpotsIntro',
    fields: [
      { key: 'timezoneProperty', label: 'timezone' },
      { key: 'openingHoursProperty', label: 'openingHours' },
      { key: 'entryFeeProperty', label: 'entryFee' },
      { key: 'accessibilityProperty', label: 'accessibility' },
      { key: 'parkingProperty', label: 'parking' },
      { key: 'transitProperty', label: 'transit' },
      { key: 'motifsProperty', label: 'motifs' },
      { key: 'samplesProperty', label: 'samples' },
    ],
  },
  {
    heading: 'settings.properties.groups.vehicles',
    intro: 'settings.properties.groups.vehiclesIntro',
    fields: [
      { key: 'vehicleModeProperty', label: 'vehicleMode' },
      { key: 'vehicleOperatorProperty', label: 'vehicleOperator' },
      { key: 'vehicleBuiltProperty', label: 'vehicleBuilt' },
      { key: 'vehicleRefurbishedProperty', label: 'vehicleRefurbished' },
      { key: 'vehicleCapacityProperty', label: 'vehicleCapacity' },
      { key: 'vehicleLengthProperty', label: 'vehicleLength' },
      { key: 'vehicleTonnageProperty', label: 'vehicleTonnage' },
      { key: 'vehicleCabinsProperty', label: 'vehicleCabins' },
    ],
  },
  {
    heading: 'settings.properties.groups.crm',
    intro: 'settings.properties.groups.crmIntro',
    fields: [
      { key: 'personTagProperty', label: 'personTag' },
      { key: 'companyTagProperty', label: 'companyTag' },
      { key: 'personRolesProperty', label: 'personRoles' },
      { key: 'companyRolesProperty', label: 'companyRoles' },
      { key: 'descriptionProperty', label: 'description' },
      { key: 'emailProperty', label: 'email' },
      { key: 'phoneProperty', label: 'phone' },
      { key: 'mobileProperty', label: 'mobile' },
    ],
  },
];

/** How many names this page holds, for the row on the root page. */
export const PROPERTY_KEY_COUNT = PROPERTY_GROUPS.reduce(
  (total, group) => total + group.fields.length,
  0
);

export function renderPropertyKeysPage(
  containerEl: HTMLElement,
  settings: APERtrailSettings,
  save: () => Promise<void>,
  refresh: () => void
): void {
  const lock = sectionCard(containerEl, undefined, t('settings.properties.intro'));
  renderPropertyLockRow(lock, settings, save, refresh);

  for (const group of PROPERTY_GROUPS) {
    const card = sectionCard(containerEl, t(group.heading), t(group.intro));

    for (const field of group.fields) {
      renderPropertyRow(
        card,
        settings,
        t(`settings.properties.fields.${field.label}.name`),
        t(`settings.properties.fields.${field.label}.desc`),
        settings[field.key],
        async (value) => {
          settings[field.key] = value;
          await save();
        }
      );
    }

    if (group.note) noteLine(card, group.note());
  }

  noteLine(containerEl, t('settings.properties.subKeysNote'));
}
