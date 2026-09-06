# Changelog

All notable changes to APERtrail are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

**What counts as a breaking change here is what happens to a vault**, not what
happens to a signature. Renaming a default property name, changing one of the
nine fixed travel `type:` values, or changing what a reader will accept out of a
note somebody already has is breaking, because nothing migrates a vault
automatically. The two code-block languages already written into people's notes,
`travel-itinerary` and `travel-related-trips`, are data rather than internal
naming and do not get renamed. See
[Data model](docs/design/data-model.md) for the note formats this promise covers.

## [Unreleased]

### Added

- **A stop, a stay or a leg can carry the prices it may be bought at.** A cabin
  category, a room category, a two-hour or four-hour version of the same
  excursion: the same thing at a different price, as a `variants:` list under
  the line with a name, a description and a price each. They are alternatives
  and are never summed; the chosen one is what every total counts, and until
  one is chosen the first counts and every row that shows the figure says so. A
  line carrying variants is priced from them and its own `cost` is not read.
  The itinerary lists them under the line and a click chooses one; the trip
  document prints them all, because that page is what somebody decides from.
  Nothing changes for a line with one price.
- **A ship or a named train can be a note of its own** (`type: vehicle`), with
  what it is, who runs it, when it was built, how many it carries, a picture,
  and the cabin categories it is sold in. A leg points at one through a new
  `vehicle:` sub-key, separate from `carrier:`, which stays what it was: who
  runs the leg, not what you are on. **The cabins are a catalogue, not prices**
  -- what a cabin costs differs per sailing and stays on the leg -- so a leg's
  variant that names a cabin borrows its description from the ship at render
  time, and correcting it there corrects every trip that ever sailed. Two
  commands create one and edit its cabins, the related-trips block on it lists
  the trips that used it, and the entity-type health check covers its folder.
- **A line can be optional.** `optional: true` says it might not happen -- an
  excursion offered, a transfer you may not take, which is most of a brochure
  day. It is priced like any other line and stays out of the planned total
  until `chosen: true` says you decided on it; what the untaken ones would add
  is reported beside the plan, on the costs block, the cost sheet and the trip
  document, rather than inside it.

### Changed

- **A leg that runs for days now says where it ends and how long it runs.** A
  voyage written as day 1 to day 15 printed only "Day 1": `+1` beside a clock
  is the timetable's word for one night, and a leg with no clock had no marker
  anywhere. Past one night, or with no arrival time to mark, the leg now reads
  "Day 1 -> Day 15 - 14 nights". The overnight flight is unchanged.
- **A leg is named on the day of the itinerary it arrives on**, where that day
  is one the itinerary already draws. Legs keep their own band; this is one
  line saying a fortnight-long voyage ends here. A return flight landing after
  the last day still appears nowhere in the day-by-day.

## [1.0.0] - 2026-09-04

The first public release. Nothing in a vault changes: the note formats,
property names and folders are the ones 0.1.0 read and wrote, and a vault built
against the private builds is a vault this release reads.

### Changed

- **The two dashboards have folded into the gallery, and the plugin has one
  view.** Both of them had become launchers for it: every section was a strip
  of at most six cards ending in a button that opened the gallery filtered to
  that type, and every stat tile did the same on click. The Places dashboard
  was three tiles and eight such buttons over a view it could not itself show
  you.

  Everything they carried came across. The greeting, with the date. All five
  stat tiles -- Trips by status, next trip, next-trip budget, countries
  visited, landmarks visited, photo spots captured -- which now **filter the
  grid in place** rather than opening a second view; the next-trip and budget
  tiles still open that trip's note, which was never a filter. All nine
  creation buttons, in the Places dashboard's order with New trip in front.

  And the per-type orderings, which are the part that would otherwise have
  been quietly lost: trips upcoming-soonest then most-recent-past, countries
  by their derived visit, places by rating falling back to last visit, cities
  by last visit alone. They are the grid's **default sort** now, types in the
  order their chips read. Name, rating and last visit are answers to a question
  you asked; what a list of trips should look like before you ask anything is a
  separate judgement, and it had already been made.

  What is gone is the section shape: you can no longer see six trips and six
  countries and six landmarks at once without choosing. The grid shows one type
  at a time, or all of them in the default order. Six of forty, against forty.

  **Two open tabs will close themselves.** An already-open Trips or Places
  dashboard disappears on the next load rather than turning into an error --
  their view types are retired and registered nowhere, which is what makes
  Obsidian drop such a tab quietly. The gallery keeps its own view type, so an
  open gallery tab is unaffected.

