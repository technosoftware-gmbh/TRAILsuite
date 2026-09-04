# Data model & note conventions

> **Status: built.** Describes the notes and settings CULItrail actually
> reads and writes.

## Notes are the source of truth

CULItrail's core data-modeling principle: *the meal note, the meal plan note
and the order note are Markdown, always the source of truth. Plugin state
mirrors them; never let state and note content drift without an explicit sync
path.*

Concretely, this means:

- Every view (meal, gallery, dashboard, meal plan, orders, invoice) is a
  **read-time projection**: it scans `app.vault` / `app.metadataCache` fresh
  each time it renders, computing eating streaks, reheating instructions and
  order sums on the fly rather than reading them back from a stored snapshot.
- Editing a note by hand (renaming a frontmatter field, changing a price,
  moving a file) is always safe, and there is no separate index to fall out
  of sync.
- Frontmatter is read defensively throughout: absent fields mean "unset",
  not an error; numeric-looking values are accepted whether Obsidian's
  property editor typed them as a Number or left them as a string;
  wikilink-shaped values (`"[[Target]]"`, `"[[Target|Alias]]"`) are parsed
  to their link target rather than compared as raw strings.

One caveat on "immediately reflected", worth knowing before you go looking
for a bug: the gallery is **manual-refresh only**. It holds no
`metadataCache` subscription, so it redraws on open, on an explicit Refresh,
and after a modal writes a note, but not when you hand-edit a note in another
tab. The data is never stale; the pixels can be.

### The datetime sharp edge

Obsidian's YAML parser turns an **unquoted** `2026-02-13T09:00` into a
native `Date`, and a `Date` rendered through a day formatter truncates to
`YYYY-MM-DD`. Any field where the clock time carries meaning must therefore
be read through a datetime-aware helper, and anything CULItrail writes with a
time in it is written **quoted**, so it arrives back as a string and
round-trips untouched. This caused real data loss in the code this was
inherited from before it was found.

## Where notes live: four folders plus CRM

```
Eating/                     eatingFolder
  Meals/                    mealsFolder
  Meal Plans/               mealPlansFolder, and the folder half of mealPlanPath
  Orders/                   ordersFolder
  Deliveries/               deliveriesFolder
CRM/                        crmFolder
  People/                   personsFolder
  Companies/                companiesFolder
```

`rootFolder` is an optional common parent above `Eating` and `CRM`,
defaulting to empty, meaning the vault root. Every sub-folder derives from
its root, so relocating `Eating` relocates the four folders under it; any
single sub-folder can also be repointed on its own if a vault organizes only
that one differently.

Meals have one extra wrinkle: `additionalMealFolders` is a list of further
folders to **scan**, for a vault whose meals are spread across more than one
place. The scan scope is `mealsFolder` plus that list; `mealsFolder` alone is
where new meals are written.

One note kind is addressed by a full path template rather than by a folder,
because its filename encodes which week and which person it belongs to:

| Setting | Default |
|---|---|
| `mealPlanPath` | `Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md` |

`{GGGG}` and `{WW}` are moment.js **ISO** week-year and week-number tokens,
deliberately not `{YYYY}`/`{ww}`, which are calendar-year based and disagree
with the ISO week near a year boundary. `{person}` is a second, non-moment
token substituted separately, before the date tokens resolve, and holds that
person's **full** note title with spaces removed.

Because this is a full path setting rather than a folder setting, a vault
that would rather keep its weekly meal plans beside its other weekly notes
points it somewhere else entirely and nothing breaks.

## Identification: folder and type together

**A note is identified by folder AND type together.** A note only counts as
a meal if it sits under the configured meal scan scope *and* carries the
configured type value; the same rule applies to orders, deliveries, plans,
people and companies. There is no folder-only fallback and no vault-wide search
for a type outside its folder.

Two guards make this safe when a setting is blank:

- A **blank folder** is skipped, not treated as the vault root. Otherwise
  clearing one field would claim every note in the vault.
