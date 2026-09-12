/**
 * What actually arrived, and when.
 *
 * **A kind of its own rather than a section on the order**, and the reason is
 * the two cases that do not fit inside one: an order can arrive in two boxes a
 * week apart, and one box can settle two orders. Both happen with a meal
 * company, and a delivery modelled as a property of an order would have to lie
 * about one of them.
 *
 * The distinction it buys is the one the meal plan needs. An order says what
 * was asked for; a delivery says what is in the freezer now.
 */
/** One dish in a box, and how many of it. */
export interface DeliveryItem {
  /** The meal note's title. Written as a wikilink, read back as a title. */
  mealTitle: string;
  /** At least 1, and omitted from the note when it is 1. */
  quantity: number;
}

export interface ParsedDelivery {
  /** ISO date. The property wins over the filename, since a person can correct it. */
  deliveryDate: string | null;
  /**
   * The orders this delivery settles, as note titles.
   *
   * A list rather than one, because a box can arrive against two orders. Empty
   * for a delivery nobody linked, which is legitimate: the freezer knows what
   * is in it whether or not the paperwork was filed.
   */
  orderTitles: string[];
  items: DeliveryItem[];
}

/** A parsed delivery paired with the file it came from, generic over the host's file type. */
export interface DeliveryRecord<F = unknown> extends ParsedDelivery {
  file: F;
  title: string;
}
