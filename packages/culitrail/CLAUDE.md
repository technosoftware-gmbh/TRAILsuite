# CULItrail - working notes for Claude Code

Obsidian plugin (TypeScript, esbuild). Meals ordered ready-made from a company
and reheated at home, as plain Markdown: meal notes, per-person weekly meal
planning, and order tracking with an invoice view.

**There is no cooking in this plugin.** That is the single most important thing
to know before changing anything in it, because a great deal of what is written
below and in `docs/design/` was written when there was. A meal is bought, it
arrives, it is reheated and it is eaten. There are no ingredients, no
instructions, no shopping list, no recipe import and no kitchen timers, and
none of them should come back without a design conversation first.

## What exists

The meal area: parser, detection and lifecycle, view model, the shared UI kit
in `src/ui/`, the meal view in both layouts, the gallery, the editor, and the
allergen banner. The reheating section and the supplier merge;
`docs/design/ready-meals.md` is still its specification. The planning area:
per-person meal-plan notes, their sync, and both the week grid and the
carousel. The orders area: note format, reader, writer, list view, editor, and
one order note rendered as an invoice. Eating history, badges, prices,
nutrition, favourites, the
shared CRM with APERtrail, and a dashboard over all of it.

**Everything is reachable from the UI**: one scrolling settings page with four
sub-pages behind it -- Folders, Property keys, and one per list setting (header
badges, reheat appliances) -- three ribbon icons, and nineteen command-palette
entries: nine that are always available, two that need a meal in front of you,
and an open-in-our-view / open-as-Markdown pair for each of the four kinds that
have a view of their own.
`tests/settings-coverage.test.ts` fails on any setting with no control, and its
exemption list is down to the three that are state rather than configuration.

The shared-CRM alignment with APERtrail shipped. Where this file and a page
under `docs/design/` disagree, this file is the summary and wins.

## What was removed, and why

Cooking left the plugin in one pass. The counted reason is the same one that
`docs/design/ready-meals.md` already recorded and then under-read: **of 126
meal notes in the vault this was built against, only 14 could be cooked at all,
every one of those 14 had also been bought as a ready meal, and not one note
was cook-only.** A feature set serving fourteen notes that did not need it was
carrying the parser, the shopping list, the importer, the exporter, the timers
and the safety warnings on its back.

Gone entirely, with the deletions the code has already taken:

- **The grocery list.** The view, the note format, the contributions ledger,
  auto-add on sync, the category ids and their two keyword dictionaries, the
  text export, the dashboard card, the ribbon icon and its commands.
  `src/planning/grocery/` and `src/settings/category-order.ts` do not exist.
- **The importer.** Web import from a URL, the vendored `recipe-scrapers`
  tree, JSON-LD and microdata scraping, image download on import, and the Open
  Food Facts lookup. Nothing in `src/` reaches the network any more; there is
  no `requestUrl` call left in the plugin.
- **Export in all four formats**, the export folder and its settings.
- **Ingredients and instructions, and everything derived from them**:
  ingredient parsing, quantity and unit parsing, the servings multiplier and
  every kind of scaling, ingredient cross-off, ingredient tags.
  `parser/step-groups.ts` replaces the two group splitters and exports only
  `splitIntoGroups()`; `view/steps-section.ts` replaces the two section
  renderers and has exactly one caller, the reheating section.
- **The meal suggester**, in a later pass than the cooking removal and for a
  plainer reason: a weighted-random pick over a library somebody can already
  sort by last eaten and filter to never-eaten was a second answer to a
  question the gallery answers. Gone with it: `src/meals/suggester/`, the mode
  editor and its settings page, the `suggesterModes` setting and
  `state.lastUsedModeId`, the filter operators, the `suggest-meal` command and
  the dashboard button. `meals/discovery/field-types.ts` stayed, because the
  badge editor's property picker is written in the same vocabulary. **Planning
  from the dashboard replaced it**: the "Plan a meal" button and an empty day
  in the week card now open the meal-plan view's own picker and then ask for
  the day, which is what the suggester's winner had to be put through anyway.
- **Step timers**, the timer bar, auto-start and the Timers settings tab.
- **Meat-temperature safety and the high-GI warning.** The only warning left
  is the allergen banner, and its settings row is in the Meal view section.
- **The `preparation` concept.** There is no cooked / ready / both / none, no
  gallery filter for it and no ready-meal chip, because everything is a ready
  meal.
- **The `[method:: cooked|reheated]` inline field** on a meal-plan line, and
  the method picker that filled it in.
- **The desktop two-column layout** and its split-ratio setting. Two layouts
  remain: `mobile-tabs` on mobile, `desktop-classic` otherwise.

`trail-core` lost its `grocery/`, `ingredients/`, `timers/` and `safety/`
modules in the same pass, and its `recipe/` module is `meal/` now.

## Vocabulary

Recipe became meal and cooking became eating, everywhere, including in
`data.json`. The renames are mechanical and complete, and reintroducing an old
spelling in a new file is the easiest way to make this codebase confusing
again:

- `src/recipes/` is `src/meals/`. Recipe view is Meal view, recipe gallery is
  meal gallery, `type: recipe` is `type: meal`, `Cooking/Recipes/` is
  `Eating/Meals/`.
- Cook history is **eating history**, cooking activity is **eating activity**,
  "Mark as cooked" is **"Mark as eaten"**, "New recipe" is **"New meal"**.
- Frontmatter and settings: `cookTime` is `reheatTime`, `lastMade` is
  `lastEaten`, `cookedCount` is `eatenCount`, `cookHistory` is `eatingHistory`,
  the default heading `Cook History` is `Eating History`, `cookingFolder` is
  `eatingFolder`, `recipesFolder` is `mealsFolder`, `recipeTypeValue` is
  `mealTypeValue`, `autoOpenRecipeView` is `autoOpenMealView`,
  `defaultRecipeImage` is `defaultMealImage`, `additionalRecipeFolders` is
  `additionalMealFolders`. `mealSlotNotation` is gone: nothing writes a
  checklist line any more, and `mealSlotFieldName` survives read-only for the
  notes that still carry one.
- Persisted state: `MealPlanEntry.recipePath` is `mealPath` and `cooked` is
  `eaten`. `groceryItems`, `groceryContributions`, `collapsedSections` and
  `groceryViewedWeek` are gone from `settings.state`.
- In `trail-core`: `RecipeDraft` is `MealDraft`, without `ingredients` and
  `instructions` and with `cookTime` as `reheatTime`; `PlanEntry` renames
  `recipe` to `meal` and `meal` to `slot` and `cooked` to `eaten`, and has
  dropped `method`.

## Reheating and ready meals

`src/meals/reheating/` holds it, and the merge rule itself is `trail-core`'s and
imported back, because how a dish's entry resolves against its supplier's is
what the note format means rather than what one view does with it: change the
rule and every reading of those notes changes, which is not something a view
gets to decide. Everything here is App-free except `read-supplier.ts`. Four
things in it are worth not undoing:

- **A supplier instruction whose `{temp}`/`{time}` token nothing fills is
  withheld entirely.** "heat for about {time}" reads as a bug and cannot be
  acted on in a kitchen. It also means the dish is correctly *not* offered as
  reheatable through that appliance: what counts is a resolved instruction, not
  the presence of a section.
- **The reheating section is rendered by the step renderer**, through a thin
  adapter, so it reads as any other run of steps does. A bespoke component
  would drift.
- **A fenced code block inside the section is dropped**, and **a heading naming
  another section this plugin renders ends the section** whatever its level.
  Both were found in a real vault: the `culi-related-orders` fence on a company
  note was landing inside the last appliance's instruction, and an
  `## Eating History` heading under a `# Reheating` one was being offered as a
  way to reheat the dish.
  `parser/section-names.ts` is the one list both parsers consult.

