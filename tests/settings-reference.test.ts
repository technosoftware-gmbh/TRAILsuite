/**
 * Every setting has a row in its package's settings reference, and every row
 * names a setting that exists.
 *
 * **Documentation drifts silently by construction.** Nothing in a build has an
 * opinion about a table, so a settings page falls behind the settings one
 * commit at a time and is only ever found by somebody reading both. APERtrail's
 * had lost eight entries -- the four day-list settings and the four day-number
 * sub-keys, all added in the same week -- and stated a count that was twenty-two
 * short. Each of those was written down at the time and simply never carried
 * across.
 *
 * The reverse direction matters as much: a row for a setting that no longer
 * exists is worse than a missing one, because it reads as current. That is what
 * catches a rename.
 *
 * **At the root, and reading the source as text rather than importing it.**
 * The rule is the same in all three plugins, so it should be one test; but a
 * root file importing `culitrail` alongside the two PolyForm packages would put
 * GPL and PolyForm code in one module for no better reason than convenience.
 * The TypeScript AST gives the property names without any of that, and the
 * packages are read from disk, so a fourth is covered the day it has both files.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(__dirname, "..");
const PACKAGES = join(ROOT, "packages");

interface SettingsDoc {
  name: string;
  keys: string[];
  reference: string;
  referencePath: string;
}

/**
 * The property names of `DEFAULT_SETTINGS`, from the AST.
 *
 * Nested objects are not descended into: a setting whose value is an object is
 * one setting, and its shape is not a row on the page.
 */
function settingKeys(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const keys: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "DEFAULT_SETTINGS" &&
      node.initializer !== undefined
    ) {
      const literal = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (ts.isObjectLiteralExpression(literal)) {
        for (const property of literal.properties) {
          const name = property.name;
          if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name)))
            keys.push(name.text);
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return keys;
}

/** Every package carrying both a settings reference and a defaults file. */
function documented(): SettingsDoc[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(PACKAGES, entry.name);
      const defaults = join(dir, "src", "settings", "defaults.ts");
      const referencePath = join(
        dir,
        "docs",
        "design",
        "settings-reference.md",
      );
      return { dir, name: entry.name, defaults, referencePath };
    })
    .filter((p) => existsSync(p.defaults) && existsSync(p.referencePath))
    .map((p) => ({
      name: p.name,
      keys: settingKeys(p.defaults),
      reference: readFileSync(p.referencePath, "utf8"),
      referencePath: relative(ROOT, p.referencePath),
    }));
}

const PACKAGE_DOCS = documented();

/**
 * The settings a reference gives a ROW to.
 *
 * **Rows of settings tables, and only those.** Three narrowings, each of which
 * a draft of this test got wrong and each structural rather than a list:
 *
 * - **Rows, not prose.** A row is the page asserting a setting exists; a
 *   sentence naming one is not. Sweeping the whole page reported APERtrail's
 *   `tagProperty`, named in a paragraph explaining why it was NOT created;
 *   CULItrail's `sortField`, a key nested inside `gallerySavedState` rather
 *   than a setting of its own; and CULItrail's `defaultServingSizeProperty`, in
 *   a sentence recording that it was removed. A reference has to be able to say
 *   all three of those things.
 * - **Settings tables, not every table.** APERtrail documents its localized
 *   folder names in a table headed `Key | English | German`, whose fourteen
 *   keys are entries in the locale catalogue and were never settings.
 * - **The columns actually headed `Setting`.** Which is how CULItrail's
 *   two-settings-per-row table is read correctly instead of half-read.
 *
 * The alternative to all three was an exemption list of seventeen names, which
 * is the kind that grows until the check means nothing.
 *
 * A cell may carry two related settings as `a` / `b`, so every backticked name
 * in it counts rather than just the first.
 */
function rowSettings(reference: string): string[] {
  const names = new Set<string>();
  let columns: number[] = [];

  for (const line of reference.split("\n")) {
    if (!line.startsWith("|")) {
      columns = [];
      continue;
    }

    const cells = line.split("|").slice(1, -1);
    const heading = cells.map((cell) => cell.trim());
    if (heading.includes("Setting")) {
      // A header row: remember which columns name settings, for the rows under it.
      columns = heading.flatMap((cell, index) =>
        cell === "Setting" ? [index] : [],
      );
      continue;
    }

    for (const index of columns) {
      for (const [, name] of (cells[index] ?? "").matchAll(
        /`([a-z][A-Za-z0-9]*)`/g,
      )) {
        if (/[A-Z]/.test(name)) names.add(name);
      }
    }
  }

  return [...names];
}

describe("the settings reference", () => {
  it("covers every plugin that has one", () => {
    // Guards the discovery itself: an empty list would pass every test below
    // without reading a single file.
    expect(PACKAGE_DOCS.map((p) => p.name).sort()).toEqual([
      "apertrail",
      "culitrail",
      "nodatrail",
    ]);
    for (const doc of PACKAGE_DOCS) expect(doc.keys.length).toBeGreaterThan(20);
  });

  it.each(PACKAGE_DOCS.map((doc): [string, SettingsDoc] => [doc.name, doc]))(
    "gives every setting a row: %s",
    (_name, doc) => {
      const missing = doc.keys.filter(
        (key) => !doc.reference.includes(`\`${key}\``),
      );
      expect(missing, `undocumented in ${doc.referencePath}`).toEqual([]);
    },
  );

  it.each(PACKAGE_DOCS.map((doc): [string, SettingsDoc] => [doc.name, doc]))(
    "names no setting that no longer exists: %s",
    (_name, doc) => {
      const known = new Set(doc.keys);
      // A row for a setting the code does not have. Almost always a rename that
      // moved in the source and not on the page -- and worse than a missing row,
      // because it reads as current.
      const stale = rowSettings(doc.reference).filter(
        (name) => !known.has(name),
      );
      expect(stale, `stale in ${doc.referencePath}`).toEqual([]);
    },
  );
});
