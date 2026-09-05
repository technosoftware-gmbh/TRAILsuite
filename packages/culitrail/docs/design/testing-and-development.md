# Testing & development

> **Status: built.** Describes the setup this repo actually has.

## Toolchain

| Piece | Choice |
|---|---|
| Language | TypeScript 5.9, strict |
| Bundler | esbuild 0.28, one `main.js` beside this package's `package.json` |
| Tests | Vitest 4 |
| Lint | ESLint 9 with `typescript-eslint`, `eslint-plugin-obsidianmd`, `eslint-plugin-unused-imports` and Prettier |
| Format | Prettier, config in `.prettierrc` |

`eslint-plugin-obsidianmd` earns its place: it is what flags the
`innerHTML`, `console.log` and `element.style` patterns the conventions
below ban, rather than leaving them to review.

## Scripts

Run from `packages/culitrail`, or from the repository root with
`--workspace packages/culitrail` appended. A bare `npm run <script>` at the root
runs it for every package that has one.

| Script | Does |
|---|---|
| `npm run dev` | esbuild in watch mode; rebuilds `main.js` on every source change |
| `npm run build` | `typecheck` + production esbuild pass + lint |
| `npm run typecheck` | `tsc --project tsconfig.check.json`, then `test:typecheck`. Both, because a fixture that stopped matching its type is the failure this catches |
| `npm run lint` / `lint:fix` | ESLint over this package |
| `npm run test` | Vitest, one pass |
| `npm run test:watch` | Vitest, watching |
| `npm run test:typecheck` | Typechecks the test tree. Run by `typecheck` above; kept separately for running it alone. See [APERtrail's note](../../../apertrail/docs/design/testing-and-development.md#why-the-tests-are-type-checked) on what was found the day this was wired in -- CULItrail's own was a meal-plan note entry whose `id` was never set, so every fixture carried `undefined` where the type documents `''` |

`npm run lint` is expected to pass with **zero** errors. Keep it that way.

### Running the suite from a Cowork sandbox

`npm test` works on the Mac. Inside a Cowork sandbox it fails with `Cannot find
module './rolldown-binding.linux-arm64-gnu.node'`, and that error says nothing
about this repository: npm installs one platform binding for `rolldown`, the Mac
gets the darwin one, and the sandbox is Linux arm64 reading the same
`node_modules` over a mount.

Add the second binding alongside the first, from the Mac:

```
npm i --no-save --force @rolldown/binding-linux-arm64-gnu@1.2.3
```

`--force` is the flag that gets past the platform check. `--os` and `--cpu` look
like they should work and do not: they are not npm config keys, so they are
accepted and ignored. The version has to match the installed `rolldown`, which is
1.2.3 today.

This cannot be declared in `package.json`. The binding sets `os: [linux]`,
`cpu: [arm64]` and `libc: [glibc]` on itself, so npm skips it as an optional
dependency on macOS and rejects it as a required one. Re-run the command after
any `npm ci`, which removes `node_modules` entirely.

**`npm run build` needs the same treatment, one layer up.** It shells out to
esbuild, whose native binary is a platform package too, so in the sandbox it
fails with "You installed esbuild for another platform than the one you're
currently using" and names `@esbuild/darwin-arm64` as the one present. Same
cause, same fix, same reason it cannot be declared:

```
npm i --no-save --force @esbuild/linux-arm64@<esbuild version>
```

Match the installed esbuild (`node -p "require('esbuild/package.json').version"`).
With both binaries in place the whole gate runs in the sandbox, bundle included,
and the `main.js` it produces is the same one the Mac produces: esbuild's output
for a given version does not depend on the host.

### Git in a Cowork sandbox strands a lock file

The mount the sandbox reads the working tree through forbids `unlink`. Git
creates `.git/index.lock` whenever it refreshes the index, which includes a plain
`git status`, and then cannot remove it: that command prints `warning: unable to
unlink ... index.lock` and still succeeds, while every later git command that
writes fails with `Unable to create '.../index.lock': File exists.` and the
misleading advice that another git process is running. Nothing is half-committed
and nothing in the repo is wrong; the stranded lock is an empty file.

**It is not only `index.lock`.** A commit takes `.git/HEAD.lock` too, and an
amend takes both, so a repo can end up blocked on a lock the `index.lock`
advice does not name. Any `*.lock` under `.git/` is suspect after a write from
the sandbox.

Clear them from the Mac, where unlink is permitted:

```
find .git -name '*.lock*' -delete
```

**The sandbox can still get work done**, and it is worth knowing how, because
the avoidance ("do not run git from there") stops being an option the moment a
commit has to be made. `mv` within the mount is permitted even though `rm` is
not, so a stranded lock can be pushed out of the way rather than removed:

```
for f in .git/index.lock .git/HEAD.lock .git/refs/heads/main.lock; do
  [ -e "$f" ] && mv "$f" "$f.stale-$RANDOM"
done
```

Two things about doing it that way. The renamed files accumulate and still need
an `rm` from the Mac eventually, so say so rather than leaving them for somebody
to find; and rename **inside** `.git`, not into the working tree, because a
`_to_delete/` folder in the repo becomes something `eslint .` and `git add -A`
both pick up.

A commit from the sandbox also needs the author identity passed explicitly:
`git config` writes to a file it then cannot replace, so
`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` and the two `GIT_COMMITTER_*` variables go
on the command instead.

`git diff` and `git log` strand nothing. `git status` does, despite reading like
one, because it refreshes the index.

## How the suite is shaped

The rule that makes the suite possible: **the pure half of the model never
imports `obsidian`.** Parsing, scoring, rendering a note body to a string
and building frontmatter from a record are all plain functions over plain
data, with the `App`-dependent wrapper sitting beside them in a separate
file.

That split is not for testing's sake alone, but it is what lets the suite
run without mocking `App` at all. Where a test would need `App`, the right
move is almost always to find the pure function underneath rather than to
build a mock.

## What each suite covers

65 files and 944 cases, of which **926 run and pass**: the only cases that ever
skip are the **eighteen** of `sample-vault.test.ts`, which skips as a whole when
the sample vault is not beside the repo. `trail-core` adds 1,330 over 59 files
and runs clean, APERtrail 493 over 42 with nothing skipped, and NODAtrail 579 of
586 over 65, its own seven skipping for the same sample-vault reason. There are
four packages now, so a green four-package gate is 3,328 passing cases, or 3,333
with the suite's own `package-boundary.test.ts`. Counted from a run on 29 August
2026; re-read them off `npm test` rather than trusting the paragraph. Grouped below by what they
are for rather than listed alphabetically, because the interesting question
about a suite is which failure it exists to catch.

**The contracts.** These fail on a whole class of mistake rather than on one
behaviour, and they are the ones worth keeping alive.

| Suite | Covers |
|---|---|
| `translation-keys.test.ts` | Statically scans `src/` for literal `t('...')` calls, checks every key against both tables, asserts the two are structurally identical, and fails on a key nothing asks for. Interpolated keys are enumerated from the constants that drive them, so an operator or an appliance added without a label fails here |
| `settings-coverage.test.ts` | Every setting has a control on the settings page. A setting with no row is invisible: not an error, not a type error, simply unchangeable. Coverage counts assignment, not mention, and the exemption list says why each absence is deliberate. Two exemptions are left and both are permanent, because both are state rather than configuration |
| `crm-contract.test.ts` | The nine shared-CRM fields still match `trail-core`'s `CRM_CONTRACT`. The values themselves are asserted in the core's own suite; this asserts only that CULItrail has not drifted from them, because the symptom of drift is an empty list rather than an error |
| `sample-vault.test.ts` | Seeds `sampleNotes()` into a fake vault, reads it back with the real parsers, and asserts every claim `sample-vault.md` makes about it, including that every wikilink resolves. It replaced a suite that read a vault beside the repo and skipped when it was not there, which is to say it never ran |
| `scaffold.test.ts` | The repo's own shape: the manifest, the build config, the folders |
| `no-em-dash.test.ts` | No U+2014 in a TypeScript **comment** or in Markdown **prose**. Comments come from the TypeScript scanner's trivia rather than a regex, which cannot tell a comment from an apostrophe in a string; Markdown has its fenced and inline code stripped first. Nothing is exempted by name, which is what makes it worth having: a regex that matches an em dash, a test asserting its absence, and a page quoting some other tool's output all pass because the check never looks at code |
| `stylesheet.test.ts` | Each class declared in exactly one bare rule, braces balanced with no dangling selector, and no rule for a class the source never applies. It exists because a name used for two unrelated things is invisible in a diff, in a typecheck and in every other test: `.culi-step` was both a stepper button and a step `<li>`, and every step in a meal collapsed into a 1.75rem box |
| `render-race.test.ts` | Between emptying a container and drawing into it there must be no await. The meal view emptied its container on the first line of `render()` and built the meal after two reads, so a save that tripped two redraws within a few milliseconds put the whole meal on screen twice. A source scan over every method in the package rather than over the one that was wrong, because the shape is easy to reintroduce and impossible to see in a diff |
| `icon-slot.test.ts` | Every `setIcon()` call targets a slot span inside a button, never the button itself. Icon-only buttons drew nothing at all on an iPad while the labelled ones beside them were fine, and the mechanism was never pinned down, which is the honest reason this is a test rather than a comment: the broken version is the one that looks right on the machine it was written on |
| `ui-conventions.test.ts` | This package's half of `docs/ui-conventions.md`, asserted rather than trusted. Every rule in it is silent when broken: none fails to compile and most do not fail lint. Where a query into the plugin's own DOM is legitimate it is named with its reason instead of the rule being dropped, and an exemption that has stopped being true fails too |
| `property-name-lock.test.ts` | Every settings row naming something inside a note is rendered through the one helper that can lock it. Checked by the shape of the setting's name (`Property`, `TypeValue`, `Field`, `FieldName`) rather than against a list, so the next one somebody adds inline is caught by the same pattern that caught the current eighty-three |

**The parsers**, which is where most of the risk lives, because they read
prose somebody else wrote.

| Suite | Covers |
|---|---|
| `meal-body.test.ts`, `body-clean.test.ts` | Section extraction under configured headings, sub-heading groups, the frontmatter meta beside them, body cleanup, and a note with no headings at all. Both halves of the cleanup matter: removing too little shows the title and the photo twice, removing too much silently drops a line the note still holds |
| `read-meal.test.ts` | Reading a meal off disk, plus the auto-open decision, whose suppression window is timed rather than consume-once because one `setViewState()` fires two events |
| `reheating.test.ts` | Appliance matching in both locales including an unknown appliance that still renders, the section parser over prose and lists, and **one case per row of the merge-rule table** in `ready-meals.md` including the withheld-token row. Two cases come from real notes rather than from imagination: a fenced block inside the section, and `## Eating History` nested under `# Reheating` |
| `meal-plan-note.test.ts`, `plan-note.test.ts` | Round-tripping a plan note: parse, mutate, render, parse again. The edit half pins that changing one field on a line leaves everything else on it alone, including a ticked box, an id and inline fields this plugin does not model |
| `eating-history.test.ts`, `eating-history-write.test.ts`, `legacy-id-markers.test.ts` | Both shapes a vault keeps a log in, the body-section merge that leaves hand-written lines alone, and the three id markers this code has written under its three names (`rb-id`, `cul-id`, `culi-id`), all of which are still in real vaults |
| `record-eating.test.ts`, `eating-events.test.ts` | A meal eaten, written onto the plan line rather than beside it: recording something already planned ticks that line instead of adding a second, and the line it leaves is one this parser reads back in the shape `trail-core` defines |
| `legacy-plan-body.test.ts` | Reading a plan note nobody has converted yet. It gets its own suite because the conversion runs exactly once per note and then never again, and a converter that misreads a week does not fail loudly: it writes a smaller week, and the meals it dropped look like meals nobody planned |

**The models.**

| Suite | Covers |
|---|---|
| `settings.test.ts`, `foreign-settings-import.test.ts` | Merging and validating a hand-edited `data.json`; deriving every sub-folder from its root, including the saved-root case; the first-load adoption of a sibling plugin's CRM settings, which reads a file rather than a plugin and looks like a fresh vault in every failure mode |
| `date-utils.test.ts`, `note-path.test.ts` | The week-title-to-filename chain round-tripped in five real timezones, every week from 2015 to 2040, which is the regression test for notes being filed a week early west of Greenwich; ISO week identity across a year boundary, where `{GGGG}`/`{WW}` and `{YYYY}`/`{ww}` disagree; `{token}` path resolution. The date primitives themselves are tested in `trail-core` |
| `read-notes.test.ts` | The half of the folder-AND-type rule this plugin still owns: each of the four kinds reaching its own folder, meals and only meals spanning more than one, and either half left blank hiding that folder rather than claiming the vault |
| `note-stamps.test.ts` | The `created`/`modified` header through the shim onto the core's vault host, and CULItrail's own rule that one logical save is one stamp however many passes it takes |
| `meal-plan-sync.test.ts` | The reconciliation of a note against state, where the note always wins: the same meal twice in one week, a line edited rather than deleted, and an entry belonging to somebody no longer in the vault |
| `orders.test.ts`, `order-defaults.test.ts`, `order-invoice.test.ts`, `related-orders.test.ts` | The writer round-tripped through the reader and a real v1 flat-property note upgraded; the arithmetic, including that a price lives in the order rather than being looked up, with the totals themselves tested in `trail-core`; the format-agnostic invoice model, whose hardest case is the unpriced order that must show no arithmetic at all; and which orders a Person or Company note is the subject of |
| `crm.test.ts` | Person and Company reading, and the tag filter where empty means everyone |
| `company-terms.test.ts` | What a company charges, read off its note. The interesting half is the discount ladder, typed by hand into frontmatter and therefore arriving in whatever shape and order somebody felt like. The unit-agnostic promise is asserted here too: nothing the module returns knows it is counting meals, which is what would let it move to `trail-core` unchanged the day APERtrail wants the same block for hotels |
| `deliveries.test.ts`, `delivery-note.test.ts` | The delivery note, whose shape is deliberately the order note's so the two read alike. What is tested is the part that differs: a delivery links to orders rather than being owned by one. The second suite is the document adapter, and its two rules are the point of the file: **no money anywhere**, and the quantity column appearing exactly when the portions total would otherwise look unaccountable |
| `meal-vocabulary.test.ts` | What a meal field offers, and the one value it must never drop. A `<select>` whose value matches no option falls back to its first, so an option list omitting what the note already says rewrites the note on the next save without anybody pressing anything: a diet lost that way is a badge changing colour, a product line lost that way moves a meal to a range with different prices |
| `badge-label-rename.test.ts` | A built-in badge whose `labelKey` was renamed after somebody saved their header. The key is persisted as a string and `t()` answers an unknown one with the key itself, so a stale key renders `BADGES.BUILTIN.REHEAT` where a word should be and also makes the badge unrecognisable to `withMissingBuiltins()`, which then appends a second copy of it. Found in a real vault |
| `meal-supplier-fields.test.ts` | The two fields a meal gained when it stopped being a recipe, its supplier's range and its price currency. The currency is the interesting one because it is a chain rather than a value, walked by every view that shows a price, and two views walking it differently would both render a plausible number under a plausible symbol |
| `picker-order.test.ts` | What the meal picker offers first, and the rule that is easy to "improve" into a bug: the last delivery sorts to the top, it does not filter the list. A freezer holds more than the last box |
| `field-discovery.test.ts` | What the badge editor's property picker is allowed to offer, and what type it infers for a property seen across many notes |
| `orders-toolbar.test.ts` | What the orders view's filter leaves on screen and what its sort puts first. The two rules worth pinning are about absence: a missing value sorts last in both directions, and "no delivery logged" is a question about the delivery note rather than about the order |
| `create-meal.test.ts` | A new meal note carries the configured `type:`, carries no section headings, and never lands on a note that is already there |
| `meal-editor-nutrition.test.ts` | The editor's whole per-100 g path, driven through the real `readMealDraft` and `writeMealDraft`: the fallback read out of the two retired body sections, frontmatter winning over a stale one, the round trip, both sections removed with a `# Reheating` section under them intact byte for byte, an unknown nutrient surviving an edit to another row, and the two fixed bugs (no serving weight derives nulls rather than `calories: 0`; a note keyed `kcal:` keeps that key instead of gaining a second). Its two fixtures are copied byte for byte out of the real vault, blank `- **Sodium:** ` row and all |
| `migrate-meal-nutrition.test.ts` | One of the two scripts that edit somebody's notes rather than the code that reads them, so most of what is pinned is what it must **not** do: the five states a vault's notes are in and the right answer for each, the per-serving figures left exactly as they are even where a serving weight was corrected by hand, every other line of the body and of the frontmatter block byte for byte, a second run as a no-op, and the four refusals (unparseable frontmatter, one of the four keys already present with something else in it, that key in another case, no block at all). The dry run's diff is asserted by applying it back onto the original, and `verify-meal-nutrition.ts` is driven through the same fixtures with each of its checks made to fail once. Every fixture is a real meal, including the hand-tidied note that lost its bold markers and the one meal in the vault with no label at all |
| `strip-default-serving-size.test.ts` | The other one, and a smaller job with a stricter refusal: taking `default_serving_size` off a meal note. What is pinned is that exactly one line goes and every other line of the block and the whole body stay byte for byte, that a second run finds nothing to do, that a blank value goes whatever the note says elsewhere, and the refusals, each of which fires on a note this vault does not have: a value that disagrees with `serving_size`, a `serving_size` that is absent or blank while this one states a weight, the key stated twice, a value running past one line, and frontmatter that does not parse. `440g`, `440 g` and `440` count as one weight; two values neither of which reads as a number do not. Every fixture is a real note, including both of the two meals whose serving weight is blank in both places |

**The view models**, all of which decide something before anything touches the
DOM.

| Suite | Covers |
|---|---|
| `nutrition-breakdown.test.ts` | The per-100 g card as rows of text, through the real `readMealMeta`: an unmigrated note and its converted twin producing identical rows, `Sodium` reading as Salt with the figure untouched, declaration order out of a scrambled list, units rendered as stored, a named-but-unmeasured nutrient as a dash and explicitly not as `0`, an unknown nutrient rendered as typed in both locales, and the heading exclusion that stops a legacy section being offered as a raw card beside the rendered one |
| `badge-values.test.ts`, `stat-strip.test.ts`, `nutrition-row.test.ts`, `card-face.test.ts` | Badge formulas, aliases, arrays and layout; the cell-or-chip rule that decides a badge's form; the nutrition caption, which is a wrong label on a number somebody might act on if it gets the basis wrong; and the three fixed rows of a gallery card, whose heights are what keep neighbouring cards the same size |
| `gallery.test.ts`, `library-stats.test.ts`, `hero-image.test.ts`, `images.test.ts` | Filtering and ordering as plain functions over entries read once; the dashboard's library counts and the judgements inside them; which picture a meal shows and where it was found; and turning an `image:` value into a file, including the `![[photo.jpg]]` embed form that used to resolve to nothing |
| `eating-activity.test.ts`, `eating-streak.test.ts`, `day-agenda.test.ts`, `meal-plan-carousel.test.ts` | Local-time bucketing for the dashboard chart, ISO-week arithmetic for the streak, the Monday-first weekday mapping that `getDay()` gets wrong, and the carousel's deliberate queue-then-Monday ordering |
| `mobile-view-model.test.ts`, `i18n.test.ts`, `folder-click.test.ts`, `list-editor.test.ts` | The mobile decisions that need no phone, `I18nManager`'s degrade-rather-than-throw behaviour, the blank-folder guard on the explorer shortcut, and list reordering, which is load-bearing because a badge list is a header layout and a mode's rule order is its weighting |

## What is not covered

Named so nobody assumes otherwise:

- **No view or DOM tests.** Every `ItemView` and modal is exercised by
  hand. The pure functions under them are tested; the rendering is not.
- **No network tests, because there is no network.** Nothing in the plugin
  fetches anything: the web importer and the packaged-food lookup were removed
  along with cooking, and `requestUrl` appears nowhere in `src/`.
- **No mobile-layout tests.** The deliberate desktop/mobile divergences are
  documented rather than asserted.
- **No write test for the sample vault.** `writeSampleVault()` serialises
  through Obsidian's own `stringifyYaml`, which has no runtime under Node (see
  `tests/obsidian-stub.ts`), so the suite asserts the frontmatter **object** the
  writer would hand it and the block it would print into is the suite's own.
  What the planner would do with that set, including the refusal rule and the
  block append, is asserted; the four lines that turn it into files are not.

  This bullet used to record something worse: the sample-vault suite read a
  vault that was never in the repository and **skipped silently** when it was
  absent, which on the development machine was always. A green `npm test` read
  identically to one that had checked eighteen cases and checked none. The notes
  are a function in the package now and the suite runs every time.

