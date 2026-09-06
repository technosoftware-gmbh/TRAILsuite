/**
 * The repository ships no em dash. This is the test that makes that true.
 *
 * `CLAUDE.md` has forbidden U+2014 in comments, docs and user-facing text since
 * before any of this code existed, and it was broken repeatedly anyway. A rule
 * nothing checks is a preference.
 *
 * **It lives here rather than in each package**, next to the licence boundary,
 * because it is a rule about the repository. CULItrail and NODAtrail each grew
 * their own copy and APERtrail and core never did, which is exactly why an em
 * dash sat in a German editor description and in a `styles.css` comment until
 * somebody grepped for one. Two packages enforcing a house rule is not a house
 * rule. Packages are read from disk, so a fifth is covered the day it exists.
 *
 * Nothing is exempted **by name**. Four structural rules do the work, and each
 * is the kind that cannot quietly rot:
 *
 * - **In TypeScript, only comments are checked**, and not by guessing at them
 *   with a regex, which cannot tell a comment from an apostrophe inside a
 *   string. The TypeScript scanner is asked for its comment trivia. An em dash
 *   in a regex literal or in test data is matching or asserting something,
 *   not being read by anybody.
 * - **In a translation table, every string is checked**, because that is the
 *   one place a string literal IS user-facing text. This is the rule that would
 *   have caught the German description of a leg's carrier field, which shipped
 *   with the character in it and which the comment rule above lets through by
 *   design. Note that the offending text cannot be quoted here: a TypeScript
 *   comment is prose, so backticks do not make it code the way they do in
 *   Markdown, and this file is checked like every other.
 * - **In CSS, only comments are checked.** A stylesheet has no prose except its
 *   comments, and `content:` may legitimately need any character at all.
 * - **In Markdown, code is stripped first.** Fenced blocks and inline spans come
 *   out, then the prose is checked, so a page quoting what some other tool
 *   emitted -- or quoting this rule's own violation -- does so in backticks and
 *   is fine by construction.
 *
 * An en dash is allowed and is what to reach for instead.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join, relative } from "node:path";
// TypeScript 5, declared at the repository root, and the version matters.
//
// This import used to be satisfied by luck. Nothing at the root asked for a
// compiler; typescript-eslint drags in its own TypeScript 5 to satisfy its
// peer range, npm hoists that copy here, and the bare specifier found it. A
// dependency change that stopped hoisting it would have taken this sweep with
// it, and the one thing a rule like this must not do is stop looking quietly.
//
// It cannot be TypeScript 7. The compiler API moved off the package root there
// -- `exports["."]` is `lib/version.cjs`, the version and nothing else -- and
// the scanner now lives behind `typescript/unstable/ast`. The root cannot hold
// 7 anyway: typescript-eslint refuses to run against it, and the root copy is
// the one it resolves. Each package keeps its own 7.0.2 for its own build.
import ts from "typescript";

const EM_DASH = "—";
const ROOT = join(__dirname, "..");
const PACKAGES = join(ROOT, "packages");

/**
 * Directories that are not ours to reformat, or not ours at all.
 *
 * `vendor` is third-party code kept verbatim so it can be re-synced upstream,
 * and is skipped for the same reason the eslint and prettier configs skip it.
 * `claude-project-bundle` is generated from documents that are checked here
 * already, and is gitignored; checking it would report every finding twice and
 * fail on a stale copy nobody edits.
 */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "vendor",
  "claude-project-bundle",
]);

/**
 * The instruction files, which used to be exempt.
 *
 * They were excluded because one of them stated the rule by showing the
 * character. That copy left with CULItrail in September 2026, and the three
 * that remain state it in words, so the exemption had nothing left to protect
 * and this file said what to do about that: widen the sweep. They are checked
 * like every other document now.
 *
 * If one of them ever has to show an em dash again, this is where the
 * exemption goes back, and the test below is what will tell you.
 */
const RULE_FILE = "CLAUDE.md";

interface Finding {
  file: string;
  line: number;
  text: string;
}

function filesUnder(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extensions.includes(extname(entry.name))) out.push(path);
    }
  };

  walk(dir);
  return out;
}

/** The package directories, read from disk so a new one is covered without an edit. */
function packageDirs(): string[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES, entry.name));
}

