# TRAILsuite: orientation, and what these documents do not cover

**Status: rewritten 5 September 2026**, after CULItrail moved to its own
repository and the core was published to npm. Read this first. Thirteen files in
all: **eleven are the repository's own documents**, copied unchanged by
`scripts/claude-project-bundle.sh`. This one says how they fit together and
**where they still fall behind the code**, so that an answer drawn from them can
be trusted or discounted knowingly.

**Two are written for this bundle** and have no other home:
`09-ledger-and-money.md` and this file. The other eleven are copies, which is
the point: correcting one of them means editing the repository and re-running the
script, never editing the copy. **A correction made here and not in the
repository is lost at the next regeneration.**

## The shape of the repository

```
packages/core        @technosoftware/trail-core, the shared library    MIT
packages/apertrail   trips, places, photo spots, bookings              PolyForm Noncommercial 1.0.0
packages/nodatrail   PARA, periodic notes, budgets, bills, ledger      PolyForm Noncommercial 1.0.0
```

**CULItrail is not here any more.** Meals, meal plans, orders and deliveries
moved to `technosoftware-gmbh/CULItrail` on 5 September 2026, GPL-3.0-or-later
because of inherited Recipe Box code. It consumes the same core from npm and
reads the same vault. Where a document below says a thing is shared by three
plugins, that is still true and one of the three now reads the shared pieces off
npm and out of the vault rather than from a sibling directory.

**Numbers 07 and 12 are missing from this bundle on purpose.** They were
CULItrail's `CLAUDE.md` and data model. The gaps are left rather than closed
because closing them would rename every later file, and a Project upload
replaces a file of the same name while merely sitting beside one of a different
name. Delete `knowledge/07-culitrail.md` and
`knowledge/12-culitrail-data-model.md` from the Project once.

## What each knowledge file is

| File | What it is | Trust |
|---|---|---|
| `01-repository.md` | The root `README.md`. Layout, commands, the licences, the boundary. | Current |
| `02-licences.md` | The root `NOTICE.md`. Which licence, why, and the personal/business line. | Current |
| `03-architecture.md` | `docs/architecture.md`. The design: the core's rules, note recognition, settings, the CRM, a frontmatter reference, testing, how the plugins cooperate, known divergences. | Current, audited 5 September 2026. **Its frontmatter reference is not complete: see below** |
| `04-user-guide.md` | `docs/user-guide.md`. Written for somebody using the plugins, and it covers all three including CULItrail. | Current |
| `05-core.md` | `packages/core/CLAUDE.md`. The core's own rules and the three promotion tests. | Current |
| `06-nodatrail.md` | `packages/nodatrail/CLAUDE.md`. | Current |
| `08-apertrail.md` | `packages/apertrail/CLAUDE.md`. | Current |
| `09-ledger-and-money.md` | Written for this bundle. The double-entry model: the four account kinds, the journal block, the statement import, the kept-statement archive, and the near-miss check around marking a bill paid. | Current |
| `10-ui-conventions.md` | `docs/ui-conventions.md`. One UI specification, three implementations, and why a shared UI module is not available. | Current. **CULItrail's columns and counts are a snapshot** and cannot be re-measured from this repository |
| `11-settings.md` | `docs/settings.md`. The settings *model* and its measured coverage. Not the key list. | Current |
| `13-apertrail-data-model.md` | `packages/apertrail/docs/design/data-model.md`. Every APERtrail note, including bookings. | Current |
| `14-nodatrail-data-model.md` | `packages/nodatrail/docs/design/data-model.md`. Every NODAtrail note: PARA, periods, budgets, bills, ledger, documents, tasks. | Current |

**Which file answers which question.** For *what a note contains*, go to the two
data-model files first and to `03-architecture.md` section 6 second: the
data-model files are per plugin and complete, section 6 is cross-plugin and is
not. CULItrail's data model is in its own repository. For *why the code is
shaped that way*, go to the `CLAUDE.md` copies. For *what a setting is called*,
none of these has the full list; it is per plugin in
`packages/<plugin>/docs/design/settings-reference.md`, which is not in this
bundle because key lists would crowd out everything else.

## Where the documents still fall behind

**`03-architecture.md` section 6 covers the shared properties and APERtrail. It
has no NODAtrail entries.** There is no PARA note, period note, budget, bill,
ledger account, posting, document or task in it. That is not an oversight to be
worked around by inventing them: those formats are in
`14-nodatrail-data-model.md` in full, and the ledger half of them again in
`09-ledger-and-money.md`. **For any NODAtrail note, read file 14 and not
section 6.**

**Every measured figure in the bundle is dated and goes stale on the next
commit.** The test counts, the settings coverage table and the uncontrolled
APERtrail settings were counted from real runs on their stated dates. They are
stated with their date so they can be distrusted rather than half-believed.
Re-count them off a run before quoting one as a current fact.

**Section 12 of `03-architecture.md` is the live list and is worth reading in
full.** Two of its entries were closed in the September audit; the ones that
remain are real.

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

NODAtrail carries a smoke suite that reads a real vault and silently skips
without one:

```
NODATRAIL_VAULT=/path/to/Vault npm run test --workspace packages/nodatrail
```

## What the tests enforce, as distinct from what the docs ask for

A convention with a test behind it is not a preference. These fail the build:

- `package-boundary` (root) -- no cross-package import or dependency, and each
  package states its own SPDX identifier with the text beside it.
- `obsidian-free` (core) -- the core imports no `obsidian`, reads no filesystem,
  and calls no unmockable clock. It reads the source text, because a lint rule
  can be silenced by the same edit that breaks it.
- `crm-contract` and `order-contract` (core and the plugins) -- the shared
  settings defaults may not drift.
- `translation-keys` (both plugins) -- every string exists in both `en.ts` and
  `de.ts`. A key built at runtime must be declared in `DYNAMIC_KEYS`, which is
  the point rather than a workaround: a dynamic key is the one that fails
  silently in the other language.
- `settings-coverage`, `property-name-lock`, `stylesheet`, `ui-conventions`,
  `icon-slot` (both plugins).
- `no-em-dash` (root) -- reads every package from disk, including the
  `CLAUDE.md` files, which were exempt until the only copy that needed the
  exemption left with CULItrail.
- `display-locale` (root) -- no plugin formats a number or a date in the
  machine's convention.
- `vault-smoke` (nodatrail) -- a reader must work against a real vault and not
  only against invented frontmatter. Skips silently without `NODATRAIL_VAULT`.

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
