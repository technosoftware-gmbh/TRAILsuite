/**
 * The fenced-code-block language the related-trips block registers under.
 *
 * Its own file so vault/create-entities.ts (which seeds the block into
 * new City and place notes) can reference it without importing the UI
 * module that renders it: the note writers must not depend on the UI. The
 * itinerary
 * block's own constant lives in trips/write-trip.ts for the same reason.
 *
 * The `travel-` prefix stays even though the plugin is no longer named
 * that: this string is written into users' own notes, so renaming it would
 * silently stop every existing block from rendering.
 */
export const TRAVEL_RELATED_TRIPS_BLOCK_LANG = 'travel-related-trips';