- A **blank type value** matches nothing, not everything. Otherwise
  clearing one field would claim every note in that folder.

**Every type value is a setting, not a literal.** APERtrail draws this line
differently, with fixed literals for the travel types it invented and
settings for the two CRM ones. CULItrail has no folder it can claim was
always its own, so all six go through settings:

| Kind | Type-value setting | Default |
|---|---|---|
| Meal | `mealTypeValue` | `meal` |
| Order | `orderTypeValue` | `order` |
| Delivery | `deliveryTypeValue` | `delivery` |
| Meal plan | `mealPlanTypeValue` | `mealPlan` |
| Person | `personTypeValue` | `person` |
| Company | `companyTypeValue` | `company` |

A plan note is the one that is also addressed by a path template, and both
apply: the template says which file one particular week is, and the folder and
type say which files are plans at all, which is the question the eating history
asks. A note written before the type value existed is still read, by folder
alone, so no week goes quiet while a vault is converted.

The property those values live under is itself a setting,
`typePropertyName`, default `type`, shared by all six. Nine defaults come from
`trail-core`'s shared CRM contract rather than being spelled here --
`typePropertyName`, the two CRM folders, the two CRM type values, the two tag
properties and the two roles properties -- so APERtrail, CULItrail and NODAtrail
cannot drift apart on them without a test failing.

## Relationships are wikilinks, resolved by title

An order's `company:` and each selection's `person:` and `meals:` are real
`[[Wikilinks]]`, resolved at read time against the vault's own notes, never
IDs. This means Obsidian's own backlink and graph features work on this data
for free, and a broken reference is just an unresolved wikilink, visible and
fixable the normal Obsidian way.

**Wikilinks resolve by note title, never by path.** Two notes with the same
basename in different folders are indistinguishable to every resolver in the
codebase, and a link that matches nothing resolves to `null` rather than
raising: the referring card renders one fewer row. Deleting a Company that
orders still point at, or renaming a meal an order selected, degrades those
cards rather than breaking the view they sit in.

## Property names are settings; property values sometimes are not

Every frontmatter property name a feature reads or writes is a setting with
a sensible default, never a bare string literal in logic, so a vault with
pre-existing frontmatter naming conventions never has to rename its data to
fit CULItrail.

Those settings are **read-only on the settings page until `unlockPropertyNames`
is turned on**, which is a different claim from being fixed. They stay
configurable because two plugins share the CRM notes and have to agree on what
the type property is called, and because a vault that had meal notes before
CULItrail existed keeps its own spelling. But nothing migrates when one changes:
the plugin starts asking each note for a property none of them carries, and
every reader comes up empty without an error, because a property no note has is
not an error. The lock is what makes that a decision somebody made rather than
one they typed into while looking at something else, and
`tests/property-name-lock.test.ts` is what stops a newly added property setting
from arriving unlocked - it goes by the shape of the setting's name, so nobody
has to remember to add it to a list.

Property *values* are a different question. Some are fixed vocabularies
because the code keys off the exact strings:

- **Meal slots** (`breakfast`, `lunch`, `dinner`, `snack`) are a fixed set,
  written as a plan entry's `slot`. A note nobody has converted still carries
  the slot in one of three line notations, a `#tag`, a Dataview field or a
  trailing parenthetical, and all three are still read.
- **Weekdays** are a fixed set, always in English in the note, and meal-plan
  entries are keyed by weekday name rather than by date. This is deliberate,
  not a placeholder. See below.
- **Appliance ids** (`microwave`, `oven`, `steamer`, `skillet`) are the
  stable half of the reheating vocabulary; their labels are editable and
  translated. A sub-heading is matched against the label, then the id, then
  the shipped defaults in either language. See [Ready meals](ready-meals.md).
- **Ratings** are 1 to 5, and they live on a plan entry rather than on a meal.
  An entry with `eaten: true` and no rating is eaten and deliberately unrated,
  which is what a checklist line had to write `[rating:: 0]` for. A meal note
  carries no rating at all: how good a dish is on average is a worse question
  than how it was the time you ate it.

