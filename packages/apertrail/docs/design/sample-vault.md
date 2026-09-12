# The sample vault

**It is a command now.** `Create the sample notes` writes sixteen notes into the
vault you already have, rather than asking you to download a second one. The
content is `src/sample/notes.ts`, the planning is `trail-core`'s
(`planSampleVault`), the vault read is `src/sample/read-folders.ts`, the write is
`src/sample/write.ts`, and the preview dialog is
`src/sample/ui/sample-vault-modal.ts`.

`tests/sample-vault.test.ts` asserts every claim on this page against the
parsers that will actually read the notes: `readTravelBoard`, `readCrmBoard`,
the photo spot parser, and `trail-core`'s own summary reader. It seeds a vault
and reads it back rather than comparing note text to strings, because a
hand-authored note whose heading or wikilink is subtly wrong looks perfectly
fine in Markdown and renders as an empty view.

**That suite runs unconditionally.** The old arrangement was a folder called
`APERtrail-Sample` sitting beside the repository, which meant the test skipped
wherever the folder was absent, which was everywhere but one machine. There is
nothing to skip now: the notes are in the package, and a change that breaks one
of them fails the suite on every run.

Everything in the notes is in English, and every wikilink in them resolves to a
note the same run writes.

## What gets written

```
Places/
  Countries/                  2   Switzerland, South Africa
  States/                     1   Aargau
  Cities/                     3   Brugg, Cape Town, Pretoria
  Accommodation/              1   Table Bay Lodge
  Food & Beverages/           1   Cafe Fahrwerk
  Landmarks/                  1   Table Mountain
  Locations/                  1   Aare Riverside Path
  Photo Spots/                1   Signal Hill
Trips/
  Rovos Rail 2026/            1   Rovos Rail 2026.md
  Aargau Weekend/             1   Aargau Weekend.md
CRM/
  People/                     2   Stefan, Erika
  Companies/                  1   Rovos Rail Charters
```

That is `DEFAULT_SETTINGS` with an empty `rootFolder`, which is what those
defaults were named for. Every path comes from settings, so a vault that has
moved its tree gets the notes wherever it moved it to.

**A trip gets a folder of its own**, named after the trip, because
`newTripFolder()` is where this plugin puts every trip it creates and a sample
trip should land where a real one does. See `src/trips/trip-folder.ts` for why a
trip is a folder at all.

One consequence is worth naming rather than discovering: the target folders are
the twelve above, and `Trips/` itself is not among them. It is therefore never
checked for strangers. A vault that already keeps trips flat in `Trips/` is not
refused on their account; a folder named after one of these two sample trips
that holds somebody else's note is.

Cover images are a different matter. The seeder writes notes and no pictures, so
the `image:` on Brugg and Cape Town points into a `_resources` folder that is not
there. That is deliberate: a path with no file behind it is a state every card
has to render gracefully, and it is far commoner in a real vault than a complete
one.

## What each folder demonstrates

| Folder | What it is there to show |
|---|---|
| `Trips/` | The range rather than two of a kind. `Rovos Rail 2026` is finished and reviewed and carries everything a trip can carry: named days, stops with times, a rating on one stop, a stop naming a photo spot's motif, accommodation nights, a leg in each direction, participants, its own currency, a budget and a conversion rate. `Aargau Weekend` carries dates, a city, one person and nothing else, not even a `travelStatus:`, so it is the trip that exercises the status every reader derives when the note has none |
| `Places/Countries` | Both halves of the top level, and neither one lying. Switzerland points down with `states:` and names no `capital:`, because Bern is not a note here. South Africa names `capital: [[Pretoria]]`, which it does have, and no states at all |
| `Places/States` | The middle level, pointing up at Switzerland and down at Brugg. Only one country here uses it, which is exactly why `state:` is optional on a City |
| `Places/Cities` | Both extremes, because the reader has to be happy with both. Brugg and Cape Town are full notes with coordinates, a cover image and body text; Pretoria carries its type, its country and nothing else |
| `Places/Accommodation` | `accommodationType` and `accommodationStatus`, on the note the Rovos trip's `nights:` block points at |
| `Places/Food & Beverages` | `fnbType`, `rating`, `address` and `website` on one place |
| `Places/Landmarks` | A place a trip stops at that is neither food nor a bed, and the one stop on the trip that carries a rating of its own |
| `Places/Locations` | The catch-all place type, for somewhere worth remembering that fits none of the others |
| `Places/Photo Spots` | The full photo-spot shape: timezone, opening hours, entry fee, accessibility, parking, a transit entry, and two motifs that each carry their own coordinates, bearing, light windows, season, lens and gear. One is captured and one is not, which is the pair the capture state needs before it has anything to say. The coordinates are real, because this is the note the sun work is read against |
| `CRM/People` | The `personsFolder` lookup: the configured type value, a `tags` value, the `roles` the other two plugins read, and the contact field a person card shows |
| `CRM/Companies` | The same shape one level up: the company type value, tags, roles, and a website and phone number a person note has no use for. The Rovos trip's outbound leg names this company as its `carrier:`, as a wikilink, which is how a carrier that does have a note is written |

