/**
 * Every field the CRM forms write, the edit forms must first read.
 *
 * The edit dialogs are the creation dialogs with the submit rerouted, which is
 * what keeps one set of fields instead of two. It also creates one specific way
 * to lose data, and it is quiet.
 *
 * `properties()` returns `undefined` for a field left blank, and the edit path
 * *deletes* the properties that come back undefined -- which is what makes
 * clearing an email, or taking back a payment-provider flag, possible at all.
 * So a field added to the creation form and not prefilled in the edit form
 * arrives at the dialog blank, comes back undefined, and removes a property
 * nobody touched. The note loses a value, the dialog reports success, and
 * nothing anywhere says a word.
 *
 * There is no runtime check that can catch this: a deleted property looks
 * exactly like a property somebody meant to clear. So it is caught here, in the
 * source, where the two lists can be compared.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (...parts: string[]) => readFileSync(join(__dirname, '..', 'src', ...parts), 'utf8');

const COMPANY = src('crm', 'new-company-modal.ts');
const PERSON = src('crm', 'new-person-modal.ts');
const EDITS = src('crm', 'edit-crm-modals.ts');

/** One brace-matched body, from the first line that matches `signature`. */
function bodyAfter(source: string, signature: RegExp): string {
  const found = signature.exec(source);
  if (!found) throw new Error(`nothing matching ${signature} in the source`);

  const open = source.indexOf('{', found.index + found[0].length - 1);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unbalanced braces after ${signature}`);
}

/** The fields a `properties()` body reads off the form. */
function fieldsWritten(source: string): string[] {
  const body = bodyAfter(source, /protected properties\(/);
  return [...new Set([...body.matchAll(/this\.(\w+)/g)].map((match) => match[1]))];
}

/** The fields a class's constructor fills in. */
function fieldsPrefilled(source: string, className: string): string[] {
  const body = bodyAfter(source, new RegExp(`export class ${className}[\\s\\S]*?constructor\\(`));
  return [...new Set([...body.matchAll(/this\.(\w+)\s*=/g)].map((match) => match[1]))];
}

describe('the CRM edit forms', () => {
  it('finds the fields to compare, so a broken read cannot pass silently', () => {
    expect(fieldsWritten(COMPANY)).toContain('account');
    expect(fieldsWritten(PERSON)).toContain('email');
    expect(fieldsPrefilled(EDITS, 'EditCompanyModal').length).toBeGreaterThan(3);
  });

  it('reads back every company field the form writes', () => {
    const prefilled = new Set(fieldsPrefilled(EDITS, 'EditCompanyModal'));
    const missed = fieldsWritten(COMPANY).filter((field) => !prefilled.has(field));
    expect(missed).toEqual([]);
  });

  it('reads back every person field the form writes', () => {
    const prefilled = new Set(fieldsPrefilled(EDITS, 'EditPersonModal'));
    const missed = fieldsWritten(PERSON).filter((field) => !prefilled.has(field));
    expect(missed).toEqual([]);
  });

  it('does not offer to rename, on either form', () => {
    // Renaming is Obsidian's operation and it has links to keep in step. A
    // dialog that renamed the company note every invoice points at would break
    // those links without ever saying so.
    for (const className of ['EditCompanyModal', 'EditPersonModal']) {
      const body = bodyAfter(EDITS, new RegExp(`export class ${className}\\b`));
      expect(body).toMatch(/offersTitle\(\): boolean \{\s*return false;/);
    }
  });

  it('leaves properties it does not own alone', () => {
    // A note three plugins share. This one may say what it knows, and must not
    // rewrite the frontmatter wholesale.
    expect(EDITS).not.toMatch(/frontmatter\s*=\s*\{/);
    expect(EDITS).toMatch(/delete frontmatter\[key\]/);
  });
});
