/**
 * A view may not empty its container and then go to disk.
 *
 * The bug, reported from a real vault: saving a price on a meal put the whole
 * meal on screen twice, and any redraw put it right again. Three things ask the
 * meal view to redraw -- `setViewData`, the metadata cache, and the plugin's own
 * change signal -- and a save trips at least two within a few milliseconds.
 *
 * `render()` emptied the container on its first line and built the meal after
 * two awaits. So the second render emptied a container the first had not drawn
 * into yet, both reads finished, and both passes appended their own copy. The
 * window is exactly as long as the reads take, which is why it was sporadic.
 *
 * The rule that closes it: **between emptying a container and drawing into it
 * there must be no await.** Either build first and await afterwards, as the
 * sibling views do, or empty late once the reads are done, which is what the
 * meal view now does and which also removes the blank flash while it reads.
 *
 * A source test, over every method in the package rather than over the one that
 * was wrong: the shape is easy to reintroduce and impossible to see in a diff.
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

const METHOD = /^ {2}(?:(?:private|protected|public|async|override|abstract|static|\s)*)(\w+)\(/;

/**
 * Every class method, bounded by its own closing brace.
 *
 * Bounded rather than read to the next `.empty()`, because a `clear()` that
 * empties and returns would otherwise be measured against awaits three methods
 * further down and reported as a race it cannot have.
 */
function methods(text: string): { name: string; body: string }[] {
  const lines = text.split('\n');
  return lines.flatMap((line, start) => {
    const match = METHOD.exec(line);
    if (!match) return [];
    let end = start + 1;
    while (end < lines.length && lines[end] !== '  }') end++;
    return [{ name: match[1] ?? '', body: lines.slice(start, end).join('\n') }];
  });
}

/**
 * True when the method empties something, then awaits, and only then draws.
 *
 * Every `.empty()` in the method is checked, each against the stretch up to the
 * next one. Checking only the first would report the meal view's own guard
 * clause -- the `empty(); return;` for a view with no file -- against the reads
 * three lines below it, which is not a window anything can slip through.
 */
function emptiesThenAwaits(body: string): boolean {
  const positions = [...body.matchAll(/\.empty\(\);/g)].map((match) => match.index);

  return positions.some((from, index) => {
    const stretch = body.slice(from, positions[index + 1] ?? body.length);
    const awaited = stretch.indexOf('await ');
    const drawn = /\.create(Div|El|Span)\(/.exec(stretch);
    return awaited !== -1 && drawn !== null && awaited < drawn.index;
  });
}

describe('a view that redraws', () => {
  it('never empties its container before going to disk', () => {
    const racing = sources(SRC).flatMap((file) =>
      methods(file.text)
        .filter((method) => emptiesThenAwaits(method.body))
        .map((method) => `${file.path}: ${method.name}()`)
    );

    expect(racing).toEqual([]);
  });

  it('is looking at the meal view, which is where this was found', () => {
    const meal = sources(SRC).find((file) => file.path === 'meals/view/meal-view.ts');

    expect(methods(meal?.text ?? '').map((method) => method.name)).toContain('render');
  });

  /**
   * The other half of the fix. Emptying late is not enough on its own: both
   * passes would still reach the drawing, and the second would wipe the first
   * and redraw the same meal for no reason. The token is what makes the
   * overtaken pass stop.
   */
  it('stops the overtaken render before it touches the screen', () => {
    const meal = sources(SRC).find((file) => file.path === 'meals/view/meal-view.ts')?.text ?? '';

    expect(meal).toContain('const token = ++this.renderToken;');
    expect(meal).toMatch(
      /if \(token !== this\.renderToken\) return;\s*\n\s*this\.contentEl\.empty\(\);/
    );
  });
});
