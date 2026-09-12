/**
 * The retired view-type strings stay declared, and stay unregistered.
 *
 * Three dashboards have been retired from this plugin, and each left a string
 * behind in every user's `workspace.json`. Obsidian drops a tab whose view
 * type nothing registers, quietly, on the next load; a tab whose type is
 * registered by something that no longer exists is what produces "no view of
 * type ...". So the constants are kept as a record of names that are spent --
 * and, without this, that record would be a file nothing imports, which is
 * how a name gets reused by accident two years later.
 *
 * The check is deliberately a source scan rather than a call into `onload()`.
 * Registering a view needs a live `Plugin`, and the failure this guards is
 * somebody typing one of these strings into `main.ts`, which a scan sees
 * exactly as well.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RETIRED_CRM_DASHBOARD_VIEW_TYPE,
  RETIRED_PLACES_DASHBOARD_VIEW_TYPE,
  RETIRED_TRIP_DASHBOARD_VIEW_TYPE,
} from '../src/ui/dashboard/dashboard-view-types';

const SRC = join(__dirname, '..', 'src');
const DECLARATION = 'ui/dashboard/dashboard-view-types.ts';

const RETIRED = [
  RETIRED_TRIP_DASHBOARD_VIEW_TYPE,
  RETIRED_PLACES_DASHBOARD_VIEW_TYPE,
  RETIRED_CRM_DASHBOARD_VIEW_TYPE,
];

function sources(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

describe('view types', () => {
  const files = sources(SRC);

  it('mentions each retired string in the file that records it, and nowhere else', () => {
    for (const retired of RETIRED) {
      const mentions = files
        .filter((file) => file.text.includes(`'${retired}'`))
        .map((f) => f.path);
      expect(mentions).toEqual([DECLARATION]);
    }
  });

  it('does not reuse a retired string for the view that is left', () => {
    // The gallery kept its own type rather than adopting the Trips
    // dashboard's when the two folded together: taking that string over
    // would have broken the gallery tabs that already exist to save the
    // dashboard tabs that do, and a vault with both open would then have
    // held two of the same view.
    //
    // Read out of the source rather than imported: the constant sits beside
    // the view class, and importing it would construct an ItemView subclass
    // in a suite that has no Obsidian to extend.
    const gallery = files.find((file) => file.path === 'ui/gallery/travel-gallery-view.ts');
    const declared = gallery?.text.match(/export const TRAVEL_GALLERY_VIEW_TYPE = '([^']+)'/)?.[1];
    expect(declared).toBeTruthy();
    expect(RETIRED).not.toContain(declared);
  });

  it('registers exactly one view', () => {
    const main = files.find((file) => file.path === 'main.ts');
    expect(main).toBeDefined();
    expect(main?.text.match(/this\.registerView\(/g)?.length).toBe(1);
  });
});
