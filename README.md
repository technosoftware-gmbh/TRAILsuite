# TRAILsuite

One repository, four packages: a shared core and the three Obsidian plugins
built on it. A [Technosoftware GmbH](https://technosoftware.com) product,
developed at [https://github.com/technosoftware-gmbh/TRAILsuite](https://github.com/technosoftware-gmbh/TRAILsuite).

```
packages/core        trail-core, the shared Obsidian-free library      MIT
packages/culitrail   meals, meal plans, orders, deliveries             GPL-3.0-or-later
packages/apertrail   trips, places, photo spots                        PolyForm Noncommercial 1.0.0
packages/nodatrail   PARA, periodic notes, budgets, bills, ledger      PolyForm Noncommercial 1.0.0
```

Each package keeps its own `LICENSE`, `CLAUDE.md`, `CHANGELOG.md` and tests, and
each remains buildable and releasable on its own. The three plugins additionally
carry a `manifest.json` and a `docs/` tree of their own; the core carries
neither, because it is a library rather than a plugin and its reference
documentation is its `README.md` and `CLAUDE.md`. What the monorepo changes is
the plumbing between them: one `npm install`, one command to test everything,
and a change that touches the core and a plugin lands in one commit rather than
several repositories and a version bump.

`brand/` holds the suite's logo and icon artwork and the briefs each product was
built from; see [`brand/README.md`](brand/README.md).

## Getting started

```
git clone https://github.com/technosoftware-gmbh/TRAILsuite.git
cd TRAILsuite
npm install          # installs every package, and builds the core
npm run check        # typecheck, lint and test everything
npm run build        # builds the core and all three plugins
```

Per package, from the root:

```
npm run test  --workspace packages/culitrail
npm run build --workspace packages/apertrail
```

NODAtrail additionally carries a suite that reads a real vault and skips without
one, which is what catches a reader that works against invented frontmatter:

```
NODATRAIL_VAULT=/path/to/Vault npm run test --workspace packages/nodatrail
```

To put the built plugins into a vault:

```
./scripts/install-into-vault.sh /path/to/Vault
```

That copies `main.js`, `styles.css` and `manifest.json` for all three plugins
into `<vault>/.obsidian/plugins/<id>/`. It deliberately does not build first, so
what lands in a vault is whatever was last verified.

`npm install` links `packages/core` into each plugin as `trail-core`, so a
change to the core is visible to a plugin as soon as the core is rebuilt.
**The core has to be built before a plugin will typecheck against it**, because
`dist/` is generated and the package's entry points point into it.

npm will not do that ordering on its own. `--workspaces` visits packages in
workspace order, which puts `culitrail` before `core`, so a tree whose
`packages/core/dist/` is missing or stale fails the plugin typecheck with
`Cannot find module 'trail-core'` rather than rebuilding the core first. That is
not a hypothetical: it cost an afternoon, because the error names a module
rather than a build step and reads like a broken install.

So `check` and `build` both begin with `npm run core`, which builds the core and
nothing else. Rebuilding it twice in a `build` costs about three seconds and is
the price of the commands being true when you run them:

```
npm run core        # just the core, when that is all you changed
```

## Documentation

Six documents cover the suite as a whole, beside each plugin's own `docs/`:

- [`docs/architecture.md`](docs/architecture.md), the design and implementation:
  what lives in the core and why, how a note is recognised, the settings model,
  the shared CRM, how the plugins cooperate without importing each other, and a
  frontmatter reference for CULItrail's and APERtrail's note types. NODAtrail's
  are in its own [`docs/design/data-model.md`](packages/nodatrail/docs/design/data-model.md).
- [`docs/user-guide.md`](docs/user-guide.md), written for somebody using the
  plugins rather than building them: what each note looks like, the everyday
  workflows, and what to check when something does not show up.
- [`docs/ui-conventions.md`](docs/ui-conventions.md), what the three plugins'
  interfaces agree on, and why that agreement can only ever be a document: the
  core holds no view, and a shared kit cannot cross the licence boundary.
- [`docs/settings.md`](docs/settings.md), the settings model the three share:
  what is a setting and what is fixed vocabulary, how folder defaults localise
  and derive, the property-name lock, validation, and adoption from a sibling.
  The full key lists stay per plugin.
- [`docs/sample-vault.md`](docs/sample-vault.md), the vault each plugin can fill
  an empty vault with, and what the three of them together demonstrate that none
  of them can alone: one Person note answering to three plugins, a meal in a day
  note, a trip's money in a ledger, and settings adopted from a sibling's
  `data.json`. What each plugin seeds is in its own `docs/design/sample-vault.md`.

## The licence boundary

The four packages carry three licences on purpose, and the reason is history
rather than preference. CULItrail carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox), which is
GPL-3.0-or-later and makes CULItrail GPL as a whole. APERtrail and NODAtrail
carry none of it and are licensed PolyForm Noncommercial. The core is MIT so
that it can flow into all three.

**Code may move from the core outwards. It may not move sideways.** In separate
repositories the filesystem enforced that. Here it is one relative path away, so
`tests/licence-boundary.test.ts` checks it instead: no file may resolve an
import outside its own package or name another package, in either direction.
NODAtrail follows CULItrail's settings-adoption mechanism and shares none of its
code, and that distinction is what lets the two be licensed differently.

Before adopting a file into `packages/core`, confirm it has no Recipe Box
lineage. A file whose lineage cannot be established stays where it is. See
`packages/core/NOTICE.md`.

## Ownership

Copyright (c) 2026 Technosoftware GmbH, Switzerland
(<https://technosoftware.com>). Each package carries its own licence beside its
`package.json`; `NOTICE.md` says which and why. Bug reports go to
<https://github.com/technosoftware-gmbh/TRAILsuite/issues>, and anything else to
<support@technosoftware.com>.
