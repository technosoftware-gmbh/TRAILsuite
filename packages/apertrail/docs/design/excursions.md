# The thing you are sold a day of

A guided tour, a king-crab safari, a bus to the Nordkap: "Auf den Spuren der
Wikinger", "Cape Peninsula by road". Added 7 September 2026, the second new
entity type since photo spots, and the answer to half of one request. The other
half -- a trip that follows another trip -- is at the foot of this file, and
keeping the two apart was the design work.

## What was asked, and why it is two things

> *"Trips can have optional daily events or short trips like already used on day
> 3. It should be possible to select other trips like selecting a place is
> already done. This could solve the optional daily trips but also extending a
> trip with another one, e.g. arriving in Kopenhagen and doing another 3 day
> trip."*

One sentence, and two needs inside it.

**The first** is day 3 of a Hurtigruten voyage: a second stop on Stavanger
carrying the whole brochure paragraph in its `note:`, a price, and
`optional: true`. It works. What it cannot do is exist twice. The same Viking
tour is sold on every sailing out of Oslo, and today it is retyped, prose and
all, into each trip that offers it, with its picture nowhere at all.

**The second** is three days in Kopenhagen after the ship docks: its own days,
its own hotel, its own flight home and its own budget. That is a trip.

The general answer -- one trip-to-trip link doing both -- was available and was
not taken. Reusing `trip` for an excursion puts ten brochure excursions per
sailing into `TRAVEL_STATUS_VALUES`, the trip ordering, the next-trip countdown
and the trip gallery: ten things nobody is going on, counted among the trips
somebody is. So: **two mechanisms, and they are different links.**

## Why it is a note and not prose on a stop

The shape was already answered here, for the ship. **The catalogue belongs on
the thing and the price belongs on the sailing** (see [Vehicles](vehicles.md)),
and an excursion is a thing that is sold. Its description, its picture, its
gallery, its duration and its operator are facts about the tour and outlive
every trip that takes it; what it costs is a fact about the trip.

Correcting the description on the excursion corrects every trip that ever took
it. Nothing is copied and nothing is written back.

## Where it differs from the ship: no catalogue

A vehicle lists its cabins because one sailing sells several grades of the same
voyage and the leg picks exactly one of them. **A stop picks one excursion**,
so a half-day and a full-day version of the same tour are two notes rather than
two rows in one. There is no `variants:` on an excursion note and no price of
any kind.

The trip's line keeps everything it had: `cost`, `costUnit`, `currency`,
`variants:` where this sailing prices it more than one way, and
`optional: true` with `chosen:` where it might not happen.

## What it is not

**Not a place.** A place is somewhere you went, with coordinates and a `visited`
flag derived from the trips that stopped there. An excursion is something that
is *run*, and the place it happens at is the stop it hangs off. It is not a
member of `TRAVEL_PLACE_TYPES`, the same call the booking and the vehicle got.

It does carry `country:` and `city:`, which a vehicle does not, and they resolve
exactly as a place's do -- a tour out of Stavanger is in Norway, and a ship is
not. Nothing derives a visit from them.

**Not a fourth module.** `Places/Excursions`, and an excursion is not a place.
The rule that settles it is the one the vehicle was settled by: every folder is
derived from one of the three module roots, which is what keeps a module
relocatable as a unit.

**In the gallery, with no place facets.** It has a picture and a description
and belongs in a grid of them. It answers neither `visited` nor `rating`, so it
joins the vehicle and the two CRM types in `TYPES_WITHOUT_PLACE_FACETS`: under
its own chip no facet dropdown is drawn, and a value carried in from another
chip is cleared rather than left filtering an invisible column. Its rows still
carry a country, so the `all` chip can filter on it.

## The stop

A new `excursion:` sub-key, beside `place:` rather than instead of it. Both are
true at once on the Stavanger line: the place says where the ship is, the
excursion says what is being decided about.