## Week identity

Meal-plan data is scoped by an **ISO week title** (for example `"2026-W32"`),
not a calendar date range. This is what lets the meal-plan view browse
backward and forward through weeks, and what lets the weekday-keyed entry
model still belong unambiguously to one specific week.

**Entries are keyed by weekday, not dated.** A Tuesday entry is a Tuesday
entry; it does not carry `2026-08-11`. This is an intentional design
decision, not an oversight, and should not be "fixed" into real dates
without a deliberate design conversation first. The week the entry belongs
to comes from the note it lives in and from its `week` field, not from a
date on the entry.

## Derived fields

Some values are computed at read time and never written back:

- A meal's **total time**, when `totalTime` is absent, from prep plus reheat.
  The built-in Total badge carries the formula
  `(prepTime || 0) + (reheatTime || 0) || null`.
- A meal's **reheating instructions**, merged per appliance from what the note
  says and what its supplier publishes. There is deliberately no property
  recording the result: a note that grows a `## Steamer` sub-heading becomes
  reheatable by having one. See [Ready meals](ready-meals.md).
- A meal's **supplier**, from the company on the most recent order naming the
  dish, unless the note states one explicitly.
- An order's **per-person meal count**, from its selections.
- An order's **total from its lines**, when at least one line carries a price: the
  lines summed, minus the order's discount, plus its shipping. It is what the
  invoice prints, and it is **never written back**, so the note keeps saying what
  somebody typed. It used to be shown beside the stated total rather than instead
  of it, so a reader could see the two disagree; that stopped being worth a second
  row once the editor computed the total it wrote, because the two can no longer
  disagree except in a note somebody hand-edited. Null rather than zero when no
  line is priced, which is every order written before line prices existed, and an
  order in that state falls back to the stated figure.

The rule is: derive at read time, never write back. Writing would mean
editing one note as a side effect of editing another, and the derived value
would go stale the moment its source changed. Where a note carries an
explicit value, that value always wins over the derived one.

**There are two exceptions, and both are deliberate.** A meal's `lastEaten`
and `eatenCount` are written onto the meal note whenever an outing is
recorded, because the gallery's sort, its never-eaten filter and the dashboard
read frontmatter alone and never a plan note. An outing that did not update
them would be invisible everywhere except the view it was recorded from. Both
are computed from the plans on every such write, so there is still only one
place the answer comes from.

The second is the **per-serving nutrition of a meal that states a per-100 g
breakdown**. `calories`, `kj`, `protein`, `fat` and `carbs` are recomputed from
the breakdown and the serving weight on every save of that meal, along with
`serving_size`, which is what keeps the two bases from disagreeing after an edit
to either. `default_serving_size` was written beside it from the same weight and
read by nothing; it is gone, and
`scripts/strip-default-serving-size.ts` takes it off notes that still carry it.
It is a write-back within one note
rather than across two, and its source is in the same frontmatter, so it cannot
go stale behind the reader's back. **A breakdown with no serving weight derives
nothing**: all five are written empty rather than as zeros, because there is no
weight to multiply by and `calories: 0` would be a claim that a portion contains
no energy.

## What a note actually looks like

### A meal

```markdown
---
type: meal
title: Penne alla Norma
image: _resources/penne-alla-norma.png
servings: 2
prepTime: 5
reheatTime: 25
supplier: "[[TomTasty AG]]"
line: Alltag
price: 19.9
priceCurrency: CHF
diet:
  - vegetarian
allergens:
  - gluten
caloriesPer100g: 160
kjPer100g: 669
macronutrients:
  - { name: fat, unit: g, value: 5.5 }
  - { name: saturatedFat, unit: g, value: 1.8 }
  - { name: carbs, unit: g, value: 21 }
  - { name: sugar, unit: g, value: 3.1 }
  - { name: protein, unit: g, value: 4.8 }
micronutrients:
  - { name: salt, unit: g, value: 0.6 }
calories: 640
kj: 2676
protein: 19.2
fat: 22
carbs: 84
serving_size: 400g
favorite: true
lastEaten: 2026-07-28
eatenCount: 6
created: "2026-01-04T18:12"
modified: "2026-07-28T19:40"
---

Aubergine, tomato and ricotta salata, as the Sicilians do it.

## Reheating

### Steamer
[temp:: 95 °C] [time:: 25 min]

## Notes

Order two if anybody is hungry. The tray is smaller than it looks.
```

