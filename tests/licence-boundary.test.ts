/**
 * No package reaches into another package's source.
 *
 * This is the one rule a monorepo makes easy to break. The four packages ship
 * under three different licences: `core` is MIT, `culitrail` is
 * GPL-3.0-or-later because it carries inherited Recipe Box code, and
 * `apertrail` and `nodatrail` are PolyForm Noncommercial. In four separate
 * repositories that
 * boundary was enforced by the filesystem. In one repository it is one relative
 * path away, and an import that crosses it does not fail to compile, does not
 * fail a test, and does not look wrong in a diff.
 *
 * So the rule is checked rather than trusted: **a file may import its own
 * package, a published dependency, or `trail-core`, and nothing else.** The
 * direction that matters most is `culitrail` into either PolyForm package,
 * since that would pull GPL code into a package that must not carry it, but the
 * check is symmetric because a licence boundary that only holds in one
 * direction is not a boundary.
 *
 * `trail-core` is the exception by design: MIT flows into all three of the
 * others, and none of them flows back.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const PACKAGES_DIR = join(__dirname, "..", "packages");

/** The package names, read from disk rather than listed, so a new one is covered. */
const PACKAGE_NAMES = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

interface SourceFile {
  path: string;
  packageName: string;
  source: string;
}

function sourceFiles(): SourceFile[] {
  const files: SourceFile[] = [];
  for (const packageName of PACKAGE_NAMES) {
    for (const sub of ["src", "tests", "scripts"]) {
      const root = join(PACKAGES_DIR, packageName, sub);
      let entries;
      try {
        entries = readdirSync(root, { recursive: true, withFileTypes: true });
      } catch {
        continue; // Not every package has every one of those folders.
      }
      for (const entry of entries) {
        if (!entry.isFile() || !/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
        const path = join(entry.parentPath, entry.name);
        files.push({ path, packageName, source: readFileSync(path, "utf8") });
      }
    }
  }
  return files;
}

/** Every module specifier a file imports from, however it phrases it. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

describe("licence boundary", () => {
  const files = sourceFiles();

  it("finds the packages and their source", () => {
    // A guard on the guard: an empty walk would pass every assertion below.
    expect(PACKAGE_NAMES.sort()).toEqual([
      "apertrail",
      "core",
      "culitrail",
      "nodatrail",
    ]);
    expect(files.length).toBeGreaterThan(250);
  });

  it("never resolves a relative import outside its own package", () => {
    const escapes: string[] = [];
    for (const { path, packageName, source } of files) {
      const packageRoot = join(PACKAGES_DIR, packageName);
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.startsWith(".")) continue;
        const target = resolve(dirname(path), specifier);
        const outside = relative(packageRoot, target);
        if (outside.startsWith(".." + sep) || outside === "..") {
          escapes.push(`${relative(PACKAGES_DIR, path)} imports ${specifier}`);
        }
      }
    }
    expect(escapes).toEqual([]);
  });

  it("never names another package as a dependency", () => {
    const forbidden = PACKAGE_NAMES.filter((name) => name !== "core");
    const crossings: string[] = [];
    for (const { path, packageName, source } of files) {
      for (const specifier of importSpecifiers(source)) {
        for (const other of forbidden) {
          if (other === packageName) continue;
          if (specifier === other || specifier.startsWith(`${other}/`)) {
            crossings.push(
              `${relative(PACKAGES_DIR, path)} imports ${specifier}`,
            );
          }
        }
      }
    }
    expect(crossings).toEqual([]);
  });

  it("lets every plugin depend on the core and none depend on another", () => {
    for (const packageName of ["culitrail", "apertrail", "nodatrail"]) {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGES_DIR, packageName, "package.json"), "utf8"),
      ) as { dependencies?: Record<string, string> };
      const dependencies = Object.keys(manifest.dependencies ?? {});
      expect(dependencies).toContain("trail-core");
      for (const sibling of ["culitrail", "apertrail", "nodatrail"]) {
        if (sibling === packageName) continue;
        expect(dependencies).not.toContain(sibling);
      }
    }
  });

  it("keeps each package licence stated in its own manifest and file", () => {
    const expected: Record<string, string> = {
      core: "MIT",
      culitrail: "GPL-3.0-or-later",
      // SPDX identifiers, which is what the `license` field is read as. The
      // human spelling of this one lives in the About section of the settings
      // page, where a person reads it.
      apertrail: "PolyForm-Noncommercial-1.0.0",
      nodatrail: "PolyForm-Noncommercial-1.0.0",
    };
    for (const [packageName, licence] of Object.entries(expected)) {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGES_DIR, packageName, "package.json"), "utf8"),
      ) as { license?: string };
      expect(manifest.license, `${packageName} package.json`).toBe(licence);
      // A licence named in a manifest and missing from the tree is a claim
      // without a text behind it.
      expect(readdirSync(join(PACKAGES_DIR, packageName))).toContain("LICENSE");
    }
  });
});
