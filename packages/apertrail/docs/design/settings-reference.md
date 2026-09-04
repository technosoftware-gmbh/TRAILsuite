# Settings reference

APERtrail has one settings page (**Settings -> APERtrail**), and it is one scrolling page rather than a tab strip. Tabs put every group at the same distance from the eye, which is only fair when the groups are equally important, and these are not: the folders and the property names are set once when a vault is adopted and then left alone for years, while the four display switches are the only rows anybody comes back for. So the root page carries the switches, and the two long lists sit behind a row that says how many are in them.

```
Plugin block          version and release notes, support, help and contact
Vault setup           Folders >          14 folders
                      Property keys >    41 keys, locked
                      Entity type check  [Run check]
Dashboard             ribbon icon, Open dashboard
Photo spots           sun times
People                eligible person tags
About                 what it is, links, version, author, licence
```

`src/settings/settings-tab-shell.ts` owns the drill-down (which sub-page is open, the back header, the repaint) and nothing else. `src/settings/settings-tab.ts` says what is on each page. Every row is drawn by a helper in `src/ui/settings/rows.ts`, and every row naming something inside a note is drawn by `src/ui/settings/property-row.ts`, which is where the read-only lock lives.

Which sub-page is open is deliberately not persisted, and is reset when the page closes: it is where somebody is looking right now rather than a preference.

Every field's exact name and type is in `src/settings/types.ts`; the defaults are in `src/settings/defaults.ts`.

The groups below are the page's own headings, in on-screen order.

## Vault setup

### Folders (sub-page)

APERtrail is laid out in three modules, and the folder settings follow that shape one for one:

```
Trips/                      one note per trip
Places/                     everything a trip can point at
  Countries/ States/ Cities/
  Accommodation/ Food & Beverages/ Landmarks/ Locations/ Photo Spots/
CRM/
  People/ Companies/
```

On the sub-page the common parent comes first, and the rest are grouped under three module headings, Trips, Places and CRM, in that order. Every field has Obsidian's folder autocomplete. The German-locale defaults are in the locale table further down.

| Setting | Default | What it holds |
|---|---|---|
| `rootFolder` | *(empty)* | Optional common parent above all three modules. Empty means the vault root |
| `tripsFolder` | `Trips` | `type: trip` notes |
| `bookingsFolder` | `Trips/Bookings` | Where a `type: booking` note goes when its trip has no folder of its own. Bookings are read from here **and** from every trip folder |
| `tripBookingsSubfolder` | `Bookings` | The folder a trip keeps its bookings in, inside the trip's own folder. Blank puts every booking in `bookingsFolder` |
| `tripExportsSubfolder` | `Exports` | The folder a trip keeps its exported sheets in, inside the trip's own folder. Blank writes them beside the note |
| `placesFolder` | `Places` | The Places module root; the eight folders below derive from it |
| `countriesFolder` | `Places/Countries` | `type: country` notes |
| `statesFolder` | `Places/States` | `type: state` notes |
| `citiesFolder` | `Places/Cities` | `type: city` notes |
| `accommodationFolder` | `Places/Accommodation` | `type: accommodation` notes |
| `fnbFolder` | `Places/Food & Beverages` | `type: fnb` notes |
| `landmarksFolder` | `Places/Landmarks` | `type: landmark` notes |
| `locationsFolder` | `Places/Locations` | `type: location` notes |
| `photoSpotsFolder` | `Places/Photo Spots` | `type: photospot` notes |
| `crmFolder` | `CRM` | The CRM module root |
| `personsFolder` | `CRM/People` | The folder scanned for Person notes |
| `companiesFolder` | `CRM/Companies` | The folder scanned for Company notes |