**The sample notes carry the feature, and the suite runs against them.**
`Tom Yum Gai` states numbers alone and takes its supplier from an
order; `Aubergine Parmigiana` names an explicit `supplier:`, with an oven
heading the company's wording absorbs and a microwave heading that overrides
it; and `TomTasty AG` carries the `{temp}`/`{time}` boilerplate.

**`tests/sample-vault.test.ts` used to skip silently** unless `CULITRAIL_SAMPLE`
pointed it at a vault that was never in the repository, and a skipped suite
reads the same as a passing one in the summary line. The notes are
`src/sample/notes.ts` now, seeded into a fake vault by the suite and into a real
one by the **Create the sample notes** command, so it runs unconditionally.

**One test had to be corrected by a confirmation from the user.**
`sample-vault.test.ts` asserted that Tom Yum Gai's price equalled the amount
its order's total moved by. That is the opposite of the rule: it would have
failed the first time a supplier raised a price and reported a correct vault as
inconsistent. It now asserts only that a price is stated. The invariant worth
pinning is different: a line price and its own order's total live in one note,
so those two must agree.

## The header, the badges and the card

**`docs/design/badges-and-prices.md`: all six phases shipped.** The badge row
is chips plus a strip of figures (uppercase label over the value, no pill, no
icon), and every meal has a price.

**A dish price is `priceProperty` (default `price`, alias `cost`).** It is what
one portion costs as sold. Zero is a real price and formats as `0.00`. The
currency is `orderDefaultCurrency` and there is deliberately no per-meal
currency. The price renders as a line under the figure strip on both surfaces,
**not as a meta-banner cell** as the design's table says: the banner became
controls when nutrition left it, and a price is a fact about the dish.

`src/ui/stat-strip.ts` is the strip and `src/meals/view-model/badge-display.ts`
is the rule that decides what goes in it.

**A badge does not choose its form; the rule derives it.** A chip if it
declares itself a list (`splitArray`), resolved to several values, resolved to
none, or has no label to head a column. A cell otherwise. `icon` and `color`
are chip-only and the editor says so on both fields; `prefix`/`suffix` fold
into a cell's one figure. Four things about it are worth not undoing:

- **It replaced four hand-written copies of the same shape, not three.** The
  meta banner's nutrition grid, the mobile times row, and the mobile Info tab's
  nutrition strip, plus the badge row. Do not add a fifth: `renderStatStrip()`
  takes cells and a variant.
- **The cell-or-chip rule keys on `splitArray`, never on how many values a note
  resolved to.** Reading the values looked cleaner and moved the diet badge
  between the title and the strip depending on how many diets the meal listed.
  A badge has to render in the same place on every note; `splitArray` is a
  declaration about the property, so it is the stable thing to key on. Two
  tests pin it.
- **`grid-auto-columns: minmax(0, 1fr)`, not `1fr`.** `1fr` is
  `minmax(auto, 1fr)` and floors each column at its content width, which made
  the German nutrition strip 78/78/78/123 because `Kohlenhydrate` widened its
  own column.
- **Label and value are siblings in one two-row grid, not a wrapper per cell.**
  That is what keeps the figures on one line across the strip when a label
  wraps, and with `overflow-wrap: anywhere` it is why a long German label is
  wrapped rather than clipped by the boxed variant's `overflow: hidden`. A
  wrapper per cell would step the figures. Measured at 360px.

**The nutrition figures are in that strip too, ahead of the badges, and the
meta banner no longer carries them.** That reversed a decision the design
argued for at length, and the thing that reversed it was counting. The phase
shipped, the reaction was "I don't see a change", the build was byte-identical
and reloaded, and the note open at the time was one of only **two of 126** with
an empty strip. Running the real planner over the whole library: **113 notes
got a one-column strip** reading `LAST MADE` over a date, 10 got three, 1 got
two, 2 got none. That label is quoted as it read at the time: the count predates
the rename, and the strip says `LAST EATEN` now. The figures are what the
argument rests on, so they are left as they were measured rather than restated
in today's words. Ninety percent of the library saw a label over a date while
the four nutrition figures every note carries sat in a band below. Do not split
them back apart without counting again.

`StatCell.groupStart` marks the boundary between the nutrition columns and the
rest and draws a rule there, because the caption describes only the nutrition
half.

**The gallery card is three fixed rows plus a picture, and the fixed part is
load-bearing.** `view-model/card-face.ts` composes chips, the abbreviated
nutrition strip and a two-column info strip; `.culi-gallery-card-info` carries
a `min-height` equal to the sum of the three rows, their gaps and its padding.
A card is a grid item stretched to its row's height, so a card that is shorter
makes its neighbours grow to fill the row, and a strip with no figures is not
rendered at all. Two of 126 notes state no nutrition, which is exactly that
case. **Adding a row means adding to that sum and re-running the harness.**

Three things on the card were decided by measuring and would read as arbitrary
otherwise: nutrition labels are abbreviated (`kcal / prot / fat / carb`,
because four 50px columns will not hold "Calories" on one line), **total time
is not on the card at all** (three info columns are 55px and both a duration
and a date came out ellipsised; time is on 14 of 126 notes against 124 for the
other two), and the date uses `formatIsoDateShort()`, because a four-digit year
overflows an 85px column.

**"The meal header" is two layouts, and one of them is behind a guard.**
`meal-view.ts` wraps the chips-and-strip block in `if (layoutId !==
'mobile-tabs')` because the mobile layout builds its own header, so the first
two attempts at this feature changed the desktop layout and nothing else. The
report was a screenshot of an iPad still showing the old header. Mobile carries
the nutrition strip too, **as two bordered strips rather than one**: desktop
has room for eight columns in a row, seven boxed columns at phone width is 55px
each. Mobile's Info tab stopped rendering nutrition in the same change, because
the header above the tabs now does.

**There are two nutrition surfaces now, and they are different claims.** The
header strip is four figures **per serving**; the per-100 g breakdown is the
declaration table off the packet, rendered by `view/breakdown-section.ts` from
`view-model/nutrition-breakdown.ts` as a card beside the reheating one on
desktop and as a tab of its own on mobile. A meal can carry both and neither
says what the other says. Five things about it are worth not undoing:

- **It renders an unmigrated note too.** `parser/per100g.ts` is the one reader
  the meal view and the editor share: frontmatter first, then the two retired
  body sections, whole-model rather than field by field. Until the vault
  migration runs, a library is half one shape and half the other and a reader
  should not be able to tell which half a meal is in.
- **Both retired headings are on `renderedSectionHeadings()` as well as
  `reservedSectionHeadings()`, and that is new.** They were not excluded from
  the trailing-section cards before, because nothing rendered those figures and
  the raw card was the only sight of them. Now it would be the same label
  twice on one screen.
- **Labels come from `nutrientDisplayName()`, ordering from
  `inNutrientOrder()`, and a null from either source renders as
  `ABSENT_FIGURE`, never as 0.** The names in a note are language-free ids,
  which is the whole reason the figures moved into lists: a German vault used
  to read English text frozen into every note. A nutrient no table knows keeps
  the spelling somebody typed and sorts to the end.
- **`write-draft.ts` writes the breakdown and nothing else writes it.** Two
  energy properties and two lists through `nutrientListValue`, all inside the
  one `processFrontMatter` pass, then a `vault.process` pass that removes both
  retired sections. An empty list is deleted rather than written as `[]`, and
  entries go in **in the order the draft holds them**: the form can reorder a
  list, and `inNutrientOrder()` is applied at render only, so a writer that
  sorted on the way past would undo that on every save. This is why
  `parser/per100g.ts` reads the four properties under their configured names
  with **no alias list**, unlike `meal-meta.ts` next door: an alias finds a
  figure some other writer produced, and here there is no other writer.
