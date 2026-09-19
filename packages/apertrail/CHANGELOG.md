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

- **A trip can be archived.** **Archive trip**, from the command palette or a
  gallery card, moves the note into `<archiveFolder>/<tripsArchiveFolder>/`
  (`6 Archive/Trips` by default, `6 Archiv/Trips` in German) and stamps
  `archived:` with the day; **Restore trip from archive** is the way back. A
  trip that owns a folder of its own travels as that folder, so its bookings,
  its pictures and its exported sheets go with it, and its `image:` is repointed
  afterwards because a folder rename leaves that one plain path saying where the
  picture used to be. Its `type:` does not change.

  **An archived trip is still read**, which is where this parts company with
  NODAtrail's archive: there the live readers stop seeing an archived note and
  each view opts back in, here `readTravelBoard()` reads both folders in one
  pass. A city's `visited` and `lastVisit` are derived from the trips that
  stopped there, so a retired trip dropped from the board would take the
  evidence of a real journey with it. The vault this was built for had five
  finished trips moved into an archive folder by hand and four cities and three
  places quietly reported as never visited; a filing decision is not allowed to
  mean that. A retired trip keeps its row in a city's related-trips block,
  marked **Archived**, and the gallery is the surface that hides it, behind a
  filter in the Trips row.

  Nothing is archived automatically, and nothing migrates: a vault that already
  has trips in an archive folder gets them back on the board, undated, the
  moment the folder setting matches.

### Changed

- **A country's states and a state's cities are derived from the notes below
  them, not read from a list.** `states:` on a Country and `cities:` on a State
  used to be where the plugin looked to find out what sat under a note. Nothing
  wrote them, so they were kept by hand, and a town added to a vault stayed
  invisible in its province until somebody remembered to type it into a second
  note. Nothing said so: an empty list and a province with no towns look
  identical. Both lists are now derived from the link the child already
  carries -- a city names its state, a state names its country -- and sorted by
  title. Adding a town to a province is one edit in one note.

  **An existing vault needs no migration and none is performed.** The two
  properties are left exactly as they are and are simply not read for the
  hierarchy any more; the note templates and the New country dialog no longer
  seed them. The one case where the old reading said something this one does
  not is an entry whose child does not name the parent back, and the vault
  health check now reports those under **Child lists naming somebody else**, so
  the difference is visible rather than silent. `statesProperty` and
  `citiesProperty` remain settings because that check reads them.

### Fixed

- **A wikilink whose umlaut is normalized differently from the file name it
  names now resolves.** Every title index in `readTravelBoard()` -- countries,
  states, cities, places, excursions, vehicles and trips -- was keyed on the
  raw basename and looked up with text out of somebody's frontmatter, which is
  the exact pattern the `caseFold()` work was introduced for and the one place
  it had not reached. On macOS a name typed into a rename box is decomposed and
  one pasted from a brochure is composed, so a city could name a state the
  vault has and resolve to nothing. The symptom was a card with one fewer meta
  row, indistinguishable from a note nobody filled in.

- **A cabin, a place, a person or a photo spot whose name is spelled with a
  differently normalized umlaut on the two sides now matches.** macOS writes an
  umlaut two ways: a name typed into a rename box tends to be decomposed, a name
  pasted off an operator's page is composed, and the two compare unequal. Every
  name comparison in the plugin now goes through `trail-core`'s `caseFold()`,
  which composes before it lowers. The case this was most likely to bite is the
  one the plugin already has a health check for: a leg's `variants` naming a
  cabin the ship's catalogue also lists, where the only symptom of a mismatch is
  a description that quietly does not appear.
