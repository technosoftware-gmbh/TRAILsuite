/**
 * What a bill note gets called, and when the form stops deciding.
 *
 * The rule has two halves and both matter. Derivation is what makes forty
 * invoices sort next to their PDFs without anybody inventing forty titles. The
 * override is what stops the form arguing with an invoice that does not fit:
 * two references, none, a name somebody wants to recognise at a glance.
 *
 * "Typed" is stored as the text itself rather than as a flag, which is what
 * makes emptying the field hand the derivation back. A flag would have needed
 * clearing separately, and nobody would have found the switch.
 */
import { describe, expect, it } from 'vitest';
import { noteTitle, derivedNoteTitle } from '../src/finance/finance-title';

const baloise = { date: '2026-06-04', company: 'baloise', reference: '1000000001' };

describe('a bill note name', () => {
  it('is the day, the company and the reference', () => {
    expect(derivedNoteTitle(baloise)).toBe('20260604_baloise_1000000001');
  });

  it('follows the derivation while the title field is empty', () => {
    expect(noteTitle('', baloise)).toBe('20260604_baloise_1000000001');
    expect(noteTitle('   ', baloise)).toBe('20260604_baloise_1000000001');
  });

  it('is what somebody typed, once they type something', () => {
    expect(noteTitle('Steuern 2026 Rate 3', baloise)).toBe('Steuern 2026 Rate 3');
  });

  it('follows a corrected date rather than the one the reference was typed under', () => {
    // The order the fields are filled in must not decide the answer.
    expect(derivedNoteTitle({ ...baloise, date: '2026-01-22' })).toBe(
      '20260122_baloise_1000000001'
    );
  });

  it('leaves out a part the invoice does not have', () => {
    expect(derivedNoteTitle({ ...baloise, reference: '' })).toBe('20260604_baloise');
    expect(derivedNoteTitle({ ...baloise, company: '' })).toBe('20260604_1000000001');
    expect(derivedNoteTitle({ ...baloise, date: null })).toBe('baloise_1000000001');
  });

  it('is empty when nothing identifies the bill, which is what the form refuses to save', () => {
    expect(noteTitle('', { date: null, company: '', reference: '' })).toBe('');
  });

  it('keeps a company called what its note is called', () => {
    expect(derivedNoteTitle({ ...baloise, company: 'Baloise Versicherung' })).toBe(
      '20260604_Baloise Versicherung_1000000001'
    );
  });
});
