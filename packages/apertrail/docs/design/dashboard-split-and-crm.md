# Plan: three dashboards, and People and Companies you can create

Status: **complete, and since superseded.** All eight steps shipped. §F
records what changed against the plan on the way in, step by step. See §D
for the order of work.

**§G records what undid it.** The CRM dashboard was retired on 28 August
2026 and the other two folded into the gallery on 2 September 2026, which
leaves the plugin with one view. The plan below is kept as written, because
what it decided about *content* -- which sections exist, what each stat tile
counts, what a creation modal collects -- all survived the fold; only the
question of how many views hold it was answered differently in the end.

Two changes, planned together because the second one needs somewhere to
live and the first one is what gives it that place:

1. Split the single dashboard into three, one per module (Trips, Places,
   CRM).
2. Make Person and Company notes something APERtrail creates, not only
   something it reads.

Decisions already taken (these are settled, the rest of the document
builds on them):

- **Three separate views**, each with its own view type, tab, icon and
  command. Not one view with a tab strip.
- **Sections split strictly by module.** The Trips dashboard shows trips
  and nothing else. Every place type, photo spots included, moves to the
  Places dashboard.
- **Creation modals collect a title plus a few core fields**, each backed
  by a configurable property-name setting.
- **Person and Company become first-class**: read layer, creation, CRM
  dashboard, gallery type filters, entity-type health check. They stay
  out of `TRAVEL_ENTITY_TYPES` and get their own list.
- **A Person note gets a related-trips block**, answering "which trips
  was this person on" from each trip's own `persons:` list. See §B.9.
- **The greeting stays on the Trips dashboard only.** Places and CRM
  need no heading either: the nav row's active chip names the view.
- **`companyTagProperty` is added** rather than collapsing both tag
  settings into one shared `tagProperty`. No rename, no migration.
- **The sample vault gains three people and three companies**, so the
  CRM dashboard has something to show. See §C.

Explicitly out of scope: linking a Company to the places it operates
(no `company:` property on place notes). It came up and was deferred.

---

## Part A: three dashboards

### A.1 View types and identity

| Dashboard | View type value | File |
|---|---|---|
| Trips | `apertrail-dashboard-view` (unchanged) | `src/trips/ui/trip-dashboard-view.ts` |
| Places | `apertrail-places-dashboard-view` | `src/places/ui/places-dashboard-view.ts` |
| CRM | `apertrail-crm-dashboard-view` | `src/crm/ui/crm-dashboard-view.ts` |

The Trips dashboard keeps the old view type **string** even though the
constant is renamed to `TRIP_DASHBOARD_VIEW_TYPE` and the file moves.
That string is written into every user's `workspace.json`; changing it
turns an open dashboard tab into "no view of type ...". Same argument
that keeps the `travel-itinerary` fence language spelled the old way:
it protects strings that already exist outside the plugin. The constant
gets a comment saying so.

Each view file moves into its own module folder rather than staying under
`src/ui/dashboard/`, per the architecture rule that a module owns what
only it needs. What all three share stays in `src/ui/dashboard/`.

### A.2 Shared shell

New `src/ui/dashboard/dashboard-shell.ts`:

- `APERtrailDashboardView`, an abstract `ItemView` subclass holding the
  parts all three repeat today: `navigation = true`, `onOpen()` calling
  `render()`, a public `refresh()`, and `renderShell()` which empties
  `contentEl`, adds `apt-dashboard-view`, draws the nav row and returns
  the `apt-dashboard-grid` element for the subclass to fill.
- Subclasses implement `getViewType()`, `getDisplayText()`, `getIcon()`
  and `renderContent(grid)`.

New `src/ui/dashboard/dashboard-nav.ts`: a chip row (Trips / Places /
CRM) at the top of every dashboard, the active one marked with
`is-active`, so the split does not cost a trip through the command
palette to get between them. New CSS class `apt-dashboard-nav`, plus
`apt-dashboard-nav-chip`. The shell draws it, so no view has to remember
to.

The nav needs every dashboard's view type, and each dashboard imports the
shell that draws the nav, so those constants live in their own
`src/ui/dashboard/dashboard-view-types.ts` rather than beside their
views. Otherwise the imports close into a cycle. Same arrangement, for
the same reason, as `trips/related-trips-block-lang.ts`.

New `src/ui/dashboard/dashboard-action-bar.ts`, generalized out of
today's `travel-quick-actions.ts`:

```ts
renderDashboardActionBar(container, {
  searchPlaceholder: string,
  onSearch: (query: string) => void,
  buttons: { icon: string; label: string; onClick: () => void }[],
  onRefresh: () => void,
})
```

`travel-quick-actions.ts` is deleted; each dashboard passes its own
button list. The search box stays on all three and keeps going to the
gallery, which is now the one place that spans modules.

