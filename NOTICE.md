# Notice

Copyright (c) 2026 Technosoftware GmbH. TRAILsuite, APERtrail, NODAtrail and
TRAILcore are products of Technosoftware GmbH (<https://technosoftware.com>).

This repository holds three packages under two licences. **The repository as a
whole is not licensed; each package is**, by the `LICENSE` file beside its own
`package.json`.

| Package | Licence | Why |
|---|---|---|
| `packages/core` (`@technosoftware/trail-core`) | MIT | Deliberately the most permissive, so it can flow into both plugins, into CULItrail in its own repository, and into anything built later. Nothing in it descends from third-party code |
| `packages/apertrail` | PolyForm Noncommercial 1.0.0 | Free for personal use; a commercial licence is a separate agreement |
| `packages/nodatrail` | PolyForm Noncommercial 1.0.0 | The same |

## Free for personal use, licensed for business use

**APERtrail and NODAtrail are free to use privately.** A household budget, a
personal PARA tree, planning your own trips: that is what PolyForm
Noncommercial permits and what these plugins were built for.

**Any use in or for a business needs a commercial licence from Technosoftware
GmbH.** If business transactions are in the vault at all, that is business use,
including a freelancer or a sole trader keeping their books beside their
private ones. Enquiries go through
<https://technosoftware.com/license-agreement> or
<support@technosoftware.com>.

The terms of a commercial licence are a separate agreement and are not in this
repository. The `LICENSE` file in each package is the canonical PolyForm
Noncommercial text and nothing else: a document that granted a licence in one
paragraph and sold it in another would be worse than either.

**PolyForm Noncommercial is not an open source licence** in the sense the Open
Source Initiative uses, and calling it one would be wrong.

## The rule the arrangement rests on

**MIT flows outwards; nothing flows sideways.** Both plugins consume the core
freely. Neither flows back into it, and neither may take a file from the other.

That rule used to have a licence behind it, when CULItrail shared this
repository. CULItrail carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox), which is
GPL-3.0-or-later, so it is GPL as a whole, and a file copied out of it into
either PolyForm package would have relicensed that package without anybody
meaning to. **CULItrail now lives in
[its own repository](https://github.com/technosoftware-gmbh/CULItrail)**, which
enforces that by the filesystem rather than by a test: you cannot copy a file
out of a tree you have not checked out.

What remains here is the architectural half of the same rule, and
`tests/package-boundary.test.ts` still enforces it: every package stays
independently buildable and shippable, so no file may resolve an import outside
its own package or name another package as a dependency.

The plugins cooperate by **reading each other's `data.json` off disk** and by
reading the notes in the vault, never through `app.plugins.getPlugin()` and
never through a shared type. That is how NODAtrail reads the order notes
CULItrail writes across a repository boundary, and the six settings it needs to
do so live in the core as `ORDER_CONTRACT`, asserted on both sides.

**A file adopted into the core has to have its lineage established first.** The
core is MIT, and relicensing somebody else's code is not something
Technosoftware GmbH is entitled to do. A file whose lineage cannot be
established stays where it is. `packages/core/NOTICE.md` states the same rule at
the package level.

Where a package vendors third-party code rather than depending on it, that
code's own licence and attribution ship beside it in its own directory.

The source is public and the builds are installed by hand: `main.js`,
`manifest.json` and `styles.css` copied into a vault's
`.obsidian/plugins/<plugin>/`, which is what `scripts/install-into-vault.sh`
does. Neither plugin is published to the Obsidian community plugin directory.
