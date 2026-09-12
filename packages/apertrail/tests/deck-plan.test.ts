/**
 * The deck plan: one document per vehicle, linked rather than shown.
 *
 * It is a PDF, so nothing inlines it the way a picture inlines, and every
 * surface that carries it carries a link. What is checked here is the two
 * halves that can be checked without an App: the arithmetic that turns a
 * vault path into something a sheet sitting elsewhere in the vault can point
 * at, and what the sheet does with it once it has it.
 *
 * The resolution itself (wikilink or path to a TFile) is `resolveVaultFile`,
 * which is `image-resolve.ts`'s own lookup lifted out on its second consumer
 * and is exercised through every picture in the suite.
 */
import { describe, expect, it } from 'vitest';
import { relativeVaultPath } from '../src/shared/vault-file';
import { exportFolder } from '../src/shared/export-folder';
import type { TFile } from 'obsidian';
import { buildProspectHtml, Prospect } from '../src/places/export-prospect';
import {
  buildVehicleFrontmatter,
  parseVehicle,
  vehicleManagedKeys,
  VehiclePropertyNames,
} from '../src/places/vehicle-note';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { vehicleProperties } from '../src/vault/read-entities';
import { vehicleMetaItems } from '../src/ui/dashboard/travel-entity-meta';
import { aVehicle } from './fixtures';

const P: VehiclePropertyNames = vehicleProperties(DEFAULT_SETTINGS);

function sheet(facts: Prospect['facts']): Prospect {
  return {
    title: 'MS Trollfjord',
    description: null,
    overview: [],
    meta: [],
    hero: null,
    cabins: [],
    facts,
    gallery: [],
    highlights: [],
    trips: [],
    labels: {
      highlights: 'Highlights',
      overview: 'About her',
      cabins: 'Cabins',
      facts: 'Facts',
      gallery: 'Pictures',
      trips: 'Trips',
    },
    caveat: 'From the note.',
    footer: 'Written today.',
  };
}

describe('pointing at a file from a sheet beside it', () => {
  it('names a sibling in the same folder plainly', () => {
    expect(relativeVaultPath('Places/Vehicles', 'Places/Vehicles/plan.pdf')).toBe('plan.pdf');
  });

  it('walks down into a subfolder, which is where an attachment actually sits', () => {
    expect(relativeVaultPath('Places/Vehicles', 'Places/Vehicles/_documents/plan.pdf')).toBe(
      '_documents/plan.pdf'
    );
  });

  it('walks back up for a file kept somewhere else entirely', () => {
    expect(relativeVaultPath('Places/Vehicles', 'Attachments/plan.pdf')).toBe(
      '../../Attachments/plan.pdf'
    );
  });

  it('handles a sheet written at the vault root', () => {
    expect(relativeVaultPath('', 'Places/Vehicles/plan.pdf')).toBe('Places/Vehicles/plan.pdf');
  });
});

describe('the brochure', () => {
  it('makes a fact with a target clickable and leaves the rest as text', () => {
    const html = buildProspectHtml(
      sheet([
        { label: 'Built', value: '2002' },
        { label: 'Deck plan', value: 'decks.pdf', href: '_documents/decks.pdf' },
      ])
    );

    expect(html).toContain('<a href="_documents/decks.pdf">decks.pdf</a>');
    // The build year is a number, not a link, and gains no anchor from
    // sharing a table with one.
    expect(html).toContain('<td>2002</td>');
  });

  it('escapes a target rather than letting it close the attribute', () => {
    const html = buildProspectHtml(
      sheet([{ label: 'Deck plan', value: 'x', href: 'a"><script>alert(1)</script>' }])
    );

    expect(html).not.toContain('<script>');
  });
});

describe('what the note carries', () => {
  it('round-trips through its own writer and reader', () => {
    const yaml = buildVehicleFrontmatter(
      {
        description: null,
        mode: null,
        operatorTitle: null,
        built: null,
        refurbished: null,
        capacity: null,
        length: null,
        tonnage: null,
        website: null,
        deckPlan: 'Places/Vehicles/_documents/decks.pdf',
        cabins: [],
      },
      P
    );

    expect(yaml.deckPlan).toBe('Places/Vehicles/_documents/decks.pdf');
    expect(parseVehicle(yaml, P).deckPlan).toBe('Places/Vehicles/_documents/decks.pdf');
  });

  /**
   * It is written by the dialog, so the dialog owns it: an edit that cleared
   * the field has to clear the property, or the old plan survives a removal.
   * `image` and `gallery` are the deliberate exceptions, and this is not one
   * of them.
   */
  it('is a key the editor owns and clears', () => {
    expect(vehicleManagedKeys(P)).toContain(DEFAULT_SETTINGS.vehicleDeckPlanProperty);
  });
});

describe('the card', () => {
  it('says a plan exists', () => {
    const items = vehicleMetaItems(aVehicle('MS Trollfjord', { deckPlan: 'x/decks.pdf' }));
    expect(items.map((i) => i.text)).toContain('Deck plan');
  });

  it('says nothing about one for a ship with no plan', () => {
    expect(vehicleMetaItems(aVehicle('MS Nordlys'))).toEqual([]);
  });
});

/**
 * The href is computed from where the SHEET lands, not from where the note is.
 * Those were the same folder until sheets moved into `_exports`, and the
 * symptom of getting it wrong is a link that opens nothing -- which is the
 * failure this whole file exists to keep out.
 */
describe('the link a sheet in the exports folder writes', () => {
  it('walks up out of the exports folder to reach the documents folder', () => {
    const sheetFolder = exportFolder(DEFAULT_SETTINGS, 'Places/Vehicles/MS Trollfjord.md');

    expect(sheetFolder).toBe('Places/Vehicles/_exports');
    expect(relativeVaultPath(sheetFolder, 'Places/Vehicles/_documents/decks.pdf')).toBe(
      '../_documents/decks.pdf'
    );
  });
});

/**
 * The row as the brochure actually builds it.
 *
 * The two halves above are each right while a caller hands the wrong folder to
 * them, and that is exactly what happened: the builder passed the note's own
 * parent, which was the sheet's folder only until sheets moved into
 * `_exports`. `vehicleFacts` now works the folder out from the settings rather
 * than taking one, so there is no wrong value left to pass -- and this asserts
 * the answer it arrives at.
 */
describe('the row the brochure actually builds', () => {
  it('points at the plan from where the sheet lands, not from where the note is', async () => {
    const { vehicleFacts } = await import('../src/places/ui/export-prospect');
    const { TFile } = await import('obsidian');

    const plan = Object.assign(new TFile(), {
      path: 'Places/Vehicles/_documents/decks.pdf',
      name: 'decks.pdf',
    });
    const app = {
      metadataCache: { getFirstLinkpathDest: () => plan },
      vault: { getFileByPath: () => plan },
    } as unknown as Parameters<typeof vehicleFacts>[0];

    const vehicle = aVehicle('MS Trollfjord', {
      file: { path: 'Places/Vehicles/MS Trollfjord.md', basename: 'MS Trollfjord' } as TFile,
      deckPlan: 'Places/Vehicles/_documents/decks.pdf',
    });
    const row = vehicleFacts(app, DEFAULT_SETTINGS, vehicle).find((f) => f.value === 'decks.pdf');
    expect(row?.href).toBe('../_documents/decks.pdf');
  });
});
