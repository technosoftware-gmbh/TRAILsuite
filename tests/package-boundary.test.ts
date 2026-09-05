/**
 * No package reaches into another package's source.
 *
 * This was `package-boundary.test.ts`, and the licence was the whole argument:
 * four packages under three licences, with a copy from GPL `culitrail` into
 * either PolyForm package the failure worth preventing. That argument is being
 * removed. CULItrail is moving to its own repository, which enforces the
 * licence half by the filesystem, the way it was enforced before the monorepo.
 *
 * The rule stays, on a reason that was always underneath the licence one:
 * **every package has to remain independently buildable and shippable.** Each
 * carries its own manifest, tests, changelog and release, and each is installed
 * into a vault on its own. A package that quietly reads a sibling's source is a
 * package that no longer builds alone, and that is true whatever the licences
 * say. In one repository the reach is one relative path away, and an import
 * that crosses it does not fail to compile, does not fail a test, and does not
 * look wrong in a diff.
 *
 * So the rule is checked rather than trusted: **a file may import its own
 * package, a published dependency, or `trail-core`, and nothing else.**
 * `trail-core` is the exception by design: it is the shared library, it flows
 * into all of the others, and none of them flows back.
 *
 * **What this does not catch, and never did.** It reads imports and dependency
 * names. A file copied wholesale into another package, using only that
 * package's own modules, passes every assertion here. That gap is why the
 * licence rationale could not rest on this test, and it is worth knowing before
 * treating a green run as proof that nothing has moved.
 *
 * The last assertion is still about licences and is deliberately kept: each
 * package states its own SPDX identifier and ships the text behind it. A
 * licence named in a manifest with no file beside it is a claim, and the
 * repository as a whole is not licensed, so the per-package statement is the
 * only one there is.
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

describe("package boundary", () => {
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
