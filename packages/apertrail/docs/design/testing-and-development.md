# Testing & development

## Toolchain

- **TypeScript** 5.9, bundled with **esbuild** (`esbuild.config.mjs`)
- **ESLint** 9 (flat config, `eslint.config.mjs`), including `eslint-plugin-obsidianmd`, the same ruleset Obsidian's own plugin review checks against, plus Prettier integration and unused-import detection
- **Vitest** 4 for unit tests (`vitest.config.mts`). The extension is `.mts`
  rather than `.ts` because the file is ESM and this package's `package.json`
  does not say `"type": "module"`: Vite's native config loader would otherwise
  read it as CommonJS and warn on every run. Every vitest config in the
  repository is `.mts` for that reason, including the core's, whose package
  would not have needed it
- **Prettier** (`.prettierrc`) for formatting

## Scripts

Run from `packages/apertrail`, or from the repository root with `--workspace packages/apertrail` appended. A bare `npm run <script>` at the root runs it for every package that has one.

| Command | What it does |
|---|---|
| `npm run dev` | Watch build via esbuild, rebuilding `main.js` on every source change |
| `npm run build` | `typecheck`, then a production esbuild bundle |
| `npm run typecheck` | `tsc --project tsconfig.check.json`, then `test:typecheck`. Both, because a fixture that stopped matching its type is the failure this catches |
| `npm run lint` / `npm run lint:fix` | ESLint, optionally auto-fixing |
| `npm run test` | `vitest run`, the full suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:typecheck` | Type-checks the `tests/` tree against `tests/tsconfig.json`. Run by `typecheck` above; kept separately for running it alone |

### Why the tests are type-checked

They were not, for a long time, and the cost was invisible by construction: a
fixture is a hand-written literal annotated with the type it claims to be, so
when the type grows a field the fixture silently keeps producing the old shape
and the suite goes on passing while testing something that can no longer exist.

Three of those were found on the day this was wired in, in one package each:

- A `TripPropertyNames` literal carrying `undefined` for five settings added
  that morning, so the suite meant to cover them covered nothing.
- Bill and recurring fixtures missing `account`, `paidFrom`, `lines` and
  `direction`, and still setting a `documentPath` that was renamed to
  `documentPaths` when a note could carry several.
- A day-entry draft still passing `important: false`, replaced by the four
  named priority levels, and never passing a priority at all.

None of them broke a test. That is the point: the compiler is the only thing
that notices, and only if it is pointed at the tests.

## Running the suite from a Cowork sandbox

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
accepted and ignored. The version has to match the installed `rolldown`, 1.2.3
today.

This cannot be declared in `package.json`. The binding sets `os: [linux]`,
`cpu: [arm64]` and `libc: [glibc]` on itself, so npm skips it as an optional
dependency on macOS and rejects it as a required one. Re-run the command after any
`npm ci`, which removes `node_modules` entirely.

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

Clear it from the Mac, where unlink is permitted, and look for more than
`index.lock`: a commit takes `.git/HEAD.lock` too, and an amend takes both.

```
find .git -name '*.lock*' -delete
```

The sandbox cannot delete a lock, but it can rename one, because `mv` within
the mount is permitted even where `rm` is not. That is what lets a commit be
made from there rather than only avoided.
[CULItrail's copy of this page](../../../culitrail/docs/design/testing-and-development.md#git-in-a-cowork-sandbox-strands-a-lock-file)
carries the full workaround, including where to rename to and the author
identity a sandbox commit has to pass explicitly; it applies to this package
unchanged, since the lock is the repository's rather than a package's.

`git diff` and `git log` strand nothing. `git status` does, despite reading
like one, because it refreshes the index.

## How the suite is shaped

25 test files, 324 tests. `tests/` is flat even though `src/` is grouped into modules (`vault/`, `trips/`, `places/`, `crm/`), because a test file is named after the unit it covers and there are not enough of them for the nesting to buy anything. Two shared helpers do the heavy lifting:

- **`tests/setup.ts`** initializes `I18nManager` with the English tables before any test file runs, so code under test that calls `t()` (note rendering, the localized folder defaults) gets real strings rather than raw key paths. Production always has the same guarantee from `main.ts`'s `onload()`.
- **`tests/fake-vault.ts`** is a minimal in-memory fake of exactly the Obsidian surface the readers and writers touch: `getMarkdownFiles()`, `getFileCache().frontmatter`, `create()`, `createFolder()`, `getAbstractFileByPath()`. Not a general harness. The `obsidian` npm package ships type definitions only, with no runtime, so each suite that needs `stringifyYaml`/`normalizePath` mocks the module itself.

That is possible because **pure logic is kept free of `obsidian` imports wherever practical**, specifically so it can be tested without mocking `App`/`TFile`. `trips/trip-note.ts` (build and parse) is split from `trips/write-trip.ts` (the file-writing side); `places/photo-spot-note.ts` is split from `places/write-photo-spot.ts` the same way; `trips/itinerary-days.ts` (day grouping) is split from the block that renders it. When a test needs an implausible mock to run, that is usually the code telling you about a dependency it should not have.

Fixtures use the default folder layout (`Trips/...`, `Places/Cities/...`) and English note names, so a test path reads the same way a real vault's does and a fixture can be checked against the sample vault by eye.

## What each suite covers

| Suite | Covers |
|---|---|
| `read-entities.test.ts` | The Country/State/City cycle resolving in both directions, plus the defensive cases that matter more than the happy path: an unresolved wikilink reads as `null` rather than throwing, a note whose `type:` disagrees with its folder is excluded, a non-wikilink-shaped value is treated as absent rather than guessed at, a malformed `geoLocation` reads as `null` |
| `create-entities.test.ts` | That each creation function writes exactly the minimal frontmatter and nothing cosmetic, that optional relationships are omitted rather than written empty, and that an existing path is refused rather than overwritten |
| `trip-note.test.ts` | The Trip frontmatter schema, round-tripping `buildTripFrontmatter()` against `parseTripRecord()` directly: empty lists omitted, datetimes written as strings so YAML cannot coerce them to a `Date`, a stop with no place dropped, an unrecognized `travelStatus` read as `null`, a malformed stop kept so a typo does not look like a deletion, renamed property names surviving the round trip, and the date-derived status fallback in all its cases |
| `write-trip.test.ts` | What actually lands on disk, and the part that matters most, what an edit leaves alone: frontmatter outside the Trip schema is untouched, a key the edit emptied is cleared rather than left stale, `modified` is restamped, `created` is left for the vault to own, and the body gets an itinerary block and nothing else |
| `trip-read.test.ts` | The cross-reference pass: persons, cities and stop targets resolving, stop order preserved rather than re-sorted by time, an unresolvable target left `null` but its row kept, times surviving on departures and stops, and the documented City-beats-place tie-break |
| `visit-derivation.test.ts` | Deriving `visited`/`lastVisit` from finished trips, pure: only `Over` trips count, the stop time falls back to the trip's return and then departure, an undated visit still counts, an explicit flag or a newer hand-written date wins |
| `trip-read-visits.test.ts` | The same derivation end to end through the board reader, on a vault where every note's own `visited:` is false and every visit is evidence carried by a trip, including the count the dashboard's "countries visited" tile shows |
| `travel-dashboard.test.ts` | The derived layer: `countryVisitInfo()`'s four cases, the stats row (including a status outside the fixed enum being ignored rather than producing `NaN`), and all four dashboard sort orders |
| `related-trips.test.ts` | The reverse lookup: which trips stopped at a title, most recent first regardless of status, undated last, both rows kept when one trip visits a place twice, unresolved stops ignored |
| `itinerary-block.test.ts` | The block's one piece of non-DOM logic, `groupStopsByDay()` and `spannedDates()`: untimed stops attaching to the day being built, a leading undated group, two visits to the same day separated by another day not merging, a leg crossing midnight spanning two dates |
| `photo-spot-note.test.ts` | The photo spot schema both ways: nothing written for an unfilled spot, optional keys omitted rather than emptied, a full round trip through builder and parser, a nameless motif kept on read but dropped on write, a light value outside the fixed vocabulary discarded, a scalar accepted where a list is expected because that is what the property editor produces, and direction parsed from degrees or English/German compass points |
| `write-photo-spot.test.ts` | The photo spot edit path: the block seeded at creation and only on photo spots, frontmatter outside the schema untouched, `visited`/`lastVisit` never written because they may be derived, an emptied key cleared, `modified` restamped |
| `photo-spot-view.test.ts` | The view model between note and block: the main motif promoted, secondaries left in note order, each sample filed under the motif it names (case- and space-insensitively), an unmatched sample kept under the spot rather than dropped, and the offset from the note anchor to a motif with its own coordinates |
| `solar.test.ts` | The offline sun calculation against published tables: sunrise, sunset and solar noon within 90 seconds, day length within a minute, the whole day ordered correctly, the polar cases reporting `null` rather than a made-up time, the light-window boundaries, and front/side/back-lit classification including the wrap at north |
| `trip-light.test.ts` | Light inside a trip: the day's anchor point, the sun band covering the whole bar exactly once (polar day and polar night included), golden-hour prefill from the main motif, the trip-wide shot list, and the walking-distance schedule conflicts, measured from the end of the earlier stop |
| `health-check.test.ts` | The eleven-folder type scan. The case that matters most is the longest-match rule, since the folders nest under a shared module root and a note would otherwise be judged against whichever configured folder happened to be checked first |
| `persons.test.ts` | Reading Person notes for the trip editor, with the empty-tag-filter default pinned down: an unconfigured filter means everyone, not nobody. Also a comma-separated tag string, a renamed type property, and a blank folder or type value returning nothing rather than matching everything |
| `settings.test.ts` | The module-folder model: Trips, Places and CRM at the vault root by default with no leading slash anywhere, every sub-folder derived from its module root rather than an independent literal, all three moving together under a configured common parent, a sub-folder the saved settings never carried landing under the **saved** module root, saved values surviving a round trip, and a non-string seed falling back to the default |
| `translation-keys.test.ts` | That every key `src/` asks for exists in **both** shipped locales and that the two tables are structurally identical |
| `crm-note.test.ts` | The pure CRM frontmatter parsers, with no `App` involved: the settings-to-property-name resolution, and the loose typing a real vault produces, a `tags` value that is a string, a list or absent, and a property left blank rather than removed |
| `read-crm.test.ts` | The App-facing half: which notes count as Person and Company notes, and what a renamed or blank type value or folder does. The type value is a setting here rather than a literal, which is what the cases are about |
| `create-crm.test.ts` | Person and Company note writing, including the two refusals the travel creators never needed, a blank folder and a blank type value, each asserted through `t()` rather than against a literal string |
| `crm-stats.test.ts` | The CRM stats row's one derived number, who you have actually travelled with, counted by the same `Over`-only rule `vault/visit-derivation.ts` applies to places, so the two cannot drift apart |
| `crm-contract.test.ts` | That APERtrail's own defaults still spell the seven shared-CRM fields the way `trail-core`'s `CRM_CONTRACT` does, both in `DEFAULT_SETTINGS` and after `mergeSettings()` has been given nothing. The values themselves are asserted in the core's suite; this asserts only that this plugin still agrees with them |
| `property-name-lock.test.ts` | That every settings row naming something inside a note goes through the one helper that can lock it. Checked by the shape of the setting's name (`Property`, `TypeValue`, `Field`, `FieldName`) rather than against a list, so the next one somebody adds inline is caught without anybody remembering |

Two of these earn special mention.

`settings.test.ts`'s "saved root wins" assertion is the one that protects a real vault. Adding a sub-folder setting is otherwise a silent way to start writing notes into a folder the owner never chose, and nobody notices until there are notes in two places.

`translation-keys.test.ts` exists because of a real bug: the Trip editor's translations were inserted under the wrong parent key, so the whole modal rendered raw key paths instead of labels, and nothing caught it. `t()` falls back to returning the key itself, the typechecker sees an untyped string, and no test rendered the modal. It is deliberately a static scan of the source rather than a typed key union: a union would be stronger, but it would mean regenerating a large type whenever a string is added, and this catches the same failure at a fraction of the cost. Keys built by interpolation are enumerated by hand in the test, which is the price of building a key name at runtime.

## What is not covered

The views, modals and settings sections are `App`-dependent DOM builders and are not unit-tested. That is the same boundary the rest of the codebase draws, and it has a consequence worth stating: divergences between the reader and a real vault's actual notes are invisible to the suite by construction. The tests assert the reader behaves correctly given input, not that a vault supplies input in that shape.

The [sample vault](sample-vault.md) is the manual counterpart to that gap. It is a small vault laid out in exactly the default structure, with real trips, places, people and a company in it, so the untested half (open the dashboard, open the gallery, render a trip's itinerary, render a photo spot) can be exercised by hand against notes that were not written by the same code that reads them.

## Code conventions

From `CLAUDE.md`. These explain a lot of why the code looks the way it does.

- **Small, single-purpose files.** Many small files over a few large multi-responsibility ones; a file doing more than one job gets split.
- **File headers.** Every `.ts` file gets a short JSDoc comment (1 to 4 lines) saying what it is responsible for and any non-obvious constraints. No created-date, no revision history, since git already owns that.
- **Comments explain why, not what.** No comment restating the obvious next line. Comments exist for the reasoning a developer six months later would actually need: why an approach was chosen over a simpler one, what edge case a check guards against, what a bug fix actually fixed and what was wrong before. This applies when revising code too, not just on first write.
- **Frontmatter access only through typed helpers** (`frontmatterOf()`, `findValue()`), never a raw `cache?.frontmatter?.[x]` cast at the call site.
- **Frontmatter property names are always configurable settings**, never hardcoded string literals, even for small easy-to-overlook fields. The three documented exceptions are in [Data model](data-model.md#property-names-are-settings-property-values-sometimes-are-not).
- **Promise handling discipline.** Async callbacks passed to DOM listeners or Obsidian `Setting`/button `onClick` handlers must not be bare `async () => {...}`. Either make the callback sync and `void` the async call inside it, or `void` it at the call site. No floating unawaited promises.
- **No `console.log`** in shipped code, no `innerHTML`/`outerHTML` (build DOM with `createEl`/`createSpan`/`empty()`, or use `.textContent`), no direct `element.style.x = ...` (CSS classes, or `setCssProps()` for genuinely dynamic values).
- **No em dashes** in anything shipped: source comments, README, in-app strings, and these docs.
- **Do not reach for `getMostRecentLeaf()`** when reacting to a file-open or file-menu event. Use the leaf the event gives you.
- **Settings that always travel together get one toggle**, not several, when two fields are never meaningfully used independently.
