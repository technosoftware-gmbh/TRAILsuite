/**
 * The stylesheet's own contracts.
 *
 * This suite exists because the same bug has now happened twice. A class name
 * used for two unrelated things gets two rule blocks, the second silently
 * inherits the first's layout, and the result is a view that looks broken in
 * a way nothing points at: `.culi-step` was once a small square button as well
 * as a step `<li>`, so every step in a meal was laid out inside a 1.75rem box
 * and collapsed on top of the next one. Before that, `.rb-badge-row` was
 * declared twice with conflicting rules.
 *
 * Neither is visible in a diff, in a typecheck, or in any other test. A
 * stylesheet is the one file in this repo where two people can name the same
 * thing differently and nothing complains, so it gets a test of its own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BadgeColor } from '../src/settings/types';
import { INVOICE_TOTAL_KINDS } from 'trail-core';
import { STAT_STRIP_VARIANTS } from '../src/ui/stat-strip';

const BADGE_COLORS: BadgeColor[] = ['default', 'green', 'blue', 'purple', 'yellow', 'red'];

const ROOT = join(__dirname, '..');
const CSS = readFileSync(join(ROOT, 'styles.css'), 'utf8');

/**
 * trail-core's source, scanned alongside this plugin's own.
 *
 * The invoice renderer moved into core once a second document needed it, and it
 * still writes `culi-` class names because this stylesheet is the one that ships
 * them. A scanner that looked only at `src/` would report every one of them as
 * an orphan and invite somebody to delete the rules out from under it.
 *
 * The workspace path rather than `node_modules`, so what is scanned is the file
 * being edited rather than whatever was last built.
 */
const CORE_SRC = join(ROOT, '..', 'core', 'src');

/** Class selectors written as a bare rule: `.foo {`, no pseudo, compound or comma. */
function bareRules(): string[] {
  return [...CSS.matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)].map((match) => match[1]);
}

/**
 * Every `culi-` class the source actually puts on an element.
 *
 * Split on whitespace, because `cls: 'culi-banner-cell culi-servings-cell'`
 * is one string carrying two classes and a scanner that missed the second
 * would report it as an orphan.
 */
function classesUsedInSource(): Set<string> {
  const used = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/['`]([^'`]*culi-[^'`]*)['`]/g)) {
        for (const token of match[1].split(/\s+/)) {
          if (/^culi-[a-zA-Z0-9_-]+$/.test(token)) used.add(token);
        }
      }
    }
  };

  walk(join(ROOT, 'src'));
  walk(CORE_SRC);
  return used;
}

