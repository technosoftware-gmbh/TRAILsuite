# The trail plugins: a user guide

Three Obsidian plugins that keep three parts of a life in ordinary notes:
**CULItrail** for meals, **APERtrail** for travel, and **NODAtrail** for
everything else you are responsible for, plus the money that belongs to neither
of the other two. A fourth package, **trail-core**, is a shared library with no
user interface; you never install it directly.

They can be used together or apart. Nothing one writes is unreadable without the
others, and if you disable one, its notes stay plain Markdown with plain
frontmatter.

Written 19 August 2026, updated 22 August 2026 when NODAtrail arrived, and
audited 5 September 2026. All three are at 1.0.0. **CULItrail is installed from
[its own repository](https://github.com/technosoftware-gmbh/CULItrail)** and the
other two from this one; nothing about using them together changed when it
moved. **NODAtrail has its own guide**, which is more
detailed than a section here could be:
[`packages/nodatrail/docs/usage.md`](../packages/nodatrail/docs/usage.md).

---

## 1. What each one is for

**CULItrail** is for meals you buy ready-made and reheat at home. It keeps a
library of dishes, plans a week per person, records what was actually eaten and
how it was rated, and tracks what was ordered from which company and which box
it arrived in. It does not do recipes, ingredients or shopping lists, on
purpose.

**NODAtrail** is for the rest of it: the areas you maintain, the goals they
serve, the projects that advance them, the daily, weekly, monthly, quarterly and
yearly notes you plan them in, and the purchases, bills, standing charges and
budgets that belong to neither a trip nor a meal, and a double-entry ledger
under all of it. It reads the checkbox lines you already write in the Obsidian
Tasks format and does not try to replace them.

**APERtrail** is for travel, with a photographer's bias. It keeps countries,
states and cities, the accommodation, restaurants and landmarks under them, and
photo spots with the motifs you want to shoot there. A trip records where you
went, when, with whom and where you slept, and the plugin works out for itself
which places you have now visited. It computes sunrise, golden hour and blue
hour offline, with no network involved.

All three read the same **people and companies** out of one shared folder, so a
person is one note whether they came on a trip, ate a meal with you, or sent you
an invoice.

---

## 2. The two rules that decide what a plugin sees

This is the single most useful thing to know, because everything that looks like
a bug is usually one of these two.

**A note is only recognised when it is in the right folder AND carries the right
`type:` value.** Both, always. A meal note that sits outside the meals folder is
invisible to the gallery. A note in the meals folder with no `type: meal` is
equally invisible.

Nothing is claimed by accident either. **A folder setting left empty matches
nothing rather than matching your whole vault**, and a type value left empty
matches nothing rather than everything in the folder. If a view is empty, one of
those two is usually why, and each plugin has a status block or a health check
that will tell you which.

The `type:` value is compared exactly, so `Person` and `person` are two
different things. It is forgiving about shape, so `type: city` and
`type: [city]` both work, which matters because Obsidian's property editor turns
a field into a list the moment you add a second value.

---

## 3. How the vault is laid out

These are the English defaults. A German vault is seeded with German folder
names at first run, shown here in brackets. Every folder is a setting, and
moving a top folder moves everything under it.

```
Eating/                     [Essen/]
  Meals/                    [Mahlzeiten/]        meal notes
  Meal Plans/               [Essenspläne/]       one note per person per week
  Orders/                   [Bestellungen/]      one note per order
  Deliveries/               [Lieferungen/]       one note per box that arrived

Trips/                      [Reisen/]            one note per trip
  Bookings/                 [Buchungen/]         flights, hotels, tickets
Places/                     [Orte/]
  Countries/  States/  Cities/                   [Länder/ Bundesländer/ Städte/]
  Accommodation/  Food & Beverages/              [Unterkünfte/ Essen & Trinken/]
  Landmarks/  Locations/  Photo Spots/           [Sehenswürdigkeiten/ Sonstige Orte/ Fotospots/]

0 Plan/                     [0 Plan/]
  1 Daily/  2 Weekly/                            [1 Täglich/ 2 Wöchentlich/]
  3 Monthly/  4 Quarterly/  5 Yearly/            [3 Monatlich/ 4 Vierteljährlich/ 5 Jährlich/]
1 Areas/                    [1 Bereiche/]        what you maintain
2 Goals/                    [2 Ziele/]           what the areas are for
3 Projects/                 [3 Projekte/]        what advances a goal
4 Resources/                [4 Ressourcen/]      reference material
6 Archive/                  [6 Archiv/]          where finished things move
Finance/
  Purchases/  Bills/  Recurring/                 [Einkäufe/ Rechnungen/ Wiederkehrend/]
  Budgets/  Accounts/  Journal/                  [Budgets/ Konten/ Journal/]

CRM/
  People/                   [Personen/]          shared by all three
  Companies/                [Firmen/]            shared by all three
```

You can put `Eating`, `Trips` and `Places` under one common parent by setting
the root folder in each plugin, and you can repoint any single folder on its own
if your vault organises that one differently.

**NODAtrail's layout is PARA plus two.** Projects, areas, resources and
archives are the method; `0 Plan/`, where the periodic notes live, and
`2 Goals/` are additions. A goal sits between an area and the projects that
serve it, which is what lets a project's area be derived instead of typed.

Any other folders your vault already keeps sit alongside these and are not read
by any of the three.

---

## 4. The notes you write

Each section below shows a note as the plugin writes it, then what each property
is for. **You never have to type any of this by hand**; the plugins' dialogs
write it. It is here so that a note stays legible to you, and so you can fix one
by hand when you want to.

Every property name shown is the default and can be renamed in settings, though
see section 7 before you do.

### 4.1 A meal

```yaml
---
type: meal
image: _resources/penne-alla-norma.png
servings: 2
prepTime: 5
reheatTime: 25
supplier: "[[TomTasty AG]]"
line: Alltag
price: 19.9
priceCurrency: CHF
diet: [vegetarian]
allergens: [gluten]
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
serving_size: 400g
calories: 640
kj: 2676
protein: 19.2
fat: 22
carbs: 84
favorite: true
lastEaten: 2026-07-28
eatenCount: 6
created: "2026-01-04T18:12"
modified: "2026-07-28T19:40"
---
Aubergine, tomato and ricotta salata.

## Reheating
### Steamer
[temp:: 95 °C] [time:: 25 min]

## Notes
```

| Property | What it is for |
|---|---|
| `servings` | How many portions the pack holds |
| `prepTime`, `reheatTime` | Minutes. If you leave `totalTime` out, it is the sum of these two |
| `supplier` | Which company sells it. Without it, the plugin infers the supplier from your most recent order |
| `line` | Which of that supplier's ranges the dish belongs to, such as Alltag or Sport |
| `price` | What one portion costs ready-made |
| `diet`, `allergens` | Tags. The gallery's diet filter is built from `diet` |
| `calories`, `kj`, `protein`, `fat`, `carbs` | Nutrition for **one serving**, on whichever basis you set in settings |
| `caloriesPer100g`, `kjPer100g`, `macronutrients`, `micronutrients` | Nutrition for **100 g**, which is what the packet declares |
| `serving_size` | The weight of one serving. It is what turns the 100 g figures into the per-serving ones |
| `favorite` | Marks a dish you want to find again |
| `lastEaten`, `eatenCount` | Written for you from your meal plans. Do not maintain them by hand |

**The two nutrition bases are different claims, and a meal can carry both.** The
first set is one portion as it comes; the second is what is printed on the box.
If you fill in the 100 g figures and the serving weight, the per-serving ones are
worked out for you every time you save, so the two can never drift apart. If you
only ever type per-serving numbers, nothing is derived and nothing is touched.
With a breakdown but no serving weight there is nothing to multiply by, so the
per-serving properties are left empty rather than filled with zeros.

The two lists have one entry per nutrient, and each entry says the nutrient, the
unit it was printed in and the figure. **The nutrient name is written as a code
rather than as a word** (`saturatedFat`, not "Saturated Fat"), which is what lets
the plugin show it in your language: a German vault reads *davon gesättigte
Fettsäuren* off a note an English one wrote. Write a nutrient the plugin has
never heard of and it is kept and shown exactly as you typed it. A nutrient named
with no figure means "this dish contains it and nobody has measured it", which is
not the same as leaving it out.

You do not have to type any of this by hand. **Edit meal** gives you the whole
breakdown as a list you can add to, reorder and delete from, with the known
nutrient names suggested as you type, and shows what one serving works out to
underneath while you type it.

If your meals were written before this, they keep their figures in two body
sections instead, headed `Nutritional Information (Per 100g)` and `Micronutrient
Information (Per 100g)`. **Nothing has converted them yet**, and nothing needs
you to: the plugin reads those sections when the properties are empty, and shows
the same table either way. Opening such a meal in the editor and saving it moves
the figures into properties and takes the two sections out. One thing to know if
you go looking: those sections labelled their salt figure `Sodium`, which was
always the wrong word for it, and the plugin reads it as salt without changing
the number.

**A meal has no rating.** The rating belongs to the helping, not to the dish,
because the same meal is not the same experience twice. You rate a meal when you
mark it eaten, and each helping keeps its own stars.

The `## Reheating` section takes one sub-heading per appliance, with a
temperature and a time. If the dish says nothing, the supplier's own
instructions are used instead.

### 4.2 A week's meal plan

One note per person per week, named like
`2026-W34-StefanMuster-MealPlan.md`.

```yaml
---
type: mealPlan
week: 2026-W34
person: "[[Stefan Muster]]"
entries:
  - meal: "[[Penne alla Norma]]"
    day: tuesday
    slot: dinner
    eaten: true
    rating: 5
    time: "19:20"
    id: mp-2026-W34-StefanMuster-2
  - meal: Leftovers
    day: wednesday
    slot: lunch
    leftovers: true
    id: mp-2026-W34-StefanMuster-3
---
```

Each entry is one helping. `day` is a weekday name in English, always, whatever
your vault's language, and an entry with no day sits in the week's queue as
something planned but not yet placed. `slot` is `breakfast`, `lunch`, `dinner`
or `snack`. An entry whose `meal` is plain text rather than a link is something
that is not a dish in your library, such as leftovers or eating out.

**This note is your eating history.** Marking a helping eaten sets `eaten: true`
and optionally a rating, a time and a note, and everything the plugin tells you
about how often you eat something comes from these entries.

### 4.3 An order and a delivery

An order, filed as `2026-08-04-10231.md`, where `10231` is the order number:

```yaml
---
type: order
company: "[[TomTasty AG]]"
orderDate: 2026-08-04
deliveryDate: 2026-08-07
price: 148.5
priceCurrency: CHF
discount: 10
shipping: 0
selections:
  - person: "[[Stefan Muster]]"
    items:
      - meal: "[[Penne alla Norma]]"
        price: 19.9
        quantity: 2
  - person: "[[Erika Muster]]"
    meals:
      - "[[Ofengemüse]]"
---
```

`selections` records who chose what. A person's picks can be a bare list of
dishes or a priced list with quantities and per-line discounts; the plugin
switches the whole order to the priced form as soon as any line anywhere in it
carries a price. `price` is what you were actually charged and is never
overwritten by anything the plugin computes. Every figure in an order is gross,
which is what a meal company's invoice says.

A delivery is a separate note, filed as `2026-08-07.md`:

```yaml
---
type: delivery
deliveryDate: 2026-08-07
orders:
  - "[[2026-08-04-10231]]"
items:
  - meal: "[[Penne alla Norma]]"
    quantity: 2
---
```

Deliveries are separate from orders because **one order can arrive in two boxes
a week apart, and one box can settle two orders**. Both happen, and neither fits
inside an order note without lying about the other.

### 4.4 A trip

```yaml
---
type: trip
country: "[[Switzerland]]"
cities:
  - "[[Basel]]"
departure: "2026-02-13T09:00"
return: "2026-02-13T18:30"
travelStatus: Over
rating: 4
persons:
  - "[[Stefan Muster]]"
stops:
  - place: "[[Basel]]"
    from: "2026-02-13T10:00"
  - place: "[[Gifthüttli]]"
    from: "2026-02-13T12:00"
    to: "2026-02-13T13:30"
    note: Good schnitzel
    rating: 4
nights:
  - accommodation: "[[Hotel Krafft]]"
    checkIn: 2026-02-13
    checkOut: 2026-02-14
transport:
  - direction: outbound
    mode: train
    from: "2026-02-13T09:00"
    to: "2026-02-13T10:02"
    reference: IC 1061
---
```

`travelStatus` is `Planned`, `Booked`, `Over` or `Cancelled`, and it matters
more than it looks: **only trips marked `Over` count as visits.** Set a trip to
`Over` when you get home and the cities and places you stopped at start showing
as visited on their own. You never edit `visited` or `lastVisit` by hand, though
if you do set them, your value wins.

Times are written in quotes. That is not decoration: an unquoted time in YAML is
converted to a date and the clock part is lost.

### 4.5 A booking

A booking is one purchase that belongs to one trip: a flight, a hotel night, a
museum ticket. It is a note of its own rather than a field on the trip, because
a confirmation has a reference, a supplier and a document behind it.

```yaml
---
type: booking
trip: "[[Jura im Juni]]"
category: transport
status: booked
supplier: "[[SBB]]"
place: "[[Neuchâtel]]"
date: 2026-06-14
amount: 187.40
currency: CHF
reference: XK7F2Q
payer: "[[Stefan Muster]]"
for:
  - "[[Stefan Muster]]"
  - "[[Erika Muster]]"
document: "[[SBB 2026-06-14 XK7F2Q.pdf]]"
---
Half-fare, two returns Zurich to Neuchâtel. Seat reservations included.
```

Everything here is a plain property or a list of links, so Obsidian's own
property editor is the editor. **There is no block to add.**

| Property | What it is for |
|---|---|
| `category` | `transport`, `accommodation`, `activity`, `food`, `fees` or `other`. `fees` is visas, insurance, baggage, the tourist tax a hotel adds at the desk |
| `status` | How far along it is, and which total it counts in. See below |
| `place` | What puts the cost on the right row of the itinerary |
| `date` | The day the cost belongs to, not the day you paid |
| `amount` | Leave it empty for something nobody has priced yet. **Empty is not zero**; zero is something that was genuinely free |
| `currency` | Leave it empty to inherit the trip's, and then your home currency |
| `reference` | Also what matches this booking to a transport leg carrying the same reference |
| `for` | Leave it empty for everybody on the trip, which is the usual case |

**The five statuses are not interchangeable.** `estimate` is a figure you looked
up while planning, and it counts as committed, because a budget that showed
nothing until you had booked would be useless exactly when you need it. `booked`
is owed. `paid` has left your account. `cancelled` counts nowhere. And
`refunded` counts as zero but stays visible: the note is your evidence, and
deleting it would lose the reference the money came back under.

**A booking records what was charged, and nothing recalculates it.** If a price
changes later, that is a different booking rather than an edit to this one.

You can also put a cost straight onto a trip's stops, nights and transport legs
without a booking note, by giving the line a `cost`, a `currency` and a
`costUnit` of `total`, `person`, `night` or `personNight`. A line that says
nothing about its unit is read as `total`, so a bare number you typed is never
silently multiplied into something larger than you meant. Leaving a line's
`persons` empty means everybody on the trip, which is why adding a person later
does not quietly leave them off its flights.

### 4.6 Countries, cities and places

A country, a state and a city link to each other, and every accommodation,
restaurant, landmark, location and photo spot links up to its city and country:

```yaml
---
type: city
country: "[[Switzerland]]"
state: "[[Basel-Stadt]]"
geoLocation: ["47.5596", "7.5886"]
---
```

Place notes take `address`, `website`, `rating` and `geoLocation` when you want
them. The plugin reads those; it does not fill them in for you.

### 4.7 A photo spot

A photo spot is a place note with a photographer's layer on top:

```yaml
---
type: photospot
country: "[[Switzerland]]"
city: "[[Neuchâtel]]"
geoLocation: ["46.9899", "6.9293"]
timezone: Europe/Zurich
openingHours: 24h
entryFee: none
accessibility: partial
parking: Parking du Seyon
transit:
  - mode: bus
    detail: Line 380, then five minutes on foot
motifs:
  - name: Château de Neuchâtel
    role: main
    direction: 215
    light: [golden-hour-evening, blue-hour-evening]
    lens: 70-200
    gear: [tripod]
    captured: true
    capturedOn: 2025-06-14
samples:
  - image: neuchatel-pavillon-blue.jpg
    motif: Pavillon des Bains
    light: blue-hour-morning
    exposure: 30s, f/11, ISO 100, ND1000
---
```

A **motif** is one thing worth photographing there: which way you point the
camera in degrees, which light it wants, which lens, and whether you have it in
the bag already. The light words are a fixed list: `blue-hour-morning`,
`sunrise`, `golden-hour-morning`, `day`, `overcast`, `golden-hour-evening`,
`sunset`, `blue-hour-evening` and `night`. `overcast` has no clock window on
purpose, because it means any time under a flat sky.

The plugin computes the actual times for a given date from the coordinates,
offline, and tells you whether the sun will be behind you, beside you or in
front of the motif. It is geometry, not weather, and it assumes a flat horizon,
so a ridge to the east will still let it promise you a sunrise.

### 4.8 People and companies

One Person note serves all three plugins:

```yaml
---
type: person
tags:
  - Familie
address: Musterweg 4, 4000 Basel
email: stefan@example.ch
mobile: +41 79 000 00 00
---
```

Below the frontmatter, the body of a Person or Company note holds one fenced
code block per plugin that has something to say about it: a block marked
`culi-related-orders` lists what this person ordered, one marked
`travel-related-trips` lists the trips they came on, and one marked
`nod-spending`, in a Company note, shows what was actually spent there. Each
plugin renders its own block inside a note it does not own, and **a block whose
plugin is disabled shows as a plain code block rather than an error**, so the
note stays readable either way.

A Company note carries `currency`, `paymentMethod`, `invoiceTiming`,
`shippingFee`, `freeShippingFrom`, a `discountTable` counted in meals, and the
`lines` it sells under. CULItrail uses those to work out what an order should
have cost.

NODAtrail adds two more of its own to a Company note, `account` and `category`:
the ledger account and the category this company's paperwork usually lands in,
so a bill or an imported statement line from them is filed the same way every
time. They are ordinary properties you can correct in the property editor, and
the other two plugins neither read nor touch them.

---

### 4.9 The NODAtrail notes

NODAtrail has more note types than the other two together, and its own guide
covers them property by property. This is enough to recognise each one.

**The PARA notes.** An `area` is something you maintain and that does not end; a
`goal` is what an area is for; a `project` is work that advances a goal and does
end; a `resource` is reference material. **A project's area is worked out
through its goals rather than typed**, so moving a goal to another area re-files
every project under it without touching a project note. Archiving is a move, not
a flag: the note goes to `6 Archive/` with an `archived:` stamp and its `type:`
unchanged, which is why the ordinary views stop showing it without any view
needing a special case.

**The periodic notes.** One note per day, week, month, quarter and year, with
navigation between them. The week is the ISO week, which near a year boundary
can disagree with the calendar year; that is deliberate rather than a bug.

**The money notes.** A `purchase` is something you bought, a `bill` is something
you owe, a `recurring` is a standing charge, and a `budget` is a plan for a
month, a quarter or a year. A bill's status is worked out from its dates, and
the only value worth writing yourself is `cancelled`, because that is the one
state no date can express. **A recurring cost projects its future occurrences
and never writes a bill note for you**: turning one into a bill is a command you
run, having looked at it.

**The ledger.** One `account` note per account, and one `journal` note per month
holding that month's postings in a single fenced block rather than a note each:

````
# 2026-08

```noda-journal
2026-08-04 | 4000 | 1005 | CHF 105.84 | TomTasty | 33698
2026-08-11 |  | 2010 | CHF 881.25 | Cornercard | 2112644264
    4008 | 101.79 | Sollzinsen aus der vorhergehenden Rechnung
    4000 | 105.84 | TomTasty #32940
```
````

A line reads: date, the account debited, the account credited, the amount, then
what it was and an optional reference. The second entry above is a **split**:
the credit side is on the header and each indented leg supplies its own debit,
and the legs have to add up to the header. Nothing in the reader throws, so one
mistyped line is reported with its line number and the rest of the month still
reads.

Two rules run through all of it. **Nothing derived is ever written back** --
balances, variances and projections are recomputed every time something is
drawn. And **a stated total always wins over a computed one**, because a note is
a record of what was charged, not a calculation.

## 5. Everyday workflows

**Planning a week of meals.** Open the meal plan, pick the person and the week,
and add meals to days. Dragging a card moves it to another day. A meal you want
this week but have not placed yet goes in the queue. When you eat something,
mark it eaten and give it stars; that is what fills in the dish's `lastEaten`
and `eatenCount`.

**Not knowing what to eat.** The gallery sorts by last eaten and filters to
what you have never had, which is the same question asked of the library
directly: a dish you have not had for months is at one end of that sort.

**Recording an order.** Create the order, choose the company, add each person's
picks, and enter the price you were charged. Open the order note and it renders
as an invoice. When the box arrives, create a delivery, link it to the order and
list what was actually in it. What was ordered and what turned up are separate
records because they disagree often enough to matter.

**Planning a trip.** Create the trip, add stops in order, add the nights and the
transport legs. A stop can be a city or any place note. When you get back, set
the status to `Over`, and every place you stopped at is now marked visited with
the right date, without you touching those notes.

**Planning a shoot.** Open a photo spot, look at its motifs and their light
windows, and check the sun panel for the date you will be there. When adding a
photo spot to a trip's itinerary, the times offered are the golden and blue
hours for that day at those coordinates.

**Importing a bank statement.** Export the period from your bank, open the
Ledger and choose `Auszug importieren`. Nothing is written until you press the
button: every row is shown first, with the account it would be booked to, and
the rows the importer cannot decide are marked rather than guessed. Before that,
it checks the statement's own closing balance against what the ledger will hold
afterwards, so a period with a row missing says so on the way in.

The file itself is copied into the vault beside that year's journal notes. The
Ledger's accounts tab lists what it has kept, collapsed to one line while
everything is posted. A statement with rows you left undecided stays listed with
a `Fertig buchen` button that reopens the import on that file, with the account
already chosen.

**Entering an invoice, and paying it.** Create the bill, attach the PDF, and
give it the account it belongs to. When the bank statement arrives carrying that
payment, the import recognises the invoice, writes one posting and stamps the
bill paid: you do not mark it paid yourself. `Bezahlt` is for the payments no
statement will ever carry, such as cash.

If you press `Bezahlt` on a bill whose payment is already in the ledger, the
dialog says so and writes nothing. If it finds a payment that matches on the
money but disagrees on the account or falls outside the days it searched, it
tells you which, and shows you both what it found and what it would write. That
warning is the one worth reading: it is the difference between stamping a bill
and putting the same payment in the books twice.

**Finding the paper again.** Every invoice, purchase and recurring cost with a
document attached carries a button that opens it, straight from the list. A
posting reaches the same document through the invoice it settles. A card with no
such button is a note with no document, which is the quickest way to spot one
you meant to attach.

**Seeing the month.** NODAtrail's dashboard puts your areas, goals and projects
across the top as image cards, then what is due today, what is due soon, and the
bills still outstanding. Clicking an area filters the goals and projects to it.
The Budget tab of the Ledger compares planned against actual for the month, and
lists separately the accounts with spending and no plan, which is usually the
interesting list.

---

## 6. Finding things

Each plugin has a dashboard as its front door, on the ribbon and in the command
palette.

CULItrail's dashboard shows this week's plan, library statistics, recent
activity, the latest orders and new meals, and folds the gallery and plan icons
into itself. Its gallery is a searchable grid of every dish with filters for
folder, diet and tags. A meal note opens as a structured view rather than raw
Markdown, and you can always switch back to Markdown from the command palette.

APERtrail has three dashboards, for trips, places and contacts, and a gallery
across all its entity types. Countries show what you have visited, and photo
spots show what you have captured. Its ribbon icon opens the Trips dashboard,
and the other two are a click away on its nav row: three ribbon icons for one
plugin would crowd out every other plugin in the vault.

### The commands

Everything CULItrail and APERtrail can be asked to do is in the command
palette, and
anything you use often can be given a hotkey there.

**CULItrail**, sixteen commands:

| Command | Available |
|---|---|
| Open the kitchen dashboard | always |
| Open the meal gallery | always |
| Open the meal plan | always |
| Open orders | always |
| New meal | always |
| Record a delivery | always |
| Plan a meal | always |
| Resync this week from its notes | always |
| Add this meal to the meal plan | with a meal note open |
| Edit meal | with a meal note open |
| Open in meal view / Open as Markdown | with a meal note open |
| Open in order view / Open this order as Markdown | with an order note open |
| Open this plan as a week / Open this plan as Markdown | with a meal plan note open |

**APERtrail**, eighteen commands: Open Trips dashboard, Open Places dashboard,
Open CRM dashboard, Browse trips, countries & places, then one "New ..." command
for each of the twelve types (trip, booking, country, state, city,
accommodation, food & beverage, landmark, location, photo spot, person,
company), **Export photo spot sheet**, and **Check entity types**, the health
check described in section 8.

**NODAtrail**, twenty-nine commands, more than the other two together: five
views to open (a dashboard, PARA, Plan, Finance and the Ledger), one "New ..."
for each note type it writes, archive and unarchive, the ledger's own set (new
posting, opening balances, import a statement, seed the chart of accounts,
rebuild navigation), and a health check.

