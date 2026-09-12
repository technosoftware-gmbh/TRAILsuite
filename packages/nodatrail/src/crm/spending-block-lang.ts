/**
 * The fence language NODAtrail renders inside a shared CRM note.
 *
 * Its own file because two places name it and neither should be the other's
 * source: `ui/blocks/register.ts` registers the processor, and the sample vault
 * declares it as the block a Person note must end up carrying even when a
 * sibling plugin wrote that note first. A literal in both would be two
 * spellings of one name, and the failure of a mismatch is silent -- a fence
 * nothing renders looks exactly like a fence with nothing to say.
 *
 * `nod-spending` is NODAtrail's counterpart to the blocks APERtrail and
 * CULItrail put in the same notes. Each plugin only ever writes a fence it owns
 * the constant for, which is what lets one Person note answer to all three
 * without any of them naming another.
 */
export const NOD_SPENDING_BLOCK_LANG = 'nod-spending';
