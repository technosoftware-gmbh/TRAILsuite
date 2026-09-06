# A trip is a shape before it is a set of dates

**Written and built 30 August 2026.**

## The two phases nobody had modelled

The first thing anybody writes down about a trip is what happens on day one,
day two, day twelve -- a restaurant, a hotel, a train -- with no idea yet which
calendar days those are. A tour operator's brochure is exactly this and never
prints a date at all. Only later does a departure get fixed, and every one of
those days becomes a date.

APERtrail had no way to say any of that. A stop, a stay and a leg carried
absolute datetimes and nothing else, so an itinerary could not exist before its
dates did. The workaround is to invent a start, type twelve days of real dates
against it, and retype all of them when the real departure turns out to be a
week later.

Reported as: *"At the beginning the start date is unknown or not yet known. So
on day one you have something, restaurant or hotel etc. up to the last day. Then
it gets planned with a specific start date and everything else is calculated
based on that."*

**`trip-model-redesign.md` §9 ruled this out** under "Recurring or template
trips. No evidence of need." That was right about recurrence and wrong about
this, which is a different thing: not a trip that repeats, but one that is
relative until it is planned.

## What was added

One idea, applied to all three kinds of itinerary item, because a day that
worked for stops and not for stays would leave half of every day still forcing
a date:

| Item | Sub-keys | Note |
|---|---|---|
| a stop | `day` | One: a stop is within a day, which is what "day by day" means |
| a stay | `checkInDay`, `checkOutDay` | Two, matching the `checkIn`/`checkOut` pair beside them |
| a leg | `day`, `toDay` | Two, because an overnight flight is the commonest leg there is |

All five are settings, like every other sub-key name. They get no rows on the
Property keys page, for the reason the other forty sub-keys get none.

```yaml
stops:
  - place: "[[Pretoria]]"
    day: 1
    from: "10:00"
    note: Boarding at Capital Park
  - place: "[[Kimberley]]"
    day: 3
    from: "09:00"
    to: "16:00"
```

### The one shape decision

**`from` and `to` carry a bare `HH:mm` when a day number is set**, and a full
datetime when it is not. Two shapes in one field, which this repository
normally avoids -- and the alternative was a `fromTime` beside every `from`,
four more sub-keys, and a note where two adjacent keys both mean "when it
starts". The note is the product here, and `day: 1 / from: "10:00"` reads the
way somebody would say it out loud.

What makes it safe is that nothing reads the raw field for meaning any more.
`relative-days.ts` has `clockTime`, which reads a bare time and the time half
of a datetime alike, and `endpointDate`, which resolves a day number or takes a
value's own date. Every consumer goes through one of the two.

`clockTime` reading **both** shapes is not defensive slop. A note carrying a
day number *and* a leftover datetime is a note halfway through being edited,
and the time is the wrong half to throw away.

### Day 1 is the departure day, and day 0 is allowed

An overnight flight leaving the evening before is `day: 0`. Rejecting that
would mean renumbering a twelve-day trip around a red-eye, so a day number is
any integer and the document says so.

## Nothing is written when the trip is planned

Setting a departure resolves every day number on the fly. The note goes on
saying `day: 3` for as long as it exists.

This is the house rule -- nothing derived is written back -- and here it also
buys the thing the feature is for: moving the departure by a week moves the
whole trip and rewrites not one line. The alternative, a command that turns day
numbers into dates once, would rewrite every stop, every stay and every leg,
and would throw away the shape the trip was designed in. Confirmed as the
choice rather than assumed.

## Grouping, before and after

`groupStopsByDay` grouped by the date part of a stop's `from`. An undated
twelve-day brochure would have collapsed into one heap.

It groups by a **key** now: the resolved date where there is one, and `#3`
where there is not. So the same grouping serves a trip in both phases, and a
day half-written as a number and half as a date does not split in two. Its
older rule is untouched -- days appear in the order their first stop does, and
nothing is re-sorted, because an itinerary's own order is information.

A group also carries its **number**, taken from the stops when they say one and
derived from the date when they do not. That is what lets a header read "Tag 3"
on a planned trip and on an unplanned one alike.

**The day's own number, never a running count.** A counter would renumber
everything the moment a day had no stop in it, and a brochure has exactly that:
day four is a day at sea with nothing booked.

## The money still works, and without a departure

