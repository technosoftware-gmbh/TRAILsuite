# Notice

Copyright (c) 2026 Technosoftware GmbH. TRAILsuite, APERtrail, CULItrail,
NODAtrail and TRAILcore are products of Technosoftware GmbH
(<https://technosoftware.com>).

This repository holds four packages under three licences. **The repository as a
whole is not licensed; each package is**, by the `LICENSE` file beside its own
`package.json`.

| Package | Licence | Why |
|---|---|---|
| `packages/core` | MIT | Deliberately the most permissive, so it can flow into all three of the others and into a future standalone application. Nothing in it descends from third-party code |
| `packages/culitrail` | GPL-3.0-or-later | It carries code inherited from Recipe Box, which is GPL-3.0-or-later, so the package is GPL as a whole |
| `packages/apertrail` | PolyForm Noncommercial 1.0.0 | Written independently. It carries no inherited code, and must not be given any |
| `packages/nodatrail` | PolyForm Noncommercial 1.0.0 | The same. It follows CULItrail's settings-adoption mechanism and shares none of its code, which is the distinction that lets the two be licensed differently |

The inherited code is **Recipe Box** by Arcane Tech / AdamArcane
(https://github.com/AdamArcane/obsidian-recipebox), GPL-3.0-or-later. It was
integrated as a recipe module rather than rebuilt, and CULItrail is the one
package that carries it.

Two consequences follow, and both are enforced rather than remembered:

**MIT flows outwards; nothing flows sideways.** A GPL package may consume an MIT
library freely, and so may a PolyForm one. The reverse does not work in either
direction, and copying a file from `culitrail` into either PolyForm package
would make that package GPL without anybody meaning it to.
`tests/licence-boundary.test.ts` fails if any file in one package resolves an
import outside its own package or names another package by dependency.

**A file adopted into the core has to have its lineage established first.** The
core is MIT, and relicensing somebody else's GPL code is not something the
holder of this repository's copyright, Technosoftware GmbH, is entitled to do.
A file whose lineage cannot be established stays where it is. `packages/core/NOTICE.md` states the
same rule at the package level.

Where a package vendors third-party code rather than depending on it, that
code's own licence and attribution ship beside it in its own directory.

The source is public and the builds are installed by hand: `main.js`,
`manifest.json` and `styles.css` copied into a vault's
`.obsidian/plugins/<plugin>/`, which is what `scripts/install-into-vault.sh`
does. None of the three plugins is published to the Obsidian community plugin
directory.
