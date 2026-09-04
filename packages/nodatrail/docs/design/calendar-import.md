# Plan: getting a calendar into the plan view

Status: **design, nothing built. Decisions taken 2 September 2026** and
recorded in §G; §F is the order to build in. §A is the fact that shapes the
rest, §H is what the export does not contain, and §I is what the date range
costs.

The week and month views now show meetings, read from each day note's
`## 📅 Termine` section. Everything below is about where those meetings could
come from other than typing.

---

## A. The fact that shapes this: the suite does not use the network

There is not one `requestUrl` or `fetch` in any of the four packages. That is
not an oversight, and the settings page says so out loud about the one place
somebody would most expect a fetch:

> Nothing is fetched: a rate nobody chose is a rate nobody can check.
> -- `settings.display.ratesDesc`, on exchange rates

An exchange rate is objective, freely available, and changes daily, and this
suite still refuses to go and get one. A calendar sync would be the first
network call in the suite, and it would be fetching something less objective
into somewhere more expensive.

That does not settle it. It means "should this plugin talk to the internet at
all" is a decision about the **suite**, taken once, rather than a detail of a
calendar feature. §B.3 is where it actually bites.

## B. Three rungs, and they are not the same feature

They get lumped together as "calendar import" and they have almost nothing in
common except the file format.

### B.1 A file you drop in

Export `.ics` from Google or Apple, pick it in a dialog, see what it would do,
press the button. No network, no credentials, no background anything. The
plugin already has this exact shape, built and shipped, in the bank statement
import -- see §C.

Costs: one ICS parser, one preview modal. Everything else is already here.

### B.2 A URL it re-reads

Both Google and Apple publish a calendar as a secret `.ics` URL. Google calls
it the private address in calendar settings; Apple calls it a public calendar.
Fetching one is a plain unauthenticated `GET` of the same file §B.1 parses.

This is the rung people miss, and it is much closer to §B.1 than to §B.3:

- No OAuth, no client id, no consent screen, no token to store or refresh.
- One provider-independent code path. It works for iCloud, Google, Outlook,
  a Nextcloud server, anything that can publish an ICS.
- The credential is the URL itself. That is a real secret with no expiry and
  no revocation short of regenerating it, which is worth saying plainly: it
  would sit in `data.json`, in a vault that syncs through iCloud.

Costs: §B.1 plus a fetch, a refresh policy, and a decision about where the URL
lives.

### B.3 The Google Calendar API

Two-way sync, incremental updates, per-event push. This is a different
project, and the honest version of it:

- **OAuth for an installed app.** No client secret can be kept secret in a
  distributed plugin; Google accepts that for installed apps and expects PKCE.
  The redirect would go through Obsidian's own `obsidian://` protocol handler
  (`registerObsidianProtocolHandler`), which works but means the flow leaves
  and re-enters the app.
- **A refresh token in `data.json`**, in plain text, in a synced vault. That is
  a long-lived credential to somebody's whole calendar sitting in iCloud. It
  is the single strongest argument against this rung.
- **Two-way is where the danger is.** Writing back means this plugin can
  delete an appointment from a real calendar other people are looking at. The
  suite's rule that a bad write is discovered months later applies with much
  more force to somebody's Tuesday than to a note.
- Publishing a plugin that requests calendar scope also means a Google
  verification review, which is a real process with a real timeline.

**Decided: §B.1, and it is enough.** The business calendar this is for allows
export to a file and nothing else -- no published URL, no API access -- so
§B.2 and §B.3 are not merely deferred, they are unavailable for the calendar
that matters most. The private calendar can be exported the same way, which
makes one code path serve both.

That is a better position than it sounds. The rung that needs no network is
the rung that works, so the question in §A does not have to be answered at all
to ship this. §B.3 stays open to be argued on its own terms if it ever
becomes possible and wanted.

---

## C. What the statement import already decided for us

`ledger/import-modal.ts` and `core/ledger/import-plan.ts` are the same problem
solved once. Three of its rules transfer without change:

**The preview is the feature.**

> An import that wrote first and explained afterwards would be one nobody
> dares run on a second month.

