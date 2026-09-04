/**
 * Where a document is filed, and what it is called when it gets there.
 *
 * The vault this was built for kept every invoice in one folder of a few
 * hundred PDFs while the notes about them were filed by year and month, so the
 * two never sat together. A document folder beside the note fixes that, and the
 * rules below are the ones that stop it costing anybody a file.
 */
import { describe, expect, it } from 'vitest';
import {
  documentFolderFor,
  documentTarget,
  fileNameOf,
  freeName,
  splitExtension,
} from '../src/finance/document-file';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const S = DEFAULT_SETTINGS;
const JANUARY = new Date(2026, 0, 15);

describe('where a document goes', () => {
  it('sits beside the note it is about', () => {
    expect(documentFolderFor(S, 'bill', JANUARY)).toBe('Finance/Bills/2026/01/_documents');
    expect(documentFolderFor(S, 'purchase', JANUARY)).toBe('Finance/Purchases/2026/01/_documents');
  });

  it('follows a note with no date into the module folder', () => {
    expect(documentFolderFor(S, 'bill', null)).toBe('Finance/Bills/_documents');
  });

  it('is nowhere when the setting is blank, which means leave things alone', () => {
    // The reading a vault with its own filing wants: a plugin that moved files
    // about because nobody said not to would be one you stop pointing at a
    // folder.
    expect(documentFolderFor({ ...S, documentSubfolder: '' }, 'bill', JANUARY)).toBe('');
    expect(
      documentTarget({ ...S, documentSubfolder: '' }, 'bill', JANUARY, 'x.pdf', new Set())
    ).toBeNull();
  });
});

describe('what it is called when it gets there', () => {
  it('keeps the name it came with', () => {
    expect(documentTarget(S, 'bill', JANUARY, 'Praemienrechnung_104.pdf', new Set())).toMatchObject(
      {
        name: 'Praemienrechnung_104.pdf',
        path: 'Finance/Bills/2026/01/_documents/Praemienrechnung_104.pdf',
      }
    );
  });

  it('takes the name off a path, since a picker hands over a whole one', () => {
    expect(fileNameOf('1 Areas/6 Finanzen/Rechnungen/aq.pdf')).toBe('aq.pdf');
    expect(fileNameOf('aq.pdf')).toBe('aq.pdf');
  });

  it('never overwrites what is already there', () => {
    // Two invoices from one vendor in one month arrive with the same name more
    // often than not, and the second silently replacing the first would destroy
    // a document somebody needs and say nothing.
    const taken = new Set(['rechnung.pdf', 'rechnung 2.pdf']);
    expect(freeName('rechnung.pdf', taken)).toBe('rechnung 3.pdf');
  });

  it('keeps the extension when it numbers a name apart', () => {
    expect(splitExtension('rechnung.pdf')).toEqual({ stem: 'rechnung', extension: '.pdf' });
    expect(freeName('rechnung.pdf', new Set(['rechnung.pdf']))).toBe('rechnung 2.pdf');
  });

  it('treats a leading dot as a hidden file rather than an extension', () => {
    expect(splitExtension('.htaccess')).toEqual({ stem: '.htaccess', extension: '' });
  });

  it('leaves a name alone when nothing has it', () => {
    expect(freeName('rechnung.pdf', new Set())).toBe('rechnung.pdf');
  });
});
