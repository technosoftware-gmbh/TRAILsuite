/**
 * What each of the two file pickers is willing to offer.
 *
 * The rest of both fields is DOM building and stays untested, the boundary
 * this package draws everywhere. The predicate is the part with a decision in
 * it, and the decision is that they are two fields rather than one: a picture
 * picker listing PDFs, or a document picker hiding a scan, would each be a
 * control that lies about what belongs in the field it fills.
 *
 * The document net is deliberately the wider of the two -- everything that is
 * not a note -- which is NODAtrail's answer to the same question, copied
 * rather than improved on. A deck plan is a PDF far more often than not, and a
 * photograph of a printed one is the same thing to whoever is filing it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  FuzzySuggestModal: class {},
  Setting: class {},
  Notice: class {},
}));

import { isImageFile } from '../src/ui/components/image-field';
import { isDocumentFile } from '../src/ui/components/document-field';
import type { TFile } from 'obsidian';

function file(name: string): TFile {
  const dot = name.lastIndexOf('.');
  return {
    path: `Places/${name}`,
    basename: name.slice(0, dot),
    extension: name.slice(dot + 1),
  } as TFile;
}

describe('what the picture picker offers', () => {
  it('takes the formats Obsidian renders, whatever their case', () => {
    for (const name of ['deck.png', 'kabine.JPG', 'plan.jpeg', 'shot.webp', 'logo.svg']) {
      expect(isImageFile(file(name)), name).toBe(true);
    }
  });

  it('does not offer a document or a note', () => {
    for (const name of ['deckplan.pdf', 'trip.md', 'invoice.eml']) {
      expect(isImageFile(file(name)), name).toBe(false);
    }
  });
});

describe('what the document picker offers', () => {
  it('takes anything that is not a note', () => {
    for (const name of ['deckplan.pdf', 'brochure.eml', 'notes.txt', 'plan.docx']) {
      expect(isDocumentFile(file(name)), name).toBe(true);
    }
  });

  it('takes a picture too, because a scan of a plan is a plan', () => {
    // The one place the two nets deliberately overlap. A deck plan somebody
    // photographed is still the deck plan, and a picker that refused it would
    // be right about the file type and wrong about the question.
    expect(isDocumentFile(file('deckplan.png'))).toBe(true);
  });

  it('never offers a note, which is the whole of the rule', () => {
    expect(isDocumentFile(file('Die Nordkap-Linie.md'))).toBe(false);
  });
});
