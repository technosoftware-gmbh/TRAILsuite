/**
 * Three things a project card can say about a picture, and why they are three.
 *
 * They were two. A note with no picture and a note naming a picture the vault
 * could not find drew the same empty panel, so a broken `image:` was
 * indistinguishable from an empty one and the only way to tell them apart was to
 * run the health check. Reported from a real vault, where an attachment that had
 * not finished syncing looked exactly like a project nobody had chosen a picture
 * for -- and it took an investigation rather than a glance.
 *
 * The third state is the family fallback, which arrived at the same time: a note
 * with no picture of its own takes its family's, so fifteen company projects
 * need one file rather than fifteen edits.
 *
 * **A broken value does not fall back.** That is the rule holding the three
 * apart: if a wrong path quietly showed the family default, the missing panel
 * could never appear and the fault would be invisible again -- which is the bug
 * this was written to close, reintroduced by the fix for it.
 *
 * A source test over `projectPicture`, because the branch is the whole subject
 * and rendering it needs a DOM these suites do not have.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const strips = readFileSync(join(SRC, 'ui', 'dashboard', 'para-strips.ts'), 'utf8');
const cards = readFileSync(join(SRC, 'ui', 'dashboard', 'cards.ts'), 'utf8');

/** `projectPicture`, from its signature to the end of the function. */
function decision(): string {
  const from = strips.indexOf('function projectPicture(');
  expect(from).toBeGreaterThan(-1);
  const end = strips.indexOf('\n}', from);
  return strips.slice(from, end === -1 ? undefined : end);
}

describe('what a project card shows where the picture goes', () => {
  it('draws the note’s own picture when it resolves', () => {
    expect(decision()).toContain('const resolved = deps.imageOf(own);');
    expect(decision()).toContain('return resolved ? { image: resolved }');
  });

  it('reports the value when the note names a picture that does not resolve', () => {
    expect(decision()).toMatch(/missingImage: own/);
  });

  it('falls back to the family only when the note names none', () => {
    const body = decision();
    const fallback = body.indexOf('deps.defaultProjectImage(');
    const guard = body.indexOf('if (own) {');

    expect(fallback).toBeGreaterThan(-1);
    // After the `if (own)` block returns, so a note with its own value can
    // never reach the fallback whatever that value turned out to be.
    expect(guard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(guard);
  });

  /**
   * The rule that keeps the missing panel reachable. A fallback offered to a
   * note whose own value failed would swallow every broken path.
   */
  it('never offers the family fallback for a broken value', () => {
    const body = decision();
    const own = body.slice(
      body.indexOf('if (own) {'),
      body.indexOf('return { image: deps.imageOf')
    );

    expect(own).not.toContain('defaultProjectImage');
  });
});

describe('the card', () => {
  it('tells a missing picture apart from no picture at all', () => {
    expect(cards).toContain("'nod-dashboard-hero-empty nod-dashboard-hero-missing'");
    expect(cards).toContain("setIcon(empty.createSpan({ cls: 'nod-icon' }), 'image-off')");
  });

  it('says on the card what the note named, rather than only in the health check', () => {
    expect(cards).toContain("t('para.imageMissing', { value })");
    expect(cards).toContain("empty.setAttr('title'");
  });

  /**
   * A picture that resolves and then will not decode is the same fact as one
   * that never resolved: named, and not on screen. It used to fall back to the
   * plain empty panel, which is how a half-synced attachment read as a project
   * with no picture.
   */
  it('treats a picture that will not decode as missing rather than as absent', () => {
    const handler = cards.slice(cards.indexOf("image.addEventListener('error'"));

    expect(handler.slice(0, 200)).toContain('missing(slot');
    expect(handler.slice(0, 200)).not.toContain('placeholder(slot');
  });

  it('leaves a note that names no picture with the plain panel', () => {
    expect(cards).toContain('} else if (options.missingImage !== undefined) {');
    expect(cards).toContain('placeholder(slot, options.fallbackIcon);');
  });
});