- **`Open Trips dashboard` now opens the gallery**, keeping its command id, so
  a hotkey bound to it still works. `Open Places dashboard` is gone: nothing it
  could open is left, and a hotkey that stops working is more honest than one
  that quietly opens something else.

- **The cancelled trips are back in the trip ordering.** They were dropped when
  it fed a strip capped at six cards under a heading counting every trip in the
  vault, where a cancelled one had nothing to contribute. The grid has no such
  heading and no such cap, and it carries a Travel-Status facet -- so "without
  the cancelled ones" is a thing to ask for rather than a thing a sort decides
  on your behalf. A sort that silently removes rows is a filter wearing a
  sort's name.

### Added

- **The header is the shape all three plugins now share**: the buttons, then
  the search on its own row, then the greeting carrying the date. The action
  bar used to be the first thing each dashboard put into its own grid, below
  the greeting, which is why the two of them could disagree about where it
  went. The search has a row to itself because it is the control that wants
  width, and a row it shares is a row it loses on a narrow window. The tab row
  that sat above it is gone with the dashboards it navigated between.

- **Pictures can be uploaded**, from the trip's hero field and from the gallery,
  which takes several files at once. **Obsidian decides where they land**: the
  upload goes through `getAvailablePathForAttachment()`, so the vault's own
  `attachmentFolderPath` picks the folder and supplies the collision suffix. A
  vault set to `./_resources` files a trip's picture inside that trip's folder
  with no convention of this plugin's involved. The older rule is unchanged --
  a picture already in the vault is referenced, never moved; an upload is the
  different case of a file that has never been filed anywhere.

- **The gallery shows the pictures, and they can be reordered.** Each row is a
  thumbnail, its caption, and move-up / move-down / pick / remove. It was two
  text boxes, a path and a caption, which made "which of these is the dining
  car" unanswerable -- and reordering filenames you cannot see is barely better
  than editing the YAML, which is why the thumbnails and the reorder buttons
  arrived together. Up and down rather than dragging, matching the itinerary's
  rows and working on the iPad.

- **A trip can be duplicated**, from the itinerary block's footer. The same
  journey often exists in a long and a short version, and copying then cutting
  down beats retyping forty stops to delete eight -- `Remove day` already
  renumbers what is left.

  **The copy is a plan, not a record.** The route comes across whole: the days
  with their titles and paragraphs, the stops, stays, transport, budget,
  highlights and the note body including the overview. The dates, the status,
  the rating and the review do not. That is not tidiness: a trip's stops derive
  visits on the places they name, so a copy carrying `travelStatus: Over` would
  claim you had been to every one of them twice and would move the last-visit
  date on each, and nothing would error. The status is left **absent** rather
  than set to `Planned`, since a trip with no status and no dates already reads
  as Planned.

  Day numbers survive, so the copy is a twelve-day itinerary with no calendar
  against it: give it a departure and the whole thing resolves. **Bookings are
  never copied** -- a booking is money committed, and a second copy reads as a
  second purchase -- though the itinerary's own cost estimates do come across,
  so the copy still says what it is planned to cost. Pictures the trip keeps in
  its own folder are **copied rather than shared**, so deleting one trip never
  empties the other's brochure; anything named elsewhere is left as written.

- **A leg can say who is flying or running it.** `carrier:` on a transport leg
  takes the airline, the railway or the train's own name -- Swiss, Edelweiss,
  Rovos Rail -- as free text, or as a wikilink when the vault has a note for
  it, read by the same rule `origin` and `destination` already use. It shows
  between the direction and the booking reference on the itinerary row and in
  the document's journey card, so a row reads "Hinreise · Swiss · LX288". The
  setting is `legCarrierField`, defaulting to `carrier`.

