# The booking sheet

**Planned 24 September 2026. Step 1 built, the sheet itself not yet.** The
fourth trip sheet, beside the trip document and the cost sheet: a page taken
to a travel agency to book a trip that is planned but not yet booked. The four
decisions below and the "Noch offen" section are Thomas's own; the rest is a
proposal.

## What was asked for

> Neben dem Reisedokument und Kostenblatt sollte es noch ein Buchungsblatt
> geben als Vorbereitung zur Buchung einer Reise in einem Reisebüro.

Four sections: **flights, hotels, other transport, the chosen excursions**,
each with its date, times where something departs, the chosen transport and
the cabin or class, and the references.

## How it differs from the two sheets it sits beside

| Sheet | Reads | Answers |
|---|---|---|
| Trip document (Reisedokument) | the plan, all of it, with pictures | What is this trip? |
| Cost sheet (Kostenblatt) | the bookings and the budget | What has it cost, and who owes whom? |
| **Booking sheet (Buchungsblatt)** | **the plan, only what is to be bought** | **What exactly do I ask the agency for?** |

So it is **the itinerary filtered down to things that are sold**, one table per
kind, dated, in the order an agent types them in. No overview, no pictures, no
days without a purchase, no settlement. Untaken optional lines are left out
entirely; open choices are listed as open rather than guessed (see below).

Like the other two it is omitted-when-empty per section, goes through
trail-core's `print/sheet.ts`, carries the shared author and credit line, and
lands in the trip's `_exports/` as `<Trip> Buchungsblatt.html`.

## What each section takes from the note

Every source already exists, except the flight number (decision 1).

### Travellers (header)

The trip's `persons`, one row each, with **empty columns for date of birth and
passport name to fill in by hand** (decision 3). Nothing personal is read from
the vault or written into the HTML; the empty columns are only lines on paper.
A trip with no `persons` prints "Reisende: ____" rather than nothing, because
the agency will ask.

### Flights (Flüge)

`transport` legs with `mode: plane`.

| Column | Source |
|---|---|
| Datum | `from` date, or `day` resolved against `departure` |
| Flug | `carrier` + **`number`** (new, decision 1), e.g. "Swiss LX 288" |
| Von / Nach | `origin` / `destination` |
| Abflug / Ankunft | `from` / `to` time; `toDay` one night later prints `+1`, the rule the itinerary block already has |
| Klasse | the chosen variant's name (decision 2) |
| Reisende | only where the leg's `persons` is not the whole party ("nur Anna"), the trip document's rule |
| Referenz | the leg's `reference` (the booking reference / PNR), with "gebucht" when a booking note matches it |
| Preis | the planned figure with its unit (decision 4) |

### Hotels (Unterkünfte)

`nights` entries, grouped exactly as the trip document already groups them:
same accommodation, same dates, one stay, the rooms beneath it.

| Column | Source |
|---|---|
| Check-in / Check-out / Nächte | `checkIn`/`checkOut` or the `…Day` fields resolved |
| Hotel | the accommodation note's title, with its city, `address` and `website` on a second line: what an agent needs to find the right one of three hotels with the same name |
| Zimmer | per room: the chosen variant's name, its `persons` |
| Referenz | from a booking note matching the accommodation (`bookingsForPlace`), since a night has no reference of its own |
| Preis | planned figure and unit |

### Other transport (Transporte)

Every leg that is not a plane: train, ship, bus, ferry, transfer, rental car.

Same columns as flights, with the mode's icon in the first column, `vehicle`
beside `carrier` ("Hurtigruten, MS Trollfjord"), and **Kabine / Klasse** as the
chosen variant's name **plus the cabin description from the vehicle note's
catalogue**, which is the only place that text lives. A voyage of fifteen days
prints its span ("1.-15. Tag", with both dates) rather than a single date.

A cruise is therefore a transport line and not a hotel, which is how the note
already models it and how the operator sells it.

### Chosen excursions (Ausflüge)

`stops` that name an `excursion:` and are either not optional, or optional and
`chosen: true`.

| Column | Source |
|---|---|
| Datum / Zeit | `from`/`to`, or `day` resolved |
| Ausflug | the excursion note's title; its duration and operator from the note where set |
| Ort | the stop's `place` |
| Variante | the chosen variant's name |
| Teilnehmer | only where not everybody |
| Referenz | a booking note matching the place, as for hotels |
| Preis | planned figure and unit |

Stops that are **not excursions** (a museum, a restaurant) are not on the sheet:
they are bought at the door, not at an agency. If that turns out to be wrong
for a real trip, the rule to add is "a stop with a cost", not "every stop".

## The four decisions

