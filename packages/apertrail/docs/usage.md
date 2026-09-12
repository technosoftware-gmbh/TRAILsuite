# Usage

A walkthrough from a freshly installed plugin to a planned trip you can read back. [Travel](features/travel.md) covers everything here in more depth.

If you would rather read a filled-in version than build one, open the `APERtrail-Sample` vault: it is a small vault laid out in exactly the default folder structure, with trips, countries, states, cities, restaurants, accommodation, landmarks, photo spots, people and a company already in it. See [Sample vault](design/sample-vault.md).

## 1. Open the dashboard

The ribbon's map icon, or the **Open Trips dashboard** command, opens the Trips dashboard. A chip row at the top of every dashboard switches between Trips, Places and CRM, and **Open Places dashboard** and **Open CRM dashboard** go straight to those. On a fresh install it is empty, because APERtrail scaffolds nothing: no folders, no example notes. That is the starting point, not a problem.

What it *is* configured for out of the box is three folders at the top of your vault: `Trips/`, `Places/` with a sub-folder per place type, and `CRM/` with People and Companies. Both are read, and both are creatable from the CRM dashboard. If your notes live somewhere else, the settings tab's common parent folder moves all three at once, and any single folder can be repointed on its own.

The Trips dashboard has three parts:

- **Quick actions**: a search box, a **New trip** button, plus Refresh.
- **A stats row**: two tiles, trip counts by status and a countdown to your next trip.
- **The Trips section**, up to six cards, with a "Browse all" footer that opens the gallery filtered to trips.

The Places dashboard holds everything a trip points at: a button for each creatable place type (New photo spot, New accommodation, New landmark, New food & beverage, New location, New city, New state, New country), three tiles (countries visited, landmarks visited, photo spots captured, each against the total known) and **eight sections** on the same up-to-six-cards-plus-"Browse all" pattern: Photo spots, Countries, States, Accommodation, Landmarks, Food & Beverages, Locations, Cities. States sit between Countries and the Cities that belong to them, which is the order the hierarchy reads in.

The CRM dashboard holds New person and New company, three tiles and a section each.

Everything on the dashboard is also a command, so nothing here requires the ribbon icon. If you would rather not have one, turn it off under **Settings -> APERtrail -> Dashboard**.

## 2. Build the geographic hierarchy

Start with a **Country**. **New country** asks for a title only; `capital:` and `states:` are left to fill in later, once the notes they would point at exist.

Then add **States** where the country uses that level (state, province, canton, Bundesland) and **Cities**. A State takes an optional Country; a City takes an optional Country and an optional State. Both are wikilinks, so a City in a country without a state level simply carries no `state:`.

You do not have to build the whole hierarchy up front. Countries, states and cities are usually set up once and reused, but they also turn up mid-planning, which is why they are dashboard buttons and not just commands: a trip's `cities:` list cannot point at a City note that does not exist yet.

New City notes are created with a `travel-related-trips` block already in the body, so they answer "when was I last here" from the moment they exist.

## 3. Add places

Five reusable place types share one creation modal, each writing into its own folder:

| Type | What it is for |
|---|---|
| Accommodation | Somewhere you stayed or plan to stay |
| Food & Beverages | Restaurant, cafe, bar, pub, fast food |
| Landmark | A point of interest worth visiting |
| Location | Anything that is none of the above three |
| Photo spot | Somewhere you go to make a specific picture |

Each takes a title, an optional Country and an optional City. Places are explicitly meant to be **reused**: the restaurant you liked stays one note that many trips link to, rather than being re-entered per trip. Like Cities, new place notes get a related-trips block in the body.