A per-night figure multiplies by the nights of the stay. `nightsBetweenDays`
counts them from the two day numbers, and needs no departure at all, because a
night count is a difference and a difference does not care where the counting
started. A three-night stay on a trip with no dates prices correctly.

Day numbers win over dates left behind by an earlier edit, for the same reason
`endpointDate` lets them: they are what the note now means.

## The editors

Each editor takes a **day number**, and when it has one the date inputs give
way to bare time inputs. A date field beside a day number would be a control
whose value is ignored -- the shape of defect this repository keeps finding
under the name *correct code standing where it can never run*.

Switching converts rather than clears, in the direction that can be converted.
Going relative keeps the clock and drops the date the day number now supplies.
Coming back needs a date to put the time on and takes it from the day number
through the departure; a trip with no departure has none to give, so the field
comes up empty rather than holding a bare time an absolute reader would
discard.

The day field's description says what the number resolves to -- "4. November
2026" under a 3 -- so the number can be checked against the calendar without
doing the arithmetic in your head.

## What `undefined` cost, twice

`day` is `number | null` and the parser only ever produces `null`. An item
assembled by hand leaves the sub-key off, which is `undefined`, and
`undefined !== null`.

That sent every hand-built stop down the relative branch and lost its date, and
on the write side it kept an empty transport leg that should have been dropped.
Both were caught by fixtures older than the field, which is the argument for
having them. `cleanDay` and `hasDay` answer the question in one place each, the
way `cleanString` and `writeLineCost` already did -- the precedent was there and
this file did not follow it the first time.

## A day says something for itself

**Built the same day, once a real brochure day was written out.** The first
attempt left two things with nowhere to live, and both showed up in the first
five lines the author typed:

```
1. Tag: Pretoria
14.00 Uhr: Check-In an der Rovos Rail Station in Pretoria.
15.00 Uhr: Abfahrt des Zuges. Die Reise fuehrt Sie zunaechst in Richtung
           Sueden durch die Goldfelder von Witwatersrand.
16.30 Uhr: Der Nachmittagstee wird im Lounge- und im Beobachtungswagen
           serviert.
19.30 Uhr: Ihr Abendessen wird in den Speisewagen serviert.
```

### A stop may be a time and a sentence

Three of those four lines happen on a moving train and are **at nothing**. A
place note for the station and one for the train carries two of them, and it is
not even a workaround -- the train genuinely is a place you spend twelve days
in. It does not carry the tea and the dinner, and it puts a repeated place name
down the left of every day.

So the write rule moved from "a stop needs a place" to **"a stop needs a place
or a note"**. The old comment said *the place IS the stop, and an entry with
only a time on it says nothing*: the first clause was true of the itinerary this
schema was designed around, where every entry is a visit somewhere, and is not
true of a brochure day. The second clause is still enforced.

**A placeless line is told apart from a broken one.** Both read as a null
place title, and only one of them is a note that needs fixing. `placeUnresolved`
is true when the entry names a place that did not parse and false when it names
none, so a typo still renders as unresolved and a brochure line renders as its
own sentence. Without the flag every line of every day would carry an
"unresolved link" warning about nothing.

A placeless line's note is also set at body weight rather than in the muted
style an aside gets: on a brochure day the sentence *is* the entry, and putting
it in the smaller grey used for "good schnitzel" buries the only thing there.

### A day may be named, and may have a paragraph

`1. Tag: Pretoria` is editorial. It cannot be derived: day four is
"Fish River Canyon" while its stops are at a lodge.

So the trip carries a **sparse `days:` list**, keyed by day number:

```yaml
days:
  - day: 1
    title: Pretoria
  - day: 4
    title: Seetag
    note: Ein Tag an Bord, ohne festes Programm.
```

**Sparse is the whole point.** Only a day that says something has an entry, no
stop belongs to a day object, and a day is still derived from the items on it.
This is deliberately not the "days are the spine of the itinerary" option,
which would have meant every existing stop needing a day to belong to.

An entry with no title and no note is dropped on write, and the editor removes
it rather than writing a blank: the day number alone is not an annotation, it
is the key one is filed under.

### A named day with nothing booked on it

"4. Tag: Seetag" has no stop to build a group from, and has to appear anyway.
`itineraryDays()` merges annotated days into the ones the stops produced,
**inserting by number and never re-sorting**: the older rule that days appear in
the order their first stop does still holds, and nothing that has stops moves. A
stopless day goes in front of the first day numbered higher than it.

