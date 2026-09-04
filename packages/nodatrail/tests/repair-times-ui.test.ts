/**
 * The time-repair dialog, read as source rather than rendered.
 *
 * **What this asserts.** That the dialog's five load-bearing decisions are
 * still in the file: that only `repairable(plan)` ever reaches
 * `writeTimeRepair`, that the button's count is that same list's length rather
 * than the whole plan's, that the blocked lines are drawn under a heading of
 * their own instead of as another status in the repair list, that the dialog
 * says it is reading before it has a plan, and that `plan.unreadable` is named
 * rather than dropped. Plus that the four blocker sentences exist in both
 * locales and that the `moves-day` one names both notes.
 *
 * **What this does not assert.** That any of it renders. Nothing in this
 * package renders a modal: vitest runs in `node`, and `tests/obsidian-stub.ts`
 * is three exports with no `Modal`, no `Setting` and no DOM. So a broken
 * layout, a button that never enables and a heading in the wrong place would
 * all pass here. `tests/report-collapse.test.ts` and the source half of
 * `tests/stylesheet.test.ts` are the precedent and carry the same caveat: these
 * pin the shape of the guards, and the dialog itself was checked by opening it.
 *
 * The behaviour underneath is covered for real in `tests/repair-times.test.ts`,
 * which drives `planTimeRepair` and `writeTimeRepair` against a fake vault.
 * This file is only about what the dialog does with their answers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enTranslations } from '../src/lang/translations/en';
import { deTranslations } from '../src/lang/translations/de';

const SRC = join(__dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const modal = read('plan', 'ui', 'repair-times-modal.ts');
const main = read('main.ts');

/** The text between a call's opening parenthesis and the line that closes it. */
function callArguments(source: string, call: string): string {
  const from = source.indexOf(call);
  expect(from).toBeGreaterThan(-1);
  const to = source.indexOf(');', from);
  expect(to).toBeGreaterThan(from);
  return source.slice(from + call.length, to);
}

