# Settings reference

> **Status: built.** Every field on this list has a control on the settings
> page, including the list settings, which have editors rather than rows.
> `tests/settings-coverage.test.ts` enforces that; its only three exemptions
> are `state`, `gallerySavedState` and `ordersSavedState`, which are state
> rather than configuration.

CULItrail has one settings page (**Settings -> CULItrail**), and it is one
scrolling page rather than a tab strip. Tabs put every group at the same
distance from the eye, which is only fair when the groups are equally
important, and these are not: eleven folders and eighty-three frontmatter
names are set once when a vault is adopted and then left alone for years,
while a dozen switches are the only rows anybody comes back for. Six tabs also
meant six places to look for the row you half remember, and the property rows
were spread across four of them.

So the switches are the page, and the long lists are one row away:

```
Plugin block     version and release notes, support, help and contact
Vault setup      Folders >          11 folders
                 Property keys >    83 keys, locked
                 what each setting currently matches, counted
Meal view        headings, reheating, rendering, tags, nutrition, allergens
                 Header badges >    Reheat appliances >
Planning         eating history
Orders           default currency, legacy prefix, eligible people
Browsing         dashboard, ribbon icons, what opens itself
About            credits, licence, version
```

`src/settings/view/settings-page.ts` owns the drill-down (which sub-page is
open, the back header, the repaint) and nothing else;
`src/settings/view/settings-tab.ts` says what is on each page,
`sections/` holds the root page's sections and `pages/` the two long ones.
Which sub-page is open is deliberately not persisted, and is reset when the
page closes: it is where somebody is looking right now, not a preference.

This document lists every field in `CULItrailSettings`
(`src/settings/types.ts`), grouped the way the page groups it, with the
English defaults from `src/settings/defaults.ts`.

Folder defaults shown are the **English** locale values. A German-locale
install seeds the German ones instead. Every default marked *localized* is
resolved through `getLocalizedDefaults()` at first load, not baked in.

Settings keys carry **no prefix**. Which area a setting belongs to is
expressed by where it appears, not by its name.

**Every name a note is read by is on one page.** The property-keys sub-page
holds all eighty-three of them, grouped by the note that carries them, with a
filter box and the unlock switch at the top. The group headings there are the
ones the tabs used, so the tables below still describe blocks you can find:
where a table says a property name, look on that page.

---

## Vault setup

### Folders

Every folder below derives from a root, so moving a root moves everything
under it. Any single sub-folder can still be repointed on its own.

| Setting | Default | What it does |
|---|---|---|
| `rootFolder` | `` (empty) | Optional common parent above `Eating` and `CRM`. Empty means the vault root, which is the shape the sample vault uses |
| `eatingFolder` | `Eating` *(localized: `Essen`)* | The CULItrail module root. Everything about eating derives from it |
| `mealsFolder` | `Eating/Meals` *(`Essen/Mahlzeiten`)* | Where meals live, and where new ones are written |
| `additionalMealFolders` | `[]` | Further folders to include in the meal scan scope, for a vault whose meals are spread out. Never written into |
| `mealPlansFolder` | `Eating/Meal Plans` *(`Essen/Essenspläne`)* | The folder half of `mealPlanPath`'s default, and the folder a note is identified as a plan in |
| `ordersFolder` | `Eating/Orders` *(`Essen/Bestellungen`)* | Where order notes live |

All eleven folder rows, including the three CRM folders (`crmFolder`,
`personsFolder`, `companiesFolder`) and `deliveriesFolder`, are on the
**Folders** sub-page, grouped as library, orders and deliveries, contacts, the
vocabularies below, and the one note path.

### Vocabularies

The three meal fields that have a vocabulary rather than free text, and the
switch that narrows the supplier dropdown. They sit beside the folders because
they answer the same kind of question: what this vault already calls things.

