/**
 * The code-block language a photo spot note's block is fenced with.
 *
 * Lives beside the module's model files rather than under its ui/ folder
 * because vault/create-entities.ts seeds the block into a newly-created
 * note, and the note writers must not depend on the UI that renders it.
 * Same arrangement as trips/related-trips-block-lang.ts.
 *
 * `apt-`, not `travel-`. The two older blocks kept their prefix only
 * because the strings already sit in users' notes and a rename would
 * orphan every one of them; that cannot apply to a block nobody has
 * written yet. And the consistency argument points the other way here:
 * `travel-itinerary` and `travel-related-trips` are both about trips and
 * mean nothing without one, whereas a photo spot note is useful with no
 * trip planned and none ever taken. Naming it `travel-` would file it
 * under a relationship it does not have. See docs/design/photo-spots.md §5.
 *
 * Every block added from here on takes `apt-`.
 */
export const APT_PHOTO_SPOT_BLOCK_LANG = 'apt-photo-spot';
