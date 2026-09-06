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

**Not in the gallery**, for now. A ship has a picture and would look right
there; the rest of that view would not. Every facet beside the type chips is a
place facet -- visited, last visit, rating -- and a vehicle answers none of
them, so touching one would empty the grid of precisely the rows somebody had
just filtered to. Worth doing properly, not worth doing by half.

## The shape

```yaml
---
type: vehicle
mode: boat
operator: "[[Hurtigruten]]"
built: 2002
refurbished: 2023
capacity: 500
length: 135 m
tonnage: 16151
website: https://example.invalid
image: Places/Vehicles/_resources/trollfjord.webp
cabins:
  - name: Polar Aussenkabine
    description: Aussenkabine mit Fenster, ca. 12 m2.
  - name: Arktis Aussenkabine Superior
    description: Grössere Aussenkabine auf dem Oberdeck.
---
```

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
  vehicle note.
- A **dialog rather than a block.** The photo spot answered the same
  list-of-maps problem with a fenced block; a catalogue is short, changes
  rarely, and is read far more often than written, so a command costs a
  fraction of a block and puts the same thing within reach. A block is the
  upgrade path if a vehicle ever grows something worth seeing in the note.
- The **related-trips block** works on a vehicle note: which trips sailed on
  her. One more subject rather than a second block, which is the rule a Person
  note already set.

## Still open

- **The gallery**, as above.
- **The trip document prints the ship's name and its cabin descriptions**, and
  does not print the ship's own picture or prose. A brochure would.
- **Nothing warns when a leg's variant names a cabin the ship does not list.**
  It is a typo with a silent symptom -- the description simply does not appear
  -- and the booking health check is where it would belong.