- **Two bugs were fixed with it and both can be reintroduced by a plausible
  edit.** `draft.servingGrams ?? 0` multiplied a whole label by zero grams and
  wrote `calories: 0`, a claim that a portion contains no energy;
  `deriveServingNutrition()` returns null for all five figures when the weight
  is absent or not positive, and a null is written as a property with nothing
  after it. And the per-serving writes assigned the configured calories key
  directly, bypassing `existingKey()`, so a note keyed
  `kcal:` gained a second `calories:` and orphaned the first. All five now go
  through `writeNumber`. `tests/meal-editor-nutrition.test.ts` covers both.

**Count the library before arguing about a view, and check both layouts before
believing a header is done.** This has now been the failure twice in this
feature area: the ready-meals design claimed 9 cookable notes and the built
reader found 14. Both times the reasoning was internally consistent and pointed
the wrong way, and the second of those counts is ultimately why there is no
cooking in this plugin at all.

## Orders, prices and the invoice

**Phase 6's model is confirmed in the user's own words, not inferred.** A dish
price is the **default**, and it will change when a supplier changes it. **An
order does not change after the fact when that default changes.** The
**discount is on the total**, not per line. So: total = sum of (line price x
quantity) minus one order-level discount plus shipping, with the line price
stored on the order.

Counted before designing further: **59 order notes in the real vault, all
already v2, all carrying `price` and `priceCurrency`, none carrying a discount,
a shipping cost or a per-line price.** Two rules follow. **No computed total
unless at least one line carries a price**, or all 59 would show a computed
0.00 beside a stated 89.40 and read as a plugin that had lost the money. And
**nothing backfills**: an existing order is never given line prices from
today's dish prices, because that invents a history the confirmation rules out.
A v2 order that is never edited stays v2 and stays readable.

**`OrderSelection.items` is the only list on a selection**, and
`selectionTitles()` derives the titles. A first draft kept a parallel list of
titles so the existing readers would not change, which is the
two-sources-that-must-agree shape forbidden everywhere else here. `items`
replaces `meals:` in the note only when a line carries a price or a quantity,
decided per note rather than per person, so an unpriced order keeps the old
shape. **Measured on the 59 real orders: 443 lines parsed, none gained a
computed total, and not one note's selections changed shape when read and
written straight back.** Saving an untouched order rewrites nothing.

**An order note opens as an invoice, a delivery note opens as the same document
without the money, and the model under both is format-agnostic and lives in
`trail-core`.** `document/invoice.ts` is the model and `obsidian/render-invoice.ts`
is the renderer; between them they contain no domain word at all: no order, no
dish, no meal, no person. The adapters stay here --
`src/orders/invoice-model.ts` and `src/deliveries/delivery-note-model.ts` -- and
both are App-free, so the whole feature is testable without a vault. The seam was
hypothetical until the delivery note became a second consumer, which is what
earned the move into core; APERtrail's hotel and restaurant records are the
third. The test of whether it holds is the vocabulary: something order-shaped
reaching the renderer means the split has failed.
`docs/design/invoice-view.md` is the contract. Four things about it are worth not
undoing:

- **Every figure comes out of `trail-core`'s `order/total.ts`**, including `orderSubtotal()`,
  which `computedOrderTotal()` sums. The compact card in the orders list and
  the invoice are deliberately different documents and agree only because both
  go through that module. Two renderers disagreeing about one order is the
  failure it exists to prevent.
- **An unpriced order shows no arithmetic whatsoever**: no unit-price column and
  no line-total column, only the total the note states. This is the same counted
  rule as the null return from `computedOrderTotal()`, applied to the layout, and
  all 59 real orders are in that case.
- **A column is present exactly when it has a heading.** `InvoiceColumns` holds
  `string | null` per column rather than labels beside a set of flags, which is
  the shape that lets a table render a heading over nothing.
- **One total row, and `documentTotal()` decides which figure it holds**: the
  lines when any of them carries a price, the stated figure when none does. The
  four rows this replaced existed because a note could contradict its own lines,
  and the editor now computes what it writes, so it cannot. A hand-edited note
  that still contradicts them renders the figure from the lines, silently, which
  is the deliberate cost of not reopening that argument in the layout.
- **The discount, the shipping and the VAT are facts, not totals rows**, on every
  order rather than only on unpriced ones, so a reader finds them in one place
  whichever kind of order they opened. The VAT is taken off the total the
  document prints rather than off `order.price`.

**The order editor computes the total; it does not ask for it.** As soon as one
line carries a price the Total field is derived and disabled, and the draft is
written from it as it is painted, so what the note stores and what the field
shows cannot come apart. An order whose lines carry no prices keeps an editable
field: that is every pre-line-price order, and the typed total is all such a note
knows about money. Do not make that field editable again without also restoring
the two totals rows the document dropped.

**A price belongs to the dish, not the person.** The order editor lists one row
per distinct dish with one price, applied to every line naming it, and `x 2`
for two portions; the person's name is not in the row. The note still stores a
price per line, so an order stays a record of what was charged. `dishLines()`
reports the **first** price when a hand-edited note's lines disagree and
changes nothing, because normalising on open would be a silent rewrite. A
quantity is read and honoured but not editable, since a checkbox picker cannot
express "this person had two".

**The meal editor's supplier dropdown always contains what the note already
names.** `editor/supplier-options.ts` holds the rule. CULItrail creates no
Company notes and resolves them by title, so a meal can name a company whose
note was renamed or never existed; a `<select>` whose value matches no option
falls back to its first, and a save would then replace a supplier somebody
typed with "none" without being asked. The unmatched value is offered, labelled
as having no company note behind it. Same shape of hazard as a settings default
freezing into `data.json`: a control that silently rewrites what it was given.

**In a flex row, state a `flex-basis`, never a `width`.** Obsidian's mobile
stylesheet sets a width on a text input with a selector more specific than one
class, so on an iPad the order editor's price field rendered ~590px wide and
ate the row while the dish name beside it vanished. Desktop looked fine. The
tell was that the field's `text-align: right` still applied, so the rule was
live and only its width was losing. A flex item's main size comes from its
basis, which no `width` can override. Reproduced before fixing: old declaration
plus an override measures 679px at an 860px row; `flex: 0 0 5.5rem` measures
88px at every width either way.

## Eating history

**The plan note is the store.** This is the reversal that matters most in this
area and the one most likely to be undone by somebody reading an older
comment: a meal eaten is written onto its meal-plan line, and nothing writes an
`eatingHistory` frontmatter property any more. The property is still **read**,
behind the plans, so an unmigrated vault still shows its log; it simply stops
growing. An existing one is **left exactly as it is** rather than deleted,
because removing a store from every meal in a vault is a migration done once
with a backup, not something recording a meal should do on the way past.

`src/meals/history/` is the writer, with **Mark as eaten** in the meal header
behind it. Four things about it are worth not undoing:

- **`lastEaten` and `eatenCount` are still written**, and that is the one
  deliberate exception to "derive at read time, never write back". The
  gallery's sort, its never-eaten filter and the dashboard all read frontmatter
  alone and never the plans, so a meal recorded without them would be invisible
  everywhere except the view it was recorded from. They are derived from the
  plans, which is what keeps them true once the old property stops growing.
- **The body section is a merge, not a regeneration.** A line carrying an id
  the records still hold is rewritten in place, a line whose id has gone is
  dropped, and a line with no id is left exactly where it is. The plugin this
  came from rewrote the whole section and stamped it "Manual edits will be
  overwritten", which contradicts the rule that hand-editing a note is always
  safe. `tests/eating-history-write.test.ts` fails if that returns.
