/**
 * The fenced-code-block language the related-orders block registers under.
 *
 * Its own file so anything that writes the fence into a note can name it
 * without importing the UI module that renders it. Nothing in CULItrail does
 * today: it creates no Person or Company notes, so the fence arrives either by
 * hand or from whichever plugin created the note. The separation is kept anyway,
 * because the day something here does seed it, a note writer reaching into the
 * UI layer for a string is the wrong direction of dependency.
 *
 * `culi-`, not `travel-`: this is a genuinely new block, so there is nothing
 * already in a vault to protect. See CLAUDE.md's naming conventions for why the
 * two oldest fence languages in the sibling plugin keep their old spelling and
 * this one does not.
 */
export const CUL_RELATED_ORDERS_BLOCK_LANG = 'culi-related-orders';