- **A day can be removed, or one inserted before it**, from the day's own
  header. Removing takes out the stops on that day and moves every later day
  up: cutting day 2 turns a stay of Tag 1 → Tag 3 into Tag 1 → Tag 2, two
  nights becoming one. **Only stops are deleted** -- a stay or a flight that
  touched the day keeps its number and now means the following day, because
  deleting a booked flight over a change to the plan is the more expensive
  mistake. Inserting creates nothing; the new day is empty until something is
  put on it, and insert-then-remove is the identity.

  This is the operation the relative days exist for: renumbering an itinerary
  is subtracting one from some integers, where the same edit on a dated one is
  retyping every date after the cut.

- **A day of the trip can be named, and can carry a paragraph.** `days:` on
  the trip is a sparse list keyed by day number -- only a day that says
  something has an entry, no stop belongs to a day object, and a day is still
  derived from the items on it. The header reads "1. Tag: Pretoria · 2.
  November 2026", set from a pencil on the day's own row, and the document
  prints the name and the paragraph above that day's lines. **A named day with
  no stops on it still appears**, because day four of a cruise is a real day;
  it slots in by number without moving anything that has stops.
- **A stop may name no place at all.** A stop now needs a place **or** a note,
  where it used to need a place -- "the place IS the stop" was true of an
  itinerary where every entry is a visit somewhere, and a brochure day is not
  that: "16.30 Uhr: Der Nachmittagstee wird im Beobachtungswagen serviert"
  happens on a moving train. An entry carrying only a time still says nothing
  and is still dropped. In the editor, leave the place empty or clear it with
  the X beside the picker.

  A placeless line and a line whose place link is a typo both read as no place,
  and they are not the same thing: the typo still shows as unresolved, and the
  brochure line shows as its own sentence, set at body weight rather than in
  the muted style an aside gets.

- **An itinerary can be written before its dates are known.** A stop, a stay
  and a transport leg may each say **which day of the trip** they are on --
  `day: 3`, `checkInDay: 3`/`checkOutDay: 5`, `day: 0`/`toDay: 1` -- instead of
  naming a date, which is how a trip is actually first written down: day one,
  day two, day twelve, with no calendar anywhere. A tour operator's brochure
  never prints a date at all.

  **Set the departure and every day resolves to a date, with nothing written
  back.** The note goes on saying `day: 3` for as long as it exists, so moving
  the departure by a week moves the whole trip and rewrites not one line. Day 1
  is the departure day; 0 and negative are allowed, for a leg that leaves the
  evening before.

  When a day number is set, that item's `from:` and `to:` carry a bare `HH:mm`
  rather than a datetime -- the date is what the day number says. Each editor
  has a **Day of the trip** field, and filling it in swaps the date inputs for
  time inputs rather than leaving a control whose value is ignored. Day headers
  read "Day 3" while the trip has no dates and "Day 3 · 4 November 2026"
  once it has, and a per-night cost counts its nights from the two day numbers,
  so a budget works before there are any dates at all.

  **Nothing is migrated and nothing has to be.** A trip that names its own
  dates goes on working exactly as it did, and the two can be mixed. Where an
  item somehow says both, the day number wins. `docs/design/relative-days.md`
  has the reasoning; `trip-model-redesign.md` §9's rejection of "template
  trips" is answered there -- it was right about recurrence and this is a
  different thing.
- **Five sub-key settings** for the above: `stopDayField`, `nightCheckInDayField`,
  `nightCheckOutDayField`, `legDayField` and `legToDayField`, defaulting to
  `day`, `checkInDay`, `checkOutDay`, `day` and `toDay`.

- **Four fields for what a trip says about itself**, and the block that goes
  with them. `subtitle` is what the trip is under what it is called;
  `highlights` a list of lines in the order they should read; `gallery` a list
  of pictures each with an optional caption; and the overview is a
  `> [!SUMMARY]+` callout at the top of the note, the same block NODAtrail's
  PARA notes carry. All four are on the trip editor, under a heading of their
  own: everything above it is something that happened, everything in it is
  something somebody chose to say. They exist because a printed trip document
  needs them and the note held none of them -- two thirds of such a document is
  already in a trip note as its stops, its budget and its bookings.
- **An image picker.** APERtrail had none: the only way to give any note a
  picture was to type a path into the frontmatter. A vault picture is referenced
  rather than moved, because a photo lives where its owner filed it. Written for
  this package rather than borrowed, since the licence boundary holds between
  the two PolyForm plugins as firmly as it does across the GPL one.
