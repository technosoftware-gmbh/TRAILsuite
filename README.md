# TRAILsuite

One repository, three packages: a shared core and the two Obsidian plugins
built on it. A [Technosoftware GmbH](https://technosoftware.com) product,
developed at [https://github.com/technosoftware-gmbh/TRAILsuite](https://github.com/technosoftware-gmbh/TRAILsuite).

```
packages/core        @technosoftware/trail-core, the shared library   MIT
packages/apertrail   trips, places, photo spots                        PolyForm Noncommercial 1.0.0
packages/nodatrail   PARA, periodic notes, budgets, bills, ledger      PolyForm Noncommercial 1.0.0
```

Each package keeps its own `LICENSE`, `CLAUDE.md`, `CHANGELOG.md` and tests, and
each remains buildable and releasable on its own. Both plugins additionally
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
npm run build        # builds the core and both plugins
```

Per package, from the root:

```
npm run test  --workspace packages/nodatrail
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

That copies `main.js`, `styles.css` and `manifest.json` for both plugins
into `<vault>/.obsidian/plugins/<id>/`. It deliberately does not build first, so
what lands in a vault is whatever was last verified.

`npm install` links `packages/core` into each plugin as `@technosoftware/trail-core`, so a
change to the core is visible to a plugin as soon as the core is rebuilt.
**The core has to be built before a plugin will typecheck against it**, because
`dist/` is generated and the package's entry points point into it.

npm will not do that ordering on its own. `--workspaces` visits packages in
workspace order, which puts `apertrail` before `core`, so a tree whose
`packages/core/dist/` is missing or stale fails the plugin typecheck with
`Cannot find module '@technosoftware/trail-core'` rather than rebuilding the core first. That is
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
- [`docs/ui-conventions.md`](docs/ui-conventions.md), what the plugins'
  interfaces agree on, and why that agreement can only ever be a document: the
  core holds no view, and a shared kit cannot cross the licence boundary.
- [`docs/settings.md`](docs/settings.md), the settings model the three share:
  what is a setting and what is fixed vocabulary, how folder defaults localise
  and derive, the property-name lock, validation, and adoption from a sibling.
  The full key lists stay per plugin.
- [`docs/sample-vault.md`](docs/sample-vault.md), the vault each plugin can fill
  an empty vault with, and what they demonstrate together that neither can
  alone: one Person note answering to both, a trip's money in a ledger, and
  settings adopted from a sibling's `data.json`. The same Person note answers to
  CULItrail in its own repository, which is what the shared CRM contract is for.
  What each plugin seeds is in its own `docs/design/sample-vault.md`.

## The licences

**The core is MIT. Both plugins are PolyForm Noncommercial 1.0.0.**

**Free for personal use. Any use in or for a business needs a commercial licence
from Technosoftware GmbH.** A household budget, a personal PARA tree and
planning your own trips are free. If business transactions are in the vault at
all, that is business use, including a freelancer or sole trader keeping their
books beside their private ones. Enquiries go through
<https://technosoftware.com/license-agreement> or <support@technosoftware.com>.
The commercial terms are a separate agreement and are not in this repository:
each package's `LICENSE` is the canonical PolyForm text and nothing else.

**Code may move from the core outwards. It may not move sideways.** Both plugins
consume the core; neither flows back into it and neither may take a file from
the other. `tests/package-boundary.test.ts` checks it: no file may resolve an
import outside its own package or name another package, in either direction.

That rule carried a licence argument until September 2026, when
[CULItrail](https://github.com/technosoftware-gmbh/CULItrail) moved to its own
repository. It carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox) and is
GPL-3.0-or-later as a whole, and a file copied out of it into either package
here would have relicensed that package without anybody meaning to. Separate
repositories enforce that better than a test could: you cannot copy a file out
of a tree you have not checked out. What the test keeps is the architectural
half, which was always the stronger reason -- every package stays independently
buildable and shippable.

The plugins still cooperate with CULItrail across that boundary, by reading its
notes and its `data.json` off disk. The six settings NODAtrail needs to read an
order note live in the core as `ORDER_CONTRACT` and are asserted on both sides
of the split.

Before adopting a file into `packages/core`, confirm its lineage. The core is
MIT and relicensing somebody else's code is not Technosoftware's to do. A file
whose lineage cannot be established stays where it is. See
`packages/core/NOTICE.md`.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the setup commands, the conventions the
tests enforce, and the two things that can make a pull request unmergeable
whatever else is right about it: the package boundary above, and the
contributor licence agreement Technosoftware asks for before merging code.

Security problems do not go in an issue. [`SECURITY.md`](SECURITY.md) says where
they go, and describes an attack surface that is smaller than most: neither
plugin makes a network request.

Everyone taking part is covered by the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Ownership

Copyright (c) 2026 Technosoftware GmbH, Switzerland
(<https://technosoftware.com>). Each package carries its own licence beside its
`package.json`; [`LICENSE.md`](LICENSE.md) lists the four in one table and
[`NOTICE.md`](NOTICE.md) says why they differ. The repository as a whole is not
licensed. Bug reports go to
<https://github.com/technosoftware-gmbh/TRAILsuite/issues>, and anything else to
<support@technosoftware.com>.