`supplier:`, `line:` and `priceCurrency:` are what a meal says about where it
comes from. A **line** is the range the company sells this dish under, such as
Alltag, Sport or Weightloss: the same dish under two lines is two notes,
because the nutrition differs and a single note could only state one set of
figures. The currency is stated here only when it differs from the supplier's
own; the price shown falls back to the Company's currency and then to
`orderDefaultCurrency`, so an ordinary meal note carries neither.

**A meal states its nutrition on two bases, and neither says what the other
does.** `calories`, `kj`, `protein`, `fat` and `carbs` are one portion as sold.
`caloriesPer100g`, `kjPer100g` and the two nutrient lists are what the packet
declares about 100 g of it. A note can carry both, and where it does, the five
per-serving figures are computed on save from the breakdown and the serving
weight rather than typed.

The breakdown is **frontmatter, not a body section**. Two lists rather than a
fixed set of properties, because a packet that declares fibre, or iron, or
nothing but salt has to have somewhere to put what it says, and because a
property is what Obsidian's own editor, a Dataview query and any other reader
can see at all. One entry names the nutrient, the unit it is stated in and the
figure, under the sub-keys `nutrientNameField` / `nutrientUnitField` /
`nutrientValueField` (`name` / `unit` / `value`).

**The name is a language-free id**, which is what lets the plugin show a
translated label for it: a vault that switched language would otherwise be
reading English words frozen into every note. The known ids are in
`packages/core/src/meal/nutrients.ts` and the macronutrient order is Regulation
(EU) 1169/2011's; a name no table knows is kept and shown exactly as written.
The unit is stored per entry rather than derived from the name, because a label
states it and iron is usually mg and occasionally µg. An entry naming a nutrient
with no figure is its own statement: this dish contains it and nobody has
measured it, which is a different note from one that never mentioned it.

`salt` and `sodium` are two separate ids and neither is an alias of the other.
Nothing converts between them.

