# APERtrail - working notes for Claude Code

Obsidian plugin (TypeScript, esbuild). "Open the perfect path": a travel
planner built around Trips, a Country/State/City hierarchy, and five kinds
of reusable place note. The product direction is travel planning for
photography (journeys built around vantage points, light and perspective),
and as of the Photo spot type that direction is shipped rather than
aspirational: motifs, an offline sun calculation, light-aware trip stops.
See docs/design/photo-spots.md.

The vault layout and `src/` are both organized as three modules -- Trips,
Places and CRM -- so the plugin can grow one module at a time. All three
ship: CRM reads and creates both People and Companies, and has its own
dashboard. See the architecture notes below.

This is a clean-room implementation. Do not reference, port, or compare
against any other plugin's source.

License: PolyForm Noncommercial License 1.0.0.

## Build

- `npm run dev` - watch build
- `npm run build` - typecheck + production build
- `npm run lint` / `npm run lint:fix`
- `npm run test` - unit tests

`npm run lint` is expected to pass with zero errors. Keep it that way.

**`npm test` needs one extra step inside a Cowork sandbox.** `node_modules`
installed on the Mac carries only `@rolldown/binding-darwin-arm64`, because npm
installs the one platform binding matching the machine it runs on. Cowork's
sandbox is Linux arm64, so vitest there fails with `Cannot find module
'./rolldown-binding.linux-arm64-gnu.node'`. **This is not a broken repo**: on the
Mac `npm test` works, and that error only means the sandbox is reading a macOS
`node_modules`.

Add the second binding alongside the first, from the Mac:

```
npm i --no-save --force @rolldown/binding-linux-arm64-gnu@1.2.3
```

`--force` is what gets past the platform check; `--os`/`--cpu` are not npm config
keys and are silently ignored. The version must match the installed `rolldown`
(1.2.3 here; `node -p "require('rolldown/package.json').version"` after an upgrade).
Both bindings coexist and nothing else changes.

It cannot go in `package.json`: the binding declares `os: [linux]`,
`cpu: [arm64]`, `libc: [glibc]`, so npm skips or rejects it on macOS. Re-run the
command after any `npm ci`, which deletes `node_modules` outright.

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

## Naming conventions

These are deliberate and worth not undoing by accident:

- **Settings keys carry no prefix.** `tripsFolder`, `countryProperty`, not
  `travelTripsFolder`. The module a setting belongs to is expressed by the
  settings tab's grouping, not by the key.
- **CSS classes all use one `apt-` prefix.** One prefix for the whole UI
  kit, including anything a module contributes.
- **Translation keys have no top-level namespace.** `dashboard.x`, not
  `travel.dashboard.x`.
- **The two oldest code-block languages stay `travel-itinerary` and
  `travel-related-trips`.** These are written into the user's own trip
  notes, so they are data, not internal naming. Renaming them would orphan
  every block that already exists. Do not "fix" them for consistency with
  the `apt-` prefix; the CSS class on the rendered element is
  `apt-itinerary` and only the fence language keeps the old spelling.
  A Person note carries the same `travel-related-trips` block a City or
  place does, and that is not a reason to rename or fork it: it is one
  block answering the same shape of question about one more kind of note.
  **Every genuinely new block takes `apt-`**, starting with
  `apt-photo-spot`: that argument only ever protected strings already in
  someone's vault, and a photo spot note is useful with no trip in sight,
  so filing it under `travel-` would name a relationship it does not have.
- **`Travel*` domain type names are kept** (`TravelTrip`, `TravelCountry`,
  `TRAVEL_ENTITY_TYPES`, ...). They read fine in a travel plugin.
- **The plugin's settings are reached via `plugin.getSettings()`**, not a
  `settings` getter: Obsidian's own `Plugin` declares a `settings` member,
  and overriding a property with an accessor is a type error.

## Code conventions

