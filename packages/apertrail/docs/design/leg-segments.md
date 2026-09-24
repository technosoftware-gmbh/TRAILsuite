# A leg with a change of plane

**Planned and built 24 September 2026.** The first real booking sheet, a
Hurtigruten voyage with flights out and back through Frankfurt, showed that a
leg could not say it changes planes. Thomas split each flight into two legs,
and then had to split the fare between them for both halves to print a
price. One ticket, one fare and one booking code had become two lines with
half a price each.

## Decided

**Segments inside one leg** (Thomas, 24 September 2026), chosen over two legs
with the fare on the first and over a `connection:` flag on the second. The
ticket is the leg: the fare, the class, the booking reference and who flies
are said once, and the leg carries the flights it is made of.

```yaml
transport:
  - direction: outbound
    mode: plane
    carrier: Lufthansa
    reference: K7Q2XF
    cost: 160
    costUnit: person
    segments:
      - number: LH 1199
        origin: Zürich
        destination: Frankfurt
        from: "2027-12-03T07:00"
        to: "2027-12-03T08:00"
      - number: LH 872
        origin: Frankfurt
        destination: Bergen
        from: "2027-12-03T10:10"
        to: "2027-12-03T12:10"
```

## Also decided

Both confirmed by Thomas on 24 September 2026: the ends are stored once, and a
segment may name its own carrier.

**The leg's ends are the segments' ends, and are stored once.** A leg with
segments writes no `origin`, `destination`, `from`, `to`, `day`, `toDay` or
`number` of its own; the reader fills those from the first and last segment.
Every consumer that reads a leg today (the itinerary block, the day-by-day
arrivals and departures, the trip document, the estimates, the health check)
then keeps working unchanged and sees Zürich to Bergen, 07:00 to 12:10. It is
the rule `variants` already follow: a line with variants is priced from them
and its own `cost` is not read, because the same fact in two places drifts.
The editor moves a leg's existing ends into the first segment when the second
is added, the way it moves a figure into the first variant.

**A segment carries:** `number`, `origin`, `destination`, `from`, `to`, and
for a trip written in days, `day` and `toDay`. Optionally its own `carrier`,
for a codeshare (Edelweiss flying LH 873); absent means the leg's. Nothing
else: price, class, reference and persons belong to the ticket.

**One segment is not a list.** A leg with a single segment is written as a
plain leg, so nobody's existing notes change and a direct flight stays four
lines of YAML.

**What each surface shows:**

| Surface | Shows |
|---|---|
| Itinerary block | The leg as today, "Zürich to Bergen", with "via Frankfurt" and "Lufthansa LH 1199 / LH 872" under it |
| Trip document | The same line as the itinerary block: "via Frankfurt" and every flight number after the carrier |
| Booking sheet | One row per segment: date, number, route, times. Class, reference and price once, on the first row, the way a hotel's cells are on its first room |
| Day by day | Unchanged: the leg departs on its first segment's day and arrives on its last |

**Nothing migrates.** The two split flights in the Bergen - Kirkenes trip stay
two legs until they are merged by hand: open the first, add the connection
and type the second flight into it, then remove the second leg and move the
whole fare onto the first. A split leg is a valid leg, only a less accurate
one.

## Settings

`legSegmentsField` (`segments`) and `segmentNumberField`, `segmentCarrierField`,
`segmentOriginField`, `segmentDestinationField`, `segmentFromField`,
`segmentToField`, `segmentDayField`, `segmentToDayField`, defaulting to their
bare names, as sub-keys with no settings-tab row, like every other `*Field`.

## What was built

1. Reader and writer (`trip-note.ts`): the ends derived at read time, a
   single segment written flat, a leftover leg-level number dropped.
2. The leg editor: **Umsteigen / Weiterer Flug** moves what was typed into
   the first flight and starts the second where it lands; removing down to
   one flight turns the leg back into a direct one. The flights are copied
   off the caller's leg so Cancel leaves the itinerary untouched.
3. The booking sheet: a row per flight, the ticket's class, reference and
   price on the first only, in the flight table and the transport table
   alike (a change of trains is the same shape).
4. The itinerary block and the trip document: "via Frankfurt" and the
   flight numbers in the leg's detail line, through `legVia()` and
   `legService()` in `journey-text.ts`. The trip document prints no separate
   segment lines; if a brochure-style sheet wants them, that is a later
   change.
