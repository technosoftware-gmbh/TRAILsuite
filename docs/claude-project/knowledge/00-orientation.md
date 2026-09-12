# TRAILsuite: orientation, and what these documents do not cover

**Status: rewritten 12 September 2026**, against a clean clone and a full
`npm run check`. Read this first. Thirteen files in all: **eleven are the
repository's own documents**, copied unchanged by
`scripts/claude-project-bundle.sh`. This one says how they fit together and
**where they still fall behind the code**, so that an answer drawn from them can
be trusted or discounted knowingly.

**Two are written for this bundle** and have no other home:
`08-ledger-and-money.md` and this file. The other eleven are copies, which is
the point: correcting one of them means editing the repository and re-running
the script, never editing the copy. **A correction made here and not in the
repository is lost at the next regeneration.**

## The shape of the repository

```
packages/core        @technosoftware/trail-core 2.0.0, published to npm    MIT
packages/apertrail   trips, places, photo spots, bookings                  PolyForm Noncommercial 1.0.0
packages/nodatrail   PARA, periodic notes, budgets, bills, ledger          PolyForm Noncommercial 1.0.0
```

**CULItrail is not here any more.** Meals, meal plans, orders and deliveries
moved to `technosoftware-gmbh/CULItrail` in September 2026,
GPL-3.0-or-later because of inherited Recipe Box code. It consumes the same core
from npm, at `^2.0.0`, and reads the same vault. Where a document below says a
thing is shared by three plugins, that is still true and one of the three now
reads the shared pieces off npm and out of the vault rather than from a sibling
directory.

**The numbering runs 00 to 12 with no gaps.** It used to skip 07 and 12, which
were CULItrail's `CLAUDE.md` and data model, and the gaps were closed in
September 2026 with the old names deleted from the Project by hand. Two numbers
therefore mean something different than they did in any older conversation:
**07 is APERtrail's `CLAUDE.md`** and **12 is NODAtrail's data model**. The
bundle script follows these names; changing one again means deleting the old
name from the Project by hand, because nothing in the script can reach it.

## What each knowledge file is

| File | What it is | Trust |
|---|---|---|
| `01-repository.md` | The root `README.md`. Layout, commands, the licences, the boundary. | Current |
| `02-licenses.md` | The root `NOTICE.md`. Which licence, why, and the personal/business line. | Current |
| `03-architecture.md` | `docs/architecture.md`. The design: the core's rules, note recognition, settings, the CRM, a frontmatter reference, testing, how the plugins cooperate, known divergences. | **Partly stale. Dated 26 August 2026 and maintained unevenly since: see below** |
| `04-user-guide.md` | `docs/user-guide.md`. Written for somebody using the plugins, and it covers all three including CULItrail. | Current |
| `05-core.md` | `packages/core/CLAUDE.md`. The core's own rules and the three promotion tests. | Current |
| `06-nodatrail.md` | `packages/nodatrail/CLAUDE.md`. | Current |
| `07-apertrail.md` | `packages/apertrail/CLAUDE.md`. | Current except its health-check count: see below |
| `08-ledger-and-money.md` | Written for this bundle. The double-entry model: the four account kinds, the journal block, the statement import, the kept-statement archive, and the near-miss check around marking a bill paid. | Current |
| `09-ui-conventions.md` | `docs/ui-conventions.md`. One UI specification, three implementations, and why a shared UI module is not available. | Current, audited 5 September 2026. **CULItrail's columns and counts are a snapshot** and cannot be re-measured from this repository |
| `10-settings.md` | `docs/settings.md`. The settings *model* and its measured coverage. Not the key list. | **Section 8 is wrong, not merely old: see below** |
| `11-apertrail-data-model.md` | `packages/apertrail/docs/design/data-model.md`. Every APERtrail note, including vehicles, excursions and bookings. | Current, and the best answer for any APERtrail note. One contradiction, in the fixed-vocabulary list: see below |
| `12-nodatrail-data-model.md` | `packages/nodatrail/docs/design/data-model.md`. Every NODAtrail note: PARA, periods, budgets, bills, ledger, documents, tasks. | Current |

**Which file answers which question.** For *what a note contains*, go to the two
data-model files first and to `03-architecture.md` section 6 second: the
data-model files are per plugin and complete, section 6 is cross-plugin, is not
complete, and is now the older of the two. CULItrail's data model is in its own
repository. For *why the code is shaped that way*, go to the `CLAUDE.md` copies.
For *what a setting is called*, none of these has the full list; it is per plugin
in `packages/<plugin>/docs/design/settings-reference.md`, which is not in this
bundle because key lists would crowd out everything else.

## Where the documents still fall behind

Each of these was checked against the source on 12 September 2026. They are
listed so an answer can be discounted, not as a to-do list; when one is fixed in
the repository, delete its entry here.

**`03-architecture.md` is missing the whole of the September APERtrail work.**
The words *vehicle*, *excursion*, *variants*, *optional* and *extends* do not
appear in it. Section 6.8 and section 7 both still list **ten** travel type
values; there are **twelve**, and `vehicle` and `excursion` are the two missing.
`11-apertrail-data-model.md` has all of it and is the file to answer from. The
same document's section 12 item 7 says the core is at 1.1.0; it is at 2.0.0,
whose breaking change is `MealDraft` dropping `prepTime` and `totalTime`.

**`03-architecture.md` section 6 covers the shared properties and APERtrail. It
has no NODAtrail entries.** There is no PARA note, period note, budget, bill,
ledger account, posting, document or task in it. That is not an oversight to be
worked around by inventing them: those formats are in
`12-nodatrail-data-model.md` in full, and the ledger half of them again in
`08-ledger-and-money.md`. **For any NODAtrail note, read file 12 and not
section 6.**