A photo spot gets a second block above it, `apt-photo-spot`, and that is where you fill it in: motifs, the light each one wants, sample frames, and a tick when you have the shot. See [Photo spots](features/travel.md#photo-spots).

The creation modals write `type:` and the relationships you picked, and nothing else. Ratings, `visited:`, addresses, images and the note body are yours, by hand or through your own Templater templates. The [templates](templates/) folder has a starting shape for each type.

## 4. Create a trip

**New trip** opens the Trip editor, the one full editing surface in the plugin. It collects what belongs to the trip as a whole:

- Title, country and the cities the trip touches
- Departure and return, **with times**, not just dates
- Travel type, travel status, review status, a 1 to 5 rating
- Who came along, picked from your Person notes

The status field takes one of four fixed values: `Planned`, `Booked`, `Over`, `Cancelled`. You can leave it blank. A trip whose return date has passed reads as `Over` and everything else reads as `Planned`, derived at read time and never written into the note, so a hand-written trip note still shows up on the dashboard and still counts in the stats.

The participant list comes from Person notes: markdown notes under the configured People folder (default `CRM/People`) carrying `type: person`. If the dropdown is empty, that folder or that type value is what to check. An optional tag filter narrows the list further; leaving it blank means everyone, not nobody.

Saving creates the note in the Trips folder with a `travel-itinerary` block in the body.

## 5. Fill in the itinerary from the trip note

Open the trip note. The `travel-itinerary` block renders the trip as a timeline grouped by day: a time gutter, an icon per entity kind, the linked place, its rating and note, with transport legs and accommodation nights as their own bands and the participants along the top. A transport leg leads with where it goes, "Zürich to Pretoria", and puts its direction and reference underneath.

The itinerary is **edited here, in the note**, not in the Trip editor:

- Each day has its own **+ Add stop**, pre-filled with that day's date.
- Each row has edit, reorder and delete actions.
- **Transport** and **Nights** have their own add buttons.

Every one of these opens a dialog you can read at a glance rather than one form for the whole trip. That split is deliberate. The first version put stops, nights and legs in the Trip editor along with everything else, and a ten-stop trip meant roughly fifty form rows in a modal taller than the screen. Editing one item at a time, from the itinerary you are already reading, keeps every dialog the same size however long the trip gets.

Three things worth knowing while you work:

- A stop can point at a **City or any place type**, in one list. "Arrived in Basel at 10:00, ate at the Gifthüttli at 12:00" is a single itinerary at two levels of zoom.
- Stops stay in the order you entered them and are never re-sorted by time. An untimed stop has no other way to say where in the day it belongs.
- Every row can carry **what it is expected to cost**, which is the subject of the next step.

The block redraws itself when the note's metadata changes, so a stop you just added appears immediately, and so does an edit you make by hand in the frontmatter.

## 6. Read the other direction

Open one of the places the trip stopped at. Its `travel-related-trips` block lists every trip that stopped there, most recent first, with each visit's time, note and rating. Upcoming and past trips sit in the same list: on a place note, "when was I last here" and "when am I next here" are the same question asked from two directions.

If a place note predates APERtrail and has no block, add one:

````markdown
```travel-related-trips
```
````

The block takes no arguments. It reads the note it sits in.

## 7. Put the money on it

A trip costs something before it is booked. Each stop, night and leg carries an **estimated cost** in its own editor: an amount, a currency, and what the amount is *per*.

That last one is the field to get right, and the dialog opens on the likely answer for that kind of line:

- A **leg** or a **stop** defaults to **per person**, because a fare and an entry fee are quoted per head. Two people on a flight at 900 is 1800.
- A **stay** defaults to **per night**, because a hotel quotes a room per night whoever is in it. Three nights at 240 is 720, not 720 per person.
- **In total** is the escape hatch, and it is also what a figure typed by hand into frontmatter means when it says nothing.

Underneath sits **who is on this line**, offered only when the trip has more than one participant. Leave everybody ticked and nothing is written: an empty list already means everybody, so a person added to the trip later joins every line that never disagreed with it. Untick somebody and the line is charged to the rest.

An estimate renders as a **dashed chip** on the row, never as a receipt, and the chip's tooltip shows the sum behind it. The trip's own **Costs** block totals them under `apt-trip-costs`, which a new trip note already carries.

When you actually book something, use the row's **Book this** action rather than creating a booking from scratch: it opens the booking dialog with the trip, the category, the figure, the people, and the line's own reference or place already filled in. Those last two are what make the booking **take over** the estimate, so the moment it exists the estimate stops counting and the real figure takes its place. Nothing is deleted: the line keeps its estimate, which is what makes plan against actual readable per row.

The block's four actions are **Booking** (one from scratch), **Budget** (a ceiling per category), **Cost sheet** (a printable HTML page written beside the trip note) and **Rates** (a conversion rate per foreign currency, typed by you: the plugin fetches none, ever).

Money here refuses to lie in four specific ways, and it is worth knowing them before the totals surprise you: a total over things nobody has priced is **nothing at all** rather than zero; **currencies are never summed**; a converted figure always appears **with the rate that converted it**; and no derived total is ever written back into a note.

## 8. Browse the gallery

**Browse trips, countries & places** (or any dashboard section's "Browse all" footer) opens one combined gallery over the entity types worth browsing:

- A type filter row, All through Company
- Fuzzy search over note titles
- Cards showing the note's `image:`, a read-only star row where the entity has a rating, and an icon-led meta row appropriate to the type
- Facets: country, visited or not, minimum rating, tag, and a sort control (name, rating, last visit)

Every facet dropdown is built from the values actually present in what is currently in scope, so it never offers a filter that would match nothing, and a facet with nothing to offer is not rendered at all. Facets persist across a type-filter change, because "everything I rated four stars or better in Switzerland" is a question worth asking of one type and then another.

With the type filter set to **Trip**, three more facets appear: travel status, review status and participant. Switching away from Trip clears them, so a Trip-only filter cannot stay silently applied while invisible.

The dashboard and the gallery are **manual-refresh only**. They redraw on open, on Refresh, and after a creation modal writes a note. Hand-edit a note in another tab and switch back to an already-open dashboard, and you see the old values until you refresh. The data is never stale; the pixels can be.

## 9. Run the entity type health check

Run **Check entity types** (command palette, or the button at the bottom of the settings tab) now and then. It scans the twelve configured folders for notes whose `type:` is missing or disagrees with the folder they sit in, and offers the right value for each.

This matters because APERtrail identifies a note by folder **and** type together: a `type: fnb` note in the Landmarks folder is read as nothing at all. There is no folder-based fallback and no cross-folder search, which is what makes the check worth running after a bulk move or an import.

Each of the twelve folders maps to exactly one type, so the check always has a confident answer, never a guess. The ten travel folders are checked against a fixed value and the two CRM ones against your configured type values, so a vault whose contacts say `type: Kontakt` reads as correct rather than broken. It writes nothing without an explicit click, applies only the type property, and "Apply all" asks twice.

## 10. Settings

**Settings -> APERtrail** is one page. At the top sit the plugin's own rows: what changed in this version, and where to support or reach the people who wrote it. **Vault setup** then holds two rows that open a page of their own -- **Folders**, with the optional common parent and then the three modules in turn (Trips, Places with its eight sub-folders, CRM with People and Companies), and **Property keys**, every frontmatter name the plugin reads or writes, grouped by note type -- followed by the entity type health check. Below that, four small sections hold the switches: **Dashboard** (ribbon icon, open dashboard), **Money** (the trip costs switch, your home currency, and the short list of currencies the dropdowns offer), **Photo spots** (sun times) and **People** (eligible person tags). **About** closes the page with the plugin's own manifest info. See [Settings reference](design/settings-reference.md).