describe('the stylesheet', () => {
  it('declares each class in exactly one bare rule', () => {
    // Two bare rules for one name means either a duplicate to merge or, as
    // has happened twice, two different things sharing a name. Both are
    // fixed by renaming or merging; neither should ship.
    const counts = new Map<string, number>();
    for (const name of bareRules()) counts.set(name, (counts.get(name) ?? 0) + 1);

    const duplicated = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => `.${name}`);

    expect(duplicated).toEqual([]);
  });

  it('parses: braces balance and no selector is left dangling', () => {
    // Cheap, and it earned its place immediately: deleting a dead rule with a
    // regex left `.culi-settings-mode-rules,` behind, which silently swallowed
    // the rule after it into a selector list. Neither the duplicate check nor
    // the orphan check sees that, because a dangling selector is not a rule.
    const opens = (CSS.match(/\{/g) ?? []).length;
    const closes = (CSS.match(/\}/g) ?? []).length;
    expect(opens).toBe(closes);

    const dangling = CSS.split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter((entry, index, lines) => {
        if (!entry.line.endsWith(',')) return false;
        // A selector list continues on the next non-blank line. A blank line
        // or a comment after a comma means the rest of the list was removed.
        const next = lines[index + 1]?.line ?? '';
        return next === '' || next.startsWith('/*');
      })
      .map((entry) => `line ${entry.number}: ${entry.line}`);

    expect(dangling).toEqual([]);
  });

  /**
   * The bug this catches has shipped twice.
   *
   * An icon-only button hosts a `setIcon()` svg. Obsidian's `.svg-icon` takes
   * its size from `--icon-size`, which is not defined in every context, so a
   * button that does not size its own svg can render the icon at zero. It looks
   * empty rather than broken, which is why it survives review: the gallery
   * card's overflow button went out that way, and so did the week nav's
   * chevrons.
   *
   * Identified by shape rather than by a hand-kept list, so the next one is
   * caught when it is written. A small square box with `padding: 0` is an
   * icon-only button; anything matching that shape which genuinely holds no
   * icon goes in the exemption list below, with a reason.
   */
  it('sizes the svg of every icon-only button', () => {
    // Holds a text "+", not an icon, so there is no svg to size.
    const NO_ICON = new Set(['culi-mpv-col-add']);

    const sized = new Set(
      [...CSS.matchAll(/^\.([a-zA-Z0-9_-]+)\s+svg\b/gm)].map((match) => match[1])
    );

    const unsized: string[] = [];
    for (const match of CSS.matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/gm)) {
      const [, name, body] = match;
      if (!body.includes('padding: 0;')) continue;

      const width = /\bwidth:\s*([\d.]+)rem/.exec(body);
      const height = /\bheight:\s*([\d.]+)rem/.exec(body);
      if (!width || !height) continue;
      // Bigger than this is a panel that happens to be square, not a button.
      if (Number(width[1]) > 3 || Number(height[1]) > 3) continue;

      if (!sized.has(name) && !NO_ICON.has(name)) unsized.push(`.${name}`);
    }

    expect(unsized).toEqual([]);
  });

  it('sizes a modal through its container, never through its content box', () => {
    // The bug this pins: `.culi-edit-modal` set `width: min(46rem, 90vw)` and
    // `BaseModal` put it on `contentEl`. A width there widens the box inside the
    // dialog while the dialog keeps its own width, so the meal editor drew 364
    // pixels past its own right edge, gained a horizontal scrollbar, and cut off
    // every field in the right-hand half.
    //
    // Three halves to the invariant, and any one alone would let it back in.
    const shell = readFileSync(join(ROOT, 'src/ui/base-modal.ts'), 'utf8');

    // The sizing hook targets modalEl, the dialog itself.
    expect(shell).toMatch(/this\.modalEl\.addClasses\(this\.getModalClasses\(\)\)/);
    // There is no hook putting a caller's classes on contentEl instead.
    expect(shell).not.toContain('getContentClasses');
    // And the one class the shell does put on contentEl declares no width, so
    // contentEl cannot become the sizing lever by another route.
    const contentRule = /^\.culi-modal\s*\{([^}]*)\}/m.exec(CSS)?.[1] ?? '';
    expect(contentRule).not.toBe('');
    expect(contentRule).not.toMatch(/(?:^|[^-\w])width\s*:/);
  });

  /**
   * Anything the app also styles has to be reached two classes deep.
   *
   * This is the rule the toolbar shipped wrong twice. Obsidian styles
   * `input[type='search']` with an attribute selector and its mobile
   * stylesheet reaches `button` the same way, and both outrank a single class:
   * a bare `.culi-toolbar-search { padding-left }` loses its padding, so the
   * placeholder prints under the magnifier, and a bare
   * `.culi-toolbar-icon-btn { width; height; padding }` loses its size, so a
   * row of four buttons comes out four different heights on an iPad and the
   * icon-only ones come out empty.
   *
   * Pinned rather than merely fixed, because the one-class version is exactly
   * what anybody tidying this file would write next.
   */
  it('sizes a toolbar control through a selector that outranks the app', () => {
    for (const name of ['culi-toolbar-search', 'culi-toolbar-icon-btn', 'culi-toolbar-btn']) {
      const bare = new RegExp(String.raw`^\.${name}\s*\{`, 'm');
      expect(CSS, `.${name} must not be sized by a bare one-class rule`).not.toMatch(bare);

      const scoped = new RegExp(
        String.raw`\.culi-toolbar\s+\.${name}[^{]*\{[^}]*(?:height|padding)`
      );
      expect(CSS, `.${name} needs its size through .culi-toolbar`).toMatch(scoped);
    }
  });

  /**
   * The row's own two custom properties are what every size above resolves to,
   * so a mobile override is two declarations rather than a second copy of
   * every rule. If they stop being declared, every control silently falls back
   * to whatever the app says.
   */
  it('declares the control sizes once, and again for a touch screen', () => {
    expect(CSS).toMatch(/^body\s*\{[^}]*--culi-control-height:/m);
    expect(CSS).toMatch(/^body\s*\{[^}]*--culi-control-icon:/m);
    expect(CSS).toMatch(/^body\.is-mobile\s*\{[^}]*--culi-control-height:/m);
  });

  /**
   * Every control that shares a row with another one is the same height.
   *
   * The meal-plan card's header holds a person select, two actions and the
   * week nav, and on a touch screen they came out three different heights:
   * the app sizes a `button` and a `select` for a finger, and each of these
   * had its own idea of how tall it was. They all read the same property now,
   * which is only true for as long as nobody writes another literal height.
   */
  it('sizes every control in a shared row from that one property', () => {
    const controls = [
      'culi-toolbar-icon-btn',
      'culi-toolbar-btn',
      'culi-toolbar-search',
      'culi-week-nav-step',
      'culi-week-nav-label',
      'culi-dashboard-person',
      'culi-mpv-person-select',
    ];

    for (const name of controls) {
      const rule = new RegExp(String.raw`\.${name}\s*\{[^}]*\}`, 'g');
      const bodies = [...CSS.matchAll(rule)].map((match) => match[0]);
      expect(bodies.length, `.${name} has no rule`).toBeGreaterThan(0);

      const sized = bodies.some((body) => /height:\s*var\(--culi-control-height\)/.test(body));
      expect(sized, `.${name} must take its height from --culi-control-height`).toBe(true);
    }
  });

  it('styles no class the source never applies', () => {
    // A rule for a class nothing uses is a rule left behind by a rename, and
    // the next person to reuse that name inherits it by accident. Class names
    // built at runtime are listed here, since a scan cannot see them.
    // Classes composed at runtime, which a scan cannot see. Every entry is
    // derived from the constant that drives it rather than typed out, so a
    // colour or a warning kind added without a rule fails here.
    const RUNTIME_BUILT = new Set([
      ...(['mobile-tabs', 'desktop-classic'] as const).map((id) => `culi-layout-${id}`),
      ...[2, 3, 4, 5, 6].map((level) => `culi-heading-level-${level}`),
      ...BADGE_COLORS.map((color) => `culi-badge-${color}`),
      ...STAT_STRIP_VARIANTS.map((variant) => `culi-stat-strip--${variant}`),
      ...INVOICE_TOTAL_KINDS.map((kind) => `culi-invoice-total-${kind}`),
      // The dashboard's grid spans, built from the span a card asks for.
      ...([4, 8, 12] as const).map((span) => `culi-dashboard-span-${span}`),
    ]);

    const used = classesUsedInSource();
    const orphans = [...new Set(bareRules())]
      .filter((name) => name.startsWith('culi-'))
      .filter((name) => !used.has(name) && !RUNTIME_BUILT.has(name));

    expect(orphans).toEqual([]);
  });
});
