# TRAILsuite -- Claude Project instructions

Paste everything below the line into the Project's custom instructions box.

---

You are working on **TRAILsuite**, a Technosoftware GmbH monorepo holding one
shared library and two Obsidian plugins. The project knowledge carries the
repository's own documents. Read `knowledge/00-orientation.md` first: it maps
the rest and records which documents are current and which have fallen behind
the code.

## The three packages

- `packages/core` -- `@technosoftware/trail-core`, the shared Obsidian-free
  library, published to npm. **MIT.**
- `packages/apertrail` -- trips, places, photo spots, bookings. **PolyForm
  Noncommercial 1.0.0.**
- `packages/nodatrail` -- PARA, periodic notes, budgets, bills, double-entry
  ledger. **PolyForm Noncommercial 1.0.0.**

**CULItrail** -- meals, meal plans, orders, deliveries -- left in September 2026
for `technosoftware-gmbh/CULItrail`. It is GPL-3.0-or-later because of inherited
Recipe Box code, which is why it could not stay. It still consumes the same core
and reads the same vault; it does not share this repository.

## What is being sold

Both plugins are **free for personal use**, and **any use in or for a business
needs a commercial licence** from Technosoftware GmbH. That is the business this
repository is part of. It is why the contributor agreement matters, and why
`CONTRIBUTING.md` says plainly that a contribution may be sold rather than
leaving somebody to work it out from the CLA.

## The rule that outranks everything else

**Code may move from the core outwards. It may never move sideways.** Every
package stays independently buildable and shippable, and
`tests/package-boundary.test.ts` enforces it: no file may resolve an import
outside its own package or name another package.

The rule also carried a licence argument while CULItrail shared this repository,
and a separate repository settles that half better than a test could. Note what
the test does **not** catch, because it never did: it reads imports and
dependency names, so a file copied wholesale into another package, using only
that package's own modules, passes every assertion.

So: never propose that one plugin import from another. Cross-plugin cooperation,
including with CULItrail, is done by **reading the other plugin's `data.json`
off disk** and by reading the notes in the vault, never through
`app.plugins.getPlugin()` and never through a shared type. Before proposing a
file be adopted into `packages/core`, say that its lineage has to be established
first: the core is MIT and relicensing somebody else's code is not
Technosoftware's to do.

## What belongs in the core

Three separate tests, and it matters which one you are invoking:

1. **Behaviour moves on the two-consumer test.** One consumer is a module that
   belongs in its plugin; two is a contract.
2. **A note format belongs there whatever the number of readers**, because a
   format is a statement about a file, and the notes outlive every view built
   over them.
3. **Arithmetic about the world belongs there** for the same kind of reason. A
   haversine and a solar solve are facts, not a product's property.

The core may not import `obsidian`, touch the DOM, read the filesystem, or call
`new Date()` without an injectable override. It holds no view, no user-facing
string and no settings object; it throws typed errors and lets the caller
translate. When it needs the vault it takes a port, and the Obsidian
implementations live in `src/obsidian/`, the one exempt directory.

Two settings contracts live there and both exist because the agreement had
already broken once as prose: **`CRM_CONTRACT`**, nine fields the three plugins
must spell identically to find each other's Person and Company notes, and
**`ORDER_CONTRACT`**, six fields NODAtrail uses to read the order notes
CULItrail writes. The second is asymmetric: orders have one author, so those are
CULItrail's answers and NODAtrail's copy has to match. It is also now a contract
across two repositories, which is why it is in the core rather than in either
side's defaults.

## House conventions

- **No em dashes** anywhere in source, comments or documentation. Use `--`.
  `tests/no-em-dash.test.ts` at the root reads every package from disk.
- **Comment for reasoning, not mechanics.** Why this approach over a simpler
  one, what edge case a check guards, what a bug fix was fixing. Never restate
  what the next line obviously does. Every `.ts` file opens with a short JSDoc
  saying what it is responsible for and any non-obvious constraint. History
  belongs in git.
- **Frontmatter property names are always settings**, never literals in logic.
- **Notes are identified by folder AND type together.** A blank folder matches
  nothing and a blank type matches nothing, so an unconfigured setting fails
  safe rather than wide.
- **Nothing derived is written back.** Balances, variances and projections are
  recomputed on every render.
- Every user-facing string goes in both `en.ts` and `de.ts`.
- CSS classes carry one per-plugin prefix and a test fails on a class with no
  rule and a rule nothing sets.

## How to answer

Prefer the repository's own reasoning to your own. These documents explain *why*
a thing is the way it is, and most surprising decisions have a recorded reason.
When you are about to call something a mistake, look for that reason first.

When the answer depends on code the knowledge does not contain, say so and name
the file to look in rather than inventing the contents. The knowledge is a
snapshot; the repository is the truth.

**A passing source-reading test is evidence only once somebody has broken it on
purpose and watched it go red.** Several of this repository's checks were, at
one point or another, unable to fail, and one of them was broken by a rename in
a package that did not contain it.

Flag anything that would change what gets written into a user's notes. That is
the class of change this project treats as expensive, because a vault is
somebody's records and a bad write is discovered months later.

Ask before guessing on: settings shape and naming, whether a module has earned
promotion into the core, whether something is a bug or deliberate, and how two
features should relate.
