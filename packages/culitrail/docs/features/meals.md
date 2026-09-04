# Meals

> **Status: built.** Nothing on this page is outstanding.

A meal is a plain Markdown note in the meal scan scope carrying the
configured type value in its frontmatter. Both halves are settings:
`mealsFolder` plus `additionalMealFolders` for the scope, `mealTypeValue`
(default `meal`) and `typePropertyName` (default `type`) for the
identification.

**Folder and type combine with AND, not OR.** A note only counts as a meal
if it is both in scope by folder *and* matches the configured type. A blank
type value matches nothing rather than everything, so clearing it hides the
folder instead of claiming every note in it.

**A meal is a dish somebody orders ready-made.** It has no ingredient list
and no method, because it arrives cooked: what a note carries is what the
dish is, what it costs, what is in it nutritionally, what it might set off
in somebody with an allergy, and how to warm it up. Nothing in the plugin
reads an ingredients or a method heading any more, and a note that still has
one is rendered as one more trailing section.

## The meal view

Opening a meal note swaps Obsidian's normal Markdown rendering for a
structured **Meal view** (auto-opens by default via `autoOpenMealView`, or
force it back to plain Markdown with the **Open as Markdown**
command). It renders:

- A **header** with the title, the categorical badges as pills under it, the
  tags, and then the figure strip: the nutrition columns
  first and the figure badges after them, with the price on its own line
  underneath. The image comes from `imageProperty`, or from the note's first
  body image when `useFirstBodyImageWhenFrontmatterEmpty` is on, or from
  `defaultMealImage` when there is neither.
- The **allergen banner**, when the meal declares an allergen the reader has
  listed under `myAllergens`. It is rendered above the layout rather than
  inside it, so both arrangements show it in the same place, and it is the
  only warning left in the plugin.
- A **meta banner** with the servings the note states and the four header
  actions, in the order they are reached for: the favorite heart, **Mark as
  eaten**, the calendar button that puts this meal on the plan, and the
  pencil that opens the editor. The calendar button asks for a day and a
  meal slot; the week and the person are the ones the meal-plan view is set
  to, shown rather than chosen, so planning from here and planning from
  there can never land in two different places.
- The **description**, which is whatever free text sits between the
  frontmatter and the first heading.
- A column beside the body holding the image, the **Eating history** chip
  carrying its number of entries, and one button per trailing section the
  note happens to carry. CULItrail does not know what those sections are and
  deliberately does not try: everything it does not claim is offered back
  under its own heading, so a note is never punished for holding something
  the plugin has no feature for.
- The **per-100 g breakdown**, when the note states one: a card of its own
  holding energy, then the macronutrients, then the micronutrients, one row per
  nutrient with the unit the note stated it in. It sits before the reheating
  card, because the two answer questions in that order: what this dish is, then
  what to do with it. Nothing renders an empty frame, so a meal that declares
  nothing has no card.
- The **Reheating** section, one group per appliance, described under
  [Ready meals](../design/ready-meals.md).

**There are two nutrition surfaces, and they are different claims.** The figure
strip at the top is four figures **per serving**; the breakdown card is the
declaration table off the packet, **per 100 g**. A meal can carry both and
neither says what the other says, which is why the strip keeps its caption and
the card keeps its heading even on mobile, where the reheating card's heading is
hidden. Figures with nothing stating their basis is the failure both exist to
prevent.

The card reads a meal in whichever shape it is in. The breakdown lives in
frontmatter, but a meal written before that move keeps it in two body sections,
and **the reader falls back to those sections** when the frontmatter states
nothing. The vault migration has not run, so a library is half one shape and
half the other; a reader should not be able to tell which half a given meal is
in. Where a note has both, the frontmatter wins outright, because merging would
let a stale section overwrite a figure somebody had already corrected. The
labels come from the nutrient ids rather than from the words in the note, so a
German vault reads a German table even out of a section written in English, and
a nutrient the plugin has never heard of is shown exactly as typed rather than
dropped.

There is also a **kitchen mode** button in the tab header, which holds a
screen wake lock while a dish is being warmed up. It is deliberately not
persisted: it is about what is happening right now, and a vault that
reopened with the screen pinned awake would be a battery bug.

### Header badges