- **The subtitle on a card**, under the title in the overlay.
- **The trip document.** The itinerary block's **Trip document** button, or
  *Export this trip as a document* from the palette inside a trip note, writes the trip as somebody who is coming would read it:
  title, subtitle, a photograph across the top, the highlights, the overview,
  the itinerary numbered day by day, what it is budgeted to cost, and the
  gallery. The order a tour operator's own brochure uses. Every section a trip
  says nothing about is omitted rather than printed empty. It is the third
  sheet this plugin exports and shares its paper with the other two.

  **One file.** Every picture is downscaled to 1800px on the long edge and
  written into the page itself, so the document opens with its pictures
  wherever it is copied to, with nothing that has to travel alongside it. A
  picture given as an external URL stays a URL; one that cannot be read prints
  its caption over an empty frame.

  It prints the **budget**, not the bookings. A brochure states a price and the
  cost sheet beside it states what has been spent.
- **`tripExportsSubfolder`**, `Exports` by default: the folder a trip keeps its
  rendered sheets in, inside its own folder. Everything in it can be deleted
  and made again from the note, and nothing else in a trip's folder can, which
  is the whole argument for the boundary. Blank writes them beside the note.

### Changed

- **A transport leg reads like a flight card**: `Tag 0 · 20:30 - 10:00 +1`,
  in the itinerary block and the printed document alike. It named both ends
  before -- "Tag 0 → Tag 1" -- which is the same fact twice, in a vocabulary
  no timetable uses. A leg now says when it *leaves* and hangs the arrival off
  the clock as `+1`, added only when the arrival is genuinely a later day so
  the marker means something wherever it appears. A stay keeps its span, since
  a hotel confirmation is two dates and a flight is a departure with an arrival
  after it.

- **The overview block moved into `trail-core`.** The format -- a `---` rule
  and a `> [!SUMMARY]+` callout as one span -- was written down twice, here and
  in NODAtrail, and a note format belongs in the core whatever the number of
  readers. It is `markdown/summary-block.ts` there; `write-trip-summary.ts`
  keeps the half that needs an `App`. Nothing about a note changes: the same
  block is read and written, byte for byte.
- **A trip is a folder.** A new trip note lives in `Trips/<Trip>/` and a new
  booking for it in `Trips/<Trip>/Bookings/`, so a trip's note, pictures,
  bookings and eventual exported sheet are in one place rather than scattered
  across three. **Nothing moves**: a trip already flat goes on working where it
  is, because folder matching recurses, and this changes only where new notes
  are written. `tripBookingsSubfolder` names the inner folder and blank switches
  it off.

  **Bookings are read from two folders now**, the trips folder and the
  configured bookings folder. One rule would have been tidier and would have
  lost half of them, since a new booking is inside its trip's folder and an
  older one is flat.

  The vault check needed teaching. It judges a note by the longest configured
  folder it falls under, and a nested booking falls under the trips folder and
  under no bookings folder at all -- so every one of them would have been
  reported as a trip note carrying the wrong type on the first run. It
  recognises a booking by the folder it sits in now.
- **`image` is a setting.** It was read as a hardcoded `image` key by the
  gallery and dashboard cards, which made it the one vault-facing name in this
  plugin that a vault could not rename, and the reason a trip's picture could
  only ever be written by hand. It is `imageProperty` now and serves every
  entity type, not trips alone.

  **This changes what a save does to a note.** `image` is an owned key now, so
  the writer rewrites it like every other one: a hand-written value survives a
  save through the trip editor, which loads it and writes it back, and a save
  from an input that does not carry it clears it. `icon` and `color` stay
  cosmetic and untouched, because they still have no field.
  `write-trip.test.ts` states both halves; the test that used to assert `image`
  was never touched is now the test that says it is.
- **The cost sheet lands in the trip's exports folder**, through the same
  `tripExportFolder()` the trip document uses, so a trip's renderings are one
  place rather than two. A trip still flat in `Trips/` owns no folder, so its
  sheet stays beside its note exactly as before.
- **`renderEntityCard` takes an options object** instead of growing a sixth and
  seventh positional argument, which is where a call site starts passing
  `null, null, undefined` and nobody can read it.

### Added, continued