## Code conventions

From `CLAUDE.md`, repeated here because they shape what review looks for:

- **Comment for reasoning, not mechanics.** A comment that restates the
  next line is noise. A comment explaining why this approach beat a simpler
  one, what edge case a check guards, or what was wrong before a fix is
  what a reader needs six months later. This applies when revising code too:
  do not leave old reasoning next to new behaviour.
- **History belongs in git, not in comments.** Describe what the code does
  today; do not narrate where a file used to live or what it used to be
  called.
- **Small, single-purpose files.** If a file is doing more than one job,
  split it.
- **File headers.** Every `.ts` file gets a 1 to 4 line JSDoc comment at the
  top: what it is responsible for, and any non-obvious constraint. No
  created-date, no revision history. Do not pad simple files to match a
  template.
- **No em dashes** in comments, docs or any user-facing text shipped as
  part of the plugin. `no-em-dash.test.ts` enforces this, and it exists because
  the rule was written down for months and broken four times anyway, including in
  a constant that rendered on screen. An en dash is the thing to reach for
  instead. `CLAUDE.md` is exempt because it is not shipped.
- **Frontmatter access goes through typed helpers**, never a raw
  `cache?.frontmatter?.[x]` cast at a call site.
- **Frontmatter property names are always settings**, never a hardcoded
  string literal in logic. So are all four `type:` values.
