/**
 * The view type strings this plugin has registered, kept in a file of their
 * own. Only one is live.
 *
 * A retired constant stays here rather than being deleted, because the string
 * is written into every user's `workspace.json`. Removing it would leave a tab
 * reading "no view of type ..." rather than closing; leaving the string
 * declared but registered nowhere is what makes Obsidian drop the tab quietly
 * on the next load.
 *
 * Retired 2 September 2026, both of them, when the Trips and Places dashboards
 * folded into the gallery. Each had become a launcher into it: the Places one
 * was three stat tiles over strips capped at six cards, every strip ending in
 * a button that opened the gallery filtered to that type, and every tile doing
 * the same. The gallery now carries the greeting, the creation buttons and all
 * five stat tiles, and the tiles filter the grid in place rather than opening
 * a third view. See docs/design/dashboard-split-and-crm.md.
 *
 * The gallery keeps its own view type (`apertrail-gallery-view`) rather than
 * adopting `apertrail-dashboard-view`. Taking the retired string over would
 * have broken the gallery tabs that already exist to save the dashboard tabs
 * that do, and a vault with both open would then have held two of the same
 * view.
 */
export const RETIRED_TRIP_DASHBOARD_VIEW_TYPE = 'apertrail-dashboard-view';
export const RETIRED_PLACES_DASHBOARD_VIEW_TYPE = 'apertrail-places-dashboard-view';
/**
 * Retired 28 August 2026. The people and companies are NODAtrail's to list:
 * the forms that create and edit them have always been there, and a view here
 * that listed what only the other plugin could change was a split nobody could
 * hold in their head. APERtrail still creates a Person or a Company -- a trip
 * needs both -- and still browses them in the combined gallery.
 */
export const RETIRED_CRM_DASHBOARD_VIEW_TYPE = 'apertrail-crm-dashboard-view';
