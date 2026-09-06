# Data model & note conventions

## Notes are the source of truth

APERtrail persists no travel data. Every trip, country, state, city and place is read live from the vault on every render (`src/vault/read-entities.ts`), never cached as an independent copy that could silently diverge from what is on disk. `data.json` holds configuration and nothing else: no state block, no mirrors, no working copies.

Concretely:

- Every view, block and statistic is a **read-time projection**. It scans `app.vault` and Obsidian's own `metadataCache` fresh each time it renders, computing relationships, visits and stats on the fly rather than reading them back from a stored snapshot.
- Editing a note by hand (renaming a frontmatter field, changing a status, moving a file) is always safe, because there is no separate index to fall out of sync.
- Frontmatter is read defensively throughout. Absent fields mean unset, not an error; numeric-looking values are accepted whether Obsidian's property editor typed them as a Number or left them as a string (`readNumberLike()`, `readDateLike()`); wikilink-shaped values (`"[[Target]]"`, `"[[Target|Alias]]"`) are parsed to their link target rather than compared as raw strings; a `geoLocation` that is not a two-element list reads as unset rather than throwing.

One caveat on "immediately reflected," worth knowing before you go looking for a bug: the dashboard and gallery are [manual-refresh only](../features/travel.md#travel-gallery). The data is never stale; the pixels can be. The itinerary and photo spot blocks are the opposite, redrawing on their own note's metadata change.

### The datetime sharp edge

Obsidian's YAML parser turns an **unquoted** `2026-02-13T09:00` into a native `Date`, and `readDateLike()` renders a `Date` through `formatDayTitle()`, which truncates it to `YYYY-MM-DD`. Any field where the clock time carries meaning must therefore go through `readDateTimeLike()` instead, and anything APERtrail writes with a time in it is written **quoted** so it arrives back as a string and round-trips untouched. Trip departures and returns, and itinerary stop times, all take that path. This is not hypothetical: it silently discarded the time from every `departure:` in a real vault before it was found.

## Where notes live: three modules

The default layout is three top-level folders, which is also the shape of the [sample vault](sample-vault.md):

```
Trips/                      one folder per trip
  <Trip>/
    <Trip>.md               the trip note, its pictures beside it
    Bookings/               one note per purchase belonging to this trip
    Exports/                sheets rendered from the note, deletable and remakeable
  Bookings/                 bookings of trips that have no folder of their own
Places/                     everything a trip can point at
  Countries/ States/ Cities/
  Accommodation/ Food & Beverages/ Landmarks/ Locations/ Photo Spots/
CRM/
  People/ Companies/
```

A trip made before folders existed is still a bare `Trips/<Trip>.md`, and works
exactly as it did: folder matching recurses, so a reader given `Trips` finds a
note one level down and one three levels down alike. Its bookings stay in the
flat `Trips/Bookings/`, which is read alongside every trip folder, and a sheet
exported from it lands beside it rather than in an `Exports/` it does not have.

Every folder is a setting, and each module moves as a unit: repoint `placesFolder` and the eight place folders under it follow. An optional `rootFolder` sits above all three and defaults to empty, meaning the vault root. See [Settings reference](settings-reference.md#folders).

The split says something about ownership rather than only about tidiness. `Trips/` and `Places/` hold notes APERtrail creates and edits. `CRM/` holds notes it reads: a Person or a Company is a note the vault already had, matched by folder plus type value, and the plugin has no contact registry of its own.

CRM differs from the travel types in one way worth knowing before reading `src/crm/`: its two type values are **settings** (`personTypeValue`, `companyTypeValue`) where every travel type value is a fixed literal. A vault whose people notes say `type: Kontakt` points the setting at that and renames nothing. That is why `src/crm/entity-types.ts` is its own list rather than two more members of `TRAVEL_ENTITY_TYPES`, and why `crm/read-crm.ts` resolves the value through settings at every comparison.

## Identification: folder and type together

A note counts as an APERtrail entity only when it is **under the configured folder** for that entity **and** carries the matching value under the configured type property (`typePropertyName`, default `type`). Both, always. There is no folder-based fallback for a missing type, and no vault-wide search for a type outside its folder.

That strictness is what makes the [entity type health check](../features/travel.md#entity-type-health-check) worth running: a `type: fnb` note in the Landmarks folder is not a mis-filed FnB, it is invisible. Because each of the twelve folders maps to exactly one type, the check always has a confident suggestion.

The eleven recognized values are fixed (`src/vault/entity-types.ts`): `trip`, `booking`, `country`, `state`, `city`, `accommodation`, `fnb`, `landmark`, `location`, `photospot`, `vehicle`. `vehicle` is the ship or named train a leg is taken on, and is not a place either: no coordinates, never an itinerary stop, and its cabins are a catalogue rather than prices (see [Vehicles](vehicles.md)). `booking` is the one that is not a place and not a container: it is a purchase belonging to one trip, with no coordinates and no standing as an itinerary stop (see [Trip budget and bookings](trip-budget-and-bookings.md)). `person` and `company` are not among them: they live in `src/crm/entity-types.ts` and are configurable rather than fixed, for the reason given above.

## Relationships are wikilinks, resolved by title

A City's `country:` and `state:`, a Country's `capital:` and `states:`, a State's `cities:`, a place's `country:` and `city:`, a Trip's `cities:` and `persons:`, every `stops[].place`, and the `persons` on any itinerary line reference another note as a real `[[Wikilink]]`, resolved at read time. Obsidian's own backlink and graph features work on this data for free, and a broken reference is just an unresolved wikilink, visible and fixable the normal way.

**Wikilinks resolve by note title (basename), never by path.** Two notes with the same basename in different folders are indistinguishable to every resolver in the codebase, and a link that matches nothing resolves to `null` rather than raising: the referring card renders one fewer meta row and nothing else breaks. A value that is not wikilink-shaped at all is treated as absent rather than guessed at.

### Two-pass resolution for Country, State and City

Those three form a genuine cycle. A Country lists its States, a State points back at its Country, each level's `capital:` points down at a City, and a City points up at both. There is no single ordering that resolves every reference the first time through, so `readTravelBoard()`:

1. Builds skeleton objects for Countries, States and Cities with the cross-reference fields left `null`/`[]`, and indexes all three by title.
2. Walks each list again and **mutates in** the resolved references, now that every skeleton exists to point at.
3. Reads places, which only ever reference Country and City, in a single pass against those indexes.
4. Reads trips last, because their stops point at Cities and places and both must be indexed first. Nothing points back up at a Trip, so this is still one pass.
5. Runs visit derivation over the already-built objects **in place**, since every cross-reference from step 2 points at those exact instances and replacing them would leave the board pointing at stale copies.

Where a stop's title matches both a City and a place, **the City wins**. Cities are the coarser, more frequently referenced level, and a vault with both a City and a Location named "Basel" almost certainly means the City. A documented tie-break, not an accident of lookup order.

## Property names are settings; property values sometimes are not

**Every frontmatter property name a feature reads or writes is a setting**, never a hardcoded string in logic, so a vault with pre-existing naming conventions never has to rename its data to fit the plugin. There are **three deliberate exceptions**, all subtype-specific rather than shared fields, read at fixed names:

| Fixed name | On | Why it is not a setting |
|---|---|---|
| `accommodationType` | Accommodation | Belongs to one subtype rather than the shared place shape |
| `accommodationStatus` | Accommodation | Same |
| `fnbType` | FnB | Same |

Property *values* are a different question. Names are configurable; a few fixed vocabularies are not:

- **`TRAVEL_STATUS_VALUES`**: `Planned`, `Booked`, `Over`, `Cancelled` (`src/trips/trip-note.ts`). The dashboard's status counts, trip ordering and next-trip countdown all key off these exact strings, so a value outside the set is treated as absent rather than counted. A vault whose trips use different status words does not error; its trips fall back to the derived status instead.
- **Transport leg directions**: `outbound` and `inbound`, stored verbatim. The UI labels them "Outward journey" and "Return journey", because "inbound" reads as *toward the destination* to about as many people as it reads as *toward home*. A leg's `origin` and `destination` are the opposite case: free text, kept exactly as typed, because most airports will never be a note. `carrier` -- the airline, the railway, or the train's own name -- is read the same way as those two: a wikilink resolves to its title and anything else stands as typed, because an airline may well have a note and an overnight coach never will.
- **The ten travel entity type values** above. The two CRM ones are settings, not a fixed vocabulary.
- **`BOOKING_CATEGORIES`** (`transport`, `accommodation`, `activity`, `food`, `fees`, `other`) and **`BOOKING_STATUSES`** (`estimate`, `booked`, `paid`, `cancelled`, `refunded`), in `src/trips/costs/booking-note.ts`. An unrecognized category reads as `other` and an unrecognized status as `booked`, so a typo lands somewhere honest rather than dropping the money.
- **`COST_UNITS`**: `total`, `person`, `night`, `personNight` (`src/trips/costs/line-cost.ts`). What the `cost` on an itinerary line is *per*. Absent or unrecognized reads as `total`, deliberately: it is the only reading that cannot silently multiply a hand-typed number into something larger than its author meant.
- **A photo spot's light windows** (`blue-hour-morning` through `night`), motif roles (`main`/`secondary`) and accessibility values (`full`/`partial`/`none`/`unknown`). The sun calculation, the light chips and the itinerary's warnings all key off these exact strings, and they stay English identifiers in the note whatever language reads them. See [Photo spots](photo-spots.md).

## Derived fields

Three things are computed at read time and never written back:

| Derived | From | Rule |
|---|---|---|
| `visited` / `lastVisit` on a City or place | Stops on trips whose effective status is `Over` | An explicit `visited: true` always wins; an explicit `lastVisit:` is folded in alongside derived dates rather than replaced; the most recent date across all sources wins |
| A Trip's effective status | Its own `departure`/`return` when `travelStatus` is absent or unrecognized | A trip whose return date has passed reads `Over`, everything else reads `Planned`; a trip ending today is still current |
| The date an itinerary item falls on | Its `day` number and the trip's `departure` | Day 1 is the departure day. Resolved on every render; the note goes on saying `day: 3`, so moving the departure moves the whole trip without rewriting a line. See [Relative days](relative-days.md) |

A Country has no `visited` field at all. It counts as visited when any City or place referencing it directly via `country:` is visited, and its last visit is the latest such date. A place reaching a country only through a State is not counted.

Both derivations follow the same rule, for the same reason: writing would mean editing notes as a side effect of editing a *different* note, and the derived value would go stale the moment its source changed. Explicit beats derived, every time.

## What a note actually looks like

Everything APERtrail creates gets a minimal header: the type property first, then the `created` stamp, then only the relationships and dates it actually collected. `icon` and `color` are cosmetic and left for hand-editing or your own templates; a Trip's `travelType`/`travelStatus`/`reviewStatus`/`rating` are collected by the Trip editor itself. See [Templates](../templates/) for a fuller starting shape per entity.

**`image` used to be on that cosmetic list and is not any more.** It was read as a hardcoded `image` key by the gallery card, which made it the one vault-facing name here that a vault could not rename, and the only way to give a trip a picture was to type a path into the frontmatter. It is `imageProperty` now, offered by the trip form and used by every entity card. It is therefore an owned key: a save through the form carries a hand-written value through, and a save from an input that does not carry it clears it, exactly like every other owned property. See [The trip document](trip-document.md).

A Trip also carries four **presentation** fields, which say what the trip is rather than what happened on it: `subtitle`, `image`, `highlights` (a list of lines) and `gallery` (a list of `{image, caption}`). The overview that goes with them is body text rather than a property -- a `---` rule and a `> [!SUMMARY]+` callout at the top of the note, the same block NODAtrail's PARA notes carry.

Optional fields are **omitted, never written empty**. A day trip's note carries no `nights:` or `transport:` key at all rather than two empty lists, and a stop with no note carries no `note` sub-key.

A Trip's list-valued properties use sub-keys within each entry, and those sub-key names are settings too (`stopPlaceField` through `legPersonsField`, listed in full in the [Settings reference](settings-reference.md)). Each of the three lists takes the same four money sub-keys on an entry, `cost`, `currency`, `costUnit` and `persons`, and each of the four is omitted when it has nothing to say:

```yaml
---
type: trip
country: "[[Switzerland]]"
cities:
  - "[[Basel]]"
departure: "2026-02-13T09:00"
return: "2026-02-13T18:30"
travelStatus: Over
persons:
  - "[[Stefan]]"
stops:
  - place: "[[Basel]]"
    from: "2026-02-13T10:00"
  - place: "[[Gifthüttli]]"
    from: "2026-02-13T12:00"
    to: "2026-02-13T13:30"
    note: Good schnitzel
    rating: 4
nights:
  - accommodation: "[[Hotel Dreieich]]"
    checkIn: 2026-02-13
    checkOut: 2026-02-16
    cost: 240
    costUnit: night
transport:
  - direction: outbound
    mode: plane
    carrier: Swiss
    origin: Zürich
    destination: Pretoria, South Africa
    from: "2026-02-13T09:00"
    reference: LX288
    cost: 890
    costUnit: person
    persons:
      - "[[Stefan]]"
---
```

### Prices to choose between, and things that may not happen

Two more sub-keys belong to a stop, a stay and a leg alike, the same way the
four money sub-keys already do. They are independent of each other and a line
may carry both.

**`variants` are the several prices one thing is sold at.** A voyage offered as
an outside cabin at one price and a superior outside cabin at another is **one**
journey on one set of days; a room offered as double or single is one stay; an
excursion offered in a two-hour and a four-hour version is one afternoon. So it
is one line with a list under it rather than several lines beside each other,
which would also mean typing the same days, route and carrier twice and letting
them drift apart:

```yaml
transport:
  - direction: outbound
    mode: boat
    carrier: Hurtigruten
    day: 1
    toDay: 15
    variants:
      - name: Polar Aussenkabine
        description: Aussenkabine mit Fenster
        cost: 4479
        costUnit: person
        currency: CHF
        chosen: true
      - name: Arktis Aussenkabine Superior
        cost: 5299
        costUnit: person
        currency: CHF
```

They are **alternatives, never extras**: exactly one of them is bought, so
nothing ever sums them. `chosen` is written only where it is true, because
false on every variant is the ordinary state of a choice nobody has made yet
and writing it five times would say it five times over.

**A line carrying variants is priced from them and its own `cost` is not
read**, or the same thing would count twice; the editors move an existing
figure into the first variant rather than leaving it above them. Until one is
chosen the **first** counts, and every row that shows the figure says so: the
largest figure on a trip must not fall out of its own budget for as long as the
trip is being decided, which is exactly when the budget is read. The note's own
order picks it, the same rule the itinerary applies to its days -- an operator
lists its cabins in the order it means them to be read.

A variant that names no currency inherits the line's, then the trip's. One with
neither a name nor a price is dropped on write, like any other row somebody
opened and left.

**`optional: true` says the line might not happen at all.** Nearly every day of
a cruise brochure offers something -- "Nehmen Sie an einem optionalen Ausflug
teil" -- and several on one day are independent of each other, so each is its
own line:

```yaml
stops:
  - place: "[[Tromsø]]"
    day: 7
    note: Hundeschlittenfahrt durch die verschneite Landschaft
    cost: 220
    costUnit: person
    currency: CHF
    optional: true
    chosen: true
```

Such a line is priced like any other and **stays out of the planned total**
until `chosen` says somebody decided on it; what the untaken ones would add is
reported beside the plan rather than inside it, so a total never quietly
includes a decision nobody has made. Deciding to do one sets `chosen` rather
than clearing `optional`, so the note goes on saying it was an extra -- which
is what the trip document prints.

**`chosen` is read only on an optional line.** On any other the word means
nothing, and honouring it there would give a line two ways of saying it is in
the plan, one of which nothing writes. Both flags are written only when true:
`optional: false` on every ordinary stop of a fifteen-day trip would be forty
lines of frontmatter saying nothing.

See `trips/costs/line-variants.ts` for the arithmetic and
`trips/costs/estimates.ts` for the split.

The two costs above say different things, which is the whole reason
`costUnit` exists: 890 is a fare per passenger, charged here to the one
person the leg names, while 240 is a room per night and is multiplied by the
nights of the stay rather than by the people in it. A `persons` list left
out means everybody on the trip.

A Booking is the flat counterpart to all of that, and deliberately so: every field on it is a scalar or a list of links, which is why it carries no block and why Obsidian's own property editor is the right editor for one. It is also why the format stays in this package rather than moving into `trail-core` even once NODAtrail reads booking notes for trip costs: there is no format code to share. A booking that grew a list-of-maps field would change that answer.

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
payer: "[[Stefan]]"
for:
  - "[[Stefan]]"
  - "[[Erika]]"
document: "[[SBB 2026-06-14 XK7F2Q.pdf]]"
---
```

`category` is one of `transport`, `accommodation`, `activity`, `food`, `fees`, `other`, and `status` one of `estimate`, `booked`, `paid`, `cancelled`, `refunded`. The status is not decoration: `estimate` counts as committed, because a budget that counted only what was already booked would read as nothing at the moment it is most useful; `cancelled` counts nowhere; and `refunded` counts as **zero while staying visible**, because the note is the evidence and deleting it would lose the reference the money came back under. An absent `amount` is null rather than zero, `currency` falls back to the trip's and then to the home currency, and an empty `for` means every participant. `reference` does double duty: it is what matches a booking to a transport leg carrying the same one.

`createdProperty` is stamped once, by every creation path, directly after the type property; no edit ever rewrites it and nothing reads it back. `modifiedProperty` is stamped by the Trip editor and the photo spot editors on every save, and by the entity type health check when it rewrites a note's type value.

## Code-block languages and their prefixes

Two of the four fenced-code-block languages carry a prefix the rest of the plugin does not use:

| Language | Prefix | Why |
|---|---|---|
| `travel-itinerary` | `travel-` | Already written into notes |
| `travel-related-trips` | `travel-` | Already written into notes |
| `apt-photo-spot` | `apt-` | Added later, nothing to orphan |
| `apt-trip-costs` | `apt-` | Added later, nothing to orphan |

These strings live in the user's own notes, written both by the plugin and by hand. Renaming the first two would orphan every block in every existing trip and place note, turning them back into plain unrendered code fences, and no migration could fix that without rewriting note bodies the plugin does not own. Keeping the names costs one paragraph of explanation; renaming them would cost every existing note. Only the fence language keeps the old spelling: the CSS class on the rendered element is `apt-itinerary`, like everything else.

That argument only ever protects strings that are already somewhere, so it does not extend to new blocks. **Everything added since takes `apt-`**, starting with `apt-photo-spot`. A photo spot note is useful with no trip in sight, and filing it under `travel-` would name a relationship it does not have.

## What is stored outside notes

Configuration, and only configuration: the folder paths, the Persons lookup, the property-name overrides and the ribbon toggle, in `.obsidian/plugins/apertrail/data.json`. See [Settings reference](settings-reference.md).

There is no state block and no derived data of any kind on disk, which is why APERtrail has no "rebuild from notes" action: there would be nothing to rebuild. Deleting `data.json` costs you your folder paths and property names, never a single fact about a trip.
