/**
 * The vault readers load without `obsidian`.
 *
 * NODAtrail and APERtrail each read their notes through the core's vault
 * ports in a small set of modules (the `*-reader.ts` files), and each keeps an
 * Obsidian-facing module beside it that is one delegation through `hostFor()`.
 * The split exists so the same reader can run over a host that is not
 * Obsidian: a filesystem, an import tool, a test double. It holds only as long
 * as nothing a reader imports at runtime imports `obsidian`, and that breaks
 * silently: one convenience import three modules down and the reader still
 * compiles, still passes every test inside the plugin, and no longer loads
 * anywhere else.
 *
 * So the whole runtime import graph of each reader is walked and checked.
 * **Type-only imports are allowed**, including `import type { TFile }`: they
 * are erased at compile time, and they are what lets a record default its file
 * type to `TFile` so no Obsidian caller needs a type argument.
 *
 * **The walk proves it can fail.** Every Obsidian-facing twin must be reported
 * as reaching `obsidian`. A walker that stopped seeing imports (a regex that
 * missed a multi-line form, a resolver that lost `.js` suffixes) would pass
 * every reader and fail those, which is the point of asserting both.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const PACKAGES_DIR = join(__dirname, "..", "packages");

/** Each host-free reader, and the Obsidian-facing module that delegates to it. */
const READERS: { reader: string; obsidianTwin: string }[] = [
  {
    reader: "nodatrail/src/vault/notes-reader.ts",
    obsidianTwin: "nodatrail/src/vault/read-notes.ts",
  },
  {
    reader: "nodatrail/src/finance/orders-reader.ts",
    obsidianTwin: "nodatrail/src/finance/read-orders.ts",
  },
  {
    reader: "nodatrail/src/finance/finance-reader.ts",
    obsidianTwin: "nodatrail/src/finance/read-finance.ts",
  },
  {
    reader: "nodatrail/src/ledger/ledger-reader.ts",
    obsidianTwin: "nodatrail/src/ledger/read-ledger.ts",
  },
  {
    reader: "nodatrail/src/para/para-reader.ts",
    obsidianTwin: "nodatrail/src/para/read-para.ts",
  },
  {
    reader: "apertrail/src/vault/board-reader.ts",
    obsidianTwin: "apertrail/src/vault/read-entities.ts",
  },
];

/**
 * Host-free modules with no Obsidian twin: the interchange export, which only
 * ever runs outside Obsidian and is built on the readers above.
 */
const EXPORTERS: string[] = [
  "nodatrail/src/interchange/sections.ts",
  "apertrail/src/interchange/sections.ts",
];

/**
 * Every module specifier a file loads at runtime.
 *
 * `import type` and `export type` are erased and skipped. A mixed import
 * (`import { type A, B }`) still loads its module and counts. Side-effect
 * imports (`import "x"`) count. Dynamic `import()` counts too, since it loads
 * the module the moment it runs.
 */
function runtimeSpecifiers(source: string): string[] {
  const found: string[] = [];
  const statement =
    /^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']/gm;
  for (const match of source.matchAll(statement)) {
    if (match[2]) continue;
    found.push(match[4]);
  }
  for (const match of source.matchAll(/^\s*import\s*["']([^"']+)["']/gm))
    found.push(match[1]);
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g))
    found.push(match[1]);
  return found;
}

/** A relative specifier as a file on disk, or null for a package import. */
function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier.replace(/\.js$/, ""));
  for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `${relative(PACKAGES_DIR, fromFile)} imports ${specifier}, which resolves to nothing`,
  );
}

/** The modules in the runtime graph of one entry that import `obsidian` themselves. */
function modulesReachingObsidian(entry: string): {
  offenders: string[];
  walked: number;
} {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const pending = [join(PACKAGES_DIR, entry)];

  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const specifier of runtimeSpecifiers(readFileSync(file, "utf8"))) {
      if (specifier === "obsidian")
        offenders.push(relative(PACKAGES_DIR, file));
      const next = resolveRelative(file, specifier);
      if (next) pending.push(next);
    }
  }
  return {
    offenders,
    walked: [...seen].map((file) => relative(PACKAGES_DIR, file)),
  };
}

describe("host-free vault readers", () => {
  it.each(READERS)(
    "$reader loads nothing from obsidian at runtime",
    ({ reader }) => {
      expect(modulesReachingObsidian(reader).offenders).toEqual([]);
    },
  );

  it.each(EXPORTERS)(
    "%s loads nothing from obsidian at runtime",
    (exporter) => {
      expect(modulesReachingObsidian(exporter).offenders).toEqual([]);
    },
  );

  it.each(READERS)(
    "$obsidianTwin is seen reaching obsidian, and its reader through it",
    ({ reader, obsidianTwin }) => {
      const { offenders, walked } = modulesReachingObsidian(obsidianTwin);
      expect(offenders).toContain(obsidianTwin);
      // Proves the walk crosses files: the twin reaches its reader only
      // through a resolved relative import.
      expect(walked).toContain(reader);
    },
  );

  it("follows an import chain to a module several files down", () => {
    // read-entities -> board-reader -> ... -> trail-core types: the reader's
    // own graph must be more than the reader, or the walk is not walking.
    expect(
      modulesReachingObsidian(READERS[5].reader).walked.length,
    ).toBeGreaterThan(5);
  });

  it("reads the import forms the readers use", () => {
    const source = [
      'import type { TFile } from "obsidian";',
      "import {",
      "  readNotesOfType,",
      "  type VaultHost,",
      "} from '@technosoftware/trail-core';",
      "import { App } from 'obsidian';",
      "export { liveOnly } from './para-reader';",
      "export type { Ledger } from './ledger-reader';",
      "import './side-effect';",
    ].join("\n");
    expect(runtimeSpecifiers(source)).toEqual([
      "@technosoftware/trail-core",
      "obsidian",
      "./para-reader",
      "./side-effect",
    ]);
  });
});