- **The rendered line is in the shape our own section parser reads.** The
  inherited writer emitted a line `parseEatingHistorySection()` cannot read at
  all, so every entry it wrote was invisible unless the frontmatter record
  happened to be read too. The line leads with a bare ISO day and carries the
  rating as `[rating:: N]`, and the round-trip is a test.
- **A body line carrying an id contributes no note, and the clock time is its
  own field.** The line is the plugin's own rendering of a record: its text is
  `time - person - note`, all three composed from fields the record already
  holds, so reading it back as the note printed the person twice in every row.
  A line with **no** id is a line a person typed, and its text is still the
  note.
- **An unidentified body line folds into an identified record that agrees on
  date and note**, and that merge rule is what makes an existing vault readable
  at all. Every log already on disk was written before this reader existed, by
  an older writer or by the migration: the records carry ids (`mig-*`, and a
  handful of runtime ones) and
  **not one body line carries an id marker**, so by id alone the two halves are
  two meals and all 442 records across 124 notes rendered twice, once with the
  person and once without. The fold is read-side only, which is why nothing had
  to be rewritten. Only an id-less entry folds: two entries that both carry ids
  are two meals by their own declaration, however alike they read. Do not
  "simplify" the merge back to keying on id alone.

**Three id markers are still live.** An eating-history line carries its
identity in an HTML comment, and that marker has been written three ways:
`rb-id` by Recipe Box, `cul-id` by CULInode and `culi-id` since the rename to
CULItrail. All three are in vaults, and a reader that knows only the newest one
does not fail loudly: it reads the line as unidentified, shows the entry twice
and edits a copy. `tests/legacy-id-markers.test.ts` is what keeps the rename
finished.

## The field picker

**The field picker's scan is not cached, deliberately.**
`src/meals/discovery/` reads the meal library when a dialog offering a picker
opens, and that snapshot lives as long as the dialog. There is no
`DiscoveryCache` and there should not be one: the no-caching rule below is the
rule, and a property added to a note a minute ago belongs in the next picker
rather than after a reload. The settings' own `lastEaten` / `eatenCount` /
`favorite` are offered ahead of the scan with their declared types, so a fresh
vault is not a blank picker and one note whose `lastEaten` reads `never` cannot
infer a date field into a text field.

**`derived` on a badge is a separate field from `property`, and stays one.**
The eating streak is computed, so there is no property to name, and reserving
the name `eatingStreak` in `property` would both promise a frontmatter property
that does not exist and let a vault carrying its own `eatingStreak:` shadow the
computed value. The unit ("weeks") is translated at render rather than shipped
as the badge's `suffix`, for the §G.1 reason that a persisted default freezes
into `data.json` in one language forever.

**The streak badge ships `enabled: false`, and that is load-bearing.** A saved
`headerBadges` list wins outright over the defaults and the editor cannot
re-add a built-in, so a built-in added later would never reach an existing
vault. `withMissingBuiltins()` in `settings/validate.ts` appends a missing
built-in **only when it ships disabled**: with no version marker there is no
way to tell "absent because older" from "removed by hand", and restoring
something invisible costs nothing if the guess was wrong, while restoring
something that renders would undo a deliberate removal on every load. Any
future built-in badge that wants to reach existing vaults therefore ships
disabled too.

## The em-dash rule

**The em-dash rule is a test, and the reasoning that said it should not be has
been reversed.** `tests/no-em-dash.test.ts` checks TypeScript **comments**
(found via the TypeScript scanner's comment trivia, not a regex, which cannot
tell a comment from an apostrophe in a string) and Markdown **prose** (fenced
and inline code stripped first). Nothing is exempted by name, which was the
objection to having a test at all.

The rule had been broken four times despite being written down: a rendered
constant in `nutrition-row.ts` (now the shared `ABSENT_FIGURE` en dash), a file
comment, `docs/design/data-model.md`, and three design pages in one afternoon.
**A rule nothing checks is a preference.** The test was verified by
reintroducing the violation in each checked context and confirming it fails and
names the line, because a fix earlier in this project shipped with a test that
passed against the bug it claimed to prevent.

`CLAUDE.md` is exempt because it is not shipped, and the test asserts that this
file still contains at least one em dash, so the exemption stays a stated fact
rather than a habit. This sentence is where that one lives — deliberately, so
that anybody sweeping the file for stray em dashes finds the explanation rather
than an accident, and so that removing it fails the suite rather than passing
quietly.

## Where the code comes from