## The refusal rule

**A target folder may hold nothing except notes the plan would itself write.**
Anything else in it is a stranger, and one stranger refuses the whole run: the
notes reference each other, and half a sample vault is a screen of unresolved
wikilinks that reads as a broken plugin rather than as a skipped folder. A note
that is already there is skipped and never overwritten, because it may have been
edited and a sample vault is not worth losing an edit over. The one edit made to
a note that already exists is appending APERtrail's own `travel-related-trips`
fence when it is absent, and that is counted and shown separately in the preview
because it is the only thing here that touches a file this plugin did not write.

**The two CRM folders are the exception**, marked `shared` on the three notes
that live in them: no contract says which companies a vault holds, so each
plugin seeds the company its own notes need, and a rule that called a sibling's
supplier a stranger refused the whole run the first time the three seeders met
in one vault. A shared folder therefore never refuses; what is already in it is
reported instead, so the preview can say what it is writing beside and leave the
decision to a person.

The preview dialog says all of this before anything happens: what it would
create, grouped by folder; what it would skip; what would gain a block; what is
already sitting in the shared folders; and, when the plan refuses, which folders
are occupied and by what. The action button greys out rather than disappearing.

## The datetime sharp edge

Obsidian's YAML parser turns an unquoted `2026-02-13T09:00` into a native `Date`,
and a `Date` read back through `readDateLike()` is truncated to `YYYY-MM-DD`.
Every datetime the seeder produces is therefore a string, never a `Date`, and it
reaches the note through the host's own serializer, which quotes it. See
[Data model](data-model.md#the-datetime-sharp-edge).

That is the main reason the seeder builds a trip's frontmatter by calling
`buildTripFrontmatter()` and a spot's by calling `buildPhotoSpotFrontmatter()`,
rather than assembling the maps by hand from settings keys. Those two functions
are where the plugin already decides which sub-keys are omitted when empty, how a
cost unit is written beside a figure, how a title becomes a wikilink, and that a
datetime leaves as a string. A sample note assembled around those rules instead
of through them would look right on the day it was written and drift the first
time one of them changed, and the notes would go on demonstrating a format the
plugin no longer writes. The writer then puts each note on disk through the same
three calls every creator in this plugin makes, so a sample note's frontmatter is
ordered exactly like a note made from a dialog and carries the same `created`
stamp.

The test guards both halves: it asserts that no property handed to the writer is
a `Date`, and that no note comes out with an unquoted date or datetime in it.

## The shared CRM notes

`Stefan` and `Erika` are byte-compatible with the Person notes CULItrail and
NODAtrail seed: same folder, same type value, same tags, same roles, same email,
in the same order. That is not a coincidence anybody has to maintain by hand, it
is the `CRM_CONTRACT` in `trail-core` that all three plugins take those defaults
from.

Whichever plugin is seeded first writes those two notes. The others find them
already there, skip them, and append only the fence they own the constant for, so
one `Stefan` ends up carrying a `travel-related-trips` block and a
`culi-related-orders` block and renders in whichever plugin is reading it. A
plugin can only ever append a fence it owns, which is what keeps this from being
one plugin knowing about another.

For the install order in a vault that is getting more than one of them, see the
suite-wide [sample vault page](../../../../docs/sample-vault.md).

## Why the German original is gone

The vault started as a German-language set of notes with property names to match
(`ortAdresse`, `webSeite`) and folder paths from a different vault's hierarchy.
Both are now English and both sit in the default tree.

That does not make the settings pointless, it makes them demonstrable:
`addressProperty` and `websiteProperty` exist precisely so a vault that spells
those properties in its own language never has to rename anything on disk. The
seeder resolves every folder and every property name through settings, so a vault
that has renamed either gets its sample notes in its own spelling. The defaults
are what you see; the settings are the way out of them.

## Keeping it honest

`visited` and `lastVisit` are derived from the trips that stop at a place
(`src/vault/visit-derivation.ts`), so writing them into a note as well would
create two sources of truth that quietly disagree. The seeder therefore writes
neither, on fifteen of the sixteen notes.

**Brugg is the exception, and it is there to show that an explicit value wins
over a derived one.** It is the honest place for it: `Aargau Weekend` records no
stops, so nothing derives a visit to Brugg from any trip, and a town somebody
knew long before this vault existed still has a history worth keeping. The note
carries `visited: true` and `lastVisit: 2019-06-08`, and the reader folds that
explicit date in alongside derived ones rather than replacing it. Everywhere else
the derivation does the work: Pretoria, Table Mountain and Signal Hill read as
visited because a finished trip stopped at them, and not one of those three notes
says so itself.

Contact details, prices, companies and phone numbers are invented. The email
addresses are on `example.invalid`, which is a reserved domain that cannot be
delivered to, so the notes can be shared without leaking anything or reaching
anybody.