1. **Flight and train numbers get their own sub-key, `number`**
   (`legNumberField`), edited in the leg editor beside the carrier. `reference`
   stays what it is today: the booking reference a booking note is matched on.
   Today both would have to share `reference`, and the match with the booking
   note breaks the moment the PNR is typed over the flight number.
   **This changes what gets written into a vault**: a new, optional sub-key,
   written only when filled, so no existing note changes. A leg that carries a
   flight number in `reference` today (the data-model example `LX288` does) is
   not migrated; the health check could say so, see below.
2. **The class or cabin is the chosen variant's name**, not a new field. A
   flight with one class gets one variant, which is also where its fare
   belongs. Ships and named trains add the catalogue description.
3. **Travellers: names from `persons`, plus empty columns** for date of birth
   and passport name, filled in by hand. Nothing personal in the vault or the
   file.
4. **Prices: per line, with the unit, and a total per currency** at the foot,
   so the sheet can be laid beside the agency's offer. Only the trip's own
   currency is totalled; lines in another currency are listed and named in a
   note under the total, the rule every other sheet follows.

## Open items instead of guesses

A sheet taken to an agency must not quietly pick for its owner. So a section
at the end, **Noch offen**, printed only when there is something in it:

- a line with variants and none `chosen` ("Kabine noch nicht gewählt: Polar
  Aussenkabine / Arktis Aussenkabine Superior"). The line itself is printed
  with "offen" in its class column, never with the first variant;
- an optional excursion or leg not yet decided (not chosen, not rejected), so
  the agent can ask about availability;
- a date that cannot be resolved (relative `day` and no `departure`), printed
  as "Tag 3" in the table and listed here;
- a flight or leg with no departure time.

This is the one place the booking sheet reads differently from the totals: the
cost arithmetic counts the first variant so a budget is not too small, and this
sheet refuses to, because here a guess becomes a purchase.

## Where it is reached

- A third button, **Buchungsblatt**, beside Reisedokument in the itinerary
  block. The trip document's own history says why: *a command with no button
  is a feature somebody has to be told about.*
- A command, "Buchungsblatt exportieren", like the other two.

## Code layout

The arrangement the other sheets have:

| File | What |
|---|---|
| `trips/booking-sheet-lines.ts` | Pure. Trip + bookings + settings in, four lists of rows and the open items out. The selection rules above live here and nowhere else |
| `trips/export-booking-sheet.ts` | Pure builder: rows (already localized and formatted) in, markup out |
| `trips/ui/export-booking-sheet.ts` | App-bound: reads the trip, bookings, accommodation, excursion and vehicle notes, formats, writes to `exportFolder()` |
| `lang/translations/{en,de}.ts` | `bookingSheet.*`: title, section names, column heads, open-item sentences, footer |

It reuses what the trip document already has rather than growing a second
copy: stay grouping, `persons` "only X" labels, day resolution, leg icons, the
`+1` arrival rule, and `bookingsForReference` / `bookingsForPlace`.

## Tests

- `booking-sheet-lines.test.ts`: the selection rules on a real trip's
  frontmatter (the Nordkap voyage: a fifteen-day ship leg with cabin variants,
  several optional excursions of which some chosen, two flights):
  untaken optional lines absent; chosen ones present; an unchosen variant goes
  to "Noch offen" and not into the class column; rooms grouped; a non-excursion
  stop absent.
- The shared stylesheet checks the other three sheets already run (balanced
  braces, no stray declarations, heading kept with its first block).
- `settings-coverage`, `settings-reference` and `translation-keys` cover the
  new `legNumberField` and the `bookingSheet.*` keys; the leg editor's new
  label is caught by the unused-label check over `modals.tripEditor` if the
  input is forgotten, which is exactly how `carrier` once shipped.
- The page is checked the way the trip document was: render the Nordkap trip,
  print to PDF from Chrome, read it.

## Order of work

1. **Built.** `number` on a leg: `legNumberField`, reader, writer, leg
   editor, both locales, data model, settings reference and the trip template.
   Shown in the itinerary block and the trip document too, joined to the
   carrier as "Swiss LX288" (`legService()` in `journey-text.ts`), so it is not
   a field only one sheet can see. A bare `812` in YAML is a number, and is
   read back as the text it was typed as.
2. `booking-sheet-lines.ts` with its tests.
3. The builder, the App-bound half, the button and the command.
4. Render the Nordkap trip, print, correct.
5. Optional, and only if wanted: a health check that flags a plane leg whose
   `reference` looks like a flight number (two letters and digits) and has no
   `number`. Reports only; never rewrites.

## Not in this plan

- **Sending it anywhere.** It is a file, like the other sheets.
- **Writing back what the agency booked.** That is what booking notes are for,
  and "Neue Buchung" from the costs block already creates one with the leg's
  reference.
- **Board (Halbpension, Frühstück)** on a stay. Not modelled today; it can be
  a variant's name ("Doppelzimmer, Halbpension") until a real trip shows it
  needs to be separate.
- **Seat reservations and baggage.** Free text in the leg's note if needed.
