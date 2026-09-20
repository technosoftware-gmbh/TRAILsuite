# Plan: a day entry that names people and a place, and what happened there

**Written 20 September 2026, before any code, and decided the same day.** It
changes what gets written into a day note, which is the class of change this
repository treats as expensive. `day-notes.md` and `calendar-import.md` are the
two documents this one continues; neither should be read as superseded.

**Three shapes were laid out and one was chosen.** Section D keeps all three,
with their costs, because the rejected two are the argument for the one that
won, and a shape reproposed in six months should meet its own cost sheet.

---

## A. What is being asked, and it is two things

**One.** A day entry -- a meeting from the calendar import, or a line typed in
the capture dialog -- can name one context, and that context is a project or an
area. It cannot say **who was there** and it cannot say **where it was**. A
lunch is `- 👥 12:00-13:30 Mittagessen [[Beruf]]`, and the restaurant and the
two people at the table are nowhere in the vault.

**Two.** A trip plans a stop at a place on a day, and an excursion hanging off
that stop. What the plan does not hold is whether it happened and how it was:
what was eaten, what was actually done, what it was like. That belongs in the
day note, because a plan is a claim about the future and a day note is a record
of a day.

These are one feature in use and two in the code. The first is a note format
question. The second is a question about which side of the vault owns a fact,
and it has an answer:

> **APERtrail plans. The day note records.** A trip says an excursion is meant
> to happen on the 14th. Whether it happened, and what it was, is the day
> note's to say.

Everything in section F follows from that sentence, and section F is the half
that does not touch the note format at all.

---

## B. The three rules any answer has to survive

These are not preferences. Each is already load-bearing somewhere.

**B.1 The derived key.** `calendar-import.md` §D decided that an imported
meeting is identified by **the day, the start time and the text**, and that
nothing is written into the note to mark it as imported. Anything a new field
adds to that key makes every existing line look like a new event on the next
import. **A place or a person may not enter the key.** §J.2 already had to make
the same argument for the attendance marker, and the reasoning carries over
unchanged.

**B.2 The round trip decides editability.** `read-day.ts` offers an entry for
editing only when composing its draft back reproduces the line character for
character (`reproduces()`). A line with something the draft has no field for is
shown, is not editable, and opens the note instead. This is what makes writing
to somebody's body safe at all, and it is why `- 👥 11:00 Sync [[A]] [[B]]` is
read-only **today**: `parseScheduleLine` collects every wikilink into `links`,
the draft keeps `links[0]` as `context`, and the second link is dropped on the
way back.

That last fact is worth stating twice, because it cuts both ways. The reader
**already** sees every link on the line. What is missing is a field to put them
in, not a parser. And every day note that already carries two links on one line
is a note whose entry is read-only until this feature ships.

**B.3 The line is the plugin's, the checkbox is the core's.** A task line is
`composeTaskLine` in `@technosoftware/trail-core`, in the Obsidian Tasks format,
and nothing here changes it. Only the marked lines (`dayMeetingMarker`,
`daySpanMarker`, `dayNoteMarker`, `dayIdeaMarker`) are NODAtrail's to extend.

And one more, which is not a rule but a decision now reopened on purpose:

**B.4 `LOCATION` was left off the line once already.** §F of
`calendar-import.md`: the `.ics` `LOCATION` is carried on the import proposal
for the preview and is not written, on three grounds -- the format has no place
for it, inventing one is a vault change rather than an importer detail, and a
location edited in Google would change the derived key. The first two are what
this document answers. **The third stays answered**: the chosen shape puts the
place on a child line, which the key never reads.

---

## C. What each side already holds

Worth having in one table, because three of these rows are the reason the
feature is small rather than large.

| Where | What it already has |
|---|---|
| `DayEntryDraft` | `kind`, `text`, `context`, `due`, `priority`, `startTime`, `endTime`, `attendance`, `notes`, `followUps` |
| `parseScheduleLine` | `kind`, `attendance`, `from`, `to`, `text`, **`links` (all of them)** |
| A meeting's children | indented `📝` lines and indented checkbox follow-ups, captured and read back as one unit |
| A trip stop | `place`, `from`, `to`, `note`, `rating`, `excursion`, `persons`, `cost`, `currency`, `costUnit`, `variants`, `optional`, `chosen` |
| An excursion note | its own note type in `Places/Excursions`, summary callout, highlights, picture; no price, because the price is the trip's |
| A Person note | shared by all three plugins; each plugin renders its own fenced block inside it (`travel-related-trips`, `nod-spending`) |
| Visit derivation | `visited` / `lastVisit` on a place are **derived from finished trips**, never written |