```yaml
stops:
  - place: "[[Stavanger]]"
    day: 3
    excursion: "[[Auf den Spuren der Wikinger]]"
    cost: 119
    costUnit: person
    currency: CHF
    optional: true
```

The stop's own `note:` stays and changes meaning slightly, for the better: it
becomes what is true of *this* sailing rather than what is true of the tour.

**A stop may name an excursion and no place at all.** An outing that meets on
board names nowhere, and the writer's filter keeps such a line. It is not
reported as an unresolved link either: naming no place and naming a place that
did not parse are different facts, which is a distinction the stop reader
already drew.

**A name the vault has no note for is kept and shown.** The leg's vehicle reads
the same way and for the same reason: a tour somebody typed the name of, before
there is a note for it, is still the tour they are taking.

## Nothing already written changes

A stop with the brochure paragraph in its `note:` and no `excursion:` renders
exactly as it did. There is no migration and none is offered: rewriting note
bodies the plugin does not own is the thing this repository does not do.

## The other half: a trip that follows a trip

`extends:` on the trip note, holding a wikilink to the trip this one continues.

**The link is on the child.** Three days in Kopenhagen are planned long after
the voyage note was finished, and a parent that had to list them would be
reopened every time one was added. The parent's `extensions` are derived when
the vault is read and never written back, which is this repository's oldest
rule; and the related-trips block already answers exactly this shape of
question by reading the other side.

**The link carries no money.** The Kopenhagen trip's flights and hotel stay in
the Kopenhagen trip's budget. The trip document prints the extension's total as
*the extension's*, beside its own and never added into it, in the shape the
untaken optional lines already use -- and says so in a sentence under the
heading, because a reader comparing two numbers deserves to be told they are
two numbers. The two trips are separately bookable and separately cancellable
in real life.

### The sentence in the reader that stops being true

> *"Reads trips last, because their stops point at Cities and places and both
> must be indexed first. **Nothing points back up at a Trip, so this is still
> one pass.**"*

`extends:` ends that. What replaced it is a second walk over trips that are all
built, mutating the join in place exactly as the Country/State/City pass does,
so every reference points at the instances the rest of the board already holds.

Two guards, and neither is optional:

- **A trip is never its own extension.** A self-link is a cycle of length one,
  and the only place it can come from is somebody editing frontmatter by hand
  -- which is why the guard is at the read and not in the form. The form leaves
  the trip out of its own dropdown as well, because a control that offers an
  answer the reader then refuses is a control that lies.
- **Nothing walks a chain.** `extensions` is filled one level deep, so A -> B
  -> C leaves B holding C and A holding B, and a cycle of any length terminates
  by construction rather than by a visited-set somebody has to keep right. An
  extension of an extension belongs on its own sheet.

A duplicate of a trip clears `extends:` along with the dates and the status,
for the same reason: the copy happens nowhere yet, so it follows on from
nothing yet.

## The editing question this exposes, which is not a code question

The Nordkap note's inbound leg is `Kopenhagen -> Zürich` on day 16. **The
moment a Kopenhagen extension exists, that flight belongs to the extension and
not to the voyage.** Nothing in the plugin can know that and nothing should
guess it: moving a leg between two notes is the class of change that rewrites
somebody's records.

A health check could reasonably warn when an extension's `departure` falls
before its parent's `return`. Not built, and recorded here rather than
forgotten.

## Still open

- **No stats tile.** The place dashboard counts vehicles and does not count
  excursions. One line of arithmetic and a tile, deliberately left until
  somebody has enough of them to want the number.
- **Nothing warns when a stop names an excursion the vault has no note for.**
  The symptom is quiet -- the description simply does not appear -- and the
  booking health check is where that belongs. The same gap the vehicle's cabin
  lookup has.
- **An excursion has no editor of its own.** Creation collects three fields and
  the rest is hand-edited or set from the Cover dialog, which is where a
  vehicle was until its cabins earned a dialog.