Every parsed event shown with what it would do and why, nothing written until
a button is pressed. This is not a nicety here either: an ICS export routinely
holds a year of events, most of them already in the notes.

**Nothing in the parser writes.** `planImport` produces a proposal per row
with a status attached. The calendar version produces a proposal per event:
`new`, `already-present`, `changed-upstream`, `edited-here`, `outside-range`.

**Identity is derived, not stored.** `statementRowKey` builds a key from what
the row says, and `statementRowKeys` numbers collisions apart with an explicit
"this is the last resort" warning. Applying that here avoids the single most
invasive thing this feature could do -- see §D.

---

## D. The identity problem, which is where the note format is at risk

Re-importing must not duplicate. That needs a way to say "this line is that
event", and there are only two kinds of answer.

**Write the UID into the note.** ICS gives every event a stable `UID`, and
recurring instances a `RECURRENCE-ID`. Putting it on the line is exact and
survives editing the text. It also changes what a meeting line looks like:

```
- 👥 09:00-09:30 Meeting mit Care Management [[Beruf]] ^ics-4f3a91
```

That is a note format change, which this project treats as the expensive
class. Every reader of that line has to tolerate it, `parseScheduleLine` has
to strip it, the editing dialog's round-trip rule has to reproduce it exactly
or the entry becomes read-only, and it is in the user's notes forever whether
or not they keep using the importer.

**Derive the key from the line**, as the statement import does: the day, the
start time and the text. Nothing is written that was not going to be written
anyway, and a note that has never been imported into is indistinguishable from
one that has.

The cost is honest and worth stating: rename an event in Google and the
derived key stops matching, so the import offers it as new and the old line
stays. That is a duplicate a person can see and delete, which is the failure
this project prefers -- visible and recoverable, rather than silent.

**Decided: derive it.** Revisit only if real use produces real duplicates. A
note format is much easier to add to than to take back.

**With one addition the derived key alone cannot cover.** §G.5 asks the
importer to list events it previously imported that are no longer in the
export. Nothing in the notes says which lines came from an import, and the
whole point of deriving the key was to keep it that way.

**First answer, and it was the wrong one: a record in `data.json`** -- the
keys written, per source file. It works, and it is what this document said to
build for a fortnight.

**What it missed** is that it would have been the first thing NODAtrail
remembers rather than recomputes, in a plugin whose statement archive
explicitly refuses to: *"Replayed rather than remembered. Nothing was written
down about the import, so this is what is true now."* The same rule that keeps
balances out of frontmatter applies to an importer's memory of itself, and a
record that can drift from the notes it describes is a record that eventually
lies about them.

**Decided instead: archive the `.ics` and replay it.** The file is copied into
the vault beside the day notes it fed, exactly as `archiveStatement` copies a
CSV beside its journal notes, and named for the range it was imported under.
The next run reads the newest archived file for that source, expands it over
its own range, and diffs. Nothing is remembered; the raw export is kept, which
is also the only way to ever re-run an import differently; and no settings key,
validator entry or reference row is needed at all.

**What replay can and cannot say, exactly.** It recovers what an earlier export
*offered*, not what the importer *wrote* -- a line already in the note was
offered and skipped, and the two are indistinguishable afterwards. That is a
weaker claim, and it is worth being plain that it costs something: a meeting
that was in an old export, that somebody had also typed by hand, and that has
since gone from the calendar, is listed as gone. The listing says whether the
line is still in the note, so it is visible rather than misleading.

The guarantee that actually mattered survives untouched. A meeting somebody
typed and that was never in any export is in no archived file either, so it can
never be reported as having disappeared from one. That was the failure §D was
protecting against, and it is still protected.

---

## E. The three things that will actually cost the time

Not the parsing. `BEGIN:VEVENT` to a record is an afternoon. These are not.

### E.1 Recurrence

`RRULE` with `BYDAY`, `BYSETPOS`, `COUNT` against `UNTIL`, `EXDATE` for the
skipped ones, and separate `VEVENT`s carrying `RECURRENCE-ID` to override a
single instance. A weekly standup is an `RRULE`, so this is not an exotic
case, it is the first thing anybody imports.

Two ways out, and the second is much cheaper:

