/**
 * A name is folded once, by `caseFold`, and nowhere else by hand.
 *
 * macOS writes an umlaut two ways, and the two spellings compare unequal. The
 * bug that produced this test was live in a real vault: 40 meal notes whose file
 * name was decomposed, every plan entry naming one of them resolving to nothing,
 * and the only symptom a row that rendered without its picture. `resolveByTitle`
 * was keyed on a file's basename and looked up with text out of somebody's
 * frontmatter, the two sides normalized differently, and nothing in three
 * packages normalized at all: 65 places trimmed and lower-cased on their own.
 *
 * **So this is the fifth root test, and it is here rather than in each package**
 * for the reason the em-dash rule is: it is a statement about the repository. A
 * plugin that grew its own copy would be a plugin that can disagree about what
 * two names being the same means, which is the whole failure.
 *
 * Two shapes are findings, and the second is the one worth explaining:
 *
 * - **`trim()` and `toLowerCase()` on the same value**, in either order. That
 *   pair IS the fold, minus the composing, so writing it out is writing a second
 *   fold that forgot the part this test exists for.
 * - **`toLowerCase()` on anything whose last name reads as a title or a name.**
 *   `area.title.toLowerCase()` carried the bug without a `trim()` anywhere near
 *   it, and a rule that only knew the pair above would have passed it. A heading,
 *   a search query, an appliance or a tag is left alone deliberately: those are
 *   compared against literals this repository owns, and folding them is welcome
 *   but not enforceable without an exemption list, which is the thing that rots.
 *
 * **Read with the compiler, not with a regex.** A finding is a call expression,
 * so a comment naming `trim().toLowerCase()` (this one does, twice) and a string
 * containing it are outside the sweep by construction, and no exemption is needed
 * for the prose that states the rule. The one file that may write the fold out is
 * the one that exports it, recognised by exporting it rather than by its path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(__dirname, "..");
const PACKAGES = join(ROOT, "packages");
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "vendor",
  "claude-project-bundle",
]);

/** What the fold is called, and the only identifier allowed to do the lowering. */
const FOLD = "caseFold";

/**
 * A tail that means "this is a name somebody typed", and may not be lowered by hand.
 *
 * Anything ending in name or title, in any casing: `title`, `areaTitle`,
 * `goalTitles`, `companyName`, `basename`. Deliberately a suffix rather than a
 * word boundary, because `companyName` has no boundary to find and was the
 * shape that got through the first draft of this rule.
 */
const NAMELIKE = /(title|titles|name|names)$/i;

interface Finding {
  file: string;
  line: number;
  text: string;
  why: string;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extname(entry.name) === ".ts") out.push(path);
    }
  };
  walk(dir);
  return out;
}

function packageDirs(): string[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES, entry.name));
}

/** The method a call expression invokes, or null when it invokes no method. */
function calledMethod(node: ts.Expression): string | null {
  if (!ts.isCallExpression(node)) return null;
  const target = node.expression;
  return ts.isPropertyAccessExpression(target) ? target.name.text : null;
}

/**
 * The last name in a member expression, which is what says what is being lowered.
 *
 * `goal.note.areaTitle` answers `areaTitle`, `titles[i]` answers `titles`, and
 * `entry.title.trim()` answers `trim`, which is the pair rule's business rather
 * than this one's.
 */
function tailName(node: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isElementAccessExpression(node)) return tailName(node.expression);
  if (ts.isNonNullExpression(node) || ts.isParenthesizedExpression(node)) {
    return tailName(node.expression);
  }
  if (ts.isCallExpression(node)) return calledMethod(node);
  return null;
}

/** True for the one module that may spell the fold out: the one that exports it. */
function definesTheFold(text: string): boolean {
  return new RegExp(`export function ${FOLD}\\b`).test(text);
}

