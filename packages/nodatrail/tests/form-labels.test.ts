/**
 * A label that says what the field is, rather than where it was borrowed from.
 *
 * `plan.title` is the Plan view's own name, and it had become the generic
 * "title" label for five fields with three different meanings: an account's
 * name, a posting's description, a budget's period. In both languages every one
 * of those forms said **Plan** over the box, which is a plausible enough word
 * beside an account that it was read as a real field somebody had to fill in.
 *
 * Reported from a real vault, on the new-account form, as "I am a bit confused
 * about plan usage".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');

/** Every `.ts` under src/, as path and text. */
function sources(dir: string, prefix = ''): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return sources(full, relative);
    return entry.name.endsWith('.ts') ? [{ path: relative, text: readFileSync(full, 'utf8') }] : [];
  });
}

/**
 * The files allowed to name the Plan view.
 *
 * The view itself, and the settings page's Plan section heading. Both are
 * naming the view rather than labelling a field, which is what the key means.
 */
const NAMES_THE_VIEW = new Set(['ui/views/plan-view.ts', 'ui/settings/page-property-keys.ts']);

describe('the Plan view name', () => {
  it('is used to name the Plan view and nothing else', () => {
    const borrowed = sources(SRC)
      .filter((file) => file.text.includes("t('plan.title')"))
      .map((file) => file.path)
      .filter((path) => !NAMES_THE_VIEW.has(path));

    expect(borrowed).toEqual([]);
  });

  it('leaves the forms saying what their fields are', () => {
    const byPath = new Map(sources(SRC).map((file) => [file.path, file.text]));

    expect(byPath.get('ledger/new-account-modal.ts')).toContain("t('common.name')");
    expect(byPath.get('crm/new-person-modal.ts')).toContain("t('common.name')");
    expect(byPath.get('crm/new-company-modal.ts')).toContain("t('common.name')");
    expect(byPath.get('ledger/new-posting-modal.ts')).toContain("t('common.description')");
    expect(byPath.get('ui/modals/new-finance-modals.ts')).toContain("t('common.period')");
  });
});