- Expand the rule properly. Correct, and a genuinely large piece of work with
  a long tail of calendar-arithmetic bugs -- the same family as the
  daylight-saving bug already found in `eachDay`.
- **Import a bounded window** -- this month, next month -- and expand
  occurrences only inside it. A recurring event becomes N ordinary events with
  dates. Re-running next month picks up the next window. It cannot answer
  "what does my Tuesday look like in 2027", which a plan view was never going
  to be asked anyway.

  **Decided, and the window is now doing a second job**: it is also how an
  import is kept to a week or a month rather than swallowing the file. See §I,
  which works out what the range rule costs.

### E.2 Time zones

`VTIMEZONE` blocks, `TZID` per event, floating times with no zone at all, and
`Z`-suffixed UTC. A meeting imported an hour wrong is worse than one not
imported, because it looks right.

The core already forbids `new Date()` without an injectable override, which is
the discipline this needs. It does not yet have a timezone conversion, and
this is the piece most likely to want one.

**This section was right, and it was not acted on until after it had cost
something.** The import shipped copying the clock digits and ignoring what the
file said about them, and it stayed that way through the whole build: `ics.ts`
parsed the `Z` suffix into `utc` and the `TZID` into `zone`, `EventOccurrence`
carried both with a comment saying they were "carried through untouched for the
caller to convert", and the caller never converted. `import-plan.ts` read
`occurrence.time` and wrote it down.

What that cost, measured on one real export of 3,168 events: **1,731 stated
`TZID=Europe/Zurich` and were right; 873 bare `Z` were two hours early in
summer and one in winter; 170 in Madrid and Berlin were right by luck**, since
those keep the same clock as Zurich; 388 all-day and 6 floating were
unaffected. So about a third of the timed meetings in a vault, wrong in exactly
the way this section warned about: an eight o'clock meeting reading 06:00 looks
like an early start, not a fault. It was found by the vault's owner noticing one
entry, not by anything in the suite.

`core/src/calendar/zones.ts` is the conversion. `inZone(moment, zone)` reads a
`Z` as an instant and a `TZID` as that zone's wall clock, converts both into the
zone the vault keeps its notes in, and leaves floating times and all-day dates
alone -- floating already means "this clock, wherever you are", and converting
an all-day date would move a birthday over midnight. The zone is an argument
everywhere; `plan/vault-zone.ts` is the one place that asks the runtime.

Two things worth knowing about it. **The conversion happens in `occurrenceLines`
and nowhere else**, because `priorLinesOf` walks the same function: a key is
derived from a converted clock, so a replay converting differently would report
every meeting as new and gone at once. And **the zone is the machine's**, so
importing the same file on a machine set elsewhere writes different times. The
alternative, reading `X-WR-TIMEZONE` out of the file, is stable across machines
and wrong for anybody whose calendar is published in a zone they do not live in.

### E.2a Fixing the reader does not fix the notes

A corrected line derives a different key, so a re-import finds no line at that
key, finds the old key in the history, and reports `changed-upstream` -- which
writes the correct line and, by §G.6, **leaves the wrong one where it is**. The
vault would end up holding an 06:00 and an 08:00 with nothing to say which is
which, once per affected meeting.

So `plan/repair-times.ts` runs first. It reads each archived `.ics` twice, once
with no zone and once with the vault's, and a pair that disagrees names a line
to look for -- **searched by the old reading**, because what is in the note is
what the old importer wrote.

It **rewrites the clock in place and nothing else**: `replaceLines` over the
entry's own span with the entry recomposed from the record read out of the note,
which is `updateAnswers`' mechanism and inherits its three guards. The marker,
the link, the notes indented under the meeting and the follow-ups all survive,
because they come from the note rather than from the export.

**A repaired line is moved to where its new time belongs**, and that was not
the first answer. Rewriting in place is what protects the notes indented under a
meeting, and it also means a line corrected from 07:00 to 09:00 keeps the slot
07:00 earned: the first run put eleven lines between 09:30 and 10:00 in the
vault this was built for, and a day listing its meetings out of order is a day
nobody trusts. So the entry is lifted out, the positions are read again, and it
is put down before the first entry that starts later.

