/**
 * Every translation key `src/` asks for must exist in every shipped
 * locale, and every key must exist in both locales rather than one.
 *
 * This suite exists because of a real bug in the predecessor codebase: the
 * Trip editor's translations were inserted under the wrong parent key, so
 * the whole modal rendered raw key paths instead of labels. Nothing caught
 * it -- `t()` falls back to returning the key itself, the typechecker sees
 * an untyped string, and no test rendered the modal. A missing label is
 * invisible to every other layer of the build, so it needs its own check.
 * It earns its keep a second time here, where the extraction moved every
 * key up one nesting level at once.
 *
 * Deliberately a static scan of the source rather than a typed key union.
 * A union would be stronger, but it would mean regenerating a large type
 * whenever a string is added, and this catches the same failure at a
 * fraction of the cost.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { enTranslations } from '../src/lang/translations/en';
import { deTranslations } from '../src/lang/translations/de';
import { isPluralForms } from '../src/lang/plural';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Literal `t('some.key')` calls. Template-literal call sites (e.g.
 * t(`dashboard.stats.status${status}`)) can't be resolved statically and
 * are covered by the explicit DYNAMIC_KEYS list below instead -- listing
 * them by hand is the price of building a key name at runtime, and keeps
 * those call sites honest rather than unchecked.
 */
function literalKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/** Keys built by interpolation at their call sites, enumerated here so they're still checked. */
const DYNAMIC_KEYS = [
  // trip-stats-row.ts / trip-editor-modal.ts / travel-gallery-view.ts
  'dashboard.stats.statusPlanned',
  'dashboard.stats.statusBooked',
  'dashboard.stats.statusOver',
  'dashboard.stats.statusCancelled',
  // trip-editor-modal.ts's transport mode dropdown
  'modals.tripEditor.mode.train',
  'modals.tripEditor.mode.plane',
  'modals.tripEditor.mode.car',
  'modals.tripEditor.mode.bus',
  'modals.tripEditor.mode.boat',
  'modals.tripEditor.mode.other',
  // ui/settings/page-folders.ts builds `${label}.name` / `.desc` /
  // `.placeholder` from its module catalogue, and names the module headings
  // there rather than at the call site.
  ...[
    'root',
    'trips',
    'bookings',
    'places',
    'countries',
    'states',
    'cities',
    'accommodation',
    'fnb',
    'landmarks',
    'locations',
    'photoSpots',
    'crm',
    'persons',
    'companies',
  ].flatMap((folder) => [
    `settings.folders.${folder}.name`,
    `settings.folders.${folder}.desc`,
    `settings.folders.${folder}.placeholder`,
  ]),
  ...['trips', 'places', 'crm'].flatMap((module) => [
    `settings.folders.${module}Heading`,
    `settings.folders.${module}Intro`,
  ]),
  // ui/settings/page-property-keys.ts builds
  // `settings.properties.fields.<field>.name` / `.desc` from its catalogue,
  // one entry per frontmatter name the plugin reads or writes.
  ...[
    'type',
    'personType',
    'companyType',
    'country',
    'state',
    'city',
    'capital',
    'states',
    'cities',
    'geoLocation',
    'address',
    'website',
    'rating',
    'visited',
    'lastVisit',
    'created',
    'modified',
    'departure',
    'return',
    'travelType',
    'travelStatus',
    'reviewStatus',
    'tripCities',
    'persons',
    'stops',
    'nights',
    'transport',
    'bookingTrip',
    'bookingCategory',
    'bookingStatus',
    'bookingSupplier',
    'bookingPlace',
    'bookingDate',
    'bookingAmount',
    'bookingCurrency',
    'bookingReference',
    'bookingPayer',
    'bookingFor',
    'bookingDocument',
    'tripCurrency',
    'budget',
    'rates',
    'timezone',
    'openingHours',
    'entryFee',
    'accessibility',
    'parking',
    'transit',
    'motifs',
    'samples',
    'personTag',
    'companyTag',
    'description',
    'email',
    'phone',
    'mobile',
  ].flatMap((field) => [
    `settings.properties.fields.${field}.name`,
    `settings.properties.fields.${field}.desc`,
  ]),
  ...['identification', 'places', 'trips', 'bookings', 'photoSpots', 'crm'].flatMap((group) => [
    `settings.properties.groups.${group}`,
    `settings.properties.groups.${group}Intro`,
  ]),
  // health/entity-type-check-modal.ts builds
  // `health.entityTypeCheck.locationLabels.${location}` -- one per
  // EntityFolderLocation.
  ...[
    'trips',
    'bookings',
    'countries',
    'states',
    'cities',
    'accommodation',
    'fnb',
    'landmarks',
    'locations',
    'photoSpots',
    'persons',
    'companies',
  ].map((location) => `health.entityTypeCheck.locationLabels.${location}`),
  // places/ui/photo-spot-block.ts builds one key per fixed vocabulary value.
  // costs/booking-note.ts's two fixed vocabularies, built per value.
  ...['transport', 'accommodation', 'activity', 'food', 'fees', 'other'].map(
    (category) => `booking.category.${category}`
  ),
  ...['estimate', 'booked', 'paid', 'cancelled', 'refunded'].map(
    (status) => `booking.status.${status}`
  ),
  ...['main', 'secondary'].map((role) => `photoSpot.role.${role}`),
  // photo-spot-editor-modals.ts builds one key per named-season preset.
  ...['spring', 'summer', 'autumn', 'winter', 'allYear'].map(
    (season) => `modals.motifEditor.seasonPreset.${season}`
  ),
  ...[
    'blue-hour-morning',
    'sunrise',
    'golden-hour-morning',
    'day',
    'overcast',
    'golden-hour-evening',
    'sunset',
    'blue-hour-evening',
    'night',
  ].map((window) => `photoSpot.light.${window}`),
  // The sixteen compass points, as whole tokens rather than composed letters.
  ...[
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ].map((point) => `photoSpot.compass.${point}`),
  ...['tripod', 'polarizer', 'filter', 'remote', 'flash', 'drone'].map(
    (item) => `photoSpot.gear.${item}`
  ),
  ...['rail', 'bus', 'tram', 'boat', 'cablecar', 'foot', 'car'].map(
    (mode) => `photoSpot.transit.${mode}`
  ),
  ...['full', 'partial', 'none', 'unknown'].map((value) => `photoSpot.accessibilityValue.${value}`),
  ...['back', 'side', 'front'].map((relation) => `photoSpot.relation.${relation}`),
  // The sun panel's band legend, one entry per band kind.
  ...['night', 'blue', 'golden', 'day'].map((kind) => `photoSpot.band.${kind}`),
  // travel-gallery-view.ts's photo-spot capture facet.
  ...['full', 'partial', 'none'].map((state) => `galleryView.facets.capture.${state}`),
];

