/**
 * The gallery's tenth travel chip, and what a vehicle looks like in it.
 *
 * Vehicles were kept out of this view on purpose (note 38): every facet
 * beside the chips is a place facet and a ship answers none of them, so a
 * facet left set from another chip would empty the grid of exactly the rows
 * somebody had just filtered to. What is checked here is the answer to that,
 * because the answer is the whole reason the decision could be reversed --
 * the facet row is built from the rows in scope, so none of the three is even
 * drawn for a vehicle, and the one case that leaks, a value carried in from
 * another chip, is cleared on the way in.
 *
 * The two hand-typed lists are checked against each other for the reason
 * settings.test.ts checks its folder keys: this package has already shipped
 * a key missing from a list that existed to catch it.
 */
import { describe, expect, it } from 'vitest';
import {
  answersPlaceFacets,
  GALLERY_TYPE_FILTER_ORDER,
  GalleryTypeFilter,
  TYPE_FILTER_LABEL_KEYS,
  TYPES_WITHOUT_PLACE_FACETS,
} from '../src/ui/gallery/gallery-types';
import { vehicleMetaItems } from '../src/ui/dashboard/travel-entity-meta';
import { travelModeIcon, travelModeLabel } from '../src/shared/travel-mode';
import { computePlaceStats } from '../src/places/place-stats';
import { compareByRank, defaultGalleryRanks } from '../src/ui/gallery/gallery-order';
import { aBoard, aVehicle } from './fixtures';
import { CrmBoard } from '../src/crm/types';

const noCrm: CrmBoard = { persons: [], companies: [] };

describe('the gallery chip vocabulary', () => {
  it('offers a chip for every type it has a label for', () => {
    const labelled = Object.keys(TYPE_FILTER_LABEL_KEYS).sort();
    expect([...GALLERY_TYPE_FILTER_ORDER].sort()).toEqual(labelled);
  });

  it('lists no chip twice', () => {
    expect(new Set(GALLERY_TYPE_FILTER_ORDER).size).toBe(GALLERY_TYPE_FILTER_ORDER.length);
  });

  it('shows vehicles, between the places and the people', () => {
    const at = (type: GalleryTypeFilter) => GALLERY_TYPE_FILTER_ORDER.indexOf(type);
    expect(at('vehicle')).toBeGreaterThan(at('photospot'));
    expect(at('vehicle')).toBeLessThan(at('person'));
  });

  it('does not show bookings, which have no picture and are not places', () => {
    expect(GALLERY_TYPE_FILTER_ORDER).not.toContain('booking');
  });
});

describe('which chips answer the place facets', () => {
  it('says no for a vehicle, which is neither visited nor rated nor in a country', () => {
    expect(answersPlaceFacets('vehicle')).toBe(false);
  });

  it('says yes for a landmark, and for the unfiltered grid', () => {
    expect(answersPlaceFacets('landmark')).toBe(true);
    expect(answersPlaceFacets('all')).toBe(true);
  });

  it('names only chips the gallery actually offers', () => {
    for (const type of TYPES_WITHOUT_PLACE_FACETS) {
      expect(GALLERY_TYPE_FILTER_ORDER).toContain(type);
    }
  });
});

describe('a vehicle card', () => {
  it('says what she is, who runs her, and how old she is', () => {
    const items = vehicleMetaItems(
      aVehicle('MS Trollfjord', {
        mode: 'boat',
        operatorTitle: 'Hurtigruten',
        built: '2002',
        refurbished: '2023',
      })
    );
    expect(items.map((i) => i.text)).toEqual(['Boat', 'Hurtigruten', '2002 · refurbished 2023']);
  });

  it('keeps the build year and the refurbishment in one chip, not two', () => {
    const items = vehicleMetaItems(aVehicle('Pride of Africa', { built: '1989' }));
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('1989');
  });

  it('still says something for a ship refurbished on a build year nobody wrote down', () => {
    const items = vehicleMetaItems(aVehicle('MS Nordlys', { refurbished: '2020' }));
    expect(items.map((i) => i.text)).toEqual(['refurbished 2020']);
  });

  it('shows nothing rather than empty chips for a note carrying only a name', () => {
    expect(vehicleMetaItems(aVehicle('Unnamed'))).toEqual([]);
  });

  it('takes its icon from the mode, so a ship and a train are told apart', () => {
    expect(vehicleMetaItems(aVehicle('A', { mode: 'boat' }))[0].icon).toBe('ship');
    expect(vehicleMetaItems(aVehicle('B', { mode: 'train' }))[0].icon).toBe('train-front');
  });
});

describe('a mode nobody recognises', () => {
  it('prints the note is own word rather than the key path that would have been looked up', () => {
    expect(travelModeLabel('ferry')).toBe('ferry');
  });

  it('translates one of the six', () => {
    expect(travelModeLabel('boat')).toBe('Boat');
  });

  it('reads an unset mode as nothing at all', () => {
    expect(travelModeLabel(null)).toBeNull();
    expect(travelModeLabel('   ')).toBeNull();
  });

  it('falls back to the generic icon', () => {
    expect(travelModeIcon('ferry')).toBe('route');
    expect(travelModeIcon(null)).toBe('route');
  });
});

describe('the vehicles tile', () => {
  it('counts them', () => {
    const board = aBoard({ vehicles: [aVehicle('MS Trollfjord'), aVehicle('Pride of Africa')] });
    expect(computePlaceStats(board).vehiclesTotalCount).toBe(2);
  });

  it('counts none as none rather than as nothing', () => {
    expect(computePlaceStats(aBoard()).vehiclesTotalCount).toBe(0);
  });
});

describe('where a vehicle sits in the default grid order', () => {
  it('comes after the places and before the people', () => {
    const trollfjord = aVehicle('MS Trollfjord');
    const board = aBoard({ vehicles: [trollfjord] });
    const crm: CrmBoard = {
      persons: [{ file: { path: 'Anna.md', basename: 'Anna' }, title: 'Anna', tags: [] }],
      companies: [],
    } as unknown as CrmBoard;
    const ranks = defaultGalleryRanks(board, crm);
    const rows = [crm.persons[0], trollfjord];
    const ordered = [...rows].sort((a, b) => compareByRank(ranks, a, b)).map((row) => row.title);
    expect(ordered).toEqual(['MS Trollfjord', 'Anna']);
  });

  it('orders two ships by name', () => {
    const zeus = aVehicle('Zeus');
    const argo = aVehicle('Argo');
    const board = aBoard({ vehicles: [zeus, argo] });
    const ranks = defaultGalleryRanks(board, noCrm);
    expect([zeus, argo].sort((a, b) => compareByRank(ranks, a, b)).map((v) => v.title)).toEqual([
      'Argo',
      'Zeus',
    ]);
  });
});
