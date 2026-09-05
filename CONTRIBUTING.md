# Contributing

Thank you for wanting to. Two things are worth reading before you write code,
because both of them can make a pull request unmergeable no matter how good it
is: the licence boundary, and what a contribution grants Technosoftware GmbH.

## The licence boundary comes first

Four packages, three licences:

```
packages/core        trail-core, the shared Obsidian-free library      MIT
packages/culitrail   meals, meal plans, orders, deliveries             GPL-3.0-or-later
packages/apertrail   trips, places, photo spots, bookings              PolyForm Noncommercial 1.0.0
packages/nodatrail   PARA, periodic notes, budgets, bills, ledger      PolyForm Noncommercial 1.0.0
```

CULItrail carries code inherited from
[Recipe Box](https://github.com/AdamArcane/obsidian-recipebox) and is
GPL-3.0-or-later as a whole. So:

**Code may move from the core outwards. It may never move sideways.** Copying a
file out of `culitrail` into either PolyForm package would relicense that
package without anybody meaning it to, and the reverse fails for the same
reason in the other direction. `tests/package-boundary.test.ts` refuses any
file that resolves an import outside its own package, or that names another
package as a dependency.

Cross-plugin cooperation is done by reading the other plugin's `data.json` off
disk and by reading the notes in the vault. Never through
`app.plugins.getPlugin()`, and never through a shared type.

**Before proposing that a file be adopted into `packages/core`, its lineage has
to be established.** The core is MIT, and relicensing somebody else's GPL code
is not Technosoftware's to do. A file whose lineage cannot be established stays
where it is. `packages/core/NOTICE.md` records the one adoption that has
happened and the check that allowed it.

## What a contribution grants

Code contributions are covered by [`CLA.md`](CLA.md), Technosoftware GmbH's
contributor agreement. In short, and the file itself governs: **you keep your
copyright**, and you grant Technosoftware a licence broad enough to relicense
your contribution, including under terms that differ from the package's current
one. That is what keeps a commercial licence possible for the two PolyForm
packages, and it is why the agreement exists rather than an inbound-equals-
outbound rule. It also grants a patent licence, which terminates for anybody
who sues over the contribution, and it is governed by Swiss law.

**Signing is one comment.** Open your pull request; a bot will notice you have
not signed and post the sentence to reply with:

```
I have read the CLA Document and I hereby sign the CLA
```

Your signature is committed to `.github/cla/signatures.json` in this
repository, so the record is in the open and you are asked once rather than per
pull request. If the bot and that file ever disagree, comment `recheck`.

This covers code, and documentation that ships in the repository. It does not
cover filing an issue or commenting in a discussion, and a bug report that asks
nothing of you is genuinely useful on its own.

Questions about the agreement go to <support@technosoftware.com> before you
write the code rather than after.

## What belongs in the core

Three separate tests, and it matters which one you are invoking:

1. **Behaviour moves on the two-consumer test.** One consumer is a module that
   belongs in its plugin. Two is a contract.
2. **A note format belongs there whatever the number of readers**, because a
   format is a statement about a file, and the notes outlive every view built
   over them.
3. **Arithmetic about the world belongs there** for the same kind of reason. A
   haversine and a solar solve are facts rather than a product's property.

The core may not import `obsidian`, touch the DOM, read the filesystem, or call
`new Date()` without an injectable override. It holds no view, no user-facing
string and no settings object: it throws typed errors and lets the caller
translate. When it needs the vault it takes a port, and the Obsidian
implementations live in `src/obsidian/`, the one exempt directory.
`tests/obsidian-free.test.ts` reads the source rather than trusting the lint
run, because a lint rule can be silenced by the same edit that breaks it.

## The change that costs the most

**Anything that changes what gets written into somebody's notes.** A vault is
somebody's records, nothing migrates automatically, and a bad write is
discovered months later as silence rather than as an error.

Renaming a default property name, changing a `type:` value, or changing what a
reader accepts out of a note that already exists is a breaking change even when
no exported signature moves. Say so in the pull request, and say it in the
changelog entry. Each package's `CHANGELOG.md` opens by defining what breaking
means for that package; read the one you are touching.

## Setting up

```
npm install     # installs everything and builds the core
npm run check   # typecheck, lint and the whole suite
npm run build   # the three bundles, which are what actually ship
```

`npm run build` does order the core, and `npm install` builds it, but if you
see `Cannot find module 'trail-core'` after changing the core, run
`npm run core` first.

One package at a time:

```
npm run test --workspace packages/nodatrail
npm run typecheck --workspace packages/nodatrail
```

`check` exists at the root and in `packages/core` only. The three plugin
packages have `typecheck`, `lint` and `test` separately.

NODAtrail carries a smoke suite that reads a real vault and skips silently
without one:

```
NODATRAIL_VAULT=/path/to/Vault npm run test --workspace packages/nodatrail
```

To try a build in Obsidian, `./scripts/install-into-vault.sh /path/to/Vault`
copies `main.js`, `manifest.json` and `styles.css` into
`.obsidian/plugins/<plugin>/`. Obsidian does not watch those files, so reload
the app or toggle the plugin off and on.

## Conventions the tests enforce

A convention with a test behind it is not a preference. These fail the build:

- **No em dashes** anywhere in source, comments or documentation. Use `--`.
  `tests/no-em-dash.test.ts`.
- **Every user-facing string exists in both `en.ts` and `de.ts`.** A key built
  at runtime must be declared in the test's `DYNAMIC_KEYS`, which is the point
  rather than a workaround: a dynamic key is the one that fails silently in the
  other language.
- **Every setting has a settings-page row**, or a stated reason for having
  none.
- **No property-name row that skips the read-only lock.**
- **A plugin's CRM defaults may not drift from the shared contract.**
- **The stylesheet and the source agree**: no class the source sets and the
  sheet does not style, no rule nothing sets, no physical inline offset.
- **UI conventions**: no view querying the document for DOM it built itself, no
  `innerHTML`, no console logging, no inline style assignment, no bare async
  event listener, no `setIcon()` aimed at a button rather than a slot inside
  one.

And two that no test can check for you:

- **Frontmatter property names are always settings**, never literals in logic.
- **Nothing derived is written back.** Balances, variances and projections are
  recomputed on every render.

## Comments, commits and changelogs

**Comment for reasoning, not mechanics.** Why this approach rather than a
simpler one, what edge case a check guards, what a bug fix was fixing. Never
restate what the next line obviously does. Every `.ts` file opens with a short
JSDoc saying what it is responsible for and any non-obvious constraint. History
belongs in git.

**Commit subjects are prose, not conventional commits.** `nodatrail: five
columns that stand the same height` rather than `fix(ui): column height`. Say
what changed and, in the body, why.

**Changelogs are written by hand** and stay that way. Add your entry under
`## [Unreleased]` in the package you changed, under `### Added`, `### Changed`
or `### Fixed`, and write the vault consequence rather than the diff. They are
release notes a user reads inside Obsidian, not repository bookkeeping: all
three plugins compile their own `CHANGELOG.md` into the What's New panel.

## Reporting a bug

Issues go to
<https://github.com/technosoftware-gmbh/TRAILsuite/issues>. What helps most:
which plugin and which version (Settings, About), the Obsidian version, what
you expected the note to look like and what it looked like instead, and the
frontmatter of a note that shows the problem with anything private taken out.

**A security issue is not an ordinary issue.** See
[`SECURITY.md`](SECURITY.md).

## Conduct

Taking part here, in issues and in pull requests, means the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) applies to you and to us. It is
Contributor Covenant 2.1 and reporting goes to <support@technosoftware.com>.

## Questions

Anything the documents do not answer:
<support@technosoftware.com>. `docs/architecture.md` is the design and its
reasoning, each plugin's `docs/design/data-model.md` is every note format field
by field, and each package's `CLAUDE.md` says why the code is shaped the way it
is.
