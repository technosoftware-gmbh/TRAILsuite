# TRAILcore - working notes for Claude Code

The shared core behind APERtrail, CULItrail and NODAtrail. TypeScript, no
bundler:
this is a library, compiled with `tsc` and bundled by whoever consumes it.

## The one rule

**Nothing here may import `obsidian`, touch the DOM, read the filesystem, or
call `new Date()` without an injectable override.**

Enforced by `eslint`'s `no-restricted-imports` and `no-restricted-globals`, and
by `tests/obsidian-free.test.ts`, which reads the source itself, because a lint
rule is only run when somebody runs lint and can be silenced by the same edit
that breaks it.

**`tsconfig.json` loads the DOM lib, and that is deliberate.** `src/obsidian/`
builds elements, and Obsidian's typings augment `HTMLElement` rather than
declaring it: without the lib, `container.createDiv()` resolves to an error type
and every call in `render-invoice.ts` fails lint. A lib cannot be scoped to one
directory, which is why the two rules above exist -- the compiler no longer says
no to `document` in a pure module, so the linter and the test do.

When a module genuinely needs the vault, it takes a port (an interface declared
here) rather than an `App`. The Obsidian implementation of those ports lives in
`src/obsidian/` and is the only directory exempt from the rule.

## Build

- `npm run check` - typecheck, lint and test. Run this before anything else.
- `npm run build` - `tsc` into `dist/`. Also runs as `prepare`, which is how the
  root `npm install` builds the core before a plugin typechecks against it.

No platform-binding workaround is needed here, unlike the plugin repos: this
package has no esbuild and no rolldown.

## Code conventions

Inherited from the plugin repos, and worth keeping identical so code can
move between them without reformatting:

- **Comment generously, but for reasoning, not mechanics.** Explain why an
  approach was chosen, what edge case a check guards, what a bug fix was fixing.
  Never restate what the next line obviously does.
- **File headers.** Every `.ts` file opens with a short JSDoc: what it is
  responsible for, and any non-obvious constraint. No revision history.
- **No em dashes** anywhere in source, comments or docs.
- **Small, single-purpose files.**
- **History belongs in git, not in comments.**
- Prettier settings match the plugin repos exactly (`.prettierrc`).

## What belongs here

A module earns its place here in one of three ways, and they are three different
questions. Ask which one applies before moving anything.

**Behaviour moves on the two-consumer test.** One consumer is a module that
belongs in its plugin; two is a contract. This is the rule that stops the
package becoming a junk drawer, and CULItrail's `shared/expr-eval.ts` is the
worked example of pure, tempting, single-consumer code that stays put. `crm`,
`dates`, `frontmatter`, `links`, `paths`, `settings`, `vault` and the `obsidian`
adapter are here on this test: all three plugins import from every one of them,
which
is checkable by grepping their `src/` trees for `trail-core`.

**A note format belongs here on its own merits, whatever the number of readers.**
A format is a statement about a file rather than about the code in front of it.
The notes in a vault outlive every view ever built over them, and a format
defined inside the code that renders it is redefined whenever the rendering
changes: a property comes back spelled one way this release and another the
next, and a line one half writes stops being a line the other half can read.
That argument does not count consumers and does not need to. So `meal`, `plan`,
`order`, `delivery` and `reheating` are here although only CULItrail imports
them, and the CRM note format is here on this test as well as the first. What a
plugin keeps is what it *does* with a format: the view, the modal, the wording.
`order/total.ts` was once named in this file as an example of what stays out,
back when nothing here read an order. It came in under this test, not the
first: what an order's lines add up to is fixed by what the note says, and two
views that disagreed about a total would disagree about the note.

**The same test brought the finance side in, and NODAtrail is its only reader.**
`expense` is the purchase, bill, recurring-cost and budget note formats;
`ledger` is the account, the posting and the journal block it lives in; `period`
is the five periodic-note levels and their path templates; `tasks` is the
Obsidian Tasks checkbox line. Each is a statement about a file rather than about
a view, which is the whole of the argument: a household's postings outlive every
report ever run over them. `document`, the format-agnostic invoice model, came
in on the two-consumer test instead, the day the delivery note became a second
consumer of what the order view was already doing.

**Arithmetic about the world belongs here too, for the same kind of reason.**
`geo` and `solar` are imported by APERtrail alone. They are here because a
haversine and a NOAA solar solve answer questions that have nothing to do with
photography: where the sun is at a place on a date is a fact, and a fact is not
a product's to own. The tests say the same thing from both ends -- the core
checks `sunTimes` against published tables and against its own definitions,
while APERtrail's `tests/solar.test.ts` checks only what *that plugin* means by
"blue hour, morning".

**Where the third line falls in practice.** The sun arithmetic is here;
`lightWindowRange`, which maps APERtrail's own light window vocabulary onto
those times, is in APERtrail, because which words a photo spot may use for its
light is that app's schema. The boundaries are here and the names for the spans
between them are not. Product logic never moves here on the strength of being
tidy: the trip and photo-spot schemas belong to APERtrail, and this package
holds no view, no string and no settings object.

**No user-facing strings.** The core throws typed errors and lets the caller
translate. A module that wants to call `t()` is a module that belongs in a
plugin.

## Licence care

MIT here. CULItrail is GPL-3.0-or-later, and APERtrail and NODAtrail are both
PolyForm Noncommercial 1.0.0; MIT flows into all three and none of them flows
back.

Both directions of that are Technosoftware GmbH's to decide while the copyright
in all four packages is Technosoftware GmbH's, which is how `geo/` and
`solar/` came here from a PolyForm repository. It is worth writing down rather
than assuming: relicensing your own code is a right, and it stops being a simple
one the day somebody outside the company contributes to those files.

**Before adopting a file from CULItrail, confirm it has no Recipe Box lineage.**
CULItrail descends in part from Recipe Box (GPL-3.0-or-later) and cannot relicense
that code. Its `CLAUDE.md` says "beyond the inherited Recipe Box code, this is a
clean-room implementation", which is a claim to verify per file, not to assume.
A file whose lineage cannot be established stays where it is. The vendored
code that descends from it never moves.

## When unsure

Ask before guessing on: whether a module has earned promotion, anything that
changes a default the plugins agree on, and anything that would make this
package depend on a host.