**A command you cannot find is usually a command that does not apply.** The
CULItrail entries in the second half of that table appear only when a note of
that kind is in front of you, and the "open as ..." pair only ever offers you
the direction you are not already looking at. An entry that appeared and then
said "this is not a meal" would be a worse version of the same information.

---

## 7. Settings worth knowing

**Folders can be moved freely.** Repoint a folder setting and the plugin looks
in the new place. Your notes are found again as soon as it points somewhere
real.

**Property names are locked, and should stay that way.** Every settings row that
names a frontmatter property or a `type:` value is read-only until you turn on
**Allow editing property names**, which sits at the top of the **Property
keys** page in all three plugins, reached from Vault setup. The reason is that
renaming a property here does not rename it in your notes. The plugin would ask
every note for a property none of them carries, and your gallery, filters and
plans would come up empty with nothing to say why. Unlock it only to match names
a vault already uses, then lock it again.

**The household tag filter.** CULItrail and APERtrail can narrow which people
they offer. CULItrail calls it *Household tags* and APERtrail calls it *Eligible
person tags*; both sit in the People section of that plugin's settings page. Type one
or more tags, comma-separated, and only people carrying one of them are offered for
meal plans, orders and trips. **An empty filter offers everyone, never
nobody.** Case does not matter, a leading `#` is ignored, and a parent tag
admits its children, so `Familie` also matches `Familie/Eltern`.

