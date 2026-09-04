/**
 * What a scan of the meal library found: which frontmatter fields exist,
 * what kind of thing each holds, and which tags are in use.
 *
 * App-free.
 */
import type { FilterableType } from './field-types';

export interface DiscoveredField {
  key: string;
  type: FilterableType;
  /**
   * Distinct short values seen for this field, sorted. Offered as suggestions
   * when a filter wants one. Capped and length-limited, see `field-summary.ts`.
   */
  values: string[];
  /**
   * True when at least one meal wrote this field as a list. Shown with a
   * different icon, because `diet: [vegan, quick]` and `diet: vegan` are the
   * same field asked about differently.
   */
  isList: boolean;
  /** True when a built-in setting names this field rather than a note inventing it. */
  builtin?: boolean;
}

export interface FieldDiscovery {
  /** Discovered fields, built-ins included, sorted by key. */
  fields: DiscoveredField[];
  /** Distinct frontmatter tag names, without the leading `#`, sorted. */
  tags: string[];
  /** How many meal notes the scan looked at. Shown so an empty result is explicable. */
  scanned: number;
}

export const EMPTY_DISCOVERY: FieldDiscovery = { fields: [], tags: [], scanned: 0 };
