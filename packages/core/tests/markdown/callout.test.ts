/**
 * Finding and composing callouts.
 *
 * The cases that matter are the boundaries: where the block stops, and what a
 * caller is told about where it sat. A reader that swallowed the paragraph
 * under a summary would hand it to a form, and saving that form would fold
 * somebody's text into the callout.
 */
import { describe, expect, it } from 'vitest';
import { calloutLines, calloutText, findCallout } from '../../src/markdown/callout';

const NOTE = [
  '',
  '---',
  '',
  '> [!SUMMARY]+',
  '> Automatic Reconstitution of PT Rec not triggered after upgrade to SW 2.5.0 even though',
  '> the liquid volume was below the minima defined.',
  '',
  '## Notes',
  '',
  '- checked with support',
];

describe('finding a callout', () => {
  it('reads its kind, fold and lines', () => {
    const found = findCallout(NOTE, 'SUMMARY');

    expect(found?.kind).toBe('SUMMARY');
    expect(found?.fold).toBe('+');
    expect(found?.title).toBe('');
    expect(found?.lines).toHaveLength(2);
  });

  it('stops at the blank line, leaving what follows alone', () => {
    const found = findCallout(NOTE, 'SUMMARY');

    expect(found?.from).toBe(3);
    expect(found?.to).toBe(6);
    expect(NOTE.slice(found?.to).join('\n')).toContain('## Notes');
  });

  it('matches the kind whatever the case it was written in', () => {
    expect(findCallout(['> [!summary]+', '> written by hand'], 'SUMMARY')?.lines).toEqual([
      'written by hand',
    ]);
  });

  it('reads the heading a callout carries', () => {
    const found = findCallout(['> [!SUMMARY]+ Überblick', '> Hauptstadt: Wiesbaden.'], 'SUMMARY');

    expect(found?.title).toBe('Überblick');
    expect(found?.lines).toEqual(['Hauptstadt: Wiesbaden.']);
  });

  it('is null for a kind the body does not carry', () => {
    expect(findCallout(NOTE, 'INFO')).toBeNull();
  });
});

describe('composing a callout', () => {
  it('writes the opener and the quoted lines', () => {
    expect(calloutLines('SUMMARY', '+', '', 'one\ntwo')).toEqual([
      '> [!SUMMARY]+',
      '> one',
      '> two',
    ]);
  });

  /**
   * A truly empty line ends the blockquote, so a summary with a paragraph break
   * in it would come back as two callouts, the second of them unnamed.
   */
  it('keeps a blank line inside the block quoted', () => {
    expect(calloutLines('SUMMARY', '+', '', 'one\n\ntwo')).toEqual([
      '> [!SUMMARY]+',
      '> one',
      '>',
      '> two',
    ]);
  });

  it('round-trips the text it was given', () => {
    const text = 'one\n\ntwo';

    expect(calloutText(findCallout(calloutLines('SUMMARY', '+', '', text), 'SUMMARY')!)).toBe(text);
  });
});