Where it lands among days somebody wrote out of order is deliberately not
specified. An itinerary listing day 5 before day 2 has no right answer for where
day 3 goes, and the test asserts what does have one: 5 still comes before 2.

## A leg reads like a flight card

`20:30 - 10:00 +1`, which is what an airline, a railway and every booking
confirmation print. It said `Tag 0 -> Tag 1` first, which is the same fact
twice and in a vocabulary nobody uses outside this plugin. Reported as exactly
that: *"usually a flight card will show the arrival at +1Day"*.

So a leg says **when it leaves** -- the day number, or the date once the trip
has one -- and the arrival is the `+1` hanging off the clock. `journey-text.ts`
builds both, and the itinerary block and the trip document read it from there,
so the two cannot drift.

The marker appears only when the arrival is genuinely on a later day, so its
presence means something wherever it shows: a same-day hop prints
`Tag 5 - 09:00 - 13:00` with nothing extra. It is not a translated string --
`+1` is `+1` in every language a timetable is printed in.

**A stay keeps its span.** `Tag 1 -> Tag 3` is what a hotel confirmation says,
because a stay *is* the two dates; a flight is a departure with an arrival
hanging off it.

### A leg that runs for days is the stay's case, not the flight's

`+1` is the timetable's word for **one** night, and nothing anybody prints says
`+14`. A Hurtigruten voyage written as `day: 1 / toDay: 15` had no clock times
at all, so there was no marker anywhere and the row said `1. Tag` and nothing
else: the longest thing on the trip read like its shortest. Reported from a
real note.

So past one night, or where there is no arrival clock to hang a marker on, a
leg states both ends and how long it runs -- `1. Tag -> 15. Tag - 14 Nächte` --
which is the stay's shape, because a leg like that is a stay that moves. One
night with a clock beside it is untouched and still reads as a flight card.
`statesItsSpan()` in `journey-text.ts` is where that line falls, and
`legNights()` counts in nights rather than days because nights is the count
nobody argues about: day 1 to day 15 is fourteen nights however each end is
spent.

**And it is named on the day it ends.** Legs stay in the transport band, for
the reason recorded on `TripDocumentJourney` -- a return flight lands the day
after the trip and would otherwise be filed under a day it does not happen on.
That reasoning covers a flight and not a fortnight: the day a voyage ends is a
real day of the itinerary with stops on it. `leg-arrivals.ts` names such a leg
on that day and nowhere else, and only when the itinerary already draws the
day, which is what keeps the return flight outside the day-by-day. It is a
marker, not a row: the leg is still edited, priced and booked in its own band.

**A stopover is two legs**, not a field. ZRH-DOH and DOH-JNB each have their
own times, reference and price, and one leg against two is already the
difference between non-stop and a change.

## Removing a day, and inserting one

**The operation the relative days were for.** "Not two nights in Johannesburg
but only one" is a whole day taken out of the middle of an itinerary with
everything after it moving up. On a numbered itinerary that is subtracting one
from some integers; on a dated one it is retyping twelve dates, and it is the
clearest argument for the note going on saying `day: 3`.

The day header carries three actions now, hidden until the row is hovered like
the per-stop ones: name it, insert a day before it, remove it.

**Only stops are deleted.** A stay or a leg on the removed day keeps its
number, which now points at the following day. Deleting somebody's booked
flight because they cut a day from the plan is the more expensive of the two
mistakes, and the cheaper one -- a stay that now starts a day earlier than
intended -- is visible in the itinerary the moment it happens. Confirmed as the
choice rather than assumed, because it deletes from a note.

The shift starts at `day + 1` rather than at `day`, so nothing that was on the
removed day is renumbered onto the one before it. Both plausible mistakes --
shifting from the day itself, and deleting stays on it -- are caught by
`day-shift.test.ts`, and were confirmed by making each of them on purpose.

Inserting creates nothing: the new day is empty until something is put on it,
and an empty day with no title does not appear at all. Insert then remove the
same day is the identity, which is what makes the pair safe to reach for.

## Still open

- **A stop cannot cross midnight relatively.** It has one `day` where a leg has
  two. A stop from 23:00 to 01:00 is two stops, or an absolute pair.
- **A day's paragraph is one string.** Several paragraphs would want the body
  text treatment the trip overview gets, and no brochure day has needed it yet.