### A.3 What each dashboard holds

**Trips** (`src/trips/ui/trip-dashboard-view.ts`)

- Greeting. The Trips dashboard is the home view (it keeps the ribbon
  icon and the old view type), so it is the one that greets you. The
  other two open on a plain module heading instead: three tabs all
  saying "Good morning" would read as a bug rather than a welcome.
- Action bar: search, New trip, Refresh.
- Stats: trips by status, next-trip countdown.
- Sections: Trips (unchanged content, including the extra "Edit" menu
  entry on trip cards).

Two stat tiles is a thin row where there were five. Candidates to fill
it, all derivable from data already read and none of them requiring new
frontmatter: trips this year, nights away this year, distinct cities
visited this year. Not included below; call it if you want one.

**Places** (`src/places/ui/places-dashboard-view.ts`)

- No greeting and no heading: the nav row's active chip already names the
  view, and so does the tab.
- Action bar: search, New photo spot, New accommodation, New landmark,
  New F&B, New location, New city, New state, New country, Refresh.
  Same ordering rule as today (rough frequency of use, photo spot
  second).
- Stats: countries visited, landmarks visited, photo spots captured.
- Sections, in this order: Photo Spots, Countries, Accommodation,
  Landmarks, Food & Beverages, Locations, Cities. States still get no
  section, for the reason already documented.

**CRM** (`src/crm/ui/crm-dashboard-view.ts`)

- No greeting and no heading, same as Places.
- Action bar: search, New person, New company, Refresh.
- Stats: people count, companies count.
- Sections: People, Companies.

### A.4 Stats split

`src/vault/travel-stats.ts` is today a single
`computeTravelDashboardStats()` producing one flat shape for one row.
Split it along the same module line as the views:

- `src/trips/trip-stats.ts`: `TripDashboardStats`
  (`tripCountsByStatus`, `nextTrip`), `computeTripStats(board)`.
- `src/places/place-stats.ts`: `PlaceDashboardStats` (countries visited
  and total, landmarks visited and total, photo spots captured and
  total), `computePlaceStats(board)`.
- `src/crm/crm-stats.ts`: `CrmDashboardStats` (person count, company
  count), `computeCrmStats(crmBoard)`.

Both travel halves keep taking a `TravelBoard`, so `src/vault/` does not
grow: the input stays cross-module, only the derivation moves to the
module that consumes it. `travel-stats.ts` goes away; the
`TRAVEL_STATUS_VALUES` re-export it carries moves to `trip-stats.ts`.

`travel-stats-row.ts` splits the same way into
`src/trips/ui/trip-stats-row.ts` and `src/places/ui/place-stats-row.ts`,
plus a new `src/crm/ui/crm-stats-row.ts`. The card-drawing helpers they
share (`apt-dashboard-stat-card--number` and its label) move to a small
`src/ui/dashboard/stat-card.ts` so a number tile is drawn once.

### A.5 main.ts

- Register three views instead of one. Each view file exports its own
  `...ViewDeps` interface, so `main.ts` builds three small objects
  instead of one thirteen-callback one.
- Commands: `open-dashboard` keeps its id (existing hotkeys survive) and
  gets a new label; add `open-places-dashboard` and `open-crm-dashboard`.
- Ribbon icon still opens the Trips dashboard. `showRibbonIcon` unchanged.
- `refreshAllTravelViews()` becomes `refreshAllViews()` and iterates all
  four view types.

### A.6 Files touched, Part A

Added: `ui/dashboard/dashboard-shell.ts`, `dashboard-nav.ts`,
`dashboard-action-bar.ts`, `stat-card.ts`; `trips/ui/trip-dashboard-view.ts`,
`trips/ui/trip-stats-row.ts`, `trips/trip-stats.ts`;
`places/ui/places-dashboard-view.ts`, `places/ui/place-stats-row.ts`,
`places/place-stats.ts`.

Removed: `ui/dashboard/travel-dashboard-view.ts`,
`travel-quick-actions.ts`, `travel-stats-row.ts`, `vault/travel-stats.ts`.

Kept where they are: `ui/dashboard/travel-dashboard-sort.ts` and
`travel-entity-meta.ts` (both are shared with the gallery),
`ui/components/section.ts`, `entity-card.ts`, `greeting.ts`.

Also: `styles.css` (nav row), `lang/en.ts` + `lang/de.ts`,
`docs/features/travel.md`, `docs/usage.md`, `docs/design/architecture.md`.

---

## Part B: People and Companies

### B.1 The rule this changes

Two documented positions have to be rewritten rather than quietly
contradicted:

- CLAUDE.md: "People are read, not owned. APERtrail has no person
  registry."
- CLAUDE.md: "CRM is half built ... Do not write code, docs or strings
  that imply it already works."