- **Comment generously, but for reasoning, not mechanics.** Don't write
  a comment that just restates what the next line obviously does (e.g.
  // increment the counter above counter++). Do write a comment when
  the why isn't obvious from the code alone: why this approach was
  chosen over a simpler one, what edge case or bug a particular check is
  guarding against, what tradeoff is being made, or what prompted a piece
  of logic to be written the way it is (especially after a bug fix --
  explain what was wrong before, not just what the fix does). Aim for
  comments a developer reading the code six months from now would
  actually need, not ones that pad the file. This applies throughout, not
  just on first-write -- when fixing a bug or revising existing logic,
  update or add a comment explaining the change, don't leave the old
  reasoning (or no reasoning) sitting next to new behavior.
- **History belongs in git, not in comments.** Describe how the code
  behaves today; do not narrate where a file used to live or what it was
  called before.
- **Small, single-purpose files.** Prefer many small files over a few
  large ones with multiple responsibilities. If a file is doing more than
  one job, split it.
- **File headers.** Every `.ts` file gets a short JSDoc comment at the
  top: 1-4 lines, what the file is responsible for and any non-obvious
  constraints. No created-date, no revision history. Don't pad simple
  files out to match a template.
- **No em dashes** in comments, docs, or any user-facing text shipped as
  part of the plugin (source comments, README, in-app strings, and
  similar). This working-notes file is exempt since it isn't shipped.
- **Frontmatter access goes through typed helpers, never raw casts.**
  `cache?.frontmatter` is `any` -- always route through
  `shared/vault-host.ts`'s `frontmatterOf()` and then `trail-core`'s
  `findValue()` rather than accessing `cache?.frontmatter?.[x]` directly at
  call sites. The cast itself lives in the core's Obsidian adapter now, and
  `frontmatterOf()` is one delegation through `hostFor()`. Most readers do
  not call it at all: `readNotesOfType()` hands the frontmatter over with
  the note it found. `findValue(fm, name, ...aliases)` is variadic, matches key
  names case-insensitively, and treats a blank value the same as a missing
  one, so a property somebody cleared in the property editor falls through
  to the next alias instead of answering with `''`.
- **Frontmatter property names are always configurable settings**, never
  a hardcoded string literal in logic. If a feature reads a frontmatter
  property, there's a settings field for its name (with a sensible
  default), even if that field is small and easy to overlook. There are
  three deliberate, documented exceptions, all subtype-specific rather
  than shared: `accommodationType`, `accommodationStatus` and `fnbType`.
- **Promise handling:** async callbacks passed to DOM event listeners or
  Obsidian `Setting`/button `onClick` handlers must not be passed as bare
  `async () => {...}`. Either make the callback sync and `void` the async
  call inside it, or explicitly `void` the call at the call site. Never
  leave a floating, unawaited promise.
- **Don't reach for `getMostRecentLeaf()`** when reacting to a specific
  file-open/file-menu event -- it's unreliable for fast tab-creation
  sequences. Use the leaf the event actually gives you, or derive it from
  the workspace's current active view, not a second independent guess.
- **Styling:** no direct `element.style.x = ...` assignment. Use CSS
  classes toggled via `addClass`/`removeClass`/`toggleClass` for
  binary states, or Obsidian's `setCssProps()` for genuinely dynamic
  runtime values (drag positions, computed popover coordinates).
- **No `console.log`** left in shipped code -- Obsidian's review flags
  this directly.
- **No `innerHTML`/`outerHTML`** -- build DOM with `createEl`/`createSpan`/
  `empty()`, or use `.textContent` for plain text.
- **Settings that always travel together get one toggle, not several.**
  If two fields are never meaningfully used independently, merge them
  rather than exposing both as separate switches.
- **Every new user-facing string goes in both `en.ts` and `de.ts`.**
  `tests/translation-keys.test.ts` fails otherwise, and it also fails if a
  `t()` call site references a key neither table has. Both are first-party
  locales; a community locale is typed `PartialTranslations` and may ship
  incomplete, because `t()` falls back to English key by key.
- **English is the base language in the type system.** `en.ts` carries NO type
  annotation on purpose: its inferred shape IS `Translations`, and annotating
  it would erase the very thing every other table is measured against. `de.ts`
  is annotated `Translations` (complete); a community table is
  `PartialTranslations`.
- **A language is declared in exactly one place**, `lang/translations/index.ts`:
  code, native name, direction and table together. There is no second list of
  "supported" locales, because a locale without a table is not one.
- **Counted strings are plural sets, not `{plural}` placeholders.** A value may
  be `{ one, other, ... }` in the categories the language actually has,
  selected by `Intl.PluralRules` from a `count` interpolation. The call site
  passes a number and says nothing about grammar.