/** One method's body, from its signature to the start of the next one. */
function method(source: string, signature: string): string {
  const from = source.indexOf(signature);
  expect(from).toBeGreaterThan(-1);
  const to = source.indexOf('\n  private ', from + signature.length);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('what the dialog hands to the writer', () => {
  /**
   * The one that matters. `writeTimeRepair` skips a blocked repair itself, so
   * passing the whole plan would not corrupt a note -- but it would make the
   * dialog's count a lie and put the guard in one place instead of two, and the
   * whole point of the blocked list is that those lines are somebody else's
   * work.
   */
  it('passes only the repairable ones, never the whole plan', () => {
    const args = callArguments(modal, 'writeTimeRepair(');
    expect(args).toContain('ready');
    expect(args).not.toContain('plan.repairs');
    expect(modal).toContain('const ready = repairable(plan);');
  });

  it('takes the repairable list from `repairable` rather than filtering by hand', () => {
    // A hand-rolled `filter(r => r.blocker === null)` here would be a second
    // copy of the rule `repairable` already states, and the two would drift the
    // day a fifth blocker is added.
    expect(modal).not.toMatch(/filter\([^)]*blocker === null/);
    expect(modal).toContain('import {\n  planTimeRepair,\n  repairable,\n  writeTimeRepair,');
  });
});

describe('the action button', () => {
  it('counts the lines it will correct, not the rows on screen', () => {
    const footer = method(modal, 'private renderFooter(ready: readonly TimeRepair[]): void {');
    expect(footer).toContain("t('calendar.repair.button', { count: String(ready.length) })");
    expect(footer).not.toContain('plan.repairs');
  });

  it('is handed the repairable list and nothing wider, at every call site', () => {
    // Two call sites: the busy pass, which has nothing to offer yet, and the
    // drawn plan. Neither may hand it `plan.repairs`, or the number on the
    // button would include lines the writer refuses.
    expect(modal).toContain('this.renderFooter([]);');
    expect(modal).toContain('this.renderFooter(ready);');
    expect(modal).not.toContain('this.renderFooter(plan.repairs)');
  });

  it('is dead when there is nothing to correct and while the plan is being built', () => {
    const footer = method(modal, 'private renderFooter(ready: readonly TimeRepair[]): void {');
    expect(footer).toContain('.setDisabled(ready.length === 0 || this.busy)');
  });

  it('sits outside the scrolling body, so a long list cannot carry it off screen', () => {
    expect(modal).toContain("this.body = contentEl.createDiv({ cls: 'nod-import-body' });");
    expect(modal).toContain("this.footer = contentEl.createDiv({ cls: 'nod-import-footer' });");
    // Drawn into `this.footer`, which `render()` never empties along with the body.
    expect(modal).toContain('new Setting(footer)');
  });
});

describe('the blocked lines', () => {
  /**
   * Separately, under their own heading. Folded into the repair list with a
   * status column they would read as things that are about to happen, and the
   * `moves-day` ones are precisely the ones that are not.
   */
  it('are drawn by their own method under their own heading', () => {
    const blocked = method(
      modal,
      'private renderBlocked(parent: HTMLElement, blocked: readonly TimeRepair[]): void {'
    );
    expect(blocked).toContain("t('calendar.repair.blockedHeading'");
    expect(blocked).toContain("createEl('h3'");
    expect(blocked).toContain('reasonFor(repair)');
  });

  it('are the plan minus the repairable ones, so nothing falls between the two lists', () => {
    expect(modal).toContain(
      'const blocked = plan.repairs.filter((repair) => repair.blocker !== null);'
    );
  });

  it('go to the second list and the repairs to the first, each given its own half', () => {
    // Asserted at the call sites as well as inside the methods. Handing the
    // whole plan to `renderRepairs` would fold the blocked lines back in
    // without either method changing a character.
    expect(modal).toContain('this.renderRepairs(body, ready);');
    expect(modal).toContain('this.renderBlocked(body, blocked);');
  });

  it('are never drawn by the repair list, which iterates the repairable ones', () => {
    const repairs = method(
      modal,
      'private renderRepairs(parent: HTMLElement, ready: readonly TimeRepair[]): void {'
    );
    expect(repairs).toContain('for (const repair of ready)');
    expect(repairs).not.toContain('plan.repairs');
    expect(repairs).not.toContain('blocked');
  });

  it('say why in a sentence, one per blocker', () => {
    expect(modal).toContain("case 'moves-day':");
    expect(modal).toContain("case 'not-found':");
    expect(modal).toContain("case 'ambiguous':");
    expect(modal).toContain("t('calendar.repair.notEditable')");
  });
});

describe('the preview around the list', () => {
  it('says it is reading before it has a plan to show', () => {
    // Four archived exports and thousands of events. A dialog that opened on an
    // empty box would look broken for as long as that takes.
    expect(modal).toContain("text: t('calendar.repair.reading')");
    expect(modal).toContain('this.plan = await planTimeRepair(');
    expect(modal.indexOf("t('calendar.repair.reading')")).toBeLessThan(
      modal.indexOf('this.plan = await planTimeRepair(')
    );
  });

  it('leads with what will happen, before any row', () => {
    expect(modal.indexOf("t('calendar.repair.intro'")).toBeLessThan(
      modal.indexOf('this.renderRepairs(body, ready);')
    );
  });

  it('names the archived files it could not read', () => {
    expect(modal).toContain('plan.unreadable.length === 0) return;');
    expect(modal).toContain("files: plan.unreadable.join(', ')");
  });

  it('says so plainly when there is nothing to repair, rather than drawing an empty list', () => {
    expect(modal).toContain("emptyState(body, t('calendar.repair.nothing'));");
    expect(modal).toContain('if (plan.repairs.length === 0) {');
  });

  it('names the refusals in the notice, because a refusal means the note moved under it', () => {
    expect(modal).toContain('if (result.refused.length > 0)');
    expect(modal).toContain(
      "t('calendar.repair.refused', { count: String(result.refused.length) })"
    );
  });
});

describe('the command', () => {
  it('is registered beside the calendar import', () => {
    expect(main).toContain("id: 'repair-calendar-times'");
    expect(main).toContain("name: t('calendar.repair.title')");
    expect(main.indexOf("id: 'import-calendar'")).toBeLessThan(
      main.indexOf("id: 'repair-calendar-times'")
    );
  });
});

describe('the strings a person reads', () => {
  const keys = [
    'title',
    'reading',
    'intro',
    'heading',
    'blockedHeading',
    'movesDay',
    'notFound',
    'ambiguous',
    'notEditable',
    'unreadable',
    'nothing',
    'noneRepairable',
    'button',
    'done',
    'refused',
  ] as const;

  it('exist in both locales', () => {
    for (const key of keys) {
      expect(typeof enTranslations.calendar.repair[key]).toBe('string');
      expect(typeof deTranslations.calendar.repair[key]).toBe('string');
    }
  });

  /**
   * The `moves-day` sentence has a job the others do not: it is the only one
   * that asks for something to be done, and it cannot be acted on without both
   * note names. A version that said "this line has to move" and stopped there
   * would send somebody hunting.
   */
  it('name both notes in the sentence about a line that has to move', () => {
    for (const table of [enTranslations, deTranslations]) {
      expect(table.calendar.repair.movesDay).toContain('{day}');
      expect(table.calendar.repair.movesDay).toContain('{wanted}');
    }
  });

  it('promise in the lead sentence that nothing is removed', () => {
    expect(enTranslations.calendar.repair.intro).toMatch(/nothing is added/i);
    expect(enTranslations.calendar.repair.intro).toMatch(/nothing is deleted/i);
    expect(deTranslations.calendar.repair.intro).toMatch(/nichts wird geloescht/i);
  });

  /**
   * The `calendar` block is written without umlauts, and this is part of it.
   * Mixing the two spellings inside one block is how a search for a string in
   * the German table starts missing half of them.
   */
  it('keep the calendar block free of umlauts', () => {
    const german = Object.values(deTranslations.calendar.repair).join(' ');
    expect(german).not.toMatch(/[äöüÄÖÜß]/);
  });
});