Two things are already true that a design could accidentally re-invent. **A
meeting is already a parent with children**, so a shape that hangs sub-lines off
an entry is extending a mechanism rather than adding one. And **a place already
learns it was visited by being read about**, never by being written to, which is
the precedent for anything a day note would otherwise want to stamp on a
restaurant.

---

## D. Three shapes for the people and the place

Each is written out as the line it produces, then what it costs. The costs are
not symmetric and that is why they were written down before choosing.

### D.1 More wikilinks on the same line

```markdown
- 👥 12:00-13:30 Mittagessen [[Beruf]] [[Gifthüttli]] [[Anna Muster]]
```

The draft gains `place: string` and `persons: string[]`. `entryLines` appends
them after the context link in a fixed order. `meetings()` fills them by
resolving each link's target and reading its `type:`.

**What it costs.** The composer has to put the links back in exactly the order
it found them or the round trip fails, so the order becomes part of the format:
context, then place, then persons in the order written. That is a new rule in a
format whose whole editing story rests on one line composing back to itself.

**What it breaks.** Nothing in the vault: existing lines parse unchanged, the
key is untouched, and a two-link line that is read-only today becomes editable.
But **it makes the link's meaning depend on the note it points at**, which is
section E's problem, and a link whose target does not exist yet has no type at
all. A place typed before its note is written would be read back as a person,
or as nothing.

**Rejected as the record**, and kept as the display. See D.4.

### D.2 Indented sub-lines under the entry -- **chosen**

```markdown
- 👥 12:00-13:30 Mittagessen [[Beruf]]
    - 📍 [[Gifthüttli]]
    - 🧑 [[Anna Muster]]
    - 📝 Rehpfeffer, sehr gut. Anna nimmt nächstes Mal die Rösti.
```

Two new markers, `dayPlaceMarker` and `dayPersonMarker`, beside the four that
exist. `childrenOf()` already gathers everything indented under a meeting;
`childText()` and `childTasks()` already sort those children by what they are,
and this adds two more sorts beside them.

**What it costs.** Two settings, two rows in the settings reference, two
translation keys, and the span rule reopened (J.8, and §D.5 below).

**What it buys, and it is the largest thing in this document.** The headline
line does not change. The derived key cannot move. Every existing reader, every
existing note, the importer's whole replay mechanism and the editability rule
are untouched, because the thing they read is unchanged. It is the only one of
the three that is a strict addition.

**And it is already where the answer to "what was eaten" lives.** The `📝`
child is the existing shape for a note under a meeting. A restaurant visit
carrying its place, its people and what was eaten is four lines of one existing
mechanism.

**The failure mode to expect.** A note somebody hand-edits whose children drift
out of the shape the composer writes. The round-trip rule already refuses these,
correctly, and the cost is that more entries are read-only. That is the right
direction for the cost to fall.

### D.3 A visit record the line points at

```markdown
- 👥 12:00-13:30 Mittagessen [[2026-09-14 Gifthüttli]]
```

with the record a note of its own: place, persons, what was eaten, a rating, a
link back to the day and optionally to the trip stop it fulfils.

**What it costs.** A note type, a folder, a path template, a type-value setting,
a create dialog, an edit dialog, a health check, a settings-reference block and
an entry in the data model. Everything a note type costs in this repository,
which `excursions.md` measured honestly the last time one was added.

**What it buys.** Structure that survives being asked questions of. "Which
restaurants did I go to this year and with whom" is a read over one folder
rather than a parse of 365 bodies.

**Why it lost.** Every question it answers better is a question nobody has asked
yet, and the note type it adds is the element hardest to take back.
`calendar-import.md` §D chose the visible, recoverable failure over the exact
mechanism, twice, and was right both times. **If D.2's children ever need to be
queried across a year, this is the shape to come back to**, and the children
written under D.2 are exactly the material a later conversion would read.

### D.4 Side by side, and what was chosen

| | D.1 links on the line | D.2 indented children | D.3 a visit note |
|---|---|---|---|
| Headline line changes | yes | **no** | yes |
| Derived key at risk | no, if ordered | **no** | no |
| Existing notes reparse differently | no | no | no |
| New settings | 0 to 2 | 2 markers | ~6 plus a folder |
| Needs to resolve a link's type | yes | only for display | no |
| Multiple people | awkward past two | natural, one line each | natural |
| Free text about what happened | no place for it | the existing `📝` child | a property |
| Cost to take back | moderate | low | high |

