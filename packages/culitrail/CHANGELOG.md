# Changelog

All notable changes to CULItrail are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Renaming a default property name, changing a `type:`
value, or changing what a reader will accept out of a note somebody already has
is breaking, because nothing migrates a vault automatically and a property no
note carries is not an error. See
[Data model](docs/design/data-model.md) for the note formats this promise covers.

`npm version` runs `sync-version.js`, which copies `package.json`'s version into
`manifest.json`, so the two cannot drift.

## [Unreleased]

## [1.0.0] - 2026-09-04

The first public release. Nothing in a vault changes: the note formats,
property names and folders are the ones 0.1.0 read and wrote, and a vault built
against the private builds is a vault this release reads.

The first work after the freeze, and all of it is what a freeze is for.

### Added

- **The dashboard header matches the other two plugins'**: the buttons, then
  the search on its own row, then the greeting carrying the date. It used to
  greet before it offered anything, and shared a row between the search and the
  two buttons, so on a narrow window the search wrapped to a stub.

- **A new setting, Number and date format**, deciding how figures are grouped
  and dates ordered. Empty follows the computer. Shared with APERtrail and
  NODAtrail through trail-core's `DISPLAY_CONTRACT`, so one vault is not asked
  three times.

### Fixed

- **A dish price is drawn by the same formatter as the rest of the suite**, so
  it groups thousands (`CHF 1'234.50` rather than `CHF 1234.50`) and follows the
  new **Number and date format** setting. A dish rarely costs four figures,
  which is why nobody noticed; an order total does. The separator between the
  code and the figure is now a non-breaking space, which is what `Intl` uses and
  the right character for money.
- **The test tree is type-checked**, by `npm run typecheck` and therefore by
  `build` and `check`. It found the meal-plan note-entry fixture never setting
  `id`, so every one carried `undefined` where the type documents `''` for an
  entry with no identity of its own -- and matching treats the two differently.
- **"Resync this week from its notes" resyncs the week you are looking at.** It
  was wired to the current calendar week whichever week the meal-plan view was
  showing, so the one case the command exists for -- a week on screen that needs
  reconciling with its notes -- was the case it could not serve. It now takes the
  viewed week when there is one and this week otherwise, which is what the name
  says. The meal-plan view's own button was always correct; only the palette
  entry was wrong.
- **An order is worth one number on every surface that shows one.** The invoice
  document totalled a priced order from its lines; the card in the orders list
  and the sort behind it preferred the figure typed into the note. Four of the
  vault's sixty-two orders carry line prices and all four agree with their stated
  total, so the two rules returned the same number every time and would have gone
  on doing so until somebody edited a note by hand. The rule now lives in
  `orders/view-model/order-total.ts` and all three read it there;
  `tests/order-total.test.ts` fails if a fourth surface computes its own.

### Removed

- **The meal-plan carousel.** It was written for a shopping list that this plugin
  does not have and never shipped: complete, exported, and called by nothing. Its
  view model, its test, its nineteen stylesheet rules and its translations went
  with it.

## [0.1.0] - unreleased

The first version. Feature work stops here while the sibling plugin catches up;
what follows is fixes and the documentation that describes them. Not tagged for
Obsidian's community plugin directory; builds are distributed by Technosoftware
GmbH for internal and customer vault use.

Everything below is one release. The sections are grouped by what happened to a
vault rather than by when it was written.

### Removed

- **The meal suggester, in full.** The modal, the modes and their editor, the
  `suggesterModes` setting and `state.lastUsedModeId`, the filter operators,
  the `suggest-meal` command and the dashboard button. It offered a
  weighted-random pick over a library that can already be sorted by last eaten
  and filtered to never-eaten, which was a second answer to a question the
  gallery answers in place. `meals/discovery/` stayed: the badge editor's
  property picker is written in the same field vocabulary.
- **The dashboard's orders card.** Three rows of a record that is searched
  rather than skimmed, taking a third of the width of the row it sat in. The
  orders view is one click away in the top bar.

### Changed

- **An order document states one total.** The subtotal, the adjustments, the
  figure computed from the lines and the figure the note stated were four rows
  saying one number four ways. A priced order is totalled from its lines, an
  order with no line prices uses the total somebody typed, and the discount, the
  shipping and the VAT moved up into the facts row beside the dates. The orders
  list drops its "From the lines" row for the same reason.