That is the narrowest reordering there is: **only the entry this run moved, and
only among the entries under its own heading.** Anything arranged by hand stays
arranged, and an entry with no time keeps its place because it has nowhere to
sort to. `appendUnderHeading`'s rule that a write must not tidy a note in
passing still stands -- this is not tidying, it is putting back what the same
run displaced.

**A line whose day changes is reported and not moved.** Repairing one means
taking it out of one note and putting it in another, which is a delete however
it is dressed. In the export above there were three of those against about eight
hundred and seventy that only needed their clock corrected, which is the ratio
that made reporting them the right answer rather than a cop-out.

### E.3 All-day events and multi-day spans

`DTSTART;VALUE=DATE` has no time, which the meeting line already handles -- an
untimed meeting renders above the bands. A multi-day event has no
representation at all: the note format is one line in one day's note.

**Decided: expand.** A holiday from the 7th to the 14th becomes eight untimed
lines, one per day note. It is the only option under which the week view shows
the holiday on the days it covers, which is the whole reason for looking at a
week.

Two consequences to build for. The end of an all-day `VEVENT` is **exclusive**
in RFC 5545 -- `DTEND;VALUE=DATE:20260915` means the event ends on the 14th --
and getting that wrong adds a spurious day to every multi-day event. And eight
lines from one event means eight derived keys; the importer's record (§D) has
to hold all eight, or a later import offers seven of them again.

---

## F. What I would build, in order

**1. The parser, in `trail-core`. Approved.** ICS is a public interchange
format defined by RFC 5545, not a product's model of one, which is the same
argument the core makes for a note format and for a solar solve.

**It rests on the format argument alone, and that is worth pinning down so
nobody later reads it as more than it is.** The two-consumer test was *not*
met: APERtrail could plausibly want a trip's dates out of an ICS one day, and
CULItrail has no use for it at all, so today there is exactly one consumer. The
promotion was granted because a format is a statement about a file rather than
one product's model of it -- if a second consumer never appears, the decision
still stands on that.

Pure, clock-free, no Obsidian.

**Built, in two files rather than one.** `ics.ts` reads the file and stops
there; `recurrence.ts` turns a rule into the days it lands on. Splitting them
was not tidiness -- a parser that also expanded is a parser nobody can test
against a fixture, and the recurrence half is where the long tail of §E.1
lives.

Two things `recurrence.ts` hands the caller that the later steps must not
swallow:

- **`unsupported`** names the rule parts it found and does not implement. A
  series carrying one has to be shown as such in the preview. Dropping a
  `BYSETPOS` and expanding the rest gives four plausible wrong meetings in
  place of one right one, and nobody discovers that until they are in the
  wrong room.
- **`truncated`** distinguishes "this series has no occurrences here" from
  "the walk gave up before reaching them". Silently identical outcomes,
  entirely different causes.

**2. The proposal**, also in the core, modelled on `planImport`: events plus
what the vault already holds, in; a status per event, out. Nothing writes.

**Built.** `planCalendarImport` decides six statuses in one order, and the
order is the design: a rule we cannot honour stops first, then a line already
saying it, then what an earlier export said, then new. Two things about it are
answers to §I rather than to §C. It reports the days it would **touch** rather
than the range it was given, because a holiday from 28 September writes five
October notes. And its missing list is scoped to days inside this range, or a
second import announces thirty cancellations that are really thirty things it
never looked for.

`LOCATION` is carried on the proposal for the preview and **not put on the
line**. The note format has no place for it, inventing one is a change to what
gets written into a vault rather than a detail of an importer, and a location
edited in Google would change the derived key and read as a new event.

**3. The preview modal**, in NODAtrail, modelled on `import-modal.ts`. Pick a
file, pick a date window, see the counts, press the button.

An `<input type="file">` reading from the machine, which is the house pattern
already: the statement import does it, and so do the document and image fields.
An `.ics` lands in a downloads folder, not in a vault.

**It opens on the current week**, Monday to Sunday. The smallest range that is
worth running, it matches the view the plan is actually used in, and a first
import that puts seven days in a vault is one somebody can check by reading it.
Three presets beside the dates: this week, next week, this month.

