# Booking

One purchase that belongs to one trip: a flight, a hotel stay, a museum
ticket. The note is the record of what was charged, which is why a price that
changes later is a different booking rather than an edit to this one.

Everything here is a plain property or a list of links, so Obsidian's own
property editor is the editor. There is no block to add.

## Fields

1. Type
   booking
2. Trip
   Wikilink to the trip this belongs to
3. Category (select single value from list)
    - transport
    - accommodation
    - activity
    - food
    - fees
    - other
4. Status (select single value from list)
    - estimate
    - booked
    - paid
    - cancelled
    - refunded
5. Supplier
   Wikilink to a Company note, where there is one
6. Place
   Wikilink to the place or city this is for. Also what puts the cost on the
   right itinerary row
7. Date
   The day the cost belongs to, not the day it was paid
8. Amount
   What it costs. Leave it empty for something nobody has priced yet; that is
   not the same as zero
9. Currency
   ISO code. Leave it empty to inherit the trip's, and then the plugin's
   home currency
10. Reference
    The booking reference. Also what matches this booking to a transport leg
    carrying the same one
11. Payer
    Which participant actually paid
12. For
    Who the cost is for. Leave it empty for everybody on the trip
13. Document
    The confirmation or invoice file in your vault
14. Tags
    - Travel/Booking

## Example Layout

---
type: booking
trip: "[[Jura im Juni]]"
category: transport
status: booked
supplier: "[[SBB]]"
place: "[[Neuchâtel]]"
date: 2026-06-14
amount: 187.40
currency: CHF
reference: XK7F2Q
payer: "[[Stefan Muster]]"
for:
  - "[[Stefan Muster]]"
  - "[[Erika Muster]]"
document: "[[SBB 2026-06-14 XK7F2Q.pdf]]"
tags:
  - Travel/Booking
---

Half-fare, two returns Zurich to Neuchâtel. Seat reservations included.