- **Property rows for the thirteen top-level names that had none**: a trip's
  cities, participants, stops, nights and transport, and a photo spot's
  timezone, opening hours, entry fee, accessibility, parking, transit, motifs
  and samples. They were always settings; they were only ever editable by
  hand in `data.json`. The `*Field` sub-keys inside a list entry still have no
  rows, and the page says so.
- **What's new**, a settings row that renders the newest releases from this
  file inside Obsidian. The text is bundled at build time rather than
  fetched, so it cannot drift from the changelog and nothing reaches the
  network.
- **Trip budgets and bookings.** A tenth entity type, `booking`: one note per
  booked thing, with what it cost, which trip it belongs to, who paid, who it
  was for, and a link to the confirmation file. Everything on it is a plain
  property, so Obsidian's own property editor is the editor and there is no
  block to learn. See
  [Trip budget and bookings](docs/design/trip-budget-and-bookings.md).
- **An `apt-trip-costs` block** in the trip note: planned against committed
  against paid, a document of every booking rendered through the same invoice
  renderer CULItrail uses for orders, and the settlement between the people
  who went. Every figure is derived on each render and written nowhere.
- **A budget per trip**, as a ceiling per category, and **conversion rates**
  per trip, both edited from that block. A category nobody budgeted reads as
  unbudgeted rather than as over budget by everything.
- **Money that refuses to lie.** A total over bookings nobody has priced is
  null rather than zero, currencies are never summed, and a converted figure
  always appears with the rate that converted it. The plugin fetches no rates
  and never will.
- **The split**, derived from each booking's payer and the people it names:
  balances, and the shortest set of transfers that clears them. Nothing is
  written into a note, so nothing goes stale.
- **Cost chips on the itinerary**, per currency, on any stop, night or leg a
  booking points at, with the confirmation one click away. A leg is matched on
  the reference both sides already carry.
- **Where a transport leg goes.** A leg carries an origin and a destination,
  so a flight reads as "Zürich to Pretoria" on the itinerary rather than as a
  bare time range, and both are offered in the leg editor. Written as typed;
  a wikilink is read down to its target, because most airports never get a
  note.
- **Estimates on the itinerary line itself.** A stop, a night and a leg each
  carry what they are expected to cost, for the pass where a trip gets priced
  before anything can be booked. They count as committed, show as a dashed
  chip rather than a receipt, and a **Book this** action opens the booking
  dialog with the figure and the line's own reference or place filled in. The
  booking then takes the estimate over, on the same match the cost chips use,
  so nothing is counted twice and nothing is deleted.
- **Currencies as a dropdown**, from a configurable short list that starts as
  CHF, EUR, USD. Every money field picks from it rather than taking three
  typed letters. The home currency is always offered even when the list omits
  it, and so is whatever a note already holds, so opening a booking in ZAR and
  saving it cannot rewrite its currency.
- **Two people, two tickets.** Every priced line says who it is for
  (`persons:`, empty meaning everybody on the trip) and what its figure is per
  (`costUnit:`, one of total, per person, per night, per person per night). A
  fare quoted per passenger is multiplied by the people on the leg; a room
  quoted per night is multiplied by the nights and not by the people. The
  multiplication is redone on every render and stored nowhere, and each row
  shows its working. Room types are deliberately not guessed at: the itinerary
  says how many people a stay is for and leaves single against double to the
  price you looked up.
- **A budget tile** on the Trips dashboard for the next trip, and a committed
  total on trip cards that have bookings.
- **An exported cost sheet**, printable, beside the trip note. It shares its
  paper with the photo spot field sheet, which is what moved the print
  stylesheet into `shared/print-sheet.ts`.
- **Four booking warnings** in the health check: a booking whose trip does not
  exist, an amount with no currency anywhere, a split naming somebody who is
  not on the trip, and two bookings sharing a reference.
- **A field sheet.** A photo spot exports as one self-contained HTML file
  beside its note, from a button in the block or a command that only appears
  inside a photo spot note: motifs with their bearings and light windows
  resolved to clock times, gear, technique, the samples inlined and scaled
  down, the access details and the day's sun figures, laid out for A4 with a
  box to tick with a pen. Written for the date the sun panel is showing, and
  reaching the network nowhere, so it prints and reads with no signal. The
  design cited exactly this in its argument for the block's own fence
  language and nothing had implemented it.
