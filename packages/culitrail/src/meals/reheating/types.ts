/**
 * Reheating an ordered meal, as the reader hands it to a view.
 *
 * The shapes moved to `trail-core` with the reader, because they are the note
 * format rather than this plugin's model of it. Re-exported here so every call
 * site keeps saying `from './types'`, which is what those files are about.
 *
 * See docs/design/ready-meals.md, which is still the specification.
 *
 * App-free.
 */
export type { ApplianceEntry, ReheatInstruction, ReheatSource } from '@technosoftware/trail-core';
