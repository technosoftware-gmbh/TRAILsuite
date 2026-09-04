/**
 * The orders area's domain model.
 *
 * An order is a meal somebody bought rather than eaten: who it was from, when
 * it came, what it cost, and which person chose which dish.
 *
 * Here rather than in a plugin because the shape of an order is a note format
 * rather than one plugin's model of one. An order note outlives every view ever
 * built over it: the note is the record, and a record whose definition lives
 * inside a view is redefined every time the view is. So the plugin imports
 * these shapes rather than declaring them. What stays with a consumer is how it
 * displays an order.
 */
/**
 * One dish on one person's part of an order, and what it cost.
 *
 * **The price is the price that was charged, not the dish's price today.** A
 * meal's `price:` is the default offered when the dish is added; a supplier
 * raising it later must not change what an order from last year says, because an
 * order note is a record of a transaction and a record that recomputes is not one.
 * That is why this figure lives here rather than being looked up.
 *
 * Null price means nobody recorded one, which is the state of every order written
 * before this existed. It is not zero: zero is a line that was genuinely free.
 */
export interface OrderItem {
  /** The meal note's title. Written as a wikilink, read back as a title. */
  mealTitle: string;
  price: number | null;
  /** How many of this dish. At least 1, and omitted from the note when it is 1. */
  quantity: number;
  /**
   * A discount on this line alone, as a percentage, on top of whatever comes
   * off the whole order.
   *
   * Null means none was recorded, which is every line written before this
   * existed. It is not zero, for the same reason a null price is not: zero is a
   * line somebody deliberately marked as undiscounted.
   */
  discount: number | null;
}

/**
 * One person's picks from one order.
 *
 * `items` is the only list here, deliberately. An earlier draft kept a parallel
 * `mealTitles` alongside it so existing readers would not have to change, and
 * that is exactly the two-sources-that-must-agree shape this codebase forbids
 * everywhere else. Callers that only want titles use `selectionTitles()`.
 */
export interface OrderSelection {
  /** The Person note's title. Written as a wikilink, read back as a title. */
  personTitle: string;
  items: OrderItem[];
}

/** One order, as read back out of its note. */
export interface ParsedOrder {
  /**
   * From the filename, never from frontmatter.
   *
   * The number is what a supplier calls this order, and it is already in the
   * filename; writing it into a property as well would give two places to
   * disagree.
   */
  orderNumber: string;
  companyTitle: string | null;
  /** ISO date. The property wins over the filename, since a person can correct it. */
  orderDate: string | null;
  deliveryDate: string | null;
  /** The total as somebody typed it. Never overwritten by the computed one. */
  price: number | null;
  priceCurrency: string | null;
  /** Taken off the whole order. A line may carry one of its own as well. */
  discount: number | null;
  shipping: number | null;
  /**
   * VAT, as the note states it rather than as anything computed.
   *
   * **Every price in an order is gross.** That is what a meal company's invoice
   * says and what these notes have always held, so nothing here changes the
   * meaning of a figure. `vatRate` and `vatAmount` are what a note may
   * additionally claim about how much of the gross was tax, and the invoice
   * shows them as an included line. Either may be present without the other:
   * some invoices state the rate, some state the francs, most state both.
   */
  vatRate: number | null;
  vatAmount: number | null;
  selections: OrderSelection[];
}

/**
 * A parsed order paired with the file it came from.
 *
 * Generic over the host's own file type, the same way `VaultNote` is: this
 * package may not import Obsidian, and a caller's `TFile` flows through
 * structurally without a cast at the boundary.
 */
export interface OrderRecord<F = unknown> extends ParsedOrder {
  file: F;
  title: string;
}