- **The order editor computes the total instead of asking for it.** As soon as
  any line carries a price the Total field is filled from the lines, less the
  discount, plus the shipping, and cannot be typed into; editing a meal's price
  is what changes it. An order whose lines carry no prices keeps an editable
  field, since there is nothing to compute from. This is what makes the single
  total above safe: a note and its own lines can no longer disagree.
- **The invoice model and its renderer moved into `trail-core`.** Two documents
  now share them, and the travel plugin's hotel and restaurant records are the
  third. Nothing about the order view changed; the model it builds is imported
  from `trail-core` rather than declared next to it, and the wrapper class it
  puts on the view is `culi-document-note-view` instead of
  `culi-order-note-view`, since two kinds of note wear it.
- **The settings page is one page with four sub-pages.** The six-tab strip is
  gone. The root page carries a plugin block (version, release notes, support
  and contact links), Vault setup, the Meal view, Planning, Orders, Browsing
  and About sections; the long lists live one click away, as **Folders** and
  **Property keys**, and the two list editors -- header badges and reheat
  appliances -- get a page each instead of being nested inside a tab. Nothing
  was removed from the settings and no setting changed its meaning.
- **Every frontmatter name is on one page.** All eighty-three of them, grouped
  by the note that carries them, under the same headings the tabs used, with a
  filter box for when you know the name and not the group. They used to be
  split across four tabs, grouped by the feature that read them.
- **The switch that unlocks property names appears once**, at the top of that
  page, rather than at the top of each of the four tabs that held one of those
  rows.
- **The status block counts all six note kinds in one place**, under Vault
  setup, instead of meals and plans on one tab and orders, deliveries, people
  and companies on another.
- **The four auto-open switches are together**, under Browsing, rather than
  one per tab beside the feature each opens.
- **The dashboard's top bar navigates instead of creating.** **Add meal** and
  **Suggest a meal** are gone; **View meals** and **View orders** are there
  instead. Creating a meal moved to the gallery, where a library is browsed.
- **The newest-meals strip is six cards across the full width**, rather than
  four beside the orders card.
- **"Plan a meal" plans.** The button on the meal-plan card, and clicking an
  empty day in it, open the meal-plan view's own picker and then ask for the
  day and the slot. The `suggest-meal` command is replaced by **Plan a meal**,
  which does the same thing from the palette.
- **The gallery's toolbar carries Add meal**, to the right of the sort button.
- **The orders view has the gallery's toolbar**: a search over supplier, order
  number and the dishes picked; a filter for one supplier, one year, or orders
  no delivery has been logged against; and a sort by order date, delivery
  date, supplier or total, in either direction. Where it was left is
  remembered, in a new `ordersSavedState`, the same way the gallery's is. The
  deliveries listed underneath are deliberately not narrowed with it.

### Fixed

- **A meal no longer renders twice after a save.** The meal view emptied its
  container on its first line and built the meal after two reads. Three things ask
  it to redraw and saving trips at least two within a few milliseconds, so both
  passes emptied a container neither had drawn into and then both appended. It now
  empties after the reads, and an overtaken render stops before touching the
  screen. `tests/render-race.test.ts` pins the rule across the package: between
  emptying a container and drawing into it there must be no await.
- **The gallery search finds what it is given**, and a badge whose key was renamed
  keeps its label instead of falling back to the key.
- **A product line no longer vanishes when the next one is added.**
- **Toolbar buttons are one size again, and the icon-only ones have their
  icons back.** On a tablet a row of four came out four different heights and
  the two square ones came out empty, because each toolbar declared its own
  padding in a single-class rule while Obsidian's mobile stylesheet reaches the
  same elements with selectors that outrank one class. The four hand-rolled
  toolbars (gallery, orders, meal-plan header, dashboard top bar) are one
  component now, `src/ui/toolbar.ts`, sized through two-class selectors and two
  custom properties that the mobile override changes in one place.
- **The search boxes no longer print their placeholder underneath the
  magnifier**, the same specificity fault in the same rules.