**Decided: D.2 for the record, and the display half of D.1.** The place and the
people are written as children. The day view draws chips for **whatever links it
finds**, on the headline and on the children alike, resolved to what their
target says it is. Nothing extra is written to make the chips possible: the
reader already collects every link, and drawing one costs a lookup.

So a line somebody typed by hand with two links on it still gets a chip for the
second one, and still is not editable. **Those are two separate questions and
should stay separate**: what can be shown is everything the note says, what can
be edited is only what composes back.

### D.5 A span may carry children, and what that costs

`read-day.ts` today: `const end = parsed.kind === 'span' ? index + 1 :
childrenOf(lines, index)`, with the reason recorded beside it -- a span is a
fortnight away and has no room. **That is now wrong and the line changes**: a
week in a hotel has a place, the people who came, and something different worth
writing on each of its days.

Three consequences, and the third is the one that would have bitten.

**The composer and the guard follow the meeting's rules.** A span's children are
composed by `entryLines` and compared by `reproduces()` exactly as a meeting's
are, so a span whose children were hand-edited goes read-only rather than being
rewritten.

**A delete takes the children with it**, which is the meeting's rule and the
same reasoning: they were captured as one thing, and a child left under nothing
is an orphan nobody can place.

**The span walk keeps comparing headlines only.** `day-span.ts`'s `sameEntry()`
compares `kind`, `draft.text` and `draft.context`, and **must not** grow to
compare children: the whole point of children on a span is that the Tuesday and
the Wednesday of one holiday say different things. Two further rules fall out of
that:

- **Editing a whole span rewrites the headline line on every day and leaves each
  day's children alone.** Anything else would copy Tuesday's dinner onto
  Wednesday.
- **Editing a span's children is this day only**, always, with no span option
  offered. The dialog says so rather than leaving it to be discovered.

The existing boundary rules are untouched: a day holding two identical entries
still stops the walk, and a day whose line says more than the dialog can compose
back is still refused rather than rewritten.

---

## E. Telling a person from a place from a project

D.1's display half needs one thing the plugin does not have: **given a wikilink,
what kind of note is that**.

Today the day view resolves the context link and reads its `type:` against
NODAtrail's own PARA values. A place is APERtrail's: `TRAVEL_ENTITY_TYPES` (the
twelve) and `TRAVEL_PLACE_TYPES` (the five that share the place shape) are
literals in `packages/apertrail/src/vault/entity-types.ts`. The package boundary
test forbids importing them, and `trail-core` has never heard of `fnb`,
`landmark` or `photospot`.

Three answers were on the table: a NODAtrail setting listing the values, which
puts a copy of APERtrail's vocabulary in NODAtrail's `data.json` where the two
drift; promoting the list to `trail-core`; and not classifying at all, showing
whatever `type:` says.

**Decided: promote the two lists to `trail-core`.** They are statements about a
note format rather than about a plugin, which is the core's own promotion test
as `05-core.md` states it, and a second consumer now exists, which is the other.
`crm/entity-types.ts` stays configurable and stays APERtrail's: people are notes
the vault already owns, and that list is a setting rather than a format.

**What the core takes, and what it does not.** The **values** and nothing else:
no folders, no settings, no reading, no `App`. `TRAVEL_PLACE_FOLDER_SETTING` maps
a type to an `APERtrailSettings` field and stays exactly where it is. The core
gaining a folder map would be the core gaining an opinion about a vault layout
it cannot see.

**Three things this drags along, and each is real.**

- **A core release.** 2.2.0 is what is on npm; this is additive, so 2.3.0.
  APERtrail and NODAtrail move to `^2.3.0`; CULItrail takes it when it next
  moves and neither notices nor uses it.
- **APERtrail re-exports rather than redefines.**
  `packages/apertrail/src/vault/entity-types.ts` imports the two lists from the
  core and keeps its own comments, its types and its folder map. Nothing in that
  package should import the list from two places.
- **A contract test.** `crm-contract` and `order-contract` are the precedent: a
  shared list that two packages assume is a list one test should pin. It belongs
  in the core beside the list, checking the membership and the count, and it is
  the fifth thing to remember from §K's test list.

**Whatever the lists say, a link to a note that does not exist is not an error.**
The dialog writes what was typed, the view draws a plain link, and the day the
note is created it starts resolving. Anything else makes writing a day note wait
on writing a restaurant note.

**And an unrecognised `type:` is shown, not swallowed.** A note whose type is in
neither table gets a plain link rather than a chip. That is the fallback E.3
would have been on its own, kept as the floor under the other two.

---

## F. The plan and the record, which is the other half

This half changes no line format and ships first.

### F.1 Seeding a day from a trip