- **Light on the itinerary.** A stop at a photo spot now carries the motif it
  is for, that motif's light window resolved to a clock time on the day of
  the stop, whether the sun will be behind you or behind the subject, and the
  lens. Until now a stop at a photo spot rendered exactly like a stop at a
  restaurant.
- **A stop can say which motif it is for**, as a new `motif` sub-key inside
  `stops:` (`stopMotifField`). The golden-hour prefill reads it, so a stop
  that goes for a spot's secondary motif is no longer timed from the main
  one's light, which at a spot like Neuchâtel is wrong by twelve hours. An
  unmatched name is kept and shown rather than dropped, like an unresolved
  place link.
- **The stop editor says where a suggested time came from**, naming the light
  window and that the time is overwritable. A time that appears by itself and
  happens to be wrong is worse than no time.
- **The sun panel draws the day** as a band of night, blue, golden and
  daylight with hour ticks and a legend, above the figures it already
  printed, and says which zone and coordinates it is computing for.
- **A "next light" line** above the motif cards: when the main motif's
  preferred light happens next, today or tomorrow, in the spot's own zone.
- **The shot list ticks a motif off.** The moment you know you got the shot is
  the evening of the day you took it, and the note open then is the trip. It
  writes `captured` into the spot's own note and stamps the day the trip was
  there when that day has passed.
- **Two photo spot health warnings**, both promised by the design and neither
  implemented until now: more than one motif marked `main`, and a sample
  naming a motif the note does not have. A third joins them: a spot with
  coordinates, no `timezone:`, and a longitude far enough from this device's
  own that its sun times are being computed in the wrong zone.
- **Named-season buttons** in the motif editor (spring, summer, autumn,
  winter, all year). They write months, so nothing about what a note stores
  changes.
- **Display settings**: `language` (follow Obsidian, or pick one),
  `clockFormat` (`auto`, 24-hour, 12-hour) and `units` (kilometres or miles).
- **Plural forms.** A translation may carry the categories its language
  actually has, selected with `Intl.PluralRules`. The `{plural}` placeholder
  that held an English "s" is gone; it was already producing "Notizs" in
  German.
- **The sixteen compass points are translated as whole tokens**, rather than
  composed from four translated letters. Composition works in German and is
  wrong in any language that writes them in a different order: Chinese has
  southwest as 西南, west first.

### Changed

- **A language is declared in one place.** The locale registry in
  `lang/translations/index.ts` carries the code, its native name, its
  direction and its table together; a locale without a table can no longer be
  "supported". Adding a language is one file and one entry.
- **English is the base language in the type system too.** `en.ts` is
  unannotated so its shape IS the `Translations` type; German is checked
  against it as complete, and a community locale is a deep-partial, so a
  translation that covers eighty percent of the UI can ship instead of
  failing the build.
- **Light conflicts compare every pair of stops in a day**, not only
  neighbours. Two spots wanting the same evening with dinner listed between
  them were never compared before. One warning per stop, the sharpest one.
- **Light chips read by colour**: blue for the blue hours, warm for the
  golden ones and the two instants, neutral for the three that are sky
  conditions. The repeated sun icon is gone and the time is set in tabular
  figures. A window with no end on the date reads "from 22:14" rather than as
  an instant it is not.
- **The photo spot block says how far along you are** in its Motifs heading,
  shows a motif's own coordinates when it has them, gives the main motif its
  own icon, and makes the website a link rather than text.
- **The day band moved to `shared/sun-band.ts`**, since two surfaces draw it
  now. `startOfLocalDay()` is exported with it, so anything drawn against the
  band agrees with it about where the day starts.
- **The stylesheet is direction-aware**: every inline offset is written as
  `inline-start`/`inline-end`, so a right-to-left locale lays out rather than
  mirroring text inside a left-anchored frame.
- **The settings page is one page again, with two sub-pages.** The tab strip
  is gone. The root page carries a plugin block (version, release notes,
  support and contact links), Vault setup, the four display switches and
  About; the two long lists live one click away, as **Folders** and
  **Property keys**, each behind a row that says how many settings are in
  there. Nothing was removed and no setting changed its meaning.
- **Every frontmatter property name is on one sub-page**, grouped by the note
  type that carries it, instead of being split between a CRM block and a
  travel block on the folders tab. The switch that unlocks them for editing
  is the first row of that page and appears nowhere else, rather than being
  repeated at the top of a tab that also held folders.