- **Whole tokens, not composed letters**, for anything word-shaped. The sixteen
  compass points are sixteen strings per locale: composing "SSW" from three
  translated letters is wrong wherever the words run in another order.
- **The stylesheet is direction-aware.** Inline offsets are written
  `margin-inline-start`, `inset-inline-end` and friends, never `left`/`right`.
  This rule is stated here and checked nowhere: this is the one package with no
  `tests/stylesheet.test.ts`, while the other two carry the physical-offset
  check. See `docs/ui-conventions.md` section 5.
- **The suite's UI conventions are one document, `docs/ui-conventions.md`.**
  A shared kit is not available: the core holds no view and CULItrail's kit is
  GPL, so the three interfaces agree by specification rather than by import.

## Architecture notes

- **Three modules, mirrored in the vault and in `src/`.** Trips, Places and
  CRM. Each owns a vault folder tree and a source folder, and each moves as
  a unit: a module root setting relocates every sub-folder derived from it.
  `rootFolder` is an optional common parent above all three and defaults to
  empty, meaning the vault root, which is the shape the sample vault ships
  in (`docs/design/sample-vault.md`).

```
src/main.ts       the one Plugin subclass
src/lang/         I18nManager, the locale registry, plural forms,
                  and the en/de translation tables
src/settings/     types, defaults, validate, store, links, settings page
                  shell and its About section
src/shared/       helpers with no module of their own: short-url,
                  open-leaf, vault-host (hostFor + frontmatterOf),
                  note-creation, sun-band (a day's light as bands, drawn
                  by the itinerary and by the photo spot block), clock
                  and units (the reader's own conventions), money
                  (formatting and cents) and print-sheet (the A4 paper
                  both exports share)
src/vault/        cross-module note reading and writing: entity-types,
                  types, read-entities, create-entities, visit-derivation,
                  health/
src/trips/        the Trip module: itinerary-days, trip-note, trip-light,
                  write-trip, related-trips, trip-stats, costs/ (booking
                  notes, totals, the split, the invoice adapter,
                  line-cost, estimates, booking-match, currency-options,
                  the cost sheet), + ui/
src/places/       the Places module: country-visited, photo-spot-*, solar,
                  write-photo-spot, place-stats, + ui/
src/crm/          the CRM module: entity-types, types, crm-note,
                  read-crm, create-crm, persons, + ui/
src/ui/           shared UI: components/, dashboard/, gallery/, settings/
```

- A module owns what only it needs. Anything two modules both read or write
  belongs in `src/vault/`, and anything that needs no Obsidian `App` at all
  belongs in `src/shared/`. Growing a module should not mean growing
  `src/vault/` alongside it.
- **Frontmatter, links and paths come from `trail-core` too.**
  `src/shared/wikilink.ts`, `src/shared/wikilink-strip.ts`,
  `src/shared/frontmatter-lookup.ts` and `src/shared/tag-list.ts` are gone.
  `wikilinkTarget`/`wikilinkTargets`/`toWikilink`/`stripWikilink`,
  `findValue`, `readString`/`readNumberLike`/`readStringList`,
  `isUnderFolder`/`relativeFolderPath`/`joinFolder`/`sanitizeTitle`,
  `createdEntry`/`stampModified` and `frontmatterObject` are all imported
  from `'@technosoftware/trail-core'`. There is no re-export shim any more:
  `shared/vault-scan.ts` was the one-stop import surface because the pure
  helpers had to sit in a separate file to stay `obsidian`-free, and the
  core is `obsidian`-free by construction, so pure and App-bound code alike
  import it directly. `shared/vault-scan.ts` has gone the same way; what was
  left in it, `frontmatterOf()`, sits in `shared/vault-host.ts` beside the
  host it reads through.
  Three call-shape notes: `findValue` is variadic rather than taking an
  array, `relativeFolderPath` takes a path string rather than a `TFile`,
  and the core's `isUnderFolder` reads a blank folder as the vault root.
  Every call site here guards against a blank folder before asking, which
  is this plugin's own "an unconfigured folder finds nothing" rule and has
  to stay that way. The readers get that for free: `readNotesOfType()`
  drops blank folders and finds nothing when none is left, which is the
  same rule spelled as `isUnderAnyFolder`'s empty-list-means-nowhere. `readTagList` was character-for-character the core's
  `readStringList` and is now that; nothing needed the tag-shaped name.