A trip already says what is meant to happen on a day. `itinerary-days.ts`
computes it. Turning that into day entries is the same operation the calendar
import performs, against a different source, and it should be built as one:

- **The same derived key.** Day, time, text. A stop that produces
  `- 👥 09:00 Hundeschlittenfahrt [[Nordkap 2027]]` is the same line whether a
  person typed it or a trip produced it, which is §D's guarantee and the only
  reason re-running is safe.
- **The same preview, nothing written until the button.** `import-modal.ts` and
  `calendar-import-modal.ts` are the pattern; a third should look like the two.
- **No archive, because the source has not gone anywhere.** The calendar import
  keeps the `.ics` in `_imports` so a later run can replay what an earlier
  export offered (§D, amended). A trip note is still in the vault and still says
  what it said, so the replay is a re-read. **This is the one place a third
  importer is simpler than the two it copies**, and it is worth writing down so
  nobody adds an archive out of symmetry.
- **Which entries.** A stop with a time becomes a meeting line. A stop that
  spans days is the span shape, one untimed line per day, exactly as §E.3 of
  `calendar-import.md` settled for holidays. An `optional: true` stop that is
  not `chosen` produces nothing: it is not planned, it is offered.
- **What it may fill in as children**, once §D.5 ships: the stop's `place` as a
  `📍` child and the stop's `persons` as `🧑` children. Both come off the stop
  and neither is invented. The stop's `note` and `rating` do **not** become a
  `📝` child: they are the plan's own words about the plan, and copying them
  into the diary would put the same sentence in two places with no way to tell
  which was later.

### F.2 What "it happened" means, and who may say so

**The day note says it.** The presence of the line is the claim, and the marker
is the qualification -- the four attendance markers already distinguish a thing
you went to from a thing you declined, and a planned excursion you skipped is
the declined marker, not a deleted line. A deleted line loses the fact that the
afternoon was booked.

**Nothing is written back to the trip.** Not `rating`, not `note`, not a
`happened:` flag. A stop's `note` and `rating` are the trip's own record of the
plan and stay hand-edited; the day note is the diary. This is visit derivation's
rule applied one level up: the evidence lives where it was created, and the
other side reads it.

**A trip's `travelStatus: Over` stays what marks a trip finished**, and visit
derivation stays exactly as it is. Nothing in this plan changes when a place
counts as visited.

### F.3 Reading the day back from the travel side

The direction that currently does not exist. A trip's document and an
excursion's note could show what the day notes say about them, the way a Person
note already shows `travel-related-trips`. That is a read of the plan folders,
scoped to a trip's date range, matching on the link the day line carries --
which means it only works once §D.2 has given the day entry something to match
on. **It is therefore the last thing built, not the first.**

---

## G. What crosses the package boundary

Nothing crosses by import except the two lists §E promotes, and those go through
`trail-core` like everything shared. **Otherwise the vault is the interface.** A
child line naming `[[Gifthüttli]]` is readable by anything that can read a note,
and APERtrail reading plan folders is the same kind of read NODAtrail's
`readTasks` already does across folders it does not own.

| Candidate | Verdict |
|---|---|
| `TRAVEL_ENTITY_TYPES` and `TRAVEL_PLACE_TYPES` | **Promoted** (§E). Values only, with a contract test beside them |
| `TRAVEL_PLACE_FOLDER_SETTING` | **No.** It names `APERtrailSettings` fields, which the core cannot see and should not learn |
| `day-body.ts` and the entry line composer | **No.** `day-notes.md` already ruled: it moves on the two-consumer test, and one consumer reading a day note is not two writing one |
| A "resolve a link and say what kind of note it is" helper | **No.** It needs an `App`, which is the core's own disqualification |

---

## H. Where it shows up

- **The day tab** of the plan view: chips beside an entry for its place and its
  people, drawn from the links the reader already collects. Costs nothing
  written and is the first visible benefit.
- **A Person note**, a new fenced block beside `travel-related-trips` and
  `nod-spending`. NODAtrail's own, listing the day entries that name them. It
  degrades to a plain code block when NODAtrail is off, which is the rule all
  three blocks already follow.
- **A place note** is the one to leave alone. A restaurant already gets
  `travel-related-trips` from APERtrail, and a second block from a second plugin
  answering nearly the same question is two lists somebody reconciles by eye.
  Revisit only if the trip block turns out to miss the ordinary Tuesday lunches,
  which is exactly what it will miss.

---

## I. What this is not

- **Not a calendar.** A day entry with a place is still a line nothing schedules
  from.
