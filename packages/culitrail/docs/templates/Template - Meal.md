# Meal

One dish, bought ready-made and reheated. **A meal note has no ingredients
and no method**, because the dish arrives cooked: what it carries is what the
dish is, what it costs, what is in it nutritionally, what it might set off in
somebody with an allergy, and how to warm it up.

A note counts as a meal when it sits in the meal scan scope (`mealsFolder`
plus `additionalMealFolders`) **and** its type property holds `mealTypeValue`.
Both halves are required.

The minimum viable meal is `type: meal` and a creation stamp, which is exactly
what **New meal** writes before handing the note to the editor. Every field
below is optional and every one is read defensively: absent means unset,
never an error.

## Fields

1. **Type**
   `meal`, or whatever `mealTypeValue` is set to
2. **Title**
   For Obsidian's own property editor. The filename is what meal plans and
   orders actually link to
3. **Image** (`imageProperty`)
   A vault path or a URL. Falls back to the note's first body image when
   `useFirstBodyImageWhenFrontmatterEmpty` is on, then to `defaultMealImage`
4. **Servings** (`servingsProperty`)
   How many portions the note is describing. It is what `nutritionSource` and
   `nutritionDisplay` convert between, so a note stating nutrition but no
   servings shows its figures under an honest label rather than a guess
5. **Prep time / Reheat time / Total time** (`prepTimeProperty`,
   `reheatTimeProperty`, `totalTimeProperty`)
   Minutes. Total is computed from prep plus reheat when absent, so usually
   leave it out
6. **Price** (`priceProperty`, alias `cost`), **Supplier**
   (`supplierProperty`) and **Line** (`mealLineProperty`)
   What one portion costs to buy, as a number, shown in the currency the note's
   own `mealPriceCurrencyProperty` states, then its supplier's, then
   `orderDefaultCurrency`. The supplier is a `[[Company]]` wikilink, and it
   is what the reheating merge reads the boilerplate off. The line is the range
   that supplier sells this dish under, such as Alltag or Sport, offered from
   whatever the chosen company publishes; the same dish in two lines is two
   notes, because the nutrition differs and one note could only state one set of
   figures. All three are edited under the **Ready meal** label in the meal
   editor
7. **Diet** (`dietProperty`) and **Allergens** (`allergensProperty`)
   Lists. Diet renders as a chip under the title; allergens drive both the
   gallery's exclusion filter and the allergen banner, each matched against
   the reader's own `myAllergens`
8. **Nutrition** (`caloriesProperty`, `proteinProperty`, `fatProperty`,
   `carbsProperty` per serving; `caloriesPer100gProperty`, `kjPer100gProperty`,
   `macronutrientsProperty`, `micronutrientsProperty` per 100 g)
   `nutritionSource` says whether the per-serving four mean one serving or the
   whole meal; `nutritionDisplay` says how to show them. A note that also
   states what 100 g of it contains has those four **computed** on save from
   the breakdown and the serving weight, along with `kjProperty` and
   `servingSizeProperty`; with a breakdown and no serving weight there is
   nothing to multiply by, so the five per-serving figures are written empty
   rather than as zeros and the serving size is not written at all.
   The breakdown itself is two energy properties and two lists, one entry per
   nutrient, each entry naming the nutrient, its unit and its figure under
   `nutrientNameField` / `nutrientUnitField` / `nutrientValueField`. Lists
   rather than a fixed set of properties, so that a packet declaring fibre, or
   iron, or nothing but salt has somewhere to put what it says, and a nutrient
   CULItrail has never heard of is kept exactly as written. An entry naming a
   nutrient with no figure is a statement of its own: this meal contains it and
   nobody has measured it.
   **The name is a language-free id**, not a word: `saturatedFat`, `carbs`,
   `salt`. That is what lets a German vault read a German label off a note an
   English vault wrote. The known ids are `trail-core`'s
   (`packages/core/src/meal/nutrients.ts`), the macronutrient order is
   Regulation (EU) 1169/2011's, and `salt` and `sodium` are two ids that are
   deliberately not aliases of each other. The unit is written per entry rather
   than assumed, because a label states it and iron is usually mg and
   occasionally µg
9. **Favorite** (`favoriteProperty`)
   A boolean, written straight back by the meal view and offered as a gallery
   filter. There is no rating here: a rating belongs to a helping rather than
   to a dish, and a plan entry carries it
10. **Last eaten / Times eaten** (`lastEatenProperty`, `eatenCountProperty`)
    Written by **Mark as eaten**, computed from the meal plans on every such
    write. Where the note states one by hand it wins over the derived value,
    which is occasionally what you want and usually is not
11. **Source**
    Where it came from. A URL renders as its hostname; anything else renders
    as the text, so "the card in the box" is as valid as a link
12. **Tags**
    Ordinary Obsidian tags. Shown in the header when `showTagsInHeader` is on,
    and usable as a gallery filter
