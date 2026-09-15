/**
 * The parts of the paper that are decisions rather than markup: what the
 * document says its language is, and what the credit line under every sheet
 * looks like.
 *
 * The prose rules have their own suite beside this one.
 */
import { describe, expect, it } from 'vitest';
import { printableDocument, section, sheetCreditHtml } from '../../src/print/sheet';

describe('the document around a sheet', () => {
  /** Every sheet written before the ledger sheets said English, and still does byte for byte. */
  it('says English when no language is given', () => {
    const html = printableDocument({ title: 'T', style: '', body: '' });
    expect(html).toContain('<html lang="en">');
  });

  it('says the language it is given', () => {
    const html = printableDocument({ title: 'T', style: '', body: '', lang: 'de' });
    expect(html).toContain('<html lang="de">');
  });

  it('cannot be made to break out of the attribute', () => {
    const html = printableDocument({ title: 'T', style: '', body: '', lang: '"><script>' });
    expect(html).not.toContain('<script>');
  });

  it('escapes the title', () => {
    const html = printableDocument({ title: 'A & <B>', style: '', body: '' });
    expect(html).toContain('<title>A &amp; &lt;B&gt;</title>');
  });
});

describe('a section', () => {
  it('prints no heading with nothing under it', () => {
    expect(section('Bilanz', [])).toBe('');
  });

  it('glues the heading to the first block only', () => {
    expect(section('Bilanz', ['<p>1</p>', '<p>2</p>'])).toBe(
      '<div class="section-head"><h2>Bilanz</h2><p>1</p></div><p>2</p>'
    );
  });
});

describe('the credit line', () => {
  it('prints the words and a link whose text is its address', () => {
    expect(sheetCreditHtml('Erstellt am 15. Sept. 2026 mit NODAtrail')).toBe(
      '<p class="credit">Erstellt am 15. Sept. 2026 mit NODAtrail - ' +
        '<a href="https://technosoftware.com">technosoftware.com</a></p>'
    );
  });

  /** The author is a setting, and a setting is user input. */
  it('escapes the words', () => {
    expect(sheetCreditHtml('Erstellt von <b>Tom</b>')).toContain(
      'Erstellt von &lt;b&gt;Tom&lt;/b&gt;'
    );
  });

  it('prints a link as the text a reader sees', () => {
    expect(sheetCreditHtml('Erstellt von [[Thomas]]')).toContain('Erstellt von Thomas -');
  });
});