- **Icon-only buttons draw their icons on a tablet.** `setIcon()` aimed at a
  button element renders on a desktop every time and on iOS only sometimes;
  aimed at a child element it has always rendered. Every icon in this plugin
  now sits in a `culi-icon-slot` span, which fixes the gallery's and the orders
  view's filter and sort buttons, the meal-plan cards' two action buttons, the
  list editors' move and remove buttons, the gallery card's menu, and the order
  and delivery rows' edit buttons -- all of which had been drawing blank
  squares on a touch screen. `tests/icon-slot.test.ts` fails on a `setIcon()`
  call aimed at a button.
- **Every control that shares a row is one height**, including the meal-plan
  card's person select, its two actions and the week nav, which came out three
  different heights on a touch screen. `--culi-control-height` on the body is
  the single source, and `tests/stylesheet.test.ts` fails if a control goes
  back to a literal height or to a one-class rule.

### Added

- **Diet, allergens and product line become vocabularies.** Each is a list in the
  settings, and a field with an empty list stays a text box rather than becoming a
  dropdown with nothing in it. The meal editor can also set the header picture,
  from the vault or from the machine.
- **A supplier's product lines get an editor**, in the plugin that reads them.
  This is the one property CULItrail writes onto a Company note, and it removes
  the property rather than writing an empty list when the last line goes.
- **Roles on a person as well as a company**, so a contact can say which pickers
  it belongs in. The role that marks a meal supplier is a setting rather than an
  invisible rule, and an empty one offers every company rather than none.
- **A delivery note opens as a document.** It is the order invoice without the
  money: the supplier across the top, the date it arrived, what was in the box
  and how many portions that came to, and the orders it settles underneath.
  Until now a delivery note kept everything in frontmatter, so opening one
  showed a blank page. It comes with the same handles an order has -- the two
  pencils in the header, the file-menu entry, **Open in delivery view** and
  **Open this delivery as Markdown** in the palette -- and a new
  `autoOpenDeliveryView` setting beside the other three, on by default because
  the alternative is an empty note.
- **What's new**, a settings row that renders the newest releases from this
  file inside Obsidian. The text is bundled at build time rather than fetched,
  so it cannot drift from the changelog and nothing reaches the network.

### Added, from the first working version

- **Meals.** A structured meal view with a hero image, badges and per-appliance
  reheating instructions, a searchable gallery with folder, diet, allergen and
  tag filters, and a meal editor covering the whole nutrition breakdown.
- **Nutrition on two bases.** Per-serving figures and a per-100 g breakdown in
  frontmatter, the first derived from the second and the serving weight on every
  save, so the two cannot disagree after an edit to either.
- **Meal planning.** One note per person per ISO week, with days, slots, a queue
  for what is planned but not placed, drag-and-drop, and a helping that carries
  its own rating, time and note.
- **Eating history.** The plan entries are the record; `lastEaten` and
  `eatenCount` are written back onto the meal note from them.
- **The meal suggester**, weighted so a dish not eaten for months comes up more
  often than last night's.
- **Orders and deliveries.** One note per order, rendered as an invoice, with
  per-person selections in a bare or priced shape; deliveries as their own notes,
  because one order can arrive in two boxes and one box can settle two orders.
- **The shared CRM.** Person and Company notes read out of `CRM/People` and
  `CRM/Companies`, on defaults shared with APERtrail through `trail-core`'s
  `CRM_CONTRACT`, plus seven company purchasing terms that are CULItrail's alone.
  A `culi-related-orders` block renders inside a Person or Company note without
  claiming it.
- **English and German**, detected from Obsidian's own language setting, with
  locale-seeded folder defaults.
- **Every vault-facing name is a setting**, behind the `unlockPropertyNames`
  lock, so a vault that already uses other names renames nothing on disk.

### Still read, no longer written

Carried deliberately rather than left over. Each is covered by a test that fails
if support is dropped:

- The plan checklist body (`## Tuesday` over `- [x] [[Meal]] #meal/lunch
  [rating:: 5]`), converted the first time anything writes to the note.
- Order selections version 1, one flat property per person, upgraded on save.
- The `eatingHistory` frontmatter list, read behind the plans.
- The two per-100 g body sections, read whenever the four properties state
  nothing and converted the first time the editor saves.
- Three eating-history id markers: `rb-id` from Recipe Box, `cul-id` from
  CULInode and `culi-id` today. All three are read; only the last is written.