**Built, and with no checkboxes.** A row's inclusion is its status, exactly as
in the statement import: `new` and `changed-upstream` are written and
everything else is shown and skipped. A per-row override would be a second
place holding the rule the plan already holds, and the two would disagree the
first time one changed.

It shows three things a simpler preview would leave off, each because §I worked
out that leaving it off is how somebody is surprised: the **days it will
touch**, and a line saying so plainly when any of them fall outside the range;
the **gap** since the last import of this source; and the **series whose rules
it cannot read**, because their dates would be wrong rather than absent, and
wrong is the one nobody notices.

**4. The write**, through the existing `appendUnderHeading`, so an imported
meeting is the same line a person would have typed and everything downstream
already reads it. Then the archive, after the write and only after: a file kept
for an import that threw would describe something that did not happen. That is
`archiveStatement`'s own ordering, and its reason.

**Built.** The line comes from `entryLines` and the same `DayEntryDraft` the
capture dialog fills in, rather than from a template written in the importer.
That is not tidiness: §D's derived key works only while an imported meeting and
a typed one are the same thing, and a second way of composing the line would be
a second thing to keep in step with the marker setting, the editing dialog and
every reader downstream.

**One read and one write per note**, whatever a day gains. A week of a busy
calendar is thirty meetings across seven notes, and thirty rewrites would be
thirty chances for a concurrent edit to be lost -- `ledger/import-write.ts`
learned that once already. Days are written in date order, so a run that fails
part way through has filled the days before the failure rather than a
scattering of them. And a day note that did not exist gains frontmatter and no
body: the schedule heading appears because the first meeting needed it, never
because a month of empty days was seeded with headings nobody asked for.

**5. Then, and only as a separate step, the URL** of §B.2. It is a fetch and a
refresh policy on top of a feature that already works, which is the right
shape for the first network call in the suite: reversible, and off by default.

§B.3 is not on this list on purpose.

---

## G. Decided

**G.1 Which rung: §B.1, a file.** The business calendar allows no other
export. The private one can use the same path. §B.3 may be revisited if it
ever becomes both possible and wanted.

**G.2 A missing day note is created.** An event on a day with no note gets one,
rather than being skipped and reported. `openOrCreatePeriodNote` already does
this for the capture dialog, so an imported meeting lands the same way a typed
one does.

**G.3 Multi-day events expand**, one line per day. See §E.3 for the exclusive
`DTEND` trap and what it means for the key record.

**G.4 The parser goes in `trail-core`.** On the format argument rather than the
two-consumer one, which is stated plainly in §F.1 so that nobody later reads
this as the two-consumer test having been met.

**G.5 An import takes a date range**, and an occurrence starting inside it is
imported whole even where it runs past the end. §I works out the four things
that follow, two of which are ways to report a false loss.

**G.6 The importer never removes a line.** It lists events it wrote that are no
longer in the export, and a person deletes them. This is what forces the key
record in §D: the importer has to know what it wrote to be able to say what has
gone, and it must not guess by flagging anything it does not recognise, because
that is every meeting somebody typed by hand.

An import that could delete is an import that owns the section. It does not.

**It writes a task instead.** A checkbox per row that deleted on tick was built
and then thrown away: it worked, and it was guarded five ways, and it was still
a button that took lines out of somebody's records on one press. What the list
actually suffers from is not being hard to act on, it is being easy to read past
-- a week's is two rows and a month's is twenty, and a list nobody acts on is a
list that stops being read.

So each meeting that has gone from the export **and is still in the notes** gets
one task, under the focus heading of the day the import was run, due that day,
naming the meeting and linking the day it sits on. A task is this plugin's own
way of saying "this needs a person", it is the one thing here that will still be
in front of somebody tomorrow, and it removes nothing.

One task per meeting rather than one task carrying a list, because a task has a
text, a context, a due date and a priority and **no notes field**: a task with
lines indented under it is one the capture dialog cannot compose back, and it
would be read-only in the day view for ever. The cost is plain -- a month import
that drops twenty meetings writes twenty tasks -- and it is a fair account of
twenty notes to edit.