The meal code was built on the GPL-3.0 **Recipe Box** by Arcane Tech /
AdamArcane (https://github.com/AdamArcane/obsidian-recipebox) rather than
rebuilt from scratch. That licence travels with the code: CULItrail is
**GPL-3.0-or-later**, and `NOTICE.md` carries the attribution.

This matters when comparing against the sibling plugin. **APERtrail**
(https://github.com/technosoftware-gmbh/TRAILsuite/tree/main/packages/apertrail)
is PolyForm Noncommercial. Its architecture is the model to follow here, its
source is not something to copy code out of, and the two licences are different
on purpose.

Beyond the inherited Recipe Box code, this is a clean-room implementation.
Do not reference, port, or compare against any other plugin's source.

## Relationship to the sibling plugin

- **APERtrail** keeps trips and places.
- **CULItrail** keeps eating.

### People and companies are shared with APERtrail

`docs/design/shared-crm.md` is the contract in full; what follows is the part
worth having in front of you while changing code.

**A Person or Company note is shared by all three plugins and owned by none of
them.** The defaults they must agree on are `trail-core`'s `CRM_CONTRACT`, not
one plugin's `data.json`. NODAtrail joined the contract with the ledger: it
reads and creates both kinds of note, and writes two properties of its own onto
a Company note (`account` and `category`) that nothing here reads or touches.

**Each plugin adds its own part without owning the note.** APERtrail
writes Person and Company notes and renders which trips a person was on;
CULItrail creates neither and renders what a person ordered. That is the model
to keep: a shared note, one plugin responsible for its existence, and each
plugin answering its own question inside it.

`culi-related-orders` is the first instance of that on this side. It sits in a
Person or Company note next to APERtrail's `travel-related-trips`, takes no
arguments, and reads which note it is in from the rendering context. Two
properties make the arrangement safe and are worth keeping:

- **A fence no plugin claims renders as a plain code block**, not an error, so
  a note stays readable with either of them disabled.
- **The block reads; it never writes.** Nothing in CULItrail creates a Person
  or Company note, so nothing here seeds the fence either: it arrives by hand
  or from whichever plugin made the note. If that ever changes, the fence
  language is already isolated in `orders/related-orders-block-lang.ts` so a
  note writer can name it without importing the UI that renders it.

**No runtime coupling in any direction.** No `app.plugins.getPlugin()`, no
shared module, no imported types, no checking whether another plugin is
enabled to decide behaviour. The one cross-plugin read that exists is a
first-load `data.json` read from `<configDir>/plugins/apertrail/` to adopt
CRM-shaped settings, and it reads a **file**, not an object, never throws, and
only runs on a genuinely fresh install.

Each plugin is fully usable alone. That is a requirement, not a nice-to-have.

**One correction worth not un-making.** This project used to claim that
APERtrail imports CRM settings from a sibling plugin's `data.json` on first
load. It does not: its store reads its own file and nothing else. Only
CULItrail does this, and the asymmetry is deliberate rather than a gap:
APERtrail defined the CRM defaults first, so it has nothing to adopt from in
the common case.

## Build

- `npm run dev` - watch build
- `npm run build` - typecheck + production build + lint
- `npm run lint` / `npm run lint:fix`
- `npm run test` - unit tests

`npm run lint` is expected to pass with zero errors. Keep it that way.

**`npm test` needs one extra step inside a Cowork sandbox.** `node_modules`
installed on the Mac carries only `@rolldown/binding-darwin-arm64`, because npm
installs the one platform binding that matches the machine it runs on. Cowork's
sandbox is Linux arm64, so vitest there fails with `Cannot find module
'./rolldown-binding.linux-arm64-gnu.node'`. **This is not a broken repo**: on the
Mac itself `npm test` works, and that error only means the sandbox is reading a
macOS `node_modules`.

Fix it by adding the second binding alongside the first, from the Mac:

```
npm i --no-save --force @rolldown/binding-linux-arm64-gnu@1.2.3
```

`--force` is what gets past the platform check; `--os`/`--cpu` are not npm
config keys and are silently ignored. The version must match the installed
`rolldown` (1.2.3 here, `node -p "require('rolldown/package.json').version"`
to confirm after an upgrade). Both bindings coexist; nothing else changes.

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

- **Settings keys carry no prefix.** `mealsFolder`, `orderDateProperty`, not
  `culiMealsFolder`. Which area a setting belongs to is expressed by the
  settings page's grouping, not by the key.
- **CSS classes all use one `culi-` prefix, and the name after the prefix
  matches the inherited one.** That second half is the part that had drifted:
  the kit had been reimplemented rather than renamed, so `rb-action-btn` was
  `culi-action` and only 75 of 568 names corresponded. It is now a mechanical
  `rb-` to `culi-` swap throughout, which is what keeps the stylesheet
  diffable against the code it came from. Do not invent a new name for
  something the inherited code already named.
- **Translation keys have no top-level namespace.** `dashboard.x`, not
  `meals.dashboard.x`. The inherited keys all sat under `recipes.`; in a plugin
  that is only about eating, that level names nothing.
- **Code-block languages take `culi-`**: `culi-related-orders` on a Person or
  Company note, which is the only one. There is no legacy
  fence language to protect here: nothing in the inherited code registers a code
  block, so nothing is already sitting in someone's vault.
- **The plugin's settings are reached via `plugin.getSettings()`**, not a
  `settings` getter: Obsidian's own `Plugin` declares a `settings` member,
  and overriding a property with an accessor is a type error.

## Code conventions

- **Comment generously, but for reasoning, not mechanics.** Don't write a
  comment that just restates what the next line obviously does. Do write
  one when the why isn't obvious from the code alone: why this approach
  was chosen over a simpler one, what edge case or bug a check is guarding
  against, what tradeoff is being made. This applies when revising code
  too. When fixing a bug, explain what was wrong before, not just what the
  fix does, and don't leave old reasoning sitting next to new behaviour.
- **History belongs in git, not in comments.** Describe how the code
  behaves today. Do not narrate where a file used to live, what it used to be
  called, or that it once had a cooking half.
- **Small, single-purpose files.** Prefer many small files over a few
  large ones with multiple responsibilities. If a file is doing more than
  one job, split it.
- **File headers.** Every `.ts` file gets a short JSDoc comment at the top:
  1 to 4 lines, what the file is responsible for and any non-obvious
  constraint. No created-date, no revision history. Don't pad simple files
  out to match a template.
- **No em dashes** in comments, docs, or any user-facing text shipped as
  part of the plugin (source comments, README, in-app strings, and
  similar). This working-notes file is exempt since it isn't shipped.
- **Frontmatter access goes through typed helpers, never raw casts.**
  `cache?.frontmatter` is `any`. Always route through `shared/vault-scan`'s
  `frontmatterOf()` or `trail-core`'s `findValue()` and the `read*Like()`
  readers beside it, rather than accessing `cache?.frontmatter?.[x]` directly at
  call sites. The cast itself is not in this repo any more: it happens once
  inside the core's Obsidian adapter, and `frontmatterOf()` is the one line
  here that reaches it.
- **Frontmatter property names are always configurable settings**, never a
  hardcoded string literal in logic. If a feature reads or writes a
  frontmatter property, there's a settings field for its name with a
  sensible default, even if that field is small and easy to overlook. This
  holds even for properties nothing reads back: `kjProperty` is written by the
  manual-entry flow and read by nothing, and still gets a name. The rule is
  about naming a property, not about keeping one:
  `defaultServingSizeProperty` had a name too and was removed outright,
  because it was written from the same weight as `servingSizeProperty` and so
  could never state anything that one did not. A property with nothing of its
  own to say is one to delete, and `scripts/strip-default-serving-size.ts`
  takes it off the notes that already carry it.
- **All six `type:` values are settings too**, not literals. See the
  architecture note below; this is where CULItrail deliberately differs from
  APERtrail.
- **The shared-CRM defaults come from `trail-core`**, not from
  `settings/defaults.ts`. The nine fields all three plugins must agree on
  (`typePropertyName`, the two CRM folders, the two type values, the two tag
  properties and the two roles properties) are `CRM_CONTRACT`, imported into the
  defaults here. Do not
  respell them locally. `tests/crm-contract.test.ts` fails if they drift, which
  they had: `Person` and `Organisation` were shipped against a vault that had
  moved to lower case, and nothing noticed because the symptom is an empty list
  rather than an error.
- **Dates and ISO weeks come from `trail-core` too**, not from
  `src/shared/`. `src/shared/date-utils.ts` is gone; `isoWeekOf`,
  `formatWeekTitle`, `parseWeekTitle`, `startOfIsoWeek`, `startOfWeekTitle`,
  `shiftWeekTitle`, `currentWeekTitle`, `localDateISO`, `localDateTimeISO` and
  `quoteDateTime` all import from `'@technosoftware/trail-core'` under the same names. Do not
  reimplement any of them here, and do not reach for moment: the `obsidian`
  package is types only, so a moment-based week calculation cannot be unit
  tested without stubbing a global.
- **Frontmatter reading, wikilinks and vault paths come from `trail-core`
  too.** `src/shared/wikilink.ts`, `src/shared/frontmatter-lookup.ts` and
  `src/shared/frontmatter-block.ts` are gone. `readString`, `readNumberLike`,
  `readBooleanLike`, `readStringList`, `readDateLike`, `readDateTimeLike`,
  `findValue`, `splitFrontmatterBlock`, `createdEntry`, `stampModified`,
  `stripWikilink`, `wikilinkValue`, `formatWikilink`, `titlesMatch`,
  `isUnderFolder`, `isUnderAnyFolder`, `folderOfPath` and `joinFolder` all
  import from `'@technosoftware/trail-core'`.
- **The vault itself comes from `trail-core` too, through a shim rather than
  through every call site.** The core reads and writes over three ports
  (`VaultPort`, `MetadataPort`, `FrontmatterPort`, together a `VaultHost`), and
  its Obsidian adapter is `obsidianHost(app)` from `'@technosoftware/trail-core/obsidian'`.
  CULItrail does **not** thread a host down through its call sites: every module
  that used to take an `App` still takes one, and `src/shared/vault-host.ts`
  turns it into a host with `hostFor(app)`, memoised in a `WeakMap`. So
  `readNoteOrEmpty`, `ensureParentFolders`, `writeNote`, `getOrCreateNote`,
  `touchCreated`, `touchModified`, `frontmatterOf`, `readNotesOfType`,
  `isNoteOfType`, `matchesType`, `indexByTitle` and `resolveByTitle` all keep
  the signatures they had and have bodies one line long. **Add to a shim, do
  not bypass it**: a new writer calls `vault-io.ts`, not `app.vault.create`,
  and a new reader calls `frontmatterOf()`, not `getFileCache()`. What is
  genuinely still CULItrail's in `src/shared/` is the `{token}` path templating
  in `note-path.ts` and the small App-free helpers beside it.
- **`@technosoftware/trail-core/obsidian` is the only import that needs a runtime `obsidian`,
  and vitest stubs it.** The npm `obsidian` package is types only, so the
  adapter's `stringifyYaml` import cannot resolve under Node. `vitest.config.mts`
  aliases `obsidian` to `tests/obsidian-stub.ts`, which throws rather than
  approximating. Nothing in `src/` other than that adapter chain imports a
  *value* from `obsidian` in a module a test loads, and nothing should start.
- **Read a link value with `linkOrText`, never with `wikilinkTarget`.** The core
  ships both readings under names that say which is which, and CULItrail's is the
  lenient one: `linkOrText`/`linkOrTextList` return the plain text for a value
  that is not a link, because `company: TomTasty AG` means the same thing to a
  person as `company: "[[TomTasty AG]]"`. `wikilinkTarget`/`wikilinkTargets` are
  the strict reading, the one APERtrail uses, and return null for that value.
  Importing the strict pair here would silently stop reading every hand-written
  property value in the vault, and the symptom is an empty card rather than an
  error.
- **Every date in this plugin is a LOCAL calendar day.** The core's date layer
  reads local calendar fields and returns Dates at **local midnight**, never UTC
  midnight, and never `toISOString()`. Mixing the two conventions is what filed
  every meal-plan note one week early in every vault west of Greenwich: a Monday
  pinned to UTC midnight reads back as the Sunday before it, and the ISO week
  derived from that is the previous one. A new caller that builds a Date with
  `Date.UTC(...)` or reads one with `getUTC*` and hands it to anything
  week-shaped is reintroducing that bug.
- **Promise handling:** async callbacks passed to DOM event listeners or
  Obsidian `Setting`/button `onClick` handlers must not be passed as bare
  `async () => {...}`. Either make the callback sync and `void` the async
  call inside it, or explicitly `void` the call at the call site. Never
  leave a floating, unawaited promise.
- **Don't reach for `getMostRecentLeaf()`** when reacting to a specific
  file-open/file-menu event. It's unreliable for fast tab-creation
  sequences. Use the leaf the event actually gives you, or derive it from
  the workspace's current active view, not a second independent guess.
- **An icon-only button sizes its own svg.** Obsidian's `.svg-icon` takes its
  size from `--icon-size`, which is not set in every context, so a button hosting
  a `setIcon()` icon without a `.the-class svg { width; height }` rule can render
  it at zero and simply look empty. That has shipped twice; `tests/stylesheet.test.ts`
  now fails on a new one, identifying them by shape (a small square box with
  `padding: 0`) rather than from a hand-kept list.
- **Styling:** no direct `element.style.x = ...` assignment. Use CSS
  classes toggled via `addClass`/`removeClass`/`toggleClass` for binary
  states, or Obsidian's `setCssProps()` for genuinely dynamic runtime
  values (drag positions, computed popover coordinates).
- **No `console.log`** left in shipped code. Obsidian's review flags this
  directly.
- **No `innerHTML`/`outerHTML`.** Build DOM with
  `createEl`/`createSpan`/`empty()`, or use `.textContent` for plain text.
- **Settings that always travel together get one field, not several.**
  `gallerySavedState` is the worked example: nine gallery filter and sort
  values as one persisted object, not nine top-level keys.
- **Every new user-facing string goes in both `en.ts` and `de.ts`** in the
  same commit. `tests/translation-keys.test.ts` fails otherwise, and it
  also fails if a `t()` call site references a key neither table has.

## Architecture notes

- **CULItrail is a real `Plugin`, not a `Component`.** Hosting several
  `Component` modules under one `Plugin`, the obvious move when they share a
  settings store, forces a `ready: Promise<void>` convention on every one of
  them (`Component.load()`/`onload()` are typed synchronous, so nothing
  guarantees an async body finished). None of that is needed here. Obsidian
  awaits an async `Plugin.onload()`, so ordering is plain `await`, and the
  Plugin-only APIs are called directly instead of being forwarded.
- **Five areas, mirrored in the vault and in `src/`:** meals, planning,
  orders, deliveries, CRM. Each owns a vault folder and a source folder.
  `deliveries/` is the one that reads another area's type: its `view/` imports
  `OrderRecord` to offer the orders a delivery settles. The subtraction itself
  is `trail-core`'s `delivery/from-orders.ts`, which takes the narrowest shape
  it needs of an order rather than `OrderRecord`, so that dependency is on two
  fields and not on the orders area. Anything two areas read belongs in
  `src/vault/`; anything needing no Obsidian `App` belongs in `src/shared/`.
  Growing an area should not mean growing
  `src/vault/` alongside it. **`src/shared/` is now the second choice, not the
  first**: anything Obsidian-free that a second consumer needs as well belongs
  in `trail-core` and is imported back, and so does anything that defines a note
  format, however few readers it has. The CRM contract, the whole date layer,
  the reheating merge, and the frontmatter, link and path layers went that way
  already; `src/shared/` keeps what is genuinely only CULItrail's, plus the thin
  App-bound edge that hands the rest to the core: `vault-host.ts` builds the
  host, and `vault-scan.ts`, `vault-io.ts` and `note-stamps.ts` are delegations
  over it. Its own are `note-path.ts`, `timers.ts`, `expr-eval.ts`,
  `plain-text.ts`, `debounce.ts` and `open-leaf.ts`.
- **`shared/timers.ts` is a `setTimeout` wrapper and nothing else.** The name
  survives a feature that does not: it exists because Obsidian's lint rule wants
  `window.setTimeout()` for popout-window affinity and `window` does not exist
  under Node, so routing every scheduled callback through one file fixes that
  once rather than per call site. It has nothing to do with cooking and never
  did.
- **A rating belongs to a helping, not to a dish.** The meal note's own
  `rating:` was removed outright, along with the gallery's minimum-rating
  filter and its rating sort. Do not add it back as a derived average either
  without asking: the argument was that a dish is not the same twice, and an
  average would be answering the question that was rejected. `ui/star-row.ts`
  stays, for the plan entry and the mark-eaten dialog.
- **The plan note is frontmatter, and the checklist reader is a dead end.** A
  plan holds `week`, `person` and an `entries` list, the way an order holds its
  selections; `plan-note.ts` is the app-free format, `read-plans.ts` and
  `write-plan.ts` are the vault sides. `note-parse.ts`, `meal-suffix.ts` and
  `legacy-body.ts` read the old `- [x] [[Meal]] #meal/lunch` shape and **only**
  read it. Do not add a writer back to them; a note is converted the first time
  anything writes to it, and `scripts/convert-plan-notes.ts` does a vault in one
  pass. `[rating:: 0]` meant eaten-and-unrated, which a real `eaten` field says
  without a magic value, so do not reintroduce the zero.
- **An entry is found by its id, then by what it is.** Every entry a writer
  produces carries one. The identity fallback (meal, day and slot together) is
  not a nicety: an entry typed into the list by hand, or read out of an
  unconverted note, has no id, and an id-only lookup would make the edit a
  silent no-op. The patched entry adopts the id it was looked up with, so the
  fallback runs once per entry and never again.
- **Meal planning is `src/planning/`, not a folder under `meals/`.** It is
  about a week and a person rather than about a meal note, and leaving it under
  `meals/` would keep `meals/` as the place everything lives, which is the shape
  this split exists to get away from.
- **`src/crm/` is deliberately shaped like APERtrail's**, down to file
  names, so the two can be read side by side. They are not shared code and
  never will be. Two implementations, one contract.
- **A company's commercial terms are in `src/crm/company-terms.ts` and not in
  `trail-core`.** Behaviour moves to the core when two consumers need it, and
  only APERtrail has ever suggested it might want this (hotels, sights,
  restaurants have suppliers and discounts too). A shared contract with one
  implementer is a coincidence rather than an agreement. The other two doors
  into the core do not open for it either: a discount ladder is not a note
  format, since the Company note's own shape is already `trail-core`'s `crm/`,
  and it is not arithmetic about the world, since what a supplier charges is a
  commercial arrangement rather than a fact. The module is written
  unit-agnostic for that day: the discount ladder counts "how many", not "how
  many meals", and nothing in it names a dish. Move it, do not rewrite it.
- **Every `type:` value is a setting, none is a literal.** APERtrail draws
  this line differently: nine fixed travel literals, two configurable CRM
  values, because its travel folders are folders it invented. CULItrail has
  no folder it can claim was always its own, so `mealTypeValue`,
  `orderTypeValue`, `deliveryTypeValue`, `mealPlanTypeValue`, `personTypeValue`
  and `companyTypeValue` all go through settings. Do not "simplify" any of them
  to a literal.
- **Notes are identified by folder AND type together.** A note counts as a
  meal only if it is in the meal scan scope and carries the configured
  type value. Two guards make a blank setting safe: a blank folder is
  skipped rather than treated as the vault root, and a blank type value
  matches nothing rather than everything. The rule is `trail-core`'s and takes
  a `NoteKindQuery` (`folders`, `typePropertyName`, `typeValue`); what stays in
  `src/vault/` is the half only this plugin can answer, which is building that
  query out of `foldersFor()` and `typeValueFor()` for one of the six entity
  types. `tests/read-notes.test.ts` tests that mapping and nothing behind it.
- **The dashboard is a twelve-column grid of cards**, not a stack of headings,
  and the span helpers in `ui/dashboard/section.ts` are the only place column
  arithmetic lives. A card's **header holds its title, its week nav and its
  actions**, and the title is the element that gives way when the card is narrow;
  a span-4 card has no room for a title, a button and three nav controls, and what
  gets pushed off the right edge is an arrow nobody can then see is missing. **It
  summarizes; it does not edit.** Its quick actions open the gallery and the
  orders view, which is navigation rather than editing what a card is showing;
  creating a meal moved to the gallery's own toolbar, and the one genuine
  exception the dashboard used to carry (ticking a shopping item off from it)
  went with the grocery list.
- **An icon goes in a slot inside a button, never straight into it.**
  `setIcon(button, name)` renders on a desktop every time and on iOS only in
  some contexts; `setIcon(button.createSpan({ cls: 'culi-icon-slot' }), name)`
  has never failed anywhere. The mechanism is somewhere in the app's own
  stylesheet and was never pinned down, which is exactly why this is a test
  (`tests/icon-slot.test.ts`) rather than a convention: the broken version is
  the one that looks right and passes review on the machine it was written on.
- **Every view that lists something is topped by the one toolbar**, from
  `src/ui/toolbar.ts`: a row, a search field with the magnifier inside it,
  square icon-only buttons for the view controls and labelled buttons for the
  actions that write a note. There were four hand-rolled versions of this and
  they agreed on a desktop and disagreed on an iPad, because each declared its
  own padding in a single-class rule while Obsidian's mobile stylesheet reaches
  the same elements with `input[type='search']` and a `button` selector that
  outrank one class. **Anything the app also styles has to be reached two
  classes deep** (`.culi-toolbar .culi-toolbar-btn`), and the sizes come from
  `--culi-toolbar-height` / `--culi-toolbar-icon` on the row so the mobile
  override is two declarations rather than a second copy of every rule.
  `tests/stylesheet.test.ts` pins both halves. This kit is the suite's reference
  implementation, and the rules the other two are converging on are written up in
  `docs/ui-conventions.md` at the repository root. Read that before adding a
  component here that the other two will need an equivalent of.
- **A card in a grid of cards is one fixed size, and its height must not depend
  on what it happens to contain.** The meal-plan week is the worked example: its
  cards varied from 61px to 126px because the meal title wrapped to between one
  and four lines, a slot label and a leftovers marker stacked as two rows, and at
  a narrow column width the second of those wrapped again. Three rules together
  fix it and none is sufficient alone: the title is clamped **and** pinned to two
  lines (`line-clamp` caps the maximum, a fixed height also lifts the minimum),
  the optional labels share **one row that is always present**, and `min-height`
  carries a card that has neither. The days are a **five-column** grid so Monday
  to Friday is one row and the weekend the next; five fixed columns rather than
  `auto-fit`, because a predictable split is the point and auto-fit gave seven
  columns too narrow for an ordinary meal title. `tests/stylesheet.test.ts`
  cannot catch a regression here, so the reasoning lives in the CSS comments.
- **Nothing is cached, and there is no mirror to keep in step any more.** Every
  view reads the vault on each render. `settings.state` holds the meal-plan
  entries, which the notes remain authoritative for: **the notes are the source
  of truth; state mirrors them; never let the two drift without an explicit sync
  path.** The only action that reconciles a week you are already looking at is
  **Resync meal plan**, and it makes state agree with the note, never the
  reverse.
- **Wikilinks resolve by note title, never by path.** A link that matches
  nothing resolves to `null` rather than raising; the referring card
  renders one fewer row. Both the parsing and the resolution are
  `trail-core`'s; `vault/read-notes.ts` re-exports `indexByTitle` and
  `resolveByTitle` so call sites keep one import. `stripWikilink`
  also unwraps the embed prefix, so an `image:` written as `![[photo.jpg]]`
  resolves to the same file as `[[photo.jpg]]`.
- **Some fields are derived, never written back.** Total time from prep plus
  reheat is the standing example. An explicit value in the note always wins over
  the derived one. Writing the derived value back would mean editing one note as
  a side effect of editing another, and it would go stale the moment its source
  changed. `lastEaten` and `eatenCount` are the one stated exception, for the
  reason given under Eating history.
- **Property values are a different question from property names.** Names
  are always configurable. Meal slots (Breakfast/Lunch/Dinner/Snack) and
  weekday keys are fixed vocabularies, because the note format and the
  grouping key off those exact strings. How a meal slot is _written_ is
  written on a plan entry is its `slot`; which four exist is not. The slot popover
  offers those four and an "Anytime" that clears the slot, deliberately without
  a free-text field: a fifth value invented at a drop site would have no
  column to appear in.
- **Every modal extends a shared `BaseModal`**, not Obsidian's `Modal`
  directly. `BaseModal` owns `onOpen()` and builds the sticky header /
  scrollable body / sticky footer structure itself; concrete modals
  implement `getTitle()`, `renderBody(body)` and `renderFooter(footer)` and
  never touch `this.contentEl` or the top-level layout. Footer buttons are
  right-aligned, one row, horizontal-scroll on overflow rather than wrap.
  Order is Cancel then the primary action. The primary action gets
  `mod-cta` (`mod-warning` if destructive), not custom colour CSS.
- **Every note CULItrail writes carries a minimal header**: `type:`,
  `created:`, and where relevant `modified:`. `trail-core` owns both the values
  and the two passes that write them, and `src/shared/note-stamps.ts` is the
  `App`-shaped face of those passes. **Create-once, update-always**: a note this
  plugin makes gets `created` and nothing else, and `modified` appears on its
  first real edit. Five rules are load-bearing:

  - **`createdProperty` and `modifiedProperty` are settings**, defaulting to
    `created`/`modified`, spelled identically to APERtrail's so the two
    plugins do not stamp one shared CRM note under two names. **A blank name
    means "write that stamp nowhere"**, never a fallback to a literal, and the
    stamper returns early rather than running `processFrontMatter` with
    nothing to write: that call gives a note with no frontmatter an empty
    `---\n---` block, which is a visible change to every meal-plan note in a
    vault that had turned the stamp off.
  - **A modification never invents a `created`.** A note that arrived without
    one keeps not having one. The plugin does not know when somebody else's
    note was made, and a guessed date is indistinguishable from a stated one
    once it is on disk.
  - **Key order in a new note is `type`, then `created`, then the rest.** In
    `createOrderNote()` that is why the type key is written before the spread
    of `buildOrderFrontmatter()`: re-assigning a key that is already present
    leaves it where it was.
  - **One logical write is one stamp.** The meal editor's save is one
    `processFrontMatter` pass and up to two `vault.process` passes, and the
    eating-history writer is one of each; both stamp in the frontmatter pass
    only. Prefer folding `stampModified()` into a pass a write is already
    making over adding a second pass to the same file.
  - **A writer that rebuilds a note from its parts has to carry the
    frontmatter across.** `writeNote()` replaces the file outright, so anything
    reassembling a note splits the block off with `splitFrontmatterBlock()` and
    puts it back. `parseMealPlanNote()` also refuses to read anything inside
    that block as a meal, since a top-level YAML list would otherwise plan a
    dinner nobody chose.

- **Ribbon icons are built once, at load, and toggled by CSS class.**
  Obsidian's ribbon doesn't reliably drop an icon once added; it keeps its
  own record of registered actions and can redraw a "removed" one back in.
- **Views follow the singleton-leaf pattern** via `findOrOpenLeaf()`.
  Opening the dashboard or gallery twice reveals the existing leaf. The four
  views that render one note, the meal view, the order note view, the delivery
  note view and the plan note view, are the
  exception: they are `TextFileView`s that replace Obsidian's own rendering of
  the file, one per open note, and none of them ever writes `this.data` back.
- **Auto-open is one registration serving every kind that has a view.**
  `meals/lifecycle/register-lifecycle.ts` takes a list of targets (a kind, a
  view type, the setting that enables it, how to open it, its menu label) and
  `auto-open.ts` decides for any of them: `shouldOpenInOwnView`, taking
  `isSubject` rather than naming a kind. Both events stay bound, the suppression
  stays timed rather than consume-once because one `setViewState()` fires both,
  and the suppression is asked **once per path rather than once per target**,
  since it is about a note having just been handed back as Markdown deliberately.
  A second copy of that plumbing per kind is two chances to get the fires-twice
  case wrong.
- **Anything with a clock time is written quoted.** Obsidian's YAML parser
  turns an unquoted `2026-02-13T09:00` into a native `Date`, and a `Date`
  rendered through a day formatter truncates to `YYYY-MM-DD`. This caused
  real data loss in the inherited code before it was found.

  **The caveat, verified empirically: js-yaml's timestamp type requires
  seconds.** `2026-08-04T16:33:00` is coerced; `2026-08-04T16:33` is dumped
  unquoted and loads back as a plain string. So the minute-precision note
  header (`created`/`modified`) is deliberately **not** quoted, and it cannot
  be: `processFrontMatter` re-serialises the whole block itself and would
  discard hand-added quotes anyway. `quoteDateTime()` is still right for
  everything it wraps today; the rule is about the second, not the colon. Do
  not "fix" the note header to match it.

## Localization

Every user-facing string routes through `t()`, every folder default routes
through the localized-defaults resolver, and the gaps this section used to list
as **must fix before the first release** are closed. Kept as a section rather
than deleted, because each one is a trap that can be reopened by a
plausible-looking change:

- **A default that freezes into `data.json` must resolve through `t()`, not sit
  as a literal.** The body headings, the built-in badge labels and the
  reheat-appliance labels all do now (headings and folders via
  `getLocalizedDefaults()` and `getLocalizedAppliances()`, labels via
  `labelKey` resolved at render). The two
  exceptions are `nutritionHeading` and `micronutrientHeading`, which are
  deliberately English literals in both locales and are **not** on
  `LocalizedDefaultKey`: they are read-only now, and what they have to match is
  the exact wording already sitting in notes that nothing will rewrite until the
  vault migration runs. Every property and field name is a literal for the same
  family of reason, the seven per-100 g ones included: a frontmatter key is not
  display text. The reason this
  had to land before release: once a default is persisted, the plugin cannot
  tell an untouched default from a value somebody deliberately typed in
  English, so there is no safe repair afterwards. The English literals still in
  `defaults.ts` are the pre-I18n fallback for a caller that reaches
  `mergeSettings()` outside the plugin bootstrap, such as a test. **Do not add
  a new default that is a bare user-facing literal.**
- **Strings written into the user's notes stay English literals.** Weekday
  headers, the queue labels, `#leftovers`, the meal-slot slug. These are keys,
  not text: translating them orphans every note that already exists, and
  `dayRank()` matches the English list, so a translated heading also sorts wrong.
  Translate what a human reads, never what a note stores. Same rule as `type:`
  values and APERtrail's status vocabulary.
- **An appliance's id and its display name are separate.** A note's sub-heading
  is matched against the label first, then the id, then the shipped defaults in
  either language, so a vault writing `## Dampfgarer`, `## Steamer` or
  `## steamer` all resolve to the same appliance. Collapsing the two back into
  one string is what would make the vocabulary untranslatable without editing
  every note that names an appliance. This is the same key-versus-label
  separation `type:` values have, and it is the last surviving instance of a
  rule that used to govern the grocery categories as well.

Correctly untranslated, do not "fix": `[rating:: N]`, the `{GGGG}`/`{WW}`/
`{person}` path tokens, the order filename format, and `type:` values
(settings, not translations).

## The vault layout

```
Eating/                   eatingFolder       (German: Essen)
  Meals/                  mealsFolder        (Mahlzeiten)
  Meal Plans/             mealPlansFolder    (Essenspläne)
  Orders/                 ordersFolder       (Bestellungen)
  Deliveries/             deliveriesFolder   (Lieferungen)
CRM/                      crmFolder          (CRM)
  People/                 personsFolder      (Personen)
  Companies/              companiesFolder    (Firmen)
```

`rootFolder` is an optional common parent above both, defaulting to empty,
meaning the vault root. Every sub-folder derives from its root, so a module
relocates in one field; any single sub-folder can still be repointed alone.
A saved root always wins over the pristine default when a sub-folder
setting is added later.

**The `CRM/` names are copied verbatim from APERtrail's own tables in both
locales, and the `person`/`company` type values come from `trail-core`'s
`CRM_CONTRACT`.** That is the entire
mechanism behind the shared-CRM contract. Do not "improve" any of them
without changing APERtrail in the same breath.

Filenames:

- Meal plan: `{GGGG}-W{WW}-{person}-MealPlan.md`, one per person per ISO
  week, year-nested. `{GGGG}`/`{WW}` are ISO week-year and week-number
  tokens, deliberately not `{YYYY}`/`{ww}`, which are calendar-year based
  and disagree near a year boundary. `{person}` is the person note's title
  with spaces removed. The date the tokens resolve against is a **local**
  midnight Monday from `trail-core`'s `startOfWeekTitle()`;
  `tests/date-utils.test.ts` runs that whole chain in five real timezones,
  because a UTC one used to file every note a week early.
- Order: `yyyy-mm-dd-ordernumber.md`. **The order number lives only in the
  filename**, never in frontmatter, so it has no property and no setting.

Meal-plan entries are keyed by **weekday** (Monday/Tuesday/...), not dated.
This is deliberate, not a placeholder. Don't introduce real dates into that
model without a real design conversation first.

## When unsure

Ask before guessing on anything touching: settings shape or naming, how two
features should relate, whether something is a bug or deliberate
platform-specific behaviour, anything that changes what gets written into a
user's notes, and above all anything that changes a default the shared-CRM
contract depends on.