/** A key resolves when it lands on a string, or on the set of plural forms that stands in for one. */
function resolves(table: unknown, key: string): boolean {
  const value = lookup(table, key);
  return typeof value === 'string' || isPluralForms(value);
}

function lookup(table: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, table);
}

/**
 * Every leaf path in a translation table, as dotted keys.
 *
 * A set of plural forms counts as ONE leaf: which categories a language has
 * is a fact about that language, so German writing `one`/`other` where
 * Russian would write four is not a structural difference between the
 * tables.
 */
function flatten(table: unknown, prefix = ''): string[] {
  if (table === null || typeof table !== 'object' || isPluralForms(table)) return [prefix];
  return Object.entries(table as Record<string, unknown>).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe('translation keys', () => {
  const used = [...literalKeys(), ...DYNAMIC_KEYS].sort();

  it('finds a meaningful number of call sites, so a broken scan fails loudly', () => {
    // Guards the regex itself: if it ever stops matching, the two tests
    // below would pass vacuously.
    expect(used.length).toBeGreaterThan(150);
  });

  it('resolves every key used in src/ against the English table', () => {
    const missing = used.filter((key) => !resolves(enTranslations, key));
    expect(missing).toEqual([]);
  });

  it('resolves every key used in src/ against the German table', () => {
    const missing = used.filter((key) => !resolves(deTranslations, key));
    expect(missing).toEqual([]);
  });

  /**
   * The inverse, over the one subtree where it can be exact: a label that
   * exists in both locales and is asked for by nothing.
   *
   * `modals.tripEditor` builds no key at runtime, so every one of its keys is
   * a literal `t()` call or it is dead -- which makes the check here a fact
   * rather than a list of exceptions. It is deliberately NOT run over the
   * whole table: seventy-odd keys elsewhere are reached through helpers that
   * take a key as an argument, and an allowlist that long would say nothing.
   *
   * It exists because a field went missing. `legCarrier` and its description
   * and placeholder were written into both locales while the input they label
   * was never added to the form, so the setting could only be reached by
   * typing YAML by hand. Nothing else in the build has an opinion about a
   * string nobody prints. It also found ten labels left behind when the
   * itinerary moved out of this modal and into its own block.
   */
  it('has no label in the trip editor that nothing asks for', () => {
    const asked = new Set(used);
    const orphans = flatten(enTranslations).filter(
      (key) => key.startsWith('modals.tripEditor.') && !asked.has(key)
    );
    expect(orphans).toEqual([]);
  });

  it('keeps both locales structurally identical', () => {
    // Catches the inverse of the bug above: a key added to one locale and
    // forgotten in the other, which only shows up for users of that
    // language.
    const enKeys = flatten(enTranslations).sort();
    const deKeys = flatten(deTranslations).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]);
  });
});
