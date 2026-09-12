/**
 * Reheating an ordered meal, as the reader hands it to a view.
 *
 * Two shapes, and the difference matters: an `ApplianceEntry` is what one note
 * says about one appliance, and a `ReheatInstruction` is what a reader should
 * show after a dish's entry and its supplier's have been resolved against each
 * other. Keeping them apart is what makes the merge rule testable on its own.
 *
 * Written for CULItrail against its `ready-meals.md`, and here rather than in
 * the plugin because `ApplianceEntry` is the note's own shape: it says what a
 * reheating section can hold, which is a question about the file rather than
 * about any screen. CULItrail imports both shapes rather than restating them,
 * so a view can change without the section changing underneath it. That
 * document is still the specification; `resolve.ts` is written to be read
 * against its merge table.
 */

/** What one note says about one appliance. Either half may be absent. */
export interface ApplianceEntry {
  /** The appliance id, or the heading as written when it matches no known appliance. */
  applianceId: string;
  /** What a reader sees as the heading, which is the label or the raw text. */
  label: string;
  /** True when the heading matched no configured appliance and is shown as typed. */
  unknown: boolean;
  /** The prose, minus the inline fields. Empty when the entry is only numbers. */
  steps: string[];
  temp: string | null;
  time: string | null;
}

/** Which note an instruction's wording came from, so a view can say so. */
export type ReheatSource = 'dish' | 'supplier' | 'numbers';

export interface ReheatInstruction {
  applianceId: string;
  label: string;
  unknown: boolean;
  /**
   * The steps to show, tokens already filled.
   *
   * Steps rather than one blob because they go through the same renderer as
   * instruction steps, which is what gives reheating its timers and its ticking
   * for free rather than through a second component.
   */
  steps: string[];
  temp: string | null;
  time: string | null;
  source: ReheatSource;
}

/** What a vault calls one appliance. The id is stored, the label is shown. */
export interface ReheatAppliance {
  id: string;
  label: string;
}