- **Dates are not in `src/shared/` any more; they come from `trail-core`.**
  `src/shared/date-utils.ts` and `src/shared/date-distance.ts` are gone, and
  every day/week/month/quarter/year title, every `readDateLike()`-style
  frontmatter reader, `formatDateTimeStamp()` and `daysSince()` are imported
  from `'@technosoftware/trail-core'` instead. Do not re-add a local date helper: if a date
  behaviour is missing, it belongs in the core, where it is tested against
  every timezone rather than only against the one this vault lives in.
  Three names differ from what this plugin used to spell them:
  `isoWeekInfo()` is `isoWeekOf()` and returns `{ weekYear, week }` rather
  than `{ isoYear, isoWeek }`; `parseWeekTitle()` returns those parts rather
  than the week's Monday, which is now `startOfWeekTitle()`; and
  `daysSince()` takes an optional `today` so a caller under test is
  deterministic. The local-calendar-fields rule is unchanged: everything
  reads local getters and returns Dates at LOCAL midnight, never
  `toISOString()`.
- **APERtrail is not the only reader of `CRM/`.** **CULItrail**
  (`packages/culitrail`) reads the same two folders to answer what a person
  ordered. The agreement is now code: the folder names, the `person`
  and `company` type values and the two tag properties come from `CRM_CONTRACT`
  in **trail-core** (`packages/core`), which both
  import into their own defaults. Each plugin still has its own `src/crm/` and
  each still lets a vault rename any of it; what is shared is only what a fresh
  install ships.

  It was a paragraph before, here and elsewhere, and the paragraph was wrong: it
  claimed every side shipped identical defaults while one side's were
  capitalised, `Person` and `Organisation`. Nothing raised an error, because the
  symptom of a type value matching nothing is an empty list.
  `tests/crm-contract.test.ts` in each plugin now fails instead.

  Each plugin also renders its own fenced block inside a shared note without
  owning it: `travel-related-trips` here, `culi-related-orders` there. A fence no
  plugin claims renders as a plain code block, which is what keeps a Person note
  readable with either of them disabled.

  **The settings adoption runs one way, into the sibling.** CULItrail reads this
  plugin's `data.json` once on its own first load and adopts the CRM-shaped
  fields. APERtrail does not do the reverse: `store.load()` calls `loadData()` and
  hands the result to `mergeSettings()`, and there is no `configDir` read anywhere
  in `src/`. That is deliberate rather than missing, because APERtrail defined
  these defaults first and so has nothing to adopt from in the common case. If it
  is ever wanted, build it symmetrically with CULItrail's
  `settings/foreign-settings-import.ts` rather than bolting it on.

- **CRM reads, creates and renders; it still owns nothing.** `crm/read-crm.ts`
  reads Person and Company notes out of `personsFolder` and
  `companiesFolder`, `crm/create-crm.ts` writes new ones there, and
  `crm/persons.ts` is a thin projection over the reader for the trip
  editor's participant list. Creation writes a note and never touches it
  again, exactly like the travel types. The CRM dashboard and the gallery
  filters both ship. Do not write code, docs or
  strings implying anything links a Trip to a Company: that link was
  considered and deliberately left out. See
  docs/design/dashboard-split-and-crm.md.
- **The two CRM creators guard what the travel creators need not.** A blank
  folder or a blank type value refuses rather than writing: both are
  settings here, and a note at the vault root, or with no type value, would
  be invisible to the reader that just created it.
- `src/main.ts` is the one `Plugin` subclass. It owns the settings store,
  registers the four views, the eighteen commands, the four code-block
  processors and the ribbon icon, and constructs the settings tab. Modules
  are a layout, not a runtime abstraction: there is no module registry and
  no `Component` indirection.
