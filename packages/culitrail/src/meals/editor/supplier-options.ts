/**
 * Which suppliers the meal editor offers.
 *
 * Moved to `trail-core`. The rule it protects is not this plugin's: a `<select>`
 * whose value matches no option falls back to its first, and saving would then
 * replace a supplier somebody typed with "none" without anybody asking.
 *
 * App-free.
 */
export { isUnknownSupplier, supplierOptionValues } from '@technosoftware/trail-core';