| Setting | Default | What it does |
|---|---|---|
| `mealDietOptions` | `[]` | What the meal editor offers for `diet`. **Offered, never enforced**: the editor unions these with what the vault already uses, so configuring the setting late cannot make an existing value unselectable, and empty means "offer whatever the notes already say" |
| `mealAllergenOptions` | `[]` | The same for `allergens` |
| `mealLineOptions` | `[]` | The same for `line`, with a third source ahead of both: a supplier that publishes its ranges on its Company note contributes those too, and they win the top of the list because they are the answer for a meal from that supplier |
| `mealSupplierRole` | `` (empty) | The company role a supplier must carry to be offered on a meal. **Empty offers every company**, which is the list this vault has always seen. Narrowing before the companies are classified would hide the ones that are right, so filling this in is the deliberate act that says "I have marked my suppliers": set it to `meals` once the companies carry `roles: [meals]`, and a company with no roles is then not offered |

An option list that omits what a note already says is not a cosmetic problem. A
`<select>` whose value matches no option falls back to its first, so the next
save would replace a value nobody touched, which is why the union exists and why
`tests/meal-vocabulary.test.ts` pins it.

### Note paths

A full path template rather than a folder setting, because the filename
encodes which week and which person the note belongs to.

| Setting | Default | What it does |
|---|---|---|
| `mealPlanPath` | `Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md` | One note per person per ISO week. `{GGGG}`/`{WW}` are ISO week-year and week-number tokens; `{person}` is that person's **full** note title with spaces removed, because an earlier scheme used the first name only and two people sharing one wrote into the same file |

The template says which file *one* week is. Which files are plans **at all** is
the ordinary folder-and-type question, answered by `mealPlansFolder` and
`mealPlanTypeValue`, and that is the one the eating history asks.

`{GGGG}`/`{WW}` are used rather than `{YYYY}`/`{ww}` on purpose: the latter
are calendar-year based and disagree with the ISO week near a year boundary.

### Identification

| Setting | Default | What it does |
|---|---|---|
| `typePropertyName` | `type` | The frontmatter property every kind of note is identified by |
| `mealTypeValue` | `meal` | A note in the meal scan scope counts as a meal only if its type property holds this. Blank matches nothing |
| `unlockPropertyNames` | `false` | Whether the page will let a property name, a field name or a type value be typed into. Its row is the first thing on the **Property keys** sub-page, which is where every row it governs now lives, and it appears nowhere else. The row that opens that page says which state it is in, because that is the one thing about the page worth knowing before opening it: it is why a field there refuses to be typed into |

**Every property name, field name and type value on this page is read-only
until that switch is on.** They remain settings, because two plugins share
the CRM notes and have to agree on what the type property is called, and
because an existing vault's spelling wins over ours. But changing one migrates
nothing: the plugin starts asking each note for a property none of them
carries, so the gallery empties and the filters offer nothing, with no error
anywhere, because a property no note has is not an error. Turn it on to match
names a vault already uses, then turn it off again. Folder settings are not
covered, because repointing a folder is reversible in a way renaming a property
is not.

### Note header

| Setting | Default | What it does |
|---|---|---|
| `createdProperty` | `created` | Stamped once, when CULItrail creates the note. Never added to a note that arrived without one |
| `modifiedProperty` | `modified` | Rewritten on every change CULItrail makes to a note that already existed |

Both hold `YYYY-MM-DDTHH:mm` in local time, and a blank name writes that
stamp nowhere rather than falling back to a literal. The names are spelled the
same as APERtrail's, which writes into the same shared CRM notes.

### Browsing

| Setting | Default | What it does |
|---|---|---|
| `enableDashboard` | `true` | Shows the dashboard, and folds the individual ribbon icons into one dashboard icon |
| `showRibbonIcons` | `true` | Master toggle for every CULItrail ribbon icon |
| `dashboardActivityRangeWeeks` | `8` | What "recently" means for the dashboard's eaten-recently count, and the activity chart's range: 1, 2, 4, 8 or 12 weeks |
| `openGalleryOnFolderClick` | `false` | Clicking a meal folder in the file explorer (or Notebook Navigator) opens the gallery filtered to it |
| `openGalleryOnFolderClickSubfolders` | `false` | Whether that filter includes subfolders. Only shown when the row above is on |
| `autoOpenMealView` | `true` | Opening a meal note shows the structured view instead of Markdown |
| `gallerySavedState` | see below | The gallery's whole filter and sort state, persisted as one unit. Its editor is the gallery's own toolbar, so it has no row here |
| `ordersSavedState` | see below | The same arrangement for the orders view, whose toolbar is likewise its editor |

