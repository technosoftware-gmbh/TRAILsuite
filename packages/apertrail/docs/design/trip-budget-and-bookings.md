# Trip budget and bookings: design & implementation plan

> **Status: built, phases 0 to 7.** It reopens a decision the Trip redesign
> made deliberately (`trip-model-redesign.md` §9, "Costs per trip or per
> stop"), so §1 answers that decision's objections one at a time; those
> answers are what the code now has to keep true.
>
> **What came out differently.** The settlement absorbs a rounding residual
> onto the largest balance, but only when the residual is small enough to BE
> rounding: balances that genuinely do not sum to zero (a booking nobody
> paid) are a fact about the trip and are left alone. §5.4 did not anticipate
> the distinction, and a test caught it. The cost sheet's export shares
> `shared/print-sheet.ts` with the photo spot field sheet, which is the
> extraction §7.6 predicted.
>
> **What was added after the design.** Item-level estimates: a transport leg
> and a night carry a cost of their own, for the pass where a trip is priced
> before anything can be booked, and a leg carries where it departs from and
> arrives at. The design assumed every figure entered as a booking note,
> which would have meant writing notes for things that do not exist yet and
> then editing them into something else. An estimate is fed through the same
> totals as a synthetic booking with status `estimate` and no payer, so there
> is no second code path and the settlement ignores it; it stops counting the
> moment a booking carries the same reference, or names the same
> accommodation. See `costs/estimates.ts`, and travel.md for the one hole
> that leaves.

> **What it is for.** Planning what a trip will cost, recording what it
> actually cost, keeping the confirmations reachable from the trip, and
> settling up between the people who went. Manual entry throughout; §14 says
> what a future price lookup would have to respect.

## 0. What was asked for

A trip has money in it before it has memories. Flights and trains, hotels,
museum entries, a rental car, the guide who took you up the ridge. Some of
it is guessed months ahead, some is booked and paid, and the confirmation
for each arrives as a PDF that ends up somewhere that is not the trip note.

Four things, in the order they were asked for:

1. **A budget**, per trip: what this is expected to cost, broken down enough
   to be useful and not so far that filling it in becomes the hobby.
2. **What was actually spent**, per booked thing, against that budget.
3. **The invoice or confirmation reachable from the trip**, rather than
   findable only by remembering the airline's name.
4. **A split**, because a trip has participants and one of them usually paid
   for the hotel.

## 1. Reopening §9

The Trip redesign refused costs, in one paragraph worth quoting in full:

> **Costs per trip or per stop.** Money is its own domain: currencies,
> exchange rates, who owes whom, what counts as a trip expense. A single
> `cost:` field would invite people to trust totals the plugin cannot
> actually compute, which is worse than not offering it.

Every clause of that is still true. What has changed is that the design
below is not a `cost:` field, and the objections have answers that did not
exist when it was written.

**"Currencies."** Answered by never summing across them. A total is per
currency, always, and a single figure appears only when the trip itself
carries a rate somebody typed, labelled as converted at that rate (§5.2).
The plugin never invents an exchange rate and never fetches one.

**"Exchange rates."** Same answer, and the reason it is safe is that the
rate is data in the note rather than a value in the plugin: it can be wrong,
but it cannot be wrong *silently*, because the sheet says which rate it
used.

**"Who owes whom."** Answered by computing it and writing none of it (§5.4).
The settlement is derived at read time from `payer` and `for` on each
booking, exactly the way `visited` is derived from the trips that stop
somewhere. Nothing is stored, so nothing goes stale, and a booking with no
payer is left out of the settlement rather than guessed at.

**"What counts as a trip expense."** Answered by making it the user's
answer, not the plugin's: a cost counts when there is a booking note that
names the trip. There is no rule about what qualifies, because there is no
rule that would survive one real trip.

**"Totals the plugin cannot actually compute."** This is the objection that
matters, and the defence is the same one `trail-core`'s order totals already
use: a total is null unless the lines can support one, and a computed figure
is shown *beside* a stated one rather than instead of it, so the interesting
case (they disagree) is visible rather than hidden. `computedOrderTotal()`
returns null rather than a confident zero for an order whose lines carry no
prices, and it does that because 59 real notes would otherwise have read as
"the plugin lost the money". The same rule applies here.

One more thing has changed since §9 was written: **the shape now exists**.
`trail-core/document/invoice.ts` is a format-agnostic invoice model whose own
header says "APERtrail is expected to grow more, which is what earned this
file its move here", and `trail-core/obsidian/render-invoice.ts` draws it.
A trip's costs are the second consumer that file was written for.

## 2. What this stands on

Nothing below needs a new dependency, and most of it needs no new
primitives either.

| Already there | What it gives this feature |
|---|---|
| The Trip model: `stops`, `nights`, `transport`, `persons` | The things being paid for, and the people to split between |
| `crm/read-crm.ts`, Company notes | A booking's supplier is a Company the vault already has, not a string |
| `trail-core` `document/invoice.ts` + `obsidian/render-invoice.ts` | The cost sheet renders through the same code CULItrail's orders do |
| `trail-core` `order/total.ts` | The precedent for money arithmetic: cents, nullable totals, computed beside stated |
| The photo spot field sheet (`places/export-photo-spot.ts`) | The precedent for a printable export, and the print stylesheet to share |
| `readNotesOfType()`, folder-and-type identification, the health check | A new entity type costs one array entry and one folder mapping |
| `shared/units.ts`, `shared/clock.ts`, the locale registry | The reader's own conventions, already resolved |

## 3. Architectural placement

**A booking is the tenth entity type, `booking`, and it is not a place.**

It has no coordinates, it is not a stop target, and it inherits nothing from
`TravelPlace`. It joins `TRAVEL_ENTITY_TYPES` and gets a folder of its own;
it stays out of `TRAVEL_PLACE_TYPES`, out of the gallery's place facets and
out of visit derivation.

**It lives in the Trips module**, not in a fourth one. The vault layout and
`src/` are both three modules, and a booking is a fact about a trip: it is
read when a trip is read, it is created from a trip, and it has no meaning
without one. So the folder default is `Trips/Bookings` (derived from
`tripsFolder`, the way the place sub-folders derive from `placesFolder`) and
the code lives under `src/trips/costs/`.

Nesting the folder under the Trips folder is safe on the existing rules: the
health check scores a file against every configured folder it falls under
and keeps the longest match, and `readNotesOfType()` matches folder **and**
type, so a booking under `Trips/Bookings` is never read as a trip.

**Why a note per booking rather than lines on the trip.** Three reasons, in
order of weight. A booking has a document behind it, and a note is the thing
a vault can attach a PDF to. A booking has a counterparty, and a note is the
thing that can link to a Company. And a booking is what gets edited months
after the trip is planned, when a refund lands or the price changes, which
is an edit to one small thing rather than to the trip's whole frontmatter.

The cost of that choice is real and worth stating: a five-stop weekend with
seven bookings is seven notes. §7.2's block is what keeps them from feeling
like seven notes.

## 4. The data model

### 4.1 A booking note

```yaml
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
```

Everything on it is a flat scalar except `for:`, which is a list of
wikilinks. That is deliberate and it is what makes a booking cheap: Obsidian's
own property editor renders every one of those, so **a booking needs no
editing block of its own**. The photo spot block exists because motifs are a
list of maps and the property editor refuses those; nothing here is a list of
maps.

### 4.2 Field reference

Property names are settings, shown at their English defaults. Values marked
*fixed* are a vocabulary rather than a setting, for the reason
`TRAVEL_STATUS_VALUES` is one: totals, filters and warnings all key off the
exact strings.

| Property | Type | Notes |
|---|---|---|
| `type` | `booking` | Fixed value, lowercase, one word |
| `trip` | wikilink | Which trip this belongs to. A booking whose trip does not resolve is kept and shown as unattached rather than dropped |
| `category` | *fixed* | `transport` / `accommodation` / `activity` / `food` / `fees` / `other`. §4.4 |
| `status` | *fixed* | `estimate` / `booked` / `paid` / `cancelled` / `refunded`. §4.4 |
| `supplier` | wikilink | A Company note. Optional: a museum ticket bought at the door has no counterparty worth a note |
| `place` | wikilink | Optional. The City or place this is for, which is how a cost reaches the itinerary row it belongs to (§7.3) |
| `date` | date | The day the cost belongs to: the flight's departure, the first night, the day of the entry ticket. Not the day it was paid |
| `amount` | number | What it costs. Two decimals or fewer; see §5.1 on what happens to more |
| `currency` | text | ISO code, upper case. Falls back to the trip's, then to the `homeCurrency` setting |
| `reference` | text | The booking reference. Also the link to a transport leg (§7.3) |
| `payer` | wikilink | Which participant actually paid. Optional; a booking without one is counted in the totals and left out of the settlement |
| `for` | list of wikilinks | Who the cost is for. Absent means every participant of the trip, which is the common case and should not have to be typed |
| `document` | wikilink or path | The confirmation or invoice file. §8 |

`created` and `modified` behave as everywhere else: written once, and by
every edit, respectively.

### 4.3 What the trip itself gains

Two new properties on a Trip note, both lists of maps, both edited from the
costs block rather than the property editor:

```yaml
budget:
  - category: transport
    amount: 400
  - category: accommodation
    amount: 600
  - category: activity
    amount: 200
rates:
  - currency: EUR
    rate: 0.94
```

`budget:` is the **plan**: a ceiling per category, in the trip's own
currency. It is deliberately not a per-booking estimate, because those two
answer different questions and only one of them is a plan. A category with
no budget line is not over budget; it is unbudgeted, and the sheet says so.

`rates:` is what §5.2 converts with: how many units of the trip's currency
one unit of the foreign currency costs, as **the user typed it**.

A third value, the trip's own currency, is a property (`tripCurrency`)
falling back to the `homeCurrency` setting, so a trip planned entirely in
euros states that once instead of on every booking.

### 4.4 Fixed vocabularies

**Categories:** `transport`, `accommodation`, `activity`, `food`, `fees`,
`other`.

Six, and the argument for each is that a real trip's spending falls into
them without deliberation. `fees` is visas, insurance, baggage, the tourist
tax a hotel adds at the desk: money the trip costs that nobody enjoys.
`other` exists so that nothing has to be miscategorised, and a sheet where
`other` is the biggest category is telling you the vocabulary is wrong,
which is information.

Deliberately **not** a setting. A budget line, a facet and a total all key
off these strings, and a vault that renames one has silently unbudgeted a
category. A vault that wants finer grain uses the note's title and body,
which is where prose belongs.

**Units:** `total`, `person`, `night`, `personNight`. What the `cost` on an
itinerary line is per, added with §16 and living in
`trips/costs/line-cost.ts` rather than here, since a booking states a total
and needs none of it. Absent reads as `total`.

**Statuses:** `estimate`, `booked`, `paid`, `cancelled`, `refunded`.

`estimate` is the state a booking starts in while a trip is still being
planned: a figure somebody looked up, attached to nothing. `booked` means it
is committed and the money is owed. `paid` means it has left the account.
`cancelled` is out of every total. `refunded` counts as zero but stays
visible, because a refunded booking is evidence, and deleting the note would
lose the reference it came back under.

The three totals in §5.3 are exactly this vocabulary read three ways, which
is why it is fixed.

### 4.5 What a booking deliberately does not carry

- **No VAT and no billable flag.** This design is for what a trip costs you,
  not for what a client is charged. The invoice model already supports both
  (`InvoiceTotal` has an `adjustment` kind and CULItrail's orders carve out
  included VAT), so business re-billing is an addition rather than a
  redesign. It is out of scope here (§14).
- **No payment method or account.** A vault is not an accounting system, and
  "which card" answers a question nobody asked twice.
- **No quantity or unit price.** A booking is one purchase. Two nights at
  120 is a booking of 240, and the body is where the arithmetic goes if it
  matters.
- **No per-person amounts.** The split is derived (§5.4). A booking that
  charged two people different amounts is two bookings, which is what the
  supplier's own invoice usually says anyway.

## 5. Money arithmetic

All of it pure, in `src/trips/costs/totals.ts` and `split.ts`, with no
Obsidian import, tested against hand-built records the way `trip-light.ts`
is.

### 5.1 Cents, not floats

Adding 89.40 and 187.40 in binary floating point lands a fraction of a cent
off, and a total is money rather than a measurement. Every sum rounds to
cents on the way out, the way `trail-core`'s `toCents()` does inside
`order/total.ts`.

That helper is private there. Rather than copy it a third time, this design
adds `roundCents()` to `src/shared/money.ts` and leaves a comment naming the
core's copy; if a third consumer appears, it lifts to `trail-core` and both
call it. Two copies with a note beats a premature contract, which is the
same judgement `readTagList` got before it became `readStringList`.

An `amount` with more than two decimals is read as written and rounded only
in totals, never rewritten in the note: what somebody typed is what the note
keeps.

### 5.2 Currencies

**Totals are per currency, always.** A trip with bookings in CHF and EUR has
two totals and they are never added. This is the rule the redesign's
objection deserves, and it holds even when it is inconvenient.

**A converted total appears only when the trip carries a rate for that
currency**, and it is labelled with the rate it used: *EUR 220 at 0.94 =
CHF 206.80*. The plugin does not fetch rates, does not cache rates, and has
no opinion about what today's rate is. A missing rate is not an error: the
foreign total simply stays foreign, and the sheet shows both.

A booking with no currency inherits the trip's, and a trip with none
inherits the `homeCurrency` setting. That chain exists so the common case
(everything in one currency) requires typing a currency exactly zero times.

### 5.3 Plan, committed, paid

Three totals per category, and the whole point of the feature is the gap
between them:

| Total | Made of | Answers |
|---|---|---|
| **Planned** | The trip's `budget:` lines | What I said this would cost |
| **Committed** | Bookings with status `estimate`, `booked` or `paid` | What it is going to cost on current evidence |
| **Paid** | Bookings with status `paid` | What has actually left the account |

`cancelled` counts in none of them. `refunded` counts as zero in all three
and stays on the sheet.

The variance shown is planned minus committed, per category and overall,
because that is the number that changes a decision while a trip is still
being planned. A category with no budget line shows its committed figure
with no variance rather than a variance against zero: "unbudgeted" and
"over budget by everything" are different statements and only one of them is
true.

**Committed deliberately includes estimates.** A budget that only counts
what is already booked reads as comfortable right up to the moment it is
not.

### 5.4 The split, and who owes whom

Derived, never written. The input is each booking's `payer` and `for`, and
the trip's participants for the `for`-is-absent case.

For each participant: what they paid (sum of bookings they are the payer
of), what they consumed (their share of every booking they are named in),
and the difference. A booking with no payer counts toward consumption and
toward nobody's paid column, so it lowers everybody's balance evenly rather
than pretending it was free.

Shares are equal within a booking. Unequal shares were considered and left
out: they need a second list of maps on a note that currently has none, and
the cases they solve ("she had the single room") are usually two bookings.

From those balances the sheet offers **a settlement**: the smallest set of
transfers that clears them, greedily matched largest debtor to largest
creditor. It is a suggestion, it is recomputed every render, and it is never
written into a note. Rounding is absorbed by the last transfer rather than
spread, so the transfers sum exactly to the balances.

The settlement is shown **only when more than one person paid something**.
A trip where one person paid for everything does not need a settlement
table; it needs one sentence saying what each other person owes them.

## 6. Settings

New folder setting, following the existing convention:

| Setting | Default (EN) | Default (DE) |
|---|---|---|
| `bookingsFolder` | `Trips/Bookings` | `Reisen/Buchungen` |

New behaviour settings:

| Setting | Default | What it does |
|---|---|---|
| `homeCurrency` | `CHF` | The currency a trip is assumed to be planned in when it says nothing. The one figure in this feature that starts as a guess, and one row changes it |
| `budgetEnabled` | `true` | Master switch for the costs block, the dashboard tile and the itinerary chips. Off leaves bookings as ordinary notes, the same bargain `sunTimesEnabled` makes for photo spots |
| `currencyOptions` | `CHF, EUR, USD` | The codes every money dropdown offers, in order. Added with §16. The home currency and whatever a note already holds are always offered on top of it, so a cleared list still leaves every field usable |

New property-name settings, each defaulting to its own bare name:
`bookingTripProperty`, `bookingCategoryProperty`, `bookingStatusProperty`,
`bookingSupplierProperty`, `bookingPlaceProperty`, `bookingDateProperty`,
`bookingAmountProperty`, `bookingCurrencyProperty`,
`bookingReferenceProperty`, `bookingPayerProperty`, `bookingForProperty`,
`bookingDocumentProperty`, plus `tripCurrencyProperty`, `budgetProperty` and
`ratesProperty` on the Trip.

Sub-key settings with no row on the settings tab, like their trip-structure
siblings: `budgetCategoryField`, `budgetAmountField`, `rateCurrencyField`,
`rateValueField`.

The twelve booking properties **do** get rows, in a new Bookings group on
the Property keys page. They are top-level names on a note type, which is
the line that page already draws.

## 7. Surfaces

### 7.1 The booking note

Nothing. No block, no view, no editor.

This is the one part of the design worth being pleased about: because every
field is a flat scalar or a list of links, Obsidian's own property editor is
already a better editor than anything this plugin would write. A booking
note is a title, a dozen properties and a paragraph.

What it does get is the existing `travel-related-trips` block if you want
it, which answers "what else touched this" for free.

### 7.2 `apt-trip-costs`, in the trip note

The one new surface, and the one that keeps seven booking notes from feeling
like seven notes. An empty fence in a Trip note, working out its trip from
`ctx.sourcePath` like the two blocks already there:

````
```apt-trip-costs
```
````

It renders, in order:

1. **A summary strip**: planned, committed, paid, and the variance, per
   currency, with the converted line where a rate exists.
2. **The document itself**, through `trail-core`'s `renderInvoice()` with an
   APERtrail adapter in `src/trips/costs/invoice-model.ts`. One line per
   booking: label (title, or supplier and category when untitled), the date,
   the status, and the amount. Grouped by category, with a subtotal row per
   category (`InvoiceTotal` kind `subtotal`), the trip total (`total`), and
   the budget as the `stated` row it was designed for. The renderer already
   shows a stated figure beside a computed one precisely so the disagreement
   is visible.
3. **The settlement** (§5.4), as the invoice model's `footer` groups: one
   group per person, entries for paid and owed, then the transfers.
4. **Actions**: add a booking, edit the budget lines, add a rate, export the
   sheet.

Adding a booking from here opens the same creation modal the command does,
with `trip` prefilled and `for` left empty, and writes a note. Editing a
budget line or a rate writes the trip, through one save path, the way
`updateTripNote()` already does.

Every line links to its booking note by title, the way the invoice
renderer's `linkTarget` expects, so following a figure to its evidence is
one click.

### 7.3 The itinerary

Four additions. The first two are read-only and were the whole of this
section as designed; the last two arrived with §16 and mean the itinerary is
now a place money is entered and a booking is created, not only shown.

- A **cost chip** on a stop, night or leg that has a booking, showing the
  amount. What connects them: a stop or night matches a booking whose
  `place` is the same note, and a transport leg matches a booking whose
  `reference` equals the leg's own `reference`. That second rule costs
  nothing, because `legReferenceField` already exists and a booking
  reference is exactly what people type into it.
- A **document icon** beside it when the booking carries one, opening the
  file (§8).
- A **dashed estimate chip** where the line carries a figure of its own and
  no booking has taken it over, with the multiplication behind it on the
  chip, plus a **travellers chip** where the line names a subset of the
  trip.
- A **"Book this" row action**, which writes a booking note prefilled from
  the line: the trip, the category, the computed amount, the currency, the
  people, and the line's own reference or place. Those last two are what
  make the new booking supersede the estimate rather than sit beside it.

Nothing on the itinerary is editable here, and nothing is computed into the
trip's frontmatter. A stop with two bookings shows their sum, with both
reachable from the costs block.

### 7.4 Dashboard

One new tile in the Trips stats row: **the next trip's budget**, as
committed against planned, in the trip's currency. It sits next to the
next-trip countdown it is about, and it is the reason to open the dashboard
while a trip is still ahead.

Trip cards gain one meta item: committed total, or nothing at all for a trip
with no bookings. Not planned-versus-committed on a card, which is a
sentence rather than a chip.

No new dashboard section: bookings are evidence, not something to browse.

### 7.5 Gallery

Deliberately nothing. The gallery is image-first and answers "where have I
been"; a booking has no image and is not a place. A tenth type chip that
returned a grid of grey cards would make the gallery worse.

### 7.6 The cost sheet, exported

The same shape the photo spot field sheet already has: a button in the block
writes a self-contained HTML file beside the trip note, print-ready,
carrying the summary, the table, the settlement and the list of documents by
name. It is what gets sent to the other four people who went.

The two exports share the print stylesheet and the escaping helper, which
means one of them moves: `places/export-photo-spot.ts`'s `esc()` and its
`@page` block become `src/shared/print-sheet.ts`, and both builders import
them. That refactor is small and is the price of not having two print
stylesheets drift.

## 8. Documents

`document:` holds a wikilink or a vault path to the real file: the airline's
PDF, a photo of a paper ticket, the hotel's confirmation email saved out.
The plugin resolves it exactly the way `ui/components/image-resolve.ts`
resolves an image (Obsidian's link resolution first, then a direct path), and
opening it hands it to Obsidian, which shows PDFs and images natively and
delegates the rest to the operating system.

**Nothing generates or modifies that file.** The cost sheet in §7.6 is the
plugin's own document; the confirmation is the supplier's, and a plugin that
rewrote it would be destroying evidence.

A booking whose `document:` does not resolve keeps the value and shows it as
unresolved, the way an unresolved stop link is shown. A moved PDF is a thing
to fix, not a thing to silently forget.

## 9. Creation, commands, health check

`createBookingNote()` joins the existing creators over `trail-core`'s
`createNote()`, writing minimal frontmatter: type, created, trip, category,
status, and whatever the modal collected. A new `NewBookingModal` collects
title, trip (prefilled when opened from a trip), category, amount and
currency, and nothing else: everything further is a property row away.

One new command, "New booking", and one context-sensitive one, "Export this
trip's cost sheet", offered only inside a Trip note.

The health check widens from eleven folders to twelve, and gains four
booking warnings, all warnings rather than errors because a half-filled
booking is a normal state:

- a booking whose `trip:` resolves to nothing,
- a booking with an `amount` but no currency anywhere in the chain,
- a `for:` naming somebody who is not a participant of that trip,
- two bookings sharing a `reference` (usually a duplicate, occasionally a
  split payment, so a warning and never a fix).

## 10. Internationalization and money on screen

Every new string goes in both tables, as always. New key groups: `booking.*`
for the note and modal, `booking.category.*`, `booking.status.*`,
`costs.*` for the block, and `settings.bookings.*`.

**Money formatting is not CULItrail's.** Its `formatPrice()` writes
`CHF 17.50` from a single configured currency, which is right for a plugin
where every price is in one currency and gross. This feature is
multi-currency by construction, so `src/shared/money.ts` formats through
`Intl.NumberFormat` with the reader's locale and the figure's own currency
code, falling back to `CODE 12.34` when the runtime does not know the code.
That way a German vault reads `187,40 CHF` and an English one `CHF 187.40`
without either being told to.

Two decimals always, for `formatPrice()`'s reason: `17.5` is a quantity,
`17.50` is money.

**The vocabularies stay English in the note.** `category: transport` and
`status: booked`, translated only on the way to the screen, exactly like the
light windows. Currency codes are ISO and are not translated at all.

## 11. Options considered

**A. Costs as sub-keys on stops, nights and legs.** No new type, no new
folder: a stop gains `cost` and `currency`. *Rejected:* there is nowhere to
put the document, nowhere to put the supplier, and nothing to point at from
a second trip. It also cannot express a cost that belongs to no itinerary
item, which is most of what a trip costs: insurance, the visa, the rental
car for the week.

**B. A `costs:` list on the Trip note.** One line per expense, inside the
trip. *Rejected:* it is the shape that scales worst, because it grows the
one note everything else already edits, and every edit rewrites the whole
trip. It also has the same nowhere-to-put-the-document problem. It is,
however, the cheapest thing that could work, and if the booking-note weight
turns out to be too much in practice, this is what to fall back to.

**C. A booking as a place type.** So it could be an itinerary stop.
*Rejected:* a booking is not somewhere you go. Making it a place would give
it coordinates, visit derivation and a gallery card, all of which are
meaningless for it, and would put twelve money fields on the shared place
shape that four of six kinds never use.

**D. A tenth entity type, in the Trips module.** **Recommended and designed
above.** One `as const` entry, one folder mapping, one creator, and it
inherits reading, health-checking and creation from machinery that already
exists.

## 12. Risks, and where this can mislead

- **A total is more persuasive than its inputs.** Every figure the sheet
  shows names what it is made of, and the budget row sits beside the
  computed one rather than replacing it. The one rule that must not be
  relaxed: a total over lines that carry no amounts is null, never zero.
- **A converted total is somebody's own rate.** It is always labelled with
  the rate, and never shown without the unconverted figures beside it.
- **The settlement is arithmetic, not an agreement.** It says who owes whom
  under an equal split of every booking; it does not know that one of you
  paid for dinner in cash. That is what the trip's own body text is for, and
  the sheet says as much in one line under the transfers.
- **Status drift.** `booked` that was never moved to `paid` overstates what
  is still owed. Cheap mitigation: the sheet shows the count of bookings in
  each status, so a trip with eleven `booked` and none `paid` looks like
  what it is.
- **Seven notes per trip.** The real risk to adoption. Phase 2's block is
  what makes them bearable, and phase 0 to 1 should be used against one real
  past trip before phase 3 is built.

## 13. Build order

Each phase leaves the plugin working and is independently useful.

| Phase | Contents | Why here |
|---|---|---|
| **0** | `booking` in `TRAVEL_ENTITY_TYPES`, `bookingsFolder` plus defaults and validation, `createBookingNote()`, `NewBookingModal`, the command, health check widened to twelve folders, en/de keys | Bookings exist as notes and can be filled in by hand. No totals yet, nothing to be wrong |
| **1** | The property settings, `readBooking()` in `read-entities.ts`, the `TravelBooking` model, `shared/money.ts`, `costs/totals.ts` with its tests | The arithmetic is real and tested before anything renders it |
| **2** | `apt-trip-costs`, read-only: summary strip and the invoice table through `renderInvoice()` | The first thing a user sees, and enough to try the whole idea against one real trip |
| **3** | `budget:` and `rates:` on the Trip, edited from the block; planned/committed/paid and the variance | The planning half. Deliberately after the recording half, because a budget you cannot compare against is a wish |
| **4** | `costs/split.ts` and the settlement footer | Pure arithmetic over data that already exists by now |
| **5** | Itinerary cost chips and document links; §8's resolution | Needs bookings, and wants the reference-matching rule proven against real legs |
| **6** | Dashboard tile, trip card meta | Polish over a feature that works |
| **7** | The exported cost sheet, and the `shared/print-sheet.ts` extraction it needs | Last, because it is the second consumer that justifies the extraction |

Phases 0 to 2 are the ones that decide whether this is worth having. They
should ship and be lived with before 3 is started.

## 14. Deliberately out of scope

- **Fetching exchange rates.** The plugin makes no network calls, and this
  feature does not become the exception. A rate is typed once per trip.
- **Online price lookup.** Asked about as a maybe, and the seam matters more
  than the feature: if it is ever built, it is a separate opt-in module that
  may only ever *create or update a booking whose status is `estimate`*,
  must record where the figure came from, and must never touch a `booked` or
  `paid` figure. A note is a record of what was charged, and a lookup that
  can overwrite one is not a lookup.
- **Receipt OCR, bank imports, card statements.** Different domain, and each
  is a product on its own.
- **Business re-billing and VAT.** The invoice model already supports it and
  a later design can add `billable`, `vatRate` and `vatAmount` to a booking
  without changing anything here.
- **Cross-trip reporting.** "What did I spend on travel in 2026" is a real
  question and it is the obvious next one after this lands. It needs a view
  rather than a data model change, which is exactly why it is not in this
  document.
- **Unequal splits and per-person amounts.** §5.4.
- **Amortising one cost across several trips** (an annual rail pass, travel
  insurance for the year). It needs a booking to belong to more than one
  trip, and that is a different shape from the one designed here.

## 15. Documentation and tests

| File | What |
|---|---|
| `docs/features/travel.md` | A Bookings section, the costs block, the itinerary chips, the twelfth folder, the new commands and warnings |
| `docs/design/data-model.md` | The tenth fixed type value, the booking shape, the new block language |
| `docs/design/settings-reference.md` | The folder, the two behaviour settings, the twelve property rows, the four sub-key names, and the two new fixed vocabularies under "deliberately not settings" |
| `docs/design/architecture.md` | `src/trips/costs/`, `shared/money.ts`, `shared/print-sheet.ts`, the fourth code-block processor |
| `docs/design/trip-model-redesign.md` | One line in §9 pointing here, rather than a rewrite: the decision was right when it was made and this is what changed |
| `docs/templates/` | A Booking template, and the index row for it |
| `CLAUDE.md` | The money rules: cents, nullable totals, never sum across currencies, never write a derived balance |

New suites, in the order they were written: `costs-totals.test.ts` (per-currency totals, the null-not-zero
rule, cancelled and refunded, conversion with and without a rate),
`costs-split.test.ts` (equal shares, absent `for`, a booking with no payer,
transfers summing exactly to balances, the one-payer case), and
`booking-note.test.ts` (parse and write round-trip, quoted dates, omitted
optionals). `translation-keys.test.ts` covers the new keys by construction.

Added afterwards, with the work in §16 and the item-level estimates:
`export-trip-costs.test.ts` (the printed sheet's markup), `line-cost.test.ts`
(the multiplication, the fallbacks, and the party-of-nobody case),
`currency-options.test.ts` (a code already in a note is always offered) and
`costs-estimates.test.ts` (a booking taking an estimate over, and the one
hole where it cannot).

## 16. Two people, two tickets

Added after §§0 to 15 were built, from the first real trip planned with them:
a trip with two people needs two flights, and a hotel room whose price
depends on how many of them are in it. Every figure in §5 was a flat amount,
which quietly assumed a party of one.

### 16.1 Three facts, not one

The mistake to avoid is folding all of this into a single number. There are
three separate facts and they change independently:

1. **Who is on this line.** Not always everybody: somebody joins on the
   Thursday, somebody flies home early, somebody sits out the boat trip.
2. **What the price is per.** An airline quotes per passenger, a hotel quotes
   per room per night, a museum quotes per head, a rental car quotes per day
   for the car. The number you copy off the booking page means different
   things on different lines.
3. **What that comes to**, which is arithmetic over the first two and is
   therefore never stored.

### 16.2 Who: a `persons` list per line

A stop, a night and a leg each grow a `persons:` list of wikilinks, the same
shape a booking's `for:` already has. **Empty means everyone on the trip**,
which is the common case and must not have to be typed, and which keeps
working when a fourth person joins the trip later.

Named people rather than a head count, for one reason that pays for the extra
typing: it is the same list a booking needs for the split, so "Book this" can
hand it over and the settlement is right without anybody retyping it. A count
could never do that.

The editor offers the trip's own participants as tick boxes -- you cannot be
on a leg of a trip you are not on -- and writes nothing when every one of
them is ticked, because that is what empty already means. A line therefore
stays minimal until it genuinely disagrees with the trip.

### 16.3 Per what: a `costUnit` beside the cost

A fixed vocabulary of four, stored beside the figure it qualifies:

| Value | Multiplied by | The thing it describes |
|---|---|---|
| `total` | 1 | The whole line, as quoted |
| `person` | people on the line | A ticket, an entry, a seat |
| `night` | nights of the stay | A room, per night, however many are in it |
| `personNight` | people x nights | A bed in a dorm, a half-board supplement |

Absent or unrecognized reads as `total`, because a bare number somebody typed
by hand must not silently multiply into something larger than they meant. The
editors default the select to the unit that line type is normally quoted in
(`person` for a leg or a stop, `night` for a stay), so a line created through
the UI always states its unit explicitly and only hand-written frontmatter
falls back.

Nights come from the stay's own `checkIn`/`checkOut`; where those are missing
the multiplier is 1, and the row shows its working so a stay counted once is
visible rather than assumed.

### 16.4 Showing the working

The arithmetic is never written back -- the same rule every other figure here
follows -- so the only defence against a wrong total is that the row shows how
it got there. An itinerary line displays the computed amount and, on the chip
itself, the sum behind it: `890 x 2 travellers`. A line whose people differ
from the trip's carries a travellers chip naming the count.

Deliberately NOT inferred: the words "single room" and "double room". Two
people on a night can be one double or two singles, and the plugin cannot
know which. It shows how many people the stay is for and lets the price
somebody looked up say the rest.

### 16.5 What does not change

Estimates still stay out of the settlement: an estimate names no payer, so
there is nothing to owe. `persons` on a line feeds the settlement only by
being handed to the booking that supersedes it. And the four costs
(stop, night, leg, and the booking note itself) still meet in exactly one
place, `costs/estimates.ts`, so the block, the sheet and the itinerary cannot
count different things.

## 17. Prices to choose between, and things that may not happen

Two shapes a priced line can take, added when the Nordkap trip needed both. A
voyage was offered as two cabin categories at two prices, and nearly every day
of the same brochure offered an excursion that may or may not be taken. They
look alike in a note and are different questions, so they are two sub-keys
rather than one.

### 17.1 Variants are alternatives

`variants:` is the several prices one thing is sold at: a cabin category, a
room category, a two-hour or four-hour version of the same excursion. **They
are never summed.** Exactly one is bought, and a total that added two of them
would report a holiday nobody is taking -- the same class of lie §1 exists to
prevent.

Three rules follow, all in `costs/line-variants.ts` so that the itinerary row,
the cost chip, the estimates and the trip document cannot answer them
differently:

- **The chosen one counts.** One, or none: a set of alternatives with two ticks
  is not a choice, and the note would not say which figure the budget used.
- **Until one is chosen, the first counts, and every row that shows the figure
  says so.** Counting nothing would leave the largest figure on a trip out of
  its own budget for as long as the trip is being decided, which is exactly the
  argument §7.1 makes for `estimate` counting as committed. The note's own
  order picks it, because an operator lists its cabins in the order it means
  them to be read.
- **A line with variants is priced from them; its own `cost` is not read.**
  Otherwise the same thing counts twice. The editors move an existing figure
  into the first variant rather than leaving a field nothing reads.

### 17.2 Optional is the other axis

`optional: true` says the line might not happen. It is priced like any other
line and **stays out of the planned total** until `chosen: true` says somebody
decided on it. Deciding sets `chosen` rather than clearing `optional`, so the
note keeps the fact that it was an extra, which is what the trip document
prints.

What the untaken extras would add is its own figure beside the plan --
`optionalTotal()` in `costs/estimates.ts`, shown on the costs block, the cost
sheet and the trip document. Three properties of that figure are deliberate:

- It goes through the same `plannedByCategory()`/`plannedTotal()` pair as the
  plan, with no budget to compare against, so the currency rule is identical at
  both ends: an estimate in another currency is skipped rather than converted
  at a rate the reader cannot check.
- It is null rather than zero when the trip offers nothing, like every other
  total here.
- It never reaches `estimateLines()`. That is the line to hold: an untaken
  extra that got through would be counted as committed, would move the
  variance, and would arrive in the settlement as a debt nobody owes.

**An optional line with variants is both at once and needs no special case**:
out of the plan until chosen, priced from its variants when it is in.