- **Not a check-in.** Nothing derives "visited" from a day note. Visit
  derivation reads finished trips and keeps reading finished trips.
- **Not a change to the task line.** `composeTaskLine` is the core's and is
  untouched.
- **Not a migration.** Every existing note parses exactly as it parses today.
  The only note that changes behaviour is one whose span gains children, and
  none has any yet.
- **Not a change to what the calendar import writes.** See J.11: attendees stay
  off the line.
- **Not CULItrail's problem yet.** A meal eaten out is a meal, and CULItrail is
  a separate repository consuming the core from npm. Out of scope by decision;
  anything that would later let it in has to land in `trail-core` first.

---

## J. Decided

**J.1 APERtrail plans, the day note records.** A trip says an excursion is meant
to happen; whether it happened and what it was is the day note's.

**J.2 Nothing is written back into a trip note by any of this.**

**J.3 The place and the people do not enter the derived import key**, under §D
and §J.2 of `calendar-import.md`. The chosen shape puts them on children, which
the key never reads, so this holds by construction rather than by care.

**J.4 Section F ships before section D.** Seeding days from a trip needs no
format change and is useful on its own.

**J.5 CULItrail is out of scope.**

**J.6 A link to a note that does not exist is written, drawn plainly, and is not
an error.** So is a link whose `type:` no table recognises.

**J.7 D.2 for the record, the display half of D.1 for the screen.** Place and
people are written as indented children; the day view draws chips for every link
it finds, headline and children alike.

**J.8 A span may carry children**, with the three consequences in §D.5: the
round-trip guard and deletes follow the meeting's rules, `sameEntry()` keeps
comparing headlines only, and a child is edited for one day with no span option
offered.

**J.9 The two travel type lists move to `trail-core`** (§E), values only, with a
contract test and a 2.3.0 release.

**J.10 The place and the person are markers, and the markers are settings.**
`dayPlaceMarker` defaults to `📍` and `dayPersonMarker` to `🧑`, beside the six
that exist. Blank means "do not distinguish these", which is the rule
`dayMeetingMarker` already follows, and either emoji can be changed in settings
without touching a reader. **Both defaults are easy to change before the first
write and expensive after**, so they are worth a second look at step 5 rather
than at step 1.

**J.11 No cap, and no attendees from the calendar.** The people on a day entry
are private life: work is planned in the company's Google calendar and imported
here only so the hour is not empty, and four at a table is the realistic
maximum. So the format needs no limit and the view draws what it finds. **The
calendar importer still writes no `ATTENDEE` line**, exactly as `calendar-
import.md` §J left it: thirty guests on a work invitation are thirty links
nobody asked for, and the `PARTSTAT` marker already carries the only part of
that data anybody wanted. People get onto a day entry through the capture dialog
and through a trip's `persons`, and through nothing else for now.

---

## K. Order of work

Each step is shippable. Steps 2 and 5 write into a vault, and step 5 changes the
format.

1. **Chips in the day tab** for the links an entry already carries. Needs step 4
   for travel types, so it ships first in its NODAtrail-only form (PARA types
   resolved, everything else a plain link) and gains the rest at step 4.
2. **Seed a day from a trip** (§F.1): the itinerary reader, the plan, the
   preview modal, the write through `appendUnderHeading`. Reuses the calendar
   import's discipline and adds no archive. Children come later, at step 6.
3. **`trail-core` 2.3.0**: the two lists, the contract test, the changelog and
   the version bump on a branch. **Pushed, merged, tagged and released by
   Thomas**, who approves the staged npm publish.
4. **Both plugins to `^2.3.0`**, APERtrail re-exporting the lists rather than
   redefining them, NODAtrail resolving a link's kind through them. Step 1's
   chips become place and person chips here.
5. **The chosen shape**: `place` and `persons` on the draft, the two markers and
   their settings, the dialog fields, the composer, the round-trip guard, the
   span rules of §D.5, the settings reference rows, both translation tables.
   **This is the step that writes into somebody's notes.**
6. **The trip seeder fills in children** (§F.1's last bullet): the stop's place
   and persons, and never its note or rating.
7. **The Person note block** (§H).
8. **The travel side reading the day notes back** (§F.3), last, because it needs
   step 5 to have something to match on.

**Tests that will have to move**, listed because forgetting one is how this lands
red: `translation-keys` (both tables, and `DYNAMIC_KEYS` if a marker key is
built at runtime), `settings-reference` (a row per new setting, or the root test
fails), `settings-coverage`, `property-name-lock` if a property name is added,
the new travel-types contract test in the core, and `no-em-dash`, which reads
this file too.
