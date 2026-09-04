# Meal planning

> **Status: built.** Nothing on this page is outstanding.

Meal planning is one area of the plugin, `src/planning/`, and the meal plan
note is the only thing in it that matters: **the plugin's in-memory state is
always a rebuild off the current note content, never the other way around.**
The rule, from `CLAUDE.md`: the meal plan note and the order note are
Markdown, always the source of truth; plugin state mirrors them, and the two
never drift without an explicit sync path.

The plan carries more than a plan. Since an entry marked eaten is what records
that a meal was eaten, these notes are also where eating history lives, which
is why the badge, the gallery and the dashboard all read them. See
[Meals](meals.md#eating-history).

## Per person, per week

Meal plans are **person-oriented**: each configured person gets their own
weekly note, so a two-adult household ends up with two independent plans
rather than one shared list. Who counts as a person is read from
`personsFolder` plus `personTypeValue`, optionally narrowed by
`eligiblePersonTags`. See
[Orders, people & companies](orders-and-crm.md#people-and-companies).

The active person is view state (`state.mealPlanActivePerson`), not a
folder setting: switching person switches which note the view reads and
writes, not the configuration. The dashboard's plan card reads the same
field, so the two can never point at different people.

**Path:** `Eating/Meal Plans/{GGGG}/{GGGG}-W{WW}-{person}-MealPlan.md`
(`mealPlanPath`). `{GGGG}` and `{WW}` are ISO week-year and week-number
tokens, chosen over the calendar-year equivalents because those disagree
with the ISO week near a year boundary. `{person}` is that person's **full**
note title with spaces removed: an earlier version used the first name only,
and two people sharing one wrote into the same file. The resolver still
finds and migrates notes written under that older naming.

**Contents.** The plan lives in the note's **frontmatter**, the way an order's
selections do: a `week`, a `person` and one `entries` list.

```yaml
type: mealPlan
week: 2026-W34
person: "[[Stefan Muster]]"
entries:
  - meal: "[[Beef Stroganoff mit Spätzli]]"
    day: tuesday
    slot: lunch
    eaten: true
    rating: 5
    time: "11:40"
    id: mp-2026-W34-StefanMuster-1
  - meal: "[[Grüne Casarecce mit Poulet]]"
    day: wednesday
    id: mp-2026-W34-StefanMuster-2
```

An entry names a meal note as a wikilink, or names something that is not one
as plain text: `meal: Leftovers` is an entry, and which of the two it is comes
from whether the value is a link. `day` is omitted for the queue, the entries
that belong to the week but to no particular day. `eaten` is what makes these
notes the eating history, and `rating` beside it is how *this* helping was,
distinct from the meal's own ongoing `rating:`, which answers how good the dish
is.

**Every entry carries an `id`.** It is what an edit finds the entry by, and it
is the reason the write path is a lookup rather than a search. An entry a
person types into the list by hand has none, and the first edit to it finds it
by what it is and gives it one.

**This replaces a Markdown checklist**, and the trade is worth stating plainly.
The old note held `## Tuesday` headings and lines like
`- [x] [[Meal]] #meal/lunch [rating:: 5]`, which could be ticked in the editor.
That is gone. What replaced it is a format where every field is a real property
a Dataview or Bases query can reach, where an entry has an identity instead of
an HTML-comment marker, and where changing one field is not a regex over a line
that might have anything else on it. Marking a meal eaten now happens in the
plan view, in the meal view, or by editing the property.

One thing got simpler rather than moving. A line had no way to say "eaten, and
deliberately not rated" except by writing `[rating:: 0]`, a magic value 32
lines in this vault carry and every reader had to special-case. With a real
`eaten` field that is an eaten entry with no rating.

A note written before this release, still holding a checklist, is **still
read**, so no week goes quiet while a vault is converted. Nothing writes that
shape any more, and a note is converted the first time anything writes to it.
`scripts/convert-plan-notes.ts` does the whole vault in one pass.

**Entries are keyed by weekday, not dated.** A Tuesday entry is a Tuesday
entry; it carries no `2026-08-11`. This is an intentional design decision,
not an oversight, and should not be turned into real dates without a
deliberate design conversation. Which week the entry belongs to comes from
the note it lives in and its `week` field.

## Browsing weeks

The meal plan view browses **any week**, past or future, independently of
today, and remembers which one in `state.mealPlanViewedWeek`. Empty means the
current week, resolved at render: storing the actual week title instead would
mean reopening the vault in January still showing whatever week was last
looked at in December.

## Opening one plan note

A plan note opens as **its own week** rather than as Markdown, the way a meal
note opens as the meal view. **The grid is the same grid**, down to the dragging
and the card menus, because there is no version of "what is this week" that
deserves a second answer. What differs is the chrome: this tab is one week and
one person, stated rather than chosen, so it carries no week nav and no person
picker. The week comes from the note, and that week is synced when the tab
opens, since the grid renders from state and state is a mirror.

Auto-opening is `autoOpenMealPlanView`, under Browsing with the other three, and
it **defaults on**. With it off, **Open this plan as a week** in the command
palette or **Open as a week** in the note's file menu asks for it, and **Open
this plan as Markdown**, or the pencil in the tab header, hands the raw note
back.

## Adding and removing

Add a meal to the plan from the calendar button in the meal view's meta
banner, with the **Add this meal to the meal plan** command, from a gallery
card's overflow menu, or from the week grid itself, whose per-day plus button
opens a meal picker. The first three ask for a day and a meal slot and then
add to whichever week and person the meal-plan view is set to, which is shown
in the dialog rather than chosen there.

**Add a meal** in the view's own toolbar is the one route that asks nothing. It
puts the dish in the week's queue, for a day to be chosen by dragging it onto
one, because a week is often filled in that order: what is in the freezer first,
which night it is eaten afterwards.

The picker offers the dishes from the **most recent delivery** at the top,
marked, so a week is built from what is actually in the freezer rather than
from the whole catalogue. They are sorted to the top rather than filtered to:
the freezer holds more than the last box, and a picker that hid the rest could
not plan the dish that arrived a fortnight ago. Typing puts the fuzzy match
back in charge, since a search for a name somebody can already spell is a
search for that dish.

Adding is adding: there is no toggle that removes an already-scheduled meal.
A meal is removed from the entry card in the week grid, which is also where it
can be dragged to another day.

### Putting a meal on a day

Dropping a meal on a day opens a small popover at the point it landed,
offering the four meal slots plus "Anytime" for a meal that belongs to a day
without belonging to a sitting. Only the four: they are a fixed vocabulary
that the grid columns key off, so there is no free-text slot here. A card
dragged from one day to another keeps whatever slot it already had and is not
asked again.

Each card carries two buttons, revealed on hover and always visible on a
phone: one opens the slot and leftovers menu, the other removes the entry.
Removing and re-slotting are the two things done repeatedly while filling a
week in, so neither sits behind a menu.

## What a write does to the note

One path in, where there used to be three. An edit reads the note's entries,
changes one, and writes the list back; adding and removing are the same thing
with a different function in the middle. Anything below the frontmatter is left
alone, and so is any property the plan format does not own.

**An edit is a merge, not a replacement.** The plugin's in-memory mirror does
not model an entry's `time` or its `note`, so writing the entry back from state
would delete both every time somebody set a rating. That is not hypothetical:
the line-based version of this had the same hazard and got it wrong once, in a
way that turned every rating change into a silent no-op.

**Moving a meal to another day is one write.** While the note was a checklist
it meant moving a line between two `##` sections, so it had to be a remove
followed by an insert and the card dropped to the bottom of its new day. A day
is a field now.

## Clearing and resyncing

Clearing a week's meal plan operates **only on the currently viewed week**,
after a dialog that says how many entries are about to go. Every other week is
left untouched, matching the per-week isolation the rest of this area follows.

**Resync this week from its notes** is the one action that says "the note is right, make
state agree". Every other resync fires on navigation or on opening a view,
which leaves no way to reconcile a week you are already looking at. The drift
it exists for is real: a meal-plan note listing the same meal twice where
state held it once, with nothing that would ever notice.

The write order everywhere here is note first, state second. A crash between
the two leaves the note right and state stale, which the next sync repairs;
the other order leaves state claiming a meal the note never held, which
nothing repairs.
