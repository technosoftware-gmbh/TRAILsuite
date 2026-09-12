/**
 * Something that cost money, reduced to the few facts a summary needs.
 *
 * Lifted out of the budget when budgeting moved onto accounts. It never
 * belonged to the budget in the first place: a spending summary groups what was
 * bought by area and category whether or not anybody has planned a figure for
 * it, and the block that draws one on a period note has no budget in hand.
 *
 * App-free.
 */
export interface SpendItem {
  areaTitle: string | null;
  category: string | null;
  amount: number | null;
  currency: string | null;
}
