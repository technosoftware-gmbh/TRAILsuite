/**
 * The orders area's domain model, bound to Obsidian's file type.
 *
 * The shapes themselves are `trail-core`'s: an order note is a note format, and
 * a format is an agreement about the file rather than one plugin's model of it.
 * What this file adds is the one thing the core cannot know, which is what a
 * file is here. The core's record is generic over that so a `TFile` flows
 * through structurally, without a cast at the boundary and without the core
 * ever naming Obsidian.
 */
import type { TFile } from 'obsidian';
import type { OrderRecord as CoreOrderRecord } from '@technosoftware/trail-core';

export type { OrderItem, OrderSelection, ParsedOrder } from '@technosoftware/trail-core';

/** One order, as read back out of its note, paired with the note it came from. */
export type OrderRecord = CoreOrderRecord<TFile>;
