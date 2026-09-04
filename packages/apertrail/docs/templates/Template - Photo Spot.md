# Photo Spot

A place you go to in order to make a specific picture. Kept separate from
Landmark and Location because the question a photo spot answers is not
"what is here" but "where do I stand, when is the light right, and do I
still owe myself this shot". A spot carries one main motif and any number
of secondary ones, each with its own coordinates, shooting direction and
preferred light, so a single note can cover a castle in town and a jetty
16 kilometres down the lake.

Photo Spot is one of the five place types, so it shares the Country/City
hierarchy, `geoLocation`, `visited`/`lastVisit`, `rating`, `address` and
`website` with Accommodation, FnB, Landmark and Location. Everything below
those is specific to this type.

## Fields

1. Type
   photospot
2. Image
   Cover image of the spot
3. Country
   The country the spot is in
4. City
   Reference to the City this spot is in, if it's inside a tracked City --
   falls back to just Country when it isn't
5. Geo Location (text input)
   Copy the geolocation from the map view and paste it here. This is the
   spot's anchor; an individual motif may carry its own coordinates
6. Timezone (text input)
   IANA zone name, e.g. `Europe/Zurich`. Only needed for spots outside
   your own timezone; sun times fall back to the device's zone
7. Visited (true/false)
   Marks the spot as visited. Being there is not the same as getting the
   shot -- that is each motif's own `captured` field
8. Last Visit (select date value from date picker)
9. Rating (1-5)
10. Opening Hours (text input)
    Free text. `24h` renders as the round-the-clock badge
11. Entry Fee (text input)
    Free text. Empty or `none` renders as "no entry fee"
12. Accessibility (select single value from list)
    - full
    - partial
    - none
    - unknown
13. Parking (text input)
    One line, as you would write it on a map note
14. Transit (list)
    One entry per mode, each with:
    - mode: rail | bus | tram | boat | cablecar | foot | car
    - detail: free text, including "no direct connection"
15. Motifs (list)
    One entry per motif, each with:
    - name: required, and what a sample's `motif` refers back to
    - role: main | secondary (zero or one `main` per note)
    - geoLocation: optional, defaults to the spot's own coordinates
    - direction: the bearing you shoot *toward*, 0-359 or a compass point
    - light: ordered best-first, from the fixed vocabulary below
    - season: months, 1-12, optional
    - lens: free text, e.g. `70-200`
    - gear: list, e.g. tripod, nd1000, polarizer
    - technique: the how-to tip for this motif specifically
    - note: where to stand and how to get there
    - captured: true once you have the shot
    - capturedOn: date, optional
16. Samples (list)
    One entry per example photo, each with:
    - image, motif, light, exposure, credit
17. Tags
    - Travel/PhotoSpot

### Light windows

In day order. These values are fixed, not configurable, because the sun
calculation and the itinerary's warnings key off the exact strings:

`blue-hour-morning`, `sunrise`, `golden-hour-morning`, `day`, `overcast`,
`golden-hour-evening`, `sunset`, `blue-hour-evening`, `night`

## Example Layout

---
type: photospot
image: neuchatel-chateau.jpg
country: "[[Switzerland]]"
city: "[[Neuchâtel]]"
geoLocation:
  - "46.9899"
  - "6.9293"
address: 2000 Neuchâtel, Switzerland
website: https://www.neuchateltourisme.ch/
icon: camera
color: "#E0715A"
rating: 5
visited: true
lastVisit: 2025-06-14
timezone: Europe/Zurich
openingHours: 24h
entryFee: none
accessibility: partial
parking: Parking du Seyon, 2000 Neuchâtel
transit:
  - mode: rail
    detail: Neuchâtel station, then about 10 minutes downhill on foot
  - mode: bus
    detail: Line 380 to Neuchâtel Écluse, then about 5 minutes on foot
motifs:
  - name: Château de Neuchâtel
    role: main
    geoLocation:
      - "46.9895"
      - "6.9243"
    direction: 215
    light:
      - golden-hour-evening
      - blue-hour-evening
    lens: 70-200
    gear:
      - tripod
    captured: true
    capturedOn: 2025-06-14
    note: >-
      The clear line of sight onto the castle is from the sports centre on
      Chemin de la Boine. A telephoto lens is what makes the framing work.
  - name: Pavillon des Bains, Chez-le-Bart
    role: secondary
    geoLocation:
      - "46.9161"
      - "6.8419"
    direction: 65
    light:
      - blue-hour-morning
      - sunrise
    lens: 16-35
    gear:
      - tripod
      - nd1000
    season:
      - 5
      - 6
      - 7
      - 8
    captured: false
    technique: >-
      Rendering the lake surface completely still needs the longest shutter
      speed you can get. Depending on aperture and available light, a strong
      ND filter (64x or 1000x) is what buys it.
    note: >-
      At the end of a short jetty on the west shore of Lake Neuchâtel, about
      16 kilometres south-west of town. Park on Rue du Port, right by the
      jetty. In the morning you are shooting into the rising sun.
samples:
  - image: neuchatel-pavillon-blue.jpg
    motif: Pavillon des Bains, Chez-le-Bart
    light: blue-hour-morning
    exposure: 30s, f/11, ISO 100, ND1000
  - image: neuchatel-pavillon-sunrise.jpg
    motif: Pavillon des Bains, Chez-le-Bart
    light: sunrise
    exposure: 15s, f/11, ISO 100, ND1000
summary:
tags:
  - Travel/PhotoSpot
created: "2026-08-07T10:00"
modified: "2026-08-07T10:00"
---

# Neuchâtel Waterfront

Neuchâtel has around 46,000 inhabitants and sits about 50 kilometres west of Bern on the lake of
the same name. The castle above the old town is first recorded as "Novum Castellum" in the early
twelfth century.

> [!info] Did you know?
> Although the canton of Neuchâtel lies in French-speaking western Switzerland, its flag looks
> very much like the Italian tricolour.

```apt-photo-spot
```

# Review

# Related Trips

```travel-related-trips
```
