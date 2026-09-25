/**
 * The two plugins' interchange command line helpers are copies, and stay copies.
 *
 * The package boundary keeps NODAtrail and APERtrail from importing each
 * other, and the core reads no filesystem, so the read-only disk host and the
 * argument handling exist twice. A fix made in one and not the other is the
 * failure a copy invites, and this is what notices it: the files must match
 * byte for byte apart from the one line that names the other plugin.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGES = join(__dirname, "..", "packages");
const COPIES = ["fs-host.ts", "cli.ts", "run.mjs"];

function text(plugin: string, file: string): string {
  return readFileSync(
    join(PACKAGES, plugin, "scripts", "interchange", file),
    "utf8",
  ).replace(/lives in (NODAtrail|APERtrail)'s/g, "lives in the other plugin's");
}

describe("the interchange script copies", () => {
  it.each(COPIES)("%s is the same in both plugins", (file) => {
    expect(text("apertrail", file)).toBe(text("nodatrail", file));
  });
});