The free text before the first heading is the description. The section
headings are settings: `reheatingHeading` and `notesHeading`, both with
translated defaults, so a German vault's notes say `## Aufwärmen` and nothing
has to be renamed. `nutritionHeading` and `micronutrientHeading` name the two
body sections the breakdown used to live in and are **read-only legacy**:
nothing writes them any more, and their defaults are plain English literals in
both locales rather than translated, because they name the exact words the
notes written before the move already use. See
[Settings reference](settings-reference.md#section-headings).

**Everything the plugin does not claim is offered back as a titled section.**
CULItrail does not know what a `## Source` or a `## Variations` section is and
deliberately does not try, so a note is never punished for holding something
the plugin has no feature for. A note that still carries an ingredients list
from an older vault is one of those sections now.

Two structural traps are worth knowing, both found in a real vault rather than
in a fixture:

- **A fenced code block inside the reheating section is dropped**, not read as
  an instruction. A company note carries a `culi-related-orders` fence after
  the reheating section, and with nothing following it every line of that fence
  landed inside the last appliance's instruction.
- **A heading naming another section this plugin renders ends the reheating
  section**, whatever its level. A `## Eating History` written under a
  `# Reheating` is a log, not a way to warm up a tray.

### A meal plan note

```markdown
---
type: mealPlan
week: 2026-W34
person: "[[Stefan Muster]]"
entries:
  - meal: "[[Beluga Lentil Curry with Potatoes]]"
    day: tuesday
    slot: lunch
    id: mp-2026-W34-StefanMuster-1
  - meal: "[[Chicken Piccata with Fregola Sarda]]"
    day: wednesday
    slot: lunch
    eaten: true
    rating: 4
    time: "19:20"
    id: mp-2026-W34-StefanMuster-2
  - meal: Leftovers
    day: thursday
    slot: dinner
    id: mp-2026-W34-StefanMuster-3
created: "2026-08-17T09:12"
---
```

One note per person per ISO week, and the path template rather than a folder
setting decides which file that is. A non-meal entry (leftovers, eating out)
carries plain text under `meal:` instead of a wikilink, and which of the two it
is comes from whether the value is a link.

**`eaten: true` is what makes these notes the eating history**, and everything
that belongs to a helping travels with it: the rating, the clock time and a
`note`. **This is the only rating in the vault.** A meal note used to carry one
of its own, and it was removed: "how good is this dish" is a worse question
than "how was this one", and a dish is not the same twice.

Every entry carries an `id`, which is what an edit finds it by. An entry
somebody typed into the list by hand has none; the first edit to it finds it by
its meal, day and slot and gives it one.

The week and the person are also in the filename. **The property wins**, the
same way an order's date property wins over its filename, because the name is
fixed once written and a person correcting either edits the property.

Anything below the frontmatter is left alone by every writer, so a shopping
reminder or a paragraph in the body survives whatever the plugin does to the
plan.

**This replaced a Markdown checklist** of `## Tuesday` headings and
`- [x] [[Meal]] #meal/lunch [rating:: 4]` lines. That shape is still read, so a
vault mid-conversion loses no week, and nothing writes it. A note is converted
the first time anything writes to it, and `scripts/convert-plan-notes.ts`
converts a whole vault in one pass.

### An order

```markdown
---
type: order
company: "[[TomTasty AG]]"
orderDate: 2026-02-13
deliveryDate: 2026-02-18
price: 128.2
priceCurrency: CHF
discount: 12.8
shipping: 0
vatRate: 2.6
selections:
  - person: "[[Erika Muster]]"
    meals:
      - "[[Chicken Saltimbocca with Caponata]]"
      - "[[Risotto alla Puttanesca]]"
  - person: "[[Stefan Muster]]"
    meals:
      - "[[Penne alla Norma]]"
      - "[[Coconut Pumpkin Soup]]"
created: "2026-02-13T10:37"
modified: "2026-02-18T13:35"
---
```

The filename is `yyyy-mm-dd-ordernumber.md`, for example
`2026-02-13-23624.md`. **The order number lives only in the filename**, never
in frontmatter, which is worth knowing before looking for a property that
holds it.

Once any line carries a price, a quantity or a discount, the bare `meals:`
list is written as an `items:` list instead, one entry per dish with `meal:`,
`price:`, `quantity:` and `discount:`. An order with none of them stays in the
simpler shape, so saving an untouched order rewrites nothing.

**Every price in an order is gross.** That is what a meal company's invoice
says, and it is what these notes have always meant. `vatRate:` and
`vatAmount:` are what a note may *additionally* claim about how much of that
gross was tax; the invoice shows it as an included line and nothing is
computed from it. An order stating neither means exactly what it always did.

`discount:`, `shipping:` and `priceCurrency:` are pre-filled from the
company's terms when the order is written, and are plain numbers from then on.
A company that raises its shipping next year does not change what an order
from today says, for the same reason a line's price is recorded rather than
looked up.

### A delivery

```markdown
---
type: delivery
deliveryDate: 2026-02-18
orders:
  - "[[2026-02-13-23624]]"
items:
  - meal: "[[Penne alla Norma]]"
    quantity: 2
  - meal: "[[Coconut Pumpkin Soup]]"
created: "2026-02-18T13:35"
---
```

The filename is the date, `2026-02-18.md`, with a numeric suffix when two
boxes arrive on one day. Unlike an order, **a delivery is never renamed** when
its date is corrected: the property wins on read, so the corrected date is
already the one that counts, and renaming would break links somebody has made
to the note.

**A delivery is a kind of its own rather than a field on an order**, and the
reason is the two cases that will not fit inside one: an order can arrive in
two boxes a week apart, and one box can settle two orders. `orders:` is
therefore a list. It may also be empty, which is legitimate: the freezer knows
what is in it whether or not the paperwork was filed.

A quantity of 1 is omitted, the way an order line omits it, and a bare
wikilink is accepted in place of a mapping, because a box of six different
dishes is quicker to type as a plain list.

The distinction this buys is the one the meal plan needs. An order says what
was asked for; a delivery says what is in the freezer now, which is why the
meal picker offers the last delivery's dishes first.

### A person

```markdown
---
type: person
title: Stefan
description:
tags:
  - Family
address: Musterweg 1, 8000 Zürich, Switzerland
mobile: "+41 79 000 00 01"
email: stefan@example.com
created: "2026-08-09T09:00"
modified: "2026-08-09T09:00"
---

```culi-related-orders
```
```

## People and companies

CULItrail **reads** Person and Company notes and creates neither. There is no
contact registry: a note counts as a Person because it sits under
`personsFolder` and carries `personTypeValue`, on exactly the terms every
other note kind is judged by.

An optional tag filter (`eligiblePersonTags`, read from `personTagProperty`)
narrows which Person notes are offered as a meal-plan person or an order
recipient. This is useful when a Person-typed note exists for reference only
and should not show up as a selectable household member. **An empty tag
filter means "everyone", never "nobody"**, so enabling the feature never
silently hides every person until it is configured.

A Company note carries two things CULItrail reads that a Person note does not.
The first is the supplier's reheating boilerplate, under the same heading a
meal uses, with `{temp}` and `{time}` tokens filled from the dish. The second
is its commercial terms:

```markdown
---
type: company
title: TomTasty AG
currency: CHF
paymentMethod: Invoice
invoiceTiming: With the delivery
shippingFee: 9.9
freeShippingFrom: 12
discountTable:
  - from: 12
    percent: 5
  - from: 24
    percent: 10
lines:
  - Alltag
  - Sport
  - Weightloss
---
```

`discountTable:` is a ladder counted **in meals**, not in money: the highest
rung at or below the number of portions ordered is the one that applies, and
`12: 10` on one line is accepted as a shorthand for the two-key form.
`freeShippingFrom:` is counted the same way. Both are read when an order is
written and never afterwards.

**CULItrail reads all of this and writes none of it**, which is its half of
the shared-CRM contract. These seven properties are deliberately *not* part of
the contract in `trail-core`: APERtrail has no reader for them yet, and a
shared contract with one implementer is a coincidence rather than an
agreement. They join it on the day a second plugin needs them.

### The shared-CRM contract

Where APERtrail is also installed, both plugins read the same two folders,
by default, in both locales, with the same type values and the same tag
properties. Nothing in either plugin depends on the other at runtime: they
agree through the vault, not through code. The full contract, including what
it deliberately does *not* mean, is in [Shared CRM](shared-crm.md).

The practical consequence for a note: a Person note in a vault with both
plugins carries two blocks, `travel-related-trips` and `culi-related-orders`,
each answering its own plugin's question about that person. An unrendered
fence when a plugin is absent is visible and harmless.

CULItrail reads only the fields it displays. The `private:` and `work:` phone
properties that appear on person notes in practice are deliberately left
unread, the same call APERtrail made: `mobile` is the one that gets filled,
and two more settings to read two fields nothing displays is not a trade
worth making.

## What is stored outside notes

A small amount of state genuinely cannot live in a note because it is either
cross-cutting or purely transient, and lives in `data.json` under
`settings.state`:

| Field | What it holds | Why it is not in a note |
|---|---|---|
| `state.mealPlan` | Every configured person's meal-plan entries, for every week, as structured objects | The authoritative copy is the per-person weekly note; this is a rebuild-on-demand mirror for fast in-memory access between syncs |
| `state.mealPlanActivePerson` | Whose plan the meal-plan view and dashboard currently show | View state, not configuration |
| `state.mealPlanViewedWeek` | Which ISO week the meal-plan view is browsing. Empty means the current week, resolved at render | View state. Storing a real week title would mean reopening the vault in January still showing a week from December |

One `MealPlanEntry` holds its `id`, the `mealPath` it points at (empty for a
free-text entry, which carries a `label` instead), the weekday and slot keys,
the person and the week, an optional rating, whether it is leftovers, and
whether it has been `eaten`. That last field is **absent rather than false**
when nothing has said: an entry written before the field existed has no
opinion about its checkbox, and a writer that read the absence as "not eaten"
would un-tick a line for no better reason than the age of the state file.

Every other field in `data.json` is genuinely configuration: folder paths,
type values, property-name overrides, feature toggles, the appliance list, the
badge definitions and the two view toolbars' saved state.

Because `state.mealPlan` is a mirror rather than a source, it can drift from
the notes it mirrors. The **resync** command is the explicit path back: it
reconciles the currently viewed week from its notes. The failure mode seen in
practice is a stale entry the notes no longer justify, for instance an entry
left behind for a person who has since been removed.

## Legacy schema handling

Three places intentionally still *read* an older shape while only ever *writing*
the current one, so pre-existing vault data keeps working without a disruptive
one-time migration:

**The two per-100 g body sections.** A meal written before the breakdown moved
into frontmatter keeps its figures under `# Nutritional Information (Per 100g)`
and `# Micronutrient Information (Per 100g)`, as `- **Fat (g):** 7.1g` lines.
Every meal in the vault this was built against is still in that state, and the
migration has not run. The reader therefore falls back to those two sections
whenever the frontmatter states nothing, and the meal view shows such a note's
breakdown exactly as it shows a converted one. The fallback is **whole-model,
not field by field**: a note states its figures in one place or the other, and
merging would let a stale section overwrite a figure somebody had already
corrected in frontmatter, which is precisely the state a half-migrated vault is
in. Saving such a meal in the editor converts it, writing the two lists and
removing both sections, so nothing carries the same label twice.

Two corrections happen on the way through that fallback, and neither touches a
number. **`Sodium` was never sodium.** The old renderer wrote a salt figure
under that label, and the vault's values, 0.5 to 1.3 g per 100 g, are salt
figures: read as sodium they would be about two and a half times the truth. The
legacy reader maps that label to `salt`, and that correction lives only there,
where the mislabelling is known to be one; anywhere else the word means sodium.
And **sugar and saturated fat were filed under "Micronutrient Information"**,
which they are not: they are sub-components of the carbohydrate and the fat, and
they read back into the macronutrient list where a label prints them.

**The plan checklist.** A note holding `## Tuesday` headings and
`- [x] [[Meal]] #meal/lunch [rating:: 5]` lines is read entry for entry, and
converted the first time anything writes to it. `[rating:: 0]`, which 32 lines
in the vault this was built against carry, reads as eaten with no rating: the
`eaten` field makes the magic value unnecessary rather than merely tolerated. A
bullet under a heading the plan format did not invent, such as a `## Shopping`
section somebody added, is **not** an entry, which the line parser could not
tell on its own and the section it sits under can.

**Order selections.** A v1 flat per-person property
(`selectionStefan:`, built from `orderSelectionPropertyPrefix`) is still
read, but every save upgrades the note to the current list-based
`selections:` schema. The v1 scheme keys by first name only and is therefore
collision-prone, which is exactly why it was replaced. New notes are always
written in the current form; the old one is documented here only because it
can still show up when reading pre-existing orders.

Meal-plan entries persisted before per-week navigation existed carry no
`week` value. They are treated as belonging to "this week" only when the week
actually being viewed *is* the current week, so old data does not silently
reappear under the wrong week once you navigate away from now.