- **The settings page is one scrolling page with two sub-pages.** The root
  page carries the plugin block (version, release notes, support and
  contact links), Vault setup, the handful of display switches and About.
  The two long lists live one click away: **Folders**, laid out as three
  module sections (Trips, Places, CRM) so it reads the way the vault does,
  and **Property keys**, every frontmatter name the plugin reads or writes,
  grouped by the note type that carries it. The shell
  (`src/settings/settings-tab-shell.ts`) owns the drill-down and nothing
  else; `src/ui/settings/` owns the rows. A property row is never built by
  hand: `property-row.ts` is the only thing that draws one, which is what
  keeps the read-only lock in one place.
- **Nothing is cached.** Every view reads the vault on each render
  (`vault/read-entities.ts`), so plugin state can never drift from the
  notes. The dashboard and gallery are manual-refresh only: they hold no
  `metadataCache` subscription, so they redraw on open, on an explicit
  Refresh, and after a creation modal writes a note, but not when you hand
  edit a note in another tab. The data is never stale; the pixels can be.
- **Notes are identified by folder AND type together.** A note only counts
  as a Landmark if it sits under the configured Landmarks folder and
  carries `type: landmark`. There is no folder-only fallback and no
  vault-wide search for a type outside its folder, which is what makes the
  entity-type health check (`src/vault/health/`) worth running now and
  then. The rule itself is `trail-core`'s `readNotesOfType()`, which
  `vault/read-entities.ts` and `crm/read-crm.ts` both call with their own
  folders and type value. The health check asks the inverse question (which
  notes are NOT their folder's type), so it keeps its own scan, but it
  shares the verdict through the core's `matchesType()`. That sharing is
  not cosmetic: a stricter second copy of the rule there would offer to
  "fix" notes the readers are perfectly happy with, and accepting the fix
  would rewrite the user's own value. The type value is compared exactly
  after trimming, but its **shape** is read leniently: `type: [city]`,
  `type: [city, draft]` and `type: "[[city]]"` all count, because a
  property editor turns a property into a list the moment somebody adds a
  second value, and a note that vanished for that reason was near
  impossible to attribute. It covers all twelve folders, comparing the ten travel ones
  against their literal and the two CRM ones against their configured type
  value; a CRM folder whose value has been cleared is skipped, since there
  is then nothing to suggest. The bookings folder is nested inside the trips
  folder by default, and a longest-match rule is what judges a booking note
  against the bookings folder rather than against the trips folder it also
  sits under.
- **The health check is three families now, not one.** `entity-type-issues.ts`
  is the one with an `apply` half, because a folder states what a note's type
  should be. `booking-issues.ts` reports the four things that can be quietly
  wrong with a booking and `photo-spot-issues.ts` the two that can be wrong
  with a photo spot, and **neither carries a fix on purpose**: what a booking's
  trip was meant to be, which of two notes sharing a reference is the
  duplicate, which motif is the main one and what a sample was meant to point
  at are answers only the person who wrote the note has. All three are warnings
  rather than errors, and `entity-type-check-modal.ts` presents them together.
- **Wikilinks resolve by note title, never by path.**
- Country / State / City form a genuine cycle (a Country lists its States,
  a State points back at its Country, each level's `capital:` points down
  again), so `readTravelBoard()` builds skeletons first and mutates the
  cross-references in on a second pass. There is no single ordering that
  resolves every reference the first time through.
- **Some fields are derived, never written back.** A place's
  `visited`/`lastVisit` is computed from the trips that stop there, and a
  Trip's status from its own dates, when the note says nothing. An
  explicit value in the note always wins. Writing the derived value back
  would mean editing one note as a side effect of editing another, and it
  would go stale the moment its source changed.
- **`created` is written once; `modified` is written by every edit.**
  `trail-core` owns both, `createdEntry()`/`stampModified()` for the pure
  half and `touchCreated()`/`touchModified()` for the vault half, and
  `src/vault/note-stamps.ts` is down to one delegation of `touchModified()`,
  the only one of the two this plugin calls with a vault. `APERtrailSettings` structurally satisfies the core's
  `NoteStampProperties`, so it is passed straight through. Creation stamps
  `created` directly after `type:` (`frontmatterObject()` takes the stamps
  as their own argument, between the type value and everything else, so
  that ordering is not something a caller can get wrong) and deliberately no `modified` -- two identical stamps say
  nothing one does not -- and every genuine edit of an existing note stamps
  `modified`. Nothing ever rewrites `created`, and nothing backfills it
  onto a note that lacks one: the plugin cannot know when a hand-written
  note was started, and a wrong creation date is worse than none. That is
  why `createdProperty` must stay out of `tripManagedKeys()` /
  `photoSpotManagedKeys()`, whose keys are deleted before a rewrite. The
  value is `trail-core`'s `formatDateTimeStamp()`, minute precision, LOCAL
  time, handed to `stringifyYaml`/`processFrontMatter` unquoted (js-yaml
  only auto-quotes timestamps carrying seconds, so a minute-precision value
  round-trips as a string). Both property names are settings and a blank one means "skip
  that stamp", never a hardcoded fallback. `ensureItineraryBlock()` and
  `ensurePhotoSpotBlock()` stamp `modified` without needing a
  creation-flow flag: creation seeds those blocks into the note's initial
  content, so a call made right after creation finds the block and writes
  nothing at all.
- **Money has six rules, and each exists because of a way a display can
  lie.** A total over lines that carry no amount is **null, never zero**
  (`trips/costs/totals.ts`, and `trail-core`'s `computedOrderTotal()` for the
  same reason). **Currencies are never summed**: a total is per currency, and
  a single figure appears only where the trip states a rate, always shown with
  that rate. **Nothing derived is written back**: balances, variances and
  settlements are recomputed on every render, which is what answers the
  "who owes whom" objection in `trip-model-redesign.md` §9. **The plugin
  fetches no rates**, ever. **A line's multiplication is redone on every
  render and stored nowhere** (`trips/costs/line-cost.ts`), so adding a person
  to a trip corrects every line that did not name people, and the row shows
  its working rather than asking to be trusted. And **an absent `costUnit`
  reads as `total`**, never as the unit that kind of line is usually quoted
  in: a bare number somebody typed by hand must not silently multiply itself
  into something larger than they meant. The editors write the unit
  explicitly instead.
- **A booking note has no block and does not need one.** Every field on it is
  a flat scalar or a list of links, so Obsidian's property editor is already
  the right editor. That is why the type was worth adding; if a field on it
  ever needs a list of maps, that decision is being reopened.
  **That same sentence decides where the format lives.**
  `trips/costs/booking-note.ts` stays here rather than moving into
  `trail-core`, and that is the promotion rule applied rather than an exception
  to it: a note of flat scalars and links has no format code to share, so the
  core's generic readers plus the usual settings adoption already cover a
  second plugin reading one. NODAtrail is expected to read booking notes for
  trip costs eventually, and that on its own does not change the answer. A
  booking note that grows a list of maps does. See `docs/architecture.md`
  section 11.3.
- **Property values are a different question from property names.**
  Names are always configurable; the fixed vocabularies are not, because
  code keys off those exact strings: `TRAVEL_STATUS_VALUES`
  (`Planned`/`Booked`/`Over`/`Cancelled`), the ten entity type values,
  `BOOKING_CATEGORIES` and `BOOKING_STATUSES`
  (`trips/costs/booking-note.ts`), and `COST_UNITS`
  (`total`/`person`/`night`/`personNight`, `trips/costs/line-cost.ts`).
  Adding a value to one of those is a data-model change, not a setting.
- **An empty list on a line means everybody, and is written as nothing.**
  `persons` on a stop, a night or a leg names who it is for; leaving it out
  is how a line says "the whole trip", so the editors write nothing when
  every participant is ticked. That is what keeps a person added to a trip
  later from being quietly missing off its flights.
- **People and companies are read, not owned.** APERtrail has no contact
  registry. It reads Person and Company notes out of two configured folders
  (`crm/read-crm.ts`), each matched by its own type value, with people
  optionally narrowed by a tag filter. An empty tag filter means
  "everyone", never "nobody".
- **CRM type values are settings; travel type values are literals.** A note
  is a Landmark because it says `type: landmark`, full stop, but it is a
  Person because it says whatever `personTypeValue` holds. That asymmetry is
  what lets the CRM folders stay folders the vault already owned, spelled
  its own way, and it is why `crm/entity-types.ts` is a separate list from
  `TRAVEL_ENTITY_TYPES` rather than two more members of it.

## When unsure

Ask before guessing on anything touching: settings shape/naming, how two
features should relate, whether something is a bug or deliberate, and
above all anything that changes what gets written into a user's notes.
