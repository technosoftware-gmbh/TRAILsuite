# Trip

The main entity. One note per trip, linking out to the reusable notes it
touches: Cities, Accommodation, FnB, Landmarks, Locations, Photo spots.

Most of a trip is **structured frontmatter** rather than headings in the
body. The itinerary, the nights and the transport legs are lists of maps
under `stops:`, `nights:` and `transport:`, and Obsidian's property editor
refuses to render a list of maps. That is what the two code blocks in the
body are for: `travel-itinerary` renders and edits the itinerary, and
`apt-trip-costs` renders the money. A trip created through **New trip** gets
both fences written into its body already.

## Fields

1. Type
   trip
2. Country
   Wikilink to the Country note
3. Cities
   Wikilinks to the Cities this trip touches. Its geographic scope, which is
   separate from whether a city is also a stop worth timing
4. Geo Location (text input)
   The trip's own departure point, kept separate from the Country reference
   because a departure point is a coordinate rather than "somewhere in this
   country"
5. Departure / Return (date and time)
   Written quoted, so Obsidian's YAML parser cannot turn them into dates and
   lose the time
6. Persons
   Wikilinks to the People who came along
7. Travel Type (select single value from list)
    - Business
    - Private - Alone
    - Private - Couple
    - Private - Family
    - Private - Friends
8. Travel Status (select single value from list)
    - Booked
    - Cancelled
    - Over
    - Planned
9. Review Status (select single value)
    - Done
    - In Progress
    - Missing
    - Not needed
10. Rating (1-5)
11. Stops
    The itinerary. One entry per stop: `place`, optional `from` / `to`
    datetimes, `note`, `rating`, and `motif` where the place is a photo spot
12. Nights
    One entry per stay: `accommodation`, `checkIn`, `checkOut`
13. Transport
    One entry per leg: `direction` (`outbound` / `inbound`), `mode`,
    `origin`, `destination`, `from` / `to` datetimes, `reference`
14. Currency / Budget / Rates
    What the trip plans in, its ceiling per category, and the conversion
    rates you typed. The plugin fetches no rate, ever
15. Tags
    - Travel/Trip

### The money on a line

A stop, a night and a leg each take the same four sub-keys, for what the line
is expected to cost before there is anything to book:

- `cost` -- the figure. Leave it out for something nobody has priced; that is
  not the same as zero
- `currency` -- ISO code. Leave it out to inherit the trip's
- `costUnit` -- what the figure is **per**: `total`, `person`, `night` or
  `personNight`. Left out it reads as `total`, so a bare number typed by hand
  never multiplies itself into something bigger than you meant
- `persons` -- wikilinks to who the line is for. Leave it out for everybody
  on the trip, which is the common case and also what keeps a person added to
  the trip later on every line that never disagreed with it

A fare is quoted per passenger and a room is quoted per night, so two people
flying at 900 `person` is 1800, while three nights at 240 `night` is 720
whoever is in the room. A booking carrying the same `reference` (a leg) or
naming the same place (a stop or a night) takes the estimate over, and the
estimate stops counting from that moment.

## What the trip says about itself

Four fields and a block, all offered by the trip editor, all optional.

`subtitle` is what the trip is, under what it is called. `image` is the one
picture that stands for it, shown on its card in the gallery and on the
dashboard: a vault path, a wikilink or a URL, and a picture already in the vault
is referenced rather than moved. `highlights` is a list of lines in the order
they should read, and `gallery` a list of pictures each with an optional
caption.

The overview is **body text**, not a property: a `---` rule under the
frontmatter and a `> [!SUMMARY]+` callout, which is where a paragraph or two
about the trip belongs and the same block NODAtrail's PARA notes carry.

**`image` is written by the plugin now.** It used to be a cosmetic key nothing
touched. A hand-written value survives a save through the trip editor, which
loads it and writes it back; `icon` and `color` are still untouched, because
they still have no field.

## Example Layout

---
type: trip
subtitle: Zugreise in Suedafrika
image: Trips/Shongololo/_resources/hero.jpg
highlights:
  - Nostalgische Zugreise in restaurierten Zuegen
  - Besuch des Fish River Canyons
  - Geisterstadt Kolmanskop
gallery:
  - image: Trips/Shongololo/_resources/sossusvlei.jpg
    caption: Sossusvlei
  - image: Trips/Shongololo/_resources/etosha.jpg
country: "[[South Africa]]"
cities:
  - "[[Pretoria]]"
geoLocation:
  - "47.3769"
  - "8.5417"
departure: "2026-11-01T22:30"
return: "2026-11-14T18:00"
persons:
  - "[[Stefan Muster]]"
  - "[[Erika Muster]]"
travelType: Private - Couple
travelStatus: Planned
reviewStatus: Missing
rating:
currency: CHF
budget:
  - category: transport
    amount: 2000
  - category: accommodation
    amount: 1800
rates:
  - currency: ZAR
    rate: 0.05
stops:
  - place: "[[Union Buildings]]"
    from: "2026-11-03T09:00"
    to: "2026-11-03T11:00"
    cost: 12.5
    costUnit: person
nights:
  - accommodation: "[[Hotel 224]]"
    checkIn: 2026-11-02
    checkOut: 2026-11-05
    cost: 240
    currency: ZAR
    costUnit: night
transport:
  - direction: outbound
    mode: plane
    origin: Zürich
    destination: Pretoria, South Africa
    from: "2026-11-01T22:30"
    to: "2026-11-02T10:00"
    reference: LX288
    cost: 900
    costUnit: person
summary:
icon: earth
color: "#25D0F7"
tags:
  - Travel/Trip
created: "2026-08-01T21:32"
modified: "2026-08-22T08:34"
---

```travel-itinerary
```

```apt-trip-costs
```

# Review
