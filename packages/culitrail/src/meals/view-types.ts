/**
 * The view type strings CULItrail registers.
 *
 * Constants with no imports, on purpose. A view type is written into the
 * user's `workspace.json` when a tab of that type is open, so these strings
 * are vault data rather than internal naming: renaming one turns every open
 * tab into an unresolvable view on next launch. Keeping them in a file that
 * depends on nothing means the writers and the detection logic can reference
 * them without pulling a view into their import graph.
 *
 * They are all prefixed `culitrail-`. The code these came from carried a mix
 * of Recipe Box survivors and one `life-` outlier, none of which described
 * anything after the move, and the move was already breaking every open tab
 * once, so renaming them cost nothing extra.
 */
export const MEAL_VIEW_TYPE = 'culitrail-meal-view';
export const GALLERY_VIEW_TYPE = 'culitrail-gallery-view';
export const DASHBOARD_VIEW_TYPE = 'culitrail-dashboard-view';
export const MEAL_PLAN_VIEW_TYPE = 'culitrail-meal-plan-view';
export const ORDERS_VIEW_TYPE = 'culitrail-orders-view';
export const ORDER_NOTE_VIEW_TYPE = 'culitrail-order-note-view';
export const DELIVERY_NOTE_VIEW_TYPE = 'culitrail-delivery-note-view';
export const MEAL_PLAN_NOTE_VIEW_TYPE = 'culitrail-meal-plan-note-view';
