/**
 * What actually arrived, and when, bound to Obsidian's file type.
 *
 * The shapes are `trail-core`'s, for the same reason the order shapes are: a
 * delivery note is a note format, and a format is an agreement about the file
 * rather than one plugin's model of it. **A delivery stays a kind of its own
 * rather than a section on an order**, because an order can arrive in two boxes
 * a week apart and one box can settle two orders, and neither fits inside an
 * order note without lying about the other.
 */
import type { TFile } from 'obsidian';
import type { DeliveryRecord as CoreDeliveryRecord } from 'trail-core';

export type { DeliveryItem, ParsedDelivery } from 'trail-core';

/** One delivery, as read back out of its note, paired with the note it came from. */
export type DeliveryRecord = CoreDeliveryRecord<TFile>;