### Fixed

- **Money and dates printed in the machine's convention, not the vault's.** A
  trip document on a Mac set to German showed `4.298,00 CHF` where Switzerland
  writes `4'298.00`, and the two disagree about what a dot means. `formatMoney`
  has taken a `locale` since it was written, with a header explaining this exact
  case -- and not one of the forty call sites ever passed one, so the parameter,
  the reasoning and the fallback were all correct and unreachable. There is a
  **Number and date format** row on the settings tab now; leave it empty to
  follow the computer, or set `de-CH`. The date formatters take it too, so a
  figure and the date beside it are no longer drawn in two countries'
  conventions.

- **The trip document priced the first thing in a category and nothing after
  it.** A trip with two flights printed the outward fare and left the return
  blank, and two priced hotels would have gone the same way; the cost sheet
  beside it had both all along, which is what made it look like the document
  had lost one. The loop asked whether a category was already in the map it was
  itself filling, so the first estimate landed, made `transport` present, and
  every later one was dropped on the next line -- and the accumulator
  underneath it was correct code standing where it could never run. The budget
  still wins over the estimates in its category; what changed is that
  *estimates* now add up among themselves. Extracted to
  `trips/costs/planned-total.ts` so there is somewhere to test it, which is
  most of the point.
- **Two settings had no row in the settings reference**, `personRolesProperty`
  and `companyRolesProperty`, and the page claimed a count of the Property keys
  sub-page that was twenty-two short. Both are now covered by a test rather than
  by somebody reading two files at once; the count is gone, because a number in
  prose is the one thing on that page nothing can check.
- **Four things the printer did to the page**, all found by printing a real
  trip to PDF and none of them visible in the markup. The hero picture kept a
  browser's default figure margin, so the largest picture on the page sat 80px
  narrower than the rule above it and the text below it; the gallery's figures
  had always reset that and the hero was simply missed. A section heading could
  be stranded at the foot of a page, naming a section the reader could not see;
  the heading is bound to the first block under it now, in the markup, because
  the declaration that says so is the one an engine may ignore and Safari does.
  The gallery asked for three 59mm columns of a body that asks for 190mm and is
  given less by `@page` and less again by the printer, so it fell to two per row
  and ran to twice the length; a column is a share of the row now, and is three
  across whatever the row turns out to be. And the overview split across a page
  break: it is kept whole, which costs white space at the foot of the page it no
  longer fits on and leaves the first page as the title, the picture and the
  highlights.
- **A day's paragraph printed as large as the trip overview.** It declared no
  size of its own, so it inherited the body's 11pt and near-black while the
  timed lines under it are 9.5pt and muted -- which reads, correctly, as a
  different font arriving in the middle of a day. It is a step below the
  overview and a step above the lines now: the paragraph introduces the day and
  the lines are its schedule. The itinerary block had the ordering *inverted*,
  with the paragraph quieter than the lines, and now matches. The three prose
  sizes are checked in order rather than by value, so the sheet can be retuned
  but a rule that declares no size cannot pass.
- **A blank line in a note vanished from the printed document.** A day's
  paragraph, a stop's note and the overview are somebody's prose and may be
  two paragraphs; YAML kept the break, the parser kept it and the editor showed
  it, and then HTML collapsed the newline to a space. All three prose fields
  print with the break now, in the document and in the itinerary block.
- **A leg carried no field for the airline or the train.** `legCarrier` and its
  description and placeholder were written into both locales and the input they
  label was never added to the form, so `carrier:` could only be reached by
  typing YAML by hand. Nothing in the build has an opinion about a string
  nobody prints, so the trip editor's own labels are now checked for the
  inverse -- a label that exists and is asked for by nothing. That check also
  found ten labels left behind when the itinerary moved out of the trip editor
  into its own block; they are gone.

- **The trip document printed no flight, and no stays.** It read `stops` and
  nothing else, while the itinerary block draws three bands -- so an outbound
  leg the note carried was simply absent, and the document opened at "Tag 2"
  because nothing was a *stop* on day one. Transport and stays are their own
  sections now, after the day-by-day: the Reiseverlauf is the trip itself, day
  one to the last day, and a flight is settled later and lands outside those
  days as often as not. Each leg says the days it spans, and a note under the
  heading explains what a day outside the trip means -- shown only when one is
  used.