`gallerySavedState` holds `sortField` (`title`), `sortDirection` (`asc`),
`folder` (`null`), `favoriteOnly` (`false`), `tag` (`null`), `diet` (`null`),
`neverEaten` (`false`), `excludeAllergens` (`false`) and `search` (`''`). These
always travel together, so they are one persisted object rather than nine
top-level keys.

`ordersSavedState` holds `sortField` (`order-date`), `sortDirection` (`desc`),
`company` (`null`), `year` (`null`), `withoutDelivery` (`false`) and `search`
(`''`). Newest-first is the opening order because an order list is read for
what was bought recently far more often than for what was bought first.

**All four auto-open switches are one block here**, not one beside each kind:
`autoOpenMealView` above, and `autoOpenMealPlanView`, `autoOpenOrderView` and
`autoOpenDeliveryView`, which this document describes under the kinds they are
about because that is what a reader is looking for them by. "What opens itself"
is one decision made in one place, whichever note it is about.

The Vault setup section ends with a read-only **status block** saying which
folder is in scope, which type value it is looking for, and how many meals
currently match. It is diagnostic, not configuration.

---

## Meal view

### Section headings

Read from the note body, so these must match what the notes actually say.

| Setting | Default (English) | Default (German) |
|---|---|---|
| `notesHeading` | `Notes` | `Notizen` |
| `reheatingHeading` | `Reheating` | `Aufwärmen` |

Both resolve through `getLocalizedDefaults()`, so a fresh install in a German
vault looks for the German headings rather than for English ones the notes do
not say. That is required rather than a nicety: once a default is persisted into
`data.json` the plugin cannot tell an untouched default from a value somebody
deliberately typed in English, so there is no safe repair afterwards.

### Read, never written

The exact mirror image of "Written, never read back" below, and the page labels
it that way for the same reason: a row that does only half the job should say
which half on the page rather than only in a comment.

| Setting | Default (English) | Default (German) |
|---|---|---|
| `nutritionHeading` | `Nutritional Information (Per 100g)` | the same |
| `micronutrientHeading` | `Micronutrient Information (Per 100g)` | the same |

These two name the body sections a meal's per-100 g figures used to live in.
**The breakdown is frontmatter now** (see the two groups further down this page),
the editor emits neither section and takes both out of any meal it saves that
states one, so nothing writes these headings any more. They stay because a vault
is full of meals written before that move and the vault migration has not run:
the heading is the only thing that can find the figures in one of those, and a
section a note does not have is not an error, so dropping the settings would
empty those meals silently rather than loudly.

They are also the deliberate exception to the localization rule above, and they
are plain English literals in both locales. They name a section format that the
notes already in these vaults write in those exact words, so a German default
would leave the reader unable to find the table in the notes that already exist.
The reader matches case-insensitively, and the setting is there for a vault that
names them differently on purpose.

### Reheating

A dish bought ready-made carries reheating instructions per appliance. See
[Ready meals](ready-meals.md) for the whole model.

| Setting | Default | What it does |
|---|---|---|
| `reheatTempField` | `temp` | The inline field a dish uses for temperature: `[temp:: 95 °C]` |
| `reheatTimeField` | `time` | The inline field for duration: `[time:: 25 min]` |
| `reheatAppliances` | Microwave, Oven, Steamer, Skillet | A list of `{ id, label }`. The label is matched against a note's sub-heading; the **id is what a rename preserves**, so correcting a label never orphans a note. The shipped four are matched in both languages as aliases whatever the locale |