Written once. Re-importing the same range finds the task already there and skips
it, matching on the day and the meeting rather than on the whole line, so
**ticking the box does not bring the reminder back** on the next run. The search
covers the focus section alone, so an import run on the day of a meeting does
not read that meeting's own line as a reminder about itself.

`plan/missing-checks.ts`. What makes the list worth acting on at all is §D's
record: a meeting somebody typed by hand was never in any export, so it can
never be reported as having gone from one.

---

## I. The window, and the four things that follow from it

An import takes a date range -- a week, a month -- rather than swallowing the
file. **An occurrence that starts inside the window is imported whole**, even
where it runs past the end.

The window is one control doing two jobs, which is why it is worth having
rather than merely tolerable: §E.1 already wanted a bounded range to keep
recurrence expansion finite, and this makes the same control the answer to
"do not put three years of standups in my vault". One thing to explain, two
problems solved.

The rule is short. What follows from it is not, and each of these would
otherwise be found months later.

### I.1 The import writes outside its own window

A holiday from 28 September to 5 October, imported with a window of September,
writes eight day notes -- five of them in October. That is correct and it is
what "imported whole" means, but it has to be said out loud, because the
obvious mental model of a window is that nothing happens outside it.

The preview must therefore show the days it will touch, not the window it was
given. An import that reported "September" and then created `2026-10-03.md`
would be a surprise in somebody's vault, which is the thing this whole feature
is arranged to avoid.

### I.2 The missing-events list has to be scoped to the window

§G.5 says the importer lists what it previously wrote that is no longer in the
export. That comparison is only sound within one window.

Import September, then import October. Every September key is absent from the
October export -- not because anything was cancelled, but because it was never
in range. Reported naively, the second import announces that thirty meetings
have disappeared from Google, all of them wrong.

So the missing list is scoped, and the built version scopes it by the
**occurrence's own day** rather than by the range the earlier import ran under.
That is the stronger test and it subsumes the weaker one, because an occurrence
is only ever offered by a run whose range contains its start. The rule it
protects is the one already established: **never flag something as gone when
the truth is that it was not looked for.** It is the same failure as flagging a
hand-typed meeting, arriving by a different route.

### I.3 A straddling event belongs to the earlier window only

"Starts in the window" means the 28 September holiday belongs to September's
import and to no other. Import October on its own and it is not there at all,
because it does not start in October.

That is the right rule -- the alternative, importing anything that overlaps,
means the holiday arrives twice and the second import has to recognise that
its own eight lines are already present -- but it makes windows a sequence
rather than independent queries. **Contiguous or overlapping windows import
everything; a gap between them loses whatever straddles the gap.**

Worth a line in the preview when the window does not adjoin the last one
imported, since the record from §D already knows what that was.

### I.4 "Starts in the window" is about the occurrence, not the series

A weekly standup has a `DTSTART` in 2024 and an `RRULE` running to next year.
Testing the series' start against the window would import nothing at all --
and it is exactly the recurring meetings a working week is made of.

So the window is applied after expansion, to each occurrence. The `VEVENT` is
a rule; what gets a date, a key and a line is an instance of it. Anything that
tests `DTSTART` before expanding has this bug, and it presents as "my
recurring meetings never import", which reads like a parser failure rather
than a range one.

---

## J. What you answered is in the file, and it is better than colour

Asked after the first real import, from the other end of §H: a calendar holds
meetings somebody is not going to, and the import was writing them as though
they were.

**It is in the file, per person and per occurrence.** Every invitation carries
an `ATTENDEE` line for each guest with that guest's own `PARTSTAT`, and one
real year of a working calendar reads 712 `ACCEPTED`, 486 `DECLINED`, 328
`NEEDS-ACTION` and 45 `TENTATIVE`. `ROLE` separately marks 173 as
`OPT-PARTICIPANT`.

**And the file says whose calendar it is.** `X-WR-CALNAME` holds the account's
own address, which is what picks your line out of the thirty on a meeting.
Being asked for your own email address by a program reading your own calendar
is a poor way to start, so it is read rather than configured.

