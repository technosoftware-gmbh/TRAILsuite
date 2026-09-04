/**
 * The icon that stands for a kind of thing, where the kind is known but the
 * note is not -- the fallback a row uses when the note itself names none.
 *
 * One function so far, and it earns the file because the ternary it replaces
 * was already written out twice, identically, in plan-blocks.ts and
 * plan-sections.ts. Two copies of a mapping is how the block and the view
 * quietly stop agreeing about what a purchase looks like.
 */
import type { SourcedSpendItem } from '../../finance/spend';

export function spendIcon(kind: SourcedSpendItem['kind']): string {
  if (kind === 'purchase') return 'shopping-bag';
  return kind === 'bill' ? 'receipt' : 'repeat';
}