Both inline fields exist so a dish can supply only the numbers and let its
supplier's wording carry the rest, filling `{temp}` and `{time}` in it. A supplier
instruction whose token nothing fills is **not shown at all**: "heat for about
`{time}`" reads as a bug and cannot be acted on in a kitchen.

### Rendering

| Setting | Default | What it does |
|---|---|---|
| `cleanNoteBody` | `true` | Strips the parsed content out of the rendered body so it is not shown twice |
| `useFirstBodyImageWhenFrontmatterEmpty` | `true` | Falls back to the note's first body image when `imageProperty` is unset |
| `defaultMealImage` | `` (empty) | Shown when a meal has no image at all, and when a stated one does not resolve |

### Header badges and tags

| Setting | Default | What it does |
|---|---|---|
| `headerBadges` | six built-ins | Diet, Prep, Reheat, Total (a formula badge), Last eaten and Streak (a derived badge, shipped disabled). Built-ins can be edited but not deleted; any number of custom badges can be added |
| `showTagsInHeader` | `true` | |
| `prefixTagsWithHash` | `true` | Only shown when the row above is on |
| `showFullTagPath` | `false` | Shows `food/italian` rather than just `italian`. Only shown when tags are in the header |

A badge is `{type, property, label, icon, color, valueColors?, valueType,
splitArray, enabled, prefix?, suffix?, hideLabel?, display?, formula?,
derived?, builtin}`. `type` is `badge`, `separator` or `newline`, so the row's
layout is part of the same list rather than a second setting.

### Nutrition display

| Setting | Default | What it does |
|---|---|---|
| `nutritionSource` | `per-serving` | Whether the stored numbers mean one serving or the whole meal |
| `nutritionDisplay` | `per-serving` | `per-serving` or `total` |

### Allergens

| Setting | Default | What it does |
|---|---|---|
| `myAllergens` | `[]` | The reader's own allergens. Drives the banner above a meal and the gallery's allergen-exclusion filter, matched as substrings against what the meal declares |

### Frontmatter property names

Every one of these names what CULItrail reads or writes on a meal note. A
vault whose notes already use different names points these at them rather
than renaming anything on disk.

| Setting | Default | Setting | Default |
|---|---|---|---|
| `imageProperty` | `image` | `servingsProperty` | `servings` |
| `favoriteProperty` | `favorite` | `dietProperty` | `diet` |
| `prepTimeProperty` | `prepTime` | `reheatTimeProperty` | `reheatTime` |
| `totalTimeProperty` | `totalTime` | `allergensProperty` | `allergens` |
| `caloriesProperty` | `calories` | `proteinProperty` | `protein` |
| `fatProperty` | `fat` | `carbsProperty` | `carbs` |
| `priceProperty` | `price` | `mealLineProperty` | `line` |
| `mealPriceCurrencyProperty` | `priceCurrency` | `servingSizeProperty` | `serving_size` |

`priceProperty` is what one portion of a dish costs to buy ready-made. `cost`
is accepted as an alias.

Its currency is read from `mealPriceCurrencyProperty` when the note states one,
then from the supplier Company's own currency, and only then from
`orderDefaultCurrency`. **The property exists for the exception, not the
rule**: a household ordering in one currency should never have to type it on a
single meal note, and the one dish bought from a German supplier should not be
shown in the wrong one.

`mealLineProperty` holds the range the company sells this dish under, such as
Alltag, Sport or Weightloss. The same dish in two lines is two notes: the
nutrition differs between them, and one note could only state one set of
figures. The Company note lists the lines it offers, which is where the field's
suggestions come from.

`servingSizeProperty` holds what one portion weighs, written as `440g`. It has
one reader and it is the meal editor's: `readMealDraft` takes the serving weight
back off it when the form reopens, which is what leaves the per-serving
arithmetic a divisor on the second edit rather than only on the first. That one
reader is why the row is here and not in "Written but never read" below, where
the page used to show it. Unlike the rest of this group it has no alias list: the
only writer is `write-draft.ts`, which resolves exactly one name, so an alias
could only ever find a figure the editor will orphan on the next save.

