# Trip model redesign: design & implementation plan

The design behind the Trip schema the plugin reads and writes today: what a trip has to be able to say, how it is stored, how it is edited, and how it is rendered. It replaces the Trip half of [`travel-module-plan.md`](travel-module-plan.md) §3, which modelled the wrong thing; everything else in that plan stands. [§10](#10-what-changed-during-the-build) records where the build came out differently from the plan, rather than quietly editing the sections above it.

## 0. The problem

The Trip entity this redesign replaces captured four things: a title, a Country, a departure date and a return date. That was the entire surface. The creation modal collected exactly those, and the reader looked for four more fields (`travelType`, `travelStatus`, `reviewStatus`, `rating`) that nothing wrote.

A trip is not four fields. The simplest real trip looks like this:

> Two people. On 13 February, drive to Landquart, spend the morning at the Fashion Outlet, drive to Maienfeld, eat at Restaurant Falknis from 12:00 until 13:30, come home at 14:00.

Nothing in that sentence except the date is representable. Who went, which cities were involved, which places were visited, in what order, at what times, and what happened at each one: none of it has a home. Hand-written trip notes work around this with an improvised `selections:` list, and put the actual narrative in the note body as prose:

```yaml
selections:
  - person: "[[Erika Muster]]"
  - person: "[[Stefan Muster]]"
  - city: "[[Schaffhausen City]]"
  - places:
      - "[[Landquart]]"
      - "[[Landquart Fashion Outlet]]"
      - "[[Maienfeld]]"
      - "[[Restaurant Falknis]]"
```

That workaround is the right instinct and the wrong shape. It is a heterogeneous list where each entry has a different key, so there is no schema to validate against and no way to attach a time to anything. Cities and places are mixed into one bucket.

The workaround also cannot be read by the plugin, so trips written that way are invisible to the dashboard.

This plan replaces the Trip schema with one that can represent that sentence, adds the editor to maintain it, and migrates the existing notes.

## 1. Principles carried over

None of this is new ground. The redesign runs on the conventions the rest of the plugin already follows:

- **Structure in frontmatter, prose in the body.** The plugin owns a defined set of frontmatter keys and never touches anything else in the note, including the narrative a hand-written trip already contains. That is what writing through `processFrontMatter()` with an explicit managed-keys set buys: a body written by a person survives a write by the plugin.
- **Relationships are wikilinks resolved by title.** A stop points at a real place note; an unresolved link is `null`, not an error.
- **Nested frontmatter implies a modal.** Obsidian's property editor cannot meaningfully edit a list of objects. The trade is accepted deliberately: the data lives in YAML where it stays readable and hand-editable, and a purpose-built editor is the way you touch it.
- **Every property name is a setting.** Fixed value vocabularies (`travelStatus`) stay fixed, and are the documented exception.
- **Pure logic separated from the `App`.** A `trip-note.ts` with no Obsidian import, unit-tested by round-tripping its own builder against its own parser, with everything that needs a vault in a separate `write-trip.ts`.

## 2. The schema

### 2.1 Worked example: a day trip

This is `Landquart - Maienfeld.md` as it would be after migration.

```yaml
---
type: trip
country: "[[Switzerland]]"
cities:
  - "[[Landquart]]"
  - "[[Maienfeld]]"
departure: "2026-02-13T09:00"
return: "2026-02-13T14:00"
travelType: Private - Couple
travelStatus: Over
reviewStatus: Done
rating: 4
persons:
  - "[[Erika Muster]]"
  - "[[Stefan Muster]]"
stops:
  - place: "[[Landquart Fashion Outlet]]"
    from: "2026-02-13T09:30"
    to: "2026-02-13T11:30"
    note: Bought a pair of Diesel trousers
  - place: "[[Restaurant Falknis]]"
    from: "2026-02-13T12:00"
    to: "2026-02-13T13:30"
    rating: 5
    note: Angus Rindsfilet mit Pommes, Gemuese, Kraeuterbutter
---

(the existing prose body stays exactly as it is)
```

No `nights:`, no `transport:`. A day trip has neither, and both are omitted rather than written empty, which is the omit-when-absent rule the writer follows for every optional field.

### 2.2 Worked example: a multi-day trip

```yaml
---
type: trip
country: "[[Germany]]"
cities:
  - "[[Dreieich]]"
departure: "2026-04-26T07:00"
return: "2026-04-28T18:00"
travelType: Private - Couple
travelStatus: Booked
persons:
  - "[[Erika Muster]]"
  - "[[Stefan Muster]]"
nights:
  - accommodation: "[[Hotel Dreieich]]"
    checkIn: 2026-04-26
    checkOut: 2026-04-28
transport:
  - direction: outbound
    mode: car
    from: "2026-04-26T07:00"
    to: "2026-04-26T11:30"
  - direction: inbound
    mode: car
    from: "2026-04-28T14:00"
    to: "2026-04-28T18:00"
stops:
  - place: "[[Ristorante Pizzeria La Perla]]"
    from: "2026-04-26T19:00"
    to: "2026-04-26T21:00"
---
```

Multi-day needs no separate entity type and no per-day grouping in the data. Every stop carries its own absolute datetime, so day grouping is a *display* concern the renderer derives, not a structure the note has to encode. A day trip is simply a trip whose stops all fall on one date.

### 2.3 Field reference

Property names are settings, shown at their proposed English defaults. New settings are marked ✱.

| Property | Type | Notes |
|---|---|---|
| `country` | wikilink | Unchanged |
| `cities` ✱ | list of wikilinks | Which Cities the trip touches. Replaces the single `city:` buried in the old `selections:` list; a day trip crossing two towns is normal |
| `departure` / `return` | datetime | Unchanged in name; see §3 on time preservation |
| `travelType` | string | Unchanged. Free text; the modal offers the drafted values as a datalist rather than enforcing them |
| `travelStatus` | fixed enum | `Planned` / `Booked` / `Over` / `Cancelled`. Not configurable; see §3.3 for the new absent-value fallback |
| `reviewStatus` | string | Unchanged |
| `rating` | 1-5 | Unchanged |
| `persons` ✱ | list of wikilinks | Who went. Resolved against the Person notes under `personsFolder`, narrowed by `eligiblePersonTags` |
| `stops` ✱ | list of objects | The itinerary. See below |
| `nights` ✱ | list of objects | Accommodation stays. `accommodation` (wikilink), `checkIn`, `checkOut` (dates) |
| `transport` ✱ | list of objects | `direction` (`outbound`/`inbound`), `mode` (`train`/`plane`/`car`/`other`), `from`, `to` (datetimes), optional `reference` |

All three lists gained four money sub-keys afterwards, in [Trip budget and bookings](trip-budget-and-bookings.md) §16, and a leg gained `origin` and `destination`: see that document rather than the tables here, which record the model as designed.

A `stops` entry:

| Sub-key | Required | Notes |
|---|---|---|
| `place` | yes | Wikilink to a City **or** any of the five place types. An entry whose `place` does not resolve is kept and rendered as an unresolved link rather than dropped |
| `from` | no | Datetime. A stop with no time is valid: "we went to the outlet at some point" |
| `to` | no | Datetime |
| `note` | no | Free text. What you ate, what you bought |
| `rating` | no | 1-5, this visit specifically |

Stops are stored in list order and rendered in that order, **not** re-sorted by time. An untimed stop between two timed ones would otherwise jump to an arbitrary position, and the order you typed them in is meaningful information.

### 2.4 Why `stops` accepts Cities as well as places

Hand-written trips already list `[[Basel]]` (a City) and `[[Restaurant Gifthüttli]]` (an FnB) side by side in one `places:` bucket, and that is correct: "we went to Basel, then ate at the Gifthüttli" is one itinerary at two levels of zoom. Forcing Cities into a separate list would mean the itinerary cannot express "arrived in Basel at 10:00."

So `stops[].place` resolves against Cities and all five place types together, and the resolved model carries which kind it turned out to be, so the renderer can icon it appropriately. `cities:` remains separately useful as the trip's overall geographic scope, independent of whether a city is also an itinerary stop.

**Known collision:** resolution is by title across a union of six folders, so a City and a Location both named `Basel` are indistinguishable. This is the same title-collision caveat that already applies vault-wide (see [Data model](data-model.md#frontmatter-conventions)); the resolver should prefer City on a tie and this should be documented, not silently arbitrary.

## 3. Reading it

### 3.1 A datetime bug this design surfaces

`readDateLike()` returns a string unchanged, but converts a real `Date` via `formatDayTitle()`, which truncates to `YYYY-MM-DD`.

Obsidian's YAML parser turns an **unquoted** `2026-02-26T08:30:00` into a `Date`, and that is how a hand-written trip note usually spells it. So the existing reader is already silently discarding the time from every `departure:` and `return:` in the vault, today, before any of this redesign lands.

Times are the whole point of the new schema, so this has to be fixed first:

- Add `readDateTimeLike()` alongside `readDateLike()` in `shared/date-utils.ts`, formatting a `Date` as local `YYYY-MM-DDTHH:mm` and preserving a string as-is.
- Use it for `departure`, `return`, `stops[].from`, `stops[].to` and both `transport` times. `nights[].checkIn`/`checkOut` stay date-only on `readDateLike()`.
- Have the writer **quote** every datetime value, so a note this plugin wrote round-trips as a string and never depends on the parser's coercion.

This is a small change with its own test, and it should ship before anything else here: it is a bug fix that happens to be a prerequisite.

### 3.2 Model shape

`src/vault/types.ts` gains, alongside the existing `TravelTrip` fields:

```ts
export interface TravelTripStop {
  placeTitle: string | null;
  /** Resolved City or place, or null when the wikilink matches nothing. */
  target: TravelCity | TravelPlace | null;
  targetKind: 'city' | TravelPlaceType | null;
  from: string | null;
  to: string | null;
  note: string | null;
  rating: number | null;
}
```

plus `TravelTripNight`, `TravelTripLeg`, and on `TravelTrip` itself: `cityTitles`/`cities`, `personTitles`, `stops`, `nights`, `transport`.

Trips resolve after Cities and places are built, in the same second pass that already resolves `country`. No new pass is needed, since a stop only ever points *down* the hierarchy.

### 3.3 Deriving a missing status

Rather than only fixing the notes, make the reader robust: when `travelStatus` is absent or unrecognized, derive it.

- `return` (or `departure`) in the past → `Over`
- otherwise → `Planned`

This is a read-time fallback, never written back. It means a hand-written trip note with no status still appears in the dashboard's Trips section and the status counts, instead of vanishing, which is the failure mode any note written before the plugin existed is otherwise in. An explicit `travelStatus` always wins.

## 4. Writing it: the Trip editor

One modal for both create and edit: the same file renders both flows, edit mode pre-fills from the parsed record, and the two cannot drift apart. It replaces the current `NewTripModal`.

Sections, top to bottom:

1. **Basics**: title (create only; renaming an existing trip is a file rename, out of scope), Country dropdown, Cities multi-select, departure and return with date **and** time inputs, Travel Type, Travel Status, Review Status, rating.
2. **Who came**: a checkbox per eligible Person, from `getEligiblePersonTitles()` (`src/crm/persons.ts`), which is the one place a person list ever comes from.
3. **Itinerary**: an ordered list of stop rows. Each row: the place (a `+` opens a picker), `from`/`to` time inputs, a note field, a rating. Rows can be reordered and removed. Empty by default.
4. **Nights**: accommodation picker plus check-in/check-out dates. Collapsed when empty.
5. **Transport**: outbound and inbound legs. Collapsed when empty.

Sections 4 and 5 collapse by default so a day trip's modal stays short. Most trips are day trips, and the multi-day fields should not tax them.

The place picker is a new `TravelPlacePickerModal`: fuzzy search over Cities and the four place types, grouped by kind, with each row carrying the entity's icon so the §2.4 title collision is at least visible.

Writing goes through a new `trip-note.ts` (pure) plus a `src/vault/create-entities.ts` extension:

- `buildTripFrontmatter(input)` → a plain object, testable directly
- `parseTripRecord(input)` → the mirror, round-trip-tested against it
- `updateTripNote()` using `processFrontMatter()` with a `managedKeys` set, so the prose body and any frontmatter outside the Trip schema survive an edit untouched

## 5. Rendering it

### 5.1 An itinerary block, not a new view

The itinerary should render **inside the Trip note**, not in a separate view, via a fenced code block the plugin processes:

````markdown
```travel-itinerary
```
````

The block is registered through `registerMarkdownCodeBlockProcessor`, like every other block the plugin renders. The advantages over a dedicated `ItemView` are concrete: it re-computes on every render so it cannot go stale, it works in reading mode, it sits directly above the prose a trip note already contains, and it needs no leaf management or refresh plumbing. It is also markedly less code than a Trip view.

The block renders a timeline grouped by date, one row per stop: time range, entity icon, linked title, rating stars, note. Nights and transport legs render as their own bands when present. Clicking a stop opens that place's note.

The block is inserted into the body when the modal creates a trip. An existing note without one still works, since the frontmatter is authoritative and the block is just a lens on it, and the trip renders fine in the gallery and dashboard regardless.

### 5.2 Dashboard and gallery

Small changes, no restructuring:

- Trip cards gain a stop count and a person count in the meta row.
- The dashboard's Trips section keeps its Planned/Booked filter, but now actually has candidates, both from migration and from the §3.3 fallback.
- The gallery's Trip-specific Travel-Status and Review-Status filters, designed in `travel-module-plan.md` §6 and not built at the time, become worth building once trips carry real statuses. Filtering by participant is a natural addition given `persons:`.

## 6. Settings added

Seven new property-name overrides, grouped under a "Trip" heading with the existing Trip-only fields:

`citiesOnTripProperty` (`cities`), `personsProperty` (`persons`), `stopsProperty` (`stops`), `nightsProperty` (`nights`), `transportProperty` (`transport`), plus sub-key settings for the stop fields (`place`/`from`/`to`/`note`/`rating`) and the night and leg fields. The stop list gained `motif` with the photo spot work and all three lists gained `cost`/`currency`/`costUnit`/`persons` with the money work, each a setting for the same reason; the [Settings reference](settings-reference.md) carries the current list. A sub-key inside a list entry is still a name the note and the reader have to agree on, so it is still a setting.

`citiesProperty` already exists and means "a State's cities". The Trip-level one needs a distinct settings key; reusing it would be a collision, even though both default to a property literally named `cities` on the note.

Also worth doing while here: wire up `createdProperty` and `modifiedProperty`, which are settings today that nothing reads or writes. The Trip writer should stamp `modified` on edit.

## 7. Migrating the five existing notes

Five notes, four real and one throwaway. This is small enough to do as a reviewed one-off rather than shipping migration code, and migration code that runs once against five notes is a liability, not an asset.

| Note | Action |
|---|---|
| `Landquart - Maienfeld.md` | Rewrite to the new schema. `state: Done` → `travelStatus: Over`. Persons and cities lifted out of `selections:`. Stops built from the `places:` list, with times and per-stop notes read out of the prose body, which already says what happened when |
| `Short Trip to Basel.md` | Same. `state: Done` → `travelStatus: Over` |
| `Meeting Gaby.md` | Same. The `address:` entry in `selections:` has no home in the new schema; it belongs on a place note, or in the body |
| `Visiting Regina and Wolfgang.md` | Same. `state: Canceled` → `travelStatus: Cancelled` (note the spelling change) |
| `Test.md` | Delete; it is a scratch note, not data |

Every prose body is preserved verbatim; only frontmatter changes, plus an inserted `travel-itinerary` block.

Two things to confirm before running it. First, the times: the bodies say what happened in what order but not always at what clock time, so some `from`/`to` values will be inferred from the trip's own departure/return window. Those should be reviewed rather than trusted. Second, `Landquart - Maienfeld.md` currently lists `city: "[[Schaffhausen City]]"` while its places are all in Landquart and Maienfeld. That looks like a copy-paste from `Meeting Gaby.md`, and migration is the moment to fix it.

Separately, `state:` on a Trip goes away entirely, which resolves the collision where the same property name meant "link to a State" on a City note and "status" on a Trip note.

## 8. Build order

Each phase is independently shippable and leaves the plugin working.

| Phase | Contents | Why here |
|---|---|---|
| **0** | `readDateTimeLike()` + quoted datetime writes, with tests | A prerequisite bug fix; valuable even if nothing else lands |
| **1** | Schema, `trip-note.ts` (pure build/parse), model types, reader changes, §3.3 status fallback, round-trip tests | No UI yet. Migrated notes become readable and the dashboard's Trips section comes alive |
| **2** | Migrate the five notes | Depends on 1 for the target schema; validates it against real data before any UI is built on top |
| **3** | The Trip editor modal, replacing `NewTripModal`, plus `TravelPlacePickerModal` | The actual gap. Depends on 1 |
| **4** | The `travel-itinerary` block | Makes the data visible in the note |
| **5** | Dashboard and gallery meta rows, Trip filters, participant filter | Polish, and pays down `travel-module-plan.md` §6 |

Phases 1 and 3 are the substantial ones. Phase 0 is an afternoon.

## 9. Deliberately out of scope

- **Costs per trip or per stop.** Money is its own domain: currencies, exchange rates, who owes whom, what counts as a trip expense. A single `cost:` field would invite people to trust totals the plugin cannot actually compute, which is worse than not offering it. *(Reopened and answered clause by clause in [Trip budget and bookings](trip-budget-and-bookings.md) §1. What was actually spent is its own note, currencies are never summed, and the settlement is derived rather than stored. A `cost:` field did arrive later, in §16 of that document, and only for the thing this paragraph did not anticipate: what a line is EXPECTED to cost before there is anything to book. It is never a total the plugin computed and stored, it says what it is per, and a booking supersedes it the moment one exists. The paragraph above was right when it was written and is the reason both designs have the shape they do.)*
- **A map view.** `geoLocation` stays read-and-stored. Rendering it is a separate feature with its own dependencies.
- **Automatic `visited`/`lastVisit` updates.** Tempting, since a stop on a past trip is exactly the evidence that a place was visited, but it means the plugin writing to notes it does not own, triggered by an edit to a different note. Worth doing, worth its own design, and the fallback rule in §3.3 shows the same problem can often be solved by deriving at read time instead of writing. Flagged as the obvious next question after this lands.
- **Recurring or template trips.** No evidence of need. *(Half reopened and answered in [A trip is a shape before it is a set of dates](relative-days.md). Recurrence still has no evidence behind it. What did turn up is a different thing wearing the same word: an itinerary written as day one to day twelve before anybody knows the dates, which then get fixed once. An item may name which day of the trip it is on instead of naming a date, and the dates are resolved on every render and never written. The paragraph above was right about the feature it named.)*
- **A separate day-trip entity type.** §2.2: one model handles both.

## 10. What changed during the build

The plan survived contact with the code largely intact. The things that came out differently are recorded here rather than by quietly editing the sections above.

**§4's single modal did not survive contact with a real trip.** The plan put basics, participants, itinerary, nights and transport in one create-or-edit dialog, with nights and transport collapsed when empty. That is what shipped, and it was unusable past a handful of stops: every item rendered as a run of Setting rows in a dialog that re-rendered wholesale on each change, so a ten-stop trip meant roughly fifty rows and a modal taller than the screen. It was reported from real use within a day.

The editor now covers only the trip's own fields. Stops, stays and legs are edited one at a time from the itinerary block in the note, which was already being built as a *display* surface under §5.1. Making it the editing surface too is a small addition that fixes the scaling problem outright, and puts the controls where you are already looking. The lesson worth keeping: "one modal for the whole entity" scales with the number of fields, not with the number of items, and a Trip is mostly items.

**§2.3's `citiesProperty` name collided.** The plan noted that the Trip-level "cities this trip touches" needed a settings key distinct from the existing State-level `citiesProperty`, and proposed `citiesOnTripProperty`. The shipped setting is `tripCitiesProperty`, which reads better next to the other Trip-adjacent fields. Both still default to a `cities`-shaped name on the note itself; only the settings keys differ.

**Three place sub-fields are not configurable.** `accommodationType`, `accommodationStatus` and `fnbType` were already read at fixed names before this work, and stayed that way. Every field the Trip schema itself introduces *is* a setting, as planned.

**`effectiveTravelStatus()` is asymmetric, deliberately.** §3.3 proposed deriving `Over` for a past trip and `Planned` otherwise. That is what shipped, and the asymmetry is the point: a past trip is definitively over, but whether a future trip is `Planned` or `Booked` is a fact about the world that no date can reveal. The optimistic half of the guess is the weaker one on purpose.

**The itinerary block's day grouping moved out of the UI.** `groupStopsByDay()` lives in `src/trips/itinerary-days.ts`, not inside `src/trips/ui/itinerary-block.ts`, so it can be unit-tested without an `App`. That is the same pure-logic-versus-vault-access split `trip-note.ts` and `write-trip.ts` already draw. The block itself remains untested DOM building.

**One shared extraction the plan did not anticipate.** `wikilinkTarget()`/`wikilinkTargets()` existed twice: once in `shared/vault-scan.ts`, which imports from `obsidian` and is therefore off-limits to pure code, and once copied verbatim into a note-parsing module to keep that file free of the import. `trip-note.ts` needed the same primitives for the same reason, and a third copy of two regexes that must stay in lockstep was one too many. They now live in `shared/wikilink.ts`, with `vault-scan.ts` re-exporting them so existing import sites are unchanged.

**Making the block editable made it need a lifecycle.** As a pure display surface it could be a plain render function: draw once, and the next render picks up any change. Once it also *writes*, it has to know when its own write has landed, and redrawing from the write's `.then()` renders stale data, because `processFrontMatter()` resolves when the file is written while `metadataCache` updates asynchronously afterwards. The renderer is now a `MarkdownRenderChild` added via `ctx.addChild()`, subscribing to `metadataCache.on('changed')` for its own path, so Obsidian owns teardown and the block redraws on any change to the note, including one made by hand. The general shape: a code block that only reads can be a function; a code block that writes needs to be a component.

**`Outbound`/`Inbound` were renamed in the English UI.** The stored `direction:` values are unchanged, and the German labels (*Hinweg* / *Rückweg*) were unambiguous from the start. English is not: "inbound" reads as *toward the destination* about as often as *toward home*. They now render as "Outward journey" and "Return journey". A label that needs the docs to disambiguate it is the wrong label.

**City and State both got dashboard quick actions.** §5.2 grouped them as setup-time entities reachable from their Country, and they stayed commands-only. In use that was wrong for the same reason for both: a trip's `cities:` list cannot reference a City note that does not exist yet, so the geographic hierarchy gets extended mid-planning, not just at setup. Every creatable type now has a button; the ordering (Trip, the four place types, City, State, Country) carries the "rarely needed" signal instead.

**The Trips strip stopped hiding the past.** §5.2 filtered it to Planned/Booked, on the reasoning that a dashboard answers "what's next". On a vault where four of five trips are already over, that produced one card under a heading counting five, which reads as a failure to load rather than a filter. It is now two tiers: upcoming soonest-first, then past most-recent-first, with cancelled trips in neither and the heading counting what the strip would show. The intent survives, since what is ahead still comes first; what changed is that the leftover slots are filled rather than left empty. The general lesson: a filtered strip needs a heading that counts the filtered set, or it looks broken exactly when the filter is doing its job.

### Test coverage added

| Suite | Covers |
|---|---|
| `tests/trip-note.test.ts` | The build/parse round trip, omit-when-absent rules, renamed property names, malformed input, the managed-keys set, and `effectiveTravelStatus()`'s six cases |
| `tests/trip-read.test.ts` | Cross-reference resolution for stops and nights, stop ordering, the City-wins tie-break, and the derived status end to end |
| `tests/write-trip.test.ts` | What lands on disk, quoted datetimes (the §3.1 regression's real guard: an unquoted value would be coerced back into a `Date` and lose its time), and, the one that matters most, that an edit leaves unmanaged frontmatter and the note body alone |
| `tests/itinerary-block.test.ts` | Day grouping, including untimed stops and a day revisited later in the list |
