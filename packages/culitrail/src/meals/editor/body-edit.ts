/**
 * Editing one part of a note's text, leaving everything else byte for byte.
 *
 * Moved to `trail-core` with the rest of the editor's app-free half. Nothing
 * about it was settings-aware, so nothing stayed behind. Two of the three
 * functions are re-exported here, which is the two the editor's save uses: the
 * description it rewrites, and the retired per-100 g sections it takes out.
 *
 * App-free.
 */
export { removeSection, replaceDescription } from '@technosoftware/trail-core';