`rootFolder` is **optional and empty by default**, which is what makes the three modules sit at the vault root on a fresh install rather than under a tree nobody asked for. Set it to `4 Resources/Travel` and all three move underneath it in one step. `joinFolder()` (trail-core's `paths/folders.ts`) drops empty segments when composing a path, so an empty root produces `Trips` rather than `/Trips`.

Each of the three module roots is the anchor for its own sub-folders: repoint `placesFolder` and the eight place folders follow, repoint `crmFolder` and People and Companies follow. That is what "each module moves as a unit" means in practice, and it is the reason the sub-folder defaults are derived in `getLocalizedFolderDefaults()` rather than written out as independent literals.

A sub-folder setting a saved `data.json` has never carried falls back under the **saved** module root rather than the pristine default one, so a vault that relocated its Places tree gets a newly added place type inside it. The saved root is the vault owner's answer to "where does this module live", and that answer has to apply to sub-folders that did not exist when they gave it. `tests/settings.test.ts` pins this.

Only the folder *name* comes from the locale; the plugin cannot know which language a vault names its folders in, so the names come from the locale catalogue under `settings.folders.defaults.*`:

| Key | English | German |
|---|---|---|
| `rootFolderPath` | *(empty)* | *(empty)* |
| `tripsFolderName` | `Trips` | `Reisen` |
| `placesFolderName` | `Places` | `Orte` |
| `countriesFolderName` | `Countries` | `Länder` |
| `statesFolderName` | `States` | `Bundesländer` |
| `citiesFolderName` | `Cities` | `Städte` |
| `accommodationFolderName` | `Accommodation` | `Unterkünfte` |
| `fnbFolderName` | `Food & Beverages` | `Essen & Trinken` |
| `landmarksFolderName` | `Landmarks` | `Sehenswürdigkeiten` |
| `locationsFolderName` | `Locations` | `Sonstige Orte` |
| `photoSpotsFolderName` | `Photo Spots` | `Fotospots` |
| `crmFolderName` | `CRM` | `CRM` |
| `personsFolderName` | `People` | `Personen` |
| `companiesFolderName` | `Companies` | `Firmen` |

A German install therefore starts at `Reisen/`, `Orte/Länder`, `CRM/Personen` and so on. `Sonstige Orte` reads as "other places" rather than the bare `Orte` an English `Locations` would translate to, because `Orte` is already the module root one level up and a folder cannot be its own parent's name without being confusing to read.

Once saved, each sub-folder is an independent path. Relocating a module root later does not rewrite children that are already saved. A folder left blank is skipped by both the reader and the health check rather than being treated as the vault root.

### CRM type values and properties

These live under **People and companies** on the Property keys sub-page, except `eligiblePersonTags`, which is a filter rather than a name and sits in the People section of the root page. APERtrail keeps no contact registry: a Person or a Company is a note in the configured folder carrying the configured type value (`src/crm/read-crm.ts`).

| Setting | Default | What it does |
|---|---|---|
| `personTypeValue` | `person` | The value under `typePropertyName` that marks a Person note |
| `companyTypeValue` | `company` | The value that marks a Company note |
| `personTagProperty` | `tags` | Which frontmatter property a Person's tags live under |
| `companyTagProperty` | `tags` | The same for a Company |
| `personRolesProperty` | `roles` | Which property a Person's roles live under |
| `companyRolesProperty` | `roles` | The same for a Company. One key each rather than one shared, the same split the tag properties take |
| `eligiblePersonTags` | *(empty)* | Comma-separated tags narrowing the trip editor's participant list. **Empty means no filter**, so every Person is offered. Matched by trail-core's `crm/tags.ts`: case-insensitively, with a leading `#` ignored on both sides, and a parent tag admitting its nested children (`Familie` matches `Familie/Eltern`, not the reverse, and never `FamilienFirma`) |
| `descriptionProperty` | `description` | One-line description shown on a person or company card |
| `emailProperty` | `email` | Email address on either type |
| `phoneProperty` | `phone` | A company's phone number |
| `mobileProperty` | `mobile` | A person's mobile number |

Person and Company get a tag property each rather than sharing one. Collapsing them into a single `tagProperty` would be tidier, but it renames a shipped setting and needs a migration, and two symmetric settings cost nothing.

Unlike the nine travel type values, which are fixed literals in the source, both CRM type values are settings. A vault whose people notes say `type: Kontakt` points `personTypeValue` at that and renames nothing on disk. A **blank** type value matches nothing rather than everything: clearing it says "I have no such notes", not "treat every note in that folder as one".

`eligiblePersonTags` is the one text field on the page that accepts an empty value instead of falling back to its previous one, because empty is a meaningful setting here rather than a mistake to correct. A vault that never touches it would otherwise get an empty person list with no clue why, which is worse than being offered one person too many.

**CRM notes are created but never edited**, the same deal every travel type gets: **New person** and **New company** write a note with the fields you filled in, and nothing in the plugin touches it afterwards. `address` and `website` are deliberately shared with the place types rather than duplicated for CRM: a street address is a street address whether it belongs to a restaurant or to the company that runs it.

Both creators refuse rather than guess when their folder or type value is blank. A note written at the vault root, or with no type value in it, would be invisible to the reader that just created it, so an explicit error beats a note you cannot find.

### Note identification

The first group on the Property keys sub-page.

| Setting | Default | What it does |
|---|---|---|
| `typePropertyName` | `type` | The frontmatter property every entity is identified by |
| `unlockPropertyNames` | `false` | Whether the page will let a property name or a type value be typed into. Its row is the first thing on the Property keys sub-page, and it appears nowhere else |

**Every property name and type value on that page is read-only until that switch
is on.** They remain settings, because two plugins share the CRM notes and
have to agree on what the type property is called, and because a vault whose
notes already use other names should never have to rename anything on disk. But
changing one migrates nothing: APERtrail starts asking each note for a property
none of them carries, so a trip loses its dates and a place loses its
coordinates, with no error anywhere, because a property no note has is not an
error. Turn it on to match names a vault already uses, then turn it off again.
Folder settings are not covered, because repointing a folder is reversible in a
way renaming a property is not. `tests/property-name-lock.test.ts` fails if a
property row is ever wired into a hand-built text box that skips the lock, and
if the switch is ever drawn anywhere but on the page holding the rows it
governs. The root page's Property keys row says which state the switch is in,
because that is the one thing about the page worth knowing before opening it:
it is why a field there refuses to be typed into.

The nine recognized values are listed inline below the field: `trip`, `country`, `state`, `city`, `accommodation`, `fnb`, `landmark`, `location`, `photospot`. Those values are fixed; only the property name is configurable.

### Frontmatter properties

The **Property keys** sub-page holds every top-level frontmatter name the plugin reads or writes, grouped by the note type that carries them: note identification, places and shared fields, trips, photo spots, people and companies. A vault with pre-existing naming conventions never has to rename its notes. Each falls back to its previous value if you clear it.

The catalogue in `src/ui/settings/page-property-keys.ts` *is* the page: adding a property to `settings/types.ts` means adding a line there and a label to both locales, and nothing else. The only names it leaves out are the `*Field` settings that name a sub-key inside a list entry; those are the shape of a value rather than a property of a note, and the page says so in a line at the bottom.

The shared and per-note-type names, and where each one appears:

| Setting | Default | On |
|---|---|---|
| `countryProperty` | `country` | Trip, State, City, all five place types |
| `stateProperty` | `state` | City |
| `cityProperty` | `city` | All five place types |
| `capitalProperty` | `capital` | Country, State |
| `statesProperty` | `states` | Country |
| `citiesProperty` | `cities` | State |
| `geoLocationProperty` | `geoLocation` | City, all five place types |
| `addressProperty` | `address` | All five place types |
| `websiteProperty` | `website` | All five place types |
| `ratingProperty` | `rating` | Trip, all five place types |
| `visitedProperty` | `visited` | City, all five place types |
| `lastVisitProperty` | `lastVisit` | City, all five place types |
| `createdProperty` | `created` | Stamped once at creation, see below |
| `modifiedProperty` | `modified` | Trip and Photo spot; stamped on every editor save, and by the health check's type fix |
| `departureProperty` | `departure` | Trip |
| `returnProperty` | `return` | Trip |
| `travelTypeProperty` | `travelType` | Trip |
| `travelStatusProperty` | `travelStatus` | Trip |
| `reviewStatusProperty` | `reviewStatus` | Trip |

`createdProperty` names the creation stamp: every creation path writes it once, directly after the type value, no edit ever rewrites it, and nothing reads it back. Clearing the name skips the stamp entirely.

### Money

| Setting | Section | Default | What it does |
|---|---|---|---|
| `budgetEnabled` | Money | `true` | Master switch for the trip costs block, the dashboard budget tile and the itinerary cost chips. Off leaves booking notes as ordinary notes |
| `homeCurrency` | Money | `CHF` | What a trip is assumed to plan in when neither the booking nor the trip says. The one figure in the money feature that starts as a guess |
| `displayLocale` | Money | *(empty)* | The convention figures and dates are drawn in, as a BCP 47 tag. Empty follows this computer. Separate from the interface language, which answers a different question: every German locale writes `100.120,20` where Switzerland writes `100'120.20`. Shared with the other two plugins through trail-core's `DISPLAY_CONTRACT` |
| `currencyOptions` | Money | `CHF, EUR, USD` | The codes the money dropdowns offer, in that order. Comma separated. The home currency, and whatever a note already holds, are always offered on top of this, so a cleared list still leaves every field usable |

### Display

Whose conventions the plugin writes in. Three rows, above the switches, because the first of them decides what the rest of the page reads like.

| Setting | Default | What it does |
|---|---|---|
| `language` | `auto` | The UI language. `auto` follows Obsidian's own. It is read before anything else at load, because the folder defaults a first run seeds are localized, and a vault cannot rename them afterwards by itself |
| `clockFormat` | `auto` | `auto`, `24h` or `12h`. `auto` lets the locale decide, which is what an English-base plugin should do rather than pinning 24-hour times for every reader. Sun times stay in the spot's own zone whichever is chosen |
| `units` | `metric` | `metric` or `imperial`. Distances only: how far a motif sits from its anchor, and how far apart two conflicting stops are. Nothing stored changes |

### Dashboard, Photo spots, People

Three small cards on the root page rather than one, because these settings have nothing to do with each other beyond being switches.

| Setting | Section | Default | What it does |
|---|---|---|---|
| `showRibbonIcon` | Dashboard | `true` | Shows or hides the ribbon's map icon. The icon is built once at load and toggled by a CSS class, so this takes effect immediately |
| `sunTimesEnabled` | Photo spots | `true` | Master switch for the light panel, the clock times on a motif's light chips, the front/side/back-lit badges and the itinerary's sun band. Off leaves photo spots as plain place notes |
| `eligiblePersonTags` | People | *(empty)* | The participant filter described above |

**Open dashboard** sits in the Dashboard card; **Run check** for the [entity type health check](../features/travel.md#entity-type-health-check) sits at the bottom of Vault setup, with the folders it scans.

The golden-hour and blue-hour elevation thresholds behind `sunTimesEnabled` are deliberately **not** settings. Every consumer has to agree on the same boundaries or they contradict each other on screen, and a vault that disagrees by half a degree gains nothing it can use.

## Trip structure settings

The Trip schema's own property names are real settings, honored by both the reader and the writer. The **top-level** ones -- `tripCitiesProperty`, `personsProperty`, `tripDaysProperty`, `stopsProperty`, `nightsProperty`, `transportProperty`, the four presentation ones, `tripSubtitleProperty`, `imageProperty`, `tripHighlightsProperty` and `tripGalleryProperty`, and the money three, `tripCurrencyProperty`, `budgetProperty` and `ratesProperty` -- have rows in the Trips group of the Property keys sub-page. The `*Field` sub-keys do not: they name a key **inside a list entry** rather than a property of a note, and forty more rows would have cost the page its readability without answering a question anybody asks. Change those by editing `data.json`; `mergeSettings()` validates them on load like everything else.

| Setting | Default | What it names |
|---|---|---|
| `tripCitiesProperty` | `cities` | The Cities a Trip touches |
| `personsProperty` | `persons` | The Trip's participants |
| `tripDaysProperty` | `days` | A **sparse** list: only a day that has a name or a paragraph of its own has an entry, and no stop belongs to a day object |
| `dayNumberField` | `day` | Sub-key: which day the entry is about. The key, not a position in the list |
| `dayTitleField` | `title` | Sub-key: what the day is called, shown after the day number in the header |
| `dayNoteField` | `note` | Sub-key: the day's own paragraph, printed above its lines |
| `stopsProperty` | `stops` | The itinerary list |
| `stopPlaceField` | `place` | Sub-key: the stop's target |
| `stopDayField` | `day` | Sub-key: which day of the trip, for an itinerary written before the dates are known. When set, `from`/`to` carry a bare `HH:mm`. See [Relative days](relative-days.md) |
| `stopFromField` | `from` | Sub-key: start time |
| `stopToField` | `to` | Sub-key: end time |
| `stopNoteField` | `note` | Sub-key: per-visit note |
| `stopRatingField` | `rating` | Sub-key: per-visit rating |
| `stopMotifField` | `motif` | Sub-key: which motif at a photo spot the stop is for. Matched against the spot's motif names, trimmed and case-insensitively; an unmatched name is kept and shown rather than dropped |
| `stopCostField` / `stopCurrencyField` | `cost` / `currency` | Sub-key: what an entry, guide or cable car costs |
| `stopCostUnitField` | `costUnit` | Sub-key: what that figure is per |
| `stopPersonsField` | `persons` | Sub-key: who is on this stop; empty means everybody |
| `tripCurrencyProperty` | `currency` | What the trip plans its budget in |
| `budgetProperty` | `budget` | The plan: a list of `{category, amount}` |
| `budgetCategoryField` / `budgetAmountField` | `category` / `amount` | Sub-keys of a budget line |
| `ratesProperty` | `rates` | Conversion rates: a list of `{currency, rate}` |
| `tripSubtitleProperty` | `subtitle` | What the trip is, under what it is called |
| `imageProperty` | `image` | The picture a card shows, on every entity type. Was a hardcoded key |
| `tripHighlightsProperty` | `highlights` | A list of lines, in the order they should read |
| `tripGalleryProperty` | `gallery` | A list of `{image, caption}` |
| `galleryImageField` | `image` | Sub-key: the picture |
| `galleryCaptionField` | `caption` | Sub-key: what to say about it |
| `rateCurrencyField` / `rateValueField` | `currency` / `rate` | Sub-keys of a rate |
| `nightsProperty` | `nights` | The accommodation-stays list |
| `nightAccommodationField` | `accommodation` | Sub-key: which Accommodation note |
| `nightCheckInField` | `checkIn` | Sub-key: check-in date |
| `nightCheckOutField` | `checkOut` | Sub-key: check-out date |
| `nightCheckInDayField` | `checkInDay` | Sub-key: which day of the trip the stay starts on. See [Relative days](relative-days.md) |
| `nightCheckOutDayField` | `checkOutDay` | Sub-key: which day it ends on. The nights between the two are what a per-night cost multiplies |
| `nightCostField` | `cost` | Sub-key: what the stay is expected to cost |
| `nightCurrencyField` | `currency` | Sub-key: the currency that figure is in |
| `nightCostUnitField` | `costUnit` | Sub-key: per night, in total, or per person |
| `nightPersonsField` | `persons` | Sub-key: who the stay is for; empty means everybody |
| `transportProperty` | `transport` | The transport-legs list |
| `legDirectionField` | `direction` | Sub-key: `outbound` or `inbound` |
| `legModeField` | `mode` | Sub-key: train, plane, car, ... |
| `legCarrierField` | `carrier` | Sub-key: the airline, the railway, or the train's own name. Free text, or a wikilink when the vault has a note for it |
| `legFromField` | `from` | Sub-key: departure time |
| `legToField` | `to` | Sub-key: arrival time |
| `legDayField` | `day` | Sub-key: which day of the trip the leg departs on. 0 and negative are allowed, for a flight leaving the evening before day one |
| `legToDayField` | `toDay` | Sub-key: which day it arrives on. A later day prints as `+1` on the arrival time rather than as a stop |
| `legOriginField` | `origin` | Sub-key: where the leg departs from |
| `legDestinationField` | `destination` | Sub-key: where it arrives |
| `legReferenceField` | `reference` | Sub-key: booking or ticket reference |
| `legCostField` | `cost` | Sub-key: what the leg is expected to cost |
| `legCurrencyField` | `currency` | Sub-key: the currency that figure is in |
| `legCostUnitField` | `costUnit` | Sub-key: per person, or in total |
| `legPersonsField` | `persons` | Sub-key: who is on this leg; empty means everybody |

The three `cost` sub-keys are estimates, not bookings: they are what a trip
believes a line will cost before there is anything to book. A booking that
carries the same `reference` (a leg) or names the same place (a stop or a
night) takes the estimate over, and the estimate stops counting from that
moment.

Each `cost` is qualified by a `costUnit`, whose four values are a fixed
vocabulary rather than a setting: `total`, `person`, `night` and
`personNight`. An airline quotes per passenger and a hotel quotes a room per
night, so the figure alone cannot say what it means. Absent or unrecognized
reads as `total`, the only reading that cannot silently inflate a hand-typed
number; the editors write the unit explicitly on anything they create.
`persons` names who the line is for, and an empty list means everybody on the
trip, which is why it is never written empty.

### Booking structure

A booking's twelve property names all have rows, in the Bookings group of the
Property keys sub-page. Unlike the trip and photo spot structures there are no
sub-key settings here, and that is the point of the shape: everything on a
booking is a top-level scalar or a list of links, which is what lets Obsidian's
own property editor be the editor and what saved this feature a whole block.

| Setting | Default | What it names |
|---|---|---|
| `bookingTripProperty` | `trip` | Which trip the booking belongs to |
| `bookingCategoryProperty` | `category` | Fixed vocabulary; only the name is a setting |
| `bookingStatusProperty` | `status` | Fixed vocabulary; decides which total the figure counts in |
| `bookingSupplierProperty` | `supplier` | The Company note behind it |
| `bookingPlaceProperty` | `place` | What puts the cost on an itinerary row |
| `bookingDateProperty` | `date` | The day the cost belongs to |
| `bookingAmountProperty` | `amount` | What it costs. Absent is not zero |
| `bookingCurrencyProperty` | `currency` | Absent inherits the trip's, then `homeCurrency` |
| `bookingReferenceProperty` | `reference` | Also what matches a booking to a transport leg |
| `bookingPayerProperty` | `payer` | Who actually paid |
| `bookingForProperty` | `for` | Who the cost is for. Absent means every participant |
| `bookingDocumentProperty` | `document` | The confirmation file in the vault |

### Photo spot structure

Same arrangement as the trip-structure settings above: the eight top-level
properties have rows in the Photo spots group of the Property keys sub-page,
and the `*Field` sub-keys do not. The five access fields are flat top-level properties rather than
sub-keys under one `access:` map, because Obsidian's property editor renders
top-level scalars and refuses nested maps, and each of these is a value
someone will want to edit in the sidebar.

| Setting | Default | What it does |
|---|---|---|
| `timezoneProperty` | `timezone` | IANA zone the spot's sun times are rendered in |
| `openingHoursProperty` | `openingHours` | Free text; `24h` renders as the round-the-clock badge |
| `entryFeeProperty` | `entryFee` | Free text; empty or `none` renders as "no entry fee" |
| `accessibilityProperty` | `accessibility` | `full` / `partial` / `none` / `unknown` |
| `parkingProperty` | `parking` | Free text, one line |
| `transitProperty` | `transit` | List of `{mode, detail}` rows |
| `transitModeField` / `transitDetailField` | `mode` / `detail` | Sub-keys of a transit row |
| `motifsProperty` | `motifs` | The list of motifs |
| `motifNameField` | `name` | Sub-key: what a sample's `motif` points back at |
| `motifRoleField` | `role` | Sub-key: `main` or `secondary` |
| `motifGeoField` | `geoLocation` | Sub-key: the motif's own coordinates, if it has any |
| `motifDirectionField` | `direction` | Sub-key: the bearing you shoot toward |
| `motifLightField` | `light` | Sub-key: light windows, ordered best-first |
| `motifSeasonField` | `season` | Sub-key: months, 1 to 12 |
| `motifLensField` / `motifGearField` | `lens` / `gear` | Sub-keys, both free text |
| `motifTechniqueField` / `motifNoteField` | `technique` / `note` | Sub-keys, both free text |
| `motifCapturedField` / `motifCapturedOnField` | `captured` / `capturedOn` | Sub-keys: whether you got the shot, and when |
| `samplesProperty` | `samples` | The list of sample frames |
| `sampleImageField` | `image` | Sub-key: vault path, wikilink or URL |
| `sampleMotifField` | `motif` | Sub-key: which motif this frame is of |
| `sampleLightField` / `sampleExposureField` / `sampleCreditField` | `light` / `exposure` / `credit` | Sub-keys |

The `*Field` settings name sub-keys **within a list entry**, not top-level frontmatter properties.

`tripCitiesProperty` is deliberately distinct from `citiesProperty`. The latter means "the Cities belonging to a State" and lives on State notes. Same word, different relationship, so they need separate settings even though both default to a `cities`-shaped name. It is the kind of pair that is one careless edit away from silently pointing two features at one property.

## Plugin block and About

The block above Vault setup is the only part of the page that is about the plugin rather than about a vault. It carries three rows: **What's new in APERtrail {version}**, whose button opens the release notes in a modal; **Support development**, linking to GitHub Sponsors and Buy Me a Coffee; and **Help and contact**, linking to the documentation, the issue tracker and support@technosoftware.com. Every URL is in `src/settings/links.ts` and spelled once.

The release notes are the package's own `CHANGELOG.md`, imported as a string at build time (esbuild loads `.md` as text; `src/types/markdown.d.ts` is what tells the typechecker so). A "what's new" panel that disagreed with the changelog would be worse than none, and this one cannot. Only the newest three releases are rendered; the link at the bottom of the modal is for the rest. Nothing here reaches the network.

About, at the bottom of the page, says how the plugin works (`settings.about.origins.text`: it keeps no data of its own, every view is derived from the vault as it is drawn), a link to the project, and the version, author and description read live from `manifest.json` rather than repeated anywhere in source, so a release bump has one place to change.

## Deliberately not settings

- **`TRAVEL_STATUS_VALUES`** (`Planned`/`Booked`/`Over`/`Cancelled`). Property *names* are configurable throughout; these are property *values*, and the dashboard's status counts, trip ordering and next-trip countdown key off the exact strings.
- **`accommodationType`, `accommodationStatus`, `fnbType`**, read at fixed names because they are subtype-specific rather than part of the shared place shape.
- **The three code-block languages**, `travel-itinerary`, `travel-related-trips` and `apt-photo-spot`, for the reasons in [Data model](data-model.md#code-block-languages-and-their-prefixes). The first two keep the `travel-` prefix because those strings already sit in users' notes; every block added since takes `apt-`.
- **A photo spot's fixed vocabularies**: light windows, motif roles and accessibility values. See [Photo spots](photo-spots.md#26-fixed-vocabularies).
- **A booking's category and status.** `transport`/`accommodation`/`activity`/`food`/`fees`/`other` and `estimate`/`booked`/`paid`/`cancelled`/`refunded`. A budget line, a total and a warning all key off these exact strings, so a vault that renamed one would have silently unbudgeted a category. See [Trip budget and bookings](trip-budget-and-bookings.md#44-fixed-vocabularies).
- **Exchange rates.** A rate is data on a trip, typed by its owner. Nothing fetches one, and there is no setting that could.
- **The plural categories a language has.** `Intl.PluralRules` answers that per locale; a translator writes the forms their language uses and nothing in the settings decides between them.

There is no persisted runtime state. Every field in `data.json` is configuration.