- **Promise handling.** An async callback passed to a DOM event listener or
  an Obsidian `Setting` / button `onClick` must not be a bare
  `async () => {...}`. Make the callback sync and `void` the async call
  inside it, or `void` it at the call site. Never leave a floating promise.
- **Do not reach for `getMostRecentLeaf()`** when reacting to a specific
  file-open or file-menu event. It is unreliable for fast tab-creation
  sequences. Use the leaf the event gives you.
- **Styling.** No `element.style.x = ...`. CSS classes for binary states,
  `setCssProps()` only for genuinely dynamic runtime values.
- **No `console.log`** in shipped code. Obsidian's review flags it.
- **No `innerHTML`/`outerHTML`.** Build DOM with
  `createEl`/`createSpan`/`empty()`, or `.textContent`.
- **Settings that always travel together get one field, not several.**
  `gallerySavedState` is the worked example.
- **Every new user-facing string goes in both `en.ts` and `de.ts`** in the
  same commit. `translation-keys.test.ts` fails otherwise, and it also fails
  if a `t()` call references a key neither table has.

## Working with the inherited code

`src/meals/` and `src/orders/` did not start on a blank page, and a good deal
of that lineage is still readable in the file names. Two things are worth
knowing while working in there:

- **The stylesheet is an audit, not a copy.** The `styles.css` this code
  inherited covered more than this plugin does, and every class in it was
  renamed to the `culi-` prefix in one pass. Every removal since, cooking most
  recently, has to take its rules with it: `stylesheet.test.ts` fails on a rule
  for a class the source never applies, which is the only cheap way to find
  dead CSS.
- **Nothing is vendored any more.** The archived scraper library that arrived
  with the importer went with it, and `src/` now contains no third-party source
  at all. The eslint, prettier and em-dash configs still skip a vendored path
  that no longer exists; leave that alone or remove it deliberately, but do not
  reintroduce something for it to point at.
