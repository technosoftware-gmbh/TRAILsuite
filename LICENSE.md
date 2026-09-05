# Licences

**This file is not a licence, and this repository as a whole is not licensed.**
It exists because a repository with no `LICENSE` at its root reads as all
rights reserved, and that is not what is going on here. **Each package is
licensed, by the `LICENSE` file beside its own `package.json`**, and those four
files are the ones that govern.

| Package | Licence | Text |
|---|---|---|
| `packages/core` (`trail-core`) | MIT | [`packages/core/LICENSE`](packages/core/LICENSE) |
| `packages/culitrail` | GPL-3.0-or-later | [`packages/culitrail/LICENSE`](packages/culitrail/LICENSE) |
| `packages/apertrail` | PolyForm Noncommercial 1.0.0 | [`packages/apertrail/LICENSE`](packages/apertrail/LICENSE) |
| `packages/nodatrail` | PolyForm Noncommercial 1.0.0 | [`packages/nodatrail/LICENSE`](packages/nodatrail/LICENSE) |

Three licences rather than one, and the reason is history rather than
preference. CULItrail carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox), which is
GPL-3.0-or-later and makes CULItrail GPL as a whole. APERtrail and NODAtrail
carry none of it. The core is MIT so that it can flow into all three and into
anything built later.

**PolyForm Noncommercial 1.0.0 is not an open source licence** in the sense the
Open Source Initiative uses, and calling it one would be wrong. It permits use
for any purpose that is not primarily intended for commercial advantage, which
covers personal vaults, research and charitable work, and does not cover
running the plugin as part of a business. Read
[`packages/apertrail/LICENSE`](packages/apertrail/LICENSE) rather than this
paragraph before relying on it, and write to <support@technosoftware.com> if
you need terms it does not give you.

What is in this repository besides code has its own footing.
[`NOTICE.md`](NOTICE.md) says which licence applies where and why, and states
the rule the arrangement rests on: **code may move from the core outwards and
never sideways.** The suite's names and the artwork in `brand/` and in each
plugin's `images/` are Technosoftware GmbH's marks, and a licence to use a
package is not a licence to use them.

Copyright (c) 2026 Technosoftware GmbH, Switzerland
(<https://technosoftware.com>).