**`10-settings.md` section 8 contradicts `03-architecture.md` section 12, and
section 12 is the one that is right.** Settings says APERtrail is "the one
package with no `settings-coverage` test"; `packages/apertrail/tests/settings-coverage.test.ts`
exists and passes, and architecture records it as closed on 30 August 2026. The
same table's counts (APERtrail 132 settings, NODAtrail 161) are far under what
the packages now declare, and its CULItrail row measures a package that is no
longer here. Section 8 aside, the settings *model* in that file is current.
It also says "the ten travel entity types" twice, in sections 2 and 3. Twelve.

**Two smaller counts that disagree with their own documents.**
`07-apertrail.md` says the entity-type health check "covers all twelve folders,
comparing the ten travel ones against their literal"; it covers fourteen, and
`src/vault/health/entity-type-issues.ts` names `vehicles` and `excursions`
explicitly. `11-apertrail-data-model.md` says "the twelve recognized values" in
one place and "the ten travel entity type values" in another; twelve is right.

**The pattern is worth naming, because it is the one to be suspicious of.**
Every error in this section is a number written out in words beside a list the
code owns: ten types, twelve folders, nine values, four packages. Prose ages
where it counts something. When one of these documents states a count, check it.

**Every measured figure in the bundle is dated and goes stale on the next
commit.** The test counts, the settings coverage table and the uncontrolled
APERtrail settings were counted from real runs on their stated dates. They are
stated with their date so they can be distrusted rather than half-believed.
Re-count them off a run before quoting one as a current fact.

**Section 12 of `03-architecture.md` is the live list and is worth reading in
full.** Several of its entries were closed in the August and September audits;
the ones that remain are real.

## Commands

```
npm install                                     # installs everything, builds the core
npm run check                                   # typecheck, lint and test everything (root only)
npm run build                                   # core and both plugins
npm run test --workspace packages/nodatrail     # one package
./scripts/install-into-vault.sh /path/to/Vault  # copy built plugins into a vault
./scripts/claude-project-bundle.sh              # regenerate this bundle
```

`check` and `build` both run `npm run core` first, so the core is built before
anything typechecks against it. That was not always true and cost an afternoon
when it was not.

Both plugins carry a smoke suite that reads a real vault and silently skips
without one:

```
NODATRAIL_VAULT=/path/to/Vault npm run test --workspace packages/nodatrail
APERTRAIL_VAULT=/path/to/Vault npm run test --workspace packages/apertrail
```

`APERTRAIL_LOCALE=de` settles the folder fallback for a vault that has never
saved its folder settings, which otherwise resolves to the English defaults in a
test process and looks for German folders under English names.

**A `node_modules` installed on macOS cannot run the gate in a Linux sandbox.**
`tsc` dies on a missing `@typescript/typescript-linux-arm64` before a single
test runs. A fresh clone plus `npm install` in the sandbox is the way to run
`npm run check` from anywhere but the Mac.

## The test suites, measured 12 September 2026

From `npm run check` on a clean clone, exit 0.

| Package | Test files | Tests |
|---|---|---|
| core | 72 | 1666 |
| apertrail | 88, of which 1 skips without a real vault | 1185, of which 5 skip |
| nodatrail | 86, of which 1 skips without a real vault | 873, of which 7 skip |
| the suite itself | 4 | 24 |

## What the tests enforce, as distinct from what the docs ask for

A convention with a test behind it is not a preference. These fail the build:

- `package-boundary` (root) -- no cross-package import or dependency, and each
  package states its own SPDX identifier with the text beside it.
- `no-em-dash` (root) -- reads every package from disk, including the
  `CLAUDE.md` files, and `docs/` recursively, so it reads this bundle too.
- `display-locale` (root) -- no plugin formats a number or a date in the
  machine's convention.
- `settings-reference` (root) -- a setting with no row in its package's settings
  reference, or a row for a setting that no longer exists. It is the fourth root
  test and is easy to miss when the other three are listed from memory.
- `obsidian-free` (core) -- the core imports no `obsidian`, reads no filesystem,
  and calls no unmockable clock. It reads the source text, because a lint rule
  can be silenced by the same edit that breaks it.
- `crm-contract` and `order-contract` (core and the plugins) -- the shared
  settings defaults may not drift. Nine fields and six.
- `translation-keys` (both plugins) -- every string exists in both `en.ts` and
  `de.ts`. A key built at runtime must be declared in `DYNAMIC_KEYS`, which is
  the point rather than a workaround: a dynamic key is the one that fails
  silently in the other language. **It compares keys, never values**, so a
  string edited in one language and not the other passes.
- `settings-coverage`, `property-name-lock`, `stylesheet`, `ui-conventions`,
  `icon-slot` (both plugins).
- `vault-smoke` (both plugins) -- a reader must work against a real vault and
  not only against invented frontmatter. Skips silently without the vault
  variable.

That last pattern recurs and is worth recognising. Where a bug would be silent
at runtime, this codebase tends to write a test that reads the source and
compares two things that must agree.

**And the pattern has a failure mode worth carrying into any answer about these
tests.** Five of them were, at one point or another, unable to fail: a scan so
wide that every key matched something, a regex that missed template literals, a
name collected file-wide instead of from the nearest declaration, a page list
that matched a union type rather than a rendered control, and a line-based
import match that stopped seeing a third of its subject the day another
package's dependency name got longer. Each was found by reading a green run
rather than trusting it. **A passing source-reading test is evidence only once
somebody has broken it on purpose and watched it go red.**
