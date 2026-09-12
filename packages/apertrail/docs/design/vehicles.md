# The thing you travel on

A ship, a named train, a riverboat: MS Trollfjord, the Rovos Rail Pride of
Africa. Added 6 September 2026, the first new entity type since photo spots.

## Why it is a note and not a field

`carrier:` on a leg was documented as "the airline, the railway, **or the
train's own name**", and that "or" was two facts wearing one field. Hurtigruten
runs the voyage; MS Trollfjord is the ship you are on. A leg often wants both,
and only one of them is a thing you would keep a note about.

What made a note necessary rather than merely tidy was the cabins. A cruise is
sold in categories -- Polar Aussenkabine, Arktis Superior -- each with a
description that is the same on every sailing, and retyping them per trip is
the kind of duplication that goes wrong quietly.

## What it is not

**Not a place.** A place is somewhere you went: it has coordinates, a country,
a city, a `visited` flag derived from the trips that stopped there. A vehicle
has none of those and is never an itinerary stop, so it is not a member of
`TRAVEL_PLACE_TYPES` -- the same call a booking got, and the mirror image of
the one photo spots got, which needed every field of the place shape and so
joined it.

**Not the carrier.** `carrier` stays exactly what it was.

**In the gallery, on the second try.** It was left out at first, and the
reason was real: every facet beside the type chips is a place facet -- visited,
last visit, rating -- and a vehicle answers none of them, so touching one would
empty the grid of precisely the rows somebody had just filtered to.

What that argument missed is that the facet row is not fixed. `renderCommonFacets`
builds its dropdowns from the rows currently in scope, and a facet with nothing
to offer is not drawn at all, so with the Transport chip active none of the
three appears. The only way to reach the failure was to set a facet under a
different chip and carry it in, and that is now cleared on the way in -- the
mirror of the clearing `applyTypeFilter` already did for the Trip and
photo-spot facets on the way out. People and companies had the same hole and
are cleared by the same list.

So a vehicle gets a chip, a create button and a counter tile. The tile is the
one on that row with a single number rather than a fraction: there is no
denominator to put under a ship. She is not visited and not captured, and there
is no set of all ships to have seen some of.

## The shape

```yaml
---
type: vehicle
description: The Hurtigruten flagship, rebuilt in 2023.
mode: boat
operator: "[[Hurtigruten]]"
built: 2002
refurbished: 2023
capacity: 500
length: 135 m
tonnage: 16151
website: https://example.invalid
deckPlan: Places/Vehicles/_documents/trollfjord-decks.pdf
image: Places/Vehicles/_resources/trollfjord.webp
cabins:
  - name: Polar Aussenkabine
    description: Aussenkabine mit Fenster, ca. 12 m2.
    image: Places/Vehicles/_resources/polar.webp
  - name: Arktis Aussenkabine Superior
    description: Grössere Aussenkabine auf dem Oberdeck.
---
```

`description:` is the one-line version, sharing the property name a Person and
a Company note already use rather than inventing a second word for the same
thing; the long prose is the note body. Each cabin may carry its own `image:`,
which is what the brochure prints beside it -- the ship's hero picture repeated
three times would answer a question nobody asked.

Body text and a picture gallery are the trip's own `image`/`gallery`
properties, read here and **not owned** here: an edit clears the keys this
schema writes and leaves the pictures alone, because an editor that deleted a
photograph nobody asked it to touch is a worse failure than a stale field.

### The folder

`Places/Vehicles` by default, and a vehicle is not a place. The rule that
decides it is older and stronger than the naming discomfort: *every folder is
derived from one of the three module roots, which is what keeps each module
relocatable as a unit*. A fourth root for one note type would buy nothing and
cost a fourth section on the settings page. It is one setting, so a vault that
disagrees moves it.

### The operator, and a decision reopened

`operator:` points at a CRM Company. `dashboard-split-and-crm.md` had ruled
that out: *"linking a Company to the places it operates (no `company:` property
on place notes). It came up and was deferred."* Read carefully, that is a scope
deferral rather than a principle, and the principle beside it is narrower than
it looks: *nothing links a **trip** to a company*. That still holds. A trip has
no company property, and nothing in the code walks from a trip to one.

**The plugin resolves the operator link itself: it does not.** The value is a
real `[[Wikilink]]`, so Obsidian opens it, backlinks it and graphs it, and this
plugin reads the Company folder on no render at all. That is cheaper, and it
keeps the plugin out of a join it was told to stay out of.

## The cabins, and where a price lives

**The catalogue is here. The price is on the sailing.** A cabin costs one thing
at Christmas and another in May, so what a cabin costs belongs to the leg that
books it and lives in that leg's `variants` (see `data-model.md`). A variant
that names a cabin takes its **description** from here at render time.

Nothing is copied and nothing is written back. Correcting a description in the
ship's note corrects it on every trip that ever sailed on her, which is the
whole reason the catalogue is somewhere other than the trip.

Matching is by name, trimmed and case-folded, because that name is typed twice
-- once in the catalogue, once on the leg -- and "Polar Aussenkabine" and
"polar aussenkabine" are the same cabin to everybody except a comparison.

## Reaching it

- **New ship or train** creates one, collecting what somebody knows when they
  first write it down: the mode and the operator. No cabins at creation, for
  the reason a photo spot collects no motifs: a ship you have just heard of is
  worth a note before you know what its suites are called.
- **Cabins and details of this ship or train** edits the catalogue and the
  facts. A `checkCallback` command, so it appears in the palette only inside a
  vehicle note, **and a button on the related-trips block** beside Cover and
  Prospect.