A badge is tied to a frontmatter property, a computed formula, a value the
plugin works out for itself, or nothing at all when it is a layout element.
Six ship built in: Diet, Prep, Reheat, Total, Last eaten and Streak.

**A badge renders as one of two things, and it does not choose.** A figure
becomes a column in the header strip: a small uppercase label with the value
under it, the way a shop states what is in a dish. Anything categorical stays
a pill, in a row directly under the title, which is where the Diet badge is.

**The strip also carries the nutrition figures, and they come first.**
Nutrition (calories / protein / fat / carbs, each a configurable property)
used to sit in the meta banner below; it is in the strip because on a real
library that was the only place four figures appeared, while the badge half
of the strip was one column on ninety percent of the notes. A rule is drawn
between the nutrition columns and the rest, because the caption under the
strip ("Nutrition per serving") describes only the nutrition figures and
would otherwise read as covering the times as well.

Which form a badge takes is derived from its own shape rather than
configured, and the rule is short: a strip column is one label over one
figure, so a badge that **declares itself a list** (`One chip per value`,
which Diet ships with), one that resolved to **several values**, one with
**no value** at all (a boolean, which renders as its icon and label), and one
with **no label** to head the column are all pills. Everything else is a
figure. The reason it is not a setting: keying it on how many values a note
happened to state made the Diet badge sit under the title on a meal naming
two diets and in the strip on a meal naming one, so the badge moved about
from meal to meal.

Two consequences worth knowing. **An icon and a colour apply to the pill form
only** (a column has no background to tint and no room for an icon above it),
and the badge editor says so on both fields. And a **prefix and suffix are
folded into the figure** rather than being their own elements, so a badge
with "approx." and "min" reads as one value in its column.

Total is a **formula** badge, `(prepTime || 0) + (reheatTime || 0) || null`,
which is why a meal with no `totalTime:` still shows one. A formula is
arithmetic over frontmatter, and a user can write one.

