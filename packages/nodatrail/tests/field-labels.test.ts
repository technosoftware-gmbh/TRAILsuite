/**
 * A field is never labelled with the name of one of its values.
 *
 * `t('status.project.ongoing')` is the word "Laufend". Used as a dropdown's
 * **label** it says the field is called Laufend, which is not a translation
 * mistake -- both tables are right -- but a call site asking the wrong
 * question. It renders, it reads plausibly, and nobody notices until they open
 * the form to fill it in.
 *
 * There were eight of them: the new-project, new-goal, new-purchase and
 * new-recurring forms, and four rows on the property-keys page. All eight are
 * now `t('common.status')`.
 *
 * **This is the second time.** The same shape had already been found in five
 * places using `t('plan.title')` as a generic label, where three different
 * fields were captioned "Plan". A rule that has been broken twice is worth a
 * test rather than a third fix.
 *
 * The rule: a status key may be built from a value inside a `.map()` over the
 * vocabulary -- that is a dropdown's options, which is what those strings are
 * for -- and may not be written as a literal anywhere else.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** `t('status.<kind>.<value>')` written out in full, which is the mistake. */
const LITERAL_STATUS = /\bt\(\s*'status\.[a-z]+\.[a-zA-Z]+'\s*\)/g;

describe('field labels', () => {
  it('never name a field after one of its values', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.includes(join('lang', 'translations'))) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(LITERAL_STATUS)) {
        offenders.push(`${file.slice(SRC.length + 1)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still build the options from the vocabulary, which is what those keys are for', () => {
    // The other half: this must not be passed by deleting the strings.
    const para = readFileSync(join(SRC, 'ui', 'modals', 'new-para-modals.ts'), 'utf8');
    expect(para).toContain('t(`status.para.${status}`)');
    expect(para).toContain("t('common.status')");
  });

  it('would catch the mistake if it came back', () => {
    // The regex, checked against the shape it is looking for, so a change to
    // it cannot quietly stop matching.
    expect("t('status.project.ongoing')".match(LITERAL_STATUS)).not.toBeNull();
    expect('t(`status.project.${status}`)'.match(LITERAL_STATUS)).toBeNull();
  });
});