/** Every `.md` at the top level of one directory. */
function topLevelDocs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
    .map((entry) => join(dir, entry.name));
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function finding(path: string, text: string, index: number): Finding {
  const line = lineOf(text, index);
  return {
    file: relative(ROOT, path),
    line,
    text: text.split("\n")[line - 1].trim().slice(0, 80),
  };
}

/**
 * Scan one TypeScript file, reporting the tokens `wanted` accepts.
 *
 * The scanner rather than a regex: it is the only thing that knows a `//` inside
 * a string is not a comment, and an apostrophe inside a comment is not a string.
 */
function tokenFindings(
  path: string,
  wanted: (kind: ts.SyntaxKind) => boolean,
): Finding[] {
  const text = readFileSync(path, "utf8");
  if (!text.includes(EM_DASH)) return [];

  // Trivia is not skipped: skipping it would skip every comment.
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const findings: Finding[] = [];

  for (
    let kind = scanner.scan();
    kind !== ts.SyntaxKind.EndOfFileToken;
    kind = scanner.scan()
  ) {
    const token = scanner.getTokenText();
    if (!wanted(kind) || !token.includes(EM_DASH)) continue;
    // The offending line, not the token's first line: a block comment is one
    // token, so reporting its start would print `/**` for every finding in a
    // file header and leave somebody hunting for the dash.
    findings.push(
      finding(path, text, scanner.getTokenStart() + token.indexOf(EM_DASH)),
    );
  }

  return findings;
}

const isComment = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.SingleLineCommentTrivia ||
  kind === ts.SyntaxKind.MultiLineCommentTrivia;

const isString = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.StringLiteral ||
  kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
  kind === ts.SyntaxKind.TemplateHead ||
  kind === ts.SyntaxKind.TemplateMiddle ||
  kind === ts.SyntaxKind.TemplateTail;

/** CSS comments, which are the only prose a stylesheet has. */
function cssFindings(path: string): Finding[] {
  const text = readFileSync(path, "utf8");
  if (!text.includes(EM_DASH)) return [];

  const findings: Finding[] = [];
  for (const match of text.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const at = match[0].indexOf(EM_DASH);
    if (at !== -1) findings.push(finding(path, text, match.index + at));
  }
  return findings;
}

/**
 * Markdown prose, with code taken out.
 *
 * Fenced blocks go first so a stray backtick inside one cannot pair with a real
 * inline span outside it. Replaced with spaces of equal length rather than
 * deleted, so a reported line number still points at the right line.
 */