- **The costs section was empty for a trip whose money is in its itinerary.**
  It printed budget lines alone, so a trip with no `budget` and a priced leg
  showed nothing while the block above it showed the figure. It prints the
  budget **and** the itinerary's own estimates now, in the trip's own currency;
  the cost sheet beside it has included them all along. The total reads
  "Planned" rather than "Budget", because calling an estimate a budget claims
  somebody set a ceiling.

- **The test tree is type-checked**, by `npm run typecheck` and therefore by
  `build` and `check`. It was not, and a fixture is a hand-written literal
  annotated with the type it claims to be: when the type grew a field, every
  fixture silently kept producing the old shape while the suite went on
  passing. `PROPS` in `trip-note.test.ts` carried `undefined` for five settings
  added the same morning, so the suite meant to cover them covered nothing --
  it is derived from the real mapping now. Five files each had their own
  `stop()` and four their own `trip()`; they are one set of builders in
  `tests/fixtures.ts`, so the next field is one edit rather than twenty-five.
- **Two broken rules in the photo spot field sheet's own stylesheet**, there
  since its first commit: a stray `}` and an orphaned `border-bottom` left at
  the top of `STYLE` when `h2` was extracted into the shared print sheet, and a
  `table.logi th` whose selector line had gone, leaving its declarations to be
  swallowed by the rule above. A browser recovers silently from both, so the
  sheet printed plainer than it was written to and a full documentation audit
  read past it twice. The stylesheet of all three sheets is now checked for
  balanced braces and for declarations standing outside any rule.
- **The German settings text for the bookings folder** still described it as
  the folder every booking goes in. English was corrected when a booking could
  first live inside its trip and German was not.

## [0.1.0] - unreleased

The first version. Not tagged and not published to Obsidian's community plugin
directory; builds are distributed by Technosoftware GmbH for internal and
customer vault use.

### Added

- **Trips.** One note per journey, carrying its participants, the cities it
  touches, a timed itinerary of stops, the nights it books and its transport
  legs, all edited from the trip note itself and rendered by a
  `travel-itinerary` block.
- **Places.** A Country / State / City hierarchy with five kinds of reusable
  place note under it: accommodation, food and beverages, landmarks, locations
  and photo spots.
- **Derived visits.** `visited` and `lastVisit` are computed at read time from
  the stops of trips whose status is `Over` and never written back. An explicit
  value in the note always wins.
- **Photo spots.** Motifs with a shooting bearing, the light each one wants, the
  lens and gear, and whether it is in the bag already, plus access fields,
  transit and samples, rendered by an `apt-photo-spot` block.
- **Offline sun times.** A NOAA solar solve computes sunrise, sunset, golden and
  blue hour from the coordinates and the date, with no network involved,
  classifies a motif as front, side or back lit, prefills a trip stop from the
  golden hour and warns when two stops cannot both happen.
- **Three dashboards** (Trips, Places, CRM) and one gallery across every entity
  type.
- **CRM.** Person and Company notes read, created and rendered out of
  `CRM/People` and `CRM/Companies`, on defaults shared with CULItrail through
  `trail-core`'s `CRM_CONTRACT`. A `travel-related-trips` block answers which
  trips a person came on. Nothing links a Trip to a Company: that was considered
  and deliberately left out.
- **A health check** over all eleven folders, listing every note whose type is
  missing or disagrees with its folder and offering to fix them, writing nothing
  without confirmation.
- **English and German**, detected from Obsidian's own language setting, with
  locale-seeded folder defaults.
- **Every vault-facing name is a setting**, behind the `unlockPropertyNames`
  lock, with three documented subtype-specific exceptions read at literal names:
  `accommodationType`, `accommodationStatus` and `fnbType`.

### Known limitations

- **Forty-five of the vault-facing settings have no settings-page row.** The
  photo spot structure is twenty-seven of them and the trip structure eighteen.
  They are real settings, honoured by the reader, the writer and the validator,
  and edited in `data.json` when they need editing at all.
- **No map view.** `geoLocation` is read and stored, and used for distance and
  bearing, but never drawn.
- **Settings adoption runs one way.** CULItrail adopts CRM settings from this
  plugin on its own first load; this plugin adopts from nobody.
