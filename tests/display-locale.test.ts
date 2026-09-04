/**
 * No plugin formats a number or a date in the machine's convention.
 *
 * **This is the test the defect needed, and the reason it is a test at all.**
 * `formatMoney` has taken a `locale` since the day it was written, with a
 * header explaining exactly why -- a Swiss household running a Mac set to
 * German is shown `100.120,20` where it writes `100'120.20`, and the two
 * disagree about what a dot means. Not one of the forty call sites ever passed
 * one. The parameter, the reasoning and the fallback were all correct and all
 * unreachable, which is this codebase's most frequent defect.
 *
 * Nothing in a build has an opinion about an argument that was not passed. So
 * the rule is structural instead: **a plugin may not reach the core formatters
 * or `Intl`'s own default directly.** It goes through its own display module,
 * which holds the vault's setting, and a call site that forgets is a call site
 * that fails here rather than one that quietly draws the wrong convention.
 *
 * Two allowances, both narrow and both stated:
 *
 * - **The display module itself** is the one file that may call the core
 *   formatters, since binding them is what it is for.
 * - **A locale named as a literal** is not a default. `sun-band.ts` formats
 *   with `en-CA` to read a date back, which is parsing rather than display and
 *   must not follow anybody's convention.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PACKAGES = join(ROOT, "packages");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "vendor"]);

/** Each plugin's display module: the one file allowed to bind the formatters. */
const DISPLAY_MODULES = [
  join("apertrail", "src", "shared", "display.ts"),
  join("culitrail", "src", "shared", "display.ts"),
  join("nodatrail", "src", "ui", "kit", "format.ts"),
];

/** The core formatters that take a locale, and therefore need one supplied. */
const BOUND = [
  "formatMoney",
  "formatMoneyOrNull",
  "formatLongDate",
  "formatMediumDate",
  "formatShortDate",
  "formatMonthName",
  "formatClock",
];

interface Finding {
  file: string;
  line: number;
  text: string;
}

function pluginFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extname(entry.name) === ".ts") out.push(path);
    }
  };
  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "core")
      walk(join(PACKAGES, entry.name, "src"));
  }
  return out;
}

const FILES = pluginFiles();
const isDisplayModule = (path: string): boolean =>
  DISPLAY_MODULES.some((suffix) => path.endsWith(suffix));

function findingsIn(path: string, pattern: RegExp): Finding[] {
  const lines = readFileSync(path, "utf8").split("\n");
  return lines.flatMap((text, index) =>
    pattern.test(text)
      ? [
          {
            file: relative(ROOT, path),
            line: index + 1,
            text: text.trim().slice(0, 90),
          },
        ]
      : [],
  );
}

const lineOf = (text: string, index: number): number =>
  text.slice(0, index).split("\n").length;

/**
 * Every call to `name` in a source file, with its argument text.
 *
 * Parenthesis matching rather than a regex, because a nested call or a call
 * broken over three lines defeats anything simpler, and both are ordinary here.
 * Crude about strings and comments on purpose: a stray bracket in either can
 * only make a call look longer than it is, which over-reports rather than
 * under-reports, and this test is only useful if it errs that way.
 */
function callsTo(source: string, name: string): { at: number; args: string }[] {
  const calls: { at: number; args: string }[] = [];
  const opener = new RegExp(`\\b${name}\\(`, "g");

  for (const match of source.matchAll(opener)) {
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          calls.push({
            at: match.index,
            args: source.slice(match.index + match[0].length, i),
          });
          break;
        }
      }
    }
  }

  return calls;
}

const report = (findings: Finding[]): string[] =>
  findings.map((f) => `${f.file}:${f.line}  ${f.text}`);

describe("the display locale", () => {
  it("reads a meaningful number of plugin files", () => {
    expect(FILES.length).toBeGreaterThan(300);
    for (const suffix of DISPLAY_MODULES) {
      expect(
        FILES.some((path) => path.endsWith(suffix)),
        suffix,
      ).toBe(true);
    }
  });

  /**
   * A file may reach a core formatter directly, but then it has to supply the
   * locale in the call. Two do: CULItrail's dish price and NODAtrail's period
   * names both format through the core and pass the active locale, which is
   * correct and is not worth a wrapper each.
   *
   * So the rule is about the CALL, not the import. The argument list is read by
   * matching the call's parentheses rather than by a regex, because these calls
   * wrap across lines and a line-based check would pass every one of them by
   * looking at the wrong half.
   */
  it("never calls a core formatter without giving it a locale", () => {
    const findings: Finding[] = [];

    for (const path of FILES.filter((file) => !isDisplayModule(file))) {
      const source = readFileSync(path, "utf8");
      const fromCore = source
        .split("\n")
        .filter((line) => /^import .*\bfrom 'trail-core'/.test(line))
        .join(" ");
      const direct = BOUND.filter((name) =>
        new RegExp(`\\b${name}\\b`).test(fromCore),
      );
      if (direct.length === 0) continue;

      for (const name of direct) {
        for (const call of callsTo(source, name)) {
          if (call.args.includes("activeDisplayLocale")) continue;
          findings.push({
            file: relative(ROOT, path),
            line: lineOf(source, call.at),
            text: `${name}(${call.args.replace(/\s+/g, " ").slice(0, 60)})`,
          });
        }
      }
    }

    expect(report(findings)).toEqual([]);
  });

  it("is not bypassed by letting Intl choose", () => {
    // `toLocaleDateString(undefined` and friends are the machine's convention
    // spelled out. That is what every one of these call sites said before.
    const machineDefault =
      /\.toLocale(Date|Time)String\(\s*undefined|new Intl\.(DateTimeFormat|NumberFormat)\(\s*[),]/;
    const findings = FILES.filter((path) => !isDisplayModule(path)).flatMap(
      (path) => findingsIn(path, machineDefault),
    );

    expect(report(findings)).toEqual([]);
  });

  it("gives all three plugins the same setting, from the shared contract", () => {
    for (const plugin of ["apertrail", "culitrail", "nodatrail"]) {
      const defaults = readFileSync(
        join(PACKAGES, plugin, "src/settings/defaults.ts"),
        "utf8",
      );
      expect(defaults, plugin).toContain(
        "displayLocale: DISPLAY_CONTRACT.displayLocale",
      );
    }
  });
});