13. **Description**
    Not a property: the free text between the frontmatter and the first
    heading. The meal editor writes it there
14. **Reheating section**
    Under `reheatingHeading`, one sub-heading per appliance. The whole of
    [Ready meals](../design/ready-meals.md) is about this section
15. **Notes section**
    Under `notesHeading`. Rendered, not parsed
16. **The two per-100 g sections**
    Under `nutritionHeading` and `micronutrientHeading`. **Read, never
    written.** The breakdown lives in frontmatter now. A meal written before
    that move still keeps it here and is still read from here, and saving such
    a meal writes the lists and takes both sections out, so nothing carries the
    same figures twice
17. **Eating History section**
    Under `eatingHistoryHeading`. **The ticked lines on the weekly meal plans
    are the store now**; this section is a readable mirror of them, merged
    rather than regenerated whenever an outing is recorded. The
    `eatingHistoryFrontmatterProperty` list an older vault carries is read
    behind both and is never written again

## What the parser expects

- **An appliance sub-heading** is any heading one level below the reheating
  heading, matched against each configured appliance's label, then its id,
  then the shipped defaults in either language. A sub-heading naming no known
  appliance still renders, labelled as written, because text somebody typed is
  never hidden just because the plugin lacks a word for it.
- **`[temp:: 95 °C]` and `[time:: 25 min]`** are Dataview-style inline fields,
  named by `reheatTempField` and `reheatTimeField`. A dish that states only
  these gets its prose from the supplier's boilerplate, with `{temp}` and
  `{time}` filled in from them. A dish that writes its own prose keeps it.
- **A heading naming a section another feature renders ends the reheating
  section**, whatever its level. The eating-history writer emits `## Eating
  History` while these vaults write their other sections at `#`, so without
  that rule a log under a `# Reheating` was read as an appliance called
  "Eating History".
- **A fenced code block inside the reheating section is dropped** rather than
  read as an instruction, which is what keeps a `culi-related-orders` fence
  out of the last appliance's steps.
- **Per-100 g lines** in the two retired sections are `- **Calories:** 585.2
  kcal`. **Nothing writes this shape any more**; it is only what a meal written
  before the breakdown moved into frontmatter still says, and the reader is
  deliberately loose about it: it matches the label case-insensitively, accepts
  the alternative spellings a hand-edited note ends up with, and tolerates a
  line with no value at all, because losing a whole section over two asterisks
  would be the wrong trade. A line with a label and nothing after it becomes an
  entry with no value rather than no entry, since a nutrient somebody named and
  left blank is a different statement from one the note never mentioned.
  Two labels are read as something other than what they say. **`Sodium` reads
  as `salt`**: the old writer put a salt figure under that word, and the values
  in these notes, 0.5 to 1.3 g per 100 g, are salt figures. Nothing is
  multiplied by 2.5 or by anything else, and the correction is confined to these
  two sections; anywhere else `Sodium` means sodium. And **`Sugar` and
  `Saturated Fat`, which the old writer filed under "Micronutrient
  Information", read back into the macronutrient list**, because they are
  sub-components of the carbohydrate and the fat rather than micronutrients.
- **Eating-history lines** are a list item with a date at the front, in either
  `2026-07-28` or `28.07.2026` form, an optional `[rating:: 4]`, and whatever
  else the line says as the note. A log somebody keeps by hand is prose with a
  date in front of it, and a parser that demanded a format would show an empty
  history for every one of them. A line CULItrail wrote carries a hidden
  `<!--culi-id:...-->` marker, which is what lets that one outing be edited
  later; a line with no marker is one a person wrote and is left exactly where
  it is.
- **Nothing else in the body is touched.** Every heading CULItrail does not
  claim is offered back as its own titled section, so a note is never punished
  for holding something the plugin has no feature for. A note that still
  carries an ingredients list from an older vault is one of those sections
  now.

## Example layout

    ---
    type: meal
    title: Penne alla Norma
    image: _resources/Penne alla Norma.png
    servings: 2
    prepTime: 5
    reheatTime: 25
    supplier: "[[TomTasty AG]]"
    price: 19.9
    diet:
      - vegetarian
    allergens:
      - gluten
      - milk
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
    source: https://example.com/penne-alla-norma
    tags:
      - italian
      - pasta
    created: "2026-01-04T18:12"
    modified: "2026-07-28T19:40"
    ---

    Aubergine, tomato and ricotta salata, as the Sicilians do it.

    # Reheating

    ## Steamer
    [temp:: 95 °C] [time:: 25 min]

    ## Oven
    Take the lid off, keep the tray, 180 °C for about 20 minutes.

    # Notes

    Order two if anybody is hungry. The tray is smaller than it looks.

    ## Eating History

    - 2026-07-28 [rating:: 4] 19:20 · Stefan
    - 2026-05-11
    - 2026-02-03