**Decided: import everything, and let the marker say what you answered.**
Filtering was the obvious answer and it is the wrong one -- a meeting you
declined is still an hour somebody else has booked and still the reason nothing
else is in that slot, so a day without it reads as freer than it is. Four
markers, all settings: `dayMeetingMarker` covers accepted *and* a meeting you
wrote down yourself, because to a reader those are one thing, and the other
three cover maybe, unanswered and no. A blank marker means "do not distinguish
these", not "write these unmarked".

### J.1 The answer is per occurrence, and a per-series reading is wrong

A standing meeting is one `RRULE` and a scattering of `RECURRENCE-ID`
overrides, and the answer lives on whichever of them describes the day. In the
calendar this was built against, `PTM incl. Change Board` reads `NEEDS-ACTION`
as a series and `DECLINED` on twelve particular Thursdays. Reading the series
gets those twelve wrong; reading a series accepted once and long abandoned gets
all of them wrong the other way.

### J.2 The marker is not in the key, and the import corrects it in place

The derived key of §D is the day, the time and the text. Adding the answer to
it would offer every meeting a second time the moment you declined it, so it
stays out.

**That was first written down as a limitation, and the limitation was wrong**
-- not in its reasoning, which still holds, but in calling the case rare. The
first week of real use answered it: the workflow is to import the week, and
then on Monday morning go through the meetings deciding which to attend and
declining the rest in the calendar. Every one of those changes an answer *after*
the line was written. That is not an edge case, it is the main case, and
leaving it out meant flipping each meeting by hand in the dialog as well as
declining it in the calendar.

**So the import compares, and corrects the marker in place.** The plan is told
what each line already says it answered, in the file's own `PARTSTAT`
vocabulary so that both sides of the comparison are one kind of thing, and a
line whose answer has moved comes back as `answer-changed` naming the line to
rewrite. Either direction: a meeting declined and then accepted is as wrong as
the other way round.

**This is the only write in the feature that touches a line somebody already
has**, and it is guarded three ways, each refusing rather than guessing. The
line must be findable by day, time and text and match exactly once, since two
identical meetings give no way to say which was meant. Its record must be
`editable`, meaning composing it back reproduces the line character for
character -- the editor's own rule, which does not get weaker for being reached
from an importer. And only the marker changes: the draft is the one read out of
the note, with the answer replaced, so the text, the context and every child
line stay the note's own. A line it will not touch is reported rather than
silently skipped.

The corrections run before the appends, because both rewrite the same note and
the append reads the body immediately before writing it.

The capture dialog keeps its attendance field. It is how a line the import
refuses gets fixed, and how somebody records an answer the calendar never
carried.

The dialog also has to hold the field for a duller reason: an entry composed
without it comes back marked as accepted, stops reproducing the line it came
from, and goes read-only. The meeting you declined is exactly the one you later
want to edit.

---

## H. Colours are not in the file

Asked, and worth writing down because the answer is counter-intuitive: Google
Calendar's `.ics` export carries **no event colour at all**. RFC 5545 has no
colour property; RFC 7986 §5.9 added `COLOR` in 2016, and Google has not
adopted it -- the colour lives in Google's own API as a `colorId` and never
reaches the exported file. Apple emits `X-APPLE-CALENDAR-COLOR`, but that is
the colour of a whole calendar rather than of an event, and it is a vendor
extension rather than the standard.

So a colour-coded Google calendar exports as an undifferentiated list, and
there is nothing to import.

**What replaces it is better anyway: the file it came from.** Two exports, one
business and one private, are two imports, and the importer knows which is
which -- something the colour could only ever have approximated.

That maps onto the note format exactly as it stands, with nothing new invented:
this vault's existing meetings already read

```
- 👥 09:00-09:30 Meeting mit Care Management [[Beruf]]
```

So an import takes an optional link to stamp on every event it writes, and a
business export becomes meetings tagged `[[Beruf]]`. They are then
distinguishable everywhere -- in the plan view, in search, in the backlinks of
the area note -- rather than only by a colour in one view. A separate marker
per source (`👥` against something else) is available for the same job if the
link is not wanted.

This is the second time this feature has come out ahead by not having a field:
no UID in the line, and now no colour.
