/**
 * A form that cannot be saved says which field it is waiting for.
 *
 * The error line read "Untitled" whatever was missing. That is a placeholder
 * that escaped: it names a field most of these forms do not have, and somebody
 * looking at two empty account pickers on a posting was told the posting had no
 * title. It never has one.
 *
 * The rule pinned here is that `blocker()` is the single source: `canSubmit()`
 * derives from it, so a form cannot refuse to save for a reason it declines to
 * name, and the two cannot drift into disagreeing about whether a form is
 * ready.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

function sources(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

const files = sources(SRC);
const formModal = files.find((file) => file.path.endsWith('modals/form-modal.ts'));

describe('the form base', () => {
  it('derives canSubmit from blocker, so the two cannot disagree', () => {
    expect(formModal?.text).toMatch(
      /canSubmit\(\): boolean \{\s*return this\.blocker\(\) === null;/
    );
  });

  it('shows the reason rather than a placeholder', () => {
    expect(formModal?.text).toContain("this.showError(this.blocker() ?? t('common.incomplete'))");
  });

  it('no longer answers every incomplete form with "Untitled"', () => {
    // The whole bug in one assertion.
    expect(formModal?.text).not.toContain('common.untitled');
  });
});

describe('the forms themselves', () => {
  /** Every form that decides for itself whether it can be saved. */
  const deciders = files.filter((file) =>
    /protected (override )?(canSubmit|blocker)\(/.test(file.text)
  );

  it('finds the forms to check', () => {
    expect(deciders.length).toBeGreaterThanOrEqual(5);
  });

  it('says why, rather than only that', () => {
    // A form overriding `canSubmit` still works and still gets the general
    // message, so this is a convention rather than a compile error, which is
    // exactly the kind that needs a test.
    const silent = deciders
      .filter((file) => !file.path.endsWith('modals/form-modal.ts'))
      .filter((file) => /protected (override )?canSubmit\(/.test(file.text))
      .map((file) => file.path);
    expect(silent).toEqual([]);
  });

  it('names both accounts on a posting, which is what went wrong', () => {
    const posting = files.find((file) => file.path.endsWith('ledger/new-posting-modal.ts'));
    expect(posting?.text).toContain("t('ledger.needsBothAccounts')");
    expect(posting?.text).toContain("t('ledger.needsDebit')");
    expect(posting?.text).toContain("t('ledger.needsCredit')");
  });
});

describe('reports leave out the accounts holding nothing', () => {
  const ledgerView = files.find((file) => file.path.endsWith('views/ledger-view.ts'));

  it('hides empty rows on every report, not only the income statement', () => {
    // Four: the chart's balances and its income statement, the balance sheet,
    // and the income tab. A report of eighty accounts of which thirty have
    // never been touched is a page nobody reads to the bottom.
    const uses = [...(ledgerView?.text.matchAll(/hideEmpty: true/g) ?? [])];
    expect(uses.length).toBeGreaterThanOrEqual(4);
  });
});