- A **dialog rather than a block.** The photo spot answered the same
  list-of-maps problem with a fenced block; a catalogue is short, changes
  rarely, and is read far more often than written, so a dialog costs a
  fraction of a block. A block is the upgrade path if a vehicle ever grows
  something worth seeing in the note.

  **The sentence that used to end that bullet said a command "puts the same
  thing within reach", and it was wrong.** It shipped as a palette command
  with no button anywhere, survived two more entity types, and the first
  person to fill in a real ship could not find it -- which is the failure this
  repository had already written down one document over, in
  [Prospects](prospects.md): a command with no button is a feature nobody
  finds. Which subjects offer which button now lives in
  `trips/related-trips-actions.ts`, apart from the drawing, so a test can ask
  the question the render used to answer alone.
- The **related-trips block** works on a vehicle note: which trips sailed on
  her. One more subject rather than a second block, which is the rule a Person
  note already set.

## The brochure

**Export this ship or train as a brochure**, from the palette or from the button
above the trips on the ship's own note. One self-contained page on the same
paper as the trip document and the two cost sheets, in an operator's own order:
the name and the short description, the hero picture, the cabins with their own
pictures, the facts in a grey box, the rest of the gallery -- and last, the
trips you sailed on her, which is the one section a real brochure could never
print and the one that makes it yours.

It lands where every sheet does: `<the ship's folder>/_exports/`, beside the
renderings of every other note in that folder, and it opens in a new tab once
it is written.

**The note's own summary is printed under the hero**, beside `description:`
rather than instead of it: the property is the line an operator would put under
her name, and the `> [!SUMMARY]` block is what the note's owner wrote about her.
A ship carrying one, the other, or neither prints exactly what it has. The
reader is `shared/note-summary.ts`, which used to be `trips/write-trip-summary.ts`
and was never a trip's: the callout is a note format, and any note may carry
one.

The button lives on the related-trips block because a vehicle has no block of
its own, and that block is what is actually rendered in the note. It sits
beside the Cover and the Cabins buttons, which are there for the same reason.
The trip document shipped without a button once and it showed the same
afternoon.

## Filling a leg in

Three fields on a leg name things the vault may or may not have a note for, and
each narrows the next: the carrier suggests the Company notes, the ship
suggests that operator's vehicles, and a variant's name suggests that ship's
cabins. `trips/leg-suggestions.ts` holds the rules and two of them are worth
stating:

- **A filter that empties a list is worse than no filter.** A carrier that
  matches no operator -- an airline nobody wrote a Company note for -- narrows
  nothing, rather than hiding every ship at the moment somebody is picking one.
- **Cabins are the exception.** With no ship named there is nothing to be the
  cabins of, and every cabin in the vault would be other ships' rooms.

All three stay free text, because most airlines will never be a note. The
cascade is a suggestion, never a requirement, and none of it has to be filled
in at all.

## The deck plan

**One document, not a picture.** A deck plan is a PDF, a train layout usually
the same, and nothing can inline one the way a picture inlines. So it is a
value the four surfaces link to rather than show, and `deckPlan:` sits beside
`website:` rather than beside `image:`: both are somewhere to go, not something
to look at.

`deckPlan` rather than `layout` or `plan`, on the grounds that a bare
frontmatter key beside `image` and `website` should say what it is a plan of.
It reads slightly oddly on a train note, which is what the settings label is
for -- it names both, and the property is a setting like every other.

**One value, not a list**, and this is the decision most likely to be revisited:
a big ship publishes one sheet per deck. A list would have handled that, at the
cost of a nested block in the frontmatter for a field that is one line in every
vault today. Merging four sheets into one PDF is a thing a person can do; a
schema is not.

Where it shows, and it is a link in all four:

- **The leg**, beside the ship's own name, because the moment you want the plan
  is the moment you are choosing between the cabins printed underneath it.
- **The cabins dialog**, so the whole ship is edited in one place.
- **The brochure's grey box**, as a relative link. The sheet is a file in the
  vault folder and is opened outside Obsidian by whoever it was sent to, so an
  absolute vault path in it resolves to nothing. `relativeVaultPath()` is that
  arithmetic, and the website became a link on the same pass -- it had always
  been printed as bare text.
- **The gallery card**, as presence only. A card meta item is a label and an
  icon and the grid opens the note on a click, so what the chip answers is
  which of the ships you have a plan for, which is a question you ask of the
  whole grid rather than of one card.

**A URL is a plan too.** Hurtigruten publish theirs on the web, and "like the
website" was the whole brief. `resolveReference()` answers three ways -- a URL,
a file, or nothing -- and the third is what the health check reports. The
brochure links straight out, and the leg renders a real anchor so Obsidian
opens it in the system browser.

**A plan that resolves to neither shows nowhere**, on every surface. That is
the same rule a picture follows, and on its own it is the wrong rule: silence
is exactly what a typo produces. Which is why the health check now says so --
see `vault/health/missing-file-issues.ts`.

## Still open

- ~~**The trip document prints the ship's name and its cabin descriptions**,
  and does not print the ship's own picture or prose.~~ Closed: it prints her
  one-line `description:` under the line that names her. Not her picture and
  not her prose -- she has a prospect of her own now, and repeating it on every
  trip document she appears in is what that page exists to avoid.
- ~~**Nothing warns when a leg's variant names a cabin the ship does not
  list.**~~ Closed: `vault/health/variant-cabin-issues.ts`, and only where the
  variant carries no description of its own -- borrowing one is what the match
  was for, so a variant that describes itself loses nothing by not matching.
- **One deck plan per vehicle**, as above.
