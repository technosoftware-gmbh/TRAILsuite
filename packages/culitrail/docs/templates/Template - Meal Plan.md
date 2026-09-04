# Meal Plan

One person's week. **Normally written and rewritten by the plugin**, so this
template is here for reading rather than copying: the value of seeing the
shape is knowing what a hand-edit will and will not survive.

Opening one shows that week's grid rather than this frontmatter, since
`autoOpenMealPlanView` ships on. **Open this plan as Markdown**, or the pencil
in the tab header, is how you get to the properties below; **Open this plan as a
week**, or **Open as a week** in the file menu, goes back.

## Where it lives

`mealPlanPath`, default
`Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md`.

- `{GGGG}` is the **ISO week-year**, `{WW}` the ISO week number. Not
  `{YYYY}`/`{ww}`, which are calendar-year based and disagree with the ISO
  week near a year boundary
- `{person}` is that person's note title with spaces removed, so
  `[[Stefan Baker]]` produces `StefanBaker`. It is the **full** title on
  purpose: an earlier scheme used only the first name and two people
  sharing one wrote into the same file

The template says which file *one* week is. Which notes are plans at all is
the ordinary folder-and-type question, answered by `mealPlansFolder` and
`mealPlanTypeValue`, which is what the eating history asks when it reads every
week there has ever been.

## Fields

The plan is frontmatter, the way an order's selections are.

1. **Type**
   `mealPlan`, or whatever `mealPlanTypeValue` is set to
2. **Week** (`mealPlanWeekProperty`)
   An ISO week title, `2026-W34`. Also in the filename; **the property wins**,
   because the name is fixed once written and a person correcting it edits the
   property
3. **Person** (`mealPlanPersonProperty`)
   A `[[Person]]` wikilink. Same rule
4. **Entries** (`mealPlanEntriesProperty`)
   The week itself. Written even when empty, unlike every other property here:
   a cleared week is a real state, and an absent list would read as a note that
   was never a plan

Each entry is a mapping, and every one of its keys is a setting too:

- **`meal`** is a `[[Wikilink]]` for a meal note, or plain text for an entry
  that is not one: leftovers, eating out, something somebody else brought.
  Which of the two it is comes from whether the value is a link
- **`day`** is an English weekday key, `tuesday`. **Weekdays, not dates.** A
  Tuesday entry is a Tuesday entry, deliberately, and this should not be turned
  into real dates without a design conversation first. Omitted for the queue,
  which is the entries that belong to the week but to no particular day
- **`slot`** is one of `breakfast`, `lunch`, `dinner`, `snack`
- **`eaten: true`** is what makes these notes the store for eating history.
  Everything the badge, the gallery and the dashboard say about how often a
  dish is eaten is counted from it. Omitted when false
- **`rating`** is 1 to 5 for **this** helping, and it is the only rating in the
  vault: a meal note carries none of its own. An eaten entry with no rating is
  eaten and deliberately unrated
- **`leftovers: true`** marks an entry as a second sitting of something already
  cooked, set from the card's own menu. Omitted when false, like `eaten`
- **`time`** is `HH:mm` and **`note`** is a remark, both written by whatever
  recorded the meal as eaten
- **`id`** is what an edit finds the entry by. An entry added by hand has none,
  and the first edit to it finds it by its meal, day and slot and gives it one

## What a hand-edit survives

- **Adding, removing or reordering entries** survives. The next sync reads the
  note and state follows
- **An entry with no `id`** survives, and gets one the first time anything
  edits it
- **A property the plan format does not own** survives every write, as does
  anything below the frontmatter: a shopping reminder, a paragraph, a section
  of your own
- **An entry's `time` and `note`** survive an edit to its rating. A write is a
  merge rather than a replacement, exactly because the plugin's in-memory
  mirror does not model those two
- **A day or a slot that is not one of the fixed set** does not. It reads as
  absent, which puts the entry in the queue rather than dropping it
- If state and the note ever disagree, the **resync** command makes state
  agree with the note, not the other way around. That is the only action that
  does, and it acts on the currently viewed week

## The checklist this replaced

A note written before this release holds `## Tuesday` headings and lines like
`- [x] [[Meal]] #meal/lunch [rating:: 4]`. Those are **still read**, so no week
goes quiet while a vault is converted, and nothing writes them. A note is
converted the first time anything writes to it, and
`scripts/convert-plan-notes.ts` converts a whole vault in one pass.

Two things about that reader are worth knowing. A `[rating:: 0]`, which meant
eaten and deliberately unrated, reads as an eaten entry with no rating. And a
bullet under a heading the plan format did not invent, such as a `## Shopping`
section somebody added, is **not** an entry: the line parser cannot tell
`- Bread` from `- Leftovers`, and the section it sits under can.

## Example layout

    ---
    type: mealPlan
    week: 2026-W34
    person: "[[Stefan Baker]]"
    entries:
      - meal: "[[Leek Risotto with Shiitake]]"
        day: monday
        slot: lunch
        eaten: true
        rating: 4
        id: mp-2026-W34-StefanBaker-1
      - meal: "[[Beluga Lentil Curry with Potatoes]]"
        day: tuesday
        slot: lunch
        eaten: true
        rating: 3
        time: "12:30"
        id: mp-2026-W34-StefanBaker-2
      - meal: Leftovers
        day: tuesday
        slot: dinner
        id: mp-2026-W34-StefanBaker-3
      - meal: "[[Penne alla Norma]]"
        slot: dinner
        id: mp-2026-W34-StefanBaker-4
    created: "2026-08-17T09:12"
    ---
