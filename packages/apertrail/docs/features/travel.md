# Travel

This is the whole of APERtrail: trips, plus a geographic hierarchy of countries, states and cities, plus five kinds of reusable place note. Plain Markdown notes with YAML frontmatter are the source of truth, browsed through a searchable gallery and summarized on a dashboard, following the read-time-projection model documented in [Data model](../design/data-model.md). Nothing here is cached state that can drift from the notes on disk.

The design behind it is written up in [Travel module: design & implementation plan](../design/travel-module-plan.md); where the shipped code narrowed that design, this page describes the code and the plan doc's status header records the difference.

> APERtrail's folder defaults match the layout of the [sample vault](../design/sample-vault.md): `Trips/`, `Places/` and `CRM/` at the top of your vault. Nothing is created until you create it, and pointing the plugin at a hierarchy your vault already has stays a deliberate act, done in the settings tab.

## Entities

APERtrail defines ten fixed `type:` values (`src/vault/entity-types.ts`), all lowercase and unquoted:

| `type:` | Entity | Notes |
|---|---|---|
| `trip` | Trip | One note per trip; the only non-reusable entity |
| `booking` | Booking | One note per booked thing, belonging to a trip. A fact about a trip rather than a place: no coordinates, never an itinerary stop, see [Money](#trip-budgets-and-bookings) |
| `country` | Country | Top of the geographic hierarchy |
| `state` | State | Optional first-level division (state, province, canton, ...) |
| `city` | City | A city or town, under a Country and optionally a State |
| `accommodation` | Accommodation | Somewhere you stayed or plan to stay |
| `fnb` | Food & Beverages | Restaurant, cafe, bar, pub, fast food |
| `landmark` | Landmark | A point of interest worth visiting |
| `location` | Location | Catch-all for anything that is none of the above three |
| `photospot` | Photo spot | Somewhere you go to make a specific picture, see [Photo spots](#photo-spots) |

Accommodation, FnB, Landmark, Location and Photo spot share one implementation (`TravelPlace`, discriminated by a `kind` field) because every field except a few subtype-specific extras is identical, see `src/vault/types.ts`. A photo spot's photography fields hang off a single nullable `photoSpot` member rather than being spread flat across a shape the other four never fill in.

Person and Company are deliberately **not** among these ten, and their values are not fixed at all: they are whatever `personTypeValue` and `companyTypeValue` hold. APERtrail owns no contact registry, so a vault that already keeps people somewhere, under whatever word it already uses, keeps them exactly where and as they are. See [People a trip can be shared with](#people-a-trip-can-be-shared-with).

## Folders

APERtrail is laid out in **three modules**, each of which moves as a unit: Trips, Places and CRM. English defaults (`src/settings/defaults.ts`), with the German-locale defaults a German install seeds instead:

```
Trips/                      one note per trip
Places/                     everything a trip can point at
  Countries/ States/ Cities/
  Accommodation/ Food & Beverages/ Landmarks/ Locations/ Photo Spots/
CRM/
  People/ Companies/
```

| Setting | English default | German default |
|---|---|---|
| `rootFolder` | empty, the vault root | empty, the vault root |
| `tripsFolder` | `Trips` | `Reisen` |
| `placesFolder` | `Places` | `Orte` |
| `countriesFolder` | `Places/Countries` | `Orte/Länder` |
| `statesFolder` | `Places/States` | `Orte/Bundesländer` |
| `citiesFolder` | `Places/Cities` | `Orte/Städte` |
| `accommodationFolder` | `Places/Accommodation` | `Orte/Unterkünfte` |
| `fnbFolder` | `Places/Food & Beverages` | `Orte/Essen & Trinken` |
| `landmarksFolder` | `Places/Landmarks` | `Orte/Sehenswürdigkeiten` |
| `locationsFolder` | `Places/Locations` | `Orte/Sonstige Orte` |
| `photoSpotsFolder` | `Places/Photo Spots` | `Orte/Fotospots` |
| `crmFolder` | `CRM` | `CRM` |
| `personsFolder` | `CRM/People` | `CRM/Personen` |
| `companiesFolder` | `CRM/Companies` | `CRM/Firmen` |

`rootFolder` is an **optional common parent** above all three modules, and it defaults to empty, meaning the vault root. A fresh install therefore lands on exactly the tree above, at the top of the vault. Set the root to `Resources/Travel` and all three modules move underneath it in one step, which is the whole reason it exists: a vault that keeps everything under a numbered PARA folder should not have to repoint fourteen paths by hand.

The German Locations default is `Orte/Sonstige Orte` rather than `Orte/Orte`, because `Orte` is the Places module root in German and a folder cannot sensibly be named after its own parent.

Every sub-folder default is **derived from its module root**, not an independent literal. That is what lets a module relocate as a unit, and it is why a German install cannot end up with a stray English folder beside a translated one. Once a path is saved it is independent: moving a module root later does not rewrite the children. A sub-folder introduced by a *later* version of the plugin does land under the root you chose, since that is your answer to "where does this module live" and it applies to folders that did not exist when you answered.

CRM is the one module whose `type:` values are settings rather than fixed words, because these are usually folders your vault already had: `personTypeValue` and `companyTypeValue` are matched against whatever your notes say. APERtrail creates Person and Company notes and never edits them again, exactly as it treats the travel types.

A note counts as an APERtrail entity only when it is **both** under the matching folder **and** carrying the matching `type:` value (`typePropertyName`, default `type`). A `type: fnb` note sitting in the Landmarks folder is read as nothing at all. There is no folder-based fallback and no cross-folder search, which is what makes the [entity type health check](#entity-type-health-check) worth running.

## Frontmatter the reader actually uses

Every property name below is a setting (`src/settings/types.ts`), shown at its English default. Frontmatter is read defensively throughout: absent means unset, numeric-looking values are accepted as numbers or strings, and wikilink-shaped values are resolved to their link target.

| Property | On | Read as |
|---|---|---|
| `country` | Trip, State, City, all five place types | Wikilink to a Country note |
| `state` | City | Wikilink to a State note |
| `city` | all five place types | Wikilink to a City note |
| `capital` | Country, State | Wikilink to a City note |
| `states` | Country | List of State wikilinks |
| `cities` | State | List of City wikilinks |
| `geoLocation` | City, all five place types | A two-element `[latitude, longitude]` list; anything else reads as unset |
| `address` / `website` | all five place types | Free text, read-only; nothing writes them |
| `visited` | City, all five place types | Boolean (`true`/`false`, or the strings) |
| `lastVisit` | City, all five place types | Date-like |
| `rating` | Trip, all five place types | 1 to 5, numeric |
| `departure` / `return` | Trip | Date **and** time |
| `travelType` / `reviewStatus` | Trip | Free-text strings |
| `travelStatus` | Trip | One of `Planned` / `Booked` / `Over` / `Cancelled`; anything else is treated as absent |
| `persons` | Trip | List of wikilinks to Person notes |
| `cities` | Trip | List of wikilinks to City notes, the trip's geographic scope |
| `stops` | Trip | The itinerary, each stop optionally with what it costs |
| `nights` | Trip | Accommodation stays, each optionally with what it costs |
| `transport` | Trip | Legs, each with where it goes and optionally what it costs |

Every one of those three lists takes the same four money sub-keys on an entry: `cost`, `currency`, `costUnit` and `persons`. See [Two people, two tickets](#two-people-two-tickets).

Three fields are read at fixed, non-configurable names because they are subtype-specific rather than shared: `accommodationType`/`accommodationStatus` on Accommodation notes, and `fnbType` on FnB notes.

Photo spot notes carry their own set on top of the shared place shape, every name of them a setting: `timezone`, `openingHours`, `entryFee`, `accessibility`, `parking`, and the three list properties `transit`, `motifs` and `samples`. See [Photo spots](#photo-spots).

`createdProperty` is written once, by every creation modal, directly after `type:`, and never rewritten afterwards. `modifiedProperty` is written by every edit of an existing note: a Trip editor save, a photo spot edit, and an applied entity type health-check suggestion.

**Datetimes are read with their time intact, and written quoted.** Obsidian's YAML parser turns an unquoted `2026-02-13T09:00` into a native `Date`, and reading a `Date` back through the generic date reader truncates it to a calendar day, which silently discarded the time from every `departure:` in a real vault before this was found. Trip and stop times go through `readDateTimeLike()`, and everything APERtrail writes is quoted so it round-trips as a string.

### Visits are derived from trips

Nothing in APERtrail writes `visited:` or `lastVisit:`. A City or place counts as **visited when a finished trip stops there**: a stop on an `Over` trip is direct evidence of a visit, and it already lives in the vault (`src/vault/visit-derivation.ts`).

The rules, in full:

- Only trips whose *effective* status is `Over` count. A `Planned` or `Booked` trip is an intention; a `Cancelled` one is evidence of the opposite. Because status itself falls back to the trip's dates, a past trip with no status typed into it still counts.
- The visit date is the stop's own `from` time, falling back to the trip's `return` and then its `departure`. A stop with no date anywhere still registers as a visit, just an undated one.
- **An explicit `visited: true` always wins**, and an explicit `lastVisit:` is folded in alongside the derived dates rather than replaced. Somewhere you visited long before you started tracking trips has no trip to derive from, and that hand-written history must survive.
- The most recent date across all sources wins.

Deriving rather than writing is deliberate. Stamping the evidence onto every place note would mean the plugin editing notes nobody asked it to edit, as a side effect of editing a *different* note, and it would go stale the moment a trip's dates or stops changed. This is the same call the [travel status fallback](#travel-status-and-what-happens-without-one) makes, for the same reason.

Country carries no `visited`/`lastVisit` of its own. A Country counts as visited when any City or place that references it directly via `country:` is visited, including derived visits, and its last visit is the latest such date (`src/places/country-visited.ts`). A place that reaches a country only through a State is not counted.

### Relationship resolution

Country, State and City form a genuine cycle rather than a strictly layered chain, so `readTravelBoard()` builds them in two passes: skeleton objects first, then a second pass that mutates in the resolved cross-references once every skeleton exists. Places and trips only ever reference Country and City, so they resolve in one pass afterwards, and trips resolve last of all because their stops point at cities and places.

Matching is **by note title (filename)**, not by path, and an unresolved wikilink is simply `null` rather than an error. A `country: "[[Elbonia]]"` with no matching Country note leaves that card's country meta row blank and nothing else breaks.

## People a trip can be shared with

The Trip editor's "who came along" field offers every note that is **under the configured People folder** (`personsFolder`, default `CRM/People`) and **carries the configured person type value** (`personTypeValue`, default `person`, read under the same `typePropertyName` everything else uses). `src/crm/persons.ts` owns this as a thin projection over `src/crm/read-crm.ts`, so the dropdown and the CRM dashboard can never disagree about who counts as a person.

An optional tag filter narrows the list further. `eligiblePersonTags` is a comma-separated list matched against the note's `personTagProperty` (default `tags`), and that property is read tolerantly, accepting both the array shape Obsidian's property editor writes and the comma-separated string a hand-edited note can end up with. **An empty tag filter means no filter**, so a vault that never touches the setting sees every Person rather than none. Getting that default backwards would produce an empty dropdown with no explanation, which reads as a broken plugin rather than an unset setting.

Reading rather than owning is the point. People are notes you already keep, in a folder you point at, so a vault with an established way of filing them keeps it and APERtrail stays a consumer. **New person** writes one more note in the shape that folder already uses and then leaves it alone; it does not make APERtrail the owner of your contacts. Companies sit beside People on exactly the same terms.

## Trips

A Trip is the one entity with real structure, and the one with an edit surface. Every other type is create-then-hand-edit, whereas a trip is built up while it is planned and filled in again after it happens.

### What a Trip holds

Beyond a country and two dates, a Trip note carries:

- **`persons:`** who came along, as wikilinks to Person notes.
- **`cities:`** the Cities the trip touches, as the trip's geographic scope. Separate from the itinerary, because a trip can pass through a city without that being a stop worth timing.
- **`stops:`** the itinerary. Each stop is a place, an optional start and end time, an optional note, an optional 1 to 5 rating for that visit specifically, and optionally what it costs. A stop may say **which day of the trip** it is on (`day: 3`) instead of naming a date, and may name **no place at all** -- a time and a sentence is a whole entry. See [an itinerary before its dates](#an-itinerary-before-its-dates) below.
- **`days:`** what each day of the trip is called and the paragraph it carries. Sparse: only the days that say something have an entry.
- **`nights:`** accommodation stays, each an Accommodation note plus check-in and check-out dates, and optionally what the stay is expected to cost. Omitted entirely on a day trip.
- **`transport:`** the journey out and the journey back, each with a mode, times, where it departs from and arrives at, who is running it, an optional reference and optionally what it is expected to cost. Also omitted when empty. The stored `direction:` values are `outbound` and `inbound`: **outbound** is the leg away from where you started, **inbound** is the leg home. The UI labels them "Outward journey" and "Return journey" (German *Hinweg* / *Rückweg*), because "inbound" reads as *toward the destination* to about as many people as it reads as *toward home*.

A leg's `origin:` and `destination:` are written as typed, and a wikilink is
read down to its target, so `[[Zürich]]` and `Zürich` both arrive as Zürich and
the renderer links the ones the vault has a note for. Most airports never will,
and a leg that insisted on a note for Pretoria would be a leg nobody fills in.
`carrier:` is read the same way, and holds the airline, the railway or the
train's own name -- Swiss, Edelweiss, Rovos Rail. It is separate from `mode:`
because the mode is what kind of thing it is and the carrier is which one: two
flights on the same day are both `plane` and only one of them is the Edelweiss
you have to be at the right terminal for.

The itinerary row leads with the route, "Zürich to Pretoria", and puts the
direction, the carrier and the reference under it: "Hinreise · Swiss · LX288".
Each is omitted when the leg does not say it.

Optional fields are omitted, never written empty. A day trip's note carries no `nights:` or `transport:` key at all rather than two empty lists.

A stop's `place:` may point at a **City or any of the five place types**, in one list. This is deliberate: "arrived in Basel at 10:00, ate at the Gifthüttli at 12:00" is a single itinerary at two levels of zoom. Where a City and a place share a title, the City wins, a documented tie-break rather than an accident of lookup order.

Stops are stored and rendered **in list order, never re-sorted by time**. An untimed stop has no other way to say where in the day it belongs, and the order you entered them in is itself information.

### An itinerary before its dates

The first thing you write down about a trip is what happens on day one, day
two, day twelve, with no idea yet which calendar days those are. So a stop, a
stay and a leg may each say **which day of the trip** they are on instead of
naming a date:

| Item | What it says | |
|---|---|---|
| a stop | `day: 3` | Its `from:` and `to:` are then bare times, `"09:00"` |
| a stay | `checkInDay: 3`, `checkOutDay: 5` | Two nights, priced as two nights |
| a leg | `day: 0`, `toDay: 1` | An overnight flight leaving the evening before day one, printed as `Tag 0 · 20:30 - 10:00 +1` |

Each editor has a **Day of the trip** field; fill it in and the date inputs
give way to plain time inputs, because the date is then whatever the day number
says.

**Set the trip's departure and every day resolves to a date.** Day 1 is the
departure day. Nothing in the note is rewritten -- it goes on saying `day: 3`
-- so moving the departure by a week moves the whole trip, and the itinerary
keeps the shape you designed it in. Day headers read "Tag 3" while the trip has
no dates and "Tag 3 · 4. November 2026" once it has.

Day numbers may be 0 or negative, for a leg that leaves before the trip starts.
A per-night cost counts its nights from the two day numbers, so a budget works
before there are any dates at all.

Mixing is fine and nothing has to be migrated: a trip written before this
existed names its own dates and goes on working exactly as it did. Where an
item somehow says both, **the day number wins** -- it is what marks the item as
relative in the first place. [Relative days](../design/relative-days.md) has
the reasoning.

### A day of a brochure

A tour operator's day is a heading and a handful of timed sentences:

```
1. Tag: Pretoria
14.00 Uhr: Check-In an der Rovos Rail Station in Pretoria.
15.00 Uhr: Abfahrt des Zuges, zunaechst Richtung Sueden.
16.30 Uhr: Der Nachmittagstee wird im Beobachtungswagen serviert.
```

Two things make that possible, and both are optional everywhere else.

**A stop may name no place.** A stop needs a place *or* a note, not both, so a
line that happens on a moving train is just a time and a sentence. An entry
carrying only a time is still dropped -- it says nothing. In the editor, leave
the place empty, or clear one with the X beside the picker. A place still earns
you the link, the visit derivation and the cost chips, so name one where there
is one to name.

**A day may be named.** The pencil on a day's header sets its **name** and a
paragraph **about the day**, kept in a sparse `days:` list on the trip:

```yaml
days:
  - day: 1
    title: Pretoria
  - day: 4
    title: Seetag
    note: Ein Tag an Bord, ohne festes Programm.
```

Only days that say something have an entry, and clearing both fields removes
it again.

The day header also carries **insert a day before this one** and **remove this
day**. Removing takes out the stops on that day and moves every later day up --
so cutting day 2 turns a stay of Tag 1 → Tag 3 into Tag 1 → Tag 2, two nights
becoming one. **A stay or a flight is never deleted**: one that touched the
removed day keeps its number, which now points at the following day, so nothing
you booked disappears because the plan changed. The header then reads "1. Tag: Pretoria · 2. November 2026", and the
document prints the name and the paragraph above that day's lines.

**A named day with nothing booked on it still appears** -- day four of a cruise
is a real day. It slots in by number without moving anything that has stops.

### Editing: two surfaces, split by scope

**The trip's own fields** (title, country, cities, dates, type, status, review status, rating, and who came along) are edited in the **Trip editor**, reached from New trip, a trip card's menu, or the itinerary block's footer. It saves through `processFrontMatter()` so the note body survives untouched, and clears only the keys the Trip schema owns; an `icon:`, an `image:`, a hand-added `created:` are all left exactly as they were.

**The itinerary itself** (stops, accommodation stays and transport legs) is edited **in the trip note**, from the itinerary block. Each row has edit, reorder and delete actions; each day has its own "+ Add stop" that pre-fills that day's date; Transport and Nights each have their own add button. Every one opens a dialog you can read at a glance rather than one form for the whole trip.

That split exists because the first version put everything in one modal, and it did not survive contact with a real trip: every stop, night and leg rendered as a run of form rows in a single dialog that re-rendered wholesale on each change, so a ten-stop trip meant roughly fifty rows and a modal taller than the screen. Editing one item at a time, from the itinerary you are already reading, keeps every dialog the same size however long the trip gets, and it is where you are looking anyway when you want to add a stop.

Every itinerary edit still writes the **whole** trip back through one save path, rather than patching its own slice. A trip is a handful of small lists, so the redundant write costs nothing, and it means there is no partial write that could leave frontmatter half-updated.

The block **redraws itself when the note changes**, so a stop you just added appears immediately. It has to listen for that rather than redraw when the save resolves: `processFrontMatter()` resolves once the file is written, but `metadataCache` catches up asynchronously afterwards, so a redraw fired from the write's own `.then()` reads the frontmatter as it was *before* the edit. The renderer is therefore a `MarkdownRenderChild` registered with `ctx.addChild()`, subscribing to `metadataCache.on('changed')` for its own path, which also means an edit you make by hand in the frontmatter shows up in the block without reopening the note.

Two behaviours worth knowing. **Retitling is not part of either surface**: a trip's title is its filename, and renaming is a file rename. And a stop whose place link never resolved is **kept, not dropped**, when you edit something else on the trip: an unrelated edit must not delete a row you can still see.

### Pictures: uploading them, and putting them in order

**A picture that is not in the vault yet can be uploaded from either field.** The
hero image has an upload button beside its picker, and the gallery has one in
its heading that takes several files at once.

**Obsidian decides where they land, not this plugin.** The upload goes through
`getAvailablePathForAttachment()`, which reads the vault's own
`attachmentFolderPath` setting, resolves it against the note the picture belongs
to, and returns a path nothing occupies. A vault set to `./_resources` -- the
Obsidian default of "a subfolder next to the note" -- therefore files a trip's
picture inside that trip's own folder, with no convention of APERtrail's
involved. A vault that files every attachment in one central folder gets that
instead. Asking a second time would be the same mistake as asking for the
interface language twice, and the collision suffix on a second `IMG_1234.jpg` is
Obsidian's own, so it matches every other attachment in the same vault.

This does not change the older rule: **a picture already in the vault is
referenced, never moved.** A photo lives where its owner filed it. An upload is
the different case, of a file that has never been filed anywhere.

Uploads are appended, never replacing what is there, and arrive with no caption:
a filename is not a caption, and prefilling one would mean deleting `IMG_4821`
from fourteen boxes.

**The gallery shows the pictures.** Each row is a thumbnail, its caption, and
buttons to move it up, move it down, pick a different file or remove it. It used
to be two text boxes -- a path and a caption -- which made the questions somebody
actually has about a gallery unanswerable: which of these is the dining car, and
is this the one I meant? Reordering a list of filenames you cannot see is barely
better than editing the YAML, so the reorder buttons and the thumbnails arrived
together; either without the other is half a feature.

Up and down rather than dragging. It matches the itinerary's rows, and dragging
is worse with a finger than with a mouse -- this plugin has already shipped one
input that did not work on the iPad. The one thing lost with the path box is
typing a path by hand, which is what the note's own frontmatter is for.

### Duplicating a trip

The same journey often exists twice: a twelve-day version and a shorter one over
the same ground. **Duplicate** on the itinerary block's footer copies the trip
into a new one you name, and the cutting down is then the ordinary editing --
`Remove day` renumbers everything after the cut, so taking a twelve-day
itinerary down to nine is three clicks rather than forty edits.

**The copy is a plan, not a record.** The route comes across whole: the days
with their titles and paragraphs, the stops, the stays, the transport, the
budget, the highlights, and the note body including the overview. What does not
come across is `departure`, `return`, `travelStatus`, `reviewStatus` and
`rating`.

That is not tidiness. **A trip's stops derive visits on the places they name**,
so a copy carrying `travelStatus: Over` and last month's dates would claim you
had been to Kimberley twice and would move the last-visit date on every place on
the trip. Nothing would error; a dashboard would just quietly say something
untrue. The status is left absent rather than set to `Planned`, because a trip
with no status and no dates already reads as Planned and nothing derived is
written back.

**The day numbers survive, which is what makes this worth doing before the dates
exist.** The copy is a twelve-day itinerary with no calendar against it. Give it
a departure and the whole thing resolves at once.

**Bookings are never copied.** A booking is a record of money actually
committed, and a second copy of one flight reads as a second flight bought,
counted as spent on a trip that has not happened. The itinerary's own `cost`
estimates *do* come across with the frontmatter, so the copy still says what it
is planned to cost -- which is the figure a copy wants anyway. **Exports are not
copied either**: they are renderings, remade from the note in one click, and a
copy carrying the original's document would carry the original's name inside it.

**Pictures are copied, not shared.** Every picture the original keeps in its own
folder is copied into the copy's, and the new note's `image:` and `gallery:`
point at its own files, so deleting one trip never empties the other's brochure.
A picture named anywhere else -- an external URL, or a file the vault keeps in a
shared attachments folder -- is left exactly as written, because sharing it was
the point. A trip still flat in `Trips/` owns no folder, so nothing of its is
copied and both notes go on naming the same files.

### Travel status, and what happens without one

`travelStatus` is a fixed vocabulary, `Planned` / `Booked` / `Over` / `Cancelled`, and unlike every property *name* in the plugin these *values* are not configurable, because the dashboard's counts, trip ordering and next-trip countdown all key off the exact strings.

A trip with no `travelStatus` at all gets one **derived from its own dates**: a trip whose return date has passed reads as `Over`, anything else as `Planned`. A trip ending today is still current, not over. Without a return date the departure is used instead; with no dates at all the answer is `Planned`. This is a read-time fallback and nothing is written back to the note. Without it, a hand-written trip note simply vanishes from the dashboard's Trips section and counts for nothing in the stats.

The derivation is deliberately asymmetric. A past trip is definitively over; whether a future trip is `Planned` or `Booked` is a fact about the world that no date can reveal, so the optimistic half of the guess is the weaker one. Setting the field explicitly always wins.

### The itinerary block

A Trip note created by the editor gets a `travel-itinerary` fenced code block in its body, which renders the trip's own itinerary as a timeline grouped by day: time gutter, entity icon, linked place, rating, note, with transport and nights as their own bands below and the participants along the top.

It is a code block rather than a dedicated view because it re-computes on every render and so can never go stale, it works in reading mode, and it sits directly above whatever prose you have written about the trip. Nothing is duplicated: the frontmatter is the data, the block is a lens on it.

An unresolved stop link renders as unresolved rather than being omitted, so a typo looks like a typo instead of a deletion. A note with no block still works everywhere else; the block is presentation, not storage.

The block takes no arguments. It renders the trip it is *in*, found from the rendering context's own file path.

### Related trips, on the other end

The reverse of an itinerary: a `travel-related-trips` block in a City or place note lists every trip that stopped there, most recent first, with each visit's time, note and rating. New City and place notes get one automatically; Country and State notes do not, since a stop never points at either.

The same block in a **Person** note answers the other reverse question: which trips that person came along on. The answer already exists in each trip's `persons:` list, so this needs no new data either. New Person notes get one automatically; Company notes do not, since nothing links a trip to a company.

A person's rows carry no per-stop lines. Being on a trip is a fact about the whole trip, not about any one stop on it, and inventing a stop line per person would claim a precision the data does not have. Notes that predate the feature keep no block until you paste one in: nothing in APERtrail rewrites notes the vault already owns.

It stays one block, and keeps the `travel-related-trips` spelling, because it is the same question asked of one more kind of note rather than a new feature wearing the old name.

Trips are ordered by date regardless of status, so an upcoming booked visit sits alongside past ones. On a place note, "when was I last here" and "when am I next here" are the same question asked from two directions, and splitting them by status would hide whichever answer you were not looking for.

A trip that stops at the same place twice in a day gets both rows, not one. The per-visit notes are the most useful thing on the block, and collapsing them would lose exactly that.

This is a second block rather than a polymorphic one, because the two answer opposite questions and a block whose meaning changed depending on which note you pasted it into would be a puzzle rather than a feature.

## Trip costs and bookings

A **booking** is one purchase that belongs to one trip: a flight, a hotel
stay, a museum ticket. One note each, under `Trips/Bookings`, carrying what it
cost, which trip it belongs to, who paid, who it was for, and a link to the
confirmation file in your vault. It is the tenth entity type and the only one
with **no block of its own**: every field on it is a plain property or a list
of links, so Obsidian's own property editor is already the right editor.

The trip note grows an `apt-trip-costs` block, seeded into every new trip
beside the itinerary one. It shows:

- **Planned, committed and paid**, as three figures with the gap between them.
  Planned is the trip's `budget:`, a ceiling per category. Committed counts
  estimates, bookings and payments alike, because a budget that only counts
  what is already booked reads as comfortable right up to the moment it is
  not. Paid counts what has left the account.
- **A document of every booking**, rendered through the same invoice renderer
  CULItrail uses for its orders, with a subtotal per category and the budget
  beside the computed total rather than instead of it.
- **The settlement**: what each participant paid, what they used, and the
  shortest set of transfers that squares it. Derived on every render and
  written into no note, so it cannot go stale.
- **Actions**: add a booking, edit the budget, edit the rates, export the
  sheet.

### What the money will not do

- **Currencies are never summed.** A trip with francs and euros has two
  totals. A single converted figure appears only where the trip itself carries
  a rate you typed, and it is always shown with that rate.
- **No rate is ever fetched.** Not on load, not on demand, not cached.
- **A total over bookings nobody has priced is nothing at all**, not zero. An
  unpriced booking and a free one are different facts.
- **A cancelled booking counts nowhere**; a refunded one counts as zero and
  stays on the sheet, because the reference the money came back under is worth
  keeping.

### Costs on the itinerary

A stop, night or leg that a booking points at carries a cost chip, per
currency, and an icon that opens the confirmation. A stop or a night is
matched by its place; a transport leg by the reference both sides already
carry, since `legReferenceField` exists and a booking reference is exactly
what people type into it.

### Currencies

Every money field is a dropdown over a short configured list, `CHF, EUR, USD`
to begin with and editable in settings. It is deliberately not the 180 ISO
codes: a vault spends in two or three. Two things are always offered on top of
the list, so it can never lock you out of your own money: your home currency,
and whatever the field already holds. That second one is what lets a booking
in ZAR be opened, saved, and still be in ZAR.

On a cost field the empty option means the trip's own currency, which is what
a single-currency trip should pick every time: nothing.

### Two people, two tickets

Every priced line also says **who it is for** and **what its figure is per**,
because a trip with two people needs two flights and one room.

`persons:` on a stop, a night or a leg names the people it is for, as
wikilinks, exactly like a booking's `for:`. **Leaving it out means everybody
on the trip**, which is the common case and never has to be typed; the editor
offers the trip's own participants as tick boxes and writes nothing when they
are all ticked, so a fourth person joining later joins every line that never
disagreed with the trip. Naming people is worth the typing because it is the
same list a booking needs for the split, so **Book this** hands it straight
over.

`costUnit:` says what the number means, in four fixed values:

| Value | Multiplied by | What it describes |
|---|---|---|
| `total` | 1 | The whole line, as quoted |
| `person` | people on the line | A ticket, an entry, a seat |
| `night` | nights of the stay | A room per night, whoever is in it |
| `personNight` | people x nights | A bed in a dorm, a half-board supplement |

A note that says nothing reads as `total`, because a bare number somebody
typed must not silently multiply into something bigger than they meant. The
editors open on the unit that kind of line is normally quoted in: per person
for a journey or a stop, per night for a stay.

The arithmetic is redone on every render and written nowhere, so the row shows
its working: the chip carries the computed amount and its tooltip carries the
sum, `CHF 890.00 per person x 2`. A line that names a subset of the trip also
carries a travellers chip, since being a subset is the exception.

Deliberately not inferred: the words **single room** and **double room**. Two
people on a stay can be one double or two singles, and the plugin cannot know
which. It says how many people the stay is for and lets the price you looked
up say the rest.

### Estimates, before there is anything to book

The moment a trip gets priced is the moment before there is anything to book:
you lay the flights and the hotel out, you look up what they cost, and two
weeks later you actually book them. So a **stop, a night and a leg each carry
a cost of their own**, and it means "this is what I expect". A stop's cost is
the museum entry, the guide, the cable car; it lands in the activity
category. They count as committed in
the totals and appear in the cost sheet as estimates, because a budget that
only counts what is already booked reads as comfortable right up to the moment
it is not.

An estimate is shown as a **dashed chip**, never as a receipt, and every row
without a booking yet grows a **Book this** action: it opens the booking dialog
with the trip, the category, the figure and the line's own reference or
accommodation already filled in. Filling those in is what makes the new booking
**take the estimate over** -- the same reference match the cost chips use --
so the moment it exists the estimate stops counting and the real figure takes
its place. Nothing is deleted: the leg keeps its estimate, which is what makes
plan against actual readable per line rather than only in total.

The rule has one hole, stated rather than hidden: an estimate on a leg with no
reference cannot be matched to anything, so a booking made for it leaves both
figures standing. The block shows an estimate as an estimate, so two figures on
one row is visible rather than silent.

An estimate is deliberately **not** money anybody spent: it names no payer and
nobody it is for, so the settlement ignores it entirely.

### The cost sheet

The block's **Cost sheet** button writes `<Trip> cost sheet.html` into the
trip's `Exports` folder: the summary, every booking and surviving estimate,
the totals and the settlement, laid out for A4 and reaching the network
nowhere. It is what gets sent to the other people who went, and it shares its
paper with the photo spot field sheet and the trip document.

A trip still flat in `Trips/` has no folder of its own, so its sheet lands
beside the note exactly as it always did. `tripExportsSubfolder` is the folder
name; blank writes every sheet beside the note instead.

### The trip document

The itinerary block's **Trip document** button, or *Export this trip as a
document* from the command palette inside a trip note, writes
`<Trip> document.html` into the same `Exports` folder. It is the
trip as somebody who is coming would read it, in the order a tour operator's
own brochure uses:

| The page | Where it comes from |
|---|---|
| Title | The note's own name |
| Subtitle | `subtitle` |
| A photograph across the top | `image` |
| Highlights | `highlights`, one per line |
| The trip in brief | The `> [!SUMMARY]+` callout in the note body |
| Day by day | `stops`, grouped and numbered by day |
| Getting there and back | `transport` |
| Where you stay | `nights` |
| What it costs | `budget`, and the itinerary's own estimates where it has none |
| Pictures | `gallery`, with each caption |

Every section a trip says nothing about is left out rather than printed empty,
so a trip with no gallery has no empty gallery heading.

**It is one file.** Every picture is downscaled and written into the page
itself, so the document opens with its pictures wherever it is copied to --
another machine, a phone, an attachment -- with nothing that has to travel
alongside it. That costs size: a gallery of twenty pictures makes a file of a
few megabytes. A picture given as an external URL stays a URL, because there
are no bytes in the vault to inline; a picture that cannot be read prints its
caption over an empty frame rather than disappearing.

**Transport and stays are their own sections, not lines inside the days.** The
day-by-day is the trip itself, day one to the last day, which is what a
brochure describes and what somebody decides on. Flights are settled later, and
once they are concrete the outbound one usually leaves the day *before* day one
and the return lands the day after the last. So a leg says which days it spans
-- "Tag 0 → Tag 1" -- and a note under the heading explains what a day outside
the trip means, shown only when one is actually used.

It states the **plan**, not the ledger: the prices are the trip's budget, and
the itinerary's own estimates for whatever the budget does not name. What has
actually been spent is the cost sheet beside it.


## Photo spots

A photo spot is a place you go to in order to make a specific picture. It
is the fifth place type, so it shares the whole place shape with the other
four, and everything below is what it adds. See
[Photo spots](../design/photo-spots.md) for the design.

### Motifs

A spot carries a list of **motifs** under `motifs:`, one entry per picture
you came for. At most one is the `main` motif, the one the spot is named
for; the rest are `secondary`. Each motif has a name, optionally its own
coordinates, the bearing you shoot **toward**, the light it wants, a
season, a lens, gear, a technique note and a where-to-stand note.

Motifs are a list rather than a `mainMotif`/`secondaryMotif` pair because
real spots have one to five of them, and because a motif can sit a long
way from the note's own coordinates: the source location guide's Neuchatel
page has its secondary motif nine kilometres down the lake from the castle
it is named for. Where a motif carries coordinates, the block shows how far
and in which direction it lies from the spot's anchor.

`direction` is written in degrees. A compass point is accepted on read, in
English or German (`SW`, `ONO`), and normalized to degrees the next time
the entry is saved, so a hand-written note is not punished for it.

### Captured is not visited

Each motif carries its own `captured` flag, separate from the note's
`visited`. Being at a spot is not getting the picture, and the two come
apart constantly: you drive to the jetty, it rains, you have visited it and
captured nothing. `captured` is what lets a card say *1 of 2 captured* and
what the Places dashboard's third stats tile counts.

Nothing but a person ever sets it. A finished trip that stops at a spot
still derives `visited`, as it does for every place type, but it never
touches `captured`: the plugin must not claim a picture exists.

### Light

A motif names the light it wants from a fixed vocabulary, in day order:

`blue-hour-morning`, `sunrise`, `golden-hour-morning`, `day`, `overcast`,
`golden-hour-evening`, `sunset`, `blue-hour-evening`, `night`

These are property **values**, so they are not configurable and they stay
English identifiers in the note whatever language you read them in. Only
the labels are translated. A German vault that wrote
`goldene-stunde-abends` into its notes would be unreadable by the same
vault switched to English, which is the same trap `travelStatus` avoids.

`overcast` is a member with no clock window attached, because "any time, as
long as the sky is flat" is a real answer for waterfalls and forests.

### Sun times

`trail-core`'s `sunTimes()` computes sun position and the day's light
boundaries from a coordinate and a date, and `src/places/solar.ts` names
the windows between them. No network, no API key, no weather: it is
arithmetic. Blue hour runs from -6 to -4 degrees of solar elevation, golden
hour from -4 to +6, sunrise and sunset at -0.833 (refraction-corrected),
day above +6. The transit and the rise/set solves are both iterated rather
than approximated, and agree with published tables to within a minute at
mid-latitudes.

What that buys, inside the `apt-photo-spot` block: every light chip carries
the clock window it means on the shown date, a date stepper walks through
days, a panel lists the whole day's boundaries, and a motif with a
`direction` gets a front, side or back light badge from the sun's azimuth
at the middle of its first window.

Two limits are stated in the UI rather than hidden. This is geometry, not
weather: it knows where the sun is, not whether you will see it. And it
assumes a flat horizon, so a spot in a valley loses its golden hour to the
ridge line and no formula knows that. The motif's own note field is where a
human writes *the sun clears the ridge about 40 minutes after sunrise*.

Polar day and polar night are reported as such rather than as missing
times. Everything sun-related sits behind one setting, `sunTimesEnabled`.

### The photo spot block

A new photo spot note gets an `apt-photo-spot` fenced code block above its
related-trips block. It renders a one-line answer to
"when next", the motif cards, the sample frames, the day's light as a band
with hour ticks and a legend above the figures it resolves to, and an
access band with parking, transit rows by mode, opening hours, entry fee,
accessibility and website. The light panel says which zone and which
coordinates it is computing for, because `timezone:` is optional and a spot
abroad rendered in the reader's own zone looks entirely plausible while
being hours out.

It is also where motifs and samples are added, edited, reordered, deleted
and ticked off as captured, because that is where you are already looking
when any of those become true. Every edit reads the whole spot, changes one
thing and writes it all back through one save path. The access details are
deliberately not edited here: they are flat scalars that Obsidian's own
property editor handles well, and a second editor would be a second thing
to keep in step.

**The field sheet.** A button in the block, and a command that only appears
inside a photo spot note, write the spot out as a single self-contained HTML
file beside the note: `<Spot> field sheet.html`. It carries the motifs with
their bearings, light windows resolved to clock times, gear and technique,
the sample frames inlined as images, the access details, and the day's sun
figures, laid out for A4 with the capture state as a box to tick with a pen.

It is written for the date the sun panel is showing rather than for today,
so stepping to the morning you are actually going and exporting from there
gives you that morning's times. Sample images are scaled down on the way in,
because a sheet with four straight-from-camera frames would be a file nobody
can send anywhere. Nothing in it reaches the network, so it prints and reads
on a phone with no signal, which is the whole point of carrying it. A sheet
of the same name is overwritten without asking: it is a rendering of a note
rather than a document anybody edits.

HTML rather than PDF, and rather than Markdown. A PDF would mean bundling a
renderer for a page this simple; Markdown would print through Obsidian's own
chrome and would still be a note rather than a sheet.

The block is fenced `apt-photo-spot`, not `travel-photo-spot`. The two
older blocks kept their prefix only because those strings already sit in
users' notes; that cannot apply to a block nobody has written yet. And the
consistency argument points the other way: `travel-itinerary` and
`travel-related-trips` are both about trips and mean nothing without one,
whereas a photo spot note is useful with no trip planned and none ever
taken. Every block added from here on takes `apt-`.

### Photo spots inside a trip

Because a photo spot is a place type, it is a valid itinerary stop with no
extra machinery. Three things build on that (`src/trips/trip-light.ts`):

- **A sun band** behind each dated day of the itinerary, computed at the
  first stop of the day that has coordinates. A day with no located stop
  gets no band rather than a wrong one.
- **Light badges on the stop.** A stop at a photo spot carries the motif it
  is for, that motif's light window resolved to a clock time on the day of
  the stop, whether the sun will be behind you or behind the subject, and
  the lens. Without them a stop at a photo spot looks exactly like a stop at
  a restaurant.
- **A motif per stop.** A stop may name which motif it is for, in a `motif`
  sub-key inside `stops:`. An unmatched name is kept and shown rather than
  dropped, like an unresolved place link.
- **Golden-hour prefill.** Picking a photo spot for a stop that has no
  clock time yet fills in the first light window of the motif the stop is
  for, on that day. A suggestion, never a correction: a stop you already
  timed is left alone, and the editor says which window the times came
  from.
- **A shot list** under the itinerary: every motif at every photo spot the
  trip stops at, ticked or open. Read straight off the spots rather than
  stored on the trip, so ticking a motif off in its own note shows up here
  without a second write. It ticks off from here too, writing `captured`
  into the spot's own note and stamping the day the trip was there when
  that day has already passed.
- **Conflict warnings.** Two stops on the same day whose straight-line
  distance, walked at 4 km/h, takes longer than the gap between them get an
  inline warning naming the other stop. Every pair within the day is
  compared, not only neighbours, since a dinner listed between two evening
  spots does not make them any more compatible; each stop shows one warning,
  the sharpest of its own. Walking speed deliberately: it is the one
  assumption that holds on an island with no rental car, in a city centre
  and on a road-free ridge alike, and it over-warns rather than staying
  silent. Overlapping stops count too, which is the same mistake at its
  sharpest. The warning refuses nothing and reorders nothing, and it says
  out loud that the number is a straight line at walking pace.

## Dashboards

There is one dashboard per module -- Trips, Places and CRM -- each its own view with its own tab, and a chip row at the top of each switches between them. The split is what makes each one readable: the single dashboard it replaced showed eight sections, of which seven were reference data you scroll past to reach the trips.

The ribbon's map icon, or **Open Trips dashboard**, opens the Trips dashboard: the greeting, a New trip button, two stat tiles (trip counts by travel status, and a countdown to the next upcoming trip) and the Trips section.

**Open Places dashboard** opens the other one, which holds everything a trip can point at:

- **Action bar**: a search box (Enter opens the gallery pre-filtered to that query) and a button for every creatable place type, plus Refresh. They run New photo spot, New accommodation, New landmark, New food & beverage, New location, New city, New state, New country: ordered by how often you reach for one, which is roughly the inverse of how high the entity sits in the geographic hierarchy. Photo spot leads, because on a planner whose whole point is photography that is the button reached for first. City and State were commands-only at first, on the theory that they are set up once per country; in practice both turn up mid-planning, because a trip's `cities:` list cannot point at a City note that does not exist yet.
- **Stats row**: three tiles. Countries visited against total, landmarks visited against total, and photo spots *captured* against total. A photo spot counts as captured only when every motif it names has been shot, so a two-motif spot with one frame in the bag is honestly still open; a spot with no motifs written down yet counts in the total and not in the numerator, because there is nothing there to have captured.
- **Eight sections**, each showing up to six cards with a "Browse all" footer that opens the gallery pre-filtered to that type: Photo spots, Countries, States, Accommodation, Landmarks, FnB, Locations, Cities. States sit under their countries and above the cities that belong to them, which is the order the hierarchy reads in.

**Open CRM dashboard** opens the third: a New person and a New company button, three tiles (how many people, how many companies, and how many of those people you have actually travelled with) and a section each. The travelled-with count only counts people named on a trip whose status is `Over`, the same rule that decides whether a place counts as visited: a planned trip is an intention and a cancelled one is evidence of the opposite. Companies have no equivalent, because nothing links a trip to a company.

Both CRM sections are title-sorted rather than ranked. A person has no rating and no last visit, so there is nothing to rank them by that would not be arbitrary.

Per-section ordering (`src/ui/dashboard/travel-dashboard-sort.ts`): Trips come in two tiers, everything still ahead of you (Planned/Booked) soonest departure first, then trips already over, most recent first. Cancelled trips appear in neither, since they neither happened nor are going to; the gallery still lists them, and the section heading counts what the section would show rather than every trip in the vault. Undated trips sort last within their own tier, in both directions. The strip was Planned/Booked-only at first, which read as broken on a real vault: four of five trips were over, so a heading counting five sat above a single card. Countries sort by most-recently-visited, with visited-but-undated between dated and unvisited; the five place types by rating descending, falling back to most-recently-visited; Cities by most-recently-visited alone, since City has no rating.

The next-trip countdown only considers trips whose status is exactly `Planned` or `Booked` and whose departure is today or later. Any other value is ignored rather than counted.

## Travel gallery

One combined gallery over the entity types worth browsing, travel and CRM alike (`src/ui/gallery/travel-gallery-view.ts`):

- A type-filter row: All / Trip / Country / State / City / Accommodation / FnB / Landmark / Location / Photo spot / Person / Company
- Fuzzy free-text search over note titles
- Cards show the note's `image:`, a read-only 1 to 5 star row when the entity has a rating, and an icon-led meta row: country/city hierarchy, visited state or last-visit date, trip dates and status, capital and state/city counts, an Accommodation/FnB subtype, or a photo spot's capture count and its main motif's best light, depending on the entity
- Entries sort by the chosen sort field with title as a stable tiebreak. Unrated entries sort last under "rating" rather than as zero, because "no opinion yet" is not the same claim as one star

Trip cards carry a 3-dot menu with a single **Edit trip** entry. Every other card has no menu at all, and the menu button itself is skipped when a card has no entries. Travel entities are meant to stay reusable across trips rather than move through an active/archive lifecycle, so there is no archive action anywhere.

A facet row sits below the type filter: country, visited or not visited, minimum rating, tag, and a sort control (name, rating, or last visit). Every dropdown is built from the values actually present in the entries currently in scope, so it never offers a filter that would match nothing, and a facet with nothing to offer is not rendered at all. The visited and rating facets appear only when something in scope can carry them, since filtering Countries by visit state would always come back empty.

These facets persist across a type-filter change: "everything I rated four stars or better in Switzerland" is a question worth asking of one type and then another.

With the type filter set to **Trip**, three further facets appear: travel status, review status and participant. The latter two are built from the values the vault's own trips actually carry, and are hidden when there is nothing to offer. Switching the type filter away from Trip clears these three, so a Trip-only filter cannot stay silently applied while invisible.

With the type filter set to **Photo spot**, five more appear on the same terms: light window, season, capture progress, accessibility and whether the spot has sample frames. The light dropdown is offered in the vocabulary's own day order rather than alphabetically, because "blue hour, sunrise, golden hour" is the order a photographer thinks in and sorting it would scatter the morning across the list. These five are cleared on the way out of the Photo spot filter, for the same reason the Trip ones are.

Both dashboards and the gallery are **manual-refresh only**. They redraw on open, on their own Refresh button, and after any creation modal writes a note, but they hold no `metadataCache` subscription. Editing a note by hand and switching back to an already-open dashboard shows the old values until you refresh.

## Entity type health check

**Check entity types** (command palette, or the button on the settings tab) scans the twelve configured folders for notes whose `type:` is missing or disagrees with the folder they sit in, and offers the correct value for each (`src/vault/health/entity-type-issues.ts`).

It also lists four **booking warnings** (`src/vault/health/booking-issues.ts`): a booking whose trip does not exist, an amount with no currency anywhere in the chain, a split naming somebody who is not a participant of that trip, and two bookings sharing a reference. Like the photo spot ones they warn and never fix: which trip a booking belongs to, and which of two notes sharing a reference is the duplicate, are answers only you have.

The same review also lists three **photo spot warnings** (`src/vault/health/photo-spot-issues.ts`): more than one motif marked as the main one, a sample naming a motif the note does not have, and a spot with coordinates but no `timezone:` whose longitude is far enough from this device's own standard offset that its sun times are being computed in the wrong zone. All three are warnings rather than errors, and none carries a fix: which motif is the main one, and what a sample was meant to point at, are answers only the note has. They get an Open button and no Set button.

Each of the twelve folders maps to exactly one entity type, so there is always a confident suggestion and never a guess. There is no "no suggestion available" branch to fall into.

The ten travel folders are checked against a fixed value; the two CRM folders are checked against whatever `personTypeValue` and `companyTypeValue` hold, so a vault whose people notes say `type: Kontakt` is correct rather than broken twelve times over. Clearing a CRM type value skips that folder entirely: with nothing expected there is nothing to suggest, and flagging every note in it would be noise rather than a finding. The two families never judge each other, since a note is only ever checked against the folder it actually sits in.

One rule is worth knowing about. The twelve folders are normally nested under their module roots, and nothing stops you pointing two of them at overlapping paths or at a module root itself, so each file is scored against **every** configured folder it falls under and judged against the **longest** match. Without that, a Landmark note could be judged against a broader, less specific configuration. A folder left blank is skipped rather than treated as the vault root.

The review modal never writes without an explicit click. There is no silent bulk write, applying a suggestion only ever sets the configured type property to a value the scan itself suggested, and "Apply all" needs a second click within four seconds to confirm.

## Commands

| Command | Effect |
|---|---|
| Open Trips dashboard | Opens (or reuses) the Trips dashboard leaf |
| Open Places dashboard | Opens (or reuses) the Places dashboard leaf |
| Open CRM dashboard | Opens (or reuses) the CRM dashboard leaf |
| New person | Title, tags, email, mobile, address |
| New company | Title, tags, website, email, phone, address |
| Browse trips, countries & places | Opens the combined gallery, unfiltered |
| New trip | Opens the full Trip editor, see [Trips](#trips) |
| New country | Title only; `capital:` and `states:` are left to fill in once those notes exist |
| New state | Title, optional Country |
| New city | Title, optional Country, optional State |
| New accommodation / New food & beverage / New landmark / New location / New photo spot | Title, optional Country, optional City; all five share one modal |
| Check entity types | Runs the [health check](#entity-type-health-check) |
| Export this photo spot as a field sheet | Only offered inside a photo spot note. Writes the sheet described in [the photo spot block](#the-photo-spot-block) beside the note |
| Export this trip as a document | Only offered inside a trip note. Writes [the trip document](#the-trip-document) into the trip's exports folder |
| New booking | Title, trip, category, status, amount and currency. Everything else is a property row away |

Every creation modal follows the same **minimal-frontmatter** convention: it writes `type:` first, then the `created` stamp, then only the fields it actually collected. Cosmetic fields the [templates](../templates/) include (`image`, `icon`, `color`, `summary`, `modified`) are left for hand-editing or your own Templater templates; a Trip's `travelType`/`travelStatus`/`reviewStatus`/`rating` are offered by the Trip editor itself and written only when you fill one in. A brand-new trip has no status yet, and the modal does not guess one.

Creating a note whose target path already exists fails with an explicit error rather than overwriting. Titles are used as filenames with `/` replaced by `-`; all other punctuation is kept.

## Settings

One page (**Settings -> APERtrail**), with the two long lists behind a row each, because they are set when a vault is adopted and then left alone:

- A plugin block at the top: what changed in this version, support, and how to reach us
- **Vault setup**, holding **Folders** (the optional common parent, then the three modules in vault order: **Trips**, then **Places** and its eight sub-folders, then **CRM** with People and Companies, every field with Obsidian's folder autocomplete), **Property keys** (every frontmatter name grouped by note type, with the switch that unlocks them for editing at the top and the ten fixed travel type values listed inline), and the button that runs the entity type health check
- **Display**: the UI language (following Obsidian unless you pick one), whether times are written on a 24-hour or 12-hour clock, and whether distances are kilometres or miles
- **Dashboard**: a ribbon-icon toggle and a button that opens the dashboard
- **Money**: the trip-costs switch, the home currency a trip is assumed to plan in, and the short list of currencies the money dropdowns offer
- **Photo spots**: the sun-times toggle for everything the solar calculation drives
- **People**: the eligible-tags filter that narrows who a trip will offer
- **About**: what the plugin is, where it lives, and its manifest info

See [Settings reference](../design/settings-reference.md) for the full list, including the `*Field` sub-key names that are honored by the reader and writer but get no row.

## What APERtrail does not have

Worth stating plainly, since the design docs describe several of these:

- **No weather.** The sun calculation is geometry and stays offline: no forecast, no cloud cover, no API. It knows where the sun is, not whether you will see it.
- **No terrain-aware horizons.** Sun times assume a flat horizon, so a spot in a valley loses its golden hour to the ridge line without the plugin noticing.
- **No moon phase or Milky Way position.** The same arithmetic could do both, and astro is a real use case, but it is a separate feature with its own vocabulary.
- **No prose scaffolding on a new Trip.** A new Trip note gets its itinerary block and nothing else, no "## Review" skeleton. How you write about a trip is not the plugin's business.
- **No automatic `visited:` updates.** A stop on a past trip is exactly the evidence that a place was visited, but acting on it would mean the plugin writing to notes it does not own, triggered by an edit to a different note. Derived at read time instead, see above.
- **No archive lifecycle**, by design.
- **No map view.** `geoLocation` is read and stored but never rendered. It *is* used for distance and bearing now (`trail-core`'s geo helpers), which is arithmetic; drawing a map is not.
- **No example-vault seeding.** Nothing is scaffolded on first load, so the dashboard is empty until you create something. The [sample vault](../design/sample-vault.md) is a separate vault you open, not something the plugin writes into yours.
- **No live refresh** on the dashboard and gallery, as above.
