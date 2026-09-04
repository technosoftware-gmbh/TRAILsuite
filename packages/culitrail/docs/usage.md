# Usage

> **Status: built.** Everything on this page works.

A walkthrough from an empty vault to a planned week with its orders
recorded.

## 1. The folder skeleton

CULItrail creates nothing on first launch. The folders appear as notes are
written into them, and a folder that does not exist is a folder holding
nothing as far as every reader here is concerned:

```
Eating/
  Meals/                    created with the first meal
  Meal Plans/               created with the first plan
  Orders/                   created with the first order
CRM/
  People/                   yours, or APERtrail's, or created by hand
  Companies/
```

Every path is a setting. If your vault already has a folder of meal notes,
point `mealsFolder` at it in **Settings -> CULItrail -> Vault setup -> Folders**
and skip the rest of this section.

If you would rather keep everything under an existing folder, set **Root
folder** once. `4 Resources/Eating` moves the whole tree in one
step.

## 2. Get some meals in

**New meal** (command palette, or **Add meal** in the gallery's toolbar) asks for
a name, makes the note and opens the editor on it. What lands on disk is the
shortest thing the readers recognise: the type value and a creation stamp.
The first save shapes the body.

By hand works just as well, from
[the meal template](templates/Template%20-%20Meal.md). A note with
`type: meal` in the meals folder is already a complete meal as far as
CULItrail is concerned. Everything else is optional.

Open one. It renders as a **Meal view** rather than as Markdown: header
image, badges, the per-serving nutrition strip, the price, the per-100 g
breakdown the packet declares, and the reheating instructions per appliance.
**Open as Markdown** goes back to the raw note when you need to edit it
directly.

## 3. Tell CULItrail who eats

Meal plans are per person, so it needs to know who the people are.

A person is a note under `CRM/People` with `type: person`. Create one per
household member, from
[the person template](templates/Template%20-%20Person.md) or by hand.
CULItrail reads them; it does not create them. If APERtrail is installed it
already creates them, and both plugins read the same folder.

If your People folder also holds notes that are people but not household
members, tag the household ones, for example `Family`, and put that tag in
**Household tags**, in the People section of the settings page. Leave it empty and
everyone is offered, which is the default.

## 4. Say how a dish gets warmed up

A meal note carries a `## Reheating` section with one sub-heading per
appliance. A dish can state its own wording, or supply only the numbers:

```markdown
## Reheating

### Steamer
[temp:: 95 °C] [time:: 25 min]
```

and let its supplier's wording carry the rest. The supplier's boilerplate
goes on the company note once, under the same heading, with `{temp}` and
`{time}` where the numbers belong. A dish whose supplier is not stated is
taken from the most recent order naming it, so in a household ordering from
one company this usually needs typing nowhere. See
[Ready meals](design/ready-meals.md).

## 5. Plan a week

Open the **Meal Plan** view. Pick a person at the top; that choice is what
every add and remove below acts on.

- From the meal view or a gallery card's menu, add a meal to a day and a meal
  slot.
- Or use **Add this meal to the meal plan** on whichever meal note is open.
- Or use **Plan a meal**, on the dashboard's meal-plan card or from the
  command palette, which opens the same picker and then asks for the day.
- Or use the week grid's own per-day plus button, which opens a meal picker.
- Drag entries between days and slots in the grid.

**Add a meal** in the view's own toolbar is the one route that asks nothing: it
puts the dish in the week's queue, for a day to be chosen by dragging it onto
one. A week is often filled in that order, with what is in the freezer listed
first and the days settled afterwards.

Entries are keyed by **weekday**, not by date. Tuesday is Tuesday. The week
comes from the note the entry lives in.

The view browses any week, past or future, and remembers which one it was
last on.

## 6. Record what you ate

**Mark as eaten** in the meal header asks when, who ate it, how it was, and
anything worth noting, and writes it onto the week's plan line. If that meal
was already planned for that day, the line that is already there is ticked
rather than a second one written, because one dinner should not become two.

That log is what feeds the "last eaten" badge, the times-eaten count, the
gallery's "never eaten" filter and last-eaten sort, and the dashboard's
activity chart, so it is worth the two seconds.

## 7. Record the order

**New order** in the Orders view builds an order note: the company, the order
and delivery dates, the discount and the shipping, and for each eligible
person, the dishes they chose. Under the picker, a **what it cost** section
lists the dishes actually chosen with a price each. The **Total** field above
is filled in from those prices and locked as soon as one line carries a price,
because a figure totalled from the lines and a figure typed beside them are two
answers to one question and nothing could say which was right.

The filename encodes the date and the order number
(`2026-02-13-23624.md`); the order number is not in frontmatter, so name the
file correctly and nothing else needs to know.

Opening an order note renders it as an **invoice**: the supplier and the
order number, the dates, one row per dish with its quantity and price, the
totals, and who ordered what. The **Orders** view lists them newest first,
with a search field, a filter for one supplier, one year or orders no delivery
has been logged against, and a sort by order date, delivery date, supplier or
total.

On a person or company note, a `culi-related-orders` block lists every order
that names it. See [Orders, people & companies](features/orders-and-crm.md).

## 8. Browse and find things

- **Gallery**: every meal as a card grid, filterable by folder, favorite,
  diet, tag, never-eaten and allergen exclusion, with free-text
  search, sortable five ways, and an **Add meal** button. The whole filter
  state persists, so reopening it picks up where you left off.
- **Dashboard**: the eating-activity chart, the library in a few numbers,
  this week's plan and the six newest meals, with **View meals** and **View
  orders** in the top bar.
- Clicking your meals folder in the file explorer can open the gallery.
  Clicking a subfolder filters the gallery to it, if you turn subfolders on.
  Both live under **Browsing**.

## 9. Settings worth touching early

Most defaults are fine. These four are the ones a real vault usually
changes:

| Setting | Why |
|---|---|
| `mealsFolder` | If your meals already live somewhere |
| `reheatingHeading` | If your notes name that section something else, especially in a non-English vault |
| `myAllergens` | The allergen banner and the gallery's exclusion filter both read it, and it starts empty |
| `eligiblePersonTags` | If your People folder holds more than your household |

Everything else, including every frontmatter property name and every
`type:` value, is also a setting. If your notes already use a convention,
change the setting rather than the notes. The property names sit behind a lock
on the Property keys page which ships off, because they are what every note
already in the vault is read by and a stray keystroke in one of them empties a
view without an error; turn it on for as long as it takes to change what you
need. See [Settings reference](design/settings-reference.md).
