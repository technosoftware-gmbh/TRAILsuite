# Installation

## From the repository

```
git clone https://github.com/technosoftware-gmbh/TRAILsuite.git
cd TRAILsuite
npm install
npm run build --workspace packages/core
npm run build --workspace packages/nodatrail
./scripts/install-into-vault.sh /path/to/Vault
```

That copies `main.js`, `styles.css` and `manifest.json` into
`<vault>/.obsidian/plugins/nodatrail/`. Reload Obsidian, or disable and
re-enable the plugin, to pick a new build up.

The core has to be built before the plugin will typecheck against it, because
`packages/core/dist/` is generated and the package's entry points point into it.
`npm install` does that through the core's `prepare` script.

## What a fresh install does

Two things once, when `data.json` does not exist yet, and one thing on every
load.

**It seeds the folder settings against your vault.** Each folder has two
candidate names, the one for your Obsidian language and the English one, and the
English one wins where it exists in your vault and the localised one does not.
So a German-language Obsidian pointed at a vault whose folders are called
`1 Areas` and `2 Goals` finds them rather than proposing `1 Bereiche` beside
them. Nothing is renamed, nothing is moved, and nothing already saved is
overwritten.

The defaults, before that rule applies:

```
0 Plan/       1 Daily  2 Weekly  3 Monthly  4 Quarterly  5 Yearly
1 Areas/      2 Goals/  3 Projects/  4 Resources/  6 Archive/
Finance/      Purchases  Bills  Recurring  Budgets  Accounts  Journal
CRM/          People  Companies
```

`5 Notes` is deliberately not among them: it is a free note store rather than a
PARA category, and a plugin that claimed it would start claiming notes nobody
filed.

**It adopts the shared CRM settings from a sibling.** If APERtrail or CULItrail
is in the vault, NODAtrail reads its `data.json` once and adopts the eleven
fields the three plugins have to agree on about a contact: the type property
itself, the CRM folder and the People and Companies folders under it, the two
type values, the two tag properties, which person tags count, and the two stamp
property names. It reads a file rather than a plugin, so neither sibling needs to
be installed or enabled, and it adopts names and locations only, never a
behaviour toggle.

Because that runs on a fresh install only, a value you change in one plugin later
does not propagate to the others.

**It re-reads CULItrail's order settings on every load.** Six of them: where the
order notes are, what marks one, and the four properties NODAtrail needs to read
a company's orders back. These are the exception to the once-only rule, and
deliberately so: NODAtrail only ever reads those notes, never writes one, so
following CULItrail wherever it has moved them costs nothing and being wrong
about them means a Company note quietly showing no orders.

## After installing

Run **Check the vault** from the command palette. It reports the notes whose
type does not match their folder, the links that resolve to nothing, the images
that do not, and the stamps still in an older shape. It also reports the money
faults arithmetic can see: a bill with no amount, a due date before its issue
date, a purchase whose lines and stated total disagree, and a budget line naming
an area nothing uses.

It fixes two things and only when you ask: a note's type, and a stamp still in an
older shape. Each fixable finding has a button beside it, and where two or more
are fixable there is a **Fix all**. Nothing else is touched, because the rest are
questions only a person can answer.