### Per-100 g nutrition

What the packet declares about 100 g of the dish, held as frontmatter rather
than as a section in the note body. A group of its own rather than four more
rows above, because the ones above are per serving and these are per 100 g, and
a Calories row directly followed by a Calories per 100 g row with nothing
between them is how the two get confused in the first place. A meal can carry
both bases, and neither says what the other does.

| Setting | Default | What it does |
|---|---|---|
| `caloriesPer100gProperty` | `caloriesPer100g` | The per-100 g energy figure, which is not `caloriesProperty`. A note carrying `calories: 380` and `caloriesPer100g: 190` states two different true things |
| `kjPer100gProperty` | `kjPer100g` | The same in kilojoules, and distinct from the per-serving `kjProperty` for the same reason |
| `macronutrientsProperty` | `macronutrients` | The macronutrient list: fat, saturated fat, carbohydrates, sugar, fibre, protein, in Regulation (EU) 1169/2011's order |
| `micronutrientsProperty` | `micronutrients` | The second list: salt, sodium, and the vitamins and minerals Annex XIII permits a label to declare. Two lists rather than one because a label prints them as two blocks, and because the per-serving figures are derived from the macro list only |

A blank name writes that figure nowhere rather than falling back to a literal,
the same rule `kjProperty` follows. An empty list is deleted rather than written
as `[]`: a meal that names no micronutrient has not declared an empty set of
them.

**These four are English in both locales**, like every other property name here
and unlike the folder and heading defaults. A frontmatter key is not display
text, and a vault whose language setting changed must not end up with half its
meals keyed `macronutrients` and half something else, with neither half readable
from the other side of the switch.

### What one nutrient says

Sub-keys inside one list entry, not top-level properties. `*Field` rather than
`*Property` says so, following the same suffix rule the plan-entry and
order-item fields use.

| Setting | Default | What it does |
|---|---|---|
| `nutrientNameField` | `name` | The nutrient, as a language-free id such as `saturatedFat`. That is what lets the view show a translated label for it; a name no table knows is kept and shown exactly as written |
| `nutrientUnitField` | `unit` | Stored per entry rather than derived from the nutrient, because a label states it: iron is usually mg and occasionally µg, and a reader that assumed the usual would be out by a factor of a thousand with nothing looking wrong |
| `nutrientValueField` | `value` | The figure. Absent when a note names a nutrient without stating one, which is a different note from one that never named it |

The known ids and the order they render in are `trail-core`'s
(`packages/core/src/meal/nutrients.ts`). `salt` and `sodium` are separate ids
and neither is an alias of the other; nothing ever converts between them.

### Written but never read

| Setting | Default |
|---|---|
| `kjProperty` | `kj` |

It is written by the editor whenever a meal states a per-100 g breakdown, and
nothing anywhere reads it back: no view, no parser, and not the editor that
wrote it. It still gets a configurable name, because in this codebase every
frontmatter property a feature writes gets one, and a property written under a
name nobody chose is the one kind this vault does not have.

**The group is a claim about the code, so its membership is load-bearing.** It
held five rows for a while, and three of them had readers: `mealLineProperty`
and `mealPriceCurrencyProperty` are read by `readMealMeta` with an alias list
each, and `servingSizeProperty` is read by `readMealDraft`. All three now sit
with the property names above, where the heading is true of them. A row moves
group when its behaviour changes; the note does not get widened to cover it.

The fourth row was `defaultServingSizeProperty` (`default_serving_size`), and it
left the plugin rather than the group. Having no reader was not what settled it:
the editor wrote it from the same `draft.servingGrams` as `serving_size`, so it
could never state a weight that one did not, and a name for a value that can
never differ is a name for nothing. Removing a settings key means a `data.json`
still carrying it drops the key on the next merge, which is harmless here:
`mergeSettings` builds its result key by key from `DEFAULT_SETTINGS` rather than
by spreading the saved object, so an unknown key was never read in the first
place. `scripts/strip-default-serving-size.ts` takes the property off the notes.