The new position: APERtrail still does not own a registry and still
discovers people and companies by folder plus configured type value.
Nothing about reading changes. What is added is a writer, on exactly
the same terms as the nine travel types: create a note in the configured
folder, with the configured type value, with minimal frontmatter, and
never touch it again. A vault that points `personsFolder` at a People
folder it already had keeps working exactly as before, and now has a
button that adds one more note in the shape that folder already uses.

### B.2 Types and entity list

New `src/crm/entity-types.ts`:

```ts
export const CRM_ENTITY_TYPES = ['person', 'company'] as const;
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number];

export const CRM_FOLDER_SETTING: Record<CrmEntityType, keyof APERtrailSettings> = {
  person: 'personsFolder',
  company: 'companiesFolder',
};

export const CRM_TYPE_VALUE_SETTING: Record<CrmEntityType, keyof APERtrailSettings> = {
  person: 'personTypeValue',
  company: 'companyTypeValue',
};
```

Note the asymmetry with `TRAVEL_ENTITY_TYPES`, and it is deliberate: a
travel type value is a fixed literal (`type: landmark`), a CRM type value
is a setting (`personTypeValue`, default `person`). CRM reads and writes
both go through the setting, never the literal. That is what lets the
folder stay a folder the vault already owned.

New `src/crm/types.ts`:

```ts
export interface CrmPerson {
  file: TFile; title: string;
  description: string | null;
  tags: string[];
  address: string | null;
  email: string | null;
  mobile: string | null;
}

export interface CrmCompany {
  file: TFile; title: string;
  description: string | null;
  tags: string[];
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
}

export interface CrmBoard { persons: CrmPerson[]; companies: CrmCompany[] }
```

The sample vault's People notes also carry `private:` and `work:` phone
fields. Left unread and unwritten: `mobile` is the one that is filled in
practice, and two more empty settings rows to read two fields nothing
displays is not a trade worth making. They stay hand-edited, like every
cosmetic field `create-entities.ts` already declines to write.

### B.3 Reading

New `src/crm/crm-note.ts`: the pure parser, `parsePersonRecord()` and
`parseCompanyRecord()` plus `crmPropertyNames(settings)`, taking a
frontmatter object and a property-name bundle and returning the record.
Same split as `trips/trip-note.ts` versus `trips/write-trip.ts`, and for
the same reason: it makes the parser testable with no `obsidian` mock.

New `src/crm/read-crm.ts`: `readCrmBoard(app, settings): CrmBoard`.
Folder scan by `isUnderFolder`, type match against the configured type
value, frontmatter through `frontmatterOf` and `findValue`, title-sorted.
Nothing cached, same as `readTravelBoard`.

`src/crm/persons.ts` is rewritten on top of `readCrmBoard()`:
`getPersonTitles()` and `getEligiblePersonTitles()` keep their exact
signatures, so the trip editor's person dropdown does not change, but
there is one reader instead of two folder scans that could drift. The
empty-tag-filter-means-everyone rule is preserved verbatim.

Housekeeping while in there: the tags parser now exists three times
(`persons.ts`, `read-entities.ts`, and about to be a third in CRM).
Move it to `shared/vault-scan.ts` as `readTagList()` and have all three
call it.

### B.4 Writing

New `src/crm/create-crm.ts`, mirroring `vault/create-entities.ts`:

```ts
createPersonNote(app, settings, { title, tags, email, mobile, address })
createCompanyNote(app, settings, { title, tags, website, email, phone, address })
```

Both build frontmatter with `buildFrontmatterBlock(typeProperty,
settings.personTypeValue, rest)`, omitting blank keys, and write through
`createNote()`. No body block for either. Two guards that the travel
creators do not need, because their folders and type values are
literals and these are not:

- Empty `personsFolder` / `companiesFolder`: refuse with a clear notice
  rather than writing to the vault root.
- Empty `personTypeValue` / `companyTypeValue`: refuse, since a note
  written without one would be invisible to the reader that created it.

`createNote()` already throws on an existing path, so the duplicate-name
case is covered.

### B.5 Modals

New `src/crm/ui/new-crm-entity-modal.ts`, one parameterized class over
both kinds, following `places/ui/new-place-modal.ts`'s precedent
(`CREATE_FN` / `TITLE_KEY` / `CREATED_KEY` / `ICON` records keyed by
kind). Icons: `user` and `building`.

Fields, per the decision above:

- Person: Title, Tags, Email, Mobile, Address.
- Company: Title, Tags, Website, Email, Phone, Address.

Tags is a comma-separated text input written out as a YAML list. It gets
a `<datalist>` of every tag already used in the CRM folders, collected
from `readCrmBoard()`, which costs one line and stops the third spelling
of "Friends" from appearing.

