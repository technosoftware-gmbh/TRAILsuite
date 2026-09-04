# Travel module: design & implementation plan

The design APERtrail's entity model, gallery and dashboard were built from: what each note type carries, how the folders and settings are shaped, and why each decision went the way it did. The build status table below records where the shipped code went narrower, or wider, than the plan.

## Build status

| Plan section | Status |
|---|---|
| §2 Architectural placement (option C: a typed travel module of its own) | **Built as designed.** One `Plugin` subclass in `src/main.ts` owning four views, a settings tab and a ribbon icon, with the card renderer, star rating, singleton-leaf helper and modal shell kept as shared primitives (`src/ui/components/`, `src/shared/open-leaf.ts`) rather than rewritten per view. |
| §3 Data model, the fixed `type:` values | **Built as designed.** Lowercase and unquoted; `TRAVEL_ENTITY_TYPES` in `src/vault/entity-types.ts`. The eight types in the table below became nine when the photo spot type landed. |
| §3 Data model, frontmatter fields | **Built, partially.** Every relationship, date, visited/rating and Trip field in the table is read, and every property name is a setting. Not read: `image` (resolved by the shared card renderer instead), `icon`, `color`, `summary`, `tags`. `created`/`modified` have settings but nothing reads or writes them. `accommodationType`, `accommodationStatus` and `fnbType` are read at fixed names rather than configurable ones, the three documented exceptions. |
| §4 Person: read, don't own | **Built as designed.** There is no Person entity type and no person schema. Person notes are read out of `personsFolder`, matched by `personTypeValue` and optionally narrowed by `eligiblePersonTags` (`src/crm/persons.ts`). |
| §5 Settings surface | **Built, reshaped.** Not one root with eight sub-folders but three module roots (`tripsFolder`, `placesFolder`, `crmFolder`) under an optional common `rootFolder`, with every sub-folder derived from its module root so a module still relocates as a unit. The type-property name, the property-name overrides and a ribbon toggle are on one tab; the Trip and photo-spot sub-key settings are honored but not rendered. |
| §6 Gallery view | **Built, widened, then made the whole plugin.** Type filter and fuzzy title search shipped first. The Country, visited, minimum-rating and tag facets, a sort control, and the Trip-only Travel-Status, Review-Status and participant filters all followed once trips carried real statuses and stops; the photo-spot facets came with that type. In September 2026 it absorbed both dashboards and is now the only view. §6's central decision -- one combined view with a type filter rather than eight near-identical ones -- is what made that possible. |
| §7 Travel dashboard | **Built, split in three, then retired.** Greeting, quick actions, the stats tiles and the per-type sections with their own ordering and "Browse all" footers all shipped as specified; every creatable type gained a quick-action button, City and State included, because both turn up mid-planning rather than only at setup. The dashboard then split into one per module (`dashboard-split-and-crm.md`), and on 2 September 2026 both survivors folded into the gallery, which is now the plugin's one view: it carries the greeting, the creation buttons and all five stat tiles, and the tiles filter its grid rather than opening it. The per-type orderings survived as that grid's default sort. See §G of `dashboard-split-and-crm.md`. |
| Trip body scaffolding (§3, §7) | **Not built, and superseded.** New Trip notes are frontmatter plus an itinerary code block; no Overview / Transport / In Country / Review headings are generated. [Trip model redesign §5.1](trip-model-redesign.md#51-an-itinerary-block-not-a-new-view) explains why a rendered block beat a written scaffold. |
| "Related Trips" backlink sections | **Built later, as a block.** The relationship is a projection over a Trip's `stops`, rendered by the `travel-related-trips` code block (`src/trips/related-trips.ts`), not written into place notes. It only became buildable once stops existed to reverse. |
| §10/§11 Reconciling an existing place hierarchy | **Not plugin code, deliberately.** Sitting on top of a vault that already had places is handled by settings, not by a migration routine: every property name and every folder is configurable, so a one-time reconciliation pass belongs to the vault owner and their own script. |

For a worked example of the note shapes the shipped reader expects, see [the sample vault](sample-vault.md).

**§3's Trip row is superseded.** The Trip entity as designed here and as built turned out to model the wrong thing: it has no participants, no cities, and no itinerary, so it cannot represent even a simple day trip. [Trip model redesign](trip-model-redesign.md) replaces it. The rest of this plan's data model stands.

**§3's table predates the photo spot type.** Photo Spot (`type: photospot`) was added later as a ninth entity type and a fifth place type, taking the same place shape as the four below it. It is designed in [Photo spots](photo-spots.md).

## 0. What was asked for

Give every travel entity (Trip, Country, State, City, Accommodation, FnB, Landmark, Location, Person) a gallery view, plus a travel dashboard as the plugin's home base. This document is that design. Person turns out to be the one entry on that list that should not be owned here at all, which §4 argues out.

## 1. Source material

The plan is derived from:

- [`docs/templates/Trip Planning.md`](../templates/Trip%20Planning.md), the top-level structure note (`Travel: Accommodation, Cities, Countries, FnB, Landmarks, Locations, Persons, States, Trips`)
- `docs/templates/Template - {Trip,Country,State,City,Accommodation,FnB,Landmark,Location,Person}.md`, one draft template per entity, each with a `Fields` list and an `Example Layout` frontmatter+body sample. State and City were added after the initial draft, to give Country a real place in a geographic hierarchy instead of the ad-hoc per-place `country:` reference every other entity already had.

Checked against the constraints the plugin has to live inside:

- Obsidian's own affordances. Frontmatter is editable by hand in the property editor, wikilinks resolve by note title, and backlinks already exist. Anything the plugin adds has to be worth more than what the app gives away.
- The conventions in [`CLAUDE.md`](../../CLAUDE.md) and [Data model](data-model.md): every property name is a setting, notes are the source of truth and are never silently rewritten, nothing is cached.

That second point sets up the question this plan actually has to answer. These notes can already be browsed today with nothing but folders, core search and a query plugin, and their relationships are already navigable through backlinks. So the question is not "can travel entities be browsed" but "do they earn a typed model, an image-card gallery and a dashboard of their own", given that they carry the visual metadata (image, rating, tags) a card view needs and the cross-references (country to state to city, trip to place) a plain list cannot show. §2 answers that.

## 2. Architectural placement

Three options, in increasing order of how much new code they need:

**A. Nothing plugin-side.** Folders, core search, a saved query per type. Zero new code. Rejected: the result is a text list with no images and no dashboard, every relationship stays an unresolved string, and nothing can derive a value (a country's "visited", a trip's status) because nothing is reading the notes as a model.

**B. One generic entity registry.** A user-configured list of "folder plus `type:` value plus which frontmatter keys to show as columns", rendered as uniform rows for any type a vault cares to declare. Open-ended, cheap, and genuinely the right shape for entities the plugin knows nothing about.

**C. A typed travel module.** A fixed set of entity types with a real resolved model behind them (`src/vault/types.ts`), one gallery, one dashboard, and creation modals that know what each type needs.

**Recommendation: C, built out of reusable pieces rather than one-off code per view.** Reasoning:

- A generic registry cannot model what these entities actually do. Country, State and City form a reference cycle that has to be resolved in two passes; a Trip's stops point at any of five place kinds and have to know which kind they landed on; "visited" is derived from other notes rather than stored. Those are behaviors, not columns, and "N configured display columns" has no way to express them. The gallery's facets have the same problem: Travel-Status and Review-Status make sense only for a Trip, `visited` only for the types that have it.
- The entity set is fixed and the plugin writes it. A registry exists so a vault can invent its own types; here the plugin invents them, so the flexibility a registry buys is flexibility nobody uses, paid for with a settings surface nobody wants to fill in.
- It should still reuse rather than reimplement. The card shell (image, meta row, actions menu), the read-only star row, the singleton-leaf helper and the modal shell are one implementation each, in `src/ui/components/` and `src/shared/`, called by every view and modal that needs them. That is what keeps option C from meaning "one view class per type".
- **Person** is the one deliberate exception to "this module owns its own entities", see §4.

## 3. Data model

Frontmatter property names are, per this plugin's repeatedly-stated convention, all configurable settings with sensible defaults. The table below shows the defaults, not hardcoded literals. Every note also gets the standard header (`type`, `created`, `modified`); the templates originally drafted `updated` instead of `modified`, which is fixed everywhere, per §9.

Every `type:` value below is lowercase and unquoted, matching the fixed-type convention used throughout the plugin (`TRAVEL_ENTITY_TYPES` in `src/vault/entity-types.ts`). See §9 for why an earlier draft of this table had these capitalized and quoted instead, and why that was wrong.

| Entity | `type:` value | Key fields (current draft) | Reusable across Trips |
|---|---|---|---|
| Trip | `trip` | `country` (wikilink), `geoLocation` (geo pair), `departure`, `return`, `travelType` (enum), `travelStatus` (enum), `reviewStatus` (enum), `rating` (1-5), `summary`, `icon`, `color`, `tags` | No |
| Country | `country` | `image`, `capital` (wikilink to a City), `states` (list of State wikilinks), `icon`, `color`, `tags`, plus a body "Destination-specific considerations" table (currency/driving side/power/religion/vaccinations/visa/water quality) moved here from Trip | Yes, linked from many Trips and place entities |
| State | `state` | `country` (wikilink, required), `capital` (wikilink to a City, optional), `cities` (list of City wikilinks, optional), `image`, `icon`, `color`, `tags` | Yes |
| City | `city` | `country` (wikilink, required), `state` (wikilink, optional, not every country has one), `geoLocation` (geo pair), `visited`, `lastVisit`, `image`, `icon`, `color`, `tags` | Yes |
| Accommodation | `accommodation` (fixed, the draft originally had the typo `'Accomodation'`) | `country`, `city` (wikilink, optional), `geoLocation`, `accommodationType` (Apartment/Hotel/House), `accommodationStatus` (Booked/Reserved/Cancelled/Not available), `visited`, `lastVisit`, `rating` (1-5), `icon`, `color`, `tags` | Yes, explicitly |
| FnB | `fnb` | `country`, `city` (wikilink, optional), `geoLocation`, `fnbType` (Bar/Cafe/Fast Food/Pub/Restaurant), `visited`, `lastVisit`, `rating` (1-5), `icon`, `color`, `tags` | Yes |
| Landmark | `landmark` | `country`, `city` (wikilink, optional), `geoLocation`, `visited`, `lastVisit`, `rating` (1-5), `icon`, `color`, `tags` | Yes |
| Location | `location` | `country`, `city` (wikilink, optional), `geoLocation` (renamed from `location`, see §9, resolved), `visited`, `lastVisit`, `rating` (1-5), `icon`, `color`, `tags` | Yes |
| Person | *(not a travel type: notes under `personsFolder` matching `personTypeValue`, default `person`)* | Name parts, relationship, marital status, address, phone numbers, `email`, `birthday`, `company` (wikilink), `aliases`, `tags`. The plugin reads the title and the tags and nothing else, so the rest of the shape is the vault's business | Yes, not owned here, see §4 |

`geoLocation:` (renamed from the draft's original `location:`, to stop it colliding with the Location entity's own name, resolved in §9) is a two-element array of strings pasted from a map view (`["48.2247911", "16.4559853"]`) rather than a single "lat,lon" string or two separate numeric fields. Worth keeping exactly as drafted, since it is clearly meant to be copy-pasted straight out of an existing map tool, and reformatting it would work against that. It is deliberately kept separate from the Country/State/City hierarchy fields on the same note: a place has both a *position in the hierarchy* and its own specific *coordinate*, not one or the other.

Country/State do not carry `visited`/`lastVisit` the way City and the four place types do. They are treated as pure grouping/reference entities, with "visited" tracked at the City/Landmark/FnB/Accommodation/Location level instead. Worth keeping in mind for the dashboard's "countries visited" stat in §7, which will need to derive "visited" for a Country from whether any City/Landmark/etc. under it is marked visited, since Country itself has no such field.

## 4. Person: reuse, don't duplicate

The draft `Template - Person.md` has no `Fields` section and is not listed in `Trip Planning.md`'s own structure list. It reads like a sketch of "what a Person note's frontmatter could look like", not a fully-specified travel entity the way the other six are. Its fields (name parts, relationship, contact details, birthday, employer) describe a general contact record, not something travel-specific.

They also describe something a vault very likely already has. A person is not a travel concept, and a travel plugin that creates Person notes to its own schema would end up competing with whatever the vault already uses for the same people, which is the one outcome worth avoiding: two definitions of a person that have to be kept in agreement by hand.

**Resolved: APERtrail owns no person registry and defines no Person entity type.** It reads Person notes out of one configured folder, `personsFolder` (default `CRM/People`), matched by the `personTypeValue` type value (default `person`) and optionally narrowed by `eligiblePersonTags`, a comma-separated tag filter read from `personTagProperty`. That is the whole contract, and it lives in `src/crm/persons.ts`. Three consequences worth stating:

- **An empty `eligiblePersonTags` means "everyone", never "nobody".** A vault that never touches the setting sees every person, which is a better failure mode than an empty participant list with no clue why.
- **The tags are compared the way a person writes them, not the way a string comparison would like them.** `shared/tag-filter.ts` ignores case, ignores a leading `#` on either side, and lets a parent tag admit its nested children, so `Familie` matches `familie`, `#Familie` and `Familie/Eltern` but never `FamilienFirma`. Each of those was a participant silently missing from the dropdown, which is the same failure the empty-means-everyone rule above guards against, one tag at a time.
- **`person` is not in `TRAVEL_ENTITY_TYPES`**, so the entity-type health check does not look for it, and the gallery has no Person filter. What the plugin needs a person for is the participant list on a trip, and that is a list of titles.
- **Nothing is ever written to a Person note.** A trip records who came; a person does not record which trips they went on.

`companiesFolder` and `companyTypeValue` exist alongside these as settings. Superseded: both are read, and Person and Company notes are created, browsed and health-checked. See `dashboard-split-and-crm.md`.

## 5. Settings surface (draft)

The folder model is deliberately not "each type gets its own independent folder anywhere in the vault". The tree should relocate as a unit, because these notes are only ever used together, and moving nine folders one at a time to achieve one move is a settings surface that punishes the common case.

- **Three module roots**, `tripsFolder`, `placesFolder` and `crmFolder`, with an optional common parent above all three, `rootFolder`, defaulting to `''` (the vault root). Every sub-folder derives from its module root: `countriesFolder`, `statesFolder`, `citiesFolder`, `accommodationFolder`, `fnbFolder`, `landmarksFolder`, `locationsFolder` under Places; `personsFolder` and `companiesFolder` under CRM. Each is still independently overridable, per the "every folder name is a setting" convention, but the derivation is what makes a module relocate in one step instead of nine. It also means a sub-folder setting added *later* lands under the root the vault already chose, not under a pristine default.
- **Locale-aware folder defaults.** A German-locale install starts at `Reisen` / `Orte` / `CRM/Personen` rather than an English tree sitting next to an already-translated vault. Folder names are the only part of the defaults that gets translated, see §9.
- An entity-type table covering, per type: the `type:` value, the image/icon/color/rating property names, and which gallery facets apply (Country/visited/rating/tag for the place types and City; Travel-Status and Review-Status only for Trip; Country/State get no visited/rating facets at all, per §3)
- `typePropertyName` (default `type`), because the property that carries the type value is itself a property name, and the rule has no exceptions
- Ribbon icon visibility
- Frontmatter property-name overrides for the shared fields (`countryProperty`, `cityProperty`, `geoLocationProperty`, `visitedProperty`, `lastVisitProperty`, `ratingProperty`, and the rest), per the "every frontmatter property name is a setting" convention
- Person settings are a folder, a type value, a tag property and a tag filter, and nothing else. There is no person schema to configure here, per §4.

## 6. Gallery view design

One combined `TravelGalleryView` (`src/ui/gallery/travel-gallery-view.ts`) with a type-filter row, rather than one view class per type. A separate view per type was considered and rejected because most of the value (search, sort, "browse everything") is shared across types, and a type filter already solves "show me just Trips" without the maintenance cost of eight near-identical view classes. This is a confirmed decision, not just a recommendation, see §9.

- **Toolbar**: search input (fuzzy, over title) plus a type-filter row: All / Trip / Country / State / City / Accommodation / FnB / Landmark / Location
- **Facet filters**, shown and hidden based on the active type filter: Country (dropdown of existing Country notes, applies to every type below Country in the hierarchy), visited-only toggle (City and the four place types only, since Country/State have no `visited` field, per §3), minimum rating, tag, plus, only when filtered to Trip: Travel Status and Review Status. A facet that applies to every type stays applied across a type-filter change; a type-only facet is cleared on the way out of that type, because a filter you cannot see is a filter you have forgotten about.
- **Cards**: the shared entity card (`src/ui/components/entity-card.ts`), an image with a bottom title overlay and a 3-dot menu, plus:
  - a read-only star row when `rating` is set (`src/ui/components/star-rating.ts`, non-interactive)
  - a type-specific meta row: Trip shows departure date and Travel Status; City and the four place types show Country (plus State/City where applicable) and either the last-visit date or "not yet visited"; Country/State show a computed child-entity count instead ("4 States", "12 Cities"), since they have no visited state of their own
- Sort: title, last visited or departure date, rating

## 7. Travel Dashboard design

A `TravelDashboardView` (`src/ui/dashboard/travel-dashboard-view.ts`): greeting, quick actions, then one full-width section per entity type. Superseded: this view has since split into one dashboard per module, see `dashboard-split-and-crm.md`.

- **Quick actions row**: a search box that feeds the gallery, plus New Trip / New Accommodation / New Landmark / New FnB / New Location / New Country buttons, each opening a creation modal built on the shared modal shell (`src/ui/components/modal-shell.ts`). State and City creation is reachable from the gallery and from a Country note rather than getting its own top-level button, matching the fact that they get no dashboard section either. (Revised in use: see the build status table. Every creatable type has a button now.)
- **Stats row**: trip counts by Travel Status, a countries-visited count (derived, see §3's note on Country having no `visited` field of its own, so this counts distinct Countries with at least one visited City/Landmark/FnB/Accommodation under them), landmarks visited over total, and a "next trip in N days" countdown computed from the nearest future `departure:`
- **Sections**, one per entity type, each showing the top `SECTION_LIMIT` (6) cards with a "Browse all" footer button into the gallery pre-filtered to that type:
  - **Trips**, soonest-departing first (Planned/Booked only; Over trips excluded from this section and reachable via the gallery)
  - **Countries**, most recently visited-into first, via the same derived-visited logic as the stats row
  - **Accommodation**, **Landmarks**, **FnB**, **Locations**, **Cities**, sorted by rating where the type has one, falling back to most-recently-visited when unrated
  - **States** probably does not earn its own section. It is a pure grouping entity with no rating or visited state of its own, and it is reachable via the gallery's type filter and via its parent Country's note.
- No Persons section, consistent with §4. People are participants on a trip, not a collection this plugin curates.

## 8. Where the travel module plugs into the plugin

- **One `Plugin` subclass**, `APERtrailPlugin` in `src/main.ts`. There are no sub-modules and no `Component` indirection: `onload()` initializes the translation catalogue (every command name and view label resolves through `t()` synchronously, so the catalogue has to be in place first), loads the settings store, and then registers everything in one place. That is four views (`TRIP_DASHBOARD_VIEW_TYPE`, `PLACES_DASHBOARD_VIEW_TYPE`, `CRM_DASHBOARD_VIEW_TYPE`, `TRAVEL_GALLERY_VIEW_TYPE`), sixteen commands (three dashboards, open gallery, one New-entity command per creatable type, and the entity-type health check), three markdown code-block processors (`travel-itinerary`, `travel-related-trips`, `apt-photo-spot`), one ribbon icon and one settings tab.
- **Views get their dependencies as callbacks, not as a plugin reference.** Each view is constructed with a small object of functions (`getSettings()`, `openFile()`, `openEditTripModal()`, and so on), so a view never reaches back into the plugin instance and can be exercised without one. The view-type constants are exported from the view files themselves for the same reason.
- **Creation modals report back through one refresh path.** Nothing is cached and neither view subscribes to `metadataCache`, so after a modal writes a note the plugin calls a single `refreshAllViews()` that redraws whichever views happen to be open. The data is never stale; the pixels can be, until something asks for them again.
- **A Trip's stops and each place's "Related Trips" section are both just wikilinks.** Obsidian's own resolution keeps them in sync, per the "relationships are wikilinks, not IDs" convention in [Data model](data-model.md#frontmatter-conventions). No plugin-side sync code is needed, and the reverse direction is computed on read rather than written into the place note.
- **Country notes are referenced by every place-like entity's `country:` field**, which is why the "Destination-specific considerations" table belongs on the Country note rather than on a Trip (§9): a table of religion, driving side, power plugs and water quality describes the country, and putting it on the trip would mean retyping it on every future trip to the same place.

## 9. Open questions to resolve before implementation

Per `CLAUDE.md`: settings shape and naming, and how two features relate, are exactly the categories that should be confirmed rather than guessed.

### Resolved since the first draft of this plan

- ~~Country template is an unedited copy of the Trip template~~, fixed; Country now has its own fields (`capital`, `states`).
- ~~`type:` value casing is inconsistent~~, **resolved: lowercase, unquoted, everywhere** (`trip`, `country`, `state`, `city`, `accommodation`, `fnb`, `landmark`, `location`). An earlier draft of this plan had them capitalized and quoted (`'Trip'`, `'Country'`, ...). That is the wrong shape for a fixed vocabulary. These values are an enum baked into the plugin (`TRAVEL_ENTITY_TYPES`), written by the plugin itself and compared against on every read, not free text a vault invents; lowercase-unquoted is what YAML gives you when you type the value without ceremony, and it takes the "was that `Trip` or `trip`?" question out of every one of those comparisons. Person is unaffected: it is not one of the fixed types, and its type value is a setting (`personTypeValue`, default `person`) precisely because a vault may already spell it differently (§4).
- ~~"Accomodation" is misspelled~~, fixed; both the field label and the `type:` value now read `Accommodation`.
- ~~Person is not in `Trip Planning.md`'s structure list~~, fixed; Person (and the new State/City entities) are now listed.
- **Should the "Destination-specific considerations" table move from Trip to Country?** **Yes**, confirmed. Moved: a Trip's body no longer has this section, a Country's does, currently as an empty table shell. Populating it per country is new content to write, not a field to migrate.
- **Should Country's `capital:`/`states:` and State's `capital:`/`cities:` be formal wikilinks?** **Yes**, confirmed. `capital:` is a single wikilink to a City note; `states:`/`cities:` are lists of wikilinks. This is the shape a hand-built place hierarchy tends to arrive at anyway, see §10.
- **Should Accommodation/FnB/Landmark/Location gain an optional `city:` wikilink?** **Yes**, confirmed, alongside the existing `country:`, which is kept rather than derived so a place can still be filed by country alone when it is not inside a tracked City.
- **`Location` as both an entity-type name and a frontmatter field name**, resolved by renaming the geo-coordinate field to `geoLocation:` everywhere (Trip, City, Accommodation, FnB, Landmark, Location) rather than renaming the entity. A place needs *both* its position in the Country/State/City hierarchy *and* its own specific coordinate, so this is two distinct fields, not a collision to design around.
- **`updated:` vs `modified:`**, **resolved: use `created`/`modified`.** One pair of timestamp names across every entity, so a template, a reader and a writer never have to agree on the same idea twice. Every template now uses `modified:` instead of `updated:`. FnB's draft never had a `created:`/timestamp pair at all, an oversight in the original draft rather than a deliberate omission; it now has both, empty, matching every other entity.
- **Should Person become an entity this plugin owns?** **Resolved: no.** People exist in a vault for reasons that have nothing to do with travel, so a travel-owned Person would fork data that needs to stay one thing. Person notes are read out of a configured folder by type value instead. §4 is a confirmed decision, not just a recommendation.
- **Rating format**, **resolved: numeric 1-5 everywhere**, not star glyphs. Stars are a rendering decision, and §6 renders them read-only from the number. Storing them as text instead makes the value unsortable, unfilterable, and easy to get wrong: a hand-typed run of six glyphs on a five-point scale is not a hypothetical, it is what happens.
- **Evolving a vault's existing place hierarchy vs. standing up a parallel one**, **resolved: evolve it.** See §10 and §11. The plugin reads whatever names a vault already uses, because every property name is a setting, and the generic "place" note splits into the four separate Accommodation/FnB/Landmark/Location types.
- **One combined gallery with a type filter vs. one gallery per entity type**, **resolved: combined gallery**, per §6's original recommendation.

### None, every design question is now resolved

The two items that were still open both got explicit answers:

- **`type:` value casing**: lowercase, unquoted everywhere, matching the fixed enum the plugin writes (see the resolved bullet above, corrected from an earlier draft's mistaken assumption).
- **Frontmatter property names are English by default, and stay English in every locale.** `capital`, `states`, `cities`, `country`, `state`, `city`, `geoLocation`, `visited`, `lastVisit`, `rating` and the rest are the real settings defaults in `src/settings/defaults.ts`. Folder names are the part that gets localized: `getLocalizedFolderDefaults()` starts a German-locale install at `Reisen`, `Orte` and `CRM/Personen` instead of an English tree sitting next to an already-translated vault. Property names are not translated, and that asymmetry is deliberate. A folder name is something you look at, so seeing it in your own language is worth something; a property name is a contract the plugin and the note have to agree on exactly, and one canonical default plus a per-property override setting is a much smaller surface than a translation table per locale that both sides then have to resolve identically. A vault that wants German property names sets them, one setting each, and nothing in the defaults gets in the way.

§11's reconciliation pass therefore has a fully specified target: English property names, lowercase-unquoted `type:` values, the generic place type split into four, wikilink capitals/states/cities, `city:` added, `geoLocation:` named, numeric 1-5 ratings, and `created`/`modified` timestamps, all in one pass per note.


## 10. Reconciling with a vault's existing place hierarchy, resolved (mostly)

A vault that has been keeping places by hand before this plugin existed usually already has some version of the same tree: a country note listing its states, a state note listing its cities, a city note listing the places in it, a link back up at each level, and one generic "place" note covering restaurants, hotels, sights and everything else, told apart only by a free-text category field. Country and State notes in that shape tend to be rich prose reference content (history, economy, sights) rather than compact planning cards.

The names on those fields are whatever the vault decided. A German-language vault, for instance, would plausibly spell them `hauptstadt:`, `bundeslanderKantone:`, `stadte:` and `orte:` going down, with `land:`, `bundeslandKanton:` and `stadt:` pointing back up, and store a rating as a run of star glyphs (`bewertung: ⭐⭐⭐⭐⭐`). None of that is exotic, and none of it is wrong. It is simply what you get when the vault, not a plugin, named the fields, and it is the concrete reason every property name in §5 is a setting: pointing seven settings at seven existing names is a far smaller ask than renaming every note in the vault. The [sample vault](sample-vault.md), `APERtrail-Sample`, shows the other end of the same range, running on the English defaults unchanged.

**Resolved: evolve an existing hierarchy rather than build a parallel one.** A plugin that insists on its own tree next to the one already in the vault produces two answers to "where do my places live", and the vault owner maintains both. The eight resolved decisions in §9 (wikilink capitals and states, `city:` on place entities, the `geoLocation:` name, `created`/`modified`, numeric ratings, the combined gallery) are improvements to apply *to* an existing country/state/city/place tree, not the shape of a separate new system.

**Also resolved: a module's tree relocates as one unit, not per type.** This is why §5 models folders as three module roots with derived sub-folders rather than nine independently-placeable paths: these notes are only ever used together, and the common operation is "move the whole thing", not "move Landmarks".

**Resolved: the generic place type splits into four separate types** (Accommodation, FnB, Landmark, Location), each with its own fixed fields, rather than one merged Place type with a category enum. The four differ in what they need to store, not just in what they are called: Accommodation has a booking status and check-in dates, FnB has a kind of establishment, Landmark and Location have neither. A single type with an enum would mean every place note carrying every other place type's fields, empty. The cost is that reconciling an existing vault means reclassifying notes, not just relabelling them, which §11 sketches.

## 11. Migrating an existing place hierarchy

Because the generic place type splits into four rather than staying merged (§10), a vault arriving from that shape has to reclassify its place notes, not just rename fields. A rough shape for that pass:

- **Inventory the real category values first** rather than assuming the five-value FnB enum drafted in §3 (Bar/Cafe/Fast Food/Pub/Restaurant) already covers everything on disk. Real vaults have place notes that fit none of the four cleanly, a fashion outlet being the obvious example, and those fall to Location by default rather than to a confident match.
- **Accommodation is unambiguous wherever it applies** (it is lodging or it is not), but a generic place schema has no booking-status or type fields at all, so reclassified notes start with `accommodationType`/`accommodationStatus` unset rather than backfilled from anything.
- **Landmark vs. Location is the one genuinely judgment-based split**, the same judgment any newly-created note needs going forward. There is no existing field to derive it from mechanically.
- Every reclassified note also picks up the other §9 changes at the same time: the `type:` value, a `city:` wikilink (derivable from whatever the existing pointer to the parent city is called), `geoLocation:` (frequently absent, since a hand-built hierarchy tends to locate a place implicitly through its parent city), a numeric 1-5 rating converted from whatever the rating was stored as, and `created`/`modified` timestamps.
- Country, state and city notes get a lighter pass: the `type:` value goes lowercase (`country`/`state`/`city`), and the hierarchy fields either get renamed to the English defaults settled in §9 (`capital:`/`states:`/`cities:`) or, just as valid, stay where they are and the matching settings get pointed at them. Their prose bodies carry over unchanged either way.

This is one-time work over real notes, and it belongs to the vault owner rather than to the plugin. There is no migration code, and there should not be: the plugin never rewrites a note it was not asked to write, per the "notes are the source of truth, never silently mutated" principle in [Data model](data-model.md). A vault doing this at scale is better served by a reviewable script that reads every note, proposes the new frontmatter, and waits for a yes.