function proseOf(text: string): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, " ");
  return text.replace(/^```[\s\S]*?^```/gm, blank).replace(/`[^`\n]*`/g, blank);
}

function markdownFindings(path: string): Finding[] {
  const text = readFileSync(path, "utf8");
  if (!text.includes(EM_DASH)) return [];

  const prose = proseOf(text);
  const findings: Finding[] = [];
  for (
    let at = prose.indexOf(EM_DASH);
    at !== -1;
    at = prose.indexOf(EM_DASH, at + 1)
  ) {
    findings.push(finding(path, text, at));
  }
  return findings;
}

const report = (findings: Finding[]): string[] =>
  findings.map((f) => `${f.file}:${f.line}  ${f.text}`);

/** Everything the sweeps look at, so a broken walk fails loudly instead of passing vacuously. */
const TS_FILES = packageDirs()
  .flatMap((dir) => [join(dir, "src"), join(dir, "tests")])
  .concat(join(ROOT, "tests"))
  .flatMap((dir) => filesUnder(dir, [".ts"]));

const TRANSLATION_FILES = packageDirs().flatMap((dir) =>
  filesUnder(join(dir, "src", "lang", "translations"), [".ts"]),
);

const CSS_FILES = packageDirs()
  .flatMap((dir) => filesUnder(dir, [".css"]))
  // `snippets/` is shipped CSS a person copies into their own vault, so the
  // house rule applies to it exactly as it does to a plugin's stylesheet.
  .concat(filesUnder(join(ROOT, "snippets"), [".css"]));

const MARKDOWN_FILES = packageDirs()
  .flatMap((dir) => [
    ...filesUnder(join(dir, "docs"), [".md"]),
    ...topLevelDocs(dir),
  ])
  .concat(filesUnder(join(ROOT, "docs"), [".md"]), topLevelDocs(ROOT));

describe("the em-dash rule", () => {
  it("reads a meaningful number of files in every sweep", () => {
    // Guards the walks themselves. A sweep that stops finding files reports no
    // findings, which looks exactly like a repository in good order.
    expect(TS_FILES.length).toBeGreaterThan(300);
    expect(TRANSLATION_FILES.length).toBeGreaterThanOrEqual(6);
    expect(CSS_FILES.length).toBeGreaterThanOrEqual(3);
    expect(MARKDOWN_FILES.length).toBeGreaterThan(30);
  });

  it("is kept in every TypeScript comment", () => {
    expect(
      report(TS_FILES.flatMap((path) => tokenFindings(path, isComment))),
    ).toEqual([]);
  });

  it("is kept in every user-facing string", () => {
    // A translation table is the one place a string literal is prose somebody
    // reads. `legCarrier`'s German description had one and shipped.
    expect(
      report(
        TRANSLATION_FILES.flatMap((path) => tokenFindings(path, isString)),
      ),
    ).toEqual([]);
  });

  it("is kept in every stylesheet comment", () => {
    expect(report(CSS_FILES.flatMap(cssFindings))).toEqual([]);
  });

  it("is kept in the prose of every document", () => {
    expect(report(MARKDOWN_FILES.flatMap(markdownFindings))).toEqual([]);
  });

  it("sweeps the files that state the rule, because none of them shows it", () => {
    // These were exempt while one of them wrote the character out to state the
    // rule. That copy left with CULItrail; the three that remain say it in
    // words. So the exemption is gone and this asserts the two halves of why:
    // they are swept, and none of them needs to be.
    const ruleFiles = packageDirs()
      .map((dir) => join(dir, RULE_FILE))
      .filter((path) => existsSync(path));

    expect(ruleFiles.length).toBeGreaterThan(0);
    expect(
      ruleFiles.every((path) => MARKDOWN_FILES.includes(path)),
      "a CLAUDE.md the sweep does not reach",
    ).toBe(true);
    expect(
      ruleFiles.filter((path) => readFileSync(path, "utf8").includes(EM_DASH)),
    ).toEqual([]);
  });
});

describe("what the rule deliberately allows", () => {
  it("leaves an em dash in TypeScript that is data rather than prose", () => {
    // A parser reading text somebody else wrote has to contain the character to
    // do its job, and a test asserting on such text has to quote it. Both are
    // outside every sweep by construction, which is what keeps this rule from
    // needing an exemption list.
    const data = [
      "const SPLIT = /\\s—\\s/;",
      "expect(clean('a — b')).toBe('a - b');",
      "// A comment, which is checked.",
    ].join("\n");

    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      data,
    );
    const comments: string[] = [];
    for (
      let kind = scanner.scan();
      kind !== ts.SyntaxKind.EndOfFileToken;
      kind = scanner.scan()
    ) {
      if (isComment(kind)) comments.push(scanner.getTokenText());
    }

    expect(comments.join("")).not.toContain(EM_DASH);
  });

  it("has nothing in any package source relying on that allowance", () => {
    // Two files ever did, both in CULItrail: `ingredient-clean.ts` and
    // `detect-durations.ts`, each reading text somebody else wrote. Both went
    // to `trail-core` with the parsers they belonged to, and neither needs the
    // character any more.
    //
    // Asserted rather than dropped, because the allowance above is real and the
    // day something needs it again this should be the thing that fails first.
    // The comment sweep only ever looks inside comments, so a regex is untouched
    // by construction; what this pins is that nothing is currently leaning on
    // that, which is a fact about the repository rather than about the rule.
    const carrying = packageDirs()
      .flatMap((dir) => filesUnder(join(dir, "src"), [".ts"]))
      .filter((path) => readFileSync(path, "utf8").includes(EM_DASH));

    expect(carrying.map((path) => relative(ROOT, path))).toEqual([]);
  });

  it("leaves an em dash inside inline code alone, because it is a quotation", () => {
    const quoting = [
      "# Doc",
      "",
      "The old writer emitted `a — b`, which broke it.",
    ].join("\n");
    expect(proseOf(quoting)).not.toContain(EM_DASH);
  });

  it("leaves a fenced block alone, and keeps line numbers honest while doing it", () => {
    const fenced = [
      "# Doc",
      "",
      "```",
      "a — b",
      "```",
      "",
      `prose ${EM_DASH} here`,
    ].join("\n");
    const prose = proseOf(fenced);

    expect(prose.split("\n")).toHaveLength(7);
    expect(lineOf(prose, prose.indexOf(EM_DASH))).toBe(7);
  });
});