---

## Planning

### Plan notes

A plan holds its entries as a property list, the way an order holds its
selections. The week and the person are also in the filename, and the property
wins over it.

| Setting | Default | What it does |
|---|---|---|
| `mealPlanTypeValue` | `mealPlan` | |
| `mealPlanWeekProperty` | `week` | An ISO week title, `2026-W34` |
| `mealPlanPersonProperty` | `person` | A `[[Person]]` wikilink |
| `mealPlanEntriesProperty` | `entries` | Written even when empty, unlike every other property here: a cleared week is a real state, and an absent list would read as a note that was never a plan |

### What one entry says

Sub-keys inside an entry, not properties of the note.

| Setting | Default | What it does |
|---|---|---|
| `planEntryMealField` | `meal` | A wikilink is a meal note; plain text is an entry that is not one, such as leftovers |
| `planEntryDayField` | `day` | An English weekday key. Omitted for the queue |
| `planEntrySlotField` | `slot` | One of the four fixed slots |
| `planEntryEatenField` | `eaten` | Written only when true. This is what makes the plans the eating history |
| `planEntryRatingField` | `rating` | 1 to 5. Absent on an eaten entry means eaten and deliberately unrated |
| `planEntryTimeField` | `time` | `HH:mm`, when the eater recorded one |
| `planEntryNoteField` | `note` | |
| `planEntryLeftoversField` | `leftovers` | Written only when true |
| `planEntryIdField` | `id` | What an edit finds the entry by. An entry added by hand has none, and the first edit to it gives it one |

### Reading

| Setting | Default | What it does |
|---|---|---|
| `autoOpenMealPlanView` | `true` | Opening a plan note shows it as its week instead of Markdown |
| `mealSlotFieldName` | `meal` | **Read only.** Nothing writes a checklist line any more, but a note nobody has converted still carries `#meal/lunch` or `[meal:: lunch]`, and this names that field |

### Eating history

| Setting | Default | What it does |
|---|---|---|
| `eatingHistoryEnabled` | `true` | Off hides the log, the streak badge and the activity chart |
| `eatingHistoryHeading` | `Eating History` *(localized: `Essverlauf`)* | The body heading a log is read under, and rewritten under whenever an outing is recorded. Clear it to leave the body alone. Only shown when the row above is on |
| `eatingHistoryFrontmatterProperty` | `eatingHistory` | The frontmatter list a log is read from, likewise read and no longer written. Only shown when eating history is on |
| `lastEatenProperty` | `lastEaten` | Written on the meal note whenever an outing is recorded, and read by the gallery and the dashboard |
| `eatenCountProperty` | `eatenCount` | Same |