Commands added in `main.ts`: `new-person`, `new-company`.

### B.6 Settings

Existing and reused as-is: `personsFolder`, `companiesFolder`,
`personTypeValue`, `companyTypeValue`, `personTagProperty`,
`eligiblePersonTags`, `addressProperty`, `websiteProperty`.

New, all with English defaults matching the sample vault:

| Setting | Default | Read/written by |
|---|---|---|
| `descriptionProperty` | `description` | person + company card meta |
| `emailProperty` | `email` | person + company |
| `phoneProperty` | `phone` | company |
| `mobileProperty` | `mobile` | person |
| `companyTagProperty` | `tags` | company |

`companyTagProperty` is added rather than reusing `personTagProperty`,
whose name would then be a lie. Collapsing both into one `tagProperty`
was considered and rejected: it is tidier on paper, but it renames a
shipped setting and needs a migration, and the two are cheap to keep
symmetric.

`ui/settings/section-folders.ts`: the CRM section gains rows for the five
new property names, below the existing folder and type-value rows.
`settings/defaults.ts` and `settings/validate.ts` updated to match.

### B.7 CRM dashboard content

`src/crm/ui/crm-entity-meta.ts` (beside `ui/dashboard/travel-entity-meta.ts`
in role, in the CRM module by ownership): `personMetaItems()` and
`companyMetaItems()`, built from the same `EntityCardMetaItem` shape, so
a CRM card is the same card.

- Person: tags (`tag`), email (`mail`), mobile (`phone`), address
  (`navigation`).
- Company: tags, website host via the existing `shortUrl` helper (`link`),
  email, phone, address.

`shortUrl()` currently lives inside `travel-entity-meta.ts` as a private
function. It moves to `shared/` so both meta builders use one copy.

Sections use the existing `renderSection()` with the same
`SECTION_LIMIT` of 6, "Browse all" going to the gallery filtered to
`person` / `company`. Neither carries a rating, so `rating` stays
undefined and no rating row is drawn.

### B.8 Gallery

`TravelEntityTypeFilter` widens to include the two CRM types. Rename to
`GalleryTypeFilter`, since it now spans modules, keeping the old name as
a deprecated alias only if something outside the gallery still imports
it (it does not today, apart from the dashboard deps).

- `buildEntries()` also calls `readCrmBoard()` and appends person and
  company rows: `rating: null`, `visited: null`, `lastVisit: null`,
  `trip: null`, `photoSpot: null`, `countryTitle: null`, `tags`
  populated. The existing rule that an active facet excludes rows which
  cannot carry it then does the right thing for free: "places I have
  visited" will not list a person.
- Type filter row gains two buttons at the end, after `photospot`.
- Two new label keys, `galleryView.filters.person` and `.company`.

The gallery view type string is unchanged.

### B.9 Related trips on a Person note

"Which trips was Gaby on" is already answerable: every Trip carries a
`persons:` list of wikilink targets, and `TravelTrip.personTitles` holds
them. Nothing reverses that link today. A new Person note therefore gets
a related-trips block in its body, the same way a City or place note
does.

The block is the existing one. Its fence language stays
`travel-related-trips`: this is not a new block, it is the same block
rendering on one more kind of note, and that string is already written
into people's vaults. Do not give it an `apt-` twin.

`src/trips/related-trips.ts` gains a second pure lookup beside
`relatedTrips()`:

```ts
export function tripsWithPerson(board: TravelBoard, title: string): RelatedTripVisit[]
```

matching on `trip.personTitles.includes(title)` and returning
`{ trip, stops: [] }`. The departure-descending comparator currently
inlined in `relatedTrips()` is extracted so both share it.

`src/trips/ui/related-trips-block.ts` changes in three places:

- `isStopTarget()` becomes `blockTargetKind(board, crmBoard, sourcePath)`,
  returning `'place'`, `'person'` or `null`. It needs the CRM board, so
  the block calls `readCrmBoard()` alongside `readTravelBoard()`. That is
  the block's first CRM dependency, which is fine in a UI file, and it
  reads only through `crm/read-crm.ts`.
- The lookup branches on that kind: stops for a place or city,
  participation for a person.
- `renderVisitRow()` already handles an empty stop list, drawing the
  date, status icon, title and status and nothing else. For a person row
  that is the right amount of detail, so it is reused unchanged. If the
  bare row reads too thin in practice, the trip's country or city list
  is the obvious thing to add as the note line, but it is not in this
  plan.

