/**
 * Folding a group away: the shared header, and the two views that key one.
 *
 * The header used to be written out inside the ledger view. It is now
 * `foldableGroup` in the kit, because the PARA view's project statuses fold on
 * exactly the same terms -- and a second copy of a widget is a second place for
 * a rule to be forgotten. The rules are what this suite is about, so half of it
 * reads the kit and half reads the views that use it.
 *
 * **A folded group still states its total.** A fold that hid the total would be
 * a fold that removes the answer, and the whole reason to fold a report is to
 * read the group totals without the accounts under them. In the PARA view the
 * total is a count, and a shut status group that had stopped saying how many
 * are in it would be a fold with no purpose at all. So the header is drawn
 * unconditionally and only the contents are guarded.
 *
 * **The key is a position, not a label.** `ReportGroup.name` is a label and two
 * groups in different parts of a sheet may carry the same one; `path` is the
 * group's position. Keying on the name would fold an unrelated group somewhere
 * else in the report -- the kind of thing nobody notices until a sheet is long
 * enough to have a repeated heading. The PARA view has the same problem in
 * sharper form, because every goal shows the same eight status names.
 *
 * Source tests. They pin the shape of the guards, not that a click folds
 * anything -- that was checked by opening the tabs.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const kit = read('ui', 'kit', 'elements.ts');
const ledger = read('ui', 'views', 'ledger-view.ts');
const para = read('ui', 'views', 'para-view.ts');

describe('the foldable group', () => {
  it('draws the name and the trailing value whether or not it is folded', () => {
    // The header is read as a whole and asserted to branch on nothing. An
    // ordering check, or a check that the call starts its line, both still
    // pass once an `if (folded)` is put in front of the trailing value --
    // which is precisely the regression worth catching.
    const from = kit.indexOf('const header = wrapper.createEl(');
    const to = kit.indexOf('header.addEventListener(');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const header = kit.slice(from, to);
    expect(header).toContain("cls: 'nod-fold-name'");
    expect(header).toContain("cls: 'nod-fold-trailing'");
    expect(header).not.toMatch(/\bif\s*\(/);
  });

  it('says which state it is in, for a screen reader as well', () => {
    expect(kit).toContain("header.setAttr('aria-expanded', String(!options.folded));");
    expect(kit).toContain("options.folded ? 'chevron-right' : 'chevron-down'");
  });

  /**
   * The caller decides what is behind the header, so the kit cannot guard it.
   * If it ever did, both views would lose the ability to keep something on
   * screen while folded.
   */
  it('leaves the contents to the caller', () => {
    expect(kit).toContain('return wrapper;');
  });
});

describe('the ledger report', () => {
  it('remembers what is folded, so an untouched report is whole', () => {
    expect(ledger).toMatch(/private readonly collapsed = new Set<string>\(\);/);
  });

  it('keys the fold on the group path, not its name', () => {
    expect(ledger).toContain('this.collapsed.has(child.path)');
    expect(ledger).toContain('this.collapsed.delete(child.path)');
    expect(ledger).toContain('this.collapsed.add(child.path)');
    expect(ledger).not.toContain('this.collapsed.has(child.name)');
  });

  it('guards only the recursion into the children', () => {
    expect(ledger).toMatch(
      /if \(!folded\) this\.renderGroup\(wrapper, child, ledger, depth \+ 1\);/
    );
  });
});

describe('the PARA view', () => {
  /**
   * The same key rule, and the reason is louder here: `Laufend` appears under
   * every goal, so a key that was the status alone would fold every goal's
   * ongoing projects at once.
   */
  it('keys the fold on the goal as well as the status', () => {
    expect(para).toMatch(/const key = `\$\{owner\}\\u0000\$\{group\.status\}`;/);
  });

  it('holds the exceptions rather than the state, so a new status arrives at its own default', () => {
    expect(para).toContain('this.toggled.has(key) === opensByDefault(group.status)');
  });

  it('draws the count on the header and the projects only when open', () => {
    const from = para.indexOf('const wrapper = foldableGroup(parent, {');
    const to = para.indexOf('if (folded) continue;');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(para.slice(from, to)).toContain('trailing: String(group.items.length)');
  });
});