The plan note is the store. Both of the other two are read behind it so a
vault that has not been migrated still works, and an existing value is left
exactly as it is rather than deleted. See
[Meals](../features/meals.md#eating-history).

The Planning section ends with a status block counting the plan notes CULItrail
can see, on the same folder-and-type terms as every other kind.

---

## Orders and CRM

### Order note shape

| Setting | Default | What it does |
|---|---|---|
| `orderTypeValue` | `order` | |
| `orderCompanyProperty` | `company` | Holds a `[[Company]]` wikilink |
| `orderDateProperty` | `orderDate` | |
| `orderDeliveryDateProperty` | `deliveryDate` | |
| `orderPriceProperty` | `price` | The total as typed. Never overwritten by the computed one |
| `orderPriceCurrencyProperty` | `priceCurrency` | |
| `orderDiscountProperty` | `discount` | Taken off the whole order, not off any one line |
| `orderShippingProperty` | `shipping` | Added to it |
| `orderDefaultCurrency` | `CHF` | Prefilled on a new order, and the last fallback for the currency a meal's price is shown in |
| `displayLocale` | *(empty)* | The convention figures and dates are drawn in, as a BCP 47 tag. Empty follows this computer. Separate from the interface language: every German locale writes `100.120,20` where Switzerland writes `100'120.20`. Shared with the other two plugins through trail-core's `DISPLAY_CONTRACT` |
| `orderVatRateProperty` | `vatRate` | |
| `orderVatAmountProperty` | `vatAmount` | |

**Every price in an order note is gross**, and always has been: what the
company charged, tax included. The two VAT settings let a note additionally
state how much of that gross was tax, which the invoice then shows as an
included line. Nothing is computed from them, and an order stating neither
means exactly what it did before they existed. Either may appear without the
other, because some invoices print the rate, some the francs, and most both.

### Selections

| Setting | Default | What it does |
|---|---|---|
| `orderSelectionsProperty` | `selections` | The v2 list, one entry per person |
| `orderSelectionPersonField` | `person` | A sub-key inside a selections entry, not a top-level property |
| `orderSelectionMealsField` | `meals` | Same: the bare list of dishes |
| `orderSelectionItemsField` | `items` | The priced line list, written instead of `meals` once a line carries a price or a quantity |
| `orderItemMealField` | `meal` | A sub-key inside an items entry |
| `orderItemPriceField` | `price` | What was charged, not what the dish costs today |
| `orderItemQuantityField` | `quantity` | Omitted when it is 1 |
| `orderItemDiscountField` | `discount` | A percentage off this line alone, on top of whatever comes off the whole order |
| `orderSelectionPropertyPrefix` | `selection` | **Read only.** The v1 flat-per-person shape (`selectionStefan:`), kept so pre-v2 notes still parse and get upgraded on next save |
| `autoOpenOrderView` | `true` | Opening an order note shows it as an invoice instead of Markdown |
| `autoOpenDeliveryView` | `true` | Opening a delivery note shows it as a document instead of Markdown. On by default because a delivery keeps everything in frontmatter, so the Markdown view of one is blank |

The order number lives only in the filename (`yyyy-mm-dd-ordernumber.md`),
never in frontmatter, and therefore has no setting.

### Deliveries

| Setting | Default | What it does |
|---|---|---|
| `deliveriesFolder` | `Eating/Deliveries` *(`Essen/Lieferungen`)* | |
| `deliveryTypeValue` | `delivery` | |
| `deliveryDatePropertyName` | `deliveryDate` | Wins over the date in the filename, since a person corrects the property |
| `deliveryOrdersProperty` | `orders` | A **list** of `[[Order]]` wikilinks |
| `deliveryItemsProperty` | `items` | What was in the box |
| `deliveryItemMealField` | `meal` | A sub-key inside an items entry. A bare wikilink is also accepted |
| `deliveryItemQuantityField` | `quantity` | Omitted when it is 1 |

A delivery is a note kind of its own rather than a field on an order, because
an order can arrive in two boxes a week apart and one box can settle two
orders. `deliveryOrdersProperty` is a list for the second of those, and may be
empty for a box nobody linked.

### Company terms

Read off a Company note and, like everything else on one, **never written
back**. They are the figures a new order is pre-filled from; what lands in the
order note is a plain number, so a company changing its terms next year does
not restate what an order from today says.

| Setting | Default | What it does |
|---|---|---|
| `companyCurrencyProperty` | `currency` | |
| `companyPaymentMethodProperty` | `paymentMethod` | Free text, such as Invoice or Credit Card |
| `companyInvoiceTimingProperty` | `invoiceTiming` | Free text, such as At order for a credit card |
| `companyShippingFeeProperty` | `shippingFee` | |
| `companyFreeShippingFromProperty` | `freeShippingFrom` | How many **meals** in one order earn free delivery |
| `companyDiscountTableProperty` | `discountTable` | A ladder of rows, counted in meals. `from:`/`percent:`, or `12: 10` on one line. The highest rung at or below the count wins |
| `companyLinesProperty` | `lines` | The ranges the company sells the same dish under, offered when setting a meal's line |

These seven are deliberately **not** part of `trail-core`'s shared CRM
contract. APERtrail has no reader for them yet, and a contract with one
implementer is a coincidence rather than an agreement. The module holding them
is written to be unit-agnostic so it can move the day that changes.

### People and companies

Every default here is deliberately identical to APERtrail's, so a fresh
install of either plugin in either locale lands on the same two folders and
the same two type values. They come from `trail-core`'s shared CRM contract
rather than being spelled in this plugin, and `tests/crm-contract.test.ts`
fails if they drift.

| Setting | Default | What it does |
|---|---|---|
| `crmFolder` | `CRM` *(`CRM`)* | Parent of the two contact folders |
| `personsFolder` | `CRM/People` *(`CRM/Personen`)* | Read only. CULItrail creates no person notes |
| `companiesFolder` | `CRM/Companies` *(`CRM/Firmen`)* | Read only |
| `personTypeValue` | `person` | |
| `companyTypeValue` | `company` | |
| `personTagProperty` | `tags` | |
| `companyTagProperty` | `tags` | A separate setting from the person one, so neither has to lie about what it covers |
| `personRolesProperty` | `roles` | What a Person *is*: `vendor`, `customer`, whatever a vault decides. A separate key from the companies' on the same split as the tag properties |
| `companyRolesProperty` | `roles` | What a Company *is*: `meals`, `hotel`, `restaurant`. This is what `mealSupplierRole` reads, and the reason it is in the shared contract is that three plugins ask their own question of it and a company that is several of those should say so once |
| `supplierProperty` | `supplier` | On a **meal**, not on a company: which company sells a dish, when it is not the company on the most recent order naming it. A `[[Company]]` wikilink, and the escape hatch for a dish bought once from a supplier that has since changed its packaging |
| `eligiblePersonTags` | `` (empty) | Comma-separated. Narrows which people are offered as a meal-plan person or an order recipient. **Empty means everyone, never nobody** |

The Orders section ends with a read-only **status block**: which folders are in use,
which type value each kind is looking for, and how many notes currently match,
plus whether the CRM settings were adopted from a sibling plugin on first
load. It is diagnostic, not configuration. A vault that ends up with zero
matching people has no other way to tell whether the folder is wrong, the type
value is, or the values came from somewhere it did not expect.

---

## About

Credits (the Recipe Box origin project and its link, per `NOTICE.md`), the
licence, and version, author and description read live from
`manifest.json`.

---

## Settings with no row

### Persisted runtime state

`settings.state` is data and view state, not configuration, and appears
nowhere on the page: `mealPlan`, `mealPlanActivePerson` and
`mealPlanViewedWeek`. See
[Data model -> What is stored outside notes](data-model.md#what-is-stored-outside-notes)
for what each holds and why it lives here.

`gallerySavedState` and `ordersSavedState` are the other two exemptions. Both
are configuration in shape, but each view's own toolbar is its editor, so a
second set of rows for either would be two controls over one value.

### Deliberately not settings

- **The order number's location.** It is the filename, and that is the
  contract.
- **Weekday keys on meal-plan entries.** Entries are keyed by weekday name,
  not by date, deliberately.
- **Meal slot names** (`breakfast`, `lunch`, `dinner`, `snack`). How they
  are written is configurable; which four exist is not.
- **Which layout a meal renders in.** Mobile gets the tabbed layout and
  everything else gets the stacked one. The tabbed layout is not a narrower
  version of the other, so offering the choice would only offer a worse one.
- **The `private:` and `work:` phone properties** on person notes. They are
  read by nothing, on purpose, so they get no settings. `mobile` is the one
  filled in practice.
- **Rating range.** 1 to 5, everywhere.
- **A rating on the meal note.** Removed rather than made optional. How good a
  dish is on average is a worse question than how it was the time you ate it,
  and a plan entry answers the second one. The gallery's minimum-rating filter
  and its rating sort went with it.
