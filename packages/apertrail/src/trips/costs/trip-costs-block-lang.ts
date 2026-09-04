/**
 * The costs block's fence language, in a file of its own so
 * `create-entities.ts` can seed it into a new trip note without importing a
 * view. Same arrangement `photo-spot-block-lang.ts` already has.
 *
 * `apt-`, like every block added since the two carried-over ones: those kept
 * `travel-` only because those strings already sit in users' notes.
 */
export const APT_TRIP_COSTS_BLOCK_LANG = 'apt-trip-costs';