The `relatedTrips.notAPlace` string is reworded ("this note is not a
place or a person") while keeping its key, since the condition it
describes has widened.

A Company note gets no block. Nothing links a trip to a company, which
is precisely the scope that was deferred, and a block that can only ever
say "no trips yet" is worse than no block.

`create-crm.ts` therefore writes a body for a Person note and none for a
Company note, mirroring how `create-entities.ts` gives the block to
cities and places but not to countries and states, and for the same
reason: the block goes where the relationship can actually exist.

Tests: `related-trips.test.ts` gains cases for participation matching,
including a person named in a trip that has no stops at all, and a
person title that no trip mentions.

### B.10 Entity-type health check

`src/vault/health/entity-type-issues.ts` scans the configured folders and
flags notes whose `type:` is missing or wrong. Extend it to the two CRM
folders, comparing against the configured type values rather than a
literal. Two points to verify against that file when implementing:

- A person note must not be reported as an unknown travel type, and a
  travel note must not be reported as a broken person. The check is
  per-folder, so this should already hold, but the CRM branch has to
  read its expected value from settings, not from `TRAVEL_ENTITY_TYPES`.
- If either CRM folder or type value is unset, that folder is skipped
  rather than reported as entirely broken.

### B.11 Files touched, Part B

Added: `crm/entity-types.ts`, `crm/types.ts`, `crm/crm-note.ts`,
`crm/read-crm.ts`, `crm/create-crm.ts`, `crm/crm-stats.ts`,
`crm/ui/new-crm-entity-modal.ts`, `crm/ui/crm-dashboard-view.ts`,
`crm/ui/crm-stats-row.ts`, `crm/ui/crm-entity-meta.ts`.

Changed: `crm/persons.ts`, `shared/vault-scan.ts`, `settings/types.ts`,
`settings/defaults.ts`, `settings/validate.ts`,
`ui/settings/section-folders.ts`, `ui/gallery/travel-gallery-view.ts`,
`ui/dashboard/travel-entity-meta.ts`, `trips/related-trips.ts`,
`trips/ui/related-trips-block.ts`, `vault/health/entity-type-issues.ts`,
`vault/health/entity-type-check-modal.ts`, `main.ts`, `styles.css`.

---

## C. Cross-cutting work

**Translations.** Every new string lands in both `en.ts` and `de.ts`, or
`tests/translation-keys.test.ts` fails. New key groups:
`dashboard.nav.*` (three chips), `placesDashboard.*` and `crmDashboard.*`
(display text, headings, empty states, browse-all labels),
`dashboard.stats.people` / `.companies`, `dashboard.newPerson` /
`.newCompany`, `modals.newPersonModal.*` / `modals.newCompanyModal.*`,
`galleryView.filters.person` / `.company`, `commands.openPlacesDashboard`
/ `.openCrmDashboard` / `.newPerson` / `.newCompany`, and CRM property
rows under `settings.folders.*`.

**Tests.** `crm-note.test.ts` round-tripping the parser against the
builder, including blank-field omission and the tag shapes a hand-edited
note produces. `crm-stats.test.ts`. Split whatever exists today for
`travel-stats.ts` to follow the new module split. `translation-keys`
covers the rest by construction.

**Docs.** `CLAUDE.md` (both positions in B.1, plus the module layout
block and the dashboard description), `docs/design/architecture.md`,
`docs/design/data-model.md`, `docs/features/travel.md`, `docs/usage.md`,
`docs/index.md`, `docs/design/sample-vault.md`. New
`docs/templates/Template - Person.md` and `Template - Company.md`
matching what the writer emits.

**Sample vault.** Five people and one company is not enough for a CRM
dashboard to look like anything. Three of each are added, every one of
them tied to notes the vault already has, so the new sections have real
content and the related-trips block on a Person note has something to
reverse:

| Note | Tags | Ties to |
|---|---|---|
| `People/Marc` | Friends, Photography | Lives in Bern, shoots at the Neuchâtel Waterfront |
| `People/Sabine` | Family | Wiesbaden, near Dreieich |
| `People/Peter` | Colleagues | Chur, meets at Restaurant Falknis |
| `Companies/Basel Tourismus` | Tourism | Opening hours for Basel Minster |
| `Companies/Schaffhauserland Tourismus` | Tourism | Munot Fortress and the Schaffhausen City old town |
| `Companies/Rhätische Bahn` | Transport | The Landquart to Maienfeld leg |

Contact details follow the vault's existing convention: street names
without numbers, and placeholder phone numbers and email addresses, so
the vault stays shareable. Websites are the real public ones, as
`Neuchâtel Tourisme` already does.

Two follow-ups in `docs/design/sample-vault.md` while editing it: the
layout block's counts (`People/ 5`, `Companies/ 2`) need updating, and
the Companies count is wrong today regardless, since that folder holds
one note. The table row reading "Nothing reads these yet, which is the
honest state of that work" stays until step 5 ships, and then becomes a
description of the CRM dashboard.

For the related-trips block to show anything on a Person note, at least
one trip has to name one of the new people in its `persons:` list.
`Trips/Photo Weekend in Neuchâtel.md` naming Marc is the natural pick,
and costs one line.

---

## D. Order of work

Each step builds and lints clean on its own.

1. **Dashboard refactor, no visible change.** Shell, nav, action bar,
   stat card, stats split into `trip-stats.ts` / `place-stats.ts`. The
   single dashboard still renders exactly what it renders today, out of
   the new pieces.
2. **Split into Trips + Places.** New view types, commands, nav row,
   sections reallocated, `refreshAllViews()`. Docs and translations.
3. **CRM read layer.** `entity-types`, `types`, `crm-note`, `read-crm`,
   `persons.ts` rewritten on top, `readTagList()` moved to shared, new
   settings and their settings-tab rows, tests.
4. **CRM writing.** `create-crm.ts`, the modal, two commands.
5. **CRM dashboard.** Third view, stats row, meta builders, sections.
6. **Related trips on a Person note.** `tripsWithPerson()`, the block's
   target-kind branch, the reworded string, tests.
7. **Gallery and health check.** Type filters, CRM rows, folder coverage.
8. **Docs, templates, sample vault.**

Steps 1 and 2 are independently shippable without any of 3 to 8. Step 6
depends on 3 (it needs `readCrmBoard()`) and on 4 (the writer is what
puts the block into a new Person note), but not on 5.

---

## E. Risks

- *View type strings are user data.* Keeping `apertrail-dashboard-view`
  for the Trips dashboard is what stops every existing open tab from
  breaking. Do not "fix" the constant's value to match its new name.
- *Command ids are user data too*, via hotkeys. `open-dashboard` keeps
  its id even though its label changes.
- *Writing into `personsFolder` is genuinely new behavior* for a folder
  the plugin has only ever read. The guards in B.4 matter, and so does
  the fact that nothing is ever written back into an existing person
  note.
- *Two thin stats rows.* Trips drops from five tiles to two, CRM starts
  at two. Acceptable, but see the tile candidates in A.3.
- *The related-trips block now reads two boards.* A place note's block
  will call `readCrmBoard()` as well, only to establish that the note is
  not a person. Nothing is cached anywhere in this plugin, so that is a
  second folder scan per block render. It is a scan of two folders that
  are usually small, and the block is not rendered in a loop, so this is
  noted rather than optimized. If it ever does bite, the cheap fix is to
  check the travel board first and only reach for CRM when the note is
  not a place.
- *Existing Person notes have no block.* The writer only adds one to
  notes it creates, and nothing rewrites notes the vault already owns.
  Someone who wants the block on Gaby pastes the fence in by hand, the
  same as for any place note that predates the feature. Worth one line
  in the docs.

---

## F. What changed on the way in

Recorded as it shipped, so the plan and the code do not quietly disagree.

**Step 1.**

- The stats row's tile order changed: the next-trip tile moved from last
  to second, since the row is now assembled as a Trip half followed by a
  Places half. That is the order step 2 produces anyway, so the
  intermediate state previewed the destination rather than shuffling
  twice.
- `dashboard-shell.ts`'s `renderHeader` is a concrete no-op method, not
  the optional abstract one first written: TypeScript requires a
  non-abstract subclass to implement an `abstract foo?()` member anyway,
  which defeats the point.

**Step 2.**

- The nav row landed here rather than in step 1, because it can only list
  dashboards that exist. It brought `dashboard-view-types.ts` with it.
- Places gets no module heading. The nav chip and the tab both name the
  view already, and a third copy in an h1 is noise. One less string, one
  less CSS rule.
- `dashboard.displayText` is gone, replaced by `dashboard.views.trips`
  and `dashboard.views.places`. One string per dashboard now serves the
  tab title and the nav chip, rather than two strings drifting apart.
  These are dynamic call sites (the nav builds them from its own list),
  so they are listed in `translation-keys.test.ts`'s `DYNAMIC_KEYS`.
- The Places dashboard's five place-type sections go through one
  `renderPlaceSection()` helper that takes its three strings already
  resolved. Passing a key prefix and building `${prefix}.heading` inside
  would have turned fifteen statically checked translation keys into
  fifteen unchecked ones.

**Step 3.**

- `readTagList()` landed in a new `src/shared/tag-list.ts` rather than
  directly in `shared/vault-scan.ts`, and is re-exported from there. The
  CRM parsers are meant to need no `App`, and `vault-scan.ts` imports
  `obsidian`, so importing the tag reader from it would have dragged an
  Obsidian mock into `crm-note.test.ts`. Same arrangement, for the same
  reason, as `shared/wikilink.ts`. The three copies of the reader are now
  one.
- `crm-note.ts` grew `matchesCrmType()`, `crmTypeValue()` and
  `crmTagProperty()` beyond the two parsers the plan named. The type value
  is a setting rather than a literal, so "does this note count" is itself
  logic worth testing without an App, not a one-line comparison inlined in
  the reader.
- `read-crm.ts` also exports `crmTagValues()`, which the creation modal in
  step 4 needs for its tag suggestions. It belongs beside the reader that
  produces the board, not in the modal that consumes it.
- The four new CRM property rows sit in the settings tab's CRM block rather
  than in the property-names section below it. That section is about the
  travel entities, and keeping a module's settings together is what makes
  the tab readable the same way the vault is.

**Step 4.**

- A new Person note gets no body yet. The plan has it carrying a
  related-trips block, but that block cannot answer for a person until step
  6, and writing one in now would render "this note is not a place" on
  every person created in the meantime. Step 6 adds the body along with the
  lookup that makes it mean something.
- The tag field's suggestions come from `crmTagValues()` via a plain
  `<datalist>`, not a dropdown: the tags a vault already uses are
  suggestions, not the whole vocabulary.
- The two refusals throw translated messages under a new top-level `crm.`
  key group. The modal already surfaces `err.message` in a Notice, so the
  guards needed no new plumbing.
- Worth knowing for any future test: `tests/translation-keys.test.ts`
  scans raw source, comments included. A doc comment that spells out an
  example translation call registers as a key and fails the suite. Describe
  the call, do not write it.

**Step 5.**

- The gallery's Person and Company type filters landed here, ahead of
  their place in step 7. Without them every "Browse all" button and every
  stat tile on the new dashboard would have been dead on arrival, and
  shipping a view whose controls do nothing is worse than doing the work
  early. The health-check half of step 7 is untouched.
- `TravelEntityTypeFilter` is now `GalleryTypeFilter`. The gallery spans
  both modules, so the old name had stopped being true.
- The stats row is three tiles, not the two the plan named. Two counts that
  the section headings below already state are not worth a row, so a third
  joins them: how many of those people you have actually travelled with,
  counted only from trips whose status is `Over`, mirroring
  `vault/visit-derivation.ts`. That is the one number here worth a test,
  and it is what made `crm-stats.ts` worth having rather than two calls to
  `.length`.
- The CRM dashboard reads the travel board as well as the CRM board, for
  that one tile. Nothing is cached anywhere in this plugin, so it is a
  second scan per render of a view you open occasionally. Noted rather than
  optimized.
- `shortUrl()` moved from `ui/dashboard/travel-entity-meta.ts` into
  `shared/short-url.ts`, since a company card wants exactly the same
  treatment of exactly the same kind of value.
- CRM sections are title-sorted, with no equivalent of
  `travel-dashboard-sort.ts`. A person has no rating and no last visit;
  any other order would be arbitrary.

**Step 6.**

- The `relatedTrips.notAPlace` key was renamed to `notASubject`, not just
  reworded as planned. The old name described a condition that no longer
  matches, and a translation key is internal, not vault data. A Person also
  gets its own empty state (`emptyPerson`): "no trips have stopped here"
  is the wrong sentence about a person.
- The order in `blockSubject()` is deliberate: the travel board is checked
  first and the CRM folders are only read when the note is not a place.
  That is the cheap fix §E anticipated, taken up front, so the common case
  stays at one folder scan rather than two.
- `crm/create-crm.ts` imports the block-language constant from
  `trips/related-trips-block-lang.ts`. A module reaching into another
  module's constants file, which is exactly what that bare no-import file
  exists for -- `vault/create-entities.ts` already does the same.
- The sample vault's eight People notes each got the block by hand. Five of
  them are named on trips and show real rows; the three added in this
  session show the empty state, which is worth demonstrating too.

**Step 7.**

- `TravelFolderLocation` became `EntityFolderLocation`, and
  `EntityTypeIssue.suggestedType` widened from `TravelEntityType` to
  `string`. The two CRM locations suggest a configured value, not a member
  of the fixed vocabulary, and typing it otherwise would have been a lie
  the modal then had to cast away.
- A CRM folder whose type value is blank is skipped, not scanned. Both
  halves of the rule are asserted: cleared value skips, blank folder skips.
  The alternative -- reporting every note in the folder as needing an empty
  string -- is noise pretending to be a finding.
- The travel folders keep their literal expectations, so the two families
  cannot judge each other. That was listed as a thing to verify rather than
  build; folder matching already guaranteed it, and there is now a test
  that would notice if it stopped being true.

**Step 8.**

- Two new templates, `Template - Person.md` and `Template - Company.md`,
  matching what the writer emits plus the hand-edit fields the sample
  vault's own notes carry. The Person one includes the related-trips block;
  the Company one says why it has none.
- A sweep for stale counts across the docs, which had drifted in a way no
  test would ever catch: nine folders became eleven, nine gallery types
  became eleven, two views became four, twelve commands became sixteen.
  `travel-module-plan.md` keeps its original design text and carries
  "Superseded" notes instead, since it documents what was planned rather
  than what is.
- `CHANGELOG.md` gained an entry for the split and for CRM.
- Also corrected while in there: the changelog's own claim of "eight entity
  folders", which was already wrong before this work started.

---

## G. What retired it (2 September 2026)

The split was into three dashboards. Two years of use later there is one
view, and it is the gallery. This section records why, so the next person to
propose splitting it again has the argument in front of them.

### G.1 What actually happened to the dashboards

Both of them became launchers into the gallery.

Every section on the Places dashboard was a strip of at most six cards with
a "Browse all" button opening the gallery filtered to that type. Every stat
tile on both dashboards did the same thing on click. So the Places dashboard
was three tiles and eight buttons into a view it could not itself show you,
and its own reasoning admitted as much: it had no greeting and no heading,
on the grounds that the nav row's active chip already named it.

The Trips dashboard held more -- the greeting, the next-trip countdown, the
budget tile -- but the section under them was the same six-card strip under a
heading counting every trip in the vault. §A.3 chose `SECTION_LIMIT` 6 on the
reasoning that a dashboard shows you a sample; in a vault with forty trips
what it shows is that there is somewhere else to go.

### G.2 What moved, and what it cost

Everything the dashboards carried is on the gallery now:

- **The greeting**, unchanged, still the only one -- there is nothing left
  for a second one to be on.
- **All five stat tiles**, and they now filter the grid in place rather than
  opening a second view. The next-trip and budget tiles still open that
  trip's note, which is not a filter and never was.
- **The creation buttons**, all nine, in the Places dashboard's order with
  New trip in front.
- **The per-type orderings.** This is the part that would have been quietly
  lost. `travel-dashboard-sort.ts` held four judgements -- trips
  upcoming-soonest then most-recent-past, countries by derived visit, places
  by rating falling back to visit, cities by visit alone -- and the gallery
  had none of them, only name/rating/last-visit. They are now the grid's
  default sort, under `ui/gallery/gallery-order.ts`, with the types in the
  order their chips read. The file is `travel-entity-sort.ts` now; nothing
  about it was a dashboard's.

One behaviour changed rather than moved. `sortTrips` no longer drops
cancelled trips. That drop existed because of the heading: a strip capped at
six under a count of everything looked broken, and a cancelled trip was the
one status with nothing to contribute. The grid has no such heading and no
such cap, and it carries a Travel-Status facet, so "without the cancelled
ones" is a thing to ask for rather than a thing a sort decides for you. A
sort that silently removes rows is a filter wearing a sort's name.

What is genuinely gone: the section shape itself. You can no longer see six
trips *and* six countries *and* six landmarks at once without choosing. The
grid shows one type at a time, or all of them interleaved by the default
order. That is the trade, and it is the right way round: the sections were
six of forty, and the grid is all forty.

### G.3 The view types

`apertrail-dashboard-view` and `apertrail-places-dashboard-view` join
`apertrail-crm-dashboard-view` as retired strings in
`ui/dashboard/dashboard-view-types.ts`. They stay declared and registered
nowhere, which is what makes Obsidian drop an already-open tab quietly
instead of leaving one reading "no view of type ...".

The gallery kept `apertrail-gallery-view` rather than adopting the Trips
dashboard's string. Taking that string over would have broken the gallery
tabs that already exist in order to save the dashboard tabs that also do,
and a vault with both open would then have held two of the same view.

`tests/view-types.test.ts` holds all of that: each retired string appears in
the file that records it and nowhere else, no retired string is the live
one, and `main.ts` registers exactly one view. Without it the constants file
would be a file nothing imports, which is how a spent name gets reused by
accident.

### G.4 The commands

`open-dashboard` and `open-gallery` both survive and both open the gallery.
A command id is what a user's own hotkey points at, so retiring either would
silently unbind it. `open-places-dashboard` is gone, because nothing it
could open is left -- a hotkey bound to it stops working, which is the
honest signal rather than a command that opens something else than its name.

### G.5 What §A got right

Worth saying, since this section reads as an undoing. §A.4's split of the
stats into `renderTripStatsRow` and `renderPlaceStatsRow` is why the fold
was five lines rather than a rewrite: the tiles were already parameterised
by what they count and what they open, so pointing them at a filter instead
of a view changed one field name. The same goes for `travel-entity-meta.ts`
and `renderEntityCard`, which is why a trip card looks the same today as it
did on the dashboard.

The thing the plan got wrong was smaller than it looks: not that the
sections were badly built, but that a section strip and a filtered grid are
the same answer, and only one of them can show you everything.