Streak is a **derived** badge, which is a different thing: it walks the
eating-history records, which no formula can express. `derived` is
deliberately a separate field from `property` rather than a reserved property
name, because nothing reads or writes `eatingStreak` in a note. Giving it a
configurable property name would promise a property that does not exist, and
keeping it out of `property` also means a vault that really does carry
`eatingStreak:` cannot shadow the computed one. Such a badge shows no
property or formula row in its editor, since setting either would silently do
nothing; its label, icon and colour are still editable like any built-in's.
See [Eating streak](#eating-streak) for what it counts.

Built-ins can be edited but not deleted. Custom badges can be added freely,
and `separator` and `newline` badge types control the row's layout, so
arranging the header is part of the same list rather than a second setting.

Streak is the one built-in that ships **disabled**. Two reasons, and both are
worth keeping: nobody's already-arranged header should gain a chip they did
not ask for, and it is what makes the migration in `settings/validate.ts`
safe. A saved badge list wins outright over the defaults, so a built-in added
in a later version would never reach a vault that has saved one, and the
editor cannot re-add a built-in. With no version marker in `data.json`,
"absent" cannot be told from "removed by hand", so a missing built-in is
appended only when it ships disabled, where re-adding it is invisible and
costs nothing if the guess was wrong. A built-in that ships enabled stays
absent, so hand-removing one sticks. A future built-in that wants to reach
existing vaults therefore ships disabled too.

### Desktop and mobile

There are two layouts and neither is a setting. `desktop-classic` stacks
everything, with the image and the section buttons in a narrow column beside
the reheating steps. `mobile-tabs` is what a phone gets: a header, then the
tabs this meal actually has, up to three of them (Reheating, Nutrition, Info).
**The tab list is built from the note**, so a meal whose supplier states no
reheating and which declares nothing per 100 g gets one tab rather than three
with two of them empty, and Info is always present so the strip is never empty.
A single tab is rendered as a plain panel instead, because a strip offering the
one choice already on screen is a control that cannot be used.

The breakdown is a tab rather than a card under the strips, which is the one
place the two layouts disagree about more than arrangement. The mobile header is
already eight boxed figures, a price and an action row; a declaration table that
can run to thirty-five nutrient rows under all of that would put Info below the
fold on every meal that has one.

Mobile is not offered the desktop arrangement, and the reason is not screen
width alone: the tabbed layout is a different arrangement for a different way
of holding the device, so offering the desktop one on a phone would only
offer a worse experience.

**The header strip is the divergence worth knowing about.** Desktop puts
nutrition and the figure badges in a single row of columns, because it has
the width for eight of them. Mobile keeps them as separate boxed strips,
nutrition then times, because seven columns across a phone is about 55px each
and turns a German label into three lines. Both are the same component with
the same rule deciding what goes in it; only the grouping differs. Mobile's
Info tab therefore does not repeat the nutrition figures, since the header
above the tabs already shows them.

## Browsing meals

### Gallery

Every meal as a card grid, filterable by folder, diet, tag, favorite-only,
"never eaten", allergen exclusion (against `myAllergens`) and free-text search.
Sortable by title, date added, date modified, last eaten or times eaten.

The toolbar is a search field, a filter button, a sort menu and **Add meal**,
in that order. The add button is labelled where the two before it are icons
only, because those change what is on screen and this one writes a note. It
lives here rather than on the dashboard: a library is added to while somebody
is looking at what is already in it.

The row itself is `src/ui/toolbar.ts`, shared with the orders view, the
meal-plan header and the dashboard's top bar, so a button is the same size
wherever it appears, on a desktop and on a tablet alike.

**A filter that cannot change the grid is not shown.** A dropdown earns its
place when picking one of its options would leave some meal out, which happens
in exactly two cases: there is more than one option, or there is one and some
meals state none. One folder that every meal is in fails both and is not
offered; one tag on one meal out of 127 passes the second and is. The
favourites checkbox appears once something is a favourite. A control that can
do nothing reads as broken rather than as empty, and no state of the library
makes it work. The exception is a filter that is currently set: hiding that one
would leave the grid narrowed with no way to widen it.

**A card is a picture with its title over it, then three rows that are always
the same three**: the diet and any badge somebody added themselves as chips,
the four nutrition figures abbreviated to `kcal / prot / fat / carb`, and how
often the dish has been eaten with when it was last eaten. The rows are fixed
rather than appearing only when they have something to say, because a card is
a grid item stretched to its row's height: one taller card makes every card
beside it taller and leaves the rest with a gap.

A **price** sits between the nutrition figures and the eating figures, when
the note states one (`priceProperty`, default `price`, alias `cost`). It is
what one portion costs to buy ready-made. The currency is the meal's own
`priceCurrency:` when it states one, then the supplier Company's currency, and
only then `orderDefaultCurrency`: a household ordering in one currency should
never have to type it on a single note, and the one dish from a German
supplier should not be shown in the wrong one. The meal view shows it as a line under the figure
strip, and the meal editor has a field for it under a **Ready meal** label in
the Basic info group.

Two things the card leaves out on purpose. **Total time is not on it**: three
columns at card width put an ellipsis through both a duration and a date, and
the meal view shows the time in full. And **the nutrition basis is a tooltip
rather than a caption**, because there is no room for a line of small print
but "647" with nothing saying whether that is a plate or a tray would be
worse than no figure.

The full filter and sort state persists as **one unit**
(`gallerySavedState`) rather than as nine separate settings, so reopening the
gallery picks up exactly where you left off.

Clicking a configured meal folder in the file explorer, or in
[Notebook Navigator](https://notebooknavigator.com), can open the gallery
pre-filtered to that folder, optionally including subfolders
(`openGalleryOnFolderClick` / `openGalleryOnFolderClickSubfolders`).

### Dashboard

A home base over all four areas, laid out as one twelve-column grid of cards
under a time-of-day greeting. Column arithmetic lives in one set of span
helpers rather than in nested rows.

Top to bottom: a meal search that hands its query to the gallery's own filter
state, beside **View meals** and **View orders**; the eating-activity chart as
the hero, with the library's size and its most-eaten meal in two stat cards
beside it; the week's meal plan as seven day columns with a thumbnail per
entry; and the six newest meals as gallery cards across the full width.

The top row navigates rather than creates. An earlier version argued the
opposite, on the grounds that every card already links to the view it
summarizes: that stopped being true when the orders preview card went, and
creating a meal belongs in the gallery beside the shelf it fills. The orders
preview itself was three rows of a record that is searched rather than
skimmed, and it earned less than the width it took.

The chart is one bar per day up to four weeks and one per week beyond, with a
two-tick y-axis, gridlines, an x-axis that thins its labels once the bars get
dense, a tooltip per bucket and a click that lists what was eaten in it. It
counts the eating-history records themselves, so a meal eaten six times
contributes six outings rather than one; a meal with no log but an explicit
`lastEaten` still contributes that one day. With eating history switched off
the same slot shows a recently-eaten list instead, which is the one question
such a vault can still answer.

`dashboardActivityRangeWeeks` (1, 2, 4, 8 or 12) sets the chart's range and
what "recently" means for the eaten-recently count, and the chart's own
selector writes it.

The meal-plan card browses its **own** week, the same field the full view
uses, so switching week in one place does not surprise the other.

The dashboard summarizes rather than edits. The only two things it writes are
which week it is browsing and which person it is showing, and the second is
the same setting the meal-plan view uses, so the two can never point at
different people.

Every figure is counted from the notes on each render and none is stored. An
"eaten in the last eight weeks" number written to disk would be wrong by the
next morning with nothing to notice it.

`enableDashboard` also decides the ribbon: on, one dashboard icon; off, the
gallery and meal-plan icons instead. Both sets are built once at load and
toggled by CSS class, because Obsidian's ribbon does not reliably drop an
icon once added.

## Editing and organizing

The **Edit meal** modal is staged: nothing reaches the note until **Save
changes**, so a half-finished edit costs nothing and closing it is always
safe. That is the difference between it and the rest of the meal view, where
the heart and the stars each write the moment they are clicked.

It covers the description, prep / reheat / total, servings, the ready-meal
price, supplier and line, diet, allergens, the header image and nutrition.
**New meal** asks for a
name, makes the note and opens this same editor on it, rather than offering a
second form for the same fields: everything a meal has is already a field
here, and a second form would be a second place for those fields to drift.

**The ready-meal price is here**, under a **Ready meal** label in the Basic
info group, with the currency beside it.
It began life as a fifth small box beside the timings, where it rendered
correctly at every width and nobody could find it: a price reads as another
number about timing when it sits next to Prep, Reheat and Total. Its own
labelled row says what a price is doing on a meal at all.

**The supplier sits under the same label**, as a dropdown over the Company
notes rather than a field somebody types a wikilink into. Beside it is the
**line**, the range the supplier sells this dish under, such as Alltag, Sport
or Weightloss, offered from whatever the chosen company lists. The same dish in
two lines is two notes: the nutrition differs between them, and one note could
only state one set of figures. It writes a
wikilink and removes the property when set back to nobody, since a
`supplier:` with nothing after it would be read as a supplier named "".

**The list always contains whatever the meal already names**, even when no
Company note matches, and that is the rule worth not undoing. CULItrail
creates no CRM notes and resolves them by title, so a meal can name a company
whose note has been renamed, moved out of the companies folder, or never
existed. A dropdown built from the companies alone would not contain that
value; a select whose value matches no option falls back to its first, and
saving the meal would then replace a supplier somebody typed with "none"
without anybody asking. It appears labelled as having no company note behind
it, so it does not read as a company that exists, and correcting it stays a
deliberate act.

**Diet, allergens and the line are dropdowns once the vault has said what the
options are.** `mealDietOptions`, `mealAllergenOptions` and `mealLineOptions`,
on the Folders page under Vault setup, hold those lists; the line's comes from
the chosen company instead when that company publishes any. Each ships empty and
the field stays a text box until something is in it, because a dropdown built
from nothing offers nothing, and what words a library uses for a diet or an
allergen is the vault's to state rather than the plugin's to guess.

**`mealSupplierRole` narrows which companies are offered as a supplier.** Leave
it empty and every Company note is; set it to a role, say `meals`, and only the
companies whose `roles:` carries it are, here and in the product-lines command.
A CRM holding every company a household has ever paid should not put the
landlord in a supplier dropdown. It stays empty by default because a company
with no roles is then not offered at all, so this is a setting to fill in once
the suppliers are marked rather than before.

**Nutrition has two shapes**, and the editor follows whichever the note
already uses:

- A note with a **per-100 g breakdown** is edited per 100 g, plus the serving
  weight in grams. The per-serving frontmatter figures are then **computed** on
  save from those two, along with the kilojoules and the two serving-size
  properties. A live line under the fields shows what one serving works out to
  as you type, so nothing has to be saved to be checked. **A breakdown with no
  serving weight derives nothing**: the five per-serving properties are written
  empty rather than as zeros, and the live line shows a dash, because there is
  no weight to multiply by and `calories: 0` would be a claim that a portion
  contains no energy.
- A note **without** one is edited per serving directly and nothing is
  derived. **Add per-100 g breakdown** converts it, seeding the label from
  what is already typed and the serving weight.

**The breakdown is frontmatter, and it is two lists.** Energy is two figures of
its own (`caloriesPer100g`, `kjPer100g`); everything else is a row in the
macronutrient or the micronutrient list, and a row is a name, a unit and a
value. Lists rather than a fixed set of boxes, because the eight boxes this form
used to have were a statement about a form rather than about food: a packet that
also declares fibre, or iron, had nowhere to put it and the note lost what its
owner had in front of them.

The name field is a text box with suggestions rather than a dropdown, and that
single choice is the whole requirement: a dropdown cannot express a nutrient the
plugin has never heard of, and such a nutrient has to survive the form or the
lists were pointless. What you type is matched against the known names in both
languages, so `Fett`, `of which sugars` and `saturatedFat` all land on the same
id, and a word nothing matches keeps its spelling exactly. The unit is filled in
for you only while the field is empty, because a unit already on a row is what a
packet said.

A new breakdown is seeded with the six EU macronutrients and one salt row: a
list you must build a row at a time before typing a number is a list nobody
fills in, and salt is the one micronutrient a label must declare. The other
twenty-eight micronutrients the plugin knows are not seeded, because that would
put twenty-eight blank vitamins and minerals into a note to save two clicks.

A note that still keeps its figures in the two body sections named by
`nutritionHeading` and `micronutrientHeading` is read from there, and saving it
writes the lists and removes both sections, so nothing carries the same label
twice. That is a per-note migration; the vault-wide one has not run. The old
sections labelled their salt figure `Sodium` and filed sugar and saturated fat
under "Micronutrient Information"; both are corrected on the way in, and **no
figure is converted**.

There are two pencils in the tab header, and they are different tools. The
square one opens this editor. The plain one hands over the raw Markdown, and
is also the **Open as Markdown** command.

A save rewrites exactly the spans it is named for. Every other section a note
carries, and its own formatting, survive untouched.

Favoriting writes straight back to the note's frontmatter, unlike the editor
above. There is no separate plugin database recording any of it, so
hand-editing the note is always equivalent.

## Reheating

A `Reheating` section with one sub-heading per appliance. A dish can state its
own wording, or supply only the numbers and let its supplier's wording carry
the rest:

````markdown
# Reheating

## Steamer
[temp:: 95 °C] [time:: 25 min]
````

with the supplier's boilerplate on the company note, once:

````markdown
# Reheating

## Steamer
Remove the clear plastic wrap. Use the reheat function at {temp} for about {time}.
````

which reads, for that dish: *Remove the clear plastic wrap. Use the reheat
function at 95 °C for about 25 min.*

Per appliance, the dish's own prose wins outright; its numbers fill the
supplier's tokens; and **a supplier instruction whose token nothing fills is
not offered at all**, because "heat for about `{time}`" reads as a bug and
cannot be acted on in a kitchen. The full table of cases is in
[Ready meals](../design/ready-meals.md).

The appliance list is a setting, and each entry has an id as well as a label:
the label is what a note's sub-heading is matched against, the id is what a
rename preserves. A sub-heading naming no known appliance still renders,
labelled as written, because text somebody typed is never hidden just because
the plugin lacks a word for it.

## Eating history

An eating-history record is a date, optionally with a clock time, a person, a
rating and a note. **The meal plan is where it lives.** An entry marked
`eaten: true` on a weekly plan note is a meal eaten: that is the whole
definition, and it is why the same log is visible to every view without any of
them having to copy it.

Two older stores are still **read** behind the plans, so a vault that has not
been migrated keeps working: the `eatingHistoryFrontmatterProperty` list, and
the section in the note body under `eatingHistoryHeading`. Entries from the
two sources are folded into one by the writer's `id`, and failing that by
agreeing on date and note.

The two are not treated the same on the way back out. **The frontmatter list
is never written**, and an existing one is left exactly as it is rather than
updated or deleted: removing a store from every meal in a vault is a
migration, done once with a backup and a verification pass, not something
recording a meal should do on the way past. **The body section is kept in
step**, because it is the half a reader actually sees in the raw note, so
every outing recorded rewrites it from the merged log, carrying across any
pictures already in it. Clearing `eatingHistoryHeading` in settings is what
switches that off.

### Recording a meal eaten

**Mark as eaten** in the meal header collects when, who ate it, a rating and a
note, and writes them onto the week's plan entry.

**A planned meal is marked rather than added to.** If the week already holds
this meal on that day and not eaten, that entry *is* the one being recorded,
and writing a second would turn one dinner into two. An entry already marked is left
alone and a new entry written beside it, because eating the same thing twice in
a day is a thing people do and this is not the place to decide it was a
mistake. An eaten entry with no rating is eaten and deliberately unrated, which
is a different statement from having no opinion, and which the checklist format
needed a magic `[rating:: 0]` to say at all.

`lastEaten` and `eatenCount` are still written onto the meal note, and they
are the one deliberate exception to deriving at read time. The gallery's sort,
its never-eaten filter and the dashboard all read frontmatter alone and never
a plan note, so an outing that did not update them would be invisible
everywhere except the view it was recorded from. Both are derived from the
plans on every write.

The body section, in a vault that still keeps one, is **merged, not
regenerated**. A line whose id is still in the records is rewritten in place, a
line whose id has gone is dropped, and a line with no id is left exactly where
it is, because a person wrote it. A photo lives only as an embed on the
entry's line, never in frontmatter: a bare filename in a property is invisible
to Obsidian's link engine, so it would lose rename tracking and show up as an
orphaned attachment the moment the file moved.

The reader is deliberately forgiving about the body form. It takes a list
line, a date at the front of it in either `2026-05-17` or `17.05.2026` form,
an optional `[rating:: 4]` inline field, and whatever else the line says as
the note. A log somebody keeps by hand is prose with a date in front of it,
and a parser that demanded a format would show an empty history for every one
of them.

Where a note carries an explicit `lastEaten:` or `eatenCount:`, that value
wins over the derived one. This is the general rule everywhere in CULItrail:
derive at read time, and where something must be written, write it from one
place only.

### Eating streak

The **Streak** badge counts how many ISO weeks in a row a meal has been eaten,
counting back from the current week.

Weeks rather than days: a meal eaten on two consecutive days is leftovers
rather than a habit, and a household's rotation turns over weekly. It is also
the period the meal plan is already keyed on, so a streak counts the same
thing a plan does, and it crosses a year boundary correctly for free, since
2025-12-29 and 2026-01-01 are the same ISO week.

Four rules decide what it says:

- **The current run, not the best one ever.** A record that only ever goes up
  would say nothing about whether the meal is still in the rotation, which is
  the question a badge next to "last eaten" is being asked.
- **Last week still counts as running.** A meal eaten every Sunday has a live
  streak on the following Tuesday, and a badge that reset every Monday morning
  until the next outing would be wrong for most of every week. Two clear weeks
  break it.
- **One week is not a streak**, so the badge shows nothing. Otherwise every
  meal eaten in the last fortnight would wear it, which would make it mean
  "eaten recently", and last-eaten says that better.
- **Both surfaces are handed the same log.** The gallery card and the meal view
  each pass the records they have already read, so a meal cannot show two
  different streaks in two places. That is why the badge takes a log rather
  than going and finding one.

The unit is translated at render rather than carried as the badge's `suffix`.
A suffix is persisted, so a built-in shipping with one would freeze "weeks"
into `data.json` in whatever language the vault was in on its first save: the
same hazard as a label, and the same answer.

## Where meals connect to the rest of CULItrail

- Every meal can be **added to the meal plan** for the active person and a
  chosen day and meal slot. See [Meal planning](meal-planning.md).
- Meals can be attached to an **order** placed with a company, per person. See
  [Orders, people & companies](orders-and-crm.md).