function findingsIn(path: string): Finding[] {
  const text = readFileSync(path, "utf8");
  if (definesTheFold(text)) return [];

  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const found: Finding[] = [];

  const report = (node: ts.Node, why: string): void => {
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    found.push({
      file: relative(ROOT, path),
      line,
      text: text.split("\n")[line - 1].trim().slice(0, 90),
      why,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = calledMethod(node);
      const receiver = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression
        : null;
      const inner = receiver ? calledMethod(receiver) : null;

      const pair =
        (method === "toLowerCase" && inner === "trim") ||
        (method === "trim" && inner === "toLowerCase");

      if (pair) {
        report(node, `lowers a trimmed value by hand: use ${FOLD}()`);
      } else if (method === "toLowerCase" && receiver) {
        const tail = tailName(receiver);
        if (tail && NAMELIKE.test(tail)) {
          report(node, `lowers a name by hand: use ${FOLD}()`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

const SOURCE_FILES = packageDirs().flatMap((dir) => filesUnder(join(dir, "src")));

const report = (findings: Finding[]): string[] =>
  findings.map((f) => `${f.file}:${f.line}  ${f.why}\n    ${f.text}`);

describe("the name-fold rule", () => {
  it("reads a meaningful number of files", () => {
    // A walk that stops finding files reports nothing, which looks exactly like
    // a repository in good order.
    expect(SOURCE_FILES.length).toBeGreaterThan(200);
  });

  it("finds the module that owns the fold, exactly once", () => {
    // The structural exemption. If the fold moves, is renamed, or is copied into
    // a second package, this is what says so.
    const owners = SOURCE_FILES.filter((path) =>
      definesTheFold(readFileSync(path, "utf8")),
    ).map((path) => relative(ROOT, path));

    expect(owners).toEqual(["packages/core/src/text/case-fold.ts"]);
  });

  it("is kept in every package source file", () => {
    expect(report(SOURCE_FILES.flatMap(findingsIn))).toEqual([]);
  });
});

/** The sweep is only worth its run time if it can fail. These are the shapes it must catch. */
describe("what the rule catches, and what it leaves alone", () => {
  const scan = (code: string): Finding[] => {
    const path = join(PACKAGES, "nowhere", "src", "sample.ts");
    const source = ts.createSourceFile(
      path,
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    // Same walk as above, against text rather than a file. Kept in step by
    // calling the same helpers.
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const method = calledMethod(node);
        const receiver = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.expression
          : null;
        const inner = receiver ? calledMethod(receiver) : null;
        if (
          (method === "toLowerCase" && inner === "trim") ||
          (method === "trim" && inner === "toLowerCase")
        ) {
          out.push("pair");
        } else if (method === "toLowerCase" && receiver) {
          const tail = tailName(receiver);
          if (tail && NAMELIKE.test(tail)) out.push("name");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return out as unknown as Finding[];
  };

  it("catches the pair in either order", () => {
    expect(scan("const k = value.trim().toLowerCase();")).toEqual(["pair"]);
    expect(scan("const k = value.toLowerCase().trim();")).toEqual(["pair"]);
  });

  it("catches a name lowered on its own, which is how the bug shipped", () => {
    expect(scan("if (area.title.toLowerCase() === wanted) return area;")).toEqual(["name"]);
    expect(scan("const k = record.companyName.toLowerCase();")).toEqual(["name"]);
    expect(scan("const set = new Set(known.map((e) => e.titles.toLowerCase()));")).toEqual(["name"]);
  });

  it("leaves the fold's own callers alone", () => {
    expect(scan("const k = caseFold(area.title);")).toEqual([]);
  });

  it("leaves a heading, a query and a tag alone, deliberately", () => {
    // Compared against literals this repository owns, so the two sides cannot
    // drift apart the way a file name and a pasted title can. Folding them is
    // welcome; requiring it would need a list of what counts as a name, and a
    // list is what goes stale.
    expect(scan("if (heading.toLowerCase() === 'queue') return true;")).toEqual([]);
    expect(scan("const q = this.query.toLowerCase();")).toEqual([]);
  });

  it("is not fooled by a comment or a string that names the shape", () => {
    expect(scan("// never write title.trim().toLowerCase() by hand")).toEqual([]);
    expect(scan("const advice = 'use caseFold, not trim().toLowerCase()';")).toEqual([]);
  });
});