Note that this setting is per plugin. Setting it in one does not set it in the
other; a plugin only adopts its sibling's CRM settings on a completely fresh
install.

---

## 8. When something does not show up

Work down this list. It is ordered by how often each one is the answer.

1. **Is the note in the folder the plugin is pointed at?** Check the folder
   setting, and remember that a moved note stops being seen.
2. **Does it carry the right `type:` value?** Exactly, including case.
   CULItrail's settings page has a status block counting what it currently sees
   in each folder; APERtrail has a *Check entity types* command that lists every
   note whose type is missing or disagrees with its folder, and offers to fix
   them. NODAtrail has a **Health check** that reports what it finds and offers
   to fix the two things whose answer it already holds: a note's type, because
   its folder says what it should be, and a stamp written in an older shape.
   Those two can be applied in bulk. None of the three writes anything without
   you confirming.
3. **Is a folder or type setting blank?** Blank matches nothing, deliberately.
4. **Did a property name get renamed in settings?** If a whole feature emptied
   at once, this is usually why. Set it back to what your notes actually say.
5. **Is the person filtered out?** If somebody is missing from a person picker,
   check the tag filter described in section 7.
6. **Did you expect a view to refresh by itself?** The views re-read when you
   open or refresh them rather than watching the vault continuously. Reopen the
   view.

---

## 9. Living with all three

The plugins do not talk to each other at runtime. They share a library, a folder
of people and companies, and one convention: a note is what its folder and its
`type:` say it is. NODAtrail additionally reads CULItrail's order notes off
disk, for four fields, so that a card charge on a bank statement can be matched
to the order that caused it.

That has two practical consequences. **You can disable any one of them without
breaking the others**, and any note any of them wrote stays readable as plain
Markdown. And **renaming shared things is a decision for all of them at once**:
if you rename the type property or move `CRM/People`, do it in each plugin, or
one of them will quietly stop finding people.

Backups are your vault's backups. None of them keeps a database, a cache or a
store of its own. Everything they know is in your notes, which is the whole
point.
